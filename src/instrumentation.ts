/**
 * Boots the monitor poller once per server instance.
 *
 * The runtime guard matters: `register` also runs in the edge runtime, where
 * `node:sqlite` and long-lived timers do not exist. Every Node-only import is
 * therefore dynamic and gated, so none of it reaches the edge bundle.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.CONSOLE_DISABLE_POLLER === "1") {
    console.log("[monitor] poller disabled via CONSOLE_DISABLE_POLLER");
    return;
  }

  const { startPolling } = await import("@/lib/monitor/poller");
  const { installShutdownHooks } = await import("@/lib/monitor/lifecycle");

  startPolling();
  installShutdownHooks();
}
