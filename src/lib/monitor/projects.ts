/**
 * Joins a portfolio project to whatever the console can measure about it.
 *
 * The seven projects are not equal in what they permit. Five of them run
 * inside the network of a client — a government agency, a smelting plant, a
 * hospital, a company. I do not own those systems and I cannot open them to
 * the public, so the console cannot probe them. One runs in Roblox and has no
 * web service at all.
 *
 * A dashboard that answered this with an empty chart would be worse than no
 * dashboard. So this module separates three questions and answers each one
 * only from the data that exists:
 *
 *   1. Is the system live, and how does it behave?   → `live`, or null
 *   2. How many people read about it?                → `reach`, always
 *   3. Why can I not show more?                      → `access`, always
 *
 * Question 2 is the reason every project gets a real dashboard. The case study
 * at `/work/<slug>` is a page on this site, so its traffic is measured here
 * whatever the live system does.
 */

import {
  ACCESS,
  projects,
  type ProjectAccess,
  type ProjectData,
} from "@/data/portfolio";
import { getSite } from "./config";
import { currentSnapshot } from "./poller";
import {
  dailyUptime,
  incidentStats,
  pathSeries,
  pathSummary,
  recentIncidents,
  series,
  trafficSeries,
  trafficSummary,
  uptimeSummary,
  type IncidentStats,
  type TrafficPoint,
  type TrafficSummary,
} from "./store";
import type {
  Health,
  Incident,
  Metric,
  SeriesPoint,
  ServiceStatus,
  UptimeSummary,
} from "./types";

export { ACCESS } from "@/data/portfolio";

/** Everything the console knows about a live application. */
export type ProjectLive = {
  siteId: string;
  label: string;
  url?: string;
  health: Health;
  latencyMs: number | null;
  checkedAt: string | null;
  day: UptimeSummary;
  previousDay: UptimeSummary;
  month: UptimeSummary;
  points: SeriesPoint[];
  daily: ReturnType<typeof dailyUptime>;
  incidents: Incident[];
  stats: IncidentStats;
  services: ServiceStatus[];
  metrics: Metric[];
  notes: string[];
  error?: string;
};

/** How many people read about the project, and how many use it. */
export type ProjectReach = {
  /** The path on this site that the figures below describe. */
  path: string;
  studyViews: TrafficSummary;
  previousStudyViews: TrafficSummary;
  studyPoints: TrafficPoint[];
  /** Traffic of the project's own site. Null unless `trafficId` is set. */
  siteViews: TrafficSummary | null;
  previousSiteViews: TrafficSummary | null;
  sitePoints: TrafficPoint[];
};

export type ProjectDashboard = {
  project: ProjectData;
  access: (typeof ACCESS)[ProjectAccess];
  /** Null whenever the console cannot probe the system. */
  live: ProjectLive | null;
  /**
   * True when the project names a site that `sites.json` does not hold. The
   * project claims to be public but nothing polls it yet.
   */
  awaitingRegistry: boolean;
  reach: ProjectReach;
};

const MONTH = 30 * 86_400;
const DAY = 86_400;

export function projectBySlug(slug: string): ProjectData | undefined {
  return projects.find((project) => project.slug === slug);
}

/** Reads every figure one project dashboard needs, in one place. */
export function projectDashboard(project: ProjectData): ProjectDashboard {
  const { monitor } = project;
  const siteId = monitor.siteId;
  const config = siteId ? getSite(siteId) : undefined;

  let live: ProjectLive | null = null;
  if (siteId && config) {
    const snapshot = currentSnapshot(siteId);
    live = {
      siteId,
      label: config.label,
      url: config.url,
      health: snapshot?.health ?? "unknown",
      latencyMs: snapshot?.latencyMs ?? null,
      checkedAt: snapshot?.checkedAt ?? null,
      day: uptimeSummary(siteId, DAY),
      previousDay: uptimeSummary(siteId, DAY, DAY),
      month: uptimeSummary(siteId, MONTH),
      points: series(siteId, DAY, 72),
      daily: dailyUptime(siteId, 90),
      incidents: recentIncidents(8, siteId),
      stats: incidentStats(siteId, MONTH),
      services: snapshot?.services ?? [],
      metrics: snapshot?.metrics ?? [],
      notes: snapshot?.notes ?? [],
      error: snapshot?.error,
    };
  }

  const path = `/work/${project.slug}`;

  return {
    project,
    access: ACCESS[monitor.access],
    live,
    awaitingRegistry: Boolean(siteId) && !config,
    reach: {
      path,
      studyViews: pathSummary(path, MONTH),
      previousStudyViews: pathSummary(path, MONTH, MONTH),
      studyPoints: pathSeries(path, MONTH, 30),
      siteViews: monitor.trafficId
        ? trafficSummary(MONTH, 0, monitor.trafficId)
        : null,
      previousSiteViews: monitor.trafficId
        ? trafficSummary(MONTH, MONTH, monitor.trafficId)
        : null,
      sitePoints: monitor.trafficId
        ? trafficSeries(MONTH, 30, monitor.trafficId)
        : [],
    },
  };
}

/**
 * A short row for the index page.
 *
 * It deliberately does not call `projectDashboard`: the index shows seven
 * projects, and the full read does about a dozen queries for each one.
 */
export type ProjectCard = {
  project: ProjectData;
  access: (typeof ACCESS)[ProjectAccess];
  health: Health | null;
  upRatio: number | null;
  studyViews: number;
};

export function projectCards(): ProjectCard[] {
  return projects.map((project) => {
    const siteId = project.monitor.siteId;
    const config = siteId ? getSite(siteId) : undefined;
    const summary = siteId && config ? uptimeSummary(siteId, MONTH) : null;

    return {
      project,
      access: ACCESS[project.monitor.access],
      health: siteId && config ? (currentSnapshot(siteId)?.health ?? "unknown") : null,
      upRatio: summary && summary.samples > 0 ? summary.upRatio : null,
      studyViews: pathSummary(`/work/${project.slug}`, MONTH).views,
    };
  });
}
