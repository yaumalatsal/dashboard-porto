/** Fleet-wide incident record, newest first. */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { recentIncidents } from "@/lib/monitor/store";
import {
  formatDuration,
  formatRelative,
  formatSince,
  HEALTH_LABEL,
} from "@/lib/monitor/format";
import Status from "@/components/console/Status";
import AutoRefresh from "@/components/console/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const { sites } = loadConfig();
  const incidents = recentIncidents(100);
  const label = (id: string) => sites.find((s) => s.id === id)?.label ?? id;

  const open = incidents.filter((i) => i.endedAt === null);
  const resolved = incidents.filter((i) => i.endedAt !== null);

  return (
    <>
      <AutoRefresh seconds={60} />

      <p className="console__eyebrow">Operations / Incidents</p>
      <h1>Incident record.</h1>
      <p className="console__lede">
        Every period an application spent degraded or down, derived from the
        health samples as they arrive.
      </p>

      {incidents.length === 0 ? (
        <div className="console__empty">
          <h2>No incidents recorded</h2>
          <p>
            Nothing has gone degraded or down since monitoring began. This page
            fills itself in when something does.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className="console__section">
              <div className="console__section-head">
                <h2>Ongoing</h2>
              </div>
              <div className="metric-group">
                {open.map((incident) => (
                  <div key={incident.id} className="incident">
                    <Status health={incident.worst} showLabel={false} />
                    <span>
                      <Link
                        href={`/console/${incident.siteId}`}
                        className="incident__site"
                        style={{ color: "var(--c-ink)" }}
                      >
                        {label(incident.siteId)}
                      </Link>{" "}
                      <span style={{ color: "var(--c-muted)" }}>
                        {HEALTH_LABEL[incident.worst].toLowerCase()} for{" "}
                        {formatSince(incident.startedAt)}
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

          <section className="console__section">
            <div className="console__section-head">
              <h2>Resolved</h2>
              <span style={{ fontSize: "0.72rem", color: "var(--c-muted)" }}>
                {resolved.length} recorded
              </span>
            </div>
            <div className="ctable__wrap">
              <table className="ctable">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Severity</th>
                    <th>Started</th>
                    <th className="ctable__num">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((incident) => (
                    <tr key={incident.id}>
                      <td>
                        <Link
                          href={`/console/${incident.siteId}`}
                          style={{ color: "var(--c-ink)", fontWeight: 600 }}
                        >
                          {label(incident.siteId)}
                        </Link>
                      </td>
                      <td>
                        <Status health={incident.worst} />
                      </td>
                      <td style={{ color: "var(--c-muted)" }}>
                        {new Date(incident.startedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="ctable__num">
                        {formatDuration(
                          (incident.endedAt! - incident.startedAt) / 1000,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
