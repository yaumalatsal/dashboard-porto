/**
 * A 12-point trend line for stat tiles. Server-rendered, no interaction — the
 * tile's value carries the number and the chart carries only the shape.
 *
 * 2px stroke, round caps, an end marker at ≥8px with a surface ring so it stays
 * legible where it overlaps the line.
 */
export default function Sparkline({
  values,
  width = 132,
  height = 30,
  color = "var(--series-accent)",
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const points = values.filter((v): v is number => v !== null);
  if (points.length < 2) {
    return <svg className="tile__spark" width={width} height={height} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  // A flat series would divide by zero and collapse onto the baseline; give it
  // a nominal range so it renders as a centred straight line instead.
  const span = max - min || 1;
  const pad = 3;
  const innerH = height - pad * 2;

  const coords = values.flatMap((value, index) => {
    if (value === null) return [];
    const x = (index / (values.length - 1)) * width;
    const y = pad + innerH - ((value - min) / span) * innerH;
    return [{ x, y }];
  });

  const path = coords
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      className="tile__spark"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r="4" fill={color} stroke="var(--c-surface)" strokeWidth="2" />
    </svg>
  );
}
