/**
 * Time-series storage on Node's built-in SQLite — no npm dependency, which
 * keeps the original dashboard's zero-runtime-dependency property intact.
 *
 * Two tables carry everything the analytics board needs:
 *   samples   — one row per health poll, the raw truth
 *   incidents — contiguous runs of trouble, derived as samples arrive
 *
 * Percentiles are computed in SQL over the requested window rather than kept as
 * running aggregates: at a 30s cadence a year of one app is ~1M rows, which
 * SQLite scans in single-digit milliseconds with the index below.
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  EventKind,
  EventLevel,
  Health,
  Incident,
  MonitorEvent,
  Sample,
  SeriesPoint,
  UptimeSummary,
} from "./types";

const DATA_DIR = process.env.CONSOLE_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = process.env.CONSOLE_DB_PATH ?? path.join(DATA_DIR, "console.db");

/** Samples older than this are pruned on boot and daily thereafter. */
const RETENTION_DAYS = Number(process.env.CONSOLE_RETENTION_DAYS ?? 90);

/**
 * Host samples are written every 10s rather than every 30-300s, so 90 days of
 * them would dwarf everything else in the file for data nobody reads at that
 * age. A fortnight covers "what happened last week".
 */
const HOST_RETENTION_DAYS = Number(process.env.CONSOLE_HOST_RETENTION_DAYS ?? 14);

let db: DatabaseSync | null = null;

/**
 * Prepared-statement cache.
 *
 * `prepare()` compiles the SQL every call. The console re-renders every 30s and
 * each site costs several queries, so on a ten-app fleet that was ~80 needless
 * compilations a minute. Statements are immutable and reusable once compiled;
 * keying them by SQL text makes every call after the first a bind-and-run.
 */
type Stmt = ReturnType<DatabaseSync["prepare"]>;

const statements = new Map<string, Stmt>();

function sql(query: string): Stmt {
  const cached = statements.get(query);
  if (cached) return cached;

  const stmt = connect().prepare(query);
  statements.set(query, stmt);
  return stmt;
}

function connect(): DatabaseSync {
  if (db) return db;

  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(DB_PATH), {
    recursive: true,
  });
  const handle = new DatabaseSync(DB_PATH);

  // WAL keeps the poller's writes from blocking the console's reads, which
  // matters because every page render queries while polls are in flight.
  handle.exec("PRAGMA journal_mode = WAL");
  handle.exec("PRAGMA synchronous = NORMAL");
  handle.exec("PRAGMA busy_timeout = 5000");

  handle.exec(`
    CREATE TABLE IF NOT EXISTS samples (
      site_id    TEXT    NOT NULL,
      ts         INTEGER NOT NULL,
      health     TEXT    NOT NULL,
      latency_ms INTEGER
    );
  `);
  // Every analytics query is "one site, one time window", so this composite
  // index is the difference between a scan and a seek.
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_samples_site_ts ON samples (site_id, ts)",
  );

  handle.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id    TEXT    NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at   INTEGER,
      worst      TEXT    NOT NULL,
      note       TEXT
    );
  `);
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents (site_id, started_at DESC)",
  );

  // Latest normalized snapshot per site, so a cold page render has something to
  // show before the first poll of this process completes.
  handle.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      site_id    TEXT PRIMARY KEY,
      ts         INTEGER NOT NULL,
      payload    TEXT    NOT NULL
    );
  `);

  /**
   * The event log — what happened, rather than what the numbers were.
   *
   * Deliberately separate from `samples`: samples are written every poll and
   * exist to be aggregated, while events are written only when something
   * changes and exist to be read one line at a time. Mixing them would mean
   * either a log full of "still fine" or a series full of gaps.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL,
      site_id TEXT,
      level   TEXT    NOT NULL,
      kind    TEXT    NOT NULL,
      message TEXT    NOT NULL,
      detail  TEXT
    );
  `);
  handle.exec("CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts DESC)");
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_events_site_ts ON events (site_id, ts DESC)",
  );

  /**
   * Metric history.
   *
   * Snapshots hold only the latest reading, so nothing an application reports
   * — request counts, active users, memory — could be trended or compared
   * against another app. One row per numeric metric per poll makes every
   * adapter-normalised number a time series without the poller knowing what
   * any of them mean.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS metric_samples (
      site_id TEXT    NOT NULL,
      ts      INTEGER NOT NULL,
      key     TEXT    NOT NULL,
      value   REAL    NOT NULL
    );
  `);
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_metric_site_key_ts ON metric_samples (site_id, key, ts)",
  );

  /**
   * Traffic on this site.
   *
   * Deliberately holds no IP address, no cookie and no durable identifier. The
   * visitor column is a hash of address and user-agent salted with a value that
   * is generated in memory and rotates daily, so it can count distinct people
   * within a day and cannot follow anyone between days or be reversed.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS page_views (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id  TEXT    NOT NULL DEFAULT 'portfolio',
      ts       INTEGER NOT NULL,
      path     TEXT    NOT NULL,
      referrer TEXT,
      visitor  TEXT    NOT NULL
    );
  `);

  /**
   * Migration for a database created before traffic covered more than one site.
   *
   * The table shipped without `site_id`, so an existing install has rows and a
   * schema that the queries below no longer match. Adding the column keeps
   * those rows: they were all views of this site, which is what the default
   * records.
   */
  const viewColumns = handle
    .prepare("PRAGMA table_info(page_views)")
    .all() as { name: string }[];

  if (!viewColumns.some((c) => c.name === "site_id")) {
    handle.exec(
      "ALTER TABLE page_views ADD COLUMN site_id TEXT NOT NULL DEFAULT 'portfolio'",
    );
    console.log("[monitor] added site_id to page_views");
  }

  handle.exec("CREATE INDEX IF NOT EXISTS idx_views_ts ON page_views (ts DESC)");
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_views_site_ts ON page_views (site_id, ts DESC)",
  );
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_views_path_ts ON page_views (site_id, path, ts)",
  );

  /**
   * The certificate expiry for each site that uses https.
   *
   * One row per site, replaced on each check: only the current expiry date
   * matters, and a history of "it was still valid yesterday" has no use.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS tls_checks (
      site_id    TEXT PRIMARY KEY,
      host       TEXT    NOT NULL,
      checked_at INTEGER NOT NULL,
      valid_to   INTEGER NOT NULL,
      issuer     TEXT,
      error      TEXT
    );
  `);

  /**
   * VPS metrics, one row per sample.
   *
   * Fixed columns rather than a key/value table like `metric_samples`: the set
   * of things a machine reports is known and small, and the console reads
   * several of them together on every render.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS host_samples (
      ts             INTEGER PRIMARY KEY,
      cpu_percent    REAL,
      memory_percent REAL,
      memory_used    INTEGER,
      memory_total   INTEGER,
      swap_percent   REAL,
      disk_percent   REAL,
      disk_used      INTEGER,
      disk_total     INTEGER,
      load1          REAL,
      load5          REAL,
      load15         REAL,
      rx_per_sec     INTEGER,
      tx_per_sec     INTEGER,
      uptime_seconds INTEGER
    );
  `);
  handle.exec("CREATE INDEX IF NOT EXISTS idx_host_ts ON host_samples (ts DESC)");

  /**
   * Traffic from nginx's access logs, pre-aggregated to one row per minute per
   * virtual host.
   *
   * Raw rows are not kept. A busy site is thousands of requests a minute, and
   * every question the console asks — rate, error share, percentiles, bytes —
   * is answerable from the rollup. Percentiles are stored rather than derived
   * because they cannot be recomputed from an aggregate after the fact.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS access_minutes (
      host            TEXT    NOT NULL,
      ts              INTEGER NOT NULL,
      requests        INTEGER NOT NULL,
      bytes           INTEGER NOT NULL,
      visitors        INTEGER NOT NULL,
      s2xx            INTEGER NOT NULL DEFAULT 0,
      s3xx            INTEGER NOT NULL DEFAULT 0,
      s4xx            INTEGER NOT NULL DEFAULT 0,
      s5xx            INTEGER NOT NULL DEFAULT 0,
      other           INTEGER NOT NULL DEFAULT 0,
      latency_avg_ms  INTEGER,
      latency_p50_ms  INTEGER,
      latency_p95_ms  INTEGER,
      latency_p99_ms  INTEGER,
      PRIMARY KEY (host, ts)
    );
  `);
  handle.exec("CREATE INDEX IF NOT EXISTS idx_access_ts ON access_minutes (ts DESC)");

  /**
   * The path, referrer and method breakdowns for those same minutes, one row
   * per distinct label. Separate from the rollup because the cardinality is
   * unbounded and only the top few are ever read.
   */
  handle.exec(`
    CREATE TABLE IF NOT EXISTS access_labels (
      host  TEXT    NOT NULL,
      ts    INTEGER NOT NULL,
      kind  TEXT    NOT NULL,
      label TEXT    NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (host, ts, kind, label)
    );
  `);
  handle.exec(
    "CREATE INDEX IF NOT EXISTS idx_access_labels ON access_labels (kind, ts DESC)",
  );

  db = handle;
  return handle;
}

export function getDb(): DatabaseSync {
  return connect();
}

/* ------------------------------------------------------------------ writes */

export function recordSample(sample: Sample): void {
  sql(
      "INSERT INTO samples (site_id, ts, health, latency_ms) VALUES (?, ?, ?, ?)",
    )
    .run(sample.siteId, sample.ts, sample.health, sample.latencyMs ?? null);

  updateIncident(sample);
}

/**
 * Open an incident on the first bad sample, widen its severity while it lasts,
 * and close it on the first good one. Deriving this as samples land means the
 * incident feed never needs a backfill job.
 */
function updateIncident(sample: Sample): void {
  const open = sql(
      "SELECT id, worst FROM incidents WHERE site_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(sample.siteId) as { id: number; worst: string } | undefined;

  const isBad = sample.health === "down" || sample.health === "degraded";

  if (isBad && !open) {
    sql(
      "INSERT INTO incidents (site_id, started_at, worst) VALUES (?, ?, ?)",
    ).run(sample.siteId, sample.ts, sample.health);
    return;
  }

  if (isBad && open) {
    // "down" outranks "degraded" — an incident is remembered by its worst moment.
    if (sample.health === "down" && open.worst !== "down") {
      sql("UPDATE incidents SET worst = ? WHERE id = ?").run("down", open.id);
    }
    return;
  }

  if (!isBad && open && sample.health === "operational") {
    sql("UPDATE incidents SET ended_at = ? WHERE id = ?").run(
      sample.ts,
      open.id,
    );
  }
}

export function saveSnapshot(siteId: string, ts: number, payload: unknown): void {
  sql(
      `INSERT INTO snapshots (site_id, ts, payload) VALUES (?, ?, ?)
       ON CONFLICT(site_id) DO UPDATE SET ts = excluded.ts, payload = excluded.payload`,
    )
    .run(siteId, ts, JSON.stringify(payload));
}

/** Last persisted snapshot for one site, or null if it has never been polled. */
export function readSnapshot(siteId: string): unknown | null {
  const row = sql("SELECT payload FROM snapshots WHERE site_id = ?")
    .get(siteId) as { payload: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function readSnapshots(): Record<string, { ts: number; payload: unknown }> {
  const rows = sql("SELECT site_id, ts, payload FROM snapshots")
    .all() as { site_id: string; ts: number; payload: string }[];

  const out: Record<string, { ts: number; payload: unknown }> = {};
  for (const row of rows) {
    try {
      out[row.site_id] = { ts: row.ts, payload: JSON.parse(row.payload) };
    } catch {
      // A corrupt row should cost one site's cached card, not the whole render.
    }
  }
  return out;
}

/* ------------------------------------------------------------------ events */

export function recordEvent(event: {
  siteId?: string | null;
  level: EventLevel;
  kind: EventKind;
  message: string;
  detail?: string;
  ts?: number;
}): void {
  sql(
      "INSERT INTO events (ts, site_id, level, kind, message, detail) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      event.ts ?? Date.now(),
      event.siteId ?? null,
      event.level,
      event.kind,
      event.message,
      event.detail ?? null,
    );
}

export type EventQuery = {
  limit?: number;
  siteId?: string;
  level?: EventLevel;
  /** Only events at or above this severity — the common "show me trouble" case. */
  minLevel?: EventLevel;
  before?: number;
};

const LEVEL_RANK: Record<EventLevel, number> = { info: 0, warn: 1, error: 2 };

export function recentEvents(query: EventQuery = {}): MonitorEvent[] {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

  // Built as fragments rather than string-interpolated, so every value stays a
  // bound parameter.
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (query.siteId) {
    where.push("site_id = ?");
    params.push(query.siteId);
  }
  if (query.level) {
    where.push("level = ?");
    params.push(query.level);
  }
  if (query.minLevel) {
    const allowed = (Object.keys(LEVEL_RANK) as EventLevel[]).filter(
      (l) => LEVEL_RANK[l] >= LEVEL_RANK[query.minLevel!],
    );
    where.push(`level IN (${allowed.map(() => "?").join(", ")})`);
    params.push(...allowed);
  }
  if (query.before) {
    where.push("ts < ?");
    params.push(query.before);
  }

  const statement = `SELECT * FROM events${
    where.length ? ` WHERE ${where.join(" AND ")}` : ""
  } ORDER BY ts DESC, id DESC LIMIT ?`;

  // The shape is bounded by the filter combinations, so caching by text still
  // has a small, fixed ceiling rather than growing without limit.
  const rows = sql(statement).all(...params, limit) as Record<
    string,
    unknown
  >[];

  return rows.map((r) => ({
    id: r.id as number,
    ts: r.ts as number,
    siteId: (r.site_id as string | null) ?? null,
    level: r.level as EventLevel,
    kind: r.kind as EventKind,
    message: r.message as string,
    detail: (r.detail as string | undefined) ?? undefined,
  }));
}

/** Counts per level over a window — drives the log page's summary row. */
export function eventCounts(windowSeconds = 86_400): Record<EventLevel, number> {
  const since = Date.now() - windowSeconds * 1000;
  const rows = sql(
      "SELECT level, COUNT(*) AS n FROM events WHERE ts >= ? GROUP BY level",
    )
    .all(since) as { level: EventLevel; n: number }[];

  const out: Record<EventLevel, number> = { info: 0, warn: 0, error: 0 };
  for (const row of rows) out[row.level] = row.n;
  return out;
}

/* ------------------------------------------------------------------- reads */

export function uptimeSummary(
  siteId: string,
  windowSeconds: number,
  /**
   * Shifts the window back by this many seconds. `offsetSeconds = windowSeconds`
   * gives the immediately preceding period, which is what the stat tiles compare
   * against — "142 ms" says little; "142 ms, 31 ms faster than yesterday" says
   * whether anything needs attention.
   */
  offsetSeconds = 0,
): UptimeSummary {
  const until = Date.now() - offsetSeconds * 1000;
  const since = until - windowSeconds * 1000;

  /**
   * Sample count, uptime and all three percentiles in one statement.
   *
   * This was four calls that ran seven queries: a count, then for each
   * percentile a second count followed by an ORDER BY ... OFFSET. The window
   * function ranks the window once and picks all three ranks out of it, which
   * is one scan instead of four and one round trip instead of seven.
   *
   * `ceil` via CAST rather than the ceil() builtin so the nearest-rank
   * definition matches what the old implementation produced exactly.
   */
  const row = sql(`
    WITH w AS (
      SELECT health, latency_ms FROM samples
      WHERE site_id = ? AND ts >= ? AND ts < ?
    ),
    lat AS (
      SELECT latency_ms,
             ROW_NUMBER() OVER (ORDER BY latency_ms) AS rn,
             COUNT(*)     OVER ()                    AS n
      FROM w WHERE latency_ms IS NOT NULL
    )
    SELECT
      (SELECT COUNT(*) FROM w) AS samples,
      (SELECT COALESCE(SUM(CASE WHEN health = 'operational' THEN 1 ELSE 0 END), 0)
         FROM w) AS up,
      (SELECT latency_ms FROM lat WHERE rn = MIN(n, MAX(1,
         CAST(0.50 * n AS INTEGER) +
         (CASE WHEN 0.50 * n > CAST(0.50 * n AS INTEGER) THEN 1 ELSE 0 END)))) AS p50,
      (SELECT latency_ms FROM lat WHERE rn = MIN(n, MAX(1,
         CAST(0.95 * n AS INTEGER) +
         (CASE WHEN 0.95 * n > CAST(0.95 * n AS INTEGER) THEN 1 ELSE 0 END)))) AS p95,
      (SELECT latency_ms FROM lat WHERE rn = MIN(n, MAX(1,
         CAST(0.99 * n AS INTEGER) +
         (CASE WHEN 0.99 * n > CAST(0.99 * n AS INTEGER) THEN 1 ELSE 0 END)))) AS p99
  `).get(siteId, since, until) as {
    samples: number;
    up: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  };

  const samples = row?.samples ?? 0;

  // How much of the window actually holds data. A newly added application has
  // hours of history, not the thirty days the caller asked for, and a caller
  // that cannot tell the difference will print the wrong label.
  const bounds = sql(
    `SELECT MIN(ts) AS first, MAX(ts) AS last FROM samples
     WHERE site_id = ? AND ts >= ? AND ts < ?`,
  ).get(siteId, since, until) as { first: number | null; last: number | null };

  const observedSeconds =
    bounds?.first != null && bounds?.last != null
      ? Math.min(windowSeconds, (bounds.last - bounds.first) / 1000)
      : 0;

  return {
    siteId,
    windowSeconds,
    samples,
    upRatio: samples > 0 ? (row.up ?? 0) / samples : 0,
    latencyP50: row?.p50 ?? null,
    latencyP95: row?.p95 ?? null,
    latencyP99: row?.p99 ?? null,
    observedSeconds,
    coverage: windowSeconds > 0 ? observedSeconds / windowSeconds : 0,
  };
}

/**
 * Bucketed series for the charts. Bucketing in SQL keeps the payload flat
 * regardless of window length — 90 days and 1 hour both return `buckets` points.
 */
export function series(
  siteId: string,
  windowSeconds: number,
  requestedBuckets = 48,
): SeriesPoint[] {
  let buckets = requestedBuckets;
  const now = Date.now();
  let since = now - windowSeconds * 1000;

  /**
   * Narrow the window to the data when the request is much wider than the
   * history we actually have.
   *
   * Without this, a fresh install is unreadable: 45 samples taken over three
   * minutes all land in a single 30-minute bucket of a 24-hour window, leaving
   * one point — not enough to draw a line — so every chart reads "no data"
   * while the database is visibly filling up. Re-bucketing over the observed
   * span means the chart is useful from the first minute. The axis labels are
   * rendered from the returned bucket timestamps, so the narrower range is
   * shown honestly rather than being passed off as the full window.
   */
  const first = sql("SELECT MIN(ts) AS first FROM samples WHERE site_id = ? AND ts >= ?")
    .get(siteId, since) as { first: number | null } | undefined;

  if (first?.first != null) {
    const observedSpan = now - first.first;
    if (observedSpan > 0 && observedSpan < windowSeconds * 1000 * 0.25) {
      // One bucket of padding keeps the newest sample off the right edge.
      since = first.first - observedSpan / buckets;
    }
  }

  /**
   * Both of these must be whole numbers.
   *
   * `node:sqlite` binds a JS number carrying a fractional part as REAL, and
   * SQLite's `/` on a REAL is floating-point — so `(ts / 4039.0) * 4039.0`
   * returns `ts` itself and every sample lands in its own bucket, which never
   * matches the grid the render loop walks. The result is a chart that reports
   * "no samples" while the database is full of them. `CAST(... AS INTEGER)`
   * below pins the division even if a float ever reaches the binding.
   */
  since = Math.floor(since);

  /**
   * Never bucket finer than the data supports.
   *
   * Asking for 48 buckets over a window holding 40 samples puts most samples
   * alone in a bucket with empties between them. The chart then breaks its line
   * at every one of those gaps — correctly, since a gap is real information —
   * and the result is a scatter of disconnected points rather than a trend.
   * Widening the bucket to hold ~1.5 samples on average keeps the series
   * contiguous where data is contiguous, so a break still means a genuine
   * outage in monitoring rather than an artefact of the requested resolution.
   */
  const counted = sql(
    "SELECT COUNT(*) AS n FROM samples WHERE site_id = ? AND ts >= ?",
  ).get(siteId, since) as { n: number };

  const span = now - since;
  const requestedBucketMs = Math.max(1, Math.floor(span / buckets));
  const densityFloorMs =
    counted.n > 0 ? Math.ceil((span / counted.n) * 1.5) : requestedBucketMs;

  const bucketMs = Math.max(1, requestedBucketMs, densityFloorMs);
  // Re-derive the slot count from the widened bucket so the series still spans
  // the whole window rather than stopping short of it.
  buckets = Math.max(2, Math.ceil(span / bucketMs));

  const rows = sql(
      `SELECT
         CAST(ts / ? AS INTEGER) * ?                              AS bucket,
         COUNT(*)                                                 AS samples,
         SUM(CASE WHEN health = 'operational' THEN 1 ELSE 0 END)  AS up,
         AVG(latency_ms)                                          AS avg_latency,
         MAX(latency_ms)                                          AS max_latency
       FROM samples
       WHERE site_id = ? AND ts >= ?
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(bucketMs, bucketMs, siteId, since) as {
    bucket: number;
    samples: number;
    up: number;
    avg_latency: number | null;
    max_latency: number | null;
  }[];

  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const out: SeriesPoint[] = [];

  /**
   * Walk the aligned grid from the bucket holding `since` to the one holding
   * `now`, inclusive.
   *
   * Counting `buckets` steps from `since` stops one short: the bucket
   * containing the present moment sits at index `buckets`, outside the loop, so
   * the newest data — the only data a fresh install has — was silently dropped.
   *
   * Empty buckets are still emitted. A gap in monitoring is itself information,
   * and a chart that closes the gap tells a lie.
   */
  const firstBucket = Math.floor(since / bucketMs) * bucketMs;
  const lastBucket = Math.floor(now / bucketMs) * bucketMs;

  for (let bucketStart = firstBucket; bucketStart <= lastBucket; bucketStart += bucketMs) {
    const row = byBucket.get(bucketStart);
    out.push({
      ts: bucketStart,
      samples: row?.samples ?? 0,
      upRatio: row && row.samples > 0 ? row.up / row.samples : 0,
      latencyP50: row?.avg_latency != null ? Math.round(row.avg_latency) : null,
      latencyP95: row?.max_latency != null ? Math.round(row.max_latency) : null,
    });
  }

  return out;
}

export function recentIncidents(limit = 20, siteId?: string): Incident[] {
  const rows = siteId
    ? (sql(
        "SELECT * FROM incidents WHERE site_id = ? ORDER BY started_at DESC LIMIT ?",
      ).all(siteId, limit) as Record<string, unknown>[])
    : (sql("SELECT * FROM incidents ORDER BY started_at DESC LIMIT ?").all(
        limit,
      ) as Record<string, unknown>[]);

  return rows.map((r) => ({
    id: r.id as number,
    siteId: r.site_id as string,
    startedAt: r.started_at as number,
    endedAt: (r.ended_at as number | null) ?? null,
    worst: r.worst as Health,
    note: (r.note as string | undefined) ?? undefined,
  }));
}

/** Daily up-ratio for the 90-day uptime strip. */
export function dailyUptime(siteId: string, days = 90) {
  const since = Date.now() - days * 86400_000;

  const rows = sql(
      `SELECT
         CAST(ts / 86400000 AS INTEGER) * 86400000                 AS day,
         COUNT(*)                                                  AS samples,
         SUM(CASE WHEN health = 'operational' THEN 1 ELSE 0 END)   AS up
       FROM samples
       WHERE site_id = ? AND ts >= ?
       GROUP BY day
       ORDER BY day`,
    )
    .all(siteId, since) as { day: number; samples: number; up: number }[];

  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: { day: number; upRatio: number | null; samples: number }[] = [];
  const today = Math.floor(Date.now() / 86400_000) * 86400_000;

  for (let i = days - 1; i >= 0; i--) {
    const day = today - i * 86400_000;
    const row = byDay.get(day);
    out.push({
      day,
      samples: row?.samples ?? 0,
      // null (not 0) for a day we never observed — "no data" and "down all day"
      // must not render identically.
      upRatio: row && row.samples > 0 ? row.up / row.samples : null,
    });
  }

  return out;
}

export function prune(): number {
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
  const result = sql("DELETE FROM samples WHERE ts < ?").run(cutoff);
  sql("DELETE FROM incidents WHERE ended_at IS NOT NULL AND ended_at < ?")
    .run(cutoff);
  sql("DELETE FROM events WHERE ts < ?").run(cutoff);
  sql("DELETE FROM metric_samples WHERE ts < ?").run(cutoff);
  sql("DELETE FROM page_views WHERE ts < ?").run(cutoff);
  sql("DELETE FROM access_minutes WHERE ts < ?").run(cutoff);
  sql("DELETE FROM access_labels WHERE ts < ?").run(cutoff);
  // Host samples arrive every 10s — two orders of magnitude denser than a
  // health poll — so they get their own, shorter retention.
  sql("DELETE FROM host_samples WHERE ts < ?").run(
    Date.now() - HOST_RETENTION_DAYS * 86400_000,
  );
  return Number(result.changes ?? 0);
}

export function closeDb(): void {
  statements.clear();
  db?.close();
  db = null;
}

/* --------------------------------------------------------------- metrics */

/**
 * Record every numeric metric an adapter produced for this poll.
 *
 * Text metrics (a version string, a node version) are skipped — they are not
 * series and storing them per poll would be pure noise.
 */
export function recordMetrics(
  siteId: string,
  metrics: { key: string; value: number | string }[],
  ts = Date.now(),
): void {
  const stmt = sql(
    "INSERT INTO metric_samples (site_id, ts, key, value) VALUES (?, ?, ?, ?)",
  );
  for (const metric of metrics) {
    const value =
      typeof metric.value === "number" ? metric.value : Number(metric.value);
    if (!Number.isFinite(value)) continue;
    stmt.run(siteId, ts, metric.key, value);
  }
}

/** Metric keys a site has actually reported, for populating a picker. */
export function metricKeys(siteId?: string): string[] {
  const rows = siteId
    ? (sql(
        "SELECT DISTINCT key FROM metric_samples WHERE site_id = ? ORDER BY key",
      ).all(siteId) as { key: string }[])
    : (sql(
        "SELECT DISTINCT key FROM metric_samples ORDER BY key",
      ).all() as { key: string }[]);
  return rows.map((r) => r.key);
}

/** Metric keys reported by more than one site — the comparable ones. */
export function sharedMetricKeys(): string[] {
  const rows = sql(
    `SELECT key FROM metric_samples
     GROUP BY key HAVING COUNT(DISTINCT site_id) > 1
     ORDER BY key`,
  ).all() as { key: string }[];
  return rows.map((r) => r.key);
}

export type MetricPoint = { ts: number; value: number };

/**
 * One metric, bucketed over a window. Averaged within the bucket, because a
 * gauge sampled several times in a bucket has no single "right" reading and the
 * mean is the honest summary.
 */
export function metricSeries(
  siteId: string,
  key: string,
  windowSeconds: number,
  buckets = 48,
): MetricPoint[] {
  const now = Date.now();
  const since = now - windowSeconds * 1000;
  const bucketMs = Math.max(1, Math.floor((windowSeconds * 1000) / buckets));

  const rows = sql(
    `SELECT CAST(ts / ? AS INTEGER) * ? AS bucket, AVG(value) AS value
     FROM metric_samples
     WHERE site_id = ? AND key = ? AND ts >= ?
     GROUP BY bucket ORDER BY bucket`,
  ).all(bucketMs, bucketMs, siteId, key, since) as {
    bucket: number;
    value: number;
  }[];

  return rows.map((r) => ({ ts: r.bucket, value: r.value }));
}

/** Latest value and the change since the start of the window. */
export function metricSummary(
  siteId: string,
  key: string,
  windowSeconds: number,
): { latest: number | null; first: number | null; samples: number } {
  const since = Date.now() - windowSeconds * 1000;
  const row = sql(
    `SELECT
       (SELECT value FROM metric_samples
         WHERE site_id = ? AND key = ? AND ts >= ? ORDER BY ts DESC LIMIT 1) AS latest,
       (SELECT value FROM metric_samples
         WHERE site_id = ? AND key = ? AND ts >= ? ORDER BY ts ASC LIMIT 1) AS first,
       (SELECT COUNT(*) FROM metric_samples
         WHERE site_id = ? AND key = ? AND ts >= ?) AS samples`,
  ).get(siteId, key, since, siteId, key, since, siteId, key, since) as {
    latest: number | null;
    first: number | null;
    samples: number;
  };

  return {
    latest: row?.latest ?? null,
    first: row?.first ?? null,
    samples: row?.samples ?? 0,
  };
}

/* --------------------------------------------------------------- traffic */

/** The reserved id for this site, which is not in the monitored registry. */
export const SELF_SITE_ID = "portfolio";

export function recordPageView(view: {
  siteId?: string;
  path: string;
  referrer?: string | null;
  visitor: string;
  ts?: number;
}): void {
  sql(
    "INSERT INTO page_views (site_id, ts, path, referrer, visitor) VALUES (?, ?, ?, ?, ?)",
  ).run(
    view.siteId ?? SELF_SITE_ID,
    view.ts ?? Date.now(),
    view.path.slice(0, 512),
    view.referrer?.slice(0, 255) ?? null,
    view.visitor,
  );
}

/** Site ids that have recorded at least one view, for the page's tab bar. */
export function trafficSites(windowSeconds = 30 * 86_400): string[] {
  const since = Date.now() - windowSeconds * 1000;
  const rows = sql(
    "SELECT DISTINCT site_id FROM page_views WHERE ts >= ? ORDER BY site_id",
  ).all(since) as { site_id: string }[];
  return rows.map((r) => r.site_id);
}

export type TrafficSummary = {
  views: number;
  visitors: number;
  windowSeconds: number;
};

export function trafficSummary(
  windowSeconds: number,
  offsetSeconds = 0,
  siteId?: string,
): TrafficSummary {
  const until = Date.now() - offsetSeconds * 1000;
  const since = until - windowSeconds * 1000;

  const row = (
    siteId
      ? sql(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ? AND ts < ? AND site_id = ?`,
        ).get(since, until, siteId)
      : sql(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ? AND ts < ?`,
        ).get(since, until)
  ) as { views: number; visitors: number };

  return {
    views: row?.views ?? 0,
    visitors: row?.visitors ?? 0,
    windowSeconds,
  };
}

export type TrafficPoint = { ts: number; views: number; visitors: number };

export function trafficSeries(
  windowSeconds: number,
  buckets = 48,
  siteId?: string,
): TrafficPoint[] {
  const now = Date.now();
  const since = now - windowSeconds * 1000;
  const bucketMs = Math.max(1, Math.floor((windowSeconds * 1000) / buckets));

  const rows = (
    siteId
      ? sql(
          `SELECT CAST(ts / ? AS INTEGER) * ? AS bucket,
                  COUNT(*) AS views,
                  COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ? AND site_id = ?
           GROUP BY bucket ORDER BY bucket`,
        ).all(bucketMs, bucketMs, since, siteId)
      : sql(
          `SELECT CAST(ts / ? AS INTEGER) * ? AS bucket,
                  COUNT(*) AS views,
                  COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ?
           GROUP BY bucket ORDER BY bucket`,
        ).all(bucketMs, bucketMs, since)
  ) as {
    bucket: number;
    views: number;
    visitors: number;
  }[];

  const byBucket = new Map(rows.map((r) => [r.bucket, r]));
  const out: TrafficPoint[] = [];

  // Inclusive of the bucket holding the present moment — see the note in
  // series(). Empty buckets are emitted too: a quiet hour is a real reading,
  // and omitting it would compress the axis and imply traffic that was not
  // there.
  const firstBucket = Math.floor(since / bucketMs) * bucketMs;
  const lastBucket = Math.floor(now / bucketMs) * bucketMs;

  for (let bucket = firstBucket; bucket <= lastBucket; bucket += bucketMs) {
    const row = byBucket.get(bucket);
    out.push({
      ts: bucket,
      views: row?.views ?? 0,
      visitors: row?.visitors ?? 0,
    });
  }
  return out;
}

export type TrafficRow = { label: string; views: number; visitors: number };

export function topPaths(
  windowSeconds: number,
  limit = 10,
  siteId?: string,
): TrafficRow[] {
  const since = Date.now() - windowSeconds * 1000;
  return (
    siteId
      ? sql(
          `SELECT path AS label, COUNT(*) AS views,
                  COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ? AND site_id = ?
           GROUP BY path ORDER BY views DESC LIMIT ?`,
        ).all(since, siteId, limit)
      : sql(
          `SELECT site_id || path AS label, COUNT(*) AS views,
                  COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ?
           GROUP BY label ORDER BY views DESC LIMIT ?`,
        ).all(since, limit)
  ) as TrafficRow[];
}

/** Views and visitors for each site, for the comparison table. */
export function trafficBySite(
  windowSeconds: number,
  offsetSeconds = 0,
): (TrafficRow & { siteId: string })[] {
  const until = Date.now() - offsetSeconds * 1000;
  const since = until - windowSeconds * 1000;
  return sql(
    `SELECT site_id AS siteId, site_id AS label, COUNT(*) AS views,
            COUNT(DISTINCT visitor) AS visitors
     FROM page_views WHERE ts >= ? AND ts < ?
     GROUP BY site_id ORDER BY views DESC`,
  ).all(since, until) as (TrafficRow & { siteId: string })[];
}

export function topReferrers(
  windowSeconds: number,
  limit = 10,
  siteId?: string,
): TrafficRow[] {
  const since = Date.now() - windowSeconds * 1000;
  return (
    siteId
      ? sql(
          `SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS label,
                  COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ? AND site_id = ?
           GROUP BY label ORDER BY views DESC LIMIT ?`,
        ).all(since, siteId, limit)
      : sql(
          `SELECT COALESCE(NULLIF(referrer, ''), 'Direct') AS label,
                  COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
           FROM page_views WHERE ts >= ?
           GROUP BY label ORDER BY views DESC LIMIT ?`,
        ).all(since, limit)
  ) as TrafficRow[];
}

/* ----------------------------------------------------------- reliability */

/**
 * Traffic for one page rather than for a whole site.
 *
 * Every project has a case study at `/work/<slug>`, including the projects
 * that run inside a client network and cannot be probed. How many people read
 * that page is therefore the one measured figure that each project dashboard
 * can always show. The `(site_id, path, ts)` index covers this query.
 */
export function pathSummary(
  path: string,
  windowSeconds: number,
  offsetSeconds = 0,
  siteId: string = SELF_SITE_ID,
): TrafficSummary {
  const until = Date.now() - offsetSeconds * 1000;
  const since = until - windowSeconds * 1000;

  const row = sql(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors
     FROM page_views WHERE site_id = ? AND path = ? AND ts >= ? AND ts < ?`,
  ).get(siteId, path, since, until) as { views: number; visitors: number };

  return {
    views: row?.views ?? 0,
    visitors: row?.visitors ?? 0,
    windowSeconds,
  };
}

/** The same page over time, for the sparkline on a project dashboard. */
export function pathSeries(
  path: string,
  windowSeconds: number,
  buckets = 24,
  siteId: string = SELF_SITE_ID,
): TrafficPoint[] {
  const now = Date.now();
  const since = now - windowSeconds * 1000;
  const bucketMs = Math.max(1, Math.floor((windowSeconds * 1000) / buckets));

  // CAST keeps the division in integer space. Binding the divisor as a REAL
  // produced float bucket keys that never matched the generated series.
  const rows = sql(
    `SELECT CAST(ts / ? AS INTEGER) AS bucket, COUNT(*) AS views,
            COUNT(DISTINCT visitor) AS visitors
     FROM page_views
     WHERE site_id = ? AND path = ? AND ts >= ?
     GROUP BY bucket ORDER BY bucket ASC`,
  ).all(bucketMs, siteId, path, since) as {
    bucket: number;
    views: number;
    visitors: number;
  }[];

  const found = new Map(rows.map((r) => [r.bucket, r]));
  const firstBucket = Math.floor(since / bucketMs);
  const lastBucket = Math.floor(now / bucketMs);

  const points: TrafficPoint[] = [];
  // Inclusive of the bucket that holds `now`, so the newest reading is drawn.
  for (let b = firstBucket; b <= lastBucket; b++) {
    const hit = found.get(b);
    points.push({
      ts: b * bucketMs,
      views: hit?.views ?? 0,
      visitors: hit?.visitors ?? 0,
    });
  }
  return points;
}

export type SloStatus = {
  target: number;
  actual: number;
  /** Seconds of downtime the target permits across the whole window. */
  budgetSeconds: number;
  /** Seconds of downtime measured inside the observed period. */
  usedSeconds: number;
  /** 0 = untouched, 1 = exhausted, above 1 = over. */
  consumed: number;
  samples: number;
  /** Seconds of the window that the console actually watched. */
  observedSeconds: number;
  /** observedSeconds / windowSeconds. Below 1 means the figure is partial. */
  coverage: number;
};

/**
 * Uptime against a target, expressed as an error budget.
 *
 * "99.4% uptime" does not say whether that is acceptable. An error budget does:
 * a 99.9% target over 30 days permits 43 minutes of downtime, and the number
 * that matters is how much of that is already spent.
 *
 * Downtime is derived from the sample ratio rather than from incident
 * durations. Samples are evenly spaced, so the ratio of bad samples is an
 * unbiased estimate of the ratio of bad time; incident records start and end on
 * a sample boundary and would round every outage up to the poll interval.
 */
export function sloStatus(
  siteId: string,
  windowSeconds: number,
  target = 0.999,
): SloStatus {
  const summary = uptimeSummary(siteId, windowSeconds);
  const budgetSeconds = windowSeconds * (1 - target);

  /**
   * Downtime is measured across the period the console watched, not across the
   * whole window.
   *
   * Multiplying the bad-sample ratio by the full window assumes the samples
   * cover it. On a new deployment they do not: one minute of checks at 47%
   * uptime became "16 days of downtime in the last 30 days", and the error
   * budget was useless for as long as the history was shorter than the window.
   *
   * `coverage` is returned with the figure so a page can say how much of the
   * window the number rests on.
   */
  const bounds = sql(
    `SELECT MIN(ts) AS first, MAX(ts) AS last FROM samples
     WHERE site_id = ? AND ts >= ?`,
  ).get(siteId, Date.now() - windowSeconds * 1000) as {
    first: number | null;
    last: number | null;
  };

  const observedSeconds =
    bounds?.first != null && bounds?.last != null
      ? Math.min(windowSeconds, (bounds.last - bounds.first) / 1000)
      : 0;

  const usedSeconds =
    summary.samples > 0 ? observedSeconds * (1 - summary.upRatio) : 0;

  return {
    target,
    actual: summary.upRatio,
    budgetSeconds,
    usedSeconds,
    consumed: budgetSeconds > 0 ? usedSeconds / budgetSeconds : 0,
    samples: summary.samples,
    observedSeconds,
    coverage: windowSeconds > 0 ? observedSeconds / windowSeconds : 0,
  };
}

export type IncidentStats = {
  count: number;
  /** Mean time to recovery, in seconds. Closed incidents only. */
  mttrSeconds: number | null;
  /** Mean time between the start of one incident and the next, in seconds. */
  mtbfSeconds: number | null;
  longestSeconds: number | null;
  openCount: number;
};

/**
 * How often it breaks, and how long it stays broken.
 *
 * MTTR counts only closed incidents: an incident still running has no recovery
 * time yet, and including it as "so far" would drag the mean down every time
 * the page refreshes.
 */
export function incidentStats(
  siteId: string,
  windowSeconds: number,
): IncidentStats {
  const since = Date.now() - windowSeconds * 1000;

  const rows = sql(
    `SELECT started_at, ended_at FROM incidents
     WHERE site_id = ? AND started_at >= ? ORDER BY started_at ASC`,
  ).all(siteId, since) as { started_at: number; ended_at: number | null }[];

  const closed = rows.filter((r) => r.ended_at !== null);
  const durations = closed.map((r) => (r.ended_at! - r.started_at) / 1000);

  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    gaps.push((rows[i].started_at - rows[i - 1].started_at) / 1000);
  }

  const mean = (values: number[]) =>
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;

  return {
    count: rows.length,
    mttrSeconds: mean(durations),
    mtbfSeconds: mean(gaps),
    longestSeconds: durations.length > 0 ? Math.max(...durations) : null,
    openCount: rows.length - closed.length,
  };
}

export type HistogramBin = { from: number; to: number | null; count: number };

/**
 * The shape of the response times, not only their percentiles.
 *
 * p50 and p95 hide whether the distribution has one peak or two. A service that
 * answers in 40ms from cache and 900ms from the database has a bimodal shape
 * that no percentile shows, and the fix for it is different.
 *
 * The boundaries are fixed rather than derived from the data, so the picture
 * does not change shape when the range changes.
 */
const HISTOGRAM_EDGES = [0, 50, 100, 200, 500, 1000, 2000];

export function latencyHistogram(
  siteId: string,
  windowSeconds: number,
): HistogramBin[] {
  const since = Date.now() - windowSeconds * 1000;

  const cases = HISTOGRAM_EDGES.map(
    (edge, i) =>
      `SUM(CASE WHEN latency_ms >= ${edge}${
        i < HISTOGRAM_EDGES.length - 1
          ? ` AND latency_ms < ${HISTOGRAM_EDGES[i + 1]}`
          : ""
      } THEN 1 ELSE 0 END) AS b${i}`,
  ).join(", ");

  const row = sql(
    `SELECT ${cases} FROM samples
     WHERE site_id = ? AND ts >= ? AND latency_ms IS NOT NULL`,
  ).get(siteId, since) as Record<string, number>;

  return HISTOGRAM_EDGES.map((edge, i) => ({
    from: edge,
    to: i < HISTOGRAM_EDGES.length - 1 ? HISTOGRAM_EDGES[i + 1] : null,
    count: row?.[`b${i}`] ?? 0,
  }));
}

export type HeatCell = {
  weekday: number;
  hour: number;
  value: number | null;
  samples: number;
};

/**
 * Mean response time for each hour of each weekday.
 *
 * This answers "when is it slow", which a time series cannot: a spike every
 * Monday at 09:00 looks like random noise on a 30-day line, and like a column
 * here.
 *
 * `offsetMinutes` shifts the timestamps before the hour is read, because the
 * server clock is usually UTC and the question is about local working hours.
 */
export function latencyHeatmap(
  siteId: string,
  windowSeconds: number,
  offsetMinutes = 0,
): HeatCell[] {
  const since = Date.now() - windowSeconds * 1000;
  const shiftSeconds = offsetMinutes * 60;

  const rows = sql(
    `SELECT
       CAST(strftime('%w', (ts / 1000) + ?, 'unixepoch') AS INTEGER) AS weekday,
       CAST(strftime('%H', (ts / 1000) + ?, 'unixepoch') AS INTEGER) AS hour,
       AVG(latency_ms) AS value,
       COUNT(*)        AS samples
     FROM samples
     WHERE site_id = ? AND ts >= ? AND latency_ms IS NOT NULL
     GROUP BY weekday, hour`,
  ).all(shiftSeconds, shiftSeconds, siteId, since) as {
    weekday: number;
    hour: number;
    value: number;
    samples: number;
  }[];

  const byCell = new Map(rows.map((r) => [`${r.weekday}-${r.hour}`, r]));
  const out: HeatCell[] = [];

  // Every cell is emitted, including the empty ones. A gap in the grid is the
  // honest answer for an hour that was never observed.
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = byCell.get(`${weekday}-${hour}`);
      out.push({
        weekday,
        hour,
        value: cell ? Math.round(cell.value) : null,
        samples: cell?.samples ?? 0,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------- TLS */

export function recordTlsCheck(check: {
  siteId: string;
  host: string;
  validTo: number;
  issuer: string | null;
  error?: string | null;
}): void {
  sql(
    `INSERT INTO tls_checks (site_id, host, checked_at, valid_to, issuer, error)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(site_id) DO UPDATE SET
       host = excluded.host, checked_at = excluded.checked_at,
       valid_to = excluded.valid_to, issuer = excluded.issuer,
       error = excluded.error`,
  ).run(
    check.siteId,
    check.host,
    Date.now(),
    check.validTo,
    check.issuer,
    check.error ?? null,
  );
}

export type TlsStatus = {
  siteId: string;
  host: string;
  checkedAt: number;
  validTo: number;
  issuer: string | null;
  error: string | null;
  daysLeft: number;
};

export function tlsStatuses(): TlsStatus[] {
  const rows = sql("SELECT * FROM tls_checks").all() as Record<
    string,
    unknown
  >[];

  return rows.map((r) => ({
    siteId: r.site_id as string,
    host: r.host as string,
    checkedAt: r.checked_at as number,
    validTo: r.valid_to as number,
    issuer: (r.issuer as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    daysLeft: Math.floor(
      ((r.valid_to as number) - Date.now()) / 86_400_000,
    ),
  }));
}

export function tlsStatus(siteId: string): TlsStatus | null {
  return tlsStatuses().find((t) => t.siteId === siteId) ?? null;
}

/* ------------------------------------------------------------ host metrics */

export type HostRow = {
  ts: number;
  cpuPercent: number | null;
  memoryPercent: number | null;
  memoryUsed: number | null;
  memoryTotal: number | null;
  swapPercent: number | null;
  diskPercent: number | null;
  diskUsed: number | null;
  diskTotal: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  rxPerSec: number | null;
  txPerSec: number | null;
  uptimeSeconds: number | null;
};

function toHostRow(r: Record<string, unknown>): HostRow {
  const n = (key: string) => (r[key] as number | null) ?? null;
  return {
    ts: r.ts as number,
    cpuPercent: n("cpu_percent"),
    memoryPercent: n("memory_percent"),
    memoryUsed: n("memory_used"),
    memoryTotal: n("memory_total"),
    swapPercent: n("swap_percent"),
    diskPercent: n("disk_percent"),
    diskUsed: n("disk_used"),
    diskTotal: n("disk_total"),
    load1: n("load1"),
    load5: n("load5"),
    load15: n("load15"),
    rxPerSec: n("rx_per_sec"),
    txPerSec: n("tx_per_sec"),
    uptimeSeconds: n("uptime_seconds"),
  };
}

export function recordHostSample(row: HostRow): void {
  sql(
    `INSERT OR REPLACE INTO host_samples
       (ts, cpu_percent, memory_percent, memory_used, memory_total, swap_percent,
        disk_percent, disk_used, disk_total, load1, load5, load15,
        rx_per_sec, tx_per_sec, uptime_seconds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.ts,
    row.cpuPercent,
    row.memoryPercent,
    row.memoryUsed,
    row.memoryTotal,
    row.swapPercent,
    row.diskPercent,
    row.diskUsed,
    row.diskTotal,
    row.load1,
    row.load5,
    row.load15,
    row.rxPerSec,
    row.txPerSec,
    row.uptimeSeconds,
  );
}

export function latestHostSample(): HostRow | null {
  const row = sql("SELECT * FROM host_samples ORDER BY ts DESC LIMIT 1").get() as
    | Record<string, unknown>
    | undefined;
  return row ? toHostRow(row) : null;
}

/**
 * Averages over evenly spaced buckets.
 *
 * At one sample per 10s a day is 8,640 rows and a chart has room for a couple
 * of hundred points. Averaging in SQL keeps the rest out of the render.
 */
export function hostSeries(windowSeconds = 3600, buckets = 120): HostRow[] {
  const from = Date.now() - windowSeconds * 1000;
  const width = Math.max(1, Math.floor((windowSeconds * 1000) / buckets));

  const rows = sql(
    `SELECT (ts / ?) * ?          AS ts,
            AVG(cpu_percent)      AS cpu_percent,
            AVG(memory_percent)   AS memory_percent,
            AVG(memory_used)      AS memory_used,
            MAX(memory_total)     AS memory_total,
            AVG(swap_percent)     AS swap_percent,
            AVG(disk_percent)     AS disk_percent,
            AVG(disk_used)        AS disk_used,
            MAX(disk_total)       AS disk_total,
            AVG(load1)            AS load1,
            AVG(load5)            AS load5,
            AVG(load15)           AS load15,
            AVG(rx_per_sec)       AS rx_per_sec,
            AVG(tx_per_sec)       AS tx_per_sec,
            MAX(uptime_seconds)   AS uptime_seconds
       FROM host_samples
      WHERE ts >= ?
   GROUP BY ts / ?
   ORDER BY ts`,
  ).all(width, width, from, width) as Record<string, unknown>[];

  return rows.map(toHostRow);
}

/* -------------------------------------------------------------- access log */

export type AccessMinuteInput = {
  host: string;
  ts: number;
  requests: number;
  bytes: number;
  visitors: number;
  status: { s2xx: number; s3xx: number; s4xx: number; s5xx: number; other: number };
  latencyAvgMs: number | null;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
  paths: Map<string, number>;
  referrers: Map<string, number>;
  methods: Map<string, number>;
};

/**
 * Write one closed minute and its label breakdowns as a single transaction.
 *
 * The rollup is replaced outright, but label counts are added to whatever is
 * there. A minute is normally written once; if a rotation makes the tailer
 * re-read one, the rollup must not double — and the labels of a minute that
 * was flushed in two parts must not be lost.
 */
export function flushAccessMinute(input: AccessMinuteInput): void {
  const handle = connect();

  handle.exec("BEGIN");
  try {
    sql(
      `INSERT OR REPLACE INTO access_minutes
         (host, ts, requests, bytes, visitors, s2xx, s3xx, s4xx, s5xx, other,
          latency_avg_ms, latency_p50_ms, latency_p95_ms, latency_p99_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.host,
      input.ts,
      input.requests,
      input.bytes,
      input.visitors,
      input.status.s2xx,
      input.status.s3xx,
      input.status.s4xx,
      input.status.s5xx,
      input.status.other,
      input.latencyAvgMs,
      input.latencyP50Ms,
      input.latencyP95Ms,
      input.latencyP99Ms,
    );

    const insertLabel = sql(
      `INSERT INTO access_labels (host, ts, kind, label, count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (host, ts, kind, label)
       DO UPDATE SET count = count + excluded.count`,
    );

    const dimensions: [string, Map<string, number>][] = [
      ["path", input.paths],
      ["referrer", input.referrers],
      ["method", input.methods],
    ];

    for (const [kind, counts] of dimensions) {
      for (const [label, count] of counts) {
        insertLabel.run(input.host, input.ts, kind, label, count);
      }
    }

    handle.exec("COMMIT");
  } catch (error) {
    handle.exec("ROLLBACK");
    throw error;
  }
}

export type AccessSummary = {
  host: string;
  requests: number;
  bytes: number;
  visitors: number;
  status: { s2xx: number; s3xx: number; s4xx: number; s5xx: number; other: number };
  errorRate: number;
  requestsPerMin: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  latencyP99Ms: number | null;
};

function toAccessSummary(
  r: Record<string, unknown>,
  windowSeconds: number,
): AccessSummary {
  const requests = Number(r.requests ?? 0);
  const status = {
    s2xx: Number(r.s2xx ?? 0),
    s3xx: Number(r.s3xx ?? 0),
    s4xx: Number(r.s4xx ?? 0),
    s5xx: Number(r.s5xx ?? 0),
    other: Number(r.other ?? 0),
  };

  const round = (value: unknown) =>
    value == null ? null : Math.round(Number(value));

  return {
    host: r.host as string,
    requests,
    bytes: Number(r.bytes ?? 0),
    // A sum of per-minute distinct counts: someone reading for ten minutes
    // counts ten times. Exact de-duplication would mean storing every hash,
    // which is the durable identifier the hashing exists to avoid.
    visitors: Number(r.visitors ?? 0),
    status,
    errorRate: requests
      ? Math.round(((status.s4xx + status.s5xx) / requests) * 1000) / 10
      : 0,
    requestsPerMin: Math.round((requests / (windowSeconds / 60)) * 10) / 10,
    latencyP50Ms: round(r.latency_p50_ms),
    latencyP95Ms: round(r.latency_p95_ms),
    latencyP99Ms: round(r.latency_p99_ms),
  };
}

/**
 * Percentiles are averaged weighted by request count. A minute that served
 * three requests should not move the hour's p95 as much as one that served
 * three thousand. This is an approximation — a true percentile needs the
 * original observations — but it is the honest one available from a rollup.
 */
const ACCESS_SUMMARY_COLUMNS = `
  SUM(requests) AS requests,
  SUM(bytes)    AS bytes,
  SUM(visitors) AS visitors,
  SUM(s2xx)     AS s2xx,
  SUM(s3xx)     AS s3xx,
  SUM(s4xx)     AS s4xx,
  SUM(s5xx)     AS s5xx,
  SUM(other)    AS other,
  SUM(latency_p50_ms * requests) / NULLIF(SUM(CASE WHEN latency_p50_ms IS NULL THEN 0 ELSE requests END), 0) AS latency_p50_ms,
  SUM(latency_p95_ms * requests) / NULLIF(SUM(CASE WHEN latency_p95_ms IS NULL THEN 0 ELSE requests END), 0) AS latency_p95_ms,
  SUM(latency_p99_ms * requests) / NULLIF(SUM(CASE WHEN latency_p99_ms IS NULL THEN 0 ELSE requests END), 0) AS latency_p99_ms
`;

/** One row per virtual host, busiest first. */
export function accessSummaries(windowSeconds = 3600): AccessSummary[] {
  const from = Date.now() - windowSeconds * 1000;
  const rows = sql(
    `SELECT host, ${ACCESS_SUMMARY_COLUMNS}
       FROM access_minutes
      WHERE ts >= ?
   GROUP BY host
   ORDER BY requests DESC`,
  ).all(from) as Record<string, unknown>[];

  return rows.map((row) => toAccessSummary(row, windowSeconds));
}

export function accessSummary(
  host: string,
  windowSeconds = 3600,
): AccessSummary | null {
  const from = Date.now() - windowSeconds * 1000;
  const row = sql(
    `SELECT host, ${ACCESS_SUMMARY_COLUMNS}
       FROM access_minutes
      WHERE ts >= ? AND host = ?
   GROUP BY host`,
  ).get(from, host) as Record<string, unknown> | undefined;

  return row?.host ? toAccessSummary(row, windowSeconds) : null;
}

export type AccessPoint = {
  ts: number;
  requests: number;
  errors: number;
  visitors: number;
  bytes: number;
  latencyP95Ms: number | null;
};

export function accessSeries(
  windowSeconds = 3600,
  buckets = 60,
  host?: string,
): AccessPoint[] {
  const now = Date.now();
  const from = now - windowSeconds * 1000;
  // Never narrower than the stored resolution.
  const width = Math.max(60_000, Math.floor((windowSeconds * 1000) / buckets));

  const rows = sql(
    `SELECT (ts / ?) * ?        AS ts,
            SUM(requests)       AS requests,
            SUM(s5xx)           AS errors,
            SUM(visitors)       AS visitors,
            SUM(bytes)          AS bytes,
            MAX(latency_p95_ms) AS latency_p95_ms
       FROM access_minutes
      WHERE ts >= ? AND (? IS NULL OR host = ?)
   GROUP BY ts / ?
   ORDER BY ts`,
  ).all(width, width, from, host ?? null, host ?? null, width) as Record<
    string,
    unknown
  >[];

  // Silence is information. A site with no requests for ten minutes must read
  // as a flat line at zero, not as one segment drawn between the two minutes
  // that did have traffic, so empty buckets are filled in rather than skipped.
  const byBucket = new Map<number, Record<string, unknown>>();
  for (const row of rows) byBucket.set(Number(row.ts), row);

  const points: AccessPoint[] = [];
  for (let ts = Math.floor(from / width) * width; ts <= now; ts += width) {
    const row = byBucket.get(ts);
    points.push({
      ts,
      requests: Number(row?.requests ?? 0),
      errors: Number(row?.errors ?? 0),
      visitors: Number(row?.visitors ?? 0),
      bytes: Number(row?.bytes ?? 0),
      latencyP95Ms: row?.latency_p95_ms == null ? null : Number(row.latency_p95_ms),
    });
  }

  return points;
}

export type AccessLabel = { label: string; count: number };

export function accessLabels(
  kind: "path" | "referrer" | "method",
  windowSeconds = 3600,
  limit = 10,
  host?: string,
): AccessLabel[] {
  const from = Date.now() - windowSeconds * 1000;
  const rows = sql(
    `SELECT label, SUM(count) AS count
       FROM access_labels
      WHERE ts >= ? AND kind = ? AND (? IS NULL OR host = ?)
   GROUP BY label
   ORDER BY count DESC
      LIMIT ?`,
  ).all(from, kind, host ?? null, host ?? null, limit) as Record<string, unknown>[];

  return rows.map((r) => ({ label: r.label as string, count: Number(r.count) }));
}

/** Every virtual host seen in the window, busiest first. */
export function accessHosts(windowSeconds = 30 * 86_400): string[] {
  const from = Date.now() - windowSeconds * 1000;
  const rows = sql(
    `SELECT host, SUM(requests) AS requests
       FROM access_minutes
      WHERE ts >= ?
   GROUP BY host
   ORDER BY requests DESC`,
  ).all(from) as Record<string, unknown>[];

  return rows.map((r) => r.host as string);
}
