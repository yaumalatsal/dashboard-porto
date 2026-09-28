/**
 * The machine, and what is hitting it.
 *
 * Two questions that are always asked together and answered from two different
 * places: the host's own vitals come from procfs, the request figures from
 * nginx's access logs. Keeping them on one board is deliberate — a CPU line
 * means something different next to a traffic spike than it does alone.
 *
 * Distinct from /console/traffic, which counts page views on this site using
 * the beacon. This page counts requests to every site the machine serves, and
 * sees what a page beacon cannot: API calls, bots, redirects, and errors on
 * pages that never ran a script.
 */

import Link from "next/link";
import { accessLogStatus } from "@/lib/monitor/access-log";
import { diskScannerStatus, latestDiskReport } from "@/lib/monitor/disk";
import { procPath } from "@/lib/monitor/host";
import {
  accessHosts,
  accessLabels,
  accessSeries,
  accessSummaries,
  accessSummary,
  hostSeries,
  latestHostSample,
} from "@/lib/monitor/store";
import {
  compact,
  formatBytes,
  formatDuration,
  formatRelative,
} from "@/lib/monitor/format";
import AutoRefresh from "@/components/console/AutoRefresh";
import ScopeBar from "@/components/console/ScopeBar";
import Kpi from "@/components/console/Kpi";
import StatTile from "@/components/console/StatTile";
import TrafficChart from "@/components/console/TrafficChart";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; seconds: number; buckets: number }> = {
  "1h": { label: "1 hour", seconds: 3600, buckets: 60 },
  "24h": { label: "24 hours", seconds: 86_400, buckets: 48 },
  "7d": { label: "7 days", seconds: 7 * 86_400, buckets: 56 },
};

/** Green under 70, amber under 90, red above — the usual saturation reading. */
function pressure(percent: number | null): string {
  if (percent == null) return "flat";
  if (percent >= 90) return "bad";
  if (percent >= 70) return "warn";
  return "good";
}

function percent(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(value < 10 ? 1 : 0)}%`;
}

const SERVICE_KIND: Record<string, string> = {
  container: "Container",
  volume: "Volume",
  "image-layers": "Image layers",
  "build-cache": "Build cache",
  other: "Other",
};

export default async function VpsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; host?: string }>;
}) {
  const params = await searchParams;
  const rangeKey = params.range && RANGES[params.range] ? params.range : "1h";
  const range = RANGES[rangeKey]!;

  const hostFilter = params.host && params.host !== "all" ? params.host : undefined;

  const current = latestHostSample();
  // Host history is capped at a fortnight, so a 7-day request range still gets
  // a full machine chart but never asks for rows that were pruned.
  const machine = hostSeries(Math.min(range.seconds, 14 * 86_400), 120);

  const sites = accessSummaries(range.seconds);
  const scoped = hostFilter ? accessSummary(hostFilter, range.seconds) : null;
  const points = accessSeries(range.seconds, range.buckets, hostFilter);
  const paths = accessLabels("path", range.seconds, 8, hostFilter);
  const referrers = accessLabels("referrer", range.seconds, 8, hostFilter);
  const seenHosts = accessHosts();
  const collector = accessLogStatus();

  // The last completed walk, not a fresh one: scanning on render would make
  // every page load an I/O storm on the machine being reported on.
  const disk = latestDiskReport();
  const scanner = diskScannerStatus();

  // Totals across every vhost when nothing is scoped, so the KPI row always has
  // a subject.
  const totals = scoped ?? {
    host: "all",
    requests: sites.reduce((sum, s) => sum + s.requests, 0),
    bytes: sites.reduce((sum, s) => sum + s.bytes, 0),
    visitors: sites.reduce((sum, s) => sum + s.visitors, 0),
    status: {
      s2xx: sites.reduce((sum, s) => sum + s.status.s2xx, 0),
      s3xx: sites.reduce((sum, s) => sum + s.status.s3xx, 0),
      s4xx: sites.reduce((sum, s) => sum + s.status.s4xx, 0),
      s5xx: sites.reduce((sum, s) => sum + s.status.s5xx, 0),
      other: sites.reduce((sum, s) => sum + s.status.other, 0),
    },
    errorRate: 0,
    requestsPerMin: 0,
    latencyP50Ms: null,
    latencyP95Ms: null,
    latencyP99Ms: null,
  };

  if (!scoped && totals.requests > 0) {
    const failed = totals.status.s4xx + totals.status.s5xx;
    totals.errorRate = Math.round((failed / totals.requests) * 1000) / 10;
    totals.requestsPerMin =
      Math.round((totals.requests / (range.seconds / 60)) * 10) / 10;
  }

  const trend = (pick: (row: (typeof machine)[number]) => number | null) =>
    machine.slice(-24).map(pick);

  return (
    <>
      <AutoRefresh seconds={30} />

      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Machine</p>
          <h1>The server.</h1>
        </div>
        <ScopeBar
          current={rangeKey}
          options={Object.entries(RANGES).map(([key, r]) => ({ key, label: r.label }))}
          basePath="/console/vps"
        />
      </div>

      {/* --- The machine ------------------------------------------------ */}

      {!current ? (
        <div className="console__empty">
          <h2>No host metrics</h2>
          <p>
            The console reads the machine from <code>{procPath}</code>. In Docker
            the container&rsquo;s own <code>/proc</code> describes the container,
            not the host, so the host&rsquo;s procfs has to be mounted:
          </p>
          <pre>{`volumes:
  - /proc:/host/proc:ro
  - /:/host/rootfs:ro
environment:
  - HOST_PROC=/host/proc
  - HOST_ROOTFS=/host/rootfs`}</pre>
          <p>
            The poller writes a sample every 10 seconds once that is in place.
          </p>
        </div>
      ) : (
        <section className="tile-grid" aria-label="Machine">
          <StatTile
            label="CPU"
            value={percent(current.cpuPercent)}
            trend={trend((row) => row.cpuPercent)}
            goodDirection="down"
          />
          <StatTile
            label="Memory"
            value={percent(current.memoryPercent)}
            trend={trend((row) => row.memoryPercent)}
            goodDirection="down"
          />
          <StatTile
            label="Disk"
            value={percent(current.diskPercent)}
            goodDirection="down"
          />
          <StatTile
            label="Network in"
            value={
              current.rxPerSec == null ? "—" : `${formatBytes(current.rxPerSec)}/s`
            }
            trend={trend((row) => row.rxPerSec)}
            goodDirection="neutral"
          />
          <StatTile
            label="Load (1m)"
            value={current.load1 == null ? "—" : current.load1.toFixed(2)}
            trend={trend((row) => row.load1)}
            goodDirection="down"
          />
          <StatTile
            label="Uptime"
            value={
              current.uptimeSeconds == null
                ? "—"
                : formatDuration(current.uptimeSeconds)
            }
            goodDirection="neutral"
          />
        </section>
      )}

      {current && (
        <section className="panel" aria-label="Machine detail">
          <div className="panel__head">
            <h2>Capacity</h2>
            <span className="panel__meta">now</span>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Memory</dt>
              <dd className={`detail--${pressure(current.memoryPercent)}`}>
                {current.memoryUsed != null && current.memoryTotal != null
                  ? `${formatBytes(current.memoryUsed)} of ${formatBytes(current.memoryTotal)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Disk</dt>
              <dd className={`detail--${pressure(current.diskPercent)}`}>
                {current.diskUsed != null && current.diskTotal != null
                  ? `${formatBytes(current.diskUsed)} of ${formatBytes(current.diskTotal)}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Swap</dt>
              {/* Swap in use on a web server usually means memory pressure that
                  the memory percentage alone has already absorbed. */}
              <dd className={`detail--${pressure(current.swapPercent)}`}>
                {percent(current.swapPercent)}
              </dd>
            </div>
            <div>
              <dt>Load 1 / 5 / 15</dt>
              <dd>
                {[current.load1, current.load5, current.load15]
                  .map((v) => (v == null ? "—" : v.toFixed(2)))
                  .join(" · ")}
              </dd>
            </div>
            <div>
              <dt>Network out</dt>
              <dd>
                {current.txPerSec == null
                  ? "—"
                  : `${formatBytes(current.txPerSec)}/s`}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* --- Storage ----------------------------------------------------- */}

      <div className="board-head board-head--sub">
        <div>
          <p className="console__eyebrow">Operations / Storage</p>
          <h2>Where the disk went.</h2>
        </div>
        {disk && (
          <span className="panel__meta">
            {disk.source === "host-agent" ? "host agent" : "unprivileged scan"} ·{" "}
            {formatRelative(disk.ts)} · {(disk.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {!disk ? (
        <div className="console__empty">
          <h2>No scan yet</h2>
          <p>
            {scanner.enabled
              ? "A filesystem walk is expensive, so the first one runs a minute after boot and then every half hour. Check back shortly."
              : "The disk scanner is not running."}
          </p>
          <p>
            Scanning <code>{scanner.paths.join("</code>, <code>")}</code> under{" "}
            <code>{scanner.rootfs}</code>.
          </p>
        </div>
      ) : (
        <>
          {disk.truncated && (
            <div className="console__empty console__empty--warn">
              <h2>The scan was cut short</h2>
              <p>
                It stopped after {compact(disk.entriesScanned)} entries or its
                time budget, so every figure below is a <em>floor</em>, not a
                total. Docker&rsquo;s <code>overlay2</code> can hold millions of
                files. Raise <code>DISK_SCAN_ENTRY_BUDGET</code> or{" "}
                <code>DISK_SCAN_TIME_BUDGET_MS</code> to scan further.
              </p>
            </div>
          )}

          {disk.unreadable.length > 0 && (
            <div className="console__empty console__empty--warn">
              <h2>Some paths cannot be read</h2>
              <ul>
                {disk.unreadable.map((entry) => (
                  <li key={entry.path}>
                    <code>{entry.path}</code> — {entry.error}
                  </li>
                ))}
              </ul>
              <p>
                {disk.source === "host-agent"
                  ? "Even as root some paths refuse: a vanished temp directory, a filesystem that went away mid-walk."
                  : "This scan ran unprivileged, so root-only directories — /var/lib/containerd and /home among them — read as empty. Install scripts/disk-report.py as a root cron job to measure them without giving the web app that access."}{" "}
                What cannot be seen is named here rather than quietly left out
                of the totals.
              </p>
            </div>
          )}

          <section className="panel" aria-label="Storage by root">
            <div className="panel__head">
              <h2>By location</h2>
              <span className="panel__meta">bytes on disk</span>
            </div>
            {/* A root the walk was refused entry to reports zero, which reads
                as "empty" when it means "invisible". Say which it is. */}
            <SizeList
              rows={disk.roots.map((r) => ({
                label: r.truncated ? `${r.path} — incomplete` : r.path,
                bytes: r.bytes,
              }))}
            />
          </section>

          <section className="board-grid">
            <div className="panel">
              <div className="panel__head">
                <h2>Largest directories</h2>
              </div>
              <SizeList
                rows={disk.topDirectories.map((d) => ({ label: d.path, bytes: d.bytes }))}
              />
            </div>
            <div className="panel">
              <div className="panel__head">
                <h2>Largest files</h2>
              </div>
              <SizeList
                rows={disk.topFiles.map((f) => ({ label: f.path, bytes: f.bytes }))}
                empty="No individual file stood out."
              />
            </div>
          </section>

          {disk.services.length > 0 && (
            <section className="panel" aria-label="Storage by service">
              <div className="panel__head">
                <h2>By service</h2>
                <span className="panel__meta">from Docker&rsquo;s data root</span>
              </div>
              <table className="ctable">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kind</th>
                    <th className="ctable__num">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {disk.services.map((service) => (
                    <tr key={`${service.kind}:${service.name}`}>
                      <td>{service.name}</td>
                      <td>{SERVICE_KIND[service.kind]}</td>
                      <td className="ctable__num">{formatBytes(service.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="panel__note">
                Container names come from each container&rsquo;s own
                <code> config.v2.json</code>. Individual image layers cannot be
                attributed to a service without the daemon&rsquo;s index, so they
                are reported as one figure rather than guessed at.
              </p>
            </section>
          )}
        </>
      )}

      {/* --- Requests ---------------------------------------------------- */}

      <div className="board-head board-head--sub">
        <div>
          <p className="console__eyebrow">Operations / Requests</p>
          <h2>What reaches the machine.</h2>
        </div>
      </div>

      {collector.unreadable.length > 0 && (
        <div className="console__empty console__empty--warn">
          <h2>Some logs cannot be read</h2>
          <ul>
            {collector.unreadable.map((entry) => (
              <li key={entry.target}>
                <code>{entry.target}</code> — {entry.error}
              </li>
            ))}
          </ul>
          <p>
            The console runs unprivileged and nginx logs are commonly{" "}
            <code>root:adm 0640</code>. An unreadable log is indistinguishable
            from a site nobody visited, which is why it is reported here rather
            than shown as zero.
          </p>
        </div>
      )}

      {seenHosts.length > 1 && (
        <div className="site-tabs" role="group" aria-label="Virtual host">
          <Link
            href={`/console/vps?range=${rangeKey}`}
            className="site-tab"
            aria-current={hostFilter === undefined ? "true" : undefined}
          >
            All hosts
          </Link>
          {seenHosts.map((host) => (
            <Link
              key={host}
              href={`/console/vps?range=${rangeKey}&host=${encodeURIComponent(host)}`}
              className="site-tab"
              aria-current={hostFilter === host ? "true" : undefined}
            >
              {host}
            </Link>
          ))}
        </div>
      )}

      {totals.requests === 0 ? (
        <div className="console__empty">
          <h2>No requests recorded</h2>
          <p>
            Traffic is read from nginx&rsquo;s access logs, which must use the{" "}
            <code>json_analytics</code> format from{" "}
            <code>docker/nginx.conf</code>. Add it to the <code>http</code> block
            of any other nginx on the machine and point each server at it:
          </p>
          <pre>{`access_log /var/log/nginx/access.json.log json_analytics;`}</pre>
          <p>
            {collector.files.length > 0
              ? `Tailing ${collector.files.length} file(s); ${compact(collector.linesParsed)} line(s) parsed so far.`
              : `No log files matched in ${collector.directories.join(", ") || "any configured directory"}.`}{" "}
            A minute is written once it closes, so the first figures appear
            about a minute after the first request.
          </p>
        </div>
      ) : (
        <>
          <section className="kpi-row" aria-label="Request metrics">
            <Kpi
              label="Requests"
              value={compact(totals.requests)}
              footer={
                <span className="kpi__note">
                  {totals.requestsPerMin}/min over {range.label}
                </span>
              }
            />
            <Kpi
              label="Error rate"
              value={`${totals.errorRate}%`}
              footer={
                <span className="kpi__note">
                  {compact(totals.status.s4xx)} client · {compact(totals.status.s5xx)} server
                </span>
              }
            />
            <Kpi
              label="Latency p95"
              value={
                totals.latencyP95Ms == null ? "—" : `${compact(totals.latencyP95Ms)} ms`
              }
              footer={
                <span className="kpi__note">
                  p50 {totals.latencyP50Ms ?? "—"} · p99 {totals.latencyP99Ms ?? "—"}
                </span>
              }
            />
            <Kpi
              label="Transferred"
              value={formatBytes(totals.bytes)}
              footer={<span className="kpi__note">response bytes</span>}
            />
          </section>

          <section className="board-hero">
            <div className="panel panel--hero">
              <div className="panel__head">
                <h2>Requests over time</h2>
                <span className="panel__meta">
                  {hostFilter ?? "all hosts"} · {range.label}
                </span>
              </div>
              {/* The chart speaks views/visitors; requests and their distinct
                  clients are the same two quantities on one axis. */}
              <TrafficChart
                points={points.map((p) => ({
                  ts: p.ts,
                  views: p.requests,
                  visitors: p.visitors,
                }))}
              />
            </div>

            <aside className="panel panel--insights" aria-label="Notes">
              <div className="panel__head">
                <h2>What this counts</h2>
              </div>
              <ul className="insight-list">
                <li className="insight insight--good">
                  <i aria-hidden="true" />
                  Every request nginx served, including API calls, bots and
                  errors — not only pages that ran a script.
                </li>
                <li className="insight insight--good">
                  <i aria-hidden="true" />
                  Addresses are hashed with the same daily-rotating salt as the
                  beacon. Nothing identifying is stored.
                </li>
                <li className="insight insight--warn">
                  <i aria-hidden="true" />
                  Visitors are counted per minute and summed, so one person
                  browsing for ten minutes counts ten times. Treat it as a floor
                  on activity, not a headcount.
                </li>
              </ul>
            </aside>
          </section>

          {!hostFilter && sites.length > 0 && (
            <section className="panel" aria-label="By host">
              <div className="panel__head">
                <h2>By site</h2>
                <span className="panel__meta">{range.label}</span>
              </div>
              <table className="ctable">
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>Requests</th>
                    <th>/min</th>
                    <th>Errors</th>
                    <th>p95</th>
                    <th>Transferred</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => (
                    <tr key={site.host}>
                      <td>
                        <Link
                          href={`/console/vps?range=${rangeKey}&host=${encodeURIComponent(site.host)}`}
                        >
                          {site.host}
                        </Link>
                      </td>
                      <td>{compact(site.requests)}</td>
                      <td>{site.requestsPerMin}</td>
                      <td className={site.errorRate >= 5 ? "cell--bad" : undefined}>
                        {site.errorRate}%
                      </td>
                      <td>{site.latencyP95Ms == null ? "—" : `${site.latencyP95Ms} ms`}</td>
                      <td>{formatBytes(site.bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="board-grid">
            <div className="panel">
              <div className="panel__head">
                <h2>Top paths</h2>
              </div>
              <LabelList rows={paths} />
            </div>
            <div className="panel">
              <div className="panel__head">
                <h2>Referrers</h2>
              </div>
              <LabelList rows={referrers} empty="Direct traffic only." />
            </div>
          </section>
        </>
      )}
    </>
  );
}

/**
 * The same ranked-bar treatment as BreakdownList, which is typed to page views.
 * Scaled against the leader rather than the total so the smaller rows stay
 * comparable to each other instead of collapsing to nothing.
 */
function LabelList({
  rows,
  empty = "No data for this period.",
}: {
  rows: { label: string; count: number }[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="panel__empty">{empty}</p>;

  const top = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <ul className="breakdown">
      {rows.map((row) => (
        <li key={row.label} className="breakdown__row">
          <span
            className="breakdown__bar"
            style={{ width: `${(row.count / top) * 100}%` }}
            aria-hidden="true"
          />
          <span className="breakdown__label" title={row.label}>
            {row.label}
          </span>
          <span className="breakdown__share">
            {total > 0 ? ((row.count / total) * 100).toFixed(1) : "0.0"}%
          </span>
          <span className="breakdown__count">{compact(row.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The same ranked bars, measured in bytes.
 *
 * Paths are shown from the right when they overflow: the tail of
 * `/var/lib/docker/volumes/console-data/_data` is the part that identifies it,
 * and truncating the front is what a person reading a path list wants.
 */
function SizeList({
  rows,
  empty = "Nothing found here.",
}: {
  rows: { label: string; bytes: number }[];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="panel__empty">{empty}</p>;

  const top = Math.max(...rows.map((r) => r.bytes), 1);
  const total = rows.reduce((sum, r) => sum + r.bytes, 0);

  return (
    <ul className="breakdown">
      {rows.map((row) => (
        <li key={row.label} className="breakdown__row">
          <span
            className="breakdown__bar"
            style={{ width: `${(row.bytes / top) * 100}%` }}
            aria-hidden="true"
          />
          <span className="breakdown__label breakdown__label--path" title={row.label}>
            {row.label}
          </span>
          <span className="breakdown__share">
            {total > 0 ? ((row.bytes / total) * 100).toFixed(1) : "0.0"}%
          </span>
          <span className="breakdown__count">{formatBytes(row.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}
