import Link from "next/link";
import { metricSeries, metricSummary, sharedMetricKeys } from "@/lib/monitor/store";
import { compact } from "@/lib/monitor/format";
import Sparkline from "./Sparkline";

/**
 * The same metric across applications, side by side.
 *
 * Only keys that more than one application reports are shown — comparing a
 * number nobody else publishes is a table with one row. The change column is
 * first-to-last within the window rather than a percentile, because these are
 * arbitrary gauges and counters whose distribution means nothing in general.
 *
 * Values are not normalised across apps: two services reporting `total_users`
 * are comparable, but the page does not assume that every shared key is. The
 * sparkline carries shape, the number carries magnitude, and the reader decides.
 */
export default function MetricCompare({
  sites,
  windowSeconds,
  rangeLabel,
}: {
  sites: { id: string; label: string }[];
  windowSeconds: number;
  rangeLabel: string;
}) {
  const keys = sharedMetricKeys().slice(0, 6);

  if (keys.length === 0) {
    return (
      <p className="panel__empty">
        No metric is reported by more than one application yet. Once two apps
        publish the same key — request counts, active users, memory — they are
        compared here automatically.
      </p>
    );
  }

  return (
    <div className="metric-compare">
      {keys.map((key) => {
        const rows = sites
          .map((site) => ({
            site,
            summary: metricSummary(site.id, key, windowSeconds),
            points: metricSeries(site.id, key, windowSeconds, 32),
          }))
          .filter((r) => r.summary.samples > 0)
          .sort((a, b) => (b.summary.latest ?? 0) - (a.summary.latest ?? 0));

        if (rows.length < 2) return null;

        return (
          <section key={key} className="metric-compare__group">
            <h3 className="metric-compare__key">{humanize(key)}</h3>
            <table className="ctable">
              <thead>
                <tr>
                  <th>Application</th>
                  <th className="ctable__num">Latest</th>
                  <th className="ctable__num">Change / {rangeLabel}</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ site, summary, points }) => {
                  const change =
                    summary.latest !== null && summary.first !== null
                      ? summary.latest - summary.first
                      : null;
                  return (
                    <tr key={site.id}>
                      <td>
                        <Link href={`/console/${site.id}`} className="ctable__link">
                          {site.label}
                        </Link>
                      </td>
                      <td className="ctable__num">
                        {summary.latest !== null ? compact(summary.latest) : "—"}
                      </td>
                      <td className="ctable__num">
                        {change === null || Math.abs(change) < 0.01 ? (
                          <span style={{ color: "var(--c-muted)" }}>—</span>
                        ) : (
                          <>
                            {change > 0 ? "+" : ""}
                            {compact(change)}
                          </>
                        )}
                      </td>
                      <td>
                        <Sparkline
                          values={points.map((p) => p.value)}
                          width={90}
                          height={20}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

function humanize(key: string): string {
  return key
    .split(".")
    .pop()!
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
