/**
 * Analytics board — the fleet compared, rather than one app inspected.
 *
 * Deliberately a comparison table plus per-app small multiples rather than one
 * multi-line chart: past three series on a shared time axis the lines converge,
 * end-labels collide, and the categorical palette starts doing work colour
 * cannot do. Small multiples scale to as many apps as get added.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { currentSnapshots } from "@/lib/monitor/poller";
import { series, uptimeSummary } from "@/lib/monitor/store";
import { formatUptime } from "@/lib/monitor/format";
import Status from "@/components/console/Status";
import Sparkline from "@/components/console/Sparkline";
import AutoRefresh from "@/components/console/AutoRefresh";
import EmptyState from "@/components/console/EmptyState";
import RangePicker from "@/components/console/RangePicker";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; seconds: number; buckets: number }> = {
  "24h": { label: "24 hours", seconds: 86_400, buckets: 48 },
  "7d": { label: "7 days", seconds: 7 * 86_400, buckets: 56 },
  "30d": { label: "30 days", seconds: 30 * 86_400, buckets: 60 },
  "90d": { label: "90 days", seconds: 90 * 86_400, buckets: 90 },
};

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey } = await searchParams;
  const range = RANGES[rangeKey ?? "24h"] ?? RANGES["24h"];

  const { sites } = loadConfig();
  if (sites.length === 0) return <EmptyState />;

  const snapshots = currentSnapshots();

  const rows = sites.map((site) => {
    const snapshot = snapshots.find((s) => s.id === site.id);
    const summary = uptimeSummary(site.id, range.seconds);
    const points = series(site.id, range.seconds, range.buckets);
    return { site, snapshot, summary, points };
  });

  const observed = rows.filter((r) => r.summary.samples > 0);
  const totalSamples = rows.reduce((sum, r) => sum + r.summary.samples, 0);

  const fleetUptime =
    observed.length > 0
      ? observed.reduce((sum, r) => sum + r.summary.upRatio, 0) / observed.length
      : null;

  // Slowest app by p95 — the one worth looking at first.
  const slowest = observed
    .filter((r) => r.summary.latencyP95 !== null)
    .sort((a, b) => (b.summary.latencyP95 ?? 0) - (a.summary.latencyP95 ?? 0))[0];

  return (
    <>
      <AutoRefresh seconds={60} />

      <p className="console__eyebrow">Operations / Analytics</p>
      <h1>Fleet analytics.</h1>
      <p className="console__lede">
        Uptime and response-time behaviour across every monitored application,
        computed from {totalSamples.toLocaleString("en-US")} recorded samples.
      </p>

      <RangePicker
        current={rangeKey ?? "24h"}
        options={Object.entries(RANGES).map(([key, r]) => ({
          key,
          label: r.label,
        }))}
      />

      <section className="hero-figure" style={{ marginTop: "1.25rem" }}>
        <div>
          <div className="hero-figure__value">
            {fleetUptime !== null ? formatUptime(fleetUptime) : "—"}
          </div>
          <div className="hero-figure__label">
            Fleet uptime / {range.label}
          </div>
        </div>
        <div className="hero-figure__aside">
          <div>
            <div className="tile__value">{rows.length}</div>
            <div className="hero-figure__label">Applications</div>
          </div>
          <div>
            <div className="tile__value">
              {slowest?.summary.latencyP95 !== undefined &&
              slowest?.summary.latencyP95 !== null
                ? `${slowest.summary.latencyP95} ms`
                : "—"}
            </div>
            <div className="hero-figure__label">
              Slowest p95 {slowest ? `· ${slowest.site.label}` : ""}
            </div>
          </div>
          <div>
            <div className="tile__value">
              {totalSamples.toLocaleString("en-US")}
            </div>
            <div className="hero-figure__label">Samples</div>
          </div>
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>Comparison</h2>
        </div>
        <div className="ctable__wrap">
          <table className="ctable">
            <thead>
              <tr>
                <th>Application</th>
                <th>Status</th>
                <th className="ctable__num">Uptime</th>
                <th className="ctable__num">p50</th>
                <th className="ctable__num">p95</th>
                <th className="ctable__num">p99</th>
                <th className="ctable__num">Samples</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ site, snapshot, summary, points }) => (
                <tr key={site.id}>
                  <td>
                    <Link
                      href={`/console/${site.id}`}
                      style={{ color: "var(--c-ink)", fontWeight: 600 }}
                    >
                      {site.label}
                    </Link>
                  </td>
                  <td>
                    <Status health={snapshot?.health ?? "unknown"} />
                  </td>
                  <td className="ctable__num">
                    {summary.samples > 0 ? formatUptime(summary.upRatio) : "—"}
                  </td>
                  <td className="ctable__num">
                    {summary.latencyP50 !== null ? `${summary.latencyP50} ms` : "—"}
                  </td>
                  <td className="ctable__num">
                    {summary.latencyP95 !== null ? `${summary.latencyP95} ms` : "—"}
                  </td>
                  <td className="ctable__num">
                    {summary.latencyP99 !== null ? `${summary.latencyP99} ms` : "—"}
                  </td>
                  <td className="ctable__num">
                    {summary.samples.toLocaleString("en-US")}
                  </td>
                  <td>
                    <Sparkline
                      values={points.map((p) => p.latencyP50)}
                      width={90}
                      height={22}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>Response time / {range.label}</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>
            one panel per application · independent scales
          </span>
        </div>
        <div className="chart-grid">
          {rows.map(({ site, summary, points }) => (
            <div key={site.id} className="chart">
              <div className="chart__head">
                <h3 className="chart__title">{site.label}</h3>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--c-muted)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {summary.latencyP95 !== null ? `p95 ${summary.latencyP95} ms` : "no data"}
                </span>
              </div>
              <p className="chart__sub">
                {summary.samples > 0
                  ? `${formatUptime(summary.upRatio)} uptime · ${summary.samples.toLocaleString("en-US")} samples`
                  : "Waiting for samples"}
              </p>
              <PanelChart points={points.map((p) => p.latencyP50)} />
            </div>
          ))}
        </div>
      </section>

      <p className="console__note">
        Percentiles are nearest-rank over the selected window. Each panel scales
        to its own range, so compare shape here and absolute values in the table
        above.
      </p>
    </>
  );
}

/**
 * A single-series panel for the small-multiples grid. One series, so no legend:
 * the panel heading already names what is plotted.
 */
function PanelChart({ points }: { points: (number | null)[] }) {
  const values = points.filter((v): v is number => v !== null);
  if (values.length === 0) {
    return <div className="chart__empty">Waiting for samples</div>;
  }

  // One point cannot make a line; draw it as a marker so the panel still
  // reports that data exists.
  if (values.length === 1) {
    const only = points.findIndex((v) => v !== null);
    const cx = points.length > 1 ? (only / (points.length - 1)) * 400 : 200;
    return (
      <svg className="chart__svg" viewBox="0 0 400 96" height={96} role="img"
        aria-label={`Single sample at ${Math.round(values[0])} ms`}>
        <circle cx={cx} cy={48} r="4" fill="var(--series-accent)" />
      </svg>
    );
  }

  const width = 400;
  const height = 96;
  const pad = 6;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;

  const coords = points.flatMap((value, index) => {
    if (value === null) return [];
    return [
      {
        x: (index / (points.length - 1)) * width,
        y: pad + (height - pad * 2) - ((value - min) / span) * (height - pad * 2),
      },
    ];
  });

  const path = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)} ${height} L${coords[0].x.toFixed(1)} ${height} Z`;

  return (
    <svg
      className="chart__svg"
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Response time trend, ${Math.round(min)} to ${Math.round(max)} ms`}
    >
      <path d={area} fill="var(--series-accent)" fillOpacity="0.1" />
      <path
        d={path}
        fill="none"
        stroke="var(--series-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
