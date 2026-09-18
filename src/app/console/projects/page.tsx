/**
 * A dashboard for every project, and an honest account of what each one shows.
 *
 * The seven projects do not permit the same measurement. Five run inside the
 * network of a client, so the console cannot probe them. The page groups the
 * cards by that fact rather than hiding it in small print: a visitor sees
 * which systems are open, which are private, and why.
 *
 * Reading path: scope, then four figures, then the groups, then the note.
 */

import Link from "next/link";
import { projectCards } from "@/lib/monitor/projects";
import { compact, formatUptime } from "@/lib/monitor/format";
import { ACCESS, type ProjectAccess } from "@/data/portfolio";
import AutoRefresh from "@/components/console/AutoRefresh";
import Kpi from "@/components/console/Kpi";
import Status from "@/components/console/Status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project dashboards",
  description:
    "One dashboard for each project, with the live measurement where the system permits it.",
};

/** Open systems first: the visitor reads the measurable ones before the rest. */
const ORDER: ProjectAccess[] = [
  "public",
  "client-network",
  "not-deployed",
  "no-endpoint",
];

const GROUP_NOTE: Record<ProjectAccess, string> = {
  public: "The console probes these systems. The figures are measurements.",
  "client-network":
    "The client owns these systems and runs them privately. I show the engineering record, not live data.",
  "not-deployed": "I built these systems. No public instance runs at this time.",
  "no-endpoint": "These projects are not web services, so nothing can probe them.",
};

export default async function ProjectsPage() {
  const cards = projectCards();

  const live = cards.filter((c) => c.health !== null);
  const totalStudyViews = cards.reduce((sum, c) => sum + c.studyViews, 0);
  const mostRead = [...cards].sort((a, b) => b.studyViews - a.studyViews)[0];

  const grouped = ORDER.map((access) => ({
    access,
    note: GROUP_NOTE[access],
    rows: cards.filter((c) => c.project.monitor.access === access),
  })).filter((group) => group.rows.length > 0);

  return (
    <>
      <AutoRefresh seconds={60} />

      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Projects</p>
          <h1>A dashboard for each project.</h1>
        </div>
      </div>

      <p className="console__lede">
        Each project below has its own page. Where I own the system and the
        internet reaches it, the page shows the live measurement. Where the
        client owns the system, the page shows the engineering record and says
        so. No figure on these pages is an estimate.
      </p>

      <section className="kpi-row" aria-label="Project totals">
        <Kpi label="Projects" value={cards.length} />
        <Kpi
          label="Measured live"
          value={live.length}
          footer={
            <span className="kpi__note">
              {cards.length - live.length} run privately
            </span>
          }
        />
        <Kpi
          label="Case study readers"
          value={compact(totalStudyViews)}
          footer={<span className="kpi__note">30 days, all projects</span>}
        />
        <Kpi
          label="Most read"
          value={mostRead && mostRead.studyViews > 0 ? mostRead.project.number : "—"}
          footer={
            <span className="kpi__note">
              {mostRead && mostRead.studyViews > 0
                ? mostRead.project.title
                : "no reads yet"}
            </span>
          }
        />
      </section>

      {grouped.map((group) => (
        <section key={group.access} className="console__section">
          <div className="console__section-head">
            <h2>{ACCESS[group.access].label}</h2>
            <span className="panel__meta">{group.rows.length} of {cards.length}</span>
          </div>
          <p className="console__note" style={{ marginTop: 0 }}>{group.note}</p>

          <div className="project-grid">
            {group.rows.map(({ project, access, health, upRatio, studyViews }) => (
              <Link
                key={project.slug}
                href={`/console/projects/${project.slug}`}
                className="project-card"
              >
                <div className="project-card__top">
                  <span className="project-card__number">{project.number}</span>
                  <span className={`access-badge access-badge--${access.tone}`}>
                    {access.label}
                  </span>
                </div>

                <h3 className="project-card__name">{project.title}</h3>
                <p className="project-card__blurb">{project.description}</p>

                <dl className="project-card__stats">
                  <div>
                    <dt>Client</dt>
                    <dd>{project.client}</dd>
                  </div>
                  <div>
                    <dt>Readers / 30d</dt>
                    <dd>{studyViews > 0 ? compact(studyViews) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Uptime / 30d</dt>
                    <dd>{upRatio !== null ? formatUptime(upRatio) : "not measured"}</dd>
                  </div>
                </dl>

                <div className="project-card__foot">
                  {health !== null ? (
                    <Status health={health} />
                  ) : (
                    <span className="project-card__stack">
                      {project.techStack.slice(0, 3).join(" · ")}
                    </span>
                  )}
                  <span className="project-card__go" aria-hidden="true">
                    Open →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="console__note">
        A private system stays private. To show live figures for one of them, the
        client must give me a public health endpoint. I then add it to the
        registry and this page changes without a code change.
      </p>
    </>
  );
}
