/**
 * Who is allowed to see the console's private pages.
 *
 * The console's operational boards are public on purpose — the status wall is
 * portfolio evidence. A few pages are not: `/console/integrate` documents how
 * the estate is wired together, which is a map of the infrastructure rather
 * than a report on it.
 *
 * The lock is the `CONSOLE_ADMIN_TOKEN` that already guards mutations, held in
 * a cookie so a browser can carry it. With no token configured there is
 * nothing to unlock against, and those pages stay hidden rather than falling
 * open — an unset secret should fail closed.
 */

import { cookies } from "next/headers";
import { timingSafeEqual } from "./guard";

export const SESSION_COOKIE = "console_session";

/**
 * Cookie lifetime. Long enough not to be a nuisance, short enough that a
 * borrowed laptop does not stay unlocked indefinitely.
 */
export const SESSION_MAX_AGE = 30 * 86_400;

/** Whether a token is configured at all. */
export function lockIsConfigured(): boolean {
  return Boolean(process.env.CONSOLE_ADMIN_TOKEN);
}

/** Whether the value presented matches the configured token. */
export function tokenMatches(candidate: string | undefined): boolean {
  const expected = process.env.CONSOLE_ADMIN_TOKEN;
  if (!expected || !candidate) return false;
  return timingSafeEqual(candidate, expected);
}

/**
 * Whether this request may see the private pages.
 *
 * Note the ordering: an unconfigured lock returns false. The alternative —
 * treating "no token set" as "everyone is an admin" — is how a page meant to
 * be private ends up public the moment an environment variable is forgotten.
 */
export async function consoleUnlocked(): Promise<boolean> {
  if (!lockIsConfigured()) return false;
  const jar = await cookies();
  return tokenMatches(jar.get(SESSION_COOKIE)?.value);
}
