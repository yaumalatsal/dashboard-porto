/**
 * The event log.
 *
 * Reads as a log, not a data grid: one line per thing that happened, newest
 * first, with the severity legible as a word and a shape rather than a colour
 * alone. Filters are links, not client state, so a filtered view is a URL you
 * can keep open on a second monitor.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { eventCounts, recentEvents } from "@/lib/monitor/store";
import { formatRelative } from "@/lib/monitor/format";
import type { EventLevel } from "@/lib/monitor/types";
import AutoRefresh from "@/components/console/AutoRefresh";
import LogFilters from "@/components/console/LogFilters";

export const dynamic = "force-dynamic";

const LEVEL_WORD: Record<EventLevel, string> = {
  info: "Info",
  warn: "Warning",
  error: "Error",
};

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; site?: string }>;
}) {
  const params = await searchParams;
  const { sites } = loadConfig();

  const level =
    params.level === "warn" || params.level === "error" ? params.level : undefined;
  const siteId = params.site && params.site !== "all" ? params.site : undefined;

  const events = recentEvents({
    limit: 200,
    // "warn" means warnings *and* errors — the usual intent of a severity
    // filter is a floor, not an exact match.
    minLevel: level,
    siteId,
  });
  const counts = eventCounts(86_400);
  const label = (id: string | null) =>
    id ? (sites.find((s) => s.id === id)?.label ?? id) : "System";

  return (
    <>
      <AutoRefresh seconds={30} />

      <p className="console__eyebrow">Operations / Log</p>
      <h1>What happened.</h1>
      <p className="console__lede">
        Status changes, probe failures and recoveries, newest first. Only
        transitions are recorded — a poll that found everything unchanged does
        not get a line, so this stays readable.
      </p>

      <div className="log-summary">
        <span className="log-summary__item">
          <b>{counts.error}</b> errors
        </span>
        <span className="log-summary__item">
          <b>{counts.warn}</b> warnings
        </span>
        <span className="log-summary__item">
          <b>{counts.info}</b> info
        </span>
        <span className="log-summary__note">last 24 hours</span>
      </div>

      <LogFilters
        level={level ?? "all"}
        site={siteId ?? "all"}
        sites={sites.map((s) => ({ id: s.id, label: s.label }))}
      />

      {events.length === 0 ? (
        <div className="console__empty" style={{ marginTop: "1.5rem" }}>
          <h2>Nothing logged yet</h2>
          <p>
            {level || siteId
              ? "No events match this filter. Try widening it."
              : "No status changes or probe failures have been recorded. This page fills itself in when something happens."}
          </p>
        </div>
      ) : (
        <div className="log-table" role="table" aria-label="Event log">
          <div className="log-row log-row--head" role="row">
            <span role="columnheader">Time</span>
            <span role="columnheader">Level</span>
            <span role="columnheader">Application</span>
            <span role="columnheader">Event</span>
          </div>

          {events.map((event) => (
            <div key={event.id} className={`log-row log-row--${event.level}`} role="row">
              <span className="log-row__time" role="cell">
                <time dateTime={new Date(event.ts).toISOString()}>
                  {new Date(event.ts).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <em>{formatRelative(event.ts)}</em>
              </span>

              {/* Shape + word, never colour alone. */}
              <span className={`log-level log-level--${event.level}`} role="cell">
                <i aria-hidden="true" />
                {LEVEL_WORD[event.level]}
              </span>

              <span className="log-row__site" role="cell">
                {event.siteId ? (
                  <Link href={`/console/${event.siteId}`}>{label(event.siteId)}</Link>
                ) : (
                  <span style={{ color: "var(--c-muted)" }}>System</span>
                )}
              </span>

              <span className="log-row__message" role="cell">
                {event.message}
                {event.detail && <em>{event.detail}</em>}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="console__note">
        Showing up to 200 entries. Retained for the same 90 days as the
        time-series.
      </p>
    </>
  );
}
