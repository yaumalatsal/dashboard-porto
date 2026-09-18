/**
 * One application in detail: live services, every metric its API exposes,
 * response-time history and its own incident record.
 *
 * The metric grid is driven entirely by the adapter's output, so an app added
 * tomorrow with completely different metrics renders here with no code change.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSite } from "@/lib/monitor/config";
import { currentSnapshot } from "@/lib/monitor/poller";
import {
  dailyUptime,
  recentIncidents,
  series,
  uptimeSummary,
} from "@/lib/monitor/store";
import {
  formatDuration,
  formatMetric,
  formatRelative,
  formatUptime,
  metricLevel,
  HEALTH_LABEL,
} from "@/lib/monitor/format";
import type { Metric } from "@/lib/monitor/types";
import Status from "@/components/console/Status";
import UptimeStrip from "@/components/console/UptimeStrip";
import LatencyChart from "@/components/console/LatencyChart";
import StatTile from "@/components/console/StatTile";
import AutoRefresh from "@/components/console/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function SitePage({
  params,
}: {
  params: Promise<{ site: string }>;
}) {
  const { site: siteId } = await params;
  const config = getSite(siteId);
  if (!config) notFound();

  const snapshot = currentSnapshot(siteId);
  const day = uptimeSummary(siteId, 86_400);
  const month = uptimeSummary(siteId, 30 * 86_400);
  // The preceding 24 hours, so today's figures can be read as better or worse
  // rather than just as numbers.
  const previousDay = uptimeSummary(siteId, 86_400, 86_400);

  const delta = (now: number | null, before: number | null) =>
    now !== null && before !== null && before > 0 ? now - before : null;
  const points = series(siteId, 86_400, 72);
  const daily = dailyUptime(siteId, 90);
  const incidents = recentIncidents(10, siteId);

  // Group metrics by their adapter-assigned group, preserving first-seen order
  // so an app's own grouping survives rather than being alphabetized.
  const groups = new Map<string, Metric[]>();
  for (const metric of snapshot?.metrics ?? []) {
    const key = metric.group ?? "General";
    const bucket = groups.get(key);
    if (bucket) bucket.push(metric);
    else groups.set(key, [metric]);
  }

  const trend = points.map((p) => p.latencyP50);

  return (
    <>
      <AutoRefresh seconds={30} />

      <p className="console__eyebrow">
        <Link href="/console" style={{ color: "inherit" }}>
          Console
        </Link>
        {" / "}
        {config.label}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0 }}>{config.label}</h1>
        <Status health={snapshot?.health ?? "unknown"} />
      </div>

      {snapshot?.checkedAt && (
        <p className="console__freshness">
          <span aria-hidden="true" />
          Last checked {formatRelative(new Date(snapshot.checkedAt).getTime())}
          {day.samples > 0 && ` · ${day.samples.toLocaleString("en-US")} checks in 24h`}
        </p>
      )}

      <p className="console__lede" style={{ marginTop: "0.6rem" }}>
        {config.blurb ?? "Monitored production service."}
        {config.url && (
          <>
            {" "}
            <a
              href={config.url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ color: "var(--c-ember)" }}
            >
              Visit ↗
            </a>
          </>
        )}
      </p>

      <div className="tile-grid">
        <StatTile
          label="Uptime / 24h"
          value={day.samples > 0 ? formatUptime(day.upRatio) : "—"}
          delta={
            day.samples > 0 && previousDay.samples > 0
              ? (day.upRatio - previousDay.upRatio) * 100
              : null
          }
          deltaLabel="pts vs. yesterday"
          goodDirection="up"
        />
        <StatTile
          label="Uptime / 30d"
          value={month.samples > 0 ? formatUptime(month.upRatio) : "—"}
        />
        <StatTile
          label="Response now"
          value={snapshot?.latencyMs !== null && snapshot?.latencyMs !== undefined ? `${snapshot.latencyMs} ms` : "—"}
          trend={trend}
        />
        <StatTile
          label="p95 / 24h"
          value={day.latencyP95 !== null ? `${day.latencyP95} ms` : "—"}
          delta={delta(day.latencyP95, previousDay.latencyP95)}
          deltaLabel="ms vs. yesterday"
          goodDirection="down"
        />
        <StatTile
          label="p99 / 24h"
          value={day.latencyP99 !== null ? `${day.latencyP99} ms` : "—"}
          delta={delta(day.latencyP99, previousDay.latencyP99)}
          deltaLabel="ms vs. yesterday"
          goodDirection="down"
        />
        {snapshot?.uptimeSeconds !== undefined && (
          <StatTile
            label="Process uptime"
            value={formatDuration(snapshot.uptimeSeconds)}
          />
        )}
      </div>

      <section className="console__section">
        <div className="console__section-head">
          <h2>Response time / 24 hours</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>
            {day.samples.toLocaleString("en-US")} samples
          </span>
        </div>
        <div className="chart">
          <LatencyChart points={points} />
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>Uptime / 90 days</h2>
        </div>
        <div className="chart">
          <UptimeStrip days={daily} />
        </div>
      </section>

      {(snapshot?.services.length ?? 0) > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>Services</h2>
          </div>
          <div className="ctable__wrap">
            <table className="ctable">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Detail</th>
                  <th className="ctable__num">Latency</th>
                </tr>
              </thead>
              <tbody>
                {snapshot?.services.map((service) => (
                  <tr key={service.name}>
                    <td>{service.name}</td>
                    <td>
                      <Status health={service.status} />
                    </td>
                    <td style={{ color: "var(--c-muted)" }}>
                      {service.detail ?? "—"}
                    </td>
                    <td className="ctable__num">
                      {service.latencyMs !== undefined
                        ? `${service.latencyMs} ms`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {groups.size > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>Metrics</h2>
            <span style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>
              reported by the application
            </span>
          </div>
          <div className="chart-grid">
            {[...groups.entries()].map(([group, metrics]) => (
              <div key={group} className="metric-group">
                <h3>{group}</h3>
                {metrics.map((metric) => (
                  <div
                    key={metric.key}
                    className={`metric-row metric-row--${metricLevel(metric)}`}
                  >
                    <span className="metric-row__label" title={metric.label}>
                      {metric.label}
                    </span>
                    <span className="metric-row__value">
                      {formatMetric(metric)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {incidents.length > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>Incident history</h2>
          </div>
          <div className="metric-group">
            {incidents.map((incident) => (
              <div key={incident.id} className="incident">
                <Status health={incident.worst} showLabel={false} />
                <span>
                  {HEALTH_LABEL[incident.worst]}{" "}
                  <span style={{ color: "var(--c-muted)" }}>
                    {new Date(incident.startedAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {incident.endedAt
                      ? ` — recovered after ${formatDuration((incident.endedAt - incident.startedAt) / 1000)}`
                      : " — ongoing"}
                  </span>
                </span>
                <span className="incident__meta">
                  {formatRelative(incident.startedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {snapshot?.notes?.map((note) => (
        <p key={note} className="console__note console__note--warn">
          Monitoring: {note}
        </p>
      ))}

      {snapshot?.error && (
        <p className="console__note" style={{ color: "var(--s-critical)" }}>
          Last probe error: {snapshot.error}
        </p>
      )}
    </>
  );
}
