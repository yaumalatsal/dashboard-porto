/**
 * Node-only process lifecycle wiring.
 *
 * Kept in its own module because `instrumentation.ts` is compiled for the edge
 * runtime as well as Node. Even behind a runtime guard, a bare `process.once`
 * in that file trips the edge analyzer — isolating it here means the edge
 * bundle never contains the call at all.
 */

import { stopPolling } from "./poller";
import { closeDb } from "./store";

let installed = false;

export function installShutdownHooks(): void {
  if (installed) return;
  installed = true;

  const shutdown = () => {
    stopPolling();
    try {
      // Flushes SQLite's WAL so a redeploy never loses the last window.
      closeDb();
    } catch {
      // Already closed, or never opened — nothing to salvage either way.
    }
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}
