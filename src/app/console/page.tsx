/**
 * Console overview, built to the five-stage reading path:
 *
 *   1 Context   — the range bar, so scope is established before any number
 *   2 Summary   — four KPIs with variance against the preceding period
 *   3 Hero      — one dominant chart carrying the core narrative
 *   4 Drilldown — the applications table and a log preview that explain it
 *   5 Action    — what to do about it, beside the hero rather than buried
 *
 * A server component: it reads SQLite at render time, so the first paint is
 * already the real data — no spinner, no client fetch, no hydration cost for
 * the figures.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { currentSnapshots } from "@/lib/monitor/poller";
import { recentEvents, recentIncidents, series, uptimeSummary } from "@/lib/monitor/store";
import { formatRelative, formatUptime, HEALTH_LABEL } from "@/lib/monitor/format";
import { worstHealth } from "@/lib/monitor/types";
import Status from "@/components/console/Status";
import AutoRefresh from "@/components/console/AutoRefresh";
import EmptyState from "@/components/console/EmptyState";
import ScopeBar from "@/components/console/ScopeBar";
import Kpi from "@/components/console/Kpi";
import FleetChart from "@/components/console/FleetChart";
import Sparkline from "@/components/console/Sparkline";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; seconds: number; buckets: number }> = {
  "24h": { label: "24 hours", seconds: 86_400, buckets: 48 },
  "7d": { label: "7 days", seconds: 7 * 86_400, buckets: 56 },
  "30d": { label: "30 days", seconds: 30 * 86_400, buckets: 60 },
};

export default async function ConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeKey = "24h" } = await searchParams;
  const range = RANGES[rangeKey] ?? RANGES["24h"];

  const { sites } = loadConfig();
  if (sites.length === 0) return <EmptyState />;

  const snapshots = currentSnapshots().filter(
    (s) => !sites.find((site) => site.id === s.id)?.hidden,
  );

  const rows = snapshots.map((snapshot) => ({
    snapshot,
    config: sites.find((site) => site.id === snapshot.id),
    current: uptimeSummary(snapshot.id, range.seconds),
    previous: uptimeSummary(snapshot.id, range.seconds, range.seconds),
    points: series(snapshot.id, range.seconds, range.buckets),
  }));

  const observed = rows.filter((r) => r.current.samples > 0);

  // Every app weighted equally, so one chatty service cannot flatter the
  // headline by out-sampling the others.
  const mean = (pick: (r: (typeof rows)[number]) => number | null) => {
    const values = observed.map(pick).filter((v): v is number => v !== null);
    return values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };

  const uptimeNow = mean((r) => r.current.upRatio);
  const uptimeBefore = mean((r) =>
    r.previous.samples > 0 ? r.previous.upRatio : null,
  );
  const p95Now = mean((r) => r.current.latencyP95);
  const p95Before = mean((r) => r.previous.latencyP95);

  const overall = worstHealth(snapshots.map((s) => s.health));
  const operational = snapshots.filter((s) => s.health === "operational").length;
  const openIncidents = recentIncidents(50).filter((i) => i.endedAt === null);
  const events = recentEvents({ limit: 6, minLevel: "warn" });

  const slowest = [...observed].sort(
    (a, b) => (b.current.latencyP95 ?? 0) - (a.current.latencyP95 ?? 0),
  )[0];
  const worstUptime = [...observed].sort(
    (a, b) => a.current.upRatio - b.current.upRatio,
  )[0];

  // Stage 5: the dashboard should say what to do, not only what is true.
  const actions: { level: "good" | "warn" | "critical"; text: string }[] = [];
  if (openIncidents.length > 0) {
    actions.push({
      level: "critical",
      text: `${openIncidents.length} fault${openIncidents.length === 1 ? "" : "s"} is still open. Start with ${
        sites.find((s) => s.id === openIncidents[0].siteId)?.label ?? openIncidents[0].siteId
      }.`,
    });
  }
  if (worstUptime && worstUptime.current.upRatio < 0.999) {
    actions.push({
      level: "warn",
      text: `${worstUptime.config?.label} has the lowest uptime: ${formatUptime(worstUptime.current.upRatio)} over ${range.label}.`,
    });
  }
  if (
    p95Now !== null &&
    p95Before !== null &&
    p95Before > 0 &&
    p95Now > p95Before * 1.25
  ) {
    actions.push({
      level: "warn",
      text: `The p95 response time is ${Math.round(((p95Now - p95Before) / p95Before) * 100)}% higher than the last ${range.label}. Check the slowest application first.`,
    });
  }
  for (const row of rows) {
    if (row.snapshot.notes?.length) {
      actions.push({
        level: "warn",
        text: `${row.config?.label}: ${row.snapshot.notes[0]}`,
      });
    }
  }
  if (actions.length === 0) {
    actions.push({
      level: "good",
      text: `No system needs attention. All ${snapshots.length} application${snapshots.length === 1 ? "" : "s"} stayed operational for the last ${range.label}.`,
    });
  }

  return (
    <>
      <AutoRefresh seconds={30} />

      {/* ── Stage 1: context ─────────────────────────────────────────── */}
      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Live</p>
          <h1>The systems I run.</h1>
        </div>
        <ScopeBar
          current={rangeKey}
          options={Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label }))}
        />
      </div>

      {/* ── Stage 2: summary ─────────────────────────────────────────── */}
      <section className="kpi-row" aria-label="Key metrics">
        <Kpi
          label="Fleet uptime"
          value={uptimeNow !== null ? formatUptime(uptimeNow) : "—"}
          delta={
            uptimeNow !== null && uptimeBefore !== null
              ? (uptimeNow - uptimeBefore) * 100
              : null
          }
          deltaSuffix={` pts vs. previous ${range.label}`}
          goodDirection="up"
        />
        <Kpi
          label="Response p95"
          value={p95Now !== null ? `${Math.round(p95Now)} ms` : "—"}
          delta={p95Now !== null && p95Before !== null ? p95Now - p95Before : null}
          deltaSuffix=" ms"
          goodDirection="down"
        />
        <Kpi
          label="Operational"
          value={`${operational}/${snapshots.length}`}
          footer={<Status health={overall} />}
        />
        <Kpi
          label="Open faults"
          value={String(openIncidents.length)}
          footer={
            <span className="kpi__note">
              {openIncidents.length === 0
                ? "none active"
                : `since ${formatRelative(openIncidents[0].startedAt)}`}
            </span>
          }
        />
      </section>

      {/* ── Stage 3 + 5: hero beside the actions it should provoke ───── */}
      <section className="board-hero">
        <div className="panel panel--hero">
          <div className="panel__head">
            <h2>Response time</h2>
            <span className="panel__meta">
              {range.label} · {observed.reduce((n, r) => n + r.current.samples, 0).toLocaleString("en-US")} samples
            </span>
          </div>
          <FleetChart
            series={rows.map((r) => ({
              id: r.snapshot.id,
              label: r.config?.label ?? r.snapshot.id,
              points: r.points,
            }))}
          />
        </div>

        <aside className="panel panel--insights" aria-label="Insights and actions">
          <div className="panel__head">
            <h2>What to do next</h2>
          </div>
          <ul className="insight-list">
            {actions.slice(0, 4).map((action) => (
              <li key={action.text} className={`insight insight--${action.level}`}>
                <i aria-hidden="true" />
                {action.text}
              </li>
            ))}
          </ul>

          {slowest && (
            <div className="insight-stat">
              <span className="insight-stat__label">Slowest now</span>
              <span className="insight-stat__value">
                {slowest.config?.label}
                <em>
                  {slowest.current.latencyP95 !== null
                    ? `${slowest.current.latencyP95} ms p95`
                    : "no data"}
                </em>
              </span>
            </div>
          )}

          <Link href="/console/logs" className="insight-link">
            Open the full log
          </Link>

          {/* This wall holds the applications the console polls. The project
              dashboards cover every project, including the ones no probe can
              reach. */}
          <Link href="/console/projects" className="insight-link">
            Open the project dashboards
          </Link>
        </aside>
      </section>

      {/* ── Stage 4: drilldowns ──────────────────────────────────────── */}
      <section className="board-grid">
        <div className="panel">
          <div className="panel__head">
            <h2>Applications</h2>
            <span className="panel__meta">{range.label}</span>
          </div>
          <table className="ctable">
            <thead>
              <tr>
                <th>Application</th>
                <th>Status</th>
                <th className="ctable__num">Uptime</th>
                <th className="ctable__num">p95</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ snapshot, config, current, points }) => (
                <tr key={snapshot.id}>
                  <td>
                    <Link href={`/console/${snapshot.id}`} className="ctable__link">
                      {config?.label ?? snapshot.id}
                    </Link>
                  </td>
                  <td>
                    <Status health={snapshot.health} />
                  </td>
                  <td className="ctable__num">
                    {current.samples > 0 ? formatUptime(current.upRatio) : "—"}
                  </td>
                  <td className="ctable__num">
                    {current.latencyP95 !== null ? `${current.latencyP95} ms` : "—"}
                  </td>
                  <td>
                    <Sparkline values={points.map((p) => p.latencyP50)} width={88} height={20} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Recent events</h2>
            <Link href="/console/logs" className="panel__meta panel__meta--link">
              All events →
            </Link>
          </div>
          {events.length === 0 ? (
            <p className="panel__empty">
              The console recorded no warnings and no errors. New events show here.
            </p>
          ) : (
            <ul className="activity">
              {events.map((event) => (
                <li key={event.id} className={`activity__row activity__row--${event.level}`}>
                  <span className="activity__time">{formatRelative(event.ts)}</span>
                  <span className="activity__text">
                    {event.message}
                    {event.detail && <em>{event.detail}</em>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="console__note">
        The console checks the health every 30 seconds, the services every 60
        seconds and the metrics every 5 minutes. It keeps 90 days of history.
        {openIncidents.length > 0 &&
          ` · ${HEALTH_LABEL[openIncidents[0].worst]} ongoing.`}
      </p>
    </>
  );
}
