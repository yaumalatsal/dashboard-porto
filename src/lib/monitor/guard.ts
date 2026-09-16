/**
 * Mutation guard for the console's write endpoints.
 *
 * Reads are fully public by design — the status wall doubles as portfolio
 * evidence. Writes are open too *unless* `CONSOLE_ADMIN_TOKEN` is set, at which
 * point they require `X-Console-Token`. Setting that one env var is the whole
 * opt-in; nothing else changes.
 *
 * Leaving it unset means anyone who finds the URL can add or delete monitored
 * apps, and can point the poller at arbitrary URLs (SSRF). That is a deliberate
 * configuration choice, not an oversight.
 */

export type GuardResult = { ok: true } | { ok: false; response: Response };

export function guardMutation(request: Request): GuardResult {
  const expected = process.env.CONSOLE_ADMIN_TOKEN;
  if (!expected) return { ok: true };

  const provided = request.headers.get("x-console-token");
  if (provided && timingSafeEqual(provided, expected)) return { ok: true };

  return {
    ok: false,
    response: Response.json(
      { error: "unauthorized", hint: "send X-Console-Token" },
      { status: 401 },
    ),
  };
}

/** Constant-time compare so the token cannot be guessed a character at a time. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Whether writes currently require a token — surfaced in the console UI. */
export function mutationsAreProtected(): boolean {
  return Boolean(process.env.CONSOLE_ADMIN_TOKEN);
}
