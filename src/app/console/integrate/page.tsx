/**
 * How a new application gets onto this console.
 *
 * Every other page shows what the console knows. This one shows why it was
 * cheap to find out — which is the part that matters to anyone weighing up
 * whether the same thing could be done for their own estate.
 *
 * The claim being made is narrow and checkable: adding an application is a
 * configuration edit, not a code change. The evidence is on the page — five
 * applications, written by different people at different times in different
 * shapes, all rendering through one pipeline.
 */

import Link from "next/link";
import { loadConfig } from "@/lib/monitor/config";
import { currentSnapshots } from "@/lib/monitor/poller";
import { listAdapters } from "@/lib/monitor/adapters";
import Status from "@/components/console/Status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Adding a service",
  description:
    "How an application is added to this console: one configuration entry, no code.",
};

export default async function IntegratePage() {
  const { sites } = loadConfig();
  const snapshots = currentSnapshots();
  const adapters = listAdapters();

  const byId = new Map(snapshots.map((s) => [s.id, s]));

  // What each application actually returned, rather than what it was meant
  // to. The variety is the argument.
  const rows = sites.map((site) => {
    const snap = byId.get(site.id);
    return {
      site,
      health: snap?.health ?? "unknown",
      metrics: snap?.metrics.length ?? 0,
      services: snap?.services.length ?? 0,
      groups: new Set((snap?.metrics ?? []).map((m) => m.group ?? "General")).size,
    };
  });

  const totalMetrics = rows.reduce((n, r) => n + r.metrics, 0);

  return (
    <>
      <div className="board-head">
        <div>
          <p className="console__eyebrow">Operations / Integration</p>
          <h1>Adding a service.</h1>
        </div>
      </div>

      <p className="console__lede">
        Every application on this console reports its health in a different
        shape, because each was written separately and none was written for
        this console. None of them was changed to appear here. A new one is an
        entry in a file, and the page it produces is the same page you have
        been reading.
      </p>

      <section className="kpi-row" aria-label="Integration summary">
        <div className="kpi">
          <span className="kpi__label">Applications</span>
          <span className="kpi__value">{rows.length}</span>
          <span className="kpi__footer">
            <span className="kpi__note">one config entry each</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Metrics normalised</span>
          <span className="kpi__value">{totalMetrics}</span>
          <span className="kpi__footer">
            <span className="kpi__note">across every shape below</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Adapters</span>
          <span className="kpi__value">{adapters.length}</span>
          <span className="kpi__footer">
            <span className="kpi__note">most apps need none</span>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi__label">Lines of code per app</span>
          <span className="kpi__value">0</span>
          <span className="kpi__footer">
            <span className="kpi__note">that is the point</span>
          </span>
        </div>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>The whole change</h2>
          <span className="panel__meta">sites.json</span>
        </div>
        <p className="console__note" style={{ marginTop: 0 }}>
          This is everything needed to put an application on the wall, give it
          a detail page, start recording its uptime and begin charting whatever
          it reports. The poller reconciles against this file every thirty
          seconds, so a hand edit starts polling without a restart.
        </p>
        <pre className="code-block">
          <code>{`{
  "id": "ironclad",
  "label": "Ironclad",
  "url": "https://ironclad.example",
  "adapter": "monitor-api",
  "auth": { "header": "X-Monitor-Token", "env": "IRONCLAD_TOKEN" },
  "probes": [
    { "name": "health",  "url": "https://ironclad.example/api/health",          "intervalSeconds": 30 },
    { "name": "metrics", "url": "https://ironclad.example/api/monitor/metrics", "intervalSeconds": 300 }
  ]
}`}</code>
        </pre>
        <p className="console__note">
          The token is named, never written here. It is read from the
          environment at poll time, so this file carries no secret and rotating
          one means restarting a process rather than editing committed config.
        </p>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>What is actually plugged in</h2>
          <span className="panel__meta">live</span>
        </div>
        <div className="ctable__wrap">
          <table className="ctable">
            <thead>
              <tr>
                <th>Application</th>
                <th>State</th>
                <th>Adapter</th>
                <th className="ctable__num">Probes</th>
                <th className="ctable__num">Services</th>
                <th className="ctable__num">Metrics</th>
                <th className="ctable__num">Groups</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ site, health, metrics, services, groups }) => (
                <tr key={site.id}>
                  <td>
                    <Link href={`/console/${site.id}`} className="ctable__link">
                      {site.label}
                    </Link>
                  </td>
                  <td>
                    <Status health={health} />
                  </td>
                  <td style={{ color: "var(--c-muted)" }}>
                    {site.adapter ?? "generic"}
                  </td>
                  <td className="ctable__num">{site.probes.length}</td>
                  <td className="ctable__num">{services}</td>
                  <td className="ctable__num">{metrics}</td>
                  <td className="ctable__num">{groups}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="console__note">
          Different services, different metric counts, different groupings —
          one renderer. Nothing in the console knows what a permit is, or a
          course, or a ventilator.
        </p>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>When an adapter is needed</h2>
          <span className="panel__meta">usually it is not</span>
        </div>
        <div className="board-grid">
          {adapters.map((adapter) => (
            <div key={adapter.id} className="panel">
              <div className="panel__head">
                <h2>{adapter.id}</h2>
              </div>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--c-ink-2)" }}>
                {adapter.description}
              </p>
            </div>
          ))}
        </div>
        <p className="console__note">
          The default adapter reads the shape of whatever JSON comes back and
          infers health, services and metrics from it. An application nobody
          has ever seen renders something useful immediately; a bespoke adapter
          is for the genuinely unusual, and is about thirty lines.
        </p>
      </section>

      <section className="console__section">
        <div className="console__section-head">
          <h2>What the application has to provide</h2>
        </div>
        <ul className="insight-list">
          <li className="insight insight--good">
            <i aria-hidden="true" />
            <span>
              An endpoint returning JSON. Any shape. <code>status</code>,{" "}
              <code>state</code> or <code>health</code> is read if present, and
              assumed healthy if the request succeeded and none is given.
            </span>
          </li>
          <li className="insight insight--good">
            <i aria-hidden="true" />
            <span>
              Optionally a <code>services</code> array, and optionally grouped
              counters. Both are inferred rather than required.
            </span>
          </li>
          <li className="insight insight--warn">
            <i aria-hidden="true" />
            <span>
              Nothing else. No SDK, no agent, no library, no change to how the
              application is built or deployed.
            </span>
          </li>
        </ul>
      </section>

      <p className="console__note">
        The same contract is documented in <code>docs/console.md</code>, and the
        adapters themselves are in <code>src/lib/monitor/adapters.ts</code>.
      </p>
    </>
  );
}
