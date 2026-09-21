'use strict';

// Per-site traffic, aggregated from nginx access logs.
//
// nginx is configured (docker/nginx.conf) with the `json_analytics` log format,
// so every line is one JSON object. We tail the log files, bucket each request
// by minute and by virtual host, and keep the last MINUTES buckets in memory.
// Nothing is persisted — a restart starts the window over.

const fs = require('fs');
const path = require('path');

const MINUTES = 60;          // rolling window kept in memory
const MAX_LATENCIES = 500;   // per bucket, per site — enough for a stable p95
const MAX_PATHS = 200;       // distinct paths tracked per bucket
const MAX_IPS = 5000;        // distinct visitor IPs tracked per bucket

// site name -> Map<minuteEpoch, bucket>
const buckets = new Map();
let parseErrors = 0;
let linesSeen = 0;

function minuteOf(ms) {
    return Math.floor(ms / 60000);
}

function newBucket() {
    return {
        count: 0,
        bytes: 0,
        status: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 },
        latencies: [],
        paths: new Map(),
        referrers: new Map(),
        ips: new Set(),
        methods: new Map(),
    };
}

function bump(map, key, cap) {
    if (!map.has(key) && map.size >= cap) return;
    map.set(key, (map.get(key) || 0) + 1);
}

function record(entry) {
    if (!entry) return;
    const site = entry.host || 'unknown';
    const at = entry.at || Date.now();
    const minute = minuteOf(at);

    if (!buckets.has(site)) buckets.set(site, new Map());
    const perSite = buckets.get(site);
    if (!perSite.has(minute)) perSite.set(minute, newBucket());
    const b = perSite.get(minute);

    b.count += 1;
    b.bytes += entry.bytes || 0;

    const s = entry.status;
    if (s >= 200 && s < 300) b.status['2xx'] += 1;
    else if (s >= 300 && s < 400) b.status['3xx'] += 1;
    else if (s >= 400 && s < 500) b.status['4xx'] += 1;
    else if (s >= 500) b.status['5xx'] += 1;
    else b.status.other += 1;

    if (typeof entry.request_time === 'number' && !Number.isNaN(entry.request_time)
        && b.latencies.length < MAX_LATENCIES) {
        b.latencies.push(entry.request_time);
    }
    if (entry.path) bump(b.paths, entry.path, MAX_PATHS);
    if (entry.referrer) bump(b.referrers, entry.referrer, MAX_PATHS);
    if (entry.method) bump(b.methods, entry.method, 16);
    if (entry.ip && b.ips.size < MAX_IPS) b.ips.add(entry.ip);
}

// Drop buckets that fell out of the rolling window.
function prune() {
    const cutoff = minuteOf(Date.now()) - MINUTES;
    for (const [site, perSite] of buckets) {
        for (const minute of perSite.keys()) {
            if (minute < cutoff) perSite.delete(minute);
        }
        if (perSite.size === 0) buckets.delete(site);
    }
}

// --- Log line parsing --------------------------------------------------

function normalizeReferrer(ref) {
    if (!ref || ref === '-') return '';
    try {
        return new URL(ref).hostname;
    } catch (e) {
        return '';
    }
}

function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed[0] !== '{') return null;
    let o;
    try {
        o = JSON.parse(trimmed);
    } catch (e) {
        parseErrors += 1;
        return null;
    }
    const ts = Date.parse(o.time || o.time_iso8601 || '');
    // Strip the query string: /search?q=secret should group under /search.
    const uri = String(o.uri || o.request_uri || '');
    return {
        at: Number.isNaN(ts) ? Date.now() : ts,
        host: o.host || o.server_name || 'unknown',
        status: Number(o.status) || 0,
        bytes: Number(o.bytes_sent || o.body_bytes_sent) || 0,
        request_time: Number(o.request_time),
        path: uri.split('?')[0] || '/',
        method: o.method || o.request_method || '',
        referrer: normalizeReferrer(o.referrer || o.http_referer),
        ip: o.remote_addr || '',
    };
}

// --- Log tailing -------------------------------------------------------
// Each file keeps its read offset. If the file shrinks (logrotate) we start
// over from 0; if it disappears we wait for it to come back.

const tails = new Map();   // file -> { pos, partial }
const readFailures = new Map();   // file -> errno, surfaced in the report

// The dashboard runs as a non-root user, and nginx logs are commonly
// root:adm 0640 — so "no traffic" is often really "cannot read the log".
// Record why instead of failing silently.
function noteFailure(file, err) {
    readFailures.set(file, err.code || err.message);
}

function readNew(file) {
    let stat;
    try {
        stat = fs.statSync(file);
    } catch (e) {
        return;   // rotated away or not created yet — try again next tick
    }
    if (!tails.has(file)) {
        // Start at the end: we only want traffic from now on, not a backlog
        // from a log file that may be days old.
        tails.set(file, { pos: stat.size, partial: '' });
        return;
    }
    const t = tails.get(file);
    if (stat.size < t.pos) {
        t.pos = 0;         // truncated or rotated in place
        t.partial = '';
    }
    if (stat.size === t.pos) return;

    let fd;
    try {
        fd = fs.openSync(file, 'r');
    } catch (e) {
        noteFailure(file, e);
        return;
    }
    readFailures.delete(file);
    try {
        const length = stat.size - t.pos;
        const buf = Buffer.allocUnsafe(length);
        const bytesRead = fs.readSync(fd, buf, 0, length, t.pos);
        t.pos += bytesRead;
        const chunk = t.partial + buf.subarray(0, bytesRead).toString('utf8');
        const lines = chunk.split('\n');
        t.partial = lines.pop();   // last element is an incomplete line
        for (const line of lines) {
            const entry = parseLine(line);
            if (entry) {
                linesSeen += 1;
                record(entry);
            }
        }
    } finally {
        fs.closeSync(fd);
    }
}

function discoverLogs(dir, pattern) {
    try {
        const files = fs.readdirSync(dir)
            .filter((f) => pattern.test(f))
            .map((f) => path.join(dir, f));
        readFailures.delete(dir);
        return files;
    } catch (e) {
        noteFailure(dir, e);
        return [];
    }
}

// --- Reporting ---------------------------------------------------------

function percentile(sorted, p) {
    if (!sorted.length) return null;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return Math.round(sorted[idx] * 1000);   // seconds -> ms
}

function topN(map, n) {
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([key, count]) => ({ key, count }));
}

function mergeCounts(target, source) {
    for (const [k, v] of source) target.set(k, (target.get(k) || 0) + v);
}

// Summarise one site over the last `windowMinutes` minutes.
function summarise(site, perSite, windowMinutes) {
    const nowMinute = minuteOf(Date.now());
    const from = nowMinute - windowMinutes + 1;

    const series = [];
    const totals = newBucket();
    for (let m = from; m <= nowMinute; m += 1) {
        const b = perSite.get(m);
        if (b) {
            totals.count += b.count;
            totals.bytes += b.bytes;
            for (const k of Object.keys(totals.status)) totals.status[k] += b.status[k];
            totals.latencies.push(...b.latencies);
            mergeCounts(totals.paths, b.paths);
            mergeCounts(totals.referrers, b.referrers);
            mergeCounts(totals.methods, b.methods);
            for (const ip of b.ips) totals.ips.add(ip);
        }
        series.push({
            minute: m * 60000,
            requests: b ? b.count : 0,
            errors: b ? b.status['5xx'] : 0,
            bytes: b ? b.bytes : 0,
        });
    }

    const sorted = totals.latencies.slice().sort((a, b) => a - b);
    const avg = sorted.length
        ? Math.round((sorted.reduce((a, b) => a + b, 0) / sorted.length) * 1000)
        : null;

    return {
        site,
        window_minutes: windowMinutes,
        requests: totals.count,
        bytes: totals.bytes,
        unique_visitors: totals.ips.size,
        requests_per_min: Math.round((totals.count / windowMinutes) * 10) / 10,
        status: totals.status,
        error_rate: totals.count
            ? Math.round(((totals.status['4xx'] + totals.status['5xx']) / totals.count) * 1000) / 10
            : 0,
        latency_ms: {
            avg,
            p50: percentile(sorted, 50),
            p95: percentile(sorted, 95),
            p99: percentile(sorted, 99),
        },
        top_paths: topN(totals.paths, 8),
        top_referrers: topN(totals.referrers, 8),
        methods: topN(totals.methods, 8),
        series,
    };
}

function report(windowMinutes) {
    const w = Math.max(1, Math.min(MINUTES, Number(windowMinutes) || MINUTES));
    const sites = [...buckets.entries()]
        .map(([site, perSite]) => summarise(site, perSite, w))
        .sort((a, b) => b.requests - a.requests);
    return {
        generated_at: new Date().toISOString(),
        window_minutes: w,
        lines_parsed: linesSeen,
        parse_errors: parseErrors,
        sources: [...tails.keys()],
        unreadable: [...readFailures.entries()].map(([file, error]) => ({ file, error })),
        sites,
    };
}

// --- Lifecycle ---------------------------------------------------------

function start(options) {
    const opts = options || {};
    // NGINX_LOG_DIR may list several directories (comma-separated) — one for
    // the nginx in this compose file, one for the host's nginx serving the
    // other sites on the VPS.
    const dirs = (opts.dir || process.env.NGINX_LOG_DIR || '/var/log/nginx')
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    const pattern = new RegExp(opts.pattern || process.env.NGINX_LOG_PATTERN || '^access.*\\.log$');
    const intervalMs = opts.intervalMs || 2000;

    const tick = () => {
        for (const dir of dirs) {
            for (const file of discoverLogs(dir, pattern)) readNew(file);
        }
        prune();
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    timer.unref();
    console.log('[traffic] tailing ' + dirs.join(', ') + ' (' + pattern + ')');
    return () => clearInterval(timer);
}

module.exports = { start, report, record, parseLine, MINUTES };
