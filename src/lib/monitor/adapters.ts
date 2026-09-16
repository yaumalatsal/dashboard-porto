/**
 * Adapters turn one app's bespoke JSON into the normalized shape the console
 * renders. Adding a production app should mean picking an adapter in config —
 * writing a new one is the exception, not the routine.
 *
 * `generic` covers any app that returns plain JSON: it walks the payload and
 * infers metrics from the value types, so a brand-new service shows something
 * useful on day one with no adapter written at all.
 */

import type {
  Adapter,
  AdapterInput,
  AdapterOutput,
  Health,
  Metric,
  MetricKind,
  ProbeResult,
  ServiceStatus,
} from "./types";
import { worstHealth } from "./types";

/* ------------------------------------------------------------- inference */

/** Guess a metric's kind from its key name, falling back to the value type. */
function inferKind(key: string, value: unknown): MetricKind {
  const k = key.toLowerCase();
  if (typeof value === "string") return "text";
  if (/(_ms|_millis|latency|duration|response_time)$/.test(k)) return "ms";
  if (/(bytes|_mem|memory|heap|rss|size)/.test(k)) return "bytes";
  if (/(percent|pct|ratio|usage|load)/.test(k)) return "percent";
  if (/(per_sec|per_second|rate|rpm|rps|throughput)/.test(k)) return "rate";
  if (/(total|count|_n$|users|sessions|requests|errors|jobs)/.test(k)) {
    return "count";
  }
  return "gauge";
}

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Flatten a payload into metrics. Nested objects become groups, so an app that
 * returns `{ accounts: { total: 12 } }` renders under an "Accounts" heading
 * without anyone configuring that.
 */
function flatten(
  value: unknown,
  group: string | undefined,
  prefix: string,
  out: Metric[],
  depth = 0,
): void {
  if (value === null || value === undefined || depth > 3) return;

  if (Array.isArray(value)) {
    out.push({
      key: prefix || "items",
      label: humanize(prefix || "items"),
      value: value.length,
      kind: "count",
      group,
    });
    return;
  }

  if (typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (child !== null && typeof child === "object" && !Array.isArray(child)) {
        flatten(child, humanize(key), nextPrefix, out, depth + 1);
      } else {
        flatten(child, group, nextPrefix, out, depth + 1);
      }
    }
    return;
  }

  if (typeof value === "boolean") {
    out.push({
      key: prefix,
      label: humanize(prefix.split(".").pop() ?? prefix),
      value: value ? "yes" : "no",
      kind: "text",
      group,
    });
    return;
  }

  if (typeof value === "number" || typeof value === "string") {
    const leaf = prefix.split(".").pop() ?? prefix;
    out.push({
      key: prefix,
      label: humanize(leaf),
      value,
      kind: inferKind(leaf, value),
      group,
    });
  }
}

/** Read a health verdict out of whatever shape an app chose to express it in. */
function readHealth(payload: unknown, ok: boolean): Health {
  if (!ok) return "down";
  if (payload === null || typeof payload !== "object") {
    return ok ? "operational" : "down";
  }

  const record = payload as Record<string, unknown>;
  const raw = record.status ?? record.state ?? record.health;

  if (typeof raw === "string") {
    const s = raw.toLowerCase();
    if (["ok", "up", "healthy", "operational", "pass", "green"].includes(s)) {
      return "operational";
    }
    if (["degraded", "warn", "warning", "partial", "yellow"].includes(s)) {
      return "degraded";
    }
    if (["down", "fail", "failed", "error", "critical", "red"].includes(s)) {
      return "down";
    }
  }

  return "operational";
}

/** Normalize a services array regardless of the key names an app picked. */
function readServices(payload: unknown): ServiceStatus[] {
  if (payload === null || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;

  const list = record.services ?? record.checks ?? record.components;
  if (!Array.isArray(list)) return [];

  return list.flatMap((entry): ServiceStatus[] => {
    if (entry === null || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const name = e.name ?? e.service ?? e.component ?? e.id;
    if (typeof name !== "string") return [];

    const latency = e.latency_ms ?? e.latencyMs ?? e.duration_ms ?? e.responseTime;

    return [
      {
        name,
        status: readHealth(entry, true),
        detail:
          typeof e.detail === "string"
            ? e.detail
            : typeof e.message === "string"
              ? e.message
              : undefined,
        latencyMs: typeof latency === "number" ? latency : undefined,
      },
    ];
  });
}

/* --------------------------------------------------------------- adapters */

const generic: Adapter = {
  id: "generic",
  description:
    "Any app returning JSON. Infers health, services and metrics from the payload shape.",
  normalize({ results }: AdapterInput): AdapterOutput {
    const health = results.health;
    const services = results.services;
    const metricsProbe = results.metrics;

    const metrics: Metric[] = [];
    if (metricsProbe?.ok && metricsProbe.payload) {
      flatten(metricsProbe.payload, undefined, "", metrics);
    }

    // Any probe that is not health/services/metrics still contributes — that is
    // what makes an arbitrary new endpoint useful without a bespoke adapter.
    for (const [name, result] of Object.entries(results)) {
      if (["health", "services", "metrics"].includes(name)) continue;
      if (result.ok && result.payload) {
        flatten(result.payload, humanize(name), "", metrics);
      }
    }

    const healthPayload = health?.payload as Record<string, unknown> | undefined;
    const uptime =
      healthPayload?.uptime_seconds ??
      healthPayload?.uptimeSeconds ??
      healthPayload?.uptime;

    const probeStates: Health[] = [];
    if (health) probeStates.push(readHealth(health.payload, health.ok));

    /**
     * A probe we are not authorised to read says nothing about the app's
     * health — only that our token is missing, wrong or expired.
     *
     * Counting a 401 as "degraded" means an expired monitoring token makes a
     * public status page announce an outage that is not happening, while the
     * health endpoint is answering 200 the whole time. The health probe is the
     * authority; an auth failure is a monitoring problem, reported separately
     * via `probes[]` rather than by libelling the application.
     */
    const isAuthFailure = (result?: ProbeResult) =>
      result?.httpStatus === 401 || result?.httpStatus === 403;

    if (services?.ok === false && !isAuthFailure(services)) {
      probeStates.push("degraded");
    }
    if (metricsProbe?.ok === false && !isAuthFailure(metricsProbe)) {
      probeStates.push("degraded");
    }

    const serviceList = readServices(services?.payload ?? health?.payload);
    if (serviceList.length > 0) {
      probeStates.push(worstHealth(serviceList.map((s) => s.status)));
    }

    return {
      health: probeStates.length > 0 ? worstHealth(probeStates) : "unknown",
      services: serviceList,
      metrics,
      version:
        typeof healthPayload?.version === "string"
          ? healthPayload.version
          : undefined,
      uptimeSeconds: typeof uptime === "number" ? uptime : undefined,
    };
  },
};

/**
 * The shape the existing monitoring endpoints already speak
 * (`/api/health`, `/api/monitor/services`, `/api/monitor/metrics`) — grouped
 * metric objects and a `services[]` array with `status` / `detail` / `latency_ms`.
 */
const monitorApi: Adapter = {
  id: "monitor-api",
  description:
    "Apps exposing /api/health + /api/monitor/services + /api/monitor/metrics.",
  normalize(input: AdapterInput): AdapterOutput {
    const base = generic.normalize(input);
    const metricsPayload = input.results.metrics?.payload as
      | Record<string, unknown>
      | undefined;

    if (!metricsPayload) return base;

    // This shape groups by top-level key, and the group order is meaningful —
    // preserve it rather than letting the generic walker alphabetize by accident.
    const metrics: Metric[] = [];
    for (const [group, values] of Object.entries(metricsPayload)) {
      if (values === null || typeof values !== "object") continue;
      flatten(values, humanize(group), "", metrics);
    }

    return { ...base, metrics: metrics.length > 0 ? metrics : base.metrics };
  },
};

/** An app that only exposes a plain 200/OK ping — no JSON body worth reading. */
const ping: Adapter = {
  id: "ping",
  description:
    "Reachability only. Use for apps with no monitoring API — charts uptime and response time.",
  normalize({ results }: AdapterInput): AdapterOutput {
    const health = results.health;
    return {
      health: health?.ok ? "operational" : "down",
      services: [],
      metrics: [],
    };
  },
};

const registry = new Map<string, Adapter>(
  [generic, monitorApi, ping].map((a) => [a.id, a]),
);

export function getAdapter(id?: string): Adapter {
  return (id ? registry.get(id) : undefined) ?? generic;
}

export function listAdapters(): { id: string; description: string }[] {
  return [...registry.values()].map(({ id, description }) => ({
    id,
    description,
  }));
}

/** Register an adapter at boot — the extension point for a bespoke app. */
export function registerAdapter(adapter: Adapter): void {
  registry.set(adapter.id, adapter);
}
