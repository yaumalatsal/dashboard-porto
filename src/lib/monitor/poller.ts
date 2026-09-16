/**
 * The polling loop.
 *
 * One process-wide singleton, started from `instrumentation.ts`. Each probe
 * keeps its own cadence (health 30s, services 60s, metrics 5min) so a slow,
 * expensive metrics endpoint never throttles the fast health check that drives
 * uptime accuracy.
 *
 * Only the health probe writes a sample: uptime and response-time series must
 * be evenly spaced to be meaningful, and mixing in the 5-minute metrics probe
 * would bias both.
 */

import { getAdapter } from "./adapters";
import { loadConfig } from "./config";
import { runProbe } from "./probe";
import { recordSample, saveSnapshot, prune, readSnapshot } from "./store";
import type { ProbeResult, SiteConfig, SiteSnapshot } from "./types";

const DEFAULT_INTERVALS: Record<string, number> = {
  health: 30,
  services: 60,
  metrics: 300,
};

/**
 * Poller state lives on `globalThis`, not in module scope.
 *
 * Next bundles `instrumentation.ts` separately from the route handlers and
 * server components, so each gets its own instance of this module. With
 * module-level state the poller would fill one copy of the map while every
 * render read a permanently empty one — health showed "unknown" even though
 * samples were landing in SQLite. A global pins the state to the process.
 */
type PollerState = {
  latest: Map<string, Record<string, ProbeResult>>;
  siteTimers: Map<string, NodeJS.Timeout[]>;
  globalTimers: Set<NodeJS.Timeout>;
  started: boolean;
};

const GLOBAL_KEY = Symbol.for("astrolabe.monitor.poller");

const state: PollerState = ((globalThis as Record<symbol, unknown>)[
  GLOBAL_KEY
] ??= {
  latest: new Map(),
  siteTimers: new Map(),
  globalTimers: new Set(),
  started: false,
}) as PollerState;

const { latest, siteTimers, globalTimers } = state;

/** Probe names that came back 401/403 — a token problem, not an app problem. */
function unauthorisedProbes(
  results: Record<string, ProbeResult>,
): string[] | undefined {
  const blocked = Object.values(results)
    .filter((r) => r.httpStatus === 401 || r.httpStatus === 403)
    .map((r) => r.probe);

  return blocked.length > 0
    ? [
        `Not authorised to read: ${blocked.join(", ")}. Check the token in this site's auth.env.`,
      ]
    : undefined;
}

function intervalFor(probeName: string, configured?: number): number {
  return configured ?? DEFAULT_INTERVALS[probeName] ?? 60;
}

function snapshotFor(site: SiteConfig): SiteSnapshot {
  const results = latest.get(site.id);

  // Nothing polled yet in this process — fall back to the last snapshot written
  // to SQLite, so a just-restarted server shows the real previous state instead
  // of a wall of "no data" until the first poll lands.
  if (!results || Object.keys(results).length === 0) {
    const cached = readSnapshot(site.id);
    if (cached) return cached as SiteSnapshot;
  }

  const adapter = getAdapter(site.adapter);
  const normalized = adapter.normalize({ site, results: results ?? {} });
  const health = results?.health;

  return {
    id: site.id,
    label: site.label,
    health: normalized.health ?? "unknown",
    latencyMs: health?.ok ? health.latencyMs : null,
    services: normalized.services ?? [],
    metrics: normalized.metrics ?? [],
    version: normalized.version,
    uptimeSeconds: normalized.uptimeSeconds,
    error: health?.ok === false ? health.error : undefined,
    notes: unauthorisedProbes(results ?? {}),
    checkedAt: new Date().toISOString(),
    probes: Object.values(results ?? {}),
  };
}

async function pollOnce(site: SiteConfig, probeName: string): Promise<void> {
  const probe = site.probes.find((p) => p.name === probeName);
  if (!probe) return;

  const result = await runProbe(site, probe);

  const bucket = latest.get(site.id) ?? {};
  bucket[probeName] = result;
  latest.set(site.id, bucket);

  const snapshot = snapshotFor(site);

  try {
    saveSnapshot(site.id, Date.now(), snapshot);

    // Health is the heartbeat; everything else only enriches the snapshot.
    if (probeName === "health") {
      recordSample({
        siteId: site.id,
        ts: Date.now(),
        health: snapshot.health,
        latencyMs: result.ok ? result.latencyMs : null,
      });
    }
  } catch (error) {
    // A storage failure must not kill the loop — the console still renders
    // from the in-memory map, it just loses history for this tick.
    console.error(`[monitor] store write failed for ${site.id}:`, error);
  }
}

function schedule(site: SiteConfig): void {
  const owned: NodeJS.Timeout[] = [];

  site.probes.forEach((probe, index) => {
    const seconds = intervalFor(probe.name, probe.intervalSeconds);

    // Stagger the opening poll so N sites booting together do not fire every
    // probe in the same tick.
    const openingDelay = setTimeout(() => {
      void pollOnce(site, probe.name);
    }, index * 250);
    openingDelay.unref?.();
    owned.push(openingDelay);

    const timer = setInterval(() => {
      void pollOnce(site, probe.name);
    }, seconds * 1000);

    // Keeping the loop unref'd lets the process exit cleanly on SIGTERM
    // instead of waiting out the longest interval.
    timer.unref?.();
    owned.push(timer);
  });

  siteTimers.set(site.id, owned);
}

function unschedule(siteId: string): void {
  for (const timer of siteTimers.get(siteId) ?? []) clearInterval(timer);
  siteTimers.delete(siteId);
  latest.delete(siteId);
}

/**
 * Bring running timers in line with the config on disk. Called on a slow timer
 * and immediately after a write, so a site added through the API starts polling
 * on its own schedule rather than only being probed once.
 */
export function reconcile(): void {
  const { sites } = loadConfig();
  const configured = new Set(sites.map((site) => site.id));

  for (const siteId of [...siteTimers.keys()]) {
    if (!configured.has(siteId)) unschedule(siteId);
  }

  for (const site of sites) {
    if (!siteTimers.has(site.id)) schedule(site);
  }
}

export function startPolling(): void {
  if (state.started) return;
  state.started = true;

  reconcile();

  const { sites } = loadConfig();
  if (sites.length === 0) {
    console.warn("[monitor] no sites configured — poller idle");
  }

  try {
    const pruned = prune();
    if (pruned > 0) console.log(`[monitor] pruned ${pruned} expired samples`);
  } catch (error) {
    console.error("[monitor] prune failed:", error);
  }

  // Picks up hand-edits to sites.json without a restart.
  const reconciler = setInterval(reconcile, 30_000);
  reconciler.unref?.();
  globalTimers.add(reconciler);

  const daily = setInterval(() => {
    try {
      prune();
    } catch (error) {
      console.error("[monitor] prune failed:", error);
    }
  }, 86_400_000);
  daily.unref?.();
  globalTimers.add(daily);

  console.log(`[monitor] polling ${sites.length} site(s)`);
}

export function stopPolling(): void {
  for (const siteId of [...siteTimers.keys()]) unschedule(siteId);
  for (const timer of globalTimers) clearInterval(timer);
  globalTimers.clear();
  state.started = false;
}

/** Current snapshots for every configured site, newest known state. */
export function currentSnapshots(): SiteSnapshot[] {
  return loadConfig().sites.map(snapshotFor);
}

export function currentSnapshot(siteId: string): SiteSnapshot | undefined {
  const site = loadConfig().sites.find((s) => s.id === siteId);
  return site ? snapshotFor(site) : undefined;
}

/** Force an immediate poll of one site — used right after it is added. */
export async function pollSiteNow(site: SiteConfig): Promise<void> {
  await Promise.all(site.probes.map((probe) => pollOnce(site, probe.name)));
}
