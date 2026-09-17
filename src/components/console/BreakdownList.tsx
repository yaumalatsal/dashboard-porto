import type { TrafficRow } from "@/lib/monitor/store";
import { compact } from "@/lib/monitor/format";

/**
 * A ranked breakdown: label, share as a bar behind the row, and the count.
 *
 * The bar is drawn as a background on the row rather than as a separate chart
 * column, so the proportion is readable without the eye travelling — and there
 * is no second container around it.
 */
export default function BreakdownList({
  rows,
  total,
}: {
  rows: TrafficRow[];
  total: number;
}) {
  if (rows.length === 0) {
    return <p className="panel__empty">Nothing recorded in this window.</p>;
  }

  const top = Math.max(...rows.map((r) => r.views), 1);

  return (
    <ul className="breakdown">
      {rows.map((row) => {
        const share = total > 0 ? (row.views / total) * 100 : 0;
        return (
          <li key={row.label} className="breakdown__row">
            {/* Scaled against the leader, not the total, so the smaller rows
                stay comparable to each other instead of collapsing to nothing. */}
            <span
              className="breakdown__bar"
              style={{ width: `${(row.views / top) * 100}%` }}
              aria-hidden="true"
            />
            <span className="breakdown__label" title={row.label}>
              {row.label}
            </span>
            <span className="breakdown__share">{share.toFixed(1)}%</span>
            <span className="breakdown__count">{compact(row.views)}</span>
          </li>
        );
      })}
    </ul>
  );
}
