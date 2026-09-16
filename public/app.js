'use strict';

const POLL_INTERVAL = 15000;  // Refresh dashboard every 15s

async function fetchData() {
    try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        render(data);
        document.getElementById('last-updated').textContent =
            new Date(data.generated_at).toLocaleTimeString('id-ID');
    } catch (e) {
        document.getElementById('main').innerHTML =
            '<div class="error-msg">Dashboard backend unreachable: ' + e.message + '</div>';
    }
}

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
            <td>${svc.name}</td>
            <td class="${statusClass(status)}">${status}</td>
            <td>${svc.detail || ''}</td>
            <td>${svc.latency_ms !== undefined ? svc.latency_ms + ' ms' : ''}</td>
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
        {
            title: 'Accounts',
            data: metrics.accounts
        },
        {
            title: 'Usage (24h window)',
            data: metrics.usage
        },
        {
            title: 'Content',
            data: metrics.content
        },
        {
            title: 'Runtime',
            data: metrics.runtime
        }
    ];

    return blocks.map(block => {
        const rows = Object.entries(block.data).map(([key, val]) => {
            const label = key.replace(/_/g, ' ');
            return `<div class="metric-row"><span class="metric-label">${label}</span><span class="metric-value">${val}</span></div>`;
        });
        return `<div class="metric-block">
            <h3>${block.title}</h3>
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
                <span>${site.label || site.name}</span>
                <span class="site-status-dot ${dotClass(overall)}"></span>
            </div>
            ${renderServices(site.services)}
            ${site.servicesError ? '<div class="error-msg">' + site.servicesError + '</div>' : ''}
            ${renderMetrics(site.metrics)}
        </div>`;
    });

    document.getElementById('main').innerHTML =
        '<div class="sites-grid">' + cards.join('') + '</div>';
}

// Initial render + poll
fetchData();
setInterval(fetchData, POLL_INTERVAL);
