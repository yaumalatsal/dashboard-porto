# Astrolabe — portfolio & field console

A Next.js application that is two things at once:

- **`/`** — the portfolio. A WebGL astrolabe you can drag, with each chapter of
  the work mapped to a star.
- **`/console`** — the field console. Live health, uptime and analytics for
  every application running in production.

They share a codebase, a design language and a deployment, but almost nothing at
runtime: the console loads no WebGL, no GSAP and no smooth-scroll library.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

On first run the site registry is seeded from `sites.json.example`. Edit
`sites.json` to point at your own applications — see
**[docs/console.md](docs/console.md)**.

```bash
npm run build        # production build
npm start            # serve the build
npm run lint
npx tsc --noEmit     # typecheck
npm run test:e2e     # Playwright
```

> When building outside Docker, set `CONSOLE_DISABLE_POLLER=1` so the build does
> not start polling your production endpoints from your laptop.

## Docker

```bash
docker compose up -d --build     # http://localhost:3000
docker compose --profile dev up dev
```

The `console-data` volume holds the SQLite time-series **and** the live site
registry. Keep it across deploys or uptime history resets to zero.

```bash
# back it up
docker run --rm -v console-data:/data -v "$PWD:/backup" alpine \
  tar czf /backup/console-data.tgz -C /data .
```

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| 3D / motion | three.js, @react-three/fiber, drei, GSAP, Lenis — **portfolio only** |
| Console storage | `node:sqlite` (Node 24 built-in — no npm dependency) |
| Charts | hand-rolled inline SVG — no charting library |
| Deploy | GHCR image → VPS over SSH, via GitHub Actions |

## Layout

```
src/
  app/
    layout.tsx           minimal root: fonts + metadata only
    (portfolio)/         heavy providers scoped here
      layout.tsx         Lenis, cursor, WebGL astrolabe, starfield
      page.tsx  work/  orrery-lab/
    console/             lean: no WebGL, no animation stack
      page.tsx           status wall
      analytics/  incidents/  [site]/
      console.css        scoped styles
    api/monitor/         status · series · incidents · sites
  lib/monitor/
    types.ts             the vocabulary every app is normalized into
    adapters.ts          per-app normalizers (add an app without code)
    poller.ts            the polling loop
    store.ts             SQLite: samples, incidents, rollups
    probe.ts  config.ts  guard.ts  format.ts
  instrumentation.ts     boots the poller once per server instance
```

## Adding a production app

The console is built so that onboarding another API is configuration, not code:

```bash
curl -X POST http://localhost:3000/api/monitor/sites \
  -H 'Content-Type: application/json' \
  -d '{"id":"ironclad","label":"Ironclad","baseUrl":"https://ironclad.example"}'
```

The `generic` adapter infers health, services and metrics from whatever JSON the
app returns, so a new service is useful immediately. Full reference, including
custom adapters, auth headers and non-standard probes:
**[docs/console.md](docs/console.md)**.

## Security note

Console **reads are public by design** — the status wall is portfolio evidence.
Console **writes are open by default too**: without `CONSOLE_ADMIN_TOKEN` set,
anyone can add or delete monitored apps and point the poller at arbitrary URLs.
Set that one environment variable to require `X-Console-Token` on mutations;
reads stay public either way.

## CI/CD

Pushes to `main` run typecheck → lint → build, publish
`ghcr.io/yaumalatsal/astrolobe-porto`, deploy over SSH, and then poll
`/api/monitor/status` until the app answers — so a container that starts and
dies fails the pipeline instead of reporting green. Pull requests run the verify
job only. Every image is tagged with its commit sha, so rollback is one command.

First-time setup is one script on the VPS plus six secrets and one variable:

```bash
curl -fsSL https://raw.githubusercontent.com/yaumalatsal/astrolobe-porto/main/scripts/bootstrap-vps.sh | bash
```

Full reference, rollback and troubleshooting: **[docs/deploy.md](docs/deploy.md)**.

> Set the `SITE_URL` repository **variable** before your first deploy. Static
> pages bake their share-card URLs at build time, so without it every link you
> share previews `http://localhost:3000`.

Lint is reported but not enforced — `AstrolabeScene.tsx` has pre-existing
react-hooks errors that deserve their own pass.
