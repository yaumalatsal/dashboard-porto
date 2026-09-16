import { configPath } from "@/lib/monitor/config";

/**
 * Shown when no apps are registered. Rather than an empty box, it hands over
 * the exact config to paste — onboarding the first app is the only thing
 * anyone wants to do from this screen.
 */
export default function EmptyState() {
  const example = JSON.stringify(
    {
      sites: [
        {
          id: "yourday",
          label: "YourDay LMS",
          url: "https://yourday.duckdns.org",
          blurb: "Learning management system",
          adapter: "monitor-api",
          auth: { header: "X-Monitor-Token", env: "MONITOR_API_TOKEN" },
          probes: [
            {
              name: "health",
              url: "https://yourday.duckdns.org/api/health",
              intervalSeconds: 30,
            },
            {
              name: "services",
              url: "https://yourday.duckdns.org/api/monitor/services",
              intervalSeconds: 60,
            },
            {
              name: "metrics",
              url: "https://yourday.duckdns.org/api/monitor/metrics",
              intervalSeconds: 300,
            },
          ],
        },
      ],
    },
    null,
    2,
  );

  return (
    <>
      <p className="console__eyebrow">Operations / Setup</p>
      <h1>No applications registered yet.</h1>

      <div className="console__empty">
        <h2>Add your first app</h2>
        <p>
          Write <code>sites.json</code> at <code>{configPath}</code>, or POST to{" "}
          <code>/api/monitor/sites</code> with a <code>baseUrl</code> to derive
          the standard probes automatically.
        </p>
        <pre>{example}</pre>
      </div>
    </>
  );
}
