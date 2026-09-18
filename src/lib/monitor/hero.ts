import { currentSnapshots } from "./poller";
import { uptimeSummary } from "./store";
import { loadConfig } from "./config";
import { coverageLabel, formatUptime } from "./format";

/**
 * The four figures the hero shows.
 *
 * The hero is a client component — it runs GSAP — so it cannot read the
 * database itself. The page computes this on the server and hands it over
 * already formatted, which also keeps the relative time from being derived on
 * the client and disagreeing with the server-rendered HTML.
 */
export type HeroReadout = {
  online: number;
  total: number;
  uptime: string;
  uptimeWindow: string;
  latency: string;
  checked: string;
  /** Worst health across the fleet, so the rail can colour itself honestly. */
  state: "operational" | "degraded" | "down" | "unknown";
};

const WINDOW = 30 * 86_400;

function relative(ts: number, now: number): string {
  const delta = now - ts;
  if (delta < 90_000) return "moments ago";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} min ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} h ago`;
  return `${Math.floor(delta / 86_400_000)} d ago`;
}

export function heroReadout(): HeroReadout | null {
  const hidden = new Set(
    loadConfig()
      .sites.filter((site) => site.hidden)
      .map((site) => site.id),
  );

  const snapshots = currentSnapshots().filter((s) => !hidden.has(s.id));

  if (snapshots.length === 0) {
    return null;
  }

  const summaries = snapshots
    .map((s) => uptimeSummary(s.id, WINDOW))
    .filter((s) => s.samples > 0);

  // Every application weighted equally: one chatty service must not be able to
  // flatter the headline by out-sampling the rest.
  const uptime =
    summaries.length > 0
      ? summaries.reduce((sum, s) => sum + s.upRatio, 0) / summaries.length
      : null;

  // The mean cannot claim a longer window than its shortest-watched member.
  const observedSeconds =
    summaries.length > 0
      ? Math.min(...summaries.map((s) => s.observedSeconds))
      : 0;
  const coverage =
    summaries.length > 0 ? Math.min(...summaries.map((s) => s.coverage)) : 0;

  const latencies = snapshots
    .map((s) => s.latencyMs)
    .filter((v): v is number => v !== null);

  const now = Date.now();
  const checkedAt = snapshots
    .map((s) => Date.parse(s.checkedAt))
    .filter((v) => Number.isFinite(v));

  const health = new Set(snapshots.map((s) => s.health));
  const state = health.has("down")
    ? "down"
    : health.has("degraded")
      ? "degraded"
      : health.has("operational")
        ? "operational"
        : "unknown";

  return {
    online: snapshots.filter((s) => s.health === "operational").length,
    total: snapshots.length,
    uptime: uptime !== null ? formatUptime(uptime) : "—",
    uptimeWindow: coverageLabel("30d", observedSeconds, coverage),
    latency:
      latencies.length > 0
        ? `${Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)} ms`
        : "—",
    checked:
      checkedAt.length > 0 ? relative(Math.max(...checkedAt), now) : "—",
    state,
  };
}
