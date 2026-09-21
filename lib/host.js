'use strict';

// Host (VPS) metrics, read straight from procfs. In Docker the host's /proc,
// /sys and rootfs are bind-mounted read-only (see docker-compose.yml), so
// HOST_PROC points at those instead of the container's own view.

const fs = require('fs');
const path = require('path');

const PROC = process.env.HOST_PROC || '/proc';
const ROOTFS = process.env.HOST_ROOTFS || '/';

function readOrNull(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        return null;
    }
}

// --- CPU ---------------------------------------------------------------
// /proc/stat gives cumulative jiffies; usage is the delta between two reads.

function readCpuTimes() {
    const raw = readOrNull(path.join(PROC, 'stat'));
    if (!raw) return null;
    const line = raw.split('\n').find((l) => l.startsWith('cpu '));
    if (!line) return null;
    const parts = line.trim().split(/\s+/).slice(1).map(Number);
    const idle = (parts[3] || 0) + (parts[4] || 0);           // idle + iowait
    const total = parts.reduce((a, b) => a + b, 0);
    return { idle, total };
}

let prevCpu = readCpuTimes();

function cpuUsage() {
    const now = readCpuTimes();
    if (!now || !prevCpu) return null;
    const totalDelta = now.total - prevCpu.total;
    const idleDelta = now.idle - prevCpu.idle;
    prevCpu = now;
    if (totalDelta <= 0) return null;
    return round1(((totalDelta - idleDelta) / totalDelta) * 100);
}

function cpuCount() {
    const raw = readOrNull(path.join(PROC, 'cpuinfo'));
    if (!raw) return null;
    const n = raw.split('\n').filter((l) => l.startsWith('processor')).length;
    return n || null;
}

// --- Memory ------------------------------------------------------------

function memory() {
    const raw = readOrNull(path.join(PROC, 'meminfo'));
    if (!raw) return null;
    const kv = {};
    for (const line of raw.split('\n')) {
        const m = line.match(/^(\w+):\s+(\d+)/);
        if (m) kv[m[1]] = Number(m[2]) * 1024;   // kB → bytes
    }
    const total = kv.MemTotal || 0;
    // MemAvailable is the kernel's own estimate — more honest than free+cached.
    const available = kv.MemAvailable != null ? kv.MemAvailable : kv.MemFree || 0;
    const swapTotal = kv.SwapTotal || 0;
    const swapUsed = swapTotal - (kv.SwapFree || 0);
    return {
        total,
        available,
        used: total - available,
        percent: total ? round1(((total - available) / total) * 100) : null,
        swap_total: swapTotal,
        swap_used: swapUsed,
        swap_percent: swapTotal ? round1((swapUsed / swapTotal) * 100) : null,
    };
}

// --- Load & uptime -----------------------------------------------------

function loadavg() {
    const raw = readOrNull(path.join(PROC, 'loadavg'));
    if (!raw) return null;
    const [one, five, fifteen] = raw.trim().split(/\s+/).map(Number);
    return { '1m': one, '5m': five, '15m': fifteen };
}

function uptimeSeconds() {
    const raw = readOrNull(path.join(PROC, 'uptime'));
    if (!raw) return null;
    return Math.floor(Number(raw.trim().split(/\s+/)[0]));
}

// --- Disk --------------------------------------------------------------

function disk() {
    try {
        const s = fs.statfsSync(ROOTFS);
        const total = s.blocks * s.bsize;
        const free = s.bavail * s.bsize;       // bavail: free to unprivileged users
        const used = total - free;
        return {
            total,
            free,
            used,
            percent: total ? round1((used / total) * 100) : null,
        };
    } catch (e) {
        return null;
    }
}

// --- Network -----------------------------------------------------------
// /proc/net/dev is cumulative too, so report both totals and per-second rates.

const SKIP_IFACE = /^(lo|docker|br-|veth|virbr)/;

function readNetTotals() {
    const raw = readOrNull(path.join(PROC, 'net/dev'));
    if (!raw) return null;
    let rx = 0;
    let tx = 0;
    for (const line of raw.split('\n').slice(2)) {
        const m = line.match(/^\s*([^:]+):\s*(.*)$/);
        if (!m) continue;
        const iface = m[1].trim();
        if (SKIP_IFACE.test(iface)) continue;
        const f = m[2].trim().split(/\s+/).map(Number);
        rx += f[0] || 0;
        tx += f[8] || 0;
    }
    return { rx, tx, at: Date.now() };
}

let prevNet = readNetTotals();

function network() {
    const now = readNetTotals();
    if (!now) return null;
    let rate = { rx_per_sec: null, tx_per_sec: null };
    if (prevNet) {
        const secs = (now.at - prevNet.at) / 1000;
        if (secs > 0) {
            rate = {
                rx_per_sec: Math.max(0, Math.round((now.rx - prevNet.rx) / secs)),
                tx_per_sec: Math.max(0, Math.round((now.tx - prevNet.tx) / secs)),
            };
        }
    }
    prevNet = now;
    return { rx_total: now.rx, tx_total: now.tx, ...rate };
}

function round1(n) {
    return Math.round(n * 10) / 10;
}

function snapshot() {
    return {
        at: Date.now(),
        cpu: { percent: cpuUsage(), cores: cpuCount() },
        memory: memory(),
        disk: disk(),
        load: loadavg(),
        network: network(),
        uptime_seconds: uptimeSeconds(),
    };
}

// --- Sampling ----------------------------------------------------------
// CPU and network are deltas, so they only make sense when sampled on a fixed
// cadence. We keep the last hour in a ring buffer for the sparklines; nothing
// is written to disk.

const HISTORY_SIZE = 360;   // 60 min at one sample per 10s
const history = [];
let latest = null;

function sample() {
    latest = snapshot();
    history.push({
        at: latest.at,
        cpu: latest.cpu.percent,
        memory: latest.memory ? latest.memory.percent : null,
        rx: latest.network ? latest.network.rx_per_sec : null,
        tx: latest.network ? latest.network.tx_per_sec : null,
    });
    if (history.length > HISTORY_SIZE) history.shift();
    return latest;
}

function start(intervalMs) {
    sample();
    const timer = setInterval(sample, intervalMs || 10000);
    timer.unref();
    console.log('[host] sampling ' + PROC + ' (rootfs ' + ROOTFS + ')');
    return () => clearInterval(timer);
}

// The last sample rather than a fresh snapshot: reading on demand would
// compute a delta over whatever time has passed since the last request.
function current() {
    return latest || sample();
}

module.exports = { snapshot, sample, start, current, history: () => history.slice() };
