"use client";

import { useState } from "react";
import type { TrafficPoint } from "@/lib/monitor/store";

/**
 * Views over time as columns, with visitors as a line on the same axis.
 *
 * Both are counts of the same kind of thing and visitors are always a subset of
 * views, so one axis is honest — this is not a dual-scale chart. Columns for
 * the total because they read as discrete per-bucket quantities; a line for
 * visitors because the comparison is about shape.
 */

const VB = { w: 1200, h: 320 };
const PAD = { top: 24, right: 24, bottom: 40, left: 56 };

export default function TrafficChart({ points }: { points: TrafficPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.views));
  const step = max > 1000 ? 500 : max > 100 ? 50 : max > 20 ? 10 : 5;
  const ceiling = Math.ceil(max / step) * step;

  const innerW = VB.w - PAD.left - PAD.right;
  const innerH = VB.h - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, points.length);
  // Capped so a short window does not produce slabs, with a 2px gap of surface
  // between neighbours doing the separating rather than a stroke.
  const barW = Math.max(2, Math.min(24, slot - 2));

  const x = (i: number) => PAD.left + i * slot + slot / 2;
  const y = (v: number) => PAD.top + innerH - (v / ceiling) * innerH;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.visitors).toFixed(1)}`)
    .join(" ");

  const ticks = [0, ceiling / 2, ceiling];

  return (
    <div className="chart__hover">
      <svg
        className="chart__svg"
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        role="img"
        aria-label="Page views and visitors over time"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const svgX = ((e.clientX - rect.left) / rect.width) * VB.w;
          const i = Math.floor((svgX - PAD.left) / slot);
          setHover(i >= 0 && i < points.length ? i : null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <g className="chart__grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={VB.w - PAD.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        {ticks.map((t) => (
          <text key={t} className="chart__tick" x={PAD.left - 10} y={y(t) + 4} textAnchor="end">
            {Math.round(t)}
          </text>
        ))}

        {points.map((p, i) => (
          <rect
            key={p.ts}
            x={x(i) - barW / 2}
            y={y(p.views)}
            width={barW}
            height={Math.max(0, PAD.top + innerH - y(p.views))}
            rx="2"
            fill="var(--series-accent)"
            fillOpacity={hover === i ? 0.95 : 0.55}
          />
        ))}

        <path
          d={line}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g className="chart__axis">
          <line x1={PAD.left} x2={VB.w - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} />
        </g>

        <text className="chart__tick" x={PAD.left} y={VB.h - 12}>
          {label(points[0]?.ts)}
        </text>
        <text className="chart__tick" x={VB.w - PAD.right} y={VB.h - 12} textAnchor="end">
          {label(points[points.length - 1]?.ts)}
        </text>
      </svg>

      {hover !== null && points[hover] && (
        <div className="chart__tip" style={{ left: `${(x(hover) / VB.w) * 100}%`, top: 0 }}>
          <span className="chart__tip-time">{full(points[hover].ts)}</span>
          <span className="chart__tip-row">
            <i className="chart__tip-key" style={{ background: "var(--series-accent)" }} />
            {points[hover].views} views
          </span>
          <span className="chart__tip-row">
            <i className="chart__tip-key" style={{ background: "var(--series-1)" }} />
            {points[hover].visitors} visitors
          </span>
        </div>
      )}

      <div className="legend">
        <span className="legend__item">
          <i className="legend__key" style={{ background: "var(--series-accent)" }} />
          Views
        </span>
        <span className="legend__item">
          <i className="legend__key" style={{ background: "var(--series-1)" }} />
          Visitors
        </span>
      </div>
    </div>
  );
}

function label(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit" });
}
function full(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
