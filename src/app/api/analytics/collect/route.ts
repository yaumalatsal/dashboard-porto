/**
 * Page-view collector for this site and for every other site that includes
 * `/t.js`.
 *
 * A route handler rather than proxy/middleware: `proxy.ts` (formerly
 * `middleware.ts`, deprecated in Next 16) may be deployed to a CDN edge and its
 * own documentation says not to rely on shared modules or globals — so it
 * cannot reach SQLite. Recording inside the page render was the other option,
 * but the homepage is incrementally regenerated and would count cache rebuilds
 * rather than arrivals.
 *
 * Nothing identifying is stored: see lib/monitor/visitor.ts.
 */

import { loadConfig } from "@/lib/monitor/config";
import { recordPageView, SELF_SITE_ID } from "@/lib/monitor/store";
import {
  clientAddress,
  isBot,
  referrerHost,
  visitorHash,
} from "@/lib/monitor/visitor";

export const dynamic = "force-dynamic";

/** Paths of this site that are worth counting. */
const SELF_PATHS = /^\/(?:$|console|work\/|orrery-lab)/;

/**
 * Cross-origin, because the other applications post from their own domains.
 *
 * The body is sent as text/plain, which keeps it a simple request and avoids a
 * preflight. Credentials are never involved, so `*` is the correct origin here
 * and no cookie can ride along with the report.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  // 204 whatever happens. A beacon cannot act on an error, and reporting one
  // would put a console message on somebody else's site.
  try {
    // sendBeacon sends text/plain, so the body is read as text and parsed here
    // rather than with request.json().
    const raw = await request.text();
    const body = JSON.parse(raw) as {
      site?: string;
      path?: string;
      referrer?: string;
    };

    const path = typeof body.path === "string" ? body.path : null;
    if (!path) return new Response(null, { status: 204, headers: CORS });

    /**
     * The site must already be known.
     *
     * Without this the endpoint is an open table: anyone who reads /t.js could
     * post rows under any name they invented, and the traffic page would fill
     * with sites that do not exist.
     */
    let siteId = SELF_SITE_ID;
    if (body.site && body.site !== SELF_SITE_ID) {
      const known = loadConfig().sites.some((s) => s.id === body.site);
      if (!known) return new Response(null, { status: 204, headers: CORS });
      siteId = body.site;
    } else if (!SELF_PATHS.test(path)) {
      // This site's own beacon only reports its real pages.
      return new Response(null, { status: 204, headers: CORS });
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    if (isBot(userAgent)) return new Response(null, { status: 204, headers: CORS });

    recordPageView({
      siteId,
      path: path.split("?")[0]!.slice(0, 512),
      referrer: referrerHost(body.referrer),
      visitor: visitorHash(clientAddress(request.headers), userAgent),
    });
  } catch {
    // A malformed beacon is not worth a log line, let alone an error response.
  }

  return new Response(null, { status: 204, headers: CORS });
}
