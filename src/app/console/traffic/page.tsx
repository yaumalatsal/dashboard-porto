/**
 * Traffic on this site.
 *
 * Same five-stage reading path as the overview: scope, KPIs, one dominant
 * chart, then the breakdowns that explain it.
 *
 * Measured with no cookie, no stored address and no cross-day identifier — see
 * lib/monitor/visitor.ts. That limits what this page can answer (no returning
 * visitors, no journeys) and is a deliberate trade.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import {
  SELF_SITE_ID,
  topPaths,
  topReferrers,
  trafficBySite,
  trafficSeries,
  trafficSites,
  trafficSummary,
} from "@/lib/monitor/store";
import { compact } from "@/lib/monitor/format";
import AutoRefresh from "@/components/console/AutoRefresh";
import ScopeBar from "@/components/console/ScopeBar";
import Kpi from "@/components/console/Kpi";
import TrafficChart from "@/components/console/TrafficChart";
import BreakdownList from "@/components/console/BreakdownList";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; seconds: number; buckets: number }> = {
  "24h": { label: "24 hours", seconds: 86_400, buckets: 48 },
  "7d": { label: "7 days", seconds: 7 * 86_400, buckets: 56 },
  "30d": { label: "30 days", seconds: 30 * 86_400, buckets: 60 },
};

export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; site?: string }>;
}) {
  const params = await searchParams;
  const rangeKey = params.range ?? "24h";
  const range = RANGES[rangeKey] ?? RANGES["24h"];

  // "all" is the default: the first question is how the whole estate is doing.
  const siteFilter =
    params.site && params.site !== "all" ? params.site : undefined;

  const { sites } = loadConfig();
  const seen = trafficSites();
  const label = (id: string) =>
    id === SELF_SITE_ID
      ? "This site"
      : (sites.find((s) => s.id === id)?.label ?? id);

  const now = trafficSummary(range.seconds, 0, siteFilter);
  const before = trafficSummary(range.seconds, range.seconds, siteFilter);
  const points = trafficSeries(range.seconds, range.buckets, siteFilter);
  const paths = topPaths(range.seconds, 8, siteFilter);
  const referrers = topReferrers(range.seconds, 8, siteFilter);
  const bySite = trafficBySite(range.seconds);
  const bySiteBefore = trafficBySite(range.seconds, range.seconds);

  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
  const viewsPerVisitor =
    now.visitors > 0 ? (now.views / now.visitors).toFixed(1) : "—";

  // Which project pages people actually open is the question a portfolio owner
  // has; it is not answerable from the raw path list without separating them.
  const projectViews = paths
    .filter((p) => p.label.startsWith("/work/"))
    .reduce((sum, p) => sum + p.views, 0);

  const hasData = now.views > 0;

  return (
    <>
      <AutoRefresh seconds={60} />

      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Traffic</p>
          <h1>Site visitors.</h1>
        </div>
        <ScopeBar
          current={rangeKey}
          options={Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label }))}
          basePath="/console/traffic"
        />
      </div>

      {seen.length > 1 && (
        <div className="site-tabs" role="group" aria-label="Site">
          <Link
            href={`/console/traffic?range=${rangeKey}`}
            className="site-tab"
            aria-current={siteFilter === undefined ? "true" : undefined}
          >
            All sites
          </Link>
          {seen.map((id) => (
            <Link
              key={id}
              href={`/console/traffic?range=${rangeKey}&site=${id}`}
              className="site-tab"
              aria-current={siteFilter === id ? "true" : undefined}
            >
              {label(id)}
            </Link>
          ))}
        </div>
      )}

      {!hasData ? (
        <div className="console__empty">
          <h2>No visits</h2>
          <p>
            Each page sends a signal when it opens. To measure another
            application, add one line to it:
            <code>&lt;script defer src=&quot;/t.js&quot; data-site=&quot;your-app-id&quot;&gt;&lt;/script&gt;</code>
            The id must match an application in sites.json.
          </p>
        </div>
      ) : (
        <>
          <section className="kpi-row" aria-label="Traffic metrics">
            <Kpi
              label="Page views"
              value={compact(now.views)}
              delta={delta(now.views, before.views)}
              deltaSuffix={`% vs. previous ${range.label}`}
              goodDirection="up"
            />
            <Kpi
              label="Visitors"
              value={compact(now.visitors)}
              delta={delta(now.visitors, before.visitors)}
              deltaSuffix={`% vs. previous ${range.label}`}
              goodDirection="up"
            />
            <Kpi
              label="Views per visitor"
              value={viewsPerVisitor}
              footer={
                <span className="kpi__note">pages in one visit</span>
              }
            />
            <Kpi
              label="Case study views"
              value={compact(projectViews)}
              footer={<span className="kpi__note">/work/ pages</span>}
            />
          </section>

          <section className="board-hero">
            <div className="panel panel--hero">
              <div className="panel__head">
                <h2>Views over time</h2>
                <span className="panel__meta">{range.label}</span>
              </div>
              <TrafficChart points={points} />
            </div>

            <aside className="panel panel--insights" aria-label="Notes">
              <div className="panel__head">
                <h2>How I measure this</h2>
              </div>
              <ul className="insight-list">
                <li className="insight insight--good">
                  <i aria-hidden="true" />
                  I use no cookies. I store no IP address. I keep no identifier between days.
                </li>
                <li className="insight insight--good">
                  <i aria-hidden="true" />
                  I count visitors with a hash. The key stays in memory and changes
                  each day.
                </li>
                <li className="insight insight--warn">
                  <i aria-hidden="true" />
                  The browser sends the signal. This page does not count a visitor who
                  blocks scripts.
                </li>
                <li className="insight insight--good">
                  <i aria-hidden="true" />
                  Add <code>/t.js</code> to another application to measure it
                  here as well.
                </li>
              </ul>
              <div className="insight-stat">
                <span className="insight-stat__label">Most read</span>
                <span className="insight-stat__value">
                  {paths[0]?.label ?? "—"}
                  <em>{paths[0] ? `${compact(paths[0].views)} views` : ""}</em>
                </span>
              </div>
            </aside>
          </section>

          <section className="board-grid">
            <div className="panel">
              <div className="panel__head">
                <h2>Pages</h2>
                <span className="panel__meta">{range.label}</span>
              </div>
              <BreakdownList rows={paths} total={now.views} />
            </div>

            <div className="panel">
              <div className="panel__head">
                <h2>Referrers</h2>
                <span className="panel__meta">the previous site</span>
              </div>
              <BreakdownList rows={referrers} total={now.views} />
            </div>
          </section>

          {bySite.length > 1 && (
            <section className="console__section">
              <div className="console__section-head">
                <h2>Sites compared</h2>
                <span className="panel__meta">{range.label}</span>
              </div>
              <div className="panel">
                <table className="ctable">
                  <thead>
                    <tr>
                      <th>Site</th>
                      <th className="ctable__num">Views</th>
                      <th className="ctable__num">Visitors</th>
                      <th className="ctable__num">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySite.map((row) => {
                      const past = bySiteBefore.find(
                        (b) => b.siteId === row.siteId,
                      );
                      const change =
                        past && past.views > 0
                          ? ((row.views - past.views) / past.views) * 100
                          : null;
                      return (
                        <tr key={row.siteId}>
                          <td>
                            <Link
                              href={`/console/traffic?range=${rangeKey}&site=${row.siteId}`}
                              className="ctable__link"
                            >
                              {label(row.siteId)}
                            </Link>
                          </td>
                          <td className="ctable__num">{compact(row.views)}</td>
                          <td className="ctable__num">{compact(row.visitors)}</td>
                          <td className="ctable__num">
                            {change === null ? (
                              <span style={{ color: "var(--c-muted)" }}>—</span>
                            ) : (
                              <span
                                style={{
                                  color:
                                    change >= 0
                                      ? "var(--s-good)"
                                      : "var(--s-critical)",
                                }}
                              >
                                {change > 0 ? "+" : ""}
                                {Math.round(change)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <p className="console__note">
        The console keeps the traffic data for 90 days.
      </p>
    </>
  );
}
