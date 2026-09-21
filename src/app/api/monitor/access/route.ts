/**
 * Traffic derived from nginx's access logs.
 *
 * `?window=<seconds>&buckets=<n>&host=<vhost>`
 *
 * Distinct from `/api/monitor/series` (health polling) and the beacon behind
 * `/api/analytics/collect` (page views on this site). This one reports what
 * actually reached the machine, for every site nginx serves.
 */

import { accessLogStatus } from "@/lib/monitor/access-log";
import {
  accessHosts,
  accessLabels,
  accessSeries,
  accessSummaries,
  accessSummary,
} from "@/lib/monitor/store";

export const dynamic = "force-dynamic";

const MIN_WINDOW_SECONDS = 300;
const MAX_WINDOW_SECONDS = 90 * 86_400;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const windowSeconds = Math.min(
    Math.max(Number(params.get("window")) || 3600, MIN_WINDOW_SECONDS),
    MAX_WINDOW_SECONDS,
  );
  const buckets = Math.min(Math.max(Number(params.get("buckets")) || 60, 8), 480);
  const host = params.get("host") ?? undefined;

  return Response.json(
    {
      windowSeconds,
      host: host ?? null,
      hosts: accessHosts(),
      // Scoped to one vhost when asked, otherwise every site side by side.
      summary: host ? accessSummary(host, windowSeconds) : null,
      sites: host ? [] : accessSummaries(windowSeconds),
      points: accessSeries(windowSeconds, buckets, host),
      topPaths: accessLabels("path", windowSeconds, 10, host),
      topReferrers: accessLabels("referrer", windowSeconds, 10, host),
      methods: accessLabels("method", windowSeconds, 8, host),
      // Carries the reason when a log cannot be read, which otherwise looks
      // exactly like a site nobody visited.
      collector: accessLogStatus(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
