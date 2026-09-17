"use client";

import { useMemo, useState } from "react";
import type { SeriesPoint } from "@/lib/monitor/types";

/**
 * The hero visual: response time across the fleet over the selected range.
 *
 * Capped at three series on purpose. The categorical palette validates its
 * first three slots for all-pairs comparison — past that, yellow lands next to
 * orange and the pair fails the colour-vision gate. A fourth app folds into
 * "Other" rather than getting a generated hue nobody can distinguish.
 *
 * One shared y-axis, never two. Every series is milliseconds, so they belong on
 * the same scale and the comparison is honest.
 */

const VB = { w: 1200, h: 340 };
const PAD = { top: 24, right: 24, bottom: 40, left: 64 };
const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];

export type FleetSeries = {
  id: string;
  label: string;
  points: SeriesPoint[];
};

export default function FleetChart({ series }: { series: FleetSeries[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const shown = series.slice(0, 3);

  /**
   * The x axis is time, not array position.
   *
   * Each series is bucketed against its own sample density, so they do not
   * share a point count — indexing by position stretched a longer series past
   * the plot and drew it across the panel beside it. Mapping every point by its
   * timestamp onto one shared domain is also the only way a multi-series axis
   * is truthful: two lines at the same x must mean the same moment.
   */
  const domain = useMemo(() => {
    const all = shown.flatMap((s) => s.points.map((p) => p.ts));
    return all.length > 0
      ? { min: Math.min(...all), max: Math.max(...all) }
      : { min: 0, max: 1 };
  }, [shown]);

  const max = useMemo(() => {
    const peak = Math.max(
      1,
      ...shown.flatMap((s) =>
        s.points.map((p) => p.latencyP95 ?? p.latencyP50 ?? 0),
      ),
    );
    const step = peak > 2000 ? 500 : peak > 500 ? 250 : peak > 200 ? 50 : 25;
    return Math.ceil(peak / step) * step;
  }, [shown]);

  const hasData = shown.some((s) =>
    s.points.some((p) => p.latencyP50 !== null),
  );

  if (!hasData || domain.max <= domain.min) {
    return (
      <div className="chart__empty" style={{ height: 300 }}>
        Waiting for samples — the chart fills in as the poller runs.
      </div>
    );
  }

  const innerW = VB.w - PAD.left - PAD.right;
  const innerH = VB.h - PAD.top - PAD.bottom;
  const span = Math.max(1, domain.max - domain.min);
  const x = (ts: number) =>
    PAD.left + ((ts - domain.min) / span) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const path = (points: SeriesPoint[]) => {
    // Break at gaps rather than interpolating across them: a period with no
    // samples is information, and a straight line through it is a lie.
    let open = false;
    return points
      .map((p) => {
        if (p.latencyP50 === null) {
          open = false;
          return "";
        }
        const cmd = open ? "L" : "M";
        open = true;
        return `${cmd}${x(p.ts).toFixed(1)} ${y(p.latencyP50).toFixed(1)}`;
      })
      .join(" ")
      .trim();
  };

  const ticks = [0, max / 2, max];
  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * VB.w;
    if (svgX < PAD.left || svgX > VB.w - PAD.right) return setHover(null);
    const ratio = (svgX - PAD.left) / innerW;
    setHover(domain.min + ratio * span);
  };

  /** Nearest point in a series to the hovered instant, if it is close enough. */
  const nearest = (points: SeriesPoint[], ts: number) => {
    let best: SeriesPoint | null = null;
    let bestGap = Infinity;
    for (const point of points) {
      if (point.latencyP50 === null) continue;
      const gap = Math.abs(point.ts - ts);
      if (gap < bestGap) {
        bestGap = gap;
        best = point;
      }
    }
    // Beyond 4% of the window the nearest point is not what is under the
    // cursor, and labelling it would misreport the reading.
    return bestGap <= span * 0.04 ? best : null;
  };

  return (
    <div className="chart__hover">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        role="img"
        aria-label="Response time across monitored applications"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <g className="chart__grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={VB.w - PAD.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>

        {ticks.map((t) => (
          <text key={t} className="chart__tick" x={PAD.left - 12} y={y(t) + 4} textAnchor="end">
            {Math.round(t).toLocaleString("en-US")}
          </text>
        ))}
        <text className="chart__axis-title" x={PAD.left - 12} y={PAD.top - 10} textAnchor="end">
          ms
        </text>

        {shown.map((s, index) => (
          <path
            key={s.id}
            d={path(s.points)}
            fill="none"
            stroke={SLOTS[index]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hover !== null && (
          <line
            className="chart__cursor"
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + innerH}
          />
        )}

        {hover !== null &&
          shown.map((s, index) => {
            const point = nearest(s.points, hover);
            if (!point || point.latencyP50 === null) return null;
            return (
              <circle
                key={s.id}
                cx={x(point.ts)}
                cy={y(point.latencyP50)}
                r="4"
                fill={SLOTS[index]}
                stroke="var(--c-surface)"
                strokeWidth="2"
              />
            );
          })}

        <g className="chart__axis">
          <line x1={PAD.left} x2={VB.w - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} />
        </g>

        <text className="chart__tick" x={PAD.left} y={VB.h - 12}>
          {label(domain.min)}
        </text>
        <text className="chart__tick" x={VB.w - PAD.right} y={VB.h - 12} textAnchor="end">
          {label(domain.max)}
        </text>
      </svg>

      {hover !== null && (
        <div
          className="chart__tip"
          style={{ left: `${(x(hover) / VB.w) * 100}%`, top: 0 }}
        >
          <span className="chart__tip-time">{full(hover)}</span>
          {shown.map((s, index) => {
            const point = nearest(s.points, hover);
            return (
              <span key={s.id} className="chart__tip-row">
                <i className="chart__tip-key" style={{ background: SLOTS[index] }} />
                {s.label} {point?.latencyP50 !== null && point?.latencyP50 !== undefined
                  ? `${point.latencyP50} ms`
                  : "no data"}
              </span>
            );
          })}
        </div>
      )}

      {/* A legend is always present for two or more series — identity is never
          left to colour-matching alone. */}
      {shown.length > 1 && (
        <div className="legend">
          {shown.map((s, index) => (
            <span key={s.id} className="legend__item">
              <i className="legend__key" style={{ background: SLOTS[index] }} />
              {s.label}
            </span>
          ))}
          {series.length > 3 && (
            <span className="legend__item legend__item--muted">
              +{series.length - 3} more in the table below
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function label(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function full(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
