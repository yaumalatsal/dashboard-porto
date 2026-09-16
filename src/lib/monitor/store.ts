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
  Health,
  Incident,
  Sample,
  SeriesPoint,
  UptimeSummary,
} from "./types";

const DATA_DIR = process.env.CONSOLE_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = process.env.CONSOLE_DB_PATH ?? path.join(DATA_DIR, "console.db");

/** Samples older than this are pruned on boot and daily thereafter. */
const RETENTION_DAYS = Number(process.env.CONSOLE_RETENTION_DAYS ?? 90);

let db: DatabaseSync | null = null;

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

  db = handle;
  return handle;
}

export function getDb(): DatabaseSync {
  return connect();
}

/* ------------------------------------------------------------------ writes */

export function recordSample(sample: Sample): void {
  const handle = connect();
  handle
    .prepare(
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
  const handle = connect();
  const open = handle
    .prepare(
      "SELECT id, worst FROM incidents WHERE site_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .get(sample.siteId) as { id: number; worst: string } | undefined;

  const isBad = sample.health === "down" || sample.health === "degraded";

  if (isBad && !open) {
    handle
      .prepare(
        "INSERT INTO incidents (site_id, started_at, worst) VALUES (?, ?, ?)",
      )
      .run(sample.siteId, sample.ts, sample.health);
    return;
  }

  if (isBad && open) {
    // "down" outranks "degraded" — an incident is remembered by its worst moment.
    if (sample.health === "down" && open.worst !== "down") {
      handle
        .prepare("UPDATE incidents SET worst = ? WHERE id = ?")
        .run("down", open.id);
    }
    return;
  }

  if (!isBad && open && sample.health === "operational") {
    handle
      .prepare("UPDATE incidents SET ended_at = ? WHERE id = ?")
      .run(sample.ts, open.id);
  }
}

export function saveSnapshot(siteId: string, ts: number, payload: unknown): void {
  const handle = connect();
  handle
    .prepare(
      `INSERT INTO snapshots (site_id, ts, payload) VALUES (?, ?, ?)
       ON CONFLICT(site_id) DO UPDATE SET ts = excluded.ts, payload = excluded.payload`,
    )
    .run(siteId, ts, JSON.stringify(payload));
}

/** Last persisted snapshot for one site, or null if it has never been polled. */
export function readSnapshot(siteId: string): unknown | null {
  const handle = connect();
  const row = handle
    .prepare("SELECT payload FROM snapshots WHERE site_id = ?")
    .get(siteId) as { payload: string } | undefined;

  if (!row) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

export function readSnapshots(): Record<string, { ts: number; payload: unknown }> {
  const handle = connect();
  const rows = handle
    .prepare("SELECT site_id, ts, payload FROM snapshots")
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

/* ------------------------------------------------------------------- reads */

export function uptimeSummary(
  siteId: string,
  windowSeconds: number,
): UptimeSummary {
  const handle = connect();
  const since = Date.now() - windowSeconds * 1000;

  const row = handle
    .prepare(
      `SELECT
         COUNT(*)                                                  AS samples,
         SUM(CASE WHEN health = 'operational' THEN 1 ELSE 0 END)   AS up
       FROM samples WHERE site_id = ? AND ts >= ?`,
    )
    .get(siteId, since) as { samples: number; up: number | null };

  const samples = row?.samples ?? 0;

  return {
    siteId,
    windowSeconds,
    samples,
    upRatio: samples > 0 ? (row.up ?? 0) / samples : 0,
    latencyP50: percentile(siteId, since, 0.5),
    latencyP95: percentile(siteId, since, 0.95),
    latencyP99: percentile(siteId, since, 0.99),
  };
}

/**
 * Nearest-rank percentile. SQLite has no PERCENTILE_CONT, and an OFFSET on the
 * indexed column is cheaper here than pulling the window into JS.
 */
function percentile(siteId: string, since: number, p: number): number | null {
  const handle = connect();
  const count = handle
    .prepare(
      "SELECT COUNT(*) AS n FROM samples WHERE site_id = ? AND ts >= ? AND latency_ms IS NOT NULL",
    )
    .get(siteId, since) as { n: number };

  if (!count || count.n === 0) return null;

  const offset = Math.min(count.n - 1, Math.max(0, Math.ceil(p * count.n) - 1));
  const row = handle
    .prepare(
      `SELECT latency_ms FROM samples
       WHERE site_id = ? AND ts >= ? AND latency_ms IS NOT NULL
       ORDER BY latency_ms LIMIT 1 OFFSET ?`,
    )
    .get(siteId, since, offset) as { latency_ms: number } | undefined;

  return row?.latency_ms ?? null;
}

/**
 * Bucketed series for the charts. Bucketing in SQL keeps the payload flat
 * regardless of window length — 90 days and 1 hour both return `buckets` points.
 */
export function series(
  siteId: string,
  windowSeconds: number,
  buckets = 48,
): SeriesPoint[] {
  const handle = connect();
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
  const first = handle
    .prepare("SELECT MIN(ts) AS first FROM samples WHERE site_id = ? AND ts >= ?")
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
  const bucketMs = Math.max(1, Math.floor((now - since) / buckets));

  const rows = handle
    .prepare(
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
  const handle = connect();
  const rows = siteId
    ? (handle
        .prepare(
          "SELECT * FROM incidents WHERE site_id = ? ORDER BY started_at DESC LIMIT ?",
        )
        .all(siteId, limit) as Record<string, unknown>[])
    : (handle
        .prepare("SELECT * FROM incidents ORDER BY started_at DESC LIMIT ?")
        .all(limit) as Record<string, unknown>[]);

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
  const handle = connect();
  const since = Date.now() - days * 86400_000;

  const rows = handle
    .prepare(
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
  const handle = connect();
  const cutoff = Date.now() - RETENTION_DAYS * 86400_000;
  const result = handle.prepare("DELETE FROM samples WHERE ts < ?").run(cutoff);
  handle
    .prepare("DELETE FROM incidents WHERE ended_at IS NOT NULL AND ended_at < ?")
    .run(cutoff);
  return Number(result.changes ?? 0);
}

export function closeDb(): void {
  db?.close();
  db = null;
}
