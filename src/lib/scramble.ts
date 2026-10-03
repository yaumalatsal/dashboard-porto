/**
 * Scrambled text reveal: characters type in from the left with a short band of
 * noise running ahead of them, the "decoding" effect on kprverse.com.
 *
 * Written for monospaced labels. Every unrevealed position is filled with a
 * glyph or a no-break space rather than left empty, so in a monospace face the
 * text keeps its exact width throughout: only paint changes, never layout, and
 * nothing around a label shifts while it runs.
 *
 * Works on text nodes in place, so nested markup survives and there is no
 * second copy of the text to keep in sync. The final state is always the
 * original text — and if React rewrites a node mid-run, its value wins.
 */

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&+/<=>?";
/** How many noise characters run ahead of the revealed text. */
const BAND = 6;
const NBSP = " ";

type Run = { cancel: () => void };

const running = new WeakMap<Element, Run>();

function collectText(el: Element): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue && node.nodeValue.trim()) nodes.push(node);
  }
  return nodes;
}

function isBlank(ch: string): boolean {
  return ch === " " || ch === NBSP || ch === "\n" || ch === "\t";
}

export type ScrambleOptions = {
  /**
   * "write": the label types in from nothing — for first appearance.
   * "sweep": the text stays readable while a band of noise passes over it —
   * for hover, where blanking a link under the cursor would read as a flicker.
   */
  mode?: "write" | "sweep";
  /** Multiplies the duration. Below 1 is faster — used for hover replays. */
  speed?: number;
  /** Delay before the reveal starts, in milliseconds. */
  delay?: number;
};

export function isScrambling(el: Element): boolean {
  return running.has(el);
}

/**
 * Run the reveal once on `el`. Calling it again while it runs restarts it.
 * Does nothing for empty elements. Callers are responsible for honouring
 * prefers-reduced-motion — this module has no opinion on when to run.
 */
export function scramble(el: Element, { mode = "write", speed = 1, delay = 0 }: ScrambleOptions = {}): void {
  running.get(el)?.cancel();

  const nodes = collectText(el);
  if (nodes.length === 0) return;

  const originals = nodes.map((node) => node.nodeValue ?? "");
  const total = originals.reduce((sum, text) => sum + text.length, 0);
  // Long enough to read as decoding, short enough never to make anyone wait:
  // a 30-character label takes about 1.5s at full speed, capped at 1.6s.
  const duration = Math.min(1600, 35 * total + 380) * speed;
  const written: string[] = [...originals];

  let frame = 0;
  let timer = 0;
  let lastPaint = 0;
  let start = 0;

  const paint = (revealed: number) => {
    let offset = 0;
    nodes.forEach((node, index) => {
      const source = originals[index];
      let out = "";
      for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const position = offset + i;
        if (isBlank(ch) || position < revealed) out += ch;
        else if (position < revealed + BAND) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
        // Ahead of the band: blank while writing in, the real text while sweeping.
        else out += mode === "sweep" ? ch : NBSP;
      }
      offset += source.length;
      // Skip the write when nothing changed: an unchanged text node is free,
      // a written one is re-shaped by the browser even if identical.
      if (node.nodeValue !== out) {
        node.nodeValue = out;
        written[index] = out;
      }
    });
  };

  const restore = () => {
    nodes.forEach((node, index) => {
      // React may have rewritten the node while we ran; its value wins.
      if (node.nodeValue === written[index]) node.nodeValue = originals[index];
    });
  };

  const step = (now: number) => {
    if (!start) start = now;
    const progress = Math.min(1, (now - start) / duration);
    // Noise at 30Hz rather than every frame: it reads the same and halves the
    // number of text re-shapes the browser has to do.
    if (now - lastPaint >= 33 || progress === 1) {
      lastPaint = now;
      paint(Math.floor(progress * (total + BAND)));
    }
    if (progress < 1) {
      frame = requestAnimationFrame(step);
    } else {
      restore();
      running.delete(el);
    }
  };

  const cancel = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    restore();
    running.delete(el);
  };

  running.set(el, { cancel });
  // Writing in starts blank, so the label does not flash in full for a frame
  // before it decodes. A sweep leaves the text readable until the band arrives.
  if (mode === "write") paint(0);
  timer = window.setTimeout(() => {
    frame = requestAnimationFrame(step);
  }, delay);
}
