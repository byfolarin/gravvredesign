"use client";

import { useEffect, useRef } from "react";
import { ACCENT, COLS, GROUND, LOOP_SECONDS, ROWS, renderFrame } from "./crane";

const CELL = 6; // brand grid pitch
const DOT = 4; // square dot inside each cell
const FPS = 10;
const FRAMES = Math.round(FPS * LOOP_SECONDS); // three boxes over and back
/** Drawn smaller than the brand grid so it sits quietly on the page. */
const SCALE = 0.75;
const W = COLS * CELL - (CELL - DOT);
const H = ROWS * CELL - (CELL - DOT);

/** Every dot code the scene emits, with the CSS token that colours it. */
const CODES: [number, string][] = [
  ...[0, 1, 2, 3, 4, 5].map((t): [number, string] => [t, `--px-${t}`]),
  ...[0, 1, 2, 3, 4, 5].map((t): [number, string] => [
    ACCENT + t,
    `--px-a${t}`,
  ]),
  [GROUND, "--px-ground"],
];

const cachedFrames: Int8Array[] = [];

/** The crane loop: frames are rendered a few at a time in idle slices, then played on a canvas. */
export function CraneCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * SCALE * dpr);
    canvas.height = Math.round(H * SCALE * dpr);
    ctx.setTransform(SCALE * dpr, 0, 0, SCALE * dpr, 0, 0);

    // Colours come from the theme tokens; re-read them when the theme flips.
    let colors = new Map<number, string>();
    const readColors = () => {
      const style = getComputedStyle(canvas);
      colors = new Map(
        CODES.map(([code, v]) => [code, style.getPropertyValue(v).trim()]),
      );
    };
    readColors();

    let current: Int8Array | null = null;
    const draw = (cells: Int8Array) => {
      current = cells;
      ctx.clearRect(0, 0, W, H);
      for (const [code] of CODES) {
        ctx.fillStyle = colors.get(code) ?? "transparent";
        for (let k = 0; k < cells.length; k++)
          if (cells[k] === code)
            ctx.fillRect(
              (k % COLS) * CELL,
              Math.floor(k / COLS) * CELL,
              DOT,
              DOT,
            );
      }
    };

    const observer = new MutationObserver(() => {
      readColors();
      if (current) draw(current);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Reduced motion: one still frame, a box mid-lift.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(renderFrame(3.8 / LOOP_SECONDS));
      return () => observer.disconnect();
    }

    // Frames live at module level, so returning to a page reuses them.
    const frames = cachedFrames;
    let timer = 0;
    const build = () => {
      const start = performance.now();
      while (frames.length < FRAMES && performance.now() - start < 10)
        frames.push(renderFrame(frames.length / FRAMES));
      if (frames.length < FRAMES) timer = window.setTimeout(build, 0);
    };
    if (!frames.length) frames.push(renderFrame(0));
    draw(frames[0]);
    timer = window.setTimeout(build, 0);

    let raf = 0;
    let last = 0;
    let f = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      last = now;
      // Hold on the latest ready frame until the next one has been rendered.
      if (frames[f + 1] || frames.length === FRAMES) {
        f = (f + 1) % FRAMES;
        draw(frames[f]);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Pixel illustration of a tower crane moving boxes from one pile to another in a yard of crates"
      style={{ width: W * SCALE, height: H * SCALE }}
      className="relative block max-w-full"
    />
  );
}
