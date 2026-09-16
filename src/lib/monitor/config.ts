/**
 * Site registry. Reads `sites.json` (or `CONSOLE_SITES_PATH`) and falls back to
 * a bundled default so a fresh container is never blank.
 *
 * Kept deliberately small: adding an app is a config edit, and the console's
 * POST endpoint writes through this same module so both paths agree.
 */

import fs from "node:fs";
import path from "node:path";
import type { MonitorConfig, ProbeConfig, SiteConfig } from "./types";

const CONFIG_PATH =
  process.env.CONSOLE_SITES_PATH ?? path.join(process.cwd(), "sites.json");

/**
 * Seed used the first time the app boots with no registry.
 *
 * In Docker the live registry lives on the data volume, which starts empty, so
 * without a seed a fresh deploy would come up monitoring nothing. The example
 * file is committed; the live copy is not, because it accumulates
 * environment-specific URLs.
 */
const SEED_PATH = path.join(process.cwd(), "sites.json.example");

const EMPTY: MonitorConfig = { sites: [] };

let cache: MonitorConfig | null = null;
let cacheMtimeMs = 0;

function normalizeSite(raw: Partial<SiteConfig> & { id?: string }): SiteConfig | null {
  if (!raw.id || !Array.isArray(raw.probes) || raw.probes.length === 0) {
    return null;
  }

  const probes: ProbeConfig[] = raw.probes.flatMap((probe) =>
    probe && typeof probe.url === "string" && typeof probe.name === "string"
      ? [probe]
      : [],
  );
  if (probes.length === 0) return null;

  return {
    id: raw.id,
    label: raw.label ?? raw.id,
    url: raw.url,
    blurb: raw.blurb,
    adapter: raw.adapter ?? "generic",
    probes,
    auth: raw.auth,
    tags: raw.tags ?? [],
    hidden: raw.hidden ?? false,
  };
}

/** Copy the committed example into place on first boot. Runs at most once. */
function seedIfMissing(): void {
  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ CONFIG_PATH)) return;
    if (!fs.existsSync(/*turbopackIgnore: true*/ SEED_PATH)) return;

    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(CONFIG_PATH), {
      recursive: true,
    });
    fs.copyFileSync(
      /*turbopackIgnore: true*/ SEED_PATH,
      /*turbopackIgnore: true*/ CONFIG_PATH,
    );
    console.log(`[monitor] seeded ${CONFIG_PATH} from sites.json.example`);
  } catch {
    // A read-only filesystem is fine — loadConfig falls back to reading the
    // seed directly below.
  }
}

export function loadConfig(): MonitorConfig {
  try {
    seedIfMissing();
    const target = fs.existsSync(/*turbopackIgnore: true*/ CONFIG_PATH)
      ? CONFIG_PATH
      : SEED_PATH;
    const stat = fs.statSync(/*turbopackIgnore: true*/ target);
    // Re-read only when the file actually changed — the poller calls this on
    // every tick and the console calls it on every render.
    if (cache && stat.mtimeMs === cacheMtimeMs) return cache;

    const parsed = JSON.parse(
      fs.readFileSync(/*turbopackIgnore: true*/ target, "utf8"),
    ) as MonitorConfig;
    const sites = (parsed.sites ?? []).flatMap((site) => {
      const normalized = normalizeSite(site);
      return normalized ? [normalized] : [];
    });

    cache = { sites };
    cacheMtimeMs = stat.mtimeMs;
    return cache;
  } catch {
    // Missing or malformed config must not take the portfolio down with it.
    return cache ?? EMPTY;
  }
}

export function saveConfig(config: MonitorConfig): void {
  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(CONFIG_PATH), {
    recursive: true,
  });
  fs.writeFileSync(
    /*turbopackIgnore: true*/ CONFIG_PATH,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
  cache = null;
  cacheMtimeMs = 0;
}

export function getSite(id: string): SiteConfig | undefined {
  return loadConfig().sites.find((site) => site.id === id);
}

export function addSite(site: SiteConfig): void {
  const config = loadConfig();
  if (config.sites.some((existing) => existing.id === site.id)) {
    throw new Error(`site_exists:${site.id}`);
  }
  saveConfig({ sites: [...config.sites, site] });
}

export function removeSite(id: string): boolean {
  const config = loadConfig();
  const next = config.sites.filter((site) => site.id !== id);
  if (next.length === config.sites.length) return false;
  saveConfig({ sites: next });
  return true;
}

/**
 * Build the three standard probes from one base URL — the common case when
 * onboarding an app that follows the `/api/health` convention.
 */
export function standardProbes(baseUrl: string): ProbeConfig[] {
  const base = baseUrl.replace(/\/+$/, "");
  return [
    { name: "health", url: `${base}/api/health`, intervalSeconds: 30 },
    { name: "services", url: `${base}/api/monitor/services`, intervalSeconds: 60 },
    { name: "metrics", url: `${base}/api/monitor/metrics`, intervalSeconds: 300 },
  ];
}

export const configPath = CONFIG_PATH;
