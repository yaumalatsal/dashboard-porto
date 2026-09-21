'use strict';

const POLL_INTERVAL = 15000;  // Refresh dashboard every 15s
const HOST_INTERVAL = 5000;   // VPS metrics move faster, poll more often

// --- Helpers -----------------------------------------------------------

// User-supplied strings (log paths, referrers, site names) go into innerHTML,
// so everything interpolated below is escaped.
function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function bytes(n) {
    if (n == null) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return (i === 0 ? v : v.toFixed(1)) + ' ' + units[i];
}

function duration(seconds) {
    if (seconds == null) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d) return d + 'd ' + h + 'h';
    if (h) return h + 'h ' + m + 'm';
    return m + 'm';
}

function num(n, suffix) {
    return n == null ? '—' : n + (suffix || '');
}

// Colour a percentage bar: green under 70, amber under 90, red above.
function level(percent) {
    if (percent == null) return 'pending';
    if (percent >= 90) return 'down';
    if (percent >= 70) return 'warn';
    return 'ok';
}

function bar(label, percent, detail) {
    return `<div class="gauge">
        <div class="gauge-head">
            <span>${esc(label)}</span>
            <span class="gauge-value">${percent == null ? '—' : percent + '%'}</span>
        </div>
        <div class="gauge-track"><div class="gauge-fill lvl-${level(percent)}" style="width:${percent == null ? 0 : Math.min(100, percent)}%"></div></div>
        <div class="gauge-detail">${esc(detail || '')}</div>
    </div>`;
}

// Minimal inline sparkline — no charting library, keeping the app dependency-free.
function sparkline(values, className) {
    const points = values.filter((v) => v != null);
    if (points.length < 2) return '<svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none"></svg>';
    const max = Math.max(...points, 1);
    const step = 100 / (values.length - 1);
    const coords = values.map((v, i) => {
        const y = 24 - ((v == null ? 0 : v) / max) * 22 - 1;
        return (i * step).toFixed(2) + ',' + y.toFixed(2);
    });
    const area = 'M0,24 L' + coords.join(' L') + ' L100,24 Z';
    return `<svg class="spark ${className || ''}" viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label="trend, peak ${max}">
        <path class="spark-area" d="${area}"></path>
        <polyline class="spark-line" points="${coords.join(' ')}"></polyline>
    </svg>`;
}

// --- VPS panel ---------------------------------------------------------

function renderHost(data) {
    const h = data.host || {};
    const el = document.getElementById('host');

    // /proc is Linux-only and must be bind-mounted into the container; say so
    // rather than showing a wall of dashes.
    if (!h.memory && !h.load) {
        el.innerHTML = '<div class="error-msg">No host metrics. Check that /proc is mounted '
            + 'into the container and HOST_PROC points at it (see docker-compose.yml).</div>';
        return;
    }

    const history = data.history || [];
    const mem = h.memory || {};
    const disk = h.disk || {};
    const load = h.load || {};
    const net = h.network || {};
    const cores = h.cpu && h.cpu.cores;

    const memDetail = mem.total ? bytes(mem.used) + ' / ' + bytes(mem.total) : '';
    const diskDetail = disk.total ? bytes(disk.used) + ' / ' + bytes(disk.total) : '';
    const cpuDetail = cores ? cores + ' cores' : '';
    const swap = mem.swap_total
        ? `<div class="kv"><span>swap</span><b>${bytes(mem.swap_used)} / ${bytes(mem.swap_total)}</b></div>`
        : '';

    el.innerHTML = `<div class="host-grid">
        <div class="host-cell">
            ${bar('CPU', h.cpu ? h.cpu.percent : null, cpuDetail)}
            ${sparkline(history.map((p) => p.cpu), 'spark-cpu')}
        </div>
        <div class="host-cell">
            ${bar('Memory', mem.percent, memDetail)}
            ${sparkline(history.map((p) => p.memory), 'spark-mem')}
        </div>
        <div class="host-cell">
            ${bar('Disk', disk.percent, diskDetail)}
            <div class="kv"><span>free</span><b>${bytes(disk.free)}</b></div>
        </div>
        <div class="host-cell">
            <div class="gauge-head"><span>Network</span><span class="gauge-value">${bytes(net.rx_per_sec)}/s in</span></div>
            ${sparkline(history.map((p) => p.rx), 'spark-net')}
            <div class="kv"><span>out</span><b>${bytes(net.tx_per_sec)}/s</b></div>
            <div class="kv"><span>total</span><b>${bytes(net.rx_total)} in · ${bytes(net.tx_total)} out</b></div>
        </div>
        <div class="host-cell">
            <div class="gauge-head"><span>Load</span><span class="gauge-value">${num(load['1m'])}</span></div>
            <div class="kv"><span>5m / 15m</span><b>${num(load['5m'])} · ${num(load['15m'])}</b></div>
            <div class="kv"><span>uptime</span><b>${duration(h.uptime_seconds)}</b></div>
        </div>
    </div>`;
}

// --- Traffic panel -----------------------------------------------------

function statusBreakdown(status) {
    const classes = { '2xx': 'svc-ok', '3xx': '', '4xx': 'svc-warn', '5xx': 'svc-down' };
    return Object.keys(classes)
        .filter((k) => status[k])
        .map((k) => `<span class="${classes[k]}">${k} ${status[k]}</span>`)
        .join(' · ') || '<span class="muted">no requests</span>';
}

function topList(title, items, empty) {
    if (!items || !items.length) return `<div class="top-list"><h4>${esc(title)}</h4><div class="muted">${esc(empty)}</div></div>`;
    const max = items[0].count;
    const rows = items.map((it) => `<div class="top-row" title="${esc(it.key)}">
        <div class="top-bar" style="width:${Math.max(4, (it.count / max) * 100)}%"></div>
        <span class="top-key">${esc(it.key)}</span>
        <span class="top-count">${it.count}</span>
    </div>`).join('');
    return `<div class="top-list"><h4>${esc(title)}</h4>${rows}</div>`;
}

function renderTraffic(data) {
    const el = document.getElementById('traffic');

    if (data.unreadable && data.unreadable.length) {
        const list = data.unreadable
            .map((u) => esc(u.file) + ' (' + esc(u.error) + ')')
            .join(', ');
        el.innerHTML = `<div class="error-msg">Cannot read nginx logs: ${list}. `
            + 'The dashboard runs as a non-root user — nginx logs are often root:adm 0640.</div>';
        if (!data.sites.length) return;
    }

    if (!data.sites.length) {
        el.innerHTML = `<div class="loading">No requests in the last ${data.window_minutes} min. `
            + `Tailing: ${esc(data.sources.join(', ')) || 'no log files found'}.</div>`;
        return;
    }

    const cards = data.sites.map((s) => {
        const lat = s.latency_ms || {};
        return `<div class="traffic-card">
            <div class="site-title">
                <span>${esc(s.site)}</span>
                <span class="traffic-rpm">${s.requests_per_min}/min</span>
            </div>
            ${sparkline(s.series.map((p) => p.requests), 'spark-req')}
            <div class="stat-row">
                <div class="stat"><b>${s.requests}</b><span>requests</span></div>
                <div class="stat"><b>${s.unique_visitors}</b><span>visitors</span></div>
                <div class="stat"><b class="${s.error_rate >= 5 ? 'svc-down' : ''}">${s.error_rate}%</b><span>errors</span></div>
                <div class="stat"><b>${num(lat.p95, ' ms')}</b><span>p95</span></div>
            </div>
            <div class="kv"><span>status</span><b>${statusBreakdown(s.status)}</b></div>
            <div class="kv"><span>transferred</span><b>${bytes(s.bytes)}</b></div>
            ${topList('Top paths', s.top_paths, 'none')}
            ${topList('Referrers', s.top_referrers, 'direct only')}
        </div>`;
    });

    el.innerHTML = '<div class="traffic-grid">' + cards.join('') + '</div>';
}

// --- Services panel (existing) -----------------------------------------

function statusClass(status) {
    if (status === 'ok') return 'svc-ok';
    if (status === 'down') return 'svc-down';
    if (status === 'degraded') return 'svc-warn';
    return '';
}

function dotClass(status) {
    if (status === 'ok') return 'status-ok';
    if (status === 'down') return 'status-down';
    if (status === 'degraded') return 'status-warn';
    return 'status-pending';
}

function overallStatus(site) {
    const statuses = [site.healthStatus, site.servicesStatus, site.metricsStatus];
    if (statuses.some(s => s === 'down')) return 'down';
    if (statuses.some(s => s === 'error')) return 'down';
    if (statuses.some(s => s === 'pending')) return 'pending';
    return 'ok';
}

function renderServices(servicesResp) {
    if (!servicesResp || !servicesResp.services) return '<div class="error-msg">No service data</div>';

    const services = servicesResp.services;
    const rows = services.map(svc => {
        const status = svc.status || 'unknown';
        return `<tr>
            <td>${esc(svc.name)}</td>
            <td class="${statusClass(status)}">${esc(status)}</td>
            <td>${esc(svc.detail || '')}</td>
            <td>${svc.latency_ms !== undefined ? esc(svc.latency_ms) + ' ms' : ''}</td>
        </tr>`;
    });

    return `<table class="services-table">
        <thead><tr><th>Service</th><th>Status</th><th>Detail</th><th>Latency</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
    </table>`;
}

function renderMetrics(metrics) {
    if (!metrics) return '<div class="error-msg">No metrics data</div>';

    const blocks = [
        { title: 'Accounts', data: metrics.accounts },
        { title: 'Usage (24h window)', data: metrics.usage },
        { title: 'Content', data: metrics.content },
        { title: 'Runtime', data: metrics.runtime },
    ];

    return blocks.map(block => {
        const rows = Object.entries(block.data || {}).map(([key, val]) => {
            const label = key.replace(/_/g, ' ');
            return `<div class="metric-row"><span class="metric-label">${esc(label)}</span><span class="metric-value">${esc(val)}</span></div>`;
        });
        return `<div class="metric-block">
            <h3>${esc(block.title)}</h3>
            ${rows.join('')}
        </div>`;
    }).join('');
}

function render(data) {
    if (!data.sites || data.sites.length === 0) {
        document.getElementById('main').innerHTML = '<div class="loading">No sites configured</div>';
        return;
    }

    const cards = data.sites.map(site => {
        const overall = overallStatus(site);
        return `<div class="site-card">
            <div class="site-title">
                <span>${esc(site.label || site.name)}</span>
                <span class="site-status-dot ${dotClass(overall)}"></span>
            </div>
            ${renderServices(site.services)}
            ${site.servicesError ? '<div class="error-msg">' + esc(site.servicesError) + '</div>' : ''}
            ${renderMetrics(site.metrics)}
        </div>`;
    });

    document.getElementById('main').innerHTML =
        '<div class="sites-grid">' + cards.join('') + '</div>';
}

// --- Polling -----------------------------------------------------------

function showError(id, message) {
    document.getElementById(id).innerHTML = '<div class="error-msg">' + esc(message) + '</div>';
}

async function getJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
}

async function fetchStatus() {
    try {
        const data = await getJson('/api/status');
        render(data);
        document.getElementById('last-updated').textContent =
            new Date(data.generated_at).toLocaleTimeString('id-ID');
    } catch (e) {
        showError('main', 'Dashboard backend unreachable: ' + e.message);
    }
}

async function fetchHost() {
    try {
        renderHost(await getJson('/api/host'));
    } catch (e) {
        showError('host', 'Host metrics unavailable: ' + e.message);
    }
}

function trafficWindow() {
    return document.getElementById('traffic-window').value;
}

async function fetchTraffic() {
    try {
        renderTraffic(await getJson('/api/traffic?minutes=' + trafficWindow()));
    } catch (e) {
        showError('traffic', 'Traffic data unavailable: ' + e.message);
    }
}

document.getElementById('traffic-window').addEventListener('change', fetchTraffic);

fetchStatus();
fetchHost();
fetchTraffic();
setInterval(fetchStatus, POLL_INTERVAL);
setInterval(fetchHost, HOST_INTERVAL);
setInterval(fetchTraffic, POLL_INTERVAL);
