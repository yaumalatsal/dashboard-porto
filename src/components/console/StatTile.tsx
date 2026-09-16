import type { ReactNode } from "react";
import Sparkline from "./Sparkline";

/**
 * Stat tile contract: label · value · optional delta · optional 12-point trend.
 *
 * The value uses proportional figures — `tabular-nums` gives every digit the
 * width of a zero, which reads loose at display sizes. Tabular is reserved for
 * columns that must align vertically (the tables and axis ticks).
 */
export default function StatTile({
  label,
  value,
  delta,
  deltaLabel,
  trend,
  trendColor,
  goodDirection = "up",
}: {
  label: string;
  value: ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  trend?: (number | null)[];
  trendColor?: string;
  /** Whether a rising value is good — decides the delta's colour. */
  goodDirection?: "up" | "down" | "neutral";
}) {
  const direction =
    delta == null || Math.abs(delta) < 0.0001
      ? "flat"
      : goodDirection === "neutral"
        ? "flat"
        : (delta > 0) === (goodDirection === "up")
          ? "up"
          : "down";

  return (
    <div className="tile">
      <div className="tile__label" title={label}>
        {label}
      </div>
      <div className="tile__value">{value}</div>

      {delta != null && (
        <div className={`tile__delta tile__delta--${direction}`}>
          {delta > 0 ? "+" : ""}
          {delta.toFixed(Math.abs(delta) < 10 ? 1 : 0)}
          {deltaLabel ? ` ${deltaLabel}` : ""}
        </div>
      )}

      {trend && trend.filter((t) => t !== null).length > 1 && (
        <Sparkline values={trend} color={trendColor} />
      )}
    </div>
  );
}
