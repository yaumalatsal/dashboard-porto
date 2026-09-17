/**
 * Page-view collector.
 *
 * A route handler rather than proxy/middleware: `proxy.ts` (formerly
 * `middleware.ts`, deprecated in Next 16) may be deployed to a CDN edge and its
 * own documentation says not to rely on shared modules or globals — so it
 * cannot reach SQLite. Recording inside the page render was the other option,
 * but the homepage is incrementally regenerated and would only count a view
 * each time the cache rebuilt, not each time somebody arrived.
 *
 * Nothing identifying is stored: see lib/monitor/visitor.ts.
 */

import { recordPageView } from "@/lib/monitor/store";
import {
  clientAddress,
  isBot,
  referrerHost,
  visitorHash,
} from "@/lib/monitor/visitor";

export const dynamic = "force-dynamic";

/** Paths worth counting. Anything else is almost certainly a probe. */
const ALLOWED = /^\/(?:$|console|work\/|orrery-lab)/;

export async function POST(request: Request) {
  // 204 regardless of outcome. This endpoint is fire-and-forget from a beacon;
  // reporting failures back to the page would cost a console error on a visit
  // and change nothing for the visitor.
  try {
    const body = (await request.json()) as { path?: string; referrer?: string };
    const path = typeof body.path === "string" ? body.path : null;
    if (!path || !ALLOWED.test(path)) return new Response(null, { status: 204 });

    const userAgent = request.headers.get("user-agent") ?? "";
    if (isBot(userAgent)) return new Response(null, { status: 204 });

    recordPageView({
      path: path.split("?")[0]!,
      referrer: referrerHost(body.referrer),
      visitor: visitorHash(clientAddress(request.headers), userAgent),
    });
  } catch {
    // A malformed beacon is not worth a log line, let alone an error response.
  }

  return new Response(null, { status: 204 });
}
