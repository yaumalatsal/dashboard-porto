/**
 * One HTTP probe. Uses `fetch` with an AbortController rather than the old
 * `http`/`https` callback pair — same behaviour, and it gives us a real timeout
 * that fires on a stalled body, not just a stalled connect.
 */

import type { ProbeConfig, ProbeResult, SiteConfig } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

export async function runProbe(
  site: SiteConfig,
  probe: ProbeConfig,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeoutMs = probe.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "astrolabe-console/1.0",
      ...probe.headers,
    };

    // The token is read at poll time so rotating it means restarting the
    // process, never rewriting a config file that might be in source control.
    if (site.auth) {
      const token = process.env[site.auth.env];
      if (token) headers[site.auth.header] = token;
    }

    const response = await fetch(probe.url, {
      method: probe.method ?? "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
    });

    const latencyMs = Math.round(performance.now() - startedAt);
    const okStatuses = probe.okStatuses;
    const ok = okStatuses
      ? okStatuses.includes(response.status)
      : response.ok;

    // A non-JSON body is not a failure — a plain-text `OK` from a ping endpoint
    // is a perfectly good health signal, so only the status decides `ok`.
    let payload: unknown;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { body: text.slice(0, 500) };
      }
    }

    return {
      probe: probe.name,
      ok,
      httpStatus: response.status,
      latencyMs,
      payload,
      error: ok ? undefined : `http_${response.status}`,
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? `timeout_${timeoutMs}ms`
          : error.message
        : "unknown_error";

    return { probe: probe.name, ok: false, latencyMs, error: message };
  } finally {
    clearTimeout(timer);
  }
}
