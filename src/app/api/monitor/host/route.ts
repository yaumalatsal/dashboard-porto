/**
 * VPS metrics: the current reading plus a bucketed history.
 *
 * `?window=<seconds>&buckets=<n>`
 */

import { procPath, sample } from "@/lib/monitor/host";
import { hostSeries, latestHostSample } from "@/lib/monitor/store";

export const dynamic = "force-dynamic";

const MIN_WINDOW_SECONDS = 300;
const MAX_WINDOW_SECONDS = 14 * 86_400;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // Clamp rather than reject: an out-of-range window should degrade to the
  // nearest sensible one, not 400 a dashboard that mis-computed a range.
  const windowSeconds = Math.min(
    Math.max(Number(params.get("window")) || 3600, MIN_WINDOW_SECONDS),
    MAX_WINDOW_SECONDS,
  );
  const buckets = Math.min(Math.max(Number(params.get("buckets")) || 120, 8), 480);

  // The stored sample, not a fresh read: CPU and network are deltas since the
  // previous sample, and reading here would divide by the time since whenever
  // the last caller happened to ask.
  const current = latestHostSample();

  if (!current) {
    // Distinguish "the poller has not sampled yet" from "this machine has no
    // procfs to read" — the fixes are entirely different.
    const probe = sample();
    return Response.json(
      {
        available: false,
        reason: probe.unavailable ?? "no samples yet — the poller writes one every 10s",
        procPath,
        current: null,
        points: [],
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      available: true,
      procPath,
      windowSeconds,
      current,
      points: hostSeries(windowSeconds, buckets),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
