/**
 * Shared formatting. Lives apart from the store so client components can import
 * it without dragging `node:sqlite` into the browser bundle.
 */

import type { Health, Metric } from "./types";

export function formatMetric(metric: Metric): string {
  const { value, kind, unit } = metric;
  if (typeof value === "string") return value;

  switch (kind) {
    case "ms":
      return value >= 1000
        ? `${(value / 1000).toFixed(2)} s`
        : `${Math.round(value)} ms`;
    case "bytes":
      return formatBytes(value);
    case "percent":
      // Accept both 0–1 ratios and 0–100 percentages.
      return `${(value <= 1 ? value * 100 : value).toFixed(1)}%`;
    case "rate":
      return `${compact(value)}${unit ? ` ${unit}` : "/s"}`;
    case "count":
    case "gauge":
    default:
      return `${compact(value)}${unit ? ` ${unit}` : ""}`;
  }
}

export function compact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString("en-US");
  return value.toFixed(2);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let index = 0;
  let value = bytes;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(seconds)}s`;
}

/**
 * Human duration since a timestamp — for an incident that has not closed yet.
 *
 * Reading the clock lives in here rather than at the call site so components
 * stay pure: a bare `Date.now()` in a render body is both a lint error and a
 * genuine source of unstable output across re-renders.
 */
export function formatSince(startedAt: number): string {
  return formatDuration((Date.now() - startedAt) / 1000);
}

export function formatRelative(ts: number): string {
  const delta = Date.now() - ts;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export function formatUptime(ratio: number): string {
  const pct = ratio * 100;
  // Three decimals below 99.9% would be noise; above it, they are the story.
  if (pct >= 99.9) return `${pct.toFixed(3)}%`;
  if (pct >= 99) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(1)}%`;
}

/** Human label for a health state. Always shown beside the colour, never alone. */
export const HEALTH_LABEL: Record<Health, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  unknown: "No data",
};

/**
 * Maps health onto the reserved status palette. These four are never reused as
 * series colours, so a status swatch can never impersonate a chart series.
 */
export const HEALTH_TOKEN: Record<Health, string> = {
  operational: "good",
  degraded: "warning",
  down: "critical",
  unknown: "muted",
};
