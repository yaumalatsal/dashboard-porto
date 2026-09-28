/**
 * Where the disk actually went.
 *
 * `host.ts` answers "how full is the disk"; this answers the question that
 * follows immediately and that a percentage cannot: *what is filling it*. It
 * walks a configured set of roots on the host filesystem — already mounted
 * read-only at HOST_ROOTFS — and reports the largest directories and files,
 * plus a per-service breakdown for anything under Docker's data root.
 *
 * Nothing here needs new privileges. In particular it does not touch the
 * Docker socket: mounting that into a container grants the equivalent of root
 * on the host, and every figure below is obtainable by reading directories
 * that are already visible. Container *names* come from each container's own
 * `config.v2.json`, which is a plain file.
 *
 * A walk is expensive, so it runs on a slow background interval with hard
 * budgets on entries and wall-clock time. Exceeding either marks the result
 * truncated rather than silently reporting a number that is too small.
 */

import fs from "node:fs";
import path from "node:path";

const ROOTFS = process.env.HOST_ROOTFS ?? "/";

/**
 * Directories worth watching on a web VPS.
 *
 * `/var/lib/containerd` is listed first and deliberately: with Docker's
 * containerd snapshotter — the default on current Ubuntu — image layers live
 * there, not under `/var/lib/docker`. Watching only the latter reports a
 * gigabyte on a machine where eleven have gone.
 */
const DEFAULT_PATHS =
  "/var/lib/containerd,/var/lib/docker,/var/log,/home,/var/www,/opt,/tmp";

/** How deep a directory is still reported individually. Sizes recurse fully. */
const DEFAULT_DEPTH = 3;

/** Stop walking after this many entries — overlay2 alone can hold millions. */
const ENTRY_BUDGET = Number(process.env.DISK_SCAN_ENTRY_BUDGET ?? 600_000);

/** …or after this long, whichever comes first. */
const TIME_BUDGET_MS = Number(process.env.DISK_SCAN_TIME_BUDGET_MS ?? 90_000);

/** Pseudo-filesystems: walking them is meaningless and /proc is a trap. */
const SKIP_NAMES = new Set(["proc", "sys", "dev", "run", "lost+found"]);

const TOP_DIRS = 15;
const TOP_FILES = 15;

export type DiskEntry = {
  /** Path as it appears on the host, not inside the container. */
  path: string;
  bytes: number;
  /** Set for a directory whose children were cut short by a budget. */
  truncated?: boolean;
};

export type ServiceUsage = {
  name: string;
  kind: "container" | "volume" | "image-layers" | "build-cache" | "other";
  bytes: number;
};

export type DiskReport = {
  ts: number;
  /** Wall-clock the scan took, so a slow VPS is visible rather than mysterious. */
  durationMs: number;
  roots: DiskEntry[];
  topDirectories: DiskEntry[];
  topFiles: DiskEntry[];
  services: ServiceUsage[];
  /** True when a budget stopped the walk: totals below are a floor, not a total. */
  truncated: boolean;
  entriesScanned: number;
  /** Roots that could not be read at all, with the reason. */
  unreadable: { path: string; error: string }[];
};

// --- Walking ---------------------------------------------------------------

type WalkContext = {
  deadline: number;
  entries: number;
  /** Device of the root being walked; crossing it would count other disks. */
  dev: number;
  /** Inodes already counted, so a hard link is not billed twice. */
  seen: Set<string>;
  dirs: DiskEntry[];
  files: DiskEntry[];
  truncated: boolean;
  depthLimit: number;
};

function overBudget(ctx: WalkContext): boolean {
  if (ctx.entries >= ENTRY_BUDGET || Date.now() > ctx.deadline) {
    ctx.truncated = true;
    return true;
  }
  return false;
}

/** The path as the host sees it — the container prefix is an implementation detail. */
function hostPath(containerPath: string): string {
  if (ROOTFS === "/") return containerPath;
  const relative = path.relative(ROOTFS, containerPath).split(path.sep).join("/");
  return `/${relative}`;
}

/**
 * Resolve a host path to where it is readable inside the container.
 *
 * Plain string joining rather than `path.join`: Turbopack traces a `path.join`
 * whose result reaches `fs` and, failing to resolve it statically, pulls the
 * entire project into the server bundle. These paths are runtime configuration
 * that no bundler can know, so the join is kept opaque on purpose.
 */
function underRoot(target: string): string {
  if (ROOTFS === "/") return target;
  return `${ROOTFS.replace(/\/+$/, "")}/${target.replace(/^\/+/, "")}`;
}

/**
 * Recursive size of one directory, in bytes actually occupied on disk.
 *
 * `blocks * 512`, not `size`: a sparse file and a 1-byte file both report a
 * size that has little to do with what the filesystem gave them, and `du`
 * answers the question being asked here. Directories are recorded down to the
 * depth limit; below it they still contribute their bytes upward but are not
 * listed individually.
 */
function walk(dir: string, depth: number, ctx: WalkContext): number {
  if (overBudget(ctx)) return 0;

  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true });
  } catch {
    // Permission denied, or it vanished mid-walk. Either way, nothing to add.
    return 0;
  }

  let total = 0;

  for (const dirent of dirents) {
    if (overBudget(ctx)) break;
    ctx.entries += 1;

    if (SKIP_NAMES.has(dirent.name)) continue;
    // Never follow a symlink: it invites cycles, and a link into another tree
    // would bill those bytes here as well as where they live.
    if (dirent.isSymbolicLink()) continue;

    const full = path.join(dir, dirent.name);

    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(/*turbopackIgnore: true*/ full);
    } catch {
      continue;
    }

    // Staying on one device keeps a bind-mounted or network filesystem from
    // being counted against this disk.
    if (stat.dev !== ctx.dev) continue;

    if (dirent.isDirectory()) {
      const bytes = walk(full, depth + 1, ctx);
      total += bytes;
      if (depth < ctx.depthLimit) {
        ctx.dirs.push({ path: hostPath(full), bytes });
      }
      continue;
    }

    if (!dirent.isFile()) continue; // sockets, fifos, devices: no meaningful size

    // A file with two names must only be counted once.
    if (stat.nlink > 1) {
      const key = `${stat.dev}:${stat.ino}`;
      if (ctx.seen.has(key)) continue;
      ctx.seen.add(key);
    }

    const bytes = stat.blocks * 512;
    total += bytes;
    ctx.files.push({ path: hostPath(full), bytes });
  }

  return total;
}

// --- Docker attribution ----------------------------------------------------

/**
 * A container's name without asking the daemon.
 *
 * `/var/lib/docker/containers/<id>/config.v2.json` holds the name the daemon
 * assigned. Reading it is an ordinary file read; the alternative — mounting
 * the Docker socket — hands the container root on the host.
 */
function containerName(dir: string, id: string): string {
  try {
    const raw = fs.readFileSync(
      /*turbopackIgnore: true*/ `${dir}/config.v2.json`,
      "utf8",
    );
    const parsed = JSON.parse(raw) as { Name?: string };
    // The daemon stores it with a leading slash.
    const name = parsed.Name?.replace(/^\//, "");
    return name || id.slice(0, 12);
  } catch {
    return id.slice(0, 12);
  }
}

/**
 * Bulk stores that belong to a container runtime rather than to any one
 * service, keyed by the directory that holds them.
 *
 * Individual layers cannot be attributed to a service without the daemon's own
 * index, and this deliberately does not ask the daemon for it — the socket
 * that would answer also grants root on the host. One honest bulk figure beats
 * a breakdown that is guessed at, and on most machines this is the largest
 * number on the page anyway.
 */
const BULK_STORES: Record<string, { name: string; kind: ServiceUsage["kind"] }> = {
  // Docker's own overlay driver.
  "docker/overlay2": { name: "Image & container layers", kind: "image-layers" },
  "docker/buildkit": { name: "Build cache", kind: "build-cache" },
  // containerd, which is where the layers actually live once Docker uses the
  // containerd snapshotter — the default on current Ubuntu.
  "containerd/io.containerd.snapshotter.v1.overlayfs": {
    name: "Image layers (containerd snapshots)",
    kind: "image-layers",
  },
  "containerd/io.containerd.content.v1.content": {
    name: "Image blobs (containerd content store)",
    kind: "image-layers",
  },
};

/** Split the runtime data roots into things a person recognises. */
function runtimeServices(dirs: DiskEntry[]): ServiceUsage[] {
  const services: ServiceUsage[] = [];

  for (const entry of dirs) {
    const cut = entry.path.lastIndexOf("/");
    const parent = entry.path.slice(0, cut);
    const base = entry.path.slice(cut + 1);

    // `/var/lib/docker/containers` and `/var/lib/docker/volumes` hold one
    // directory per container and per volume, so the parent identifies the
    // kind and the basename identifies the thing.
    if (parent.endsWith("/docker/containers")) {
      services.push({
        name: containerName(underRoot(entry.path), base),
        kind: "container",
        bytes: entry.bytes,
      });
      continue;
    }

    // Docker creates this alongside the real volumes; it is not one.
    if (parent.endsWith("/docker/volumes") && base !== "backingFsBlockDev") {
      services.push({ name: base, kind: "volume", bytes: entry.bytes });
      continue;
    }

    const store = Object.entries(BULK_STORES).find(([suffix]) =>
      entry.path.endsWith(`/${suffix}`),
    );
    if (store) {
      services.push({ name: store[1].name, kind: store[1].kind, bytes: entry.bytes });
    }
  }

  return services.sort((a, b) => b.bytes - a.bytes);
}

// --- Scanning --------------------------------------------------------------

function configuredPaths(): string[] {
  return (process.env.DISK_SCAN_PATHS ?? DEFAULT_PATHS)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

export function scan(): DiskReport {
  const started = Date.now();
  const depthLimit = Number(process.env.DISK_SCAN_DEPTH ?? DEFAULT_DEPTH);

  const roots: DiskEntry[] = [];
  const unreadable: { path: string; error: string }[] = [];
  const allDirs: DiskEntry[] = [];
  const allFiles: DiskEntry[] = [];
  let truncated = false;
  let entriesScanned = 0;

  for (const target of configuredPaths()) {
    const resolved = underRoot(target);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(/*turbopackIgnore: true*/ resolved);
    } catch (error) {
      const code =
        error instanceof Error && "code" in error
          ? String((error as NodeJS.ErrnoException).code)
          : String(error);
      // A path that is simply absent on this machine is not a fault worth
      // reporting; one that exists but cannot be read is.
      if (code !== "ENOENT") unreadable.push({ path: target, error: code });
      continue;
    }
    if (!stat.isDirectory()) continue;

    const ctx: WalkContext = {
      // The remaining budget, so the last root does not get a fresh 90s.
      deadline: started + TIME_BUDGET_MS,
      entries: 0,
      dev: stat.dev,
      seen: new Set(),
      dirs: [],
      files: [],
      truncated: false,
      depthLimit,
    };

    const bytes = walk(resolved, 1, ctx);

    roots.push({ path: target, bytes, truncated: ctx.truncated || undefined });
    allDirs.push(...ctx.dirs);
    allFiles.push(...ctx.files);
    truncated = truncated || ctx.truncated;
    entriesScanned += ctx.entries;
  }

  const bySize = (a: DiskEntry, b: DiskEntry) => b.bytes - a.bytes;

  return {
    ts: started,
    durationMs: Date.now() - started,
    roots: roots.sort(bySize),
    topDirectories: allDirs.sort(bySize).slice(0, TOP_DIRS),
    topFiles: allFiles.sort(bySize).slice(0, TOP_FILES),
    services: runtimeServices(allDirs).slice(0, 20),
    truncated,
    entriesScanned,
    unreadable,
  };
}

// --- Lifecycle -------------------------------------------------------------

/**
 * Like the poller and the access-log collector, the latest report is pinned to
 * the process rather than the module: Next bundles `instrumentation.ts`
 * separately from the route handlers, so module-level state would leave every
 * reader looking at an empty second copy.
 */
type ScannerState = {
  latest: DiskReport | null;
  running: boolean;
  timer: NodeJS.Timeout | null;
};

const GLOBAL_KEY = Symbol.for("astrolabe.monitor.disk");

const state: ScannerState = ((globalThis as Record<symbol, unknown>)[
  GLOBAL_KEY
] ??= { latest: null, running: false, timer: null }) as ScannerState;

function runScan(): void {
  // A scan can outlast its own interval on a slow disk; overlapping walks
  // would just compete for the same I/O.
  if (state.running) return;
  state.running = true;

  try {
    state.latest = scan();
    const report = state.latest;
    console.log(
      `[disk] scanned ${report.entriesScanned} entries in ${report.durationMs}ms` +
        (report.truncated ? " (truncated)" : ""),
    );
  } catch (error) {
    console.error("[disk] scan failed:", error);
  } finally {
    state.running = false;
  }
}

export function startDiskScanner(intervalMs?: number): void {
  if (state.timer) return;

  const period = intervalMs ?? Number(process.env.DISK_SCAN_INTERVAL_MS ?? 1_800_000);

  // Deferred, not immediate: a full walk competing with application startup is
  // the worst possible moment for it.
  const initialDelay = Number(process.env.DISK_SCAN_INITIAL_DELAY_MS ?? 60_000);
  const first = setTimeout(runScan, initialDelay);
  first.unref?.();

  state.timer = setInterval(runScan, period);
  state.timer.unref?.();
  console.log(`[disk] scanning ${configuredPaths().join(", ")} every ${period / 60000}min`);
}

export function stopDiskScanner(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

export function latestDiskReport(): DiskReport | null {
  return state.latest;
}

export function diskScannerStatus(): {
  enabled: boolean;
  running: boolean;
  paths: string[];
  rootfs: string;
} {
  return {
    enabled: state.timer !== null,
    running: state.running,
    paths: configuredPaths(),
    rootfs: ROOTFS,
  };
}
