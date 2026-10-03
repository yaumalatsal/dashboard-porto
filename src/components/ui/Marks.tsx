/**
 * Small 2D instrument marks scattered through a section: sparks, crosshairs,
 * rulers, an orbit — the HUD ornaments that kprverse.com hangs around its
 * content, drawn here in the portfolio's iridescent accents.
 *
 * Purely decorative and server-rendered: no client JavaScript, hidden from
 * assistive technology, and transparent to the pointer. A mark with a `depth`
 * drifts against the scroll on a CSS scroll timeline; `spin` turns it slowly.
 */

import type { CSSProperties, ReactNode } from "react";

type Hue = "sky" | "lilac" | "rose" | "butter" | "mint";

export type Mark = {
  glyph: keyof typeof GLYPHS;
  /** Position inside the section, as CSS lengths (usually percentages). */
  x: string;
  y: string;
  size?: number;
  hue?: Hue;
  /** Scroll drift: positive rises faster than the page, negative lags it. */
  depth?: number;
  spin?: boolean;
  /** Hidden on narrow screens, where there is no margin to put it in. */
  wide?: boolean;
  /** For the "tag" glyph: a short coordinate-style caption. */
  label?: ReactNode;
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const };

const GLYPHS = {
  spark: (
    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 0c.8 7 5 11.2 12 12-7 .8-11.2 5-12 12-.8-7-5-11.2-12-12 7-.8 11.2-5 12-12Z" /></svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24"><path {...stroke} d="M12 1v22M1 12h22" /><rect x="10" y="10" width="4" height="4" fill="currentColor" /></svg>
  ),
  ring: (
    <svg viewBox="0 0 24 24"><circle {...stroke} cx="12" cy="12" r="9" /><path {...stroke} d="M12 0v5M12 19v5" /><circle cx="21" cy="12" r="1.6" fill="currentColor" /></svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24">{[4, 12, 20].flatMap((y) => [4, 12, 20].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" />))}</svg>
  ),
  chevrons: (
    <svg viewBox="0 0 36 24"><path {...stroke} d="M3 5l7 7-7 7M14 5l7 7-7 7M25 5l7 7-7 7" /></svg>
  ),
  orbit: (
    <svg viewBox="0 0 40 24"><ellipse {...stroke} cx="20" cy="12" rx="18" ry="6.5" transform="rotate(-16 20 12)" /><circle cx="20" cy="12" r="3.2" fill="currentColor" /><circle cx="35.5" cy="7.4" r="1.7" fill="currentColor" /></svg>
  ),
  bracket: (
    <svg viewBox="0 0 24 24"><path {...stroke} d="M1 8V1h7M16 1h7v7M23 16v7h-7M8 23H1v-7" /></svg>
  ),
  ruler: (
    <svg viewBox="0 0 120 12" preserveAspectRatio="none">
      <path {...stroke} strokeWidth={1} d={`M0 11H120${Array.from({ length: 13 }, (_, i) => `M${i * 10} 11V${i % 5 === 0 ? 2 : 7}`).join("")}`} />
    </svg>
  ),
  tag: null,
} as const;

export default function Marks({ items }: { items: Mark[] }) {
  return (
    <div className="obs-marks" aria-hidden="true">
      {items.map((mark, index) => {
        const size = mark.size ?? 18;
        const isRuler = mark.glyph === "ruler";
        const isTag = mark.glyph === "tag";
        const style = {
          left: mark.x,
          top: mark.y,
          width: isTag ? undefined : isRuler ? size * 6.5 : mark.glyph === "orbit" || mark.glyph === "chevrons" ? size * 1.6 : size,
          height: isTag ? undefined : isRuler ? Math.max(8, size * 0.6) : size,
          "--mark": `var(--iri-${mark.hue ?? "lilac"})`,
          // Read by the obs-drift scroll timeline in observatory.css.
          "--depth": mark.depth,
        } as CSSProperties;
        const className = [
          "obs-mark",
          mark.spin && "obs-mark--spin",
          mark.wide && "obs-mark--wide",
          isTag && "obs-mark--label",
        ].filter(Boolean).join(" ");
        return (
          <span key={index} className={className} style={style} data-depth={mark.depth}>
            {isTag ? mark.label : GLYPHS[mark.glyph]}
          </span>
        );
      })}
    </div>
  );
}
