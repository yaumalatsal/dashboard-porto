/**
 * Live snapshot of every configured app. This is the endpoint the console
 * polls, and the one an external status page or uptime bot would consume.
 */

import { currentSnapshots } from "@/lib/monitor/poller";
import { uptimeSummary } from "@/lib/monitor/store";

// Always fresh: a cached status page is a lie.
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshots = currentSnapshots();

  const sites = snapshots.map((snapshot) => ({
    ...snapshot,
    uptime24h: uptimeSummary(snapshot.id, 86_400),
  }));

  return Response.json(
    { generatedAt: new Date().toISOString(), sites },
    { headers: { "Cache-Control": "no-store" } },
  );
}
