import type { HeatCell } from "@/lib/monitor/store";

/**
 * Mean response time for each hour of each weekday.
 *
 * A time series cannot answer "when is it slow". A spike every Monday at 09:00
 * looks like noise on a 30-day line and like a column here.
 *
 * Sequential colour: one hue, light to dark by magnitude. Blue is the
 * documented default sequential hue, and it keeps the status colours reserved
 * for status. On this dark surface the ramp runs the other way — a low value
 * sits near the surface and a high value is bright — so the eye reads intensity
 * as magnitude.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Five steps of one hue, from the validated blue ramp.
const RAMP = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"];

export default function Heatmap({
  cells,
  unit = "ms",
}: {
  cells: HeatCell[];
  unit?: string;
}) {
  const values = cells
    .map((c) => c.value)
    .filter((v): v is number => v !== null);

  if (values.length === 0) {
    return (
      <p className="panel__empty">
        No samples yet. The grid fills as the console collects data.
      </p>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const step = (value: number) =>
    RAMP[Math.min(RAMP.length - 1, Math.floor(((value - min) / span) * RAMP.length))];

  return (
    <div className="heatmap">
      <div className="heatmap__grid">
        {/* Hour labels every six hours: 24 labels do not fit and are not needed. */}
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={`h${hour}`} className="heatmap__hour">
            {hour % 6 === 0 ? String(hour).padStart(2, "0") : ""}
          </span>
        ))}

        {DAYS.map((day, weekday) => (
          <Row key={day} day={day} weekday={weekday} cells={cells} step={step} unit={unit} />
        ))}
      </div>

      <div className="heatmap__legend">
        <span>Faster</span>
        {RAMP.map((colour) => (
          <i key={colour} style={{ background: colour }} aria-hidden="true" />
        ))}
        <span>Slower</span>
        <em>
          {Math.round(min)}–{Math.round(max)} {unit}
        </em>
      </div>
    </div>
  );
}

function Row({
  day,
  weekday,
  cells,
  step,
  unit,
}: {
  day: string;
  weekday: number;
  cells: HeatCell[];
  step: (value: number) => string;
  unit: string;
}) {
  return (
    <>
      <span className="heatmap__day">{day}</span>
      {Array.from({ length: 24 }, (_, hour) => {
        const cell = cells.find((c) => c.weekday === weekday && c.hour === hour);
        const value = cell?.value ?? null;
        return (
          <span
            key={`${weekday}-${hour}`}
            className={`heatmap__cell${value === null ? " heatmap__cell--empty" : ""}`}
            style={value !== null ? { background: step(value) } : undefined}
            // The value is in the title as well as the colour, so the grid is
            // readable without comparing shades.
            title={
              value === null
                ? `${day} ${String(hour).padStart(2, "0")}:00 — no samples`
                : `${day} ${String(hour).padStart(2, "0")}:00 — ${value} ${unit} (${cell?.samples} samples)`
            }
          />
        );
      })}
    </>
  );
}
