"use client";

import { useState, type ReactNode } from "react";

export type Bucket = {
  /** Start of the bucket (UTC ms); also its key. */
  start: number;
  /** Stacked from the baseline up, in this order. */
  segments: { value: number; className: string }[];
  /** Screen-reader description. */
  label: string;
};

/**
 * Bars per day or week, optionally stacked. Same anatomy as the Wallets chart without the
 * panel: recessive gridlines, a value axis on the left, a 2px gap between stacked segments,
 * hover tooltip, click a bar to filter (click again to clear).
 */
export function BucketBars({
  buckets,
  height = 168,
  format,
  tooltip,
  selected,
  onSelect,
  axis,
  average,
}: {
  buckets: Bucket[];
  height?: number;
  /** Axis label for a value. */
  format: (v: number) => string;
  tooltip: (b: Bucket, i: number) => ReactNode;
  selected: number | null;
  onSelect: (start: number | null) => void;
  /** Labels under the plot: first, middle, last. */
  axis: [string, string, string];
  /** Optional dashed reference line (e.g. average per bucket) with its label. */
  average?: { value: number; label: string };
}) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = buckets.map((b) =>
    b.segments.reduce((s, x) => s + x.value, 0),
  );
  const max = Math.max(...totals, 1);
  const step = (() => {
    const raw = max / 3;
    const pow = 10 ** Math.floor(Math.log10(raw || 1));
    return [1, 2, 2.5, 5, 10].find((m) => m * pow >= raw)! * pow;
  })();
  const top = Math.max(step * Math.ceil(max / step), step);
  const y = (v: number) => height - (v / top) * height;
  const ticks: number[] = [];
  for (let t = step; t <= top + 1e-9; t += step) ticks.push(t);
  const at = (i: number) => `${((i + 0.5) / buckets.length) * 100}%`;

  return (
    <div className="relative pl-12">
      {[0, ...ticks].map((t) => (
        <span
          key={t}
          aria-hidden
          className="pointer-events-none absolute left-0 w-10 -translate-y-1/2 text-right text-[10px] text-neutral-500 tabular-nums"
          style={{ top: y(t) }}
        >
          {format(t)}
        </span>
      ))}
      <div
        className={`relative flex ${buckets.length > 40 ? "gap-px" : "gap-[3px]"}`}
        style={{ height }}
        onMouseLeave={() => setHover(null)}
        role="group"
      >
        {ticks.map((t) => (
          <span
            key={t}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.05]"
            style={{ top: y(t) }}
          />
        ))}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/15"
        />
        {average && average.value > 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-[2]"
            style={{ top: y(average.value) }}
          >
            <div className="border-t border-dashed border-white/25" />
            <span className="absolute -top-[18px] left-0 rounded bg-surface px-1 text-[10px] text-neutral-400 tabular-nums">
              {average.label}
            </span>
          </div>
        )}
        {buckets.map((b, i) => {
          const isSel = selected === b.start;
          const dim =
            (hover !== null && hover !== i) ||
            (selected !== null && !isSel && hover === null);
          let acc = 0;
          return (
            <button
              key={b.start}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect(isSel ? null : b.start)}
              aria-pressed={isSel}
              aria-label={b.label}
              className="relative h-full flex-1 cursor-pointer outline-none"
            >
              <span
                aria-hidden
                className={`absolute inset-0 rounded-sm transition-colors ${isSel ? "bg-white/[0.07]" : hover === i ? "bg-white/[0.04]" : ""}`}
              />
              {b.segments.map((s, k) => {
                if (s.value <= 0) return null;
                const h = (s.value / top) * height;
                const bottom = (acc / top) * height;
                acc += s.value;
                const last = b.segments.slice(k + 1).every((x) => x.value <= 0);
                return (
                  <span
                    key={k}
                    aria-hidden
                    className={`absolute inset-x-[24%] transition-opacity ${s.className} ${last ? "rounded-t-[3px]" : ""} ${dim ? "opacity-35" : ""}`}
                    style={{
                      bottom: bottom + (k ? 2 : 0),
                      height: Math.max(2, h - (k ? 2 : 0)),
                    }}
                  />
                );
              })}
            </button>
          );
        })}
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-56 rounded-lg border border-white/10 bg-raised px-3 py-2.5 text-xs shadow-2xl"
            style={{
              left: `clamp(0px, calc(${at(hover)} - 112px), calc(100% - 224px))`,
            }}
          >
            {tooltip(buckets[hover], hover)}
            <div className="mt-2 text-[11px] text-neutral-500">
              {selected === buckets[hover].start
                ? "Click to clear"
                : "Click to filter the table"}
            </div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-500 tabular-nums">
        {axis.map((a, i) => (
          <span key={i}>{a}</span>
        ))}
      </div>
    </div>
  );
}

/** Day or week buckets ending today, as UTC starts. */
export function bucketStarts(asOf: number, period: 30 | 90) {
  const DAY = 24 * 60 * 60 * 1000;
  const size = period === 30 ? DAY : 7 * DAY;
  const n = period === 30 ? 30 : 13;
  const end = Math.floor(asOf / DAY) * DAY + DAY;
  return {
    size,
    starts: Array.from({ length: n }, (_, i) => end - (n - i) * size),
  };
}

/** Remembered show/hide for a chart, default open. Storage can fail; the toggle still works. */
export function readOpen(key: string) {
  try {
    return localStorage.getItem(key) !== "closed";
  } catch {
    return true;
  }
}
export function writeOpen(key: string, open: boolean) {
  try {
    localStorage.setItem(key, open ? "open" : "closed");
  } catch {}
}
