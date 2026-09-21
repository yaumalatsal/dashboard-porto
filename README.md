# mdzakiyau — Monitoring Dashboard

A zero-runtime-dependency Node.js dashboard that polls multiple sites for
health, services, and metrics data, displaying results in a single-page UI.

Uses **only** Node.js built-in modules (`http`, `https`, `fs`, `path`, `url`) —
no npm dependencies at runtime. Runs anywhere Node 22+ is available.

## Quick start (Docker)

```bash
docker compose up -d --build
# Dashboard:  http://localhost:8081/
# LMS health: https://yourday.duckdns.org/api/health
```

## Configuration

### sites.json

Defines which sites to monitor. Each site has a `token` field that is sent as
the `X-Monitor-Token` header to the monitored API. When empty, the entrypoint
fills it from `MONITOR_API_TOKEN`.

```bash
# Local dev: create from the template
cp sites.json.example sites.json
```

`sites.json.example` is committed (with empty tokens). `sites.json` is
gitignored — don't commit real secrets.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the Node.js app listens on (inside the container). |
| `MONITOR_API_TOKEN` | *(empty)* | API token injected into sites.json for sites with empty tokens. |
| `HOST_PROC` | `/proc` | Where the VPS's procfs is mounted inside the container. |
| `HOST_ROOTFS` | `/` | Where the VPS's root filesystem is mounted (for disk usage). |
| `NGINX_LOG_DIR` | `/var/log/nginx` | Comma-separated directories to scan for nginx access logs. |
| `NGINX_LOG_PATTERN` | `^access.*\.log$` | Which files in those directories to tail. |

Set them in `.env.docker.local` for local dev:

```bash
cp .env.docker.local.example .env.docker.local
# Edit .env.docker.local with your real token
```

## VPS metrics

The dashboard runs on the VPS it watches, so host metrics come straight from
procfs — no agent, no exporter. `docker-compose.yml` bind-mounts the host's
`/proc`, `/sys` and `/` read-only, and `lib/host.js` reads:

- **CPU** — `/proc/stat`, sampled every 10s (usage is a delta, so it only
  means anything on a fixed cadence).
- **Memory & swap** — `/proc/meminfo`, using the kernel's `MemAvailable`.
- **Disk** — `statfs` on the mounted root filesystem.
- **Load & uptime** — `/proc/loadavg`, `/proc/uptime`.
- **Network** — `/proc/net/dev`, aggregated over physical interfaces
  (`lo`, `docker*`, `br-*`, `veth*` are skipped), reported as bytes/sec.

The last hour is kept in a ring buffer in memory for the sparklines. Nothing
is written to disk, so a restart starts the window over.

Served at `GET /api/host`.

## Per-site traffic

Traffic is derived from nginx access logs — no code changes to the monitored
sites, and it sees everything, including bots, API calls and 5xx responses.

`docker/nginx.conf` defines a `json_analytics` log format that writes one JSON
object per request. `lib/traffic.js` tails the log files, buckets each request
by minute and by `$host`, and keeps the last 60 minutes. Per site it reports
request count, requests/min, unique visitor IPs, status-code breakdown, error
rate, latency p50/p95/p99, bytes transferred, top paths and top referrers.

Served at `GET /api/traffic?minutes=<1..60>`.

### Covering sites outside this compose file

Every site whose traffic you want must be logged in the `json_analytics`
format, and the log file must be readable by the dashboard container.

1. Add the `log_format json_analytics …` block from `docker/nginx.conf` to your
   other nginx's `http {}` section (`/etc/nginx/nginx.conf`).
2. Point each `server {}` at it: `access_log /var/log/nginx/access.json.log json_analytics;`
3. Reload: `sudo nginx -t && sudo nginx -s reload`.

The compose file already mounts the host's `/var/log/nginx` at
`/host/var/log/nginx`, and `NGINX_LOG_DIR` lists both directories. If the VPS
has no nginx outside Docker, drop that volume line.

Only files matching `NGINX_LOG_PATTERN` are tailed, and tailing starts at the
**end** of each file — an existing multi-day log is not replayed on boot.
Log rotation (both truncate-in-place and rename) is handled.

**Permissions.** The container runs as a non-root user, while nginx logs are
often `root:adm 0640`. When the dashboard cannot read a log it says so in the
Traffic panel and in `unreadable[]` of `/api/traffic` — rather than quietly
showing zero traffic. Fix it with `sudo chmod 0644 /var/log/nginx/access.json.log`
(and a matching `create 0644 root adm` in `/etc/logrotate.d/nginx`).

## Architecture

```
                        Port 8081
                     nginx:alpine
                           |
                  proxy_pass /
                           |
                   dashboard:3001
                   (node:22-alpine)
                   server.js + public/
                         |
           +-------------+-------------+
           |                           |
   /host/proc, /host/rootfs     nginx access logs
   (lib/host.js)                (lib/traffic.js)
```

### API

| Endpoint | Description |
|---|---|
| `GET /api/status` | Polled health/services/metrics of the configured sites. |
| `GET /api/host` | VPS CPU, memory, disk, load, network + 1h history. |
| `GET /api/traffic?minutes=N` | Per-site traffic over the last N (1–60) minutes. |
| `GET/POST /api/sites`, `DELETE /api/sites/:name` | Manage monitored sites. |

### Adding a portfolio

The nginx config (`docker/nginx.conf`) and `docker-compose.yml` both have
commented-out placeholders for a portfolio service. When you add your portfolio:

1. Add a `portfolio` service to `docker-compose.yml` (uncomment the placeholder).
2. Uncomment the `/portfolio/` location block in `docker/nginx.conf`.
3. Optionally switch the dashboard to a sub-path like `/monitor/`.

## CI/CD

Pushes to `main` trigger:

1. **test** — syntax check + smoke-test the Docker image.
2. **image** — build and push to `ghcr.io/yaumalatsal/dashboard-porto`.
3. **deploy** — SSH to the VPS, pull the image, restart via `docker compose`.

### Required GitHub secrets

| Secret | Description |
|---|---|
| `SSH_KEY` | Private deploy key for VPS SSH access. |
| `SSH_KNOWN_HOSTS` | Output of `ssh-keyscan <vps-ip>`. |
| `VPS_USER` | SSH user (e.g. `ubuntu`). |
| `VPS_HOST` | VPS IP or hostname. |
| `VPS_PATH` | Deploy directory on the VPS (e.g. `/home/ubuntu/dashboard-porto`). |
| `MONITOR_API_TOKEN` | API token for the monitored sites. |

## Local development (without Docker)

```bash
npm install     # installs dev-only nodemon
npm run dev     # nodemon watches server.js
# Dashboard: http://localhost:3001/
```
