import type { HistogramBin } from "@/lib/monitor/store";
import { compact } from "@/lib/monitor/format";

/**
 * The distribution of the response times.
 *
 * p50 and p95 do not show whether the distribution has one peak or two. A
 * service that answers in 40ms from a cache and in 900ms from the database has
 * two peaks, and the work needed to fix that is different from the work needed
 * to fix one slow peak.
 */
export default function Histogram({ bins }: { bins: HistogramBin[] }) {
  const total = bins.reduce((sum, b) => sum + b.count, 0);

  if (total === 0) {
    return <p className="panel__empty">No samples for this period.</p>;
  }

  const peak = Math.max(...bins.map((b) => b.count), 1);

  return (
    <ul className="histogram">
      {bins.map((bin) => {
        const share = (bin.count / total) * 100;
        return (
          <li key={bin.from} className="histogram__row">
            <span className="histogram__label">
              {bin.to === null ? `${bin.from}+ ms` : `${bin.from}–${bin.to} ms`}
            </span>
            <span className="histogram__track">
              <span
                className="histogram__bar"
                style={{ width: `${(bin.count / peak) * 100}%` }}
              />
            </span>
            <span className="histogram__share">{share.toFixed(1)}%</span>
            <span className="histogram__count">{compact(bin.count)}</span>
          </li>
        );
      })}
    </ul>
  );
}
