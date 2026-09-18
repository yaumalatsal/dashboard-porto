/**
 * Live operations, on the portfolio itself.
 *
 * This is the section that makes the console part of the site rather than a
 * tenant of it: the claim "I run production infrastructure" is answered on the
 * page by the infrastructure, reporting its own uptime as of the last render.
 *
 * A server component with no client JavaScript — it reads the same SQLite store
 * the console reads. The page sets `revalidate`, so the HTML stays cached and
 * the numbers are at most that stale.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { currentSnapshots } from "@/lib/monitor/poller";
import { uptimeSummary } from "@/lib/monitor/store";
import { coverageLabel, formatUptime, HEALTH_LABEL } from "@/lib/monitor/format";
import SectionLabel from "@/components/ui/SectionLabel";

export default function OperationsSection() {
  const { sites } = loadConfig();

  // Nothing registered yet — say nothing rather than showing an empty frame.
  if (sites.length === 0) return null;

  const snapshots = currentSnapshots().filter((snapshot) => {
    const config = sites.find((site) => site.id === snapshot.id);
    return !config?.hidden;
  });

  const rows = snapshots.map((snapshot) => ({
    snapshot,
    config: sites.find((site) => site.id === snapshot.id),
    uptime: uptimeSummary(snapshot.id, 30 * 86_400),
  }));

  const observed = rows.filter((row) => row.uptime.samples > 0);
  const fleetUptime =
    observed.length > 0
      ? observed.reduce((sum, row) => sum + row.uptime.upRatio, 0) /
        observed.length
      : null;

  // The fleet figure can only claim the window its shortest-watched member has
  // actually been watched for. An application added yesterday drags the honest
  // label down to a day, which is the truth about the average.
  const fleetObserved =
    observed.length > 0
      ? Math.min(...observed.map((row) => row.uptime.observedSeconds))
      : 0;
  const fleetCoverage =
    observed.length > 0
      ? Math.min(...observed.map((row) => row.uptime.coverage))
      : 0;

  return (
    <div
      id="operations"
      className="operations-section"
      tabIndex={-1}
      aria-labelledby="operations-title"
    >
      <div className="section-shell">
        <SectionLabel number="04" label="Live Systems" />

        <div className="operations-intro">
          <h2 id="operations-title">
            Not a claim.
            <br />
            <em>A reading.</em>
          </h2>
          <p>
            These are the applications I have in production right now, polled
            every thirty seconds. The numbers below are measured, not written —
            if something is down while you are reading this, it will say so.
          </p>
        </div>

        <div className="operations-panel">
          {fleetUptime !== null && (
            <div className="operations-figure">
              <span className="operations-figure__value">
                {formatUptime(fleetUptime)}
              </span>
              <span className="operations-figure__label">
                Fleet uptime / {coverageLabel("30 days", fleetObserved, fleetCoverage)}
              </span>
            </div>
          )}

          <ul className="operations-list">
            {rows.map(({ snapshot, config, uptime }) => (
              <li key={snapshot.id} className="operations-row">
                <span
                  className={`operations-row__dot operations-row__dot--${snapshot.health}`}
                  aria-hidden="true"
                />
                <span className="operations-row__name">
                  {snapshot.label}
                  <em>{config?.blurb ?? "Production service"}</em>
                </span>
                {/* Status is stated in words as well as colour — the dot alone
                    would fail in grayscale and under colour-vision deficiency. */}
                <span className="operations-row__state">
                  {HEALTH_LABEL[snapshot.health]}
                </span>
                <span className="operations-row__metric">
                  {uptime.samples > 0 ? formatUptime(uptime.upRatio) : "—"}
                  <em>{coverageLabel("30d", uptime.observedSeconds, uptime.coverage)}</em>
                </span>
                <span className="operations-row__metric">
                  {snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms` : "—"}
                  <em>now</em>
                </span>
              </li>
            ))}
          </ul>

          <Link href="/console" className="operations-cta" data-cursor="link">
            Open the full console
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
