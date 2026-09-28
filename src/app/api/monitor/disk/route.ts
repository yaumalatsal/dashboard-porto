/**
 * What is filling the disk: the latest breakdown by directory, file and
 * Docker service.
 *
 * A scan is a filesystem walk measured in tens of seconds, so this serves the
 * last completed one rather than starting a new one per request. An endpoint
 * that kicked off a walk would be a denial-of-service handle on the machine
 * it is meant to be reporting on.
 */

import { diskScannerStatus, latestDiskReport } from "@/lib/monitor/disk";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = latestDiskReport();
  const scanner = diskScannerStatus();

  if (!report) {
    return Response.json(
      {
        available: false,
        // The first scan is deliberately deferred so it does not compete with
        // application startup; say so rather than looking broken.
        reason: scanner.enabled
          ? "no scan has completed yet — the first runs a minute after boot"
          : "the disk scanner is not running",
        scanner,
        report: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { available: true, scanner, report },
    { headers: { "Cache-Control": "no-store" } },
  );
}
