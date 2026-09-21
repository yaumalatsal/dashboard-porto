/**
 * VPS metrics, read straight from procfs.
 *
 * The console already runs on the machine it reports on, so an agent or a
 * Prometheus exporter would only add a hop and a process to keep alive. In
 * Docker the container's own `/proc` describes the container, not the host, so
 * compose bind-mounts the host's procfs read-only and `HOST_PROC` points at it.
 *
 * CPU and network are cumulative counters: a single read says nothing, and a
 * value is only meaningful as a delta between two reads on a known cadence.
 * That is why `sample()` is driven by the poller rather than computed when a
 * request arrives — reading on demand would divide by however long it happened
 * to be since the last caller.
 */

import fs from "node:fs";
import path from "node:path";

const PROC = process.env.HOST_PROC ?? "/proc";
const ROOTFS = process.env.HOST_ROOTFS ?? "/";

export type CpuMetrics = { percent: number | null; cores: number | null };

export type MemoryMetrics = {
  total: number;
  available: number;
  used: number;
  percent: number | null;
  swapTotal: number;
  swapUsed: number;
  swapPercent: number | null;
};

export type DiskMetrics = {
  total: number;
  free: number;
  used: number;
  percent: number | null;
};

export type LoadMetrics = { one: number; five: number; fifteen: number };

export type NetworkMetrics = {
  rxTotal: number;
  txTotal: number;
  rxPerSec: number | null;
  txPerSec: number | null;
};

export type HostSnapshot = {
  ts: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics | null;
  disk: DiskMetrics | null;
  load: LoadMetrics | null;
  network: NetworkMetrics | null;
  uptimeSeconds: number | null;
  /** Set when procfs is not readable — the console shows this instead of zeros. */
  unavailable?: string;
};

function readOrNull(file: string): string | null {
  try {
    return fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8");
  } catch {
    return null;
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// --- CPU -------------------------------------------------------------------

type CpuTimes = { idle: number; total: number };

function readCpuTimes(): CpuTimes | null {
  const raw = readOrNull(path.join(PROC, "stat"));
  if (!raw) return null;

  const line = raw.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;

  const fields = line.trim().split(/\s+/).slice(1).map(Number);
  // Waiting on IO is not work: fold iowait into idle so a disk-bound box does
  // not read as busy.
  const idle = (fields[3] ?? 0) + (fields[4] ?? 0);
  const total = fields.reduce((sum, n) => sum + n, 0);
  return { idle, total };
}

let previousCpu: CpuTimes | null = null;

function cpuPercent(): number | null {
  const now = readCpuTimes();
  if (!now) return null;

  const previous = previousCpu;
  previousCpu = now;
  if (!previous) return null;

  const totalDelta = now.total - previous.total;
  const idleDelta = now.idle - previous.idle;
  if (totalDelta <= 0) return null;

  return round1(((totalDelta - idleDelta) / totalDelta) * 100);
}

function cpuCores(): number | null {
  const raw = readOrNull(path.join(PROC, "cpuinfo"));
  if (!raw) return null;
  const count = raw.split("\n").filter((l) => l.startsWith("processor")).length;
  return count || null;
}

// --- Memory ----------------------------------------------------------------

function memory(): MemoryMetrics | null {
  const raw = readOrNull(path.join(PROC, "meminfo"));
  if (!raw) return null;

  const fields = new Map<string, number>();
  for (const line of raw.split("\n")) {
    const match = /^(\w+):\s+(\d+)/.exec(line);
    if (match) fields.set(match[1]!, Number(match[2]) * 1024); // kB → bytes
  }

  const total = fields.get("MemTotal") ?? 0;
  if (!total) return null;

  // MemAvailable is the kernel's own estimate of what a new workload could
  // claim. MemFree alone counts the page cache as used and makes a healthy
  // machine look full.
  const available = fields.get("MemAvailable") ?? fields.get("MemFree") ?? 0;
  const swapTotal = fields.get("SwapTotal") ?? 0;
  const swapUsed = swapTotal - (fields.get("SwapFree") ?? 0);

  return {
    total,
    available,
    used: total - available,
    percent: round1(((total - available) / total) * 100),
    swapTotal,
    swapUsed,
    swapPercent: swapTotal ? round1((swapUsed / swapTotal) * 100) : null,
  };
}

// --- Disk ------------------------------------------------------------------

function disk(): DiskMetrics | null {
  try {
    const stats = fs.statfsSync(/*turbopackIgnore: true*/ ROOTFS);
    const total = stats.blocks * stats.bsize;
    // `bavail`, not `bfree`: the reserved-for-root blocks are not space this
    // machine can actually use.
    const free = stats.bavail * stats.bsize;
    if (!total) return null;

    return {
      total,
      free,
      used: total - free,
      percent: round1(((total - free) / total) * 100),
    };
  } catch {
    return null;
  }
}

// --- Load and uptime -------------------------------------------------------

function load(): LoadMetrics | null {
  const raw = readOrNull(path.join(PROC, "loadavg"));
  if (!raw) return null;

  const [one, five, fifteen] = raw.trim().split(/\s+/).map(Number);
  if (one === undefined || Number.isNaN(one)) return null;
  return { one, five: five ?? 0, fifteen: fifteen ?? 0 };
}

function uptimeSeconds(): number | null {
  const raw = readOrNull(path.join(PROC, "uptime"));
  if (!raw) return null;
  const seconds = Number(raw.trim().split(/\s+/)[0]);
  return Number.isNaN(seconds) ? null : Math.floor(seconds);
}

// --- Network ---------------------------------------------------------------

/**
 * Virtual interfaces would double-count: traffic to a container crosses both
 * the physical NIC and the bridge/veth pair carrying it onward.
 */
const VIRTUAL_INTERFACE = /^(lo|docker|br-|veth|virbr|tun|tap)/;

type NetTotals = { rx: number; tx: number; at: number };

function readNetTotals(): NetTotals | null {
  const raw = readOrNull(path.join(PROC, "net/dev"));
  if (!raw) return null;

  let rx = 0;
  let tx = 0;
  // The first two lines are the column headers.
  for (const line of raw.split("\n").slice(2)) {
    const match = /^\s*([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    if (VIRTUAL_INTERFACE.test(match[1]!.trim())) continue;

    const fields = match[2]!.trim().split(/\s+/).map(Number);
    rx += fields[0] ?? 0;
    tx += fields[8] ?? 0;
  }

  return { rx, tx, at: Date.now() };
}

let previousNet: NetTotals | null = null;

function network(): NetworkMetrics | null {
  const now = readNetTotals();
  if (!now) return null;

  const previous = previousNet;
  previousNet = now;

  const elapsed = previous ? (now.at - previous.at) / 1000 : 0;
  // Counters wrap and interfaces come and go; a negative delta is noise, not a
  // negative rate.
  const rate = (current: number, before: number) =>
    Math.max(0, Math.round((current - before) / elapsed));

  return {
    rxTotal: now.rx,
    txTotal: now.tx,
    rxPerSec: previous && elapsed > 0 ? rate(now.rx, previous.rx) : null,
    txPerSec: previous && elapsed > 0 ? rate(now.tx, previous.tx) : null,
  };
}

// --- Public API ------------------------------------------------------------

/**
 * Read every metric once. Call on a fixed cadence: the CPU and network figures
 * are deltas since the previous call.
 */
export function sample(): HostSnapshot {
  const snapshot: HostSnapshot = {
    ts: Date.now(),
    cpu: { percent: cpuPercent(), cores: cpuCores() },
    memory: memory(),
    disk: disk(),
    load: load(),
    network: network(),
    uptimeSeconds: uptimeSeconds(),
  };

  // Disk is read through statfs rather than procfs, so it can succeed on a
  // machine where /proc is missing entirely. Judge availability on the rest.
  if (!snapshot.memory && !snapshot.load) {
    snapshot.unavailable = `cannot read ${PROC} — is the host procfs mounted and HOST_PROC set?`;
  }

  return snapshot;
}

export const procPath = PROC;
export const rootfsPath = ROOTFS;
