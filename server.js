'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3001;
const POLL_INTERVAL = 30000;   // health every 30s
const SERVICES_INTERVAL = 60000;   // services every 60s
const METRICS_INTERVAL = 300000;  // metrics every 5min

// --- State ---
const state = {};

// --- Config ---
const configPath = path.join(__dirname, 'sites.json');
function loadConfig() {
    if (!fs.existsSync(configPath)) {
        console.error('[config] sites.json not found');
        return { sites: [] };
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

let config = loadConfig();

// Watch for config changes
fs.watch(configPath, () => {
    try {
        config = loadConfig();
        console.log('[config] reloaded');
    } catch (e) {
        console.error('[config] reload failed:', e.message);
    }
});

// --- HTTP helper ---
function fetchJson(targetUrl, token) {
    return new Promise((resolve, reject) => {
        const parsed = url.parse(targetUrl);
        const isHttps = parsed.protocol === 'https:';
        const lib = isHttps ? https : http;
        const headers = {};
        if (token) {
            headers['X-Monitor-Token'] = token;
        }

        const req = lib.get(targetUrl, { headers, timeout: 10000 }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const body = Buffer.concat(chunks).toString('utf8');
                try {
                    resolve({
                        status: res.statusCode,
                        json: JSON.parse(body),
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                    });
                } catch (e) {
                    reject(new Error('parse_error'));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
        });
        req.on('error', reject);
    });
}

// --- Polling ---
async function pollHealth(site) {
    try {
        const res = await fetchJson(site.health_url, null);
        if (state[site.name]) {
            state[site.name].health = res.json;
            state[site.name].healthStatus = res.status === 200 ? 'ok' : 'down';
        }
    } catch (e) {
        if (state[site.name]) {
            state[site.name].health = null;
            state[site.name].healthError = e.message;
            state[site.name].healthStatus = 'down';
        }
    }
}

async function pollServices(site) {
    try {
        const res = await fetchJson(site.services_url, site.token);
        if (state[site.name]) {
            state[site.name].services = res.json;
            state[site.name].servicesStatus = res.status === 200 ? 'ok' : 'error';
        }
    } catch (e) {
        if (state[site.name]) {
            state[site.name].services = null;
            state[site.name].servicesError = e.message;
            state[site.name].servicesStatus = 'error';
        }
    }
}

async function pollMetrics(site) {
    try {
        const res = await fetchJson(site.metrics_url, site.token);
        if (state[site.name]) {
            state[site.name].metrics = res.json;
            state[site.name].metricsStatus = res.status === 200 ? 'ok' : 'error';
        }
    } catch (e) {
        if (state[site.name]) {
            state[site.name].metrics = null;
            state[site.name].metricsError = e.message;
            state[site.name].metricsStatus = 'error';
        }
    }
}

// --- Initialization ---
function initSite(site) {
    state[site.name] = {
        name: site.name,
        label: site.label,
        health: null,
        services: null,
        metrics: null,
        healthStatus: 'pending',
        servicesStatus: 'pending',
        metricsStatus: 'pending',
    };
}

function startPolling() {
    for (const site of config.sites) {
        if (!state[site.name]) initSite(site);
    }

    // Initial poll for all
    for (const site of config.sites) {
        pollHealth(site);
        pollServices(site);
        pollMetrics(site);
    }

    // Health every 30s
    setInterval(() => {
        for (const site of config.sites) {
            pollHealth(site);
        }
    }, POLL_INTERVAL);

    // Services every 60s
    setInterval(() => {
        for (const site of config.sites) {
            pollServices(site);
        }
    }, SERVICES_INTERVAL);

    // Metrics every 5min
    setInterval(() => {
        for (const site of config.sites) {
            pollMetrics(site);
        }
    }, METRICS_INTERVAL);
}

// --- MIME types ---
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// --- Serve static files ---
function serveFile(req, res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not_found' }));
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
    });
}

// --- Request router ---
function handleReq(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Monitor-Token');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // --- API routes ---
    if (pathname === '/api/status') {
        const now = new Date().toISOString();
        const sites = config.sites.map((site) => {
            const s = state[site.name] || { name: site.name, label: site.label };
            return {
                name: s.name,
                label: s.label,
                health: s.health,
                healthStatus: s.healthStatus,
                healthError: s.healthError,
                services: s.services,
                servicesStatus: s.servicesStatus,
                servicesError: s.servicesError,
                metrics: s.metrics,
                metricsStatus: s.metricsStatus,
                metricsError: s.metricsError,
            };
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ generated_at: now, sites }));
        return;
    }

    if (pathname === '/api/sites' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const { name, label, health_url, services_url, metrics_url, token } = payload;
                if (!name || !health_url) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'name and health_url are required' }));
                    return;
                }
                if (state[name]) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'site already monitored' }));
                    return;
                }
                const newSite = {
                    name,
                    label: label || name,
                    health_url,
                    services_url: services_url || health_url.replace('/api/health', '/api/monitor/services'),
                    metrics_url: metrics_url || health_url.replace('/api/health', '/api/monitor/metrics'),
                    token: token || '',
                };
                config.sites.push(newSite);
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                config = loadConfig();
                initSite(newSite);
                pollHealth(newSite);
                pollServices(newSite);
                pollMetrics(newSite);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, site: newSite }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'invalid JSON' }));
            }
        });
        return;
    }

    if (pathname === '/api/sites' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sites: config.sites }));
        return;
    }

    if (pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
        const name = pathname.split('/')[3];
        const idx = config.sites.findIndex((s) => s.name === name);
        if (idx === -1) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'site not found' }));
            return;
        }
        config.sites.splice(idx, 1);
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        config = loadConfig();
        delete state[name];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // --- Static files ---
    if (pathname === '/' || pathname === '/index.html') {
        serveFile(req, res, path.join(__dirname, 'public', 'index.html'));
        return;
    }

    // Serve from public/ directory
    let filePath = path.join(__dirname, 'public', pathname);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    serveFile(req, res, filePath);
}

const server = http.createServer(handleReq);

server.listen(PORT, () => {
    console.log('[dashboard] listening on :' + PORT);
    startPolling();
});
