/**
 * Exchange the admin token for a session cookie, and give it back.
 *
 * A plain form post rather than a link with `?token=`: this console tails its
 * own nginx access log, so a token in a query string would be written to disk
 * by the very feature on the next board over — and into browser history, and
 * into any referrer header the page emits.
 */

import { SESSION_COOKIE, SESSION_MAX_AGE, lockIsConfigured, tokenMatches } from "@/lib/monitor/session";

export const dynamic = "force-dynamic";

/** Only same-origin console paths, so this cannot be used as an open redirect. */
function safeReturnPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw : "";
  // A leading `//` would be parsed as a protocol-relative URL to another host.
  return value.startsWith("/console") && !value.startsWith("//")
    ? value
    : "/console";
}

function seeOther(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (cookie) headers.append("Set-Cookie", cookie);
  // 303 so the browser follows with GET rather than re-posting the token.
  return new Response(null, { status: 303, headers });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeReturnPath(form.get("next"));

  // Locking again is a state change, so it arrives as a POST like unlocking.
  // An HTML form cannot issue DELETE, and a GET that logs you out is a link
  // every prefetcher on the internet will happily follow.
  if (form.get("action") === "lock") {
    return seeOther(
      "/console",
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }

  if (!lockIsConfigured()) {
    return seeOther("/console/unlock?error=unconfigured");
  }

  const token = form.get("token");
  if (!tokenMatches(typeof token === "string" ? token : undefined)) {
    return seeOther(`/console/unlock?error=invalid&next=${encodeURIComponent(next)}`);
  }

  // Secure only over https: setting it on a plain-http deployment would make
  // the cookie silently undeliverable and the form appear to do nothing.
  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  const secure = proto === "https" ? "; Secure" : "";

  // HttpOnly: no page script has any reason to read this, and keeping it out
  // of the DOM means an XSS elsewhere cannot lift it.
  // SameSite=Lax: a cross-site form post must not arrive already unlocked.
  const cookie =
    `${SESSION_COOKIE}=${encodeURIComponent(String(token))}` +
    `; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;

  return seeOther(next, cookie);
}
