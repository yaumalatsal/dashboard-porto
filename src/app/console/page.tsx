/**
 * Console overview — the status wall.
 *
 * A server component: it reads SQLite and the poller's in-memory state directly
 * at render time, so the first paint is already the real data. No client fetch,
 * no loading spinner, no hydration cost for the numbers.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { currentSnapshots } from "@/lib/monitor/poller";
import { dailyUptime, recentIncidents, uptimeSummary } from "@/lib/monitor/store";
import { formatRelative, formatUptime, HEALTH_LABEL } from "@/lib/monitor/format";
import { worstHealth } from "@/lib/monitor/types";
import Status from "@/components/console/Status";
import UptimeStrip from "@/components/console/UptimeStrip";
import AutoRefresh from "@/components/console/AutoRefresh";
import EmptyState from "@/components/console/EmptyState";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const { sites } = loadConfig();

  if (sites.length === 0) return <EmptyState />;

  const snapshots = currentSnapshots().filter((s) => {
    const config = sites.find((site) => site.id === s.id);
    return !config?.hidden;
  });

  const cards = snapshots.map((snapshot) => ({
    snapshot,
    config: sites.find((site) => site.id === snapshot.id),
    uptime30d: uptimeSummary(snapshot.id, 30 * 86_400),
    daily: dailyUptime(snapshot.id, 90),
  }));

  const overall = worstHealth(snapshots.map((s) => s.health));
  const operational = snapshots.filter((s) => s.health === "operational").length;

  // The fleet figure weights every app equally rather than by sample count, so
  // one chatty service cannot flatter the headline.
  const observed = cards.filter((c) => c.uptime30d.samples > 0);
  const fleetUptime =
    observed.length > 0
      ? observed.reduce((sum, c) => sum + c.uptime30d.upRatio, 0) / observed.length
      : null;

  const openIncidents = recentIncidents(50).filter((i) => i.endedAt === null);

  return (
    <>
      <AutoRefresh seconds={30} />

      <p className="console__eyebrow">Operations / Live</p>
      <h1>Everything I run, in one place.</h1>
      <p className="console__lede">
        Health, response time and uptime for the applications currently in
        production — polled continuously and recorded, so the history survives
        restarts and redeploys.
      </p>

      <section className="hero-figure">
        <div>
          <div className="hero-figure__value">
            {fleetUptime !== null ? formatUptime(fleetUptime) : "—"}
          </div>
          <div className="hero-figure__label">Fleet uptime / 30 days</div>
        </div>

        <div className="hero-figure__aside">
          <div>
            <div className="tile__value">
              {operational}/{snapshots.length}
            </div>
            <div className="hero-figure__label">Operational</div>
          </div>
          <div>
            <div className="tile__value">
              <Status health={overall} />
            </div>
            <div className="hero-figure__label">Fleet status</div>
          </div>
          <div>
            <div className="tile__value">{openIncidents.length}</div>
            <div className="hero-figure__label">Open incidents</div>
          </div>
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>Applications</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>
            90-day uptime strip
          </span>
        </div>

        <div className="wall">
          {cards.map(({ snapshot, config, uptime30d, daily }) => (
            <Link
              key={snapshot.id}
              href={`/console/${snapshot.id}`}
              className="app-card"
            >
              <div className="app-card__top">
                <span className="app-card__name">{snapshot.label}</span>
                <Status health={snapshot.health} />
              </div>

              <div className="app-card__blurb">
                {config?.blurb ?? config?.url ?? "Monitored service"}
              </div>

              <UptimeStrip days={daily} />

              <div className="app-card__foot">
                <span>
                  <b>
                    {uptime30d.samples > 0
                      ? formatUptime(uptime30d.upRatio)
                      : "—"}
                  </b>{" "}
                  30d
                </span>
                <span>
                  <b>
                    {uptime30d.latencyP95 !== null
                      ? `${uptime30d.latencyP95} ms`
                      : "—"}
                  </b>{" "}
                  p95
                </span>
                <span>
                  {snapshot.latencyMs !== null ? `${snapshot.latencyMs} ms now` : "no response"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {openIncidents.length > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>Open incidents</h2>
          </div>
          <div className="metric-group">
            {openIncidents.map((incident) => (
              <div key={incident.id} className="incident">
                <Status health={incident.worst} showLabel={false} />
                <span>
                  <span className="incident__site">
                    {sites.find((s) => s.id === incident.siteId)?.label ??
                      incident.siteId}
                  </span>{" "}
                  <span style={{ color: "var(--c-muted)" }}>
                    {HEALTH_LABEL[incident.worst].toLowerCase()} since{" "}
                    {new Date(incident.startedAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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

      <p className="console__note">
        Health polled every 30s · services every 60s · metrics every 5 min.
        History retained for 90 days.
      </p>
    </>
  );
}
