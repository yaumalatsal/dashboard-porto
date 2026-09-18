# The Field Console

The console at `/console` is an operations dashboard for every application you
run in production. It lives in the same Next.js app as the portfolio but shares
almost nothing with it at runtime — see [Performance](#performance).

- `/console` — status wall: every app, its health, and 90 days of uptime
- `/console/analytics` — fleet comparison, percentiles, small-multiple trends
- `/console/incidents` — every degraded or down period, derived automatically
- `/console/projects` — a dashboard for each project, and what each one can show
- `/console/<id>` — one app in detail: services, metrics, latency history

---

## Adding an application

This is meant to be a config edit, not a code change. There are two routes in.

### 1. Edit the registry

The live registry is `sites.json`. In Docker it lives on the data volume at
`/app/data/sites.json`; locally it sits in the project root and is seeded from
the committed `sites.json.example` on first boot.

```jsonc
{
  "sites": [
    {
      "id": "ironclad",                    // slug — used in URLs and as the DB key
      "label": "Ironclad",                 // display name
      "url": "https://ironclad.example",   // the "Visit" link
      "blurb": "Contract vault and audit log",
      "adapter": "monitor-api",            // see Adapters below
      "tags": ["production"],
      "auth": {                            // optional
        "header": "X-Monitor-Token",
        "env": "MONITOR_API_TOKEN"         // read from env at poll time
      },
      "probes": [
        { "name": "health",   "url": "https://ironclad.example/api/health",           "intervalSeconds": 30 },
        { "name": "services", "url": "https://ironclad.example/api/monitor/services", "intervalSeconds": 60 },
        { "name": "metrics",  "url": "https://ironclad.example/api/monitor/metrics",  "intervalSeconds": 300 }
      ]
    }
  ]
}
```

The poller reconciles against this file every 30 seconds, so a hand edit starts
polling without a restart.

### 2. POST to the API

`baseUrl` derives the three conventional probes for you:

```bash
curl -X POST https://your-domain/api/monitor/sites \
  -H 'Content-Type: application/json' \
  -d '{
    "id": "ironclad",
    "label": "Ironclad",
    "baseUrl": "https://ironclad.example",
    "adapter": "monitor-api"
  }'
```

The new app is scheduled and polled immediately, so its card is populated by the
time you navigate back.

---

## Adapters

An adapter turns one app's bespoke JSON into the normalized shape the console
renders. Three ship built in:

| Adapter | Use for |
|---|---|
| `generic` | **Default.** Any app returning JSON. Infers health, services and metrics from the payload shape — a brand-new service shows something useful with no adapter written. |
| `monitor-api` | Apps exposing `/api/health` + `/api/monitor/services` + `/api/monitor/metrics`, preserving the API's own metric grouping. |
| `ping` | Apps with no monitoring API at all. Charts reachability and response time only. |

### What `generic` infers

It walks the metrics payload and derives a display kind from each key's name, so
formatting is right without configuration:

| Key pattern | Rendered as |
|---|---|
| `*_ms`, `*latency*`, `*duration*` | `142 ms` / `1.24 s` |
| `*bytes*`, `*memory*`, `*heap*`, `*rss*` | `148 MB` |
| `*percent*`, `*ratio*`, `*usage*`, `*load*` | `23.4%` |
| `*rate*`, `*rps*`, `*per_second*` | `1.2K/s` |
| `*total*`, `*count*`, `*users*`, `*errors*` | `98.4K` |

Nested objects become groups, so `{"accounts": {"total_users": 1284}}` renders
under an **Accounts** heading automatically.

Health is read from `status` / `state` / `health` and accepts the usual
vocabularies (`ok`/`up`/`healthy`/`pass`/`green` → operational,
`degraded`/`warn`/`partial` → degraded, `down`/`fail`/`error` → down).

### Writing a custom adapter

Only needed when an app's shape is genuinely unusual. Implement the `Adapter`
contract in `src/lib/monitor/adapters.ts` and register it:

```ts
registerAdapter({
  id: "stripe-ish",
  description: "Billing service with a nested envelope",
  normalize({ results }) {
    const body = results.health?.payload as { data?: { state?: string } };
    return {
      health: body?.data?.state === "live" ? "operational" : "down",
      metrics: [
        { key: "mrr", label: "MRR", value: 4200, kind: "count", unit: "USD", group: "Revenue" },
      ],
    };
  },
});
```

Then set `"adapter": "stripe-ish"` on the site.

### Probes beyond the standard three

Any extra probe contributes its payload as a metric group named after the probe.
So this needs no adapter at all:

```jsonc
"probes": [
  { "name": "health", "url": "https://app.example/api/health" },
  { "name": "queue",  "url": "https://app.example/api/queue/stats", "intervalSeconds": 120 }
]
```

`queue`'s JSON renders under a **Queue** heading.

Other per-probe options: `method`, `headers`, `timeoutMs`, and `okStatuses`
(treat specific codes as healthy — useful when a `401` still proves the app is
up).

---

## A dashboard for every project

`/console/projects` gives each project in the portfolio its own page, and
`/console/projects/<slug>` is that page. This is not the same list as the
registry: the registry holds the applications the poller can reach, while this
holds every project, including the ones no probe can reach.

That distinction is the point. Most of the projects run inside a client's
network — a government agency, a smelting plant, a hospital. Those systems are
not mine to expose, and a dashboard that answered this with an empty chart
would be worse than none. So each page declares its access state and then shows
only what it can actually measure.

| Access | Meaning | What the page measures |
|---|---|---|
| `public` | The internet reaches it | Uptime, response time and faults, when a `siteId` is set |
| `client-network` | The client runs it privately | Reader traffic on the case study only |
| `not-deployed` | Built, but no live instance | Reader traffic on the case study only |
| `no-endpoint` | Not a web service | Reader traffic on the case study only |

### Three grades of evidence

The hero chart is always a measurement, never an assertion. The page takes the
strongest evidence it holds:

1. **A probe** — the project's `siteId` names an application in `sites.json`.
   The page shows response time, uptime, services, metrics and the fault record.
2. **Traffic on the project's own site** — `trafficId` names a site that reports
   to `/t.js`. The page shows page views and visitors.
3. **Readers of the case study** — every project has `/work/<slug>` on this
   site, so this figure always exists.

Everything the project asserts about itself — scope, architecture, stack — sits
below that, under a heading that says **reported by me, not measured**. A reader
never has to guess which figures came from a probe.

`TODO(you)` markers in `portfolio.ts` never reach a visitor: both public
surfaces render them as "Not recorded", while the marker stays in the data file
for whoever must supply the fact.

### Connecting a project

Edit its `monitor` block in `src/data/portfolio.ts`:

```ts
monitor: {
  access: "public",
  siteId: "ironclad",        // an id in sites.json — adds the live panels
  trafficId: "ironclad",     // the data-site value the tracker sends
  dashboardUrl: "/console",  // the project's own dashboard, if it has one
  note: "One line that tells the visitor why the access state is what it is.",
},
```

Naming a `siteId` that `sites.json` does not hold is not ignored silently: the
page says so, so a half-finished connection is visible rather than invisible.

---

## Measuring traffic on your other sites

The console counts page views for itself and for any application you point at
it. Add one line to the application:

```html
<script defer src="https://your-console/t.js" data-site="yourday"></script>
```

`data-site` must match an `id` in `sites.json`. The collector checks the id
against the registry and drops anything else, so the endpoint cannot be used to
write rows for sites you do not run.

The script is about 1.4 KB, has no dependencies, and is cached for a day. It
reports the first view and then follows client-side navigation in a
single-page application, without counting the same path twice in a row.

### What is stored, and what is not

| Stored | Not stored |
|---|---|
| The site id and the path | Any IP address |
| The referrer's hostname | The full referring URL |
| A per-day visitor hash | A cookie or any durable id |

The visitor hash is `sha256(salt + address + user-agent)`, where the salt is
generated in memory at start and rotates every day. It counts distinct visitors
within a day. It cannot be reversed, and the same person hashes to something
unrelated tomorrow, so nobody can be followed between days.

Requests whose user-agent looks like a bot are dropped, so the figures describe
people rather than crawlers.

### Limitations

- A visitor who blocks scripts is not counted.
- There are no returning visitors and no journeys across days. That is the
  direct cost of holding no durable identifier.
- Traffic for an application you do not monitor needs an entry in `sites.json`
  first. The `ping` adapter is enough.

---

## Storage

Time-series data lives in SQLite via Node's built-in `node:sqlite`, so the
console adds **zero runtime npm dependencies**.

| Table | Contents |
|---|---|
| `samples` | one row per health poll: site, timestamp, health, latency |
| `incidents` | contiguous runs of degraded/down, opened and closed as samples arrive |
| `snapshots` | latest normalized state per app, so a restarted process renders real data before its first poll |

Only the **health** probe writes a sample — uptime and latency series must be
evenly spaced, and mixing in the 5-minute metrics probe would bias both.

Percentiles are nearest-rank, computed in SQL over the requested window. At a
30-second cadence, one app produces ~1M rows per year, which SQLite scans in
single-digit milliseconds given the `(site_id, ts)` index.

Retention defaults to 90 days (`CONSOLE_RETENTION_DAYS`), pruned on boot and
daily thereafter.

> **The data volume is the thing worth backing up.** Deleting it resets all
> uptime history; deleting an app from the registry deliberately does *not*
> delete its samples.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `CONSOLE_DATA_DIR` | `./data` | Where `console.db` lives. |
| `CONSOLE_DB_PATH` | `<data>/console.db` | Override the database path directly. |
| `CONSOLE_SITES_PATH` | `./sites.json` | Registry location. Docker points this at the volume. |
| `CONSOLE_RETENTION_DAYS` | `90` | How long samples are kept. |
| `CONSOLE_ADMIN_TOKEN` | *(unset)* | See [Access](#access). |
| `CONSOLE_DISABLE_POLLER` | *(unset)* | Set to `1` to skip polling. **Required during builds.** |
| `MONITOR_API_TOKEN` | *(unset)* | Referenced by name from a site's `auth.env`. |

Tokens are referenced by *name* from `sites.json` and read from the environment
at poll time, so the registry file never contains a secret and rotating a token
means restarting the process, not editing committed config.

---

## Access

Reads are **fully public** by design — the status wall doubles as evidence that
you run real infrastructure.

Writes (`POST /api/monitor/sites`, `DELETE /api/monitor/sites/:id`) are **also
open by default**. With no `CONSOLE_ADMIN_TOKEN` set, anyone who finds the URL
can add or remove monitored apps, and can point the poller at arbitrary URLs —
including addresses only your server can reach (SSRF).

To close that without touching code, set one variable:

```bash
CONSOLE_ADMIN_TOKEN=$(openssl rand -hex 24)
```

Mutations then require `X-Console-Token`; reads are unaffected. The console
reports which mode it is in via `mutationsProtected` on `GET /api/monitor/sites`.

---

## Performance

The console is a separate route group from the portfolio, which is what keeps it
cheap:

- The root layout carries only fonts and metadata.
- `(portfolio)` owns Lenis smooth scroll, the custom cursor, GSAP and the WebGL
  astrolabe.
- `/console` loads **none** of that — verified: no GSAP, Lenis, Zustand or
  three.js in its chunks.

Two fixes in the portfolio itself came out of this work:

1. **three.js was in every route's shared chunk.** `AstrolabeScene` statically
   imported `CelestialClock3D`, and sat in the root layout — so every page
   downloaded and parsed the whole WebGL stack even though the instrument only
   renders on `/`. It is now a `next/dynamic` import.
2. **The starfield never stopped.** 600 stars repainted at 60fps forever,
   including when the tab was hidden, and under `prefers-reduced-motion` the
   loop still ran — it merely skipped the movement maths. It now pauses on
   `visibilitychange`, scales star count to screen area, caps DPR at 1.5, and
   paints exactly once under reduced motion.

Charts are hand-rolled inline SVG — no charting library — so the analytics pages
cost no more JavaScript than the status wall.

---

## Colour

The console separates two jobs strictly:

- **Chrome** wears the brand: copper rules, ember labels, the astrolabe sigil.
- **Data** wears a palette validated for colour-vision deficiency against the
  console's actual surface (`#0b0e14`).

The brand's moss (`#6f795e`) and thread (`#668c89`) are deliberately *not* used
for data. Measured, they have chroma 0.042 against a 0.1 floor — as series
colours they render as two indistinguishable grays. The validated slot 4
(`#c98500`) is a deep gold that passes every gate, so the default single-series
accent is on-brand and correct at once.

Status colours (`good` / `warning` / `critical`) are reserved, never reused as
series colours, and always render as **shape + colour + word** — `operational`
is a filled disc, `down` a ring, `unknown` a dashed ring — so state survives
grayscale, printing and full CVD.
