/**
 * Scrambled text reveal: characters type in from the left with a short band of
 * noise running ahead of them, the "decoding" effect on kprverse.com.
 *
 * Two ways to keep the layout still while the letters change:
 *
 *   - Monospaced text (labels, nav, tags): every glyph has the same width, so
 *     it is enough to fill each unrevealed position with a glyph or a
 *     no-break space. Text nodes are rewritten in place and nothing else in
 *     the DOM moves.
 *
 *   - Proportional text (headings, titles): a scrambled "M" is wider than the
 *     "i" it replaces, so the line would reflow on every frame. Instead the
 *     width of each real character is measured first, then every character is
 *     wrapped in a cell of exactly that width for the duration of the run.
 *     Whatever glyph is shown inside a cell, the cell keeps its place, so the
 *     text takes the same space — and wraps at the same words — as the real
 *     thing. When the run ends the original text node is put back.
 *
 * Accessibility: while a proportional run is active the split copy is hidden
 * from assistive technology and the real text sits beside it, visually hidden.
 * Monospaced runs on links, buttons and headings carry the real text as an
 * aria-label until they finish.
 *
 * All runs share one animation-frame loop, so thirty labels decoding at once
 * cost one callback per frame, not thirty.
 */

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&+/<=>?";
/** How many noise characters run ahead of the revealed text. */
const BAND = 6;
const NBSP = " ";
/** Elements whose accessible name comes from their content. */
const NAMED = /^(A|BUTTON|H[1-6])$/;

function isBlank(ch: string): boolean {
  return ch === " " || ch === NBSP || ch === "\n" || ch === "\t";
}

function collectText(el: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue && node.nodeValue.trim()) nodes.push(node);
  }
  return nodes;
}

/** Only monospaced text keeps its width without help. */
export function isMonospaced(el: Element): boolean {
  const family = getComputedStyle(el).fontFamily.toLowerCase();
  return family.includes("mono") || family.includes("consolas");
}

/* ------------------------------------------------------------- surfaces */

/** Something the painter can write characters into, one index at a time. */
type Surface = {
  chars: string[];
  show(index: number, ch: string): void;
  flush(): void;
  restore(): void;
};

function monoSurface(nodes: Text[]): Surface {
  const originals = nodes.map((node) => node.nodeValue ?? "");
  const starts: number[] = [];
  let offset = 0;
  for (const text of originals) {
    starts.push(offset);
    offset += text.length;
  }
  const current = originals.map((text) => text.split(""));
  const written = [...originals];
  const dirty = new Set<number>();

  return {
    chars: originals.join("").split(""),
    show(index, ch) {
      let n = starts.length - 1;
      while (starts[n] > index) n--;
      const local = index - starts[n];
      if (current[n][local] !== ch) {
        current[n][local] = ch;
        dirty.add(n);
      }
    },
    flush() {
      // Only nodes that changed: an unchanged text node is free, a written
      // one is re-shaped by the browser even when the value is identical.
      for (const n of dirty) {
        const value = current[n].join("");
        nodes[n].nodeValue = value;
        written[n] = value;
      }
      dirty.clear();
    },
    restore() {
      nodes.forEach((node, n) => {
        // React may have rewritten the node while we ran; its value wins.
        if (node.nodeValue === written[n]) node.nodeValue = originals[n];
      });
    },
  };
}

type Swap = { node: Text; sr: HTMLElement; visual: HTMLElement; parent: Node };

/**
 * Phase one of a proportional run: READS ONLY. The width of every real
 * character, in CSS pixels. Kept apart from the DOM surgery that follows so
 * that a batch of runs can measure everything first and write everything
 * second — measuring after another element's rewrite forces a full synchronous
 * layout each time, and six headings entering in one frame meant six.
 */
function measureLocked(el: Element, nodes: Text[]): number[][] | null {
  // A transformed ancestor (a scaled panel) scales what getBoundingClientRect
  // reports but not the CSS pixels the cells are sized in. Correct for it.
  const layoutWidth = (el as HTMLElement).offsetWidth;
  const scale = layoutWidth ? el.getBoundingClientRect().width / layoutWidth : 1;
  const k = Math.abs(scale - 1) < 0.02 || !Number.isFinite(scale) || scale <= 0 ? 1 : scale;

  const range = document.createRange();
  const measured = nodes.map((node) => {
    const text = node.nodeValue ?? "";
    const widths: number[] = [];
    for (let i = 0; i < text.length; i++) {
      if (isBlank(text[i])) {
        widths.push(0);
        continue;
      }
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      widths.push(range.getBoundingClientRect().width / k);
    }
    return widths;
  });
  return measured.some((widths) => widths.some((w) => w > 0)) ? measured : null;
}

/** Phase two: WRITES ONLY. Builds the width-locked copy from the measurements. */
function lockedSurface(nodes: Text[], measured: number[][]): Surface {
  const chars: string[] = [];
  const cells: (Text | null)[] = [];
  const swaps: Swap[] = [];

  nodes.forEach((node, n) => {
    const parent = node.parentNode;
    if (!parent) return;
    const text = node.nodeValue ?? "";

    // The real text, kept for assistive technology and out of sight.
    const sr = document.createElement("span");
    sr.textContent = text;
    sr.style.cssText =
      "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";

    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");

    // Words stay unbreakable so a line wraps at the same spaces as the real
    // text; the spaces themselves stay as real text between them.
    let word: HTMLElement | null = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      chars.push(ch);
      if (isBlank(ch)) {
        word = null;
        visual.appendChild(document.createTextNode(ch));
        cells.push(null);
        continue;
      }
      if (!word) {
        word = document.createElement("span");
        word.style.whiteSpace = "nowrap";
        visual.appendChild(word);
      }
      const cell = document.createElement("span");
      // No `contain: layout` here, though it looks like a free win: it changes
      // an inline-block's baseline to its bottom edge, which lifted every
      // letter and grew each line by ~12% while a heading decoded.
      cell.style.cssText = `display:inline-block;width:${measured[n][i]}px`;
      const glyph = document.createTextNode(ch);
      cell.appendChild(glyph);
      word.appendChild(cell);
      cells.push(glyph);
    }

    parent.insertBefore(sr, node);
    parent.insertBefore(visual, node);
    parent.removeChild(node);
    swaps.push({ node, sr, visual, parent });
  });

  const shown = [...chars];

  return {
    chars,
    show(index, ch) {
      const glyph = cells[index];
      if (!glyph || shown[index] === ch) return;
      // Edit the existing text node rather than replacing it: no node is
      // created or removed, only its characters change.
      glyph.data = ch;
      shown[index] = ch;
    },
    flush() {},
    restore() {
      for (const { node, sr, visual, parent } of swaps) {
        // The parent can be gone if the route changed mid-run; nothing to fix.
        if (sr.parentNode === parent) parent.insertBefore(node, sr);
        sr.remove();
        visual.remove();
      }
    },
  };
}

/* ----------------------------------------------------------- the runner */

type Run = { step: (now: number) => boolean; end: () => void };

const runs = new Map<Element, Run>();
const active = new Set<Run>();
let frame = 0;

function loop(now: number) {
  for (const run of Array.from(active)) {
    if (run.step(now)) run.end();
  }
  frame = active.size ? requestAnimationFrame(loop) : 0;
}

/**
 * Most runs allowed at once. A fast scroll can bring a whole page of text into
 * view inside a second; decoding all of it would spend the main thread on
 * letters nobody has time to read. Beyond this, new decodes wait their turn
 * rather than piling on: they start as slots free up, and are dropped if the
 * reader has scrolled past them by then — there is no point decoding text that
 * nobody can see. (Hover sweeps are skipped outright when the page is busy: a
 * reader mid-gesture does not need a late replay.) Every character written is
 * a line re-layout, so this is what keeps a fast scroll on a slow CPU cheap.
 */
const MAX_ACTIVE = 8;
const waiting: Array<{ el: Element; options: ScrambleOptions }> = [];

function inView(el: Element): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}

/** Start queued decodes while there is room, as one batch. */
function pump(): void {
  const start: Array<[Element, ScrambleOptions]> = [];
  while (active.size + start.length < MAX_ACTIVE && waiting.length) {
    const next = waiting.shift()!;
    if (inView(next.el)) start.push([next.el, { ...next.options, delay: 0 }]);
  }
  if (start.length) scrambleMany(start);
}

export type ScrambleOptions = {
  /**
   * "write": the text types in from nothing — for first appearance.
   * "sweep": the text stays readable while a band of noise passes over it —
   * for hover, where blanking a link under the cursor would read as a flicker.
   */
  mode?: "write" | "sweep";
  /** Multiplies the duration. Below 1 is faster. */
  speed?: number;
  /** Delay before the reveal starts, in milliseconds. */
  delay?: number;
};

export function isScrambling(el: Element): boolean {
  return runs.has(el);
}

/** Stop everything and put the real text back. For route changes and teardown. */
export function cancelAll(): void {
  waiting.length = 0;
  for (const run of Array.from(active)) run.end();
}

/** What the read phase learned about one element: everything the writes need. */
type Prepared = {
  el: Element;
  mode: "write" | "sweep";
  speed: number;
  delay: number;
  nodes: Text[];
  mono: boolean;
  name: string;
  measured: number[][] | null;
};

/**
 * Phase one: READS ONLY. Nothing here changes the DOM, so a whole batch can be
 * prepared before the first write dirties layout.
 */
function prepare(el: Element, { mode = "write", speed = 1, delay = 0 }: ScrambleOptions): Prepared | null {
  if (el.getClientRects().length === 0) return null;
  const nodes = collectText(el);
  if (nodes.length === 0) return null;

  const mono = isMonospaced(el);
  const measured = mono ? null : measureLocked(el, nodes);
  if (!mono && !measured) return null;

  // Read before any text is blanked.
  const name = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return { el, mode, speed, delay, nodes, mono, name, measured };
}

/** Phase two: WRITES ONLY. Builds the surface, registers the run, blanks the text. */
function commit({ el, mode, speed, delay, nodes, mono, name, measured }: Prepared): void {
  const surface = mono ? monoSurface(nodes) : lockedSurface(nodes, measured!);

  const labelled = mono && NAMED.test(el.tagName) && !el.hasAttribute("aria-label");
  if (labelled) el.setAttribute("aria-label", name);

  const total = surface.chars.length;
  // Long enough to read as decoding, short enough never to make anyone wait:
  // a 12-character label takes about half a second, and nothing runs past
  // 0.75s. At the old 1.6s cap, a screenshot or a quick scroll caught labels
  // mid-noise ("LARAVR5 R0"), which read as broken text, not as an effect.
  const duration = Math.min(750, 20 * total + 260) * speed;
  const notBefore = performance.now() + delay;
  let start = 0;
  let lastPaint = 0;

  const paint = (revealed: number) => {
    for (let i = 0; i < total; i++) {
      const ch = surface.chars[i];
      let out: string;
      if (isBlank(ch) || i < revealed) out = ch;
      else if (i < revealed + BAND) out = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      // Ahead of the band: blank while writing in, the real text while sweeping.
      else out = mode === "sweep" ? ch : NBSP;
      surface.show(i, out);
    }
    surface.flush();
  };

  const run: Run = {
    step(now) {
      if (now < notBefore) return false;
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      // Noise at 30Hz rather than every frame: it reads the same and halves
      // the number of text re-shapes the browser has to do. With several runs
      // going at once it drops to 20Hz — each write is a line re-layout, and
      // they add up fastest exactly when the page is busiest.
      const interval = active.size > 3 ? 50 : 33;
      if (now - lastPaint >= interval || progress === 1) {
        lastPaint = now;
        paint(Math.floor(progress * (total + BAND)));
      }
      return progress === 1;
    },
    end() {
      active.delete(run);
      runs.delete(el);
      surface.restore();
      if (labelled) el.removeAttribute("aria-label");
      pump();
    },
  };

  runs.set(el, run);
  active.add(run);
  // Writing in starts fully blank, so the text does not flash in full for a
  // frame before it decodes. A sweep leaves the text readable until the band
  // arrives.
  if (mode === "write") paint(-BAND);
  if (!frame) frame = requestAnimationFrame(loop);
}

/**
 * Run the reveal on several elements at once, measuring all of them before
 * rewriting any. Prefer this whenever more than one element starts in the
 * same frame: one forced layout instead of one per element.
 *
 * Calling it again on an element that is already running restarts it. Empty
 * and hidden elements are skipped. Callers are responsible for honouring
 * prefers-reduced-motion — this module has no opinion on when to run.
 */
export function scrambleMany(items: Array<[Element, ScrambleOptions?]>): void {
  // Restarts first: ending a run rewrites the DOM, so it cannot sit between
  // reads.
  for (const [el] of items) runs.get(el)?.end();

  const batch: Prepared[] = [];
  for (const [el, options = {}] of items) {
    // Over the limit: writes wait for a free slot; sweeps (hover) just skip.
    if (active.size + batch.length >= MAX_ACTIVE) {
      if ((options.mode ?? "write") === "write") waiting.push({ el, options });
      continue;
    }
    const prepared = prepare(el, options);
    if (prepared) batch.push(prepared);
  }

  for (const prepared of batch) commit(prepared);
}

export function scramble(el: Element, options: ScrambleOptions = {}): void {
  scrambleMany([[el, options]]);
}
