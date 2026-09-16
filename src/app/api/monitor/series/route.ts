/**
 * Bucketed time-series for the analytics charts.
 *
 * `?site=<id>&window=<seconds>&buckets=<n>`
 */

import { series, dailyUptime, uptimeSummary } from "@/lib/monitor/store";

export const dynamic = "force-dynamic";

const MAX_WINDOW_SECONDS = 400 * 86_400;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = params.get("site");

  if (!siteId) {
    return Response.json({ error: "site_required" }, { status: 400 });
  }

  // Clamp rather than reject: an absurd window should degrade to the biggest
  // sensible one, not 400 a dashboard that mis-computed a range.
  const windowSeconds = Math.min(
    Math.max(Number(params.get("window")) || 86_400, 300),
    MAX_WINDOW_SECONDS,
  );
  const buckets = Math.min(Math.max(Number(params.get("buckets")) || 48, 8), 240);

  return Response.json(
    {
      siteId,
      windowSeconds,
      points: series(siteId, windowSeconds, buckets),
      summary: uptimeSummary(siteId, windowSeconds),
      daily: dailyUptime(siteId, 90),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
