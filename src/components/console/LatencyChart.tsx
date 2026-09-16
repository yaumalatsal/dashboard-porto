"use client";

import { useMemo, useRef, useState } from "react";
import type { SeriesPoint } from "@/lib/monitor/types";

/**
 * Response time over the selected window: average as a line with a 10% wash
 * beneath it, peak as a second line.
 *
 * Two series, one shared axis — never a second y-scale. Both are milliseconds,
 * so they belong on the same scale and the comparison is honest.
 */

/**
 * Geometry is expressed in viewBox units and scaled by width.
 *
 * The viewBox aspect ratio is chosen to be wide (1260x200) because the SVG
 * renders with `height: auto`: with a fixed height attribute instead, the
 * default `xMidYMid meet` scaled the drawing to the height and letterboxed it
 * into the middle of the card with empty gutters either side.
 */
const VB = { w: 1260, h: 200 };
const PAD = { top: 16, right: 24, bottom: 34, left: 62 };

type Props = {
  points: SeriesPoint[];

};

export default function LatencyChart({ points }: Props) {
  const height = VB.h;
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = VB.w;

  const withData = useMemo(
    () => points.filter((p) => p.latencyP50 !== null),
    [points],
  );

  const max = useMemo(() => {
    const peak = Math.max(
      ...withData.map((p) => p.latencyP95 ?? p.latencyP50 ?? 0),
      1,
    );
    // Round the axis up to a clean number so ticks read 0 / 250 / 500.
    const step = peak > 2000 ? 500 : peak > 500 ? 250 : peak > 200 ? 50 : 25;
    return Math.ceil(peak / step) * step;
  }, [withData]);

  // A single populated bucket still gets drawn, as a marker. Declaring "no
  // data" while the sample counter beside the chart reads 46 is a worse lie
  // than a chart with one point on it.
  if (withData.length === 0) {
    return (
      <div className="chart__empty">
        No samples in this window yet — the chart fills in as the poller runs.
      </div>
    );
  }

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const line = (key: "latencyP50" | "latencyP95") => {
    // Break the path at gaps rather than interpolating across them — a period
    // with no samples is information, not a straight line between neighbours.
    let started = false;
    return points
      .map((p, i) => {
        const value = p[key];
        if (value === null) {
          started = false;
          return "";
        }
        const cmd = started ? "L" : "M";
        started = true;
        return `${cmd}${x(i).toFixed(1)} ${y(value).toFixed(1)}`;
      })
      .join(" ")
      .trim();
  };

  const areaPath = (() => {
    const segs: string[] = [];
    let run: { i: number; v: number }[] = [];
    const flush = () => {
      if (run.length < 2) {
        run = [];
        return;
      }
      const head = run
        .map((r, i) => `${i === 0 ? "M" : "L"}${x(r.i).toFixed(1)} ${y(r.v).toFixed(1)}`)
        .join(" ");
      const baseline = `L${x(run[run.length - 1].i).toFixed(1)} ${y(0).toFixed(1)} L${x(run[0].i).toFixed(1)} ${y(0).toFixed(1)} Z`;
      segs.push(`${head} ${baseline}`);
      run = [];
    };
    points.forEach((p, i) => {
      if (p.latencyP50 === null) flush();
      else run.push({ i, v: p.latencyP50 });
    });
    flush();
    return segs.join(" ");
  })();

  const ticks = [0, max / 2, max];
  const hoveredPoint = hover !== null ? points[hover] : null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const svgX = ratio * width;
    if (svgX < PAD.left || svgX > width - PAD.right) {
      setHover(null);
      return;
    }
    const index = Math.round(
      ((svgX - PAD.left) / innerW) * (points.length - 1),
    );
    setHover(Math.min(points.length - 1, Math.max(0, index)));
  };

  const tipLeft = hover !== null ? `${(x(hover) / width) * 100}%` : "0";

  return (
    <div className="chart__hover" ref={wrapRef}>
      <svg
        className="chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Response time over the selected window"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <g className="chart__grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
          ))}
        </g>

        {ticks.map((t) => (
          <text
            key={t}
            className="chart__tick"
            x={PAD.left - 8}
            y={y(t) + 3}
            textAnchor="end"
          >
            {Math.round(t).toLocaleString("en-US")}
          </text>
        ))}

        <path d={areaPath} fill="var(--series-accent)" fillOpacity="0.1" />

        <path
          d={line("latencyP95")}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <path
          d={line("latencyP50")}
          fill="none"
          stroke="var(--series-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* An isolated bucket — no populated neighbour — cannot be drawn as a
            line: a one-point path renders nothing at all, so a fresh install
            showed an empty chart beside a "1 samples" counter. Draw it as a
            marker instead. */}
        {points.map((point, i) =>
          point.latencyP50 !== null &&
          points[i - 1]?.latencyP50 == null &&
          points[i + 1]?.latencyP50 == null ? (
            <circle
              key={point.ts}
              cx={x(i)}
              cy={y(point.latencyP50)}
              r="4"
              fill="var(--series-accent)"
              stroke="var(--c-surface)"
              strokeWidth="2"
            />
          ) : null,
        )}

        {hoveredPoint && hoveredPoint.latencyP50 !== null && (
          <>
            <line
              className="chart__cursor"
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD.top}
              y2={PAD.top + innerH}
            />
            {hoveredPoint.latencyP95 !== null && (
              <circle
                cx={x(hover!)}
                cy={y(hoveredPoint.latencyP95)}
                r="4"
                fill="var(--series-2)"
                stroke="var(--c-surface)"
                strokeWidth="2"
              />
            )}
            <circle
              cx={x(hover!)}
              cy={y(hoveredPoint.latencyP50)}
              r="4"
              fill="var(--series-accent)"
              stroke="var(--c-surface)"
              strokeWidth="2"
            />
          </>
        )}

        <g className="chart__axis">
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={PAD.top + innerH}
            y2={PAD.top + innerH}
          />
        </g>

        <text className="chart__tick" x={PAD.left} y={height - 6}>
          {formatTime(points[0].ts)}
        </text>
        <text
          className="chart__tick"
          x={width - PAD.right}
          y={height - 6}
          textAnchor="end"
        >
          {formatTime(points[points.length - 1].ts)}
        </text>
      </svg>

      {hoveredPoint && hoveredPoint.latencyP50 !== null && (
        <div className="chart__tip" style={{ left: tipLeft, top: 0 }}>
          <span className="chart__tip-time">{formatFull(hoveredPoint.ts)}</span>
          <span className="chart__tip-row">
            <i
              className="chart__tip-key"
              style={{ background: "var(--series-accent)" }}
            />
            Avg {hoveredPoint.latencyP50} ms
          </span>
          {hoveredPoint.latencyP95 !== null && (
            <span className="chart__tip-row">
              <i
                className="chart__tip-key"
                style={{ background: "var(--series-2)" }}
              />
              Peak {hoveredPoint.latencyP95} ms
            </span>
          )}
          <span className="chart__tip-row" style={{ color: "var(--c-muted)" }}>
            {hoveredPoint.samples} sample{hoveredPoint.samples === 1 ? "" : "s"}
          </span>
        </div>
      )}

      <div className="legend">
        <span className="legend__item">
          <i className="legend__key" style={{ background: "var(--series-accent)" }} />
          Average
        </span>
        <span className="legend__item">
          <i className="legend__key" style={{ background: "var(--series-2)" }} />
          Peak
        </span>
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFull(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
