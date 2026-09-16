import { formatUptime } from "@/lib/monitor/format";

/**
 * 90 days of uptime, one bar per day.
 *
 * A day with no samples renders in the grid colour, not in green or red —
 * "we weren't watching" and "it was up" must never look the same.
 */
export default function UptimeStrip({
  days,
}: {
  days: { day: number; upRatio: number | null; samples: number }[];
}) {
  return (
    <div
      className="uptime-strip"
      role="img"
      aria-label={describe(days)}
    >
      {days.map((d) => {
        const cls =
          d.upRatio === null
            ? "empty"
            : d.upRatio >= 0.999
              ? "ok"
              : d.upRatio >= 0.95
                ? "partial"
                : "bad";

        return (
          <span
            key={d.day}
            className={`uptime-strip__day${cls === "ok" ? "" : ` uptime-strip__day--${cls}`}`}
            title={
              d.upRatio === null
                ? `${formatDay(d.day)} — no data`
                : `${formatDay(d.day)} — ${formatUptime(d.upRatio)} (${d.samples} samples)`
            }
          />
        );
      })}
    </div>
  );
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function describe(days: { upRatio: number | null }[]): string {
  const observed = days.filter((d) => d.upRatio !== null);
  if (observed.length === 0) return "Uptime history: no data yet";
  const bad = observed.filter((d) => (d.upRatio ?? 1) < 0.999).length;
  return `Uptime over ${observed.length} observed days: ${bad} day${bad === 1 ? "" : "s"} with downtime`;
}
