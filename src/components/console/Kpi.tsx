import type { ReactNode } from "react";

/**
 * A KPI card: label, value, and variance against the previous period.
 *
 * The value uses proportional figures — `tabular-nums` gives every digit the
 * width of a zero, which reads loose at display sizes. Tabular is reserved for
 * columns that must align vertically.
 *
 * Direction and colour are decided separately: falling latency is good, falling
 * uptime is not, so "down" is not a synonym for "bad".
 */
export default function Kpi({
  label,
  value,
  delta,
  deltaSuffix = "",
  goodDirection = "neutral",
  footer,
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  goodDirection?: "up" | "down" | "neutral";
  footer?: ReactNode;
}) {
  const significant = delta != null && Math.abs(delta) >= 0.05;
  const tone = !significant
    ? "flat"
    : goodDirection === "neutral"
      ? "flat"
      : (delta! > 0) === (goodDirection === "up")
        ? "good"
        : "bad";

  return (
    <div className="kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>

      {delta != null && (
        <span className={`kpi__delta kpi__delta--${tone}`}>
          {/* An arrow as well as a colour, so direction survives grayscale. */}
          <i aria-hidden="true">{significant ? (delta > 0 ? "↑" : "↓") : "→"}</i>
          {significant
            ? `${Math.abs(delta) < 10 ? Math.abs(delta).toFixed(1) : Math.round(Math.abs(delta))}${deltaSuffix}`
            : `no change${deltaSuffix.startsWith(" pts") ? "" : ""}`}
        </span>
      )}

      {footer && <span className="kpi__footer">{footer}</span>}
    </div>
  );
}
