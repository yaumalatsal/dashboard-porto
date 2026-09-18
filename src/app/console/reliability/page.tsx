/**
 * Reliability.
 *
 * The overview answers "is it up now". This page answers the questions that
 * need history: is it meeting its target, how long does it stay broken, what
 * does the response time actually look like, when is it slow, and is the
 * certificate about to expire.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import {
  incidentStats,
  latencyHeatmap,
  latencyHistogram,
  sloStatus,
  tlsStatuses,
  uptimeSummary,
} from "@/lib/monitor/store";
import { coverageLabel, formatDuration, formatUptime } from "@/lib/monitor/format";
import AutoRefresh from "@/components/console/AutoRefresh";
import ScopeBar from "@/components/console/ScopeBar";
import Kpi from "@/components/console/Kpi";
import Heatmap from "@/components/console/Heatmap";
import Histogram from "@/components/console/Histogram";
import EmptyState from "@/components/console/EmptyState";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; seconds: number }> = {
  "7d": { label: "7 days", seconds: 7 * 86_400 },
  "30d": { label: "30 days", seconds: 30 * 86_400 },
  "90d": { label: "90 days", seconds: 90 * 86_400 },
};

/** The uptime target. Change this to change every figure on the page. */
const SLO_TARGET = 0.999;

/**
 * The heatmap reads local working hours, not UTC. The server clock is usually
 * UTC, so the offset is applied before the hour is read.
 */
const TZ_OFFSET_MINUTES = Number(process.env.CONSOLE_TZ_OFFSET_MINUTES ?? 420);

export default async function ReliabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; site?: string }>;
}) {
  const params = await searchParams;
  const rangeKey = params.range ?? "30d";
  const range = RANGES[rangeKey] ?? RANGES["30d"];

  const { sites } = loadConfig();
  if (sites.length === 0) return <EmptyState />;

  const selected = sites.find((s) => s.id === params.site) ?? sites[0];

  const slo = sloStatus(selected.id, range.seconds, SLO_TARGET);
  const incidents = incidentStats(selected.id, range.seconds);
  const histogram = latencyHistogram(selected.id, range.seconds);
  const heat = latencyHeatmap(selected.id, range.seconds, TZ_OFFSET_MINUTES);
  const certificates = tlsStatuses();

  // Ranked worst-first: the question is which application to look at.
  const ranked = sites
    .map((site) => ({
      site,
      summary: uptimeSummary(site.id, range.seconds),
      slo: sloStatus(site.id, range.seconds, SLO_TARGET),
      incidents: incidentStats(site.id, range.seconds),
    }))
    .sort((a, b) => b.slo.consumed - a.slo.consumed);

  const budgetLevel =
    slo.consumed >= 1 ? "critical" : slo.consumed >= 0.5 ? "warn" : "good";

  return (
    <>
      <AutoRefresh seconds={60} />

      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Reliability</p>
          <h1>How well it runs.</h1>
        </div>
        <ScopeBar
          current={rangeKey}
          options={Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label }))}
          basePath="/console/reliability"
        />
      </div>

      {/* Which application the detail panels describe. */}
      <div className="site-tabs" role="group" aria-label="Application">
        {sites.map((site) => (
          <Link
            key={site.id}
            href={`/console/reliability?range=${rangeKey}&site=${site.id}`}
            className="site-tab"
            aria-current={site.id === selected.id ? "true" : undefined}
          >
            {site.label}
          </Link>
        ))}
      </div>

      <section className="kpi-row" aria-label="Reliability metrics">
        <Kpi
          label={`Uptime target ${(SLO_TARGET * 100).toFixed(1)}%`}
          value={slo.samples > 0 ? formatUptime(slo.actual) : "—"}
          footer={
            <span className="kpi__note">
              {slo.samples.toLocaleString("en-US")} checks over{" "}
              {coverageLabel(range.label, slo.observedSeconds, slo.coverage)}
            </span>
          }
        />
        <Kpi
          label="Error budget used"
          value={slo.samples > 0 ? `${Math.round(slo.consumed * 100)}%` : "—"}
          footer={
            <span className={`kpi__note kpi__note--${budgetLevel}`}>
              {slo.coverage < 0.95
                ? `${Math.round(slo.coverage * 100)}% of window observed`
                : `${formatDuration(Math.max(0, slo.budgetSeconds - slo.usedSeconds))} left`}
            </span>
          }
        />
        <Kpi
          label="Mean time to recovery"
          value={
            incidents.mttrSeconds !== null
              ? formatDuration(incidents.mttrSeconds)
              : "—"
          }
          footer={
            <span className="kpi__note">
              {incidents.count} fault{incidents.count === 1 ? "" : "s"}
            </span>
          }
        />
        <Kpi
          label="Mean time between faults"
          value={
            incidents.mtbfSeconds !== null
              ? formatDuration(incidents.mtbfSeconds)
              : "—"
          }
          footer={
            <span className="kpi__note">
              {incidents.longestSeconds !== null
                ? `longest ${formatDuration(incidents.longestSeconds)}`
                : "no closed fault"}
            </span>
          }
        />
      </section>

      <section className="board-hero">
        <div className="panel panel--hero">
          <div className="panel__head">
            <h2>Response time by hour</h2>
            <span className="panel__meta">
              {selected.label} · {range.label}
            </span>
          </div>
          <Heatmap cells={heat} />
        </div>

        <aside className="panel panel--insights" aria-label="Error budget">
          <div className="panel__head">
            <h2>Error budget</h2>
          </div>

          {/* A meter, not a chart: one ratio against one limit. The unfilled
              track is a lighter step of the same ramp, so the state reads
              across the whole bar. */}
          <div className="budget">
            <div className="budget__track">
              <div
                className={`budget__fill budget__fill--${budgetLevel}`}
                style={{ width: `${Math.min(100, slo.consumed * 100)}%` }}
              />
            </div>
            <p className="budget__text">
              The {(SLO_TARGET * 100).toFixed(1)}% target allows{" "}
              <strong>{formatDuration(slo.budgetSeconds)}</strong> of downtime in{" "}
              {range.label}. {selected.label} used{" "}
              <strong>{formatDuration(slo.usedSeconds)}</strong>.
            </p>

            {/* A figure from a part of the window must say so. Otherwise a new
                deployment shows a full-window verdict built from an hour. */}
            {slo.coverage < 0.95 && (
              <p className="budget__caveat">
                The console watched {formatDuration(slo.observedSeconds)} of this{" "}
                {range.label} window, which is {Math.round(slo.coverage * 100)}%.
                The figure covers that period only.
              </p>
            )}
          </div>

          <div className="insight-stat">
            <span className="insight-stat__label">Open faults</span>
            <span className="insight-stat__value">
              {incidents.openCount}
              <em>
                {incidents.openCount === 0
                  ? "nothing is broken now"
                  : "check the fault record"}
              </em>
            </span>
          </div>

          <Link href="/console/incidents" className="insight-link">
            Open the fault record
          </Link>
        </aside>
      </section>

      <section className="board-grid">
        <div className="panel">
          <div className="panel__head">
            <h2>Response time distribution</h2>
            <span className="panel__meta">{selected.label}</span>
          </div>
          <Histogram bins={histogram} />
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Certificates</h2>
            <span className="panel__meta">checked each day</span>
          </div>
          {certificates.length === 0 ? (
            <p className="panel__empty">
              No https site yet, or the console has not run its first check.
            </p>
          ) : (
            <table className="ctable">
              <thead>
                <tr>
                  <th>Host</th>
                  <th>Issuer</th>
                  <th className="ctable__num">Days left</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((cert) => (
                  <tr key={cert.siteId}>
                    <td>{cert.host}</td>
                    <td style={{ color: "var(--c-muted)" }}>
                      {cert.error ? "—" : (cert.issuer ?? "unknown")}
                    </td>
                    <td className="ctable__num">
                      {cert.error ? (
                        <span style={{ color: "var(--s-warning)" }}>{cert.error}</span>
                      ) : (
                        <span
                          style={{
                            color:
                              cert.daysLeft <= 7
                                ? "var(--s-critical)"
                                : cert.daysLeft <= 21
                                  ? "var(--s-warning)"
                                  : undefined,
                          }}
                        >
                          {cert.daysLeft}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>All applications</h2>
          <span className="panel__meta">worst budget first</span>
        </div>
        <div className="panel">
          <table className="ctable">
            <thead>
              <tr>
                <th>Application</th>
                <th className="ctable__num">Uptime</th>
                <th className="ctable__num">Budget used</th>
                <th className="ctable__num">Faults</th>
                <th className="ctable__num">MTTR</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.site.id}>
                  <td>
                    <Link
                      href={`/console/reliability?range=${rangeKey}&site=${row.site.id}`}
                      className="ctable__link"
                    >
                      {row.site.label}
                    </Link>
                  </td>
                  <td className="ctable__num">
                    {row.summary.samples > 0
                      ? formatUptime(row.summary.upRatio)
                      : "—"}
                    {row.summary.samples > 0 && row.summary.coverage < 0.9 && (
                      <em className="ctable__qualifier">
                        {coverageLabel(range.label, row.summary.observedSeconds, row.summary.coverage)}
                      </em>
                    )}
                  </td>
                  <td className="ctable__num">
                    {row.slo.samples > 0 ? (
                      <span
                        style={{
                          color:
                            row.slo.consumed >= 1
                              ? "var(--s-critical)"
                              : row.slo.consumed >= 0.5
                                ? "var(--s-warning)"
                                : undefined,
                        }}
                      >
                        {Math.round(row.slo.consumed * 100)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="ctable__num">{row.incidents.count}</td>
                  <td className="ctable__num">
                    {row.incidents.mttrSeconds !== null
                      ? formatDuration(row.incidents.mttrSeconds)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="console__note">
        The console measures the downtime across the period it watched, not
        across the whole window. A new application has a short history, so the
        page says how much of the window each figure covers. The console
        calculates the downtime from the health checks, not from the fault
        records. The checks are evenly spaced, so the ratio of bad checks
        is a fair estimate of the ratio of bad time. A fault record starts and
        ends on a check, so it would round each fault up to the check interval.
      </p>
    </>
  );
}
