/** Incident feed, newest first. `?site=<id>&limit=<n>` */

import { recentIncidents } from "@/lib/monitor/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const siteId = params.get("site") ?? undefined;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 200);

  return Response.json(
    { incidents: recentIncidents(limit, siteId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
