/**
 * The event log as data. `?level=warn|error&site=<id>&limit=<n>&before=<ts>`
 *
 * `before` makes it cursor-pageable without OFFSET, which matters once the log
 * is long: OFFSET still walks every skipped row.
 */

import { eventCounts, recentEvents } from "@/lib/monitor/store";
import type { EventLevel } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rawLevel = params.get("level");
  const level: EventLevel | undefined =
    rawLevel === "warn" || rawLevel === "error" || rawLevel === "info"
      ? rawLevel
      : undefined;

  const events = recentEvents({
    limit: Number(params.get("limit")) || 100,
    minLevel: level,
    siteId: params.get("site") ?? undefined,
    before: Number(params.get("before")) || undefined,
  });

  return Response.json(
    {
      events,
      counts: eventCounts(86_400),
      // Cursor for the next page.
      nextBefore: events.length > 0 ? events[events.length - 1].ts : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
