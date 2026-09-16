/**
 * The monitor's vocabulary.
 *
 * Every production app plugs in by describing itself in this shape — never by
 * adding code to the poller. An adapter's only job is to turn one app's bespoke
 * JSON into the normalized types below, after which the whole console (status
 * wall, analytics, charts, incident feed) renders it without knowing which app
 * it came from.
 */

/** Four states, ordered by severity. `unknown` means we have not heard yet. */
export type Health = "operational" | "degraded" | "down" | "unknown";

/** Severity rank, so "worst of these" is a `Math.max`, not a chain of ifs. */
export const HEALTH_RANK: Record<Health, number> = {
  operational: 0,
  unknown: 1,
  degraded: 2,
  down: 3,
};

export function worstHealth(states: Health[]): Health {
  return states.reduce<Health>(
    (worst, next) => (HEALTH_RANK[next] > HEALTH_RANK[worst] ? next : worst),
    "operational",
  );
}

/**
 * How a metric should be formatted and charted. The UI switches on this rather
 * than guessing from the value, so `0` renders as "0 ms" and not "0 bytes".
 */
export type MetricKind =
  | "count"
  | "gauge"
  | "percent"
  | "bytes"
  | "ms"
  | "rate"
  | "text";

export type Metric = {
  key: string;
  label: string;
  value: number | string;
  kind: MetricKind;
  /** Optional unit suffix that overrides the one implied by `kind`. */
  unit?: string;
  /** Grouping header in the UI — "Accounts", "Runtime", "Usage (24h)". */
  group?: string;
  /**
   * Crossing this makes the metric read as degraded. Lets an app declare its
   * own thresholds instead of hard-coding limits in the dashboard.
   */
  warnAbove?: number;
  critAbove?: number;
};

export type ServiceStatus = {
  name: string;
  status: Health;
  detail?: string;
  latencyMs?: number;
};

/** One probe's result: what a single HTTP call to one endpoint produced. */
export type ProbeResult = {
  probe: string;
  ok: boolean;
  httpStatus?: number;
  latencyMs: number;
  error?: string;
  /** Raw decoded body, handed to the adapter. */
  payload?: unknown;
};

/**
 * The normalized view of one app at one moment — the only shape the UI reads.
 */
export type SiteSnapshot = {
  id: string;
  label: string;
  health: Health;
  /** Latency of the health probe, which is the one we chart as "response time". */
  latencyMs: number | null;
  services: ServiceStatus[];
  metrics: Metric[];
  /** Version / build / uptime string an app chooses to advertise. */
  version?: string;
  uptimeSeconds?: number;
  error?: string;
  /**
   * Monitoring problems that are not application problems — an unauthorised
   * probe, most often an expired token. Surfaced separately so the app's health
   * is not misreported, while the misconfiguration is still visible.
   */
  notes?: string[];
  checkedAt: string;
  probes: ProbeResult[];
};

/** What an adapter receives and returns. */
export type AdapterInput = {
  site: SiteConfig;
  results: Record<string, ProbeResult>;
};

export type AdapterOutput = {
  health?: Health;
  services?: ServiceStatus[];
  metrics?: Metric[];
  version?: string;
  uptimeSeconds?: number;
};

export type Adapter = {
  id: string;
  /** Human description shown in the console's "add app" screen. */
  description: string;
  normalize: (input: AdapterInput) => AdapterOutput;
};

/** A single endpoint to poll. */
export type ProbeConfig = {
  /** Probe name — `health`, `services`, `metrics`, or anything custom. */
  name: string;
  url: string;
  /** Seconds between polls. Defaults per-probe in the poller. */
  intervalSeconds?: number;
  method?: "GET" | "POST";
  /** Extra headers merged over the site's auth header. */
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Treat these HTTP codes as healthy (e.g. a 401 that proves the app is up). */
  okStatuses?: number[];
};

export type SiteConfig = {
  /** Stable slug, used in URLs and as the DB key. */
  id: string;
  label: string;
  /** Public URL of the app itself, for the "visit" link. */
  url?: string;
  /** Short line under the title on the console card. */
  blurb?: string;
  /** Which normalizer to run. Defaults to `generic`. */
  adapter?: string;
  probes: ProbeConfig[];
  /**
   * Auth header sent on every probe. The value is read from `env` at poll time
   * so tokens never live in the config file.
   */
  auth?: {
    header: string;
    env: string;
  };
  /** Free-form tags — "production", "lms", "internal". Used for filtering. */
  tags?: string[];
  /** Hide from the public status wall while still polling. */
  hidden?: boolean;
};

export type MonitorConfig = {
  sites: SiteConfig[];
};

/** A stored sample — one row per site per health poll. */
export type Sample = {
  siteId: string;
  ts: number;
  health: Health;
  latencyMs: number | null;
};

/** A contiguous run of non-operational samples. */
export type Incident = {
  id: number;
  siteId: string;
  startedAt: number;
  endedAt: number | null;
  worst: Health;
  note?: string;
};

export type SeriesPoint = {
  ts: number;
  latencyP50: number | null;
  latencyP95: number | null;
  upRatio: number;
  samples: number;
};

export type UptimeSummary = {
  siteId: string;
  windowSeconds: number;
  upRatio: number;
  samples: number;
  latencyP50: number | null;
  latencyP95: number | null;
  latencyP99: number | null;
};
