/**
 * The door to the console's private pages.
 *
 * A server-rendered form with no client JavaScript: the console's whole point
 * is that the operational pages are cheap, and a sign-in box is the last place
 * that should need a bundle.
 */

import { consoleUnlocked, lockIsConfigured } from "@/lib/monitor/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unlock",
  // Private by definition; there is no reason for this to be indexed.
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid: "That token was not accepted.",
  unconfigured:
    "No CONSOLE_ADMIN_TOKEN is set on the server, so there is nothing to unlock against.",
};

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const unlocked = await consoleUnlocked();
  const configured = lockIsConfigured();
  const error = params.error ? ERRORS[params.error] : undefined;
  const next = params.next?.startsWith("/console") ? params.next : "/console";

  if (unlocked) {
    return (
      <>
        <div className="board-head">
          <div>
            <p className="console__eyebrow">Operations / Access</p>
            <h1>Unlocked.</h1>
          </div>
        </div>
        <div className="console__empty">
          <p>This browser can see the private pages.</p>
          {/* A form, not a link: signing out changes state, and a GET that
              changes state gets fired by every link prefetcher going. */}
          <form method="post" action="/api/console/unlock">
            <input type="hidden" name="action" value="lock" />
            <button className="console__button" type="submit">
              Lock again
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Access</p>
          <h1>Unlock.</h1>
        </div>
      </div>

      <div className="console__empty">
        <h2>Private pages</h2>
        <p>
          Most of this console is public on purpose. A few pages describe how
          the estate is put together rather than how it is doing, and those ask
          for the admin token.
        </p>

        {error && <p className="console__error">{error}</p>}

        {configured ? (
          <form method="post" action="/api/console/unlock" className="unlock-form">
            <label htmlFor="token">Admin token</label>
            <input
              id="token"
              name="token"
              type="password"
              autoComplete="current-password"
              required
            />
            <input type="hidden" name="next" value={next} />
            <button className="console__button" type="submit">
              Unlock
            </button>
          </form>
        ) : (
          <p>
            Set <code>CONSOLE_ADMIN_TOKEN</code> in the environment and restart
            to enable this.
          </p>
        )}
      </div>
    </>
  );
}
