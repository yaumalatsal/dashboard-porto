/**
 * One project, and everything the console can honestly say about it.
 *
 * The hero chart is always a measurement, never an assertion. For a system I
 * run in the open that is its response time; for a system that runs inside the
 * network of a client it is how many people read the case study on this site.
 * Both are real. Nothing on this page is estimated or filled in.
 *
 * The delivery record — scope, architecture, stack — sits below the measured
 * part and is labelled as reported, so a reader never has to guess which
 * figures came from a probe and which came from me.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { projects, stated } from "@/data/portfolio";
import { projectBySlug, projectDashboard } from "@/lib/monitor/projects";
import {
  compact,
  formatDuration,
  formatMetric,
  formatRelative,
  formatUptime,
  metricLevel,
  HEALTH_LABEL,
} from "@/lib/monitor/format";
import type { Metric } from "@/lib/monitor/types";
import AutoRefresh from "@/components/console/AutoRefresh";
import Kpi from "@/components/console/Kpi";
import Status from "@/components/console/Status";
import LatencyChart from "@/components/console/LatencyChart";
import TrafficChart from "@/components/console/TrafficChart";
import UptimeStrip from "@/components/console/UptimeStrip";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.title} — dashboard`,
    description: project.description,
  };
}

/** Vector files break the image optimiser, so they pass through raw. */
const isVector = (src: string) => src.endsWith(".svg");

export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  const { access, live, awaitingRegistry, reach } = projectDashboard(project);

  const index = projects.findIndex((p) => p.slug === slug);
  const next = projects[(index + 1) % projects.length];

  const delta = (now: number, before: number) =>
    before > 0 ? ((now - before) / before) * 100 : null;

  // Group the adapter's metrics the way the application itself grouped them.
  const groups = new Map<string, Metric[]>();
  for (const metric of live?.metrics ?? []) {
    const key = metric.group ?? "General";
    const bucket = groups.get(key);
    if (bucket) bucket.push(metric);
    else groups.set(key, [metric]);
  }

  /**
   * Split the application's own metric groups into subject and substrate.
   *
   * "Permits awaiting approval" is what the system is for; "PHP 8.4.25" is
   * what it happens to run on. A reader deciding whether this person can build
   * the dashboard they need cares about the first and skims the second, so the
   * two are rendered separately rather than interleaved in adapter order.
   */
  const RUNTIME_GROUPS = ["runtime", "app", "system", "server"];
  const isRuntime = (group: string) =>
    RUNTIME_GROUPS.includes(group.trim().toLowerCase());

  const domainGroups = [...groups.entries()].filter(([g]) => !isRuntime(g));
  const runtimeGroups = [...groups.entries()].filter(([g]) => isRuntime(g));

  const hasStudyTraffic = reach.studyViews.views > 0;

  /**
   * Three grades of evidence, and the page picks the strongest one it holds.
   *
   * A probe is the strongest: it says how the system behaves. Traffic on the
   * project's own site is next: it says the system is used. Reader traffic on
   * the case study is the floor, and every project has it.
   *
   * This matters for the console itself, which is public but has no probe —
   * it cannot usefully poll the process that does the polling. Without this
   * split its dashboard claimed "no probe is possible" beside a badge that
   * said "Public", which is two contradictory statements about one system.
   */
  const siteTraffic =
    reach.siteViews && reach.siteViews.views > 0 ? reach.siteViews : null;
  const evidence: "probe" | "site-traffic" | "readers" = live
    ? "probe"
    : siteTraffic
      ? "site-traffic"
      : "readers";

  return (
    <>
      {live && <AutoRefresh seconds={30} />}

      {/* 1 — Context */}
      <p className="console__eyebrow">
        <Link href="/console/projects" style={{ color: "inherit" }}>
          Projects
        </Link>
        {" / "}
        {project.number}
      </p>

      <div className="board-head board-head--project">
        <div>
          <h1 style={{ margin: 0 }}>{project.title}</h1>
          <p className="console__lede" style={{ marginTop: "0.6rem" }}>
            {project.description}
          </p>
        </div>
        <div className="board-head__actions">
          <span className={`access-badge access-badge--${access.tone}`}>
            {access.label}
          </span>
          {/* The whole point of the page for someone judging the work: get
              them into the running system in one click, from the top, rather
              than after scrolling past the charts. */}
          {live?.url && (
            <a
              className="open-live"
              href={live.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open the live system ↗
            </a>
          )}
        </div>
      </div>

      {project.monitor.demo && (
        <div className="demo-key">
          <span className="demo-key__tag">Sign in and look around</span>
          <dl>
            <div>
              <dt>{project.monitor.demo.label}</dt>
              <dd>
                <code>{project.monitor.demo.username}</code>
              </dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>
                <code>{project.monitor.demo.password}</code>
              </dd>
            </div>
          </dl>
          <p>
            A read-only account on the public instance. It holds demonstration
            data, not the data of any client.
          </p>
        </div>
      )}

      <dl className="project-meta">
        <div>
          <dt>Client</dt>
          <dd>{project.client}</dd>
        </div>
        <div>
          <dt>Year</dt>
          <dd>{stated(project.year)}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{project.role}</dd>
        </div>
        <div>
          <dt>Field</dt>
          <dd>{project.category}</dd>
        </div>
      </dl>

      {/* Private ownership is a fact, not a fault, so this line never wears
          the warning colour. Only the broken promise below does. */}
      <p className="access-note">
        {access.meaning} {project.monitor.note}
      </p>

      {awaitingRegistry && (
        <p className="access-note access-note--warn">
          This project names the application <code>{project.monitor.siteId}</code>
          , but <code>sites.json</code> does not hold it. Add the application to
          the registry and the live panels appear here.
        </p>
      )}

      {/* 2 — Summary. Measured figures first; stated facts are marked. */}
      <section className="kpi-row" aria-label="Project figures">
        <Kpi
          label="Case study readers"
          value={hasStudyTraffic ? compact(reach.studyViews.views) : "—"}
          delta={delta(reach.studyViews.views, reach.previousStudyViews.views)}
          deltaSuffix="% vs. previous 30 days"
          goodDirection="up"
          footer={<span className="kpi__note">30 days, measured</span>}
        />
        <Kpi
          label="Unique readers"
          value={hasStudyTraffic ? compact(reach.studyViews.visitors) : "—"}
          footer={<span className="kpi__note">30 days, measured</span>}
        />

        {live ? (
          <>
            <Kpi
              label="Uptime / 30d"
              value={
                live.month.samples > 0 ? formatUptime(live.month.upRatio) : "—"
              }
              footer={
                <span className="kpi__note">
                  {live.month.samples.toLocaleString("en-US")} checks
                </span>
              }
            />
            <Kpi
              label="p95 response / 24h"
              value={
                live.day.latencyP95 !== null ? `${live.day.latencyP95} ms` : "—"
              }
              delta={
                live.day.latencyP95 !== null &&
                live.previousDay.latencyP95 !== null
                  ? live.day.latencyP95 - live.previousDay.latencyP95
                  : null
              }
              deltaSuffix=" ms vs. yesterday"
              goodDirection="down"
            />
          </>
        ) : siteTraffic ? (
          <>
            <Kpi
              label="Page views"
              value={compact(siteTraffic.views)}
              delta={
                reach.previousSiteViews
                  ? delta(siteTraffic.views, reach.previousSiteViews.views)
                  : null
              }
              deltaSuffix="% vs. previous 30 days"
              goodDirection="up"
              footer={<span className="kpi__note">the whole system, measured</span>}
            />
            <Kpi
              label="Visitors"
              value={compact(siteTraffic.visitors)}
              footer={<span className="kpi__note">30 days, measured</span>}
            />
          </>
        ) : (
          <>
            <Kpi
              label="Live monitoring"
              value={access.label}
              footer={
                <span className="kpi__note">
                  {project.monitor.access === "public"
                    ? "no probe is set up yet"
                    : "no probe is possible"}
                </span>
              }
            />
            <Kpi
              label="Delivered"
              value={stated(project.year)}
              footer={<span className="kpi__note">stated, not measured</span>}
            />
          </>
        )}
      </section>

      {/* 3 — Hero. Always a measurement. */}
      <section className="board-hero">
        <div className="panel panel--hero">
          <div className="panel__head">
            <h2>
              {evidence === "probe"
                ? "Response time"
                : evidence === "site-traffic"
                  ? "Use of the system"
                  : "Readers of this case study"}
            </h2>
            <span className="panel__meta">
              {evidence === "probe" ? "24 hours" : "30 days"}
            </span>
          </div>
          {live ? (
            <LatencyChart points={live.points} />
          ) : siteTraffic ? (
            <TrafficChart points={reach.sitePoints} />
          ) : hasStudyTraffic ? (
            <TrafficChart points={reach.studyPoints} />
          ) : (
            <p className="panel__empty">
              Nobody has opened this case study yet. The chart starts at the
              first visit.
            </p>
          )}
        </div>

        <aside className="panel panel--insights" aria-label="What this shows">
          <div className="panel__head">
            <h2>{live ? "State now" : "What I did"}</h2>
          </div>

          {live ? (
            <>
              <ul className="insight-list">
                <li
                  className={`insight insight--${
                    live.health === "operational"
                      ? "good"
                      : live.health === "unknown"
                        ? "warn"
                        : "critical"
                  }`}
                >
                  <i aria-hidden="true" />
                  The application is {HEALTH_LABEL[live.health].toLowerCase()}.
                  {live.latencyMs !== null &&
                    ` It replied in ${live.latencyMs} ms.`}
                </li>
                <li
                  className={`insight insight--${
                    live.stats.count === 0 ? "good" : "warn"
                  }`}
                >
                  <i aria-hidden="true" />
                  {live.stats.count === 0
                    ? "The console recorded no fault in 30 days."
                    : `The console recorded ${live.stats.count} fault${
                        live.stats.count === 1 ? "" : "s"
                      } in 30 days.`}
                </li>
                {live.stats.mttrSeconds !== null && (
                  <li className="insight insight--warn">
                    <i aria-hidden="true" />
                    A fault lasts {formatDuration(live.stats.mttrSeconds)} on
                    average before the application recovers.
                  </li>
                )}
                {live.notes.map((note) => (
                  <li key={note} className="insight insight--warn">
                    <i aria-hidden="true" />
                    Monitoring: {note}
                  </li>
                ))}
              </ul>
              {live.checkedAt && (
                <div className="insight-stat">
                  <span className="insight-stat__label">Last check</span>
                  <span className="insight-stat__value">
                    {formatRelative(new Date(live.checkedAt).getTime())}
                  </span>
                </div>
              )}
            </>
          ) : (
            <ul className="insight-list">
              <li className="insight insight--warn">
                <i aria-hidden="true" />
                {project.observation}
              </li>
              <li className="insight insight--good">
                <i aria-hidden="true" />
                {project.response}
              </li>
              <li className="insight insight--good">
                <i aria-hidden="true" />
                {project.result}
              </li>
            </ul>
          )}
        </aside>
      </section>

      {/* What the system is for. Placed directly under the hero because for a
          reader judging the work, this is the work -- the numbers this
          dashboard exists to put in front of someone. */}
      {domainGroups.length > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>What this dashboard tracks</h2>
            <span className="panel__meta">live, from the application itself</span>
          </div>
          <div className="chart-grid">
            {domainGroups.map(([group, metrics]) => (
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

      {/* 4 — Drilldown. The live panels exist only when there is live data. */}
      {live && (
        <>
          <section className="console__section">
            <div className="console__section-head">
              <h2>Uptime / 90 days</h2>
              <span className="panel__meta">one block for each day</span>
            </div>
            <div className="chart">
              <UptimeStrip days={live.daily} />
            </div>
          </section>

          {live.services.length > 0 && (
            <section className="console__section">
              <div className="console__section-head">
                <h2>Services</h2>
                <span className="panel__meta">reported by the application</span>
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
                    {live.services.map((service) => (
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


          {runtimeGroups.length > 0 && (
            <section className="console__section">
              <div className="console__section-head">
                <h2>Runtime</h2>
                <span className="panel__meta">what it runs on</span>
              </div>
              <div className="chart-grid">
                {runtimeGroups.map(([group, metrics]) => (
                  <div key={group} className="metric-group">
                    <h3>{group}</h3>
                    {metrics.map((metric) => (
                      <div key={metric.key} className="metric-row">
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

          {live.incidents.length > 0 && (
            <section className="console__section">
              <div className="console__section-head">
                <h2>Fault record</h2>
                <span className="panel__meta">derived from the samples</span>
              </div>
              <div className="metric-group">
                {live.incidents.map((incident) => (
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
                          ? ` — recovered after ${formatDuration(
                              (incident.endedAt - incident.startedAt) / 1000,
                            )}`
                          : " — open now"}
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

        </>
      )}

      {/* Reader traffic, unless it is already the hero above. */}
      {hasStudyTraffic && evidence !== "readers" && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>Readers of this case study</h2>
            <span className="panel__meta">30 days</span>
          </div>
          <div className="chart">
            <TrafficChart points={reach.studyPoints} />
          </div>
        </section>
      )}

      {/* The delivery record. Stated by me, and labelled as such. */}
      <section className="console__section">
        <div className="console__section-head">
          <h2>Delivery record</h2>
          <span className="panel__meta">reported by me, not measured</span>
        </div>

        <div className="board-grid">
          <div className="panel">
            <div className="panel__head">
              <h2>Scope</h2>
            </div>
            <div className="metric-group">
              {project.metrics.map((metric) => (
                <div key={metric.label} className="metric-row">
                  <span className="metric-row__label">{metric.label}</span>
                  <span className="metric-row__value">
                    {stated(metric.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Stack</h2>
            </div>
            <ul className="stack-list">
              {project.techStack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel" style={{ marginTop: "1rem" }}>
          <div className="panel__head">
            <h2>System notes</h2>
          </div>
          <ul className="insight-list">
            {project.architecture.map((item) => (
              <li key={item} className="insight insight--good">
                <i aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {project.images.length > 0 && (
        <section className="console__section">
          <div className="console__section-head">
            <h2>The system</h2>
          </div>
          <div className="project-shots">
            {project.images.map((src) => (
              <figure key={src} className="project-shot">
                <Image
                  src={src}
                  alt={`A screen from ${project.title}`}
                  width={1200}
                  height={760}
                  sizes="(max-width: 900px) 100vw, 46vw"
                  unoptimized={isVector(src)}
                />
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* 5 — Action */}
      <section className="console__section">
        <div className="console__section-head">
          <h2>Go on</h2>
        </div>
        <div className="project-actions">
          <Link className="project-action" href={`/work/${project.slug}`}>
            <span>Read the case study</span>
            <em>The full account of the work</em>
          </Link>
          {/* The project's own dashboard, when it has one and it is public. */}
          {project.monitor.dashboardUrl &&
            (project.monitor.dashboardUrl.startsWith("/") ? (
              <Link
                className="project-action"
                href={project.monitor.dashboardUrl}
              >
                <span>Open its own dashboard</span>
                <em>The dashboard this project provides</em>
              </Link>
            ) : (
              <a
                className="project-action"
                href={project.monitor.dashboardUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <span>Open its own dashboard ↗</span>
                <em>The dashboard this project provides</em>
              </a>
            ))}
          {live?.url && (
            <a
              className="project-action"
              href={live.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              <span>Open the system ↗</span>
              <em>The live application</em>
            </a>
          )}
          {live && (
            <Link className="project-action" href={`/console/${live.siteId}`}>
              <span>Infrastructure view</span>
              <em>Probes, services and raw metrics</em>
            </Link>
          )}
          <Link className="project-action" href={`/console/projects/${next.slug}`}>
            <span>Next project</span>
            <em>{next.title}</em>
          </Link>
        </div>
      </section>
    </>
  );
}
