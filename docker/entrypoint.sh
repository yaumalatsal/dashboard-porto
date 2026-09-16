#!/bin/sh
set -e
cd /app

# Generate sites.json from the template if not present (fresh container,
# no bind-mount). The template ships with empty tokens.
if [ ! -f sites.json ] && [ -f sites.json.example ]; then
    echo "==> generating sites.json from sites.json.example"
    cp sites.json.example sites.json
fi

# Inject MONITOR_API_TOKEN into sites that have an empty token field.
# Runs on every boot — idempotent (only fills empty tokens).
if [ -f sites.json ] && [ -n "${MONITOR_API_TOKEN:-}" ]; then
    echo "==> injecting MONITOR_API_TOKEN into sites.json"
    node -e "
'use strict';
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('sites.json', 'utf8'));
let changed = false;
cfg.sites.forEach(s => {
    if (!s.token) {
        s.token = process.env.MONITOR_API_TOKEN;
        changed = true;
    }
    // Per-site override: SITE_TOKEN_<NAME> (uppercased, non-alnum → _)
    const envKey = 'SITE_TOKEN_' + s.name.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    if (process.env[envKey]) {
        s.token = process.env[envKey];
        changed = true;
    }
});
if (changed) fs.writeFileSync('sites.json', JSON.stringify(cfg, null, 2));
" || echo "==> (token injection skipped — sites.json may be read-only)"
fi

exec "$@"
