#!/usr/bin/env python3
"""
Measure what is filling the disk, and write it where the console can read it.

Why this exists as a separate script rather than as part of the app: the
directories that actually fill a VPS — /var/lib/containerd, /home — are mode
0700. Reading them needs root. Granting root-equivalent read to a Next.js
process that serves public pages would put every secret on the machine
(/etc/shadow, SSH keys, every other app's .env) one bug away from the
internet.

So the privilege lives here instead: a short script with no network access, no
arguments from anywhere untrusted, and one job. It writes a JSON report to a
world-readable file; the console reads that file and stays unprivileged.

This script only ever READS the filesystem it measures. The single path it
writes is its own output.

Install (as root):

    install -m 0755 disk-report.py /usr/local/bin/disk-report
    mkdir -p /var/lib/dashboard-porto
    disk-report                       # once, to check it works
    # then, in /etc/cron.d/dashboard-disk-report:
    # */30 * * * * root /usr/local/bin/disk-report

The output shape matches the console's own in-process scanner, so the board
renders either without knowing which produced it.
"""

from __future__ import annotations

import json
import os
import sys
import time

# Host paths to measure. Kept in step with DISK_SCAN_PATHS in docker-compose.yml.
PATHS = os.environ.get(
    "DISK_SCAN_PATHS",
    "/var/lib/containerd,/var/lib/docker,/var/log,/home,/var/www,/opt,/tmp",
).split(",")

OUTPUT = os.environ.get("DISK_REPORT_PATH", "/var/lib/dashboard-porto/disk.json")

# How deep a directory is still listed individually. Sizes always recurse.
DEPTH = int(os.environ.get("DISK_SCAN_DEPTH", "3"))

TOP_DIRS = 15
TOP_FILES = 15

# Pseudo-filesystems: measuring them is meaningless and /proc is a trap.
SKIP = {"proc", "sys", "dev", "run", "lost+found"}


def walk(root: str, dev: int, depth: int, state: dict) -> int:
    """
    Bytes actually occupied under `root`, recording directories to DEPTH.

    st_blocks * 512, not st_size: that is what the filesystem gave the file,
    which is the question being asked and what `du` answers. A sparse file
    makes st_size a fiction.
    """
    total = 0
    try:
        entries = list(os.scandir(root))
    except OSError as err:
        if err.errno != 2 and len(state["unreadable"]) < 10:  # 2 == ENOENT
            state["unreadable"].append({"path": root, "error": err.strerror or str(err)})
        return 0

    for entry in entries:
        if entry.name in SKIP:
            continue
        try:
            # follow_symlinks=False: a link into another tree would bill those
            # bytes here as well as where they live, and links invite cycles.
            st = entry.stat(follow_symlinks=False)
        except OSError:
            continue

        # Staying on one device keeps another mount off this disk's total.
        if st.st_dev != dev:
            continue

        state["entries"] += 1

        if entry.is_dir(follow_symlinks=False):
            size = walk(entry.path, dev, depth + 1, state)
            total += size
            if depth < DEPTH:
                state["dirs"].append({"path": entry.path, "bytes": size})
        elif entry.is_file(follow_symlinks=False):
            # A file with two names must only be counted once.
            if st.st_nlink > 1:
                key = (st.st_dev, st.st_ino)
                if key in state["seen"]:
                    continue
                state["seen"].add(key)
            size = st.st_blocks * 512
            total += size
            state["files"].append({"path": entry.path, "bytes": size})

    return total


def container_name(path: str) -> str:
    """
    A container's name from its own config, not from the Docker daemon.

    Asking the daemon would mean talking to its socket, and the point of this
    script is to keep that out of the picture entirely.
    """
    fallback = os.path.basename(path)[:12]
    try:
        with open(os.path.join(path, "config.v2.json"), encoding="utf-8") as handle:
            name = json.load(handle).get("Name", "")
        return name.lstrip("/") or fallback
    except (OSError, ValueError):
        return fallback


# Bulk stores belonging to a runtime rather than to any one service. Individual
# layers cannot be attributed without the daemon's index, and one honest total
# beats a breakdown that is guessed at.
BULK = {
    "/docker/overlay2": ("Image & container layers", "image-layers"),
    "/docker/buildkit": ("Build cache", "build-cache"),
    "/containerd/io.containerd.snapshotter.v1.overlayfs": (
        "Image layers (containerd snapshots)",
        "image-layers",
    ),
    "/containerd/io.containerd.content.v1.content": (
        "Image blobs (containerd content store)",
        "image-layers",
    ),
}


def services(dirs: list[dict]) -> list[dict]:
    found = []
    for entry in dirs:
        path = entry["path"]
        parent, base = os.path.split(path)

        if parent.endswith("/docker/containers"):
            found.append(
                {"name": container_name(path), "kind": "container", "bytes": entry["bytes"]}
            )
        elif parent.endswith("/docker/volumes") and base != "backingFsBlockDev":
            # Docker creates backingFsBlockDev alongside real volumes; it isn't one.
            found.append({"name": base, "kind": "volume", "bytes": entry["bytes"]})
        else:
            for suffix, (name, kind) in BULK.items():
                if path.endswith(suffix):
                    found.append({"name": name, "kind": kind, "bytes": entry["bytes"]})
                    break

    return sorted(found, key=lambda s: -s["bytes"])


def main() -> int:
    started = time.time()
    state = {"dirs": [], "files": [], "unreadable": [], "seen": set(), "entries": 0}
    roots = []

    for target in (p.strip() for p in PATHS):
        if not target:
            continue
        try:
            st = os.stat(target)
        except OSError as err:
            if err.errno != 2:  # absent is not a fault worth reporting
                state["unreadable"].append({"path": target, "error": err.strerror or str(err)})
            continue
        if not os.path.isdir(target):
            continue

        before = len(state["unreadable"])
        size = walk(target, st.st_dev, 1, state)
        roots.append(
            {
                "path": target,
                "bytes": size,
                # Denials below this root mean its total is a floor, not a total.
                **({"truncated": True} if len(state["unreadable"]) > before else {}),
            }
        )

    by_size = lambda rows: sorted(rows, key=lambda r: -r["bytes"])  # noqa: E731

    report = {
        "ts": int(started * 1000),
        "durationMs": int((time.time() - started) * 1000),
        "roots": by_size(roots),
        "topDirectories": by_size(state["dirs"])[:TOP_DIRS],
        "topFiles": by_size(state["files"])[:TOP_FILES],
        "services": services(state["dirs"])[:20],
        "truncated": any(r.get("truncated") for r in roots),
        "entriesScanned": state["entries"],
        "unreadable": state["unreadable"],
        "source": "host-agent",
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    # Write then rename, so a reader never sees a half-written file.
    temporary = f"{OUTPUT}.tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(report, handle)
    os.chmod(temporary, 0o644)
    os.replace(temporary, OUTPUT)

    print(
        f"[disk-report] {state['entries']} entries in {report['durationMs']}ms -> {OUTPUT}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
