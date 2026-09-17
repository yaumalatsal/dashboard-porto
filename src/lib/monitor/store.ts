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

  return {
    siteId,
    windowSeconds,
    samples,
    upRatio: samples > 0 ? (row.up ?? 0) / samples : 0,
    latencyP50: row?.p50 ?? null,
    latencyP95: row?.p95 ?? null,
    latencyP99: row?.p99 ?? null,
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

  // Emit every bucket, including empty ones — a gap in monitoring is itself
  // information, and a chart that silently closes the gap tells a lie.
  for (let i = 0; i < buckets; i++) {
    const bucketStart = Math.floor((since + i * bucketMs) / bucketMs) * bucketMs;
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
  return Number(result.changes ?? 0);
}

export function closeDb(): void {
  statements.clear();
  db?.close();
  db = null;
}
