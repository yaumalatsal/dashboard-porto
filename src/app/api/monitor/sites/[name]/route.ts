/** Remove a monitored app. History is kept — only the polling stops. */

import { removeSite } from "@/lib/monitor/config";
import { guardMutation } from "@/lib/monitor/guard";
import { reconcile } from "@/lib/monitor/poller";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const guard = guardMutation(request);
  if (!guard.ok) return guard.response;

  const { name } = await params;

  if (!removeSite(name)) {
    return Response.json({ error: "site_not_found" }, { status: 404 });
  }

  // Samples and incidents stay in SQLite deliberately: removing an app from the
  // wall should not erase the record of how it behaved while it ran.
  reconcile();

  return Response.json({ removed: name });
}
