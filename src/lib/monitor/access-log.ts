/**
 * Per-site traffic, read from nginx's access logs.
 *
 * The beacon in `/t.js` answers "how many people read my portfolio". This
 * answers a different question: what is actually hitting this machine. It sees
 * every site nginx serves without touching their code, and it sees what a page
 * beacon structurally cannot — API calls, bots, redirects, and the 5xx
 * responses of a page that never got far enough to run a script.
 *
 * nginx writes one JSON object per request (the `json_analytics` format in
 * docker/nginx.conf). This module tails those files, accumulates a bucket per
 * minute per virtual host, and flushes each minute to SQLite once it can no
 * longer receive new lines. Buffering until the minute closes is what makes
 * unique-visitor counts and percentiles exact rather than approximated across
 * partial writes.
 *
 * Addresses are never stored: they go through the same rotating-salt hash the
 * beacon uses, so a visitor can be counted without becoming identifiable.
 */

import fs from "node:fs";
import path from "node:path";
import { flushAccessMinute } from "./store";
import { visitorHash } from "./visitor";

const DEFAULT_DIRS = "/var/log/nginx";
const DEFAULT_PATTERN = String.raw`^access.*\.log$`;

/** Latencies kept per bucket. Ample for a stable p95, and bounds a traffic spike. */
const MAX_LATENCIES = 2000;
/** Distinct labels tracked per bucket, per dimension. */
const MAX_LABELS = 300;

export type AccessBucket = {
  host: string;
  minute: number;
  requests: number;
  bytes: number;
  status: { s2xx: number; s3xx: number; s4xx: number; s5xx: number; other: number };
  latencies: number[];
  visitors: Set<string>;
  paths: Map<string, number>;
  referrers: Map<string, number>;
  methods: Map<string, number>;
};

type ParsedLine = {
  ts: number;
  host: string;
  status: number;
  bytes: number;
  requestTime: number | null;
  urlPath: string;
  method: string;
  referrer: string;
  visitor: string;
};

/**
 * Collector state lives on `globalThis`, for the same reason the poller's
 * does: Next bundles `instrumentation.ts` separately from the route handlers
 * and server components, so each gets its own instance of this module. With
 * module-level state the tailer filled one copy while `/api/monitor/access`
 * and the console read a permanently empty one — reporting "no log files
 * found" while lines were landing in SQLite, which is precisely the
 * misdiagnosis this module exists to prevent.
 */
type CollectorState = {
  /** `${host}\n${minute}` -> bucket. Only minutes still open live here. */
  buckets: Map<string, AccessBucket>;
  /** Read offset per file, so each tick reads only what was appended. */
  tails: Map<string, Tail>;
  /** Why a file or directory could not be read, keyed by path. */
  failures: Map<string, string>;
  linesParsed: number;
  parseErrors: number;
  timer: NodeJS.Timeout | null;
  directories: string[];
};

type Tail = { offset: number; partial: string };

const GLOBAL_KEY = Symbol.for("astrolabe.monitor.accessLog");

const state: CollectorState = ((globalThis as Record<symbol, unknown>)[
  GLOBAL_KEY
] ??= {
  buckets: new Map(),
  tails: new Map(),
  failures: new Map(),
  linesParsed: 0,
  parseErrors: 0,
  timer: null,
  directories: [],
}) as CollectorState;

const { buckets, tails, failures } = state;

function minuteOf(ms: number): number {
  return Math.floor(ms / 60_000);
}

function newBucket(host: string, minute: number): AccessBucket {
  return {
    host,
    minute,
    requests: 0,
    bytes: 0,
    status: { s2xx: 0, s3xx: 0, s4xx: 0, s5xx: 0, other: 0 },
    latencies: [],
    visitors: new Set(),
    paths: new Map(),
    referrers: new Map(),
    methods: new Map(),
  };
}

/** Count a label, but stop admitting new ones once the bucket is wide enough. */
function bump(counts: Map<string, number>, label: string, cap: number): void {
  const existing = counts.get(label);
  if (existing === undefined && counts.size >= cap) return;
  counts.set(label, (existing ?? 0) + 1);
}

// --- Parsing ---------------------------------------------------------------

/**
 * Referrers are reduced to a hostname. The full URL is someone else's page
 * address, often with their query parameters attached, and the only question
 * the console asks of it is which site sent the visitor.
 */
function referrerHost(raw: unknown): string {
  if (typeof raw !== "string" || raw === "" || raw === "-") return "";
  try {
    return new URL(raw).hostname;
  } catch {
    return "";
  }
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  // nginx can emit a plain-text line before the format is applied (and
  // logrotate writes its own). Skip anything that is not an object.
  if (!trimmed.startsWith("{")) return null;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    state.parseErrors += 1;
    return null;
  }

  const parsedTs = Date.parse(String(raw.time ?? raw.time_iso8601 ?? ""));
  const uri = String(raw.uri ?? raw.request_uri ?? "");
  const requestTime = Number(raw.request_time);

  return {
    ts: Number.isNaN(parsedTs) ? Date.now() : parsedTs,
    host: String(raw.host ?? raw.server_name ?? "unknown"),
    status: numberOr(raw.status, 0),
    bytes: numberOr(raw.bytes_sent ?? raw.body_bytes_sent, 0),
    requestTime: Number.isFinite(requestTime) ? requestTime : null,
    // Group by path: `/search?q=` and `/search?q=` of a different term are the
    // same page, and the query string is where the sensitive part lives.
    urlPath: uri.split("?")[0] || "/",
    method: String(raw.method ?? raw.request_method ?? ""),
    referrer: referrerHost(raw.referrer ?? raw.http_referer),
    visitor: visitorHash(
      String(raw.remote_addr ?? ""),
      String(raw.user_agent ?? raw.http_user_agent ?? ""),
    ),
  };
}

export function record(entry: ParsedLine): void {
  const minute = minuteOf(entry.ts);
  const key = `${entry.host}\n${minute}`;

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = newBucket(entry.host, minute);
    buckets.set(key, bucket);
  }

  bucket.requests += 1;
  bucket.bytes += entry.bytes;

  const { status } = bucket;
  if (entry.status >= 200 && entry.status < 300) status.s2xx += 1;
  else if (entry.status < 400 && entry.status >= 300) status.s3xx += 1;
  else if (entry.status < 500 && entry.status >= 400) status.s4xx += 1;
  else if (entry.status >= 500) status.s5xx += 1;
  else status.other += 1;

  if (entry.requestTime !== null && bucket.latencies.length < MAX_LATENCIES) {
    bucket.latencies.push(entry.requestTime);
  }
  bucket.visitors.add(entry.visitor);
  bump(bucket.paths, entry.urlPath, MAX_LABELS);
  if (entry.referrer) bump(bucket.referrers, entry.referrer, MAX_LABELS);
  if (entry.method) bump(bucket.methods, entry.method, 16);
}

// --- Tailing ---------------------------------------------------------------

/**
 * A log the console cannot open looks exactly like a site with no visitors, so
 * the reason is recorded and surfaced rather than swallowed. The usual cause is
 * ownership: nginx logs are commonly root:adm 0640 and the app is unprivileged.
 */
function noteFailure(target: string, error: unknown): void {
  const code =
    error instanceof Error && "code" in error
      ? String((error as NodeJS.ErrnoException).code)
      : String(error);
  failures.set(target, code);
}

function readNew(file: string): void {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(/*turbopackIgnore: true*/ file);
  } catch {
    // Rotated away between listing and reading. It will reappear, or it won't.
    return;
  }

  const tail = tails.get(file);
  if (!tail) {
    // Start at the end. A log file can hold weeks of history, and replaying it
    // on every boot would invent a traffic spike that never happened.
    tails.set(file, { offset: stat.size, partial: "" });
    return;
  }

  // Shrunk means truncated in place (`logrotate copytruncate`); start over.
  if (stat.size < tail.offset) {
    tail.offset = 0;
    tail.partial = "";
  }
  if (stat.size === tail.offset) return;

  let fd: number;
  try {
    fd = fs.openSync(/*turbopackIgnore: true*/ file, "r");
  } catch (error) {
    noteFailure(file, error);
    return;
  }
  failures.delete(file);

  try {
    const length = stat.size - tail.offset;
    const buffer = Buffer.allocUnsafe(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, tail.offset);
    tail.offset += bytesRead;

    const lines = (tail.partial + buffer.subarray(0, bytesRead).toString("utf8")).split("\n");
    // A read can land mid-line; hold the remainder for the next tick.
    tail.partial = lines.pop() ?? "";

    for (const line of lines) {
      const entry = parseLine(line);
      if (!entry) continue;
      state.linesParsed += 1;
      record(entry);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function discover(dir: string, pattern: RegExp): string[] {
  try {
    const files = fs
      .readdirSync(/*turbopackIgnore: true*/ dir)
      .filter((name) => pattern.test(name))
      .map((name) => path.join(dir, name));
    failures.delete(dir);
    return files;
  } catch (error) {
    noteFailure(dir, error);
    return [];
  }
}

// --- Flushing --------------------------------------------------------------

function percentileMs(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[index]! * 1000); // nginx reports seconds
}

/**
 * Write every bucket that can no longer change. The current minute is left
 * open — flushing it would mean either a partial row or an update per line.
 */
function flushClosedMinutes(now = Date.now()): number {
  const currentMinute = minuteOf(now);
  let flushed = 0;

  for (const [key, bucket] of buckets) {
    if (bucket.minute >= currentMinute) continue;

    const sorted = [...bucket.latencies].sort((a, b) => a - b);
    const total = sorted.reduce((sum, value) => sum + value, 0);

    flushAccessMinute({
      host: bucket.host,
      ts: bucket.minute * 60_000,
      requests: bucket.requests,
      bytes: bucket.bytes,
      visitors: bucket.visitors.size,
      status: bucket.status,
      latencyAvgMs: sorted.length ? Math.round((total / sorted.length) * 1000) : null,
      latencyP50Ms: percentileMs(sorted, 50),
      latencyP95Ms: percentileMs(sorted, 95),
      latencyP99Ms: percentileMs(sorted, 99),
      paths: bucket.paths,
      referrers: bucket.referrers,
      methods: bucket.methods,
    });

    buckets.delete(key);
    flushed += 1;
  }

  return flushed;
}

// --- Lifecycle -------------------------------------------------------------

export type AccessLogStatus = {
  enabled: boolean;
  directories: string[];
  files: string[];
  linesParsed: number;
  parseErrors: number;
  unreadable: { target: string; error: string }[];
};

export function startAccessLog(options?: {
  dirs?: string;
  pattern?: string;
  intervalMs?: number;
}): void {
  if (state.timer) return;

  const configured = options?.dirs ?? process.env.NGINX_LOG_DIR ?? DEFAULT_DIRS;
  // Several directories, comma-separated: the nginx in this compose file and
  // the host's own nginx serving whatever else runs on the VPS.
  const directories = configured
    .split(",")
    .map((dir) => dir.trim())
    .filter(Boolean);

  if (directories.length === 0) return;
  state.directories = directories;

  const pattern = new RegExp(
    options?.pattern ?? process.env.NGINX_LOG_PATTERN ?? DEFAULT_PATTERN,
  );
  const intervalMs = options?.intervalMs ?? 2000;

  const tick = () => {
    try {
      for (const dir of directories) {
        for (const file of discover(dir, pattern)) readNew(file);
      }
      flushClosedMinutes();
    } catch (error) {
      console.error("[access-log] tick failed:", error);
    }
  };

  tick();
  state.timer = setInterval(tick, intervalMs);
  state.timer.unref?.();
  console.log(`[access-log] tailing ${directories.join(", ")} (${pattern.source})`);
}

export function stopAccessLog(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  // Salvage whatever is complete; an open minute is not worth a partial row.
  try {
    flushClosedMinutes();
  } catch {
    // Shutting down anyway.
  }
}

export function accessLogStatus(): AccessLogStatus {
  return {
    enabled: state.timer !== null,
    directories: state.directories,
    files: [...tails.keys()],
    linesParsed: state.linesParsed,
    parseErrors: state.parseErrors,
    unreadable: [...failures.entries()].map(([target, error]) => ({ target, error })),
  };
}

/** Exposed for tests: drain buckets without waiting for the interval. */
export const _internals = { flushClosedMinutes, buckets, minuteOf };
