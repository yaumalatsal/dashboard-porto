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

Set them in `.env.docker.local` for local dev:

```bash
cp .env.docker.local.example .env.docker.local
# Edit .env.docker.local with your real token
```

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
```

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
