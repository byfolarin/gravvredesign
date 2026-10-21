"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Roll } from "@/app/_components/roll";
import { PairMark } from "./asset-mark";
import {
  ASSET_NAME,
  RANGES,
  dateFmt,
  fmt,
  seriesFor,
  timeFmt,
  type Pair,
  type Range,
} from "../_data";

export type ChartPlace = "lead" | "column" | "ticket" | "row";

const PAD = { top: 12, right: 64, bottom: 24, left: 0 };
const OPEN_KEY = "gravv-trade-chart-open";
const HEIGHT: Record<ChartPlace, number> = {
  lead: 220,
  column: 190,
  ticket: 110,
  row: 140,
};

const rateLabel = (p: Pair, v: number) => fmt(p.get, v, v >= 10 ? 2 : 4);

/**
 * The selected pair's rate over time — the "is now a good moment?" read before a quote.
 * Same pattern as the Wallets / Transactions charts: a header row with the range switch and a
 * "Hide chart" pill; hiding removes the plot and keeps the header. No panel background.
 *   lead   — full width under the facts       column — top of the right column
 *   ticket — compact, inside the quote ticket row    — inline under the selected rate
 * One series, so no legend. The line takes the colour of the move: green up, red down, grey flat.
 */
export function RateChart({
  pair,
  place = "column",
  onHide,
}: {
  pair: Pair;
  place?: ChartPlace;
  /** In the rates list the parent owns open/closed; this hides it. */
  onHide?: () => void;
}) {
  const H = HEIGHT[place];
  const compact = place === "ticket" || place === "row";
  const [range, setRange] = useState<Range>("24H");
  const [hover, setHover] = useState<number | null>(null);
  const [stored, setOpen] = useState(true);
  const open = place === "row" || stored;
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);
  const gid = useId();

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setOpen(localStorage.getItem(OPEN_KEY) !== "closed");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(220, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const toggle = () => {
    if (place === "row") return onHide?.();
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "closed" : "open");
      } catch {}
      return !o;
    });
    setHover(null);
  };

  const data = useMemo(() => seriesFor(pair, range, pair.rate), [pair, range]);
  const first = data[0].v,
    last = data[data.length - 1].v;
  const change = ((last - first) / first) * 100;
  const flat = Math.abs(change) < 0.005;
  const tone = flat
    ? "var(--color-neutral-400)"
    : change > 0
      ? "var(--flow-in)"
      : "var(--color-red-400)";
  const toneText = flat
    ? "text-neutral-400"
    : change > 0
      ? "text-[var(--flow-in)]"
      : "text-red-400";
  const changeText = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;

  const min = Math.min(...data.map((d) => d.v)),
    max = Math.max(...data.map((d) => d.v));
  const pad = (max - min || max * 0.001) * 0.12;
  const lo = min - pad,
    hi = max + pad;
  const iw = w - PAD.left - PAD.right;
  const x = (i: number) => PAD.left + (i / (data.length - 1)) * iw;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * H;
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.v).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(data.length - 1)},${PAD.top + H}L${x(0)},${PAD.top + H}Z`;
  const ticks = (compact ? [0.2, 0.8] : [0.15, 0.5, 0.85]).map(
    (k) => lo + (hi - lo) * (1 - k),
  );
  const xTicks = [0, 1, 2, 3].map((k) =>
    Math.round((k / 3) * (data.length - 1)),
  );
  const xLabel = (t: number) =>
    range === "24H" ? timeFmt.format(t) : dateFmt.format(t);
  const h = hover === null ? null : data[hover];
  const hoverWhen = h
    ? range === "24H"
      ? timeFmt.format(h.t)
      : `${dateFmt.format(h.t)}, ${timeFmt.format(h.t)}`
    : "";

  const rangeSwitch = (
    <div
      role="radiogroup"
      aria-label="Range"
      className="flex rounded-full bg-white/[0.07] p-0.5"
    >
      {RANGES.map((r) => (
        <button
          key={r.id}
          type="button"
          role="radio"
          aria-checked={range === r.id}
          onClick={() => setRange(r.id)}
          className={`h-7 rounded-full px-2.5 text-xs tabular-nums transition-colors ${
            range === r.id
              ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          {r.id}
        </button>
      ))}
    </div>
  );
  const hideButton = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={`flex items-center gap-1.5 rounded-full border border-white/10 text-neutral-300 transition-colors hover:border-white/25 hover:text-white ${
        compact ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]"
      }`}
    >
      {open ? "Hide chart" : "Show chart"}
      <ChevronDown
        size={14}
        strokeWidth={1.75}
        className={`transition-transform ${open ? "rotate-180" : ""}`}
      />
    </button>
  );

  return (
    <section>
      {compact ? (
        // Compact: the ticket / row already names the pair and rate.
        <div className="flex items-center justify-between gap-3">
          <span
            className={`text-xs tabular-nums ${h ? "text-neutral-300" : toneText}`}
          >
            {h
              ? `${rateLabel(pair, h.v)} · ${hoverWhen}`
              : `${changeText} over ${range}`}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {open && rangeSwitch}
            {hideButton}
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <PairMark sell={pair.sell} get={pair.get} size={20} />
              <span className="text-[15px] font-medium text-white">
                {pair.sell} → {pair.get}
              </span>
              <span className="truncate text-xs text-neutral-500">
                {ASSET_NAME[pair.sell]} to {ASSET_NAME[pair.get]}
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span
                className={`leading-none font-medium tracking-[-0.03em] text-white tabular-nums ${
                  place === "lead" ? "text-[40px]" : "text-[34px]"
                }`}
              >
                {h ? (
                  rateLabel(pair, h.v)
                ) : (
                  <Roll value={rateLabel(pair, pair.rate)} />
                )}
              </span>
              <span
                className={`text-[13px] tabular-nums ${h ? "text-neutral-500" : toneText}`}
              >
                {h ? hoverWhen : `${changeText} ${range}`}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {open && rangeSwitch}
            {hideButton}
          </div>
        </div>
      )}

      {open && (
        <div
          ref={wrap}
          className={`orbit-pop relative ${compact ? "mt-2" : "mt-4"}`}
        >
          <svg
            width={w}
            height={PAD.top + H + PAD.bottom}
            className="block touch-none"
            role="img"
            aria-label={`${pair.sell} to ${pair.get} rate, ${range}: ${rateLabel(pair, first)} to ${rateLabel(pair, last)} (${changeText})`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round(
                ((e.clientX - r.left - PAD.left) / iw) * (data.length - 1),
              );
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={tone} stopOpacity="0.14" />
                <stop offset="1" stopColor={tone} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Recessive grid + right-hand axis */}
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + iw}
                  y1={y(v)}
                  y2={y(v)}
                  stroke="currentColor"
                  className="text-white/[0.06]"
                />
                <text
                  x={w - 4}
                  y={y(v) + 4}
                  textAnchor="end"
                  className="fill-neutral-500 text-[11px] tabular-nums"
                >
                  {rateLabel(pair, v)}
                </text>
              </g>
            ))}
            {xTicks.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={PAD.top + H + 17}
                textAnchor={
                  k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"
                }
                className="fill-neutral-500 text-[11px] tabular-nums"
              >
                {k === xTicks.length - 1 ? "Now" : xLabel(data[i].t)}
              </text>
            ))}
            <path d={area} fill={`url(#${gid})`} />
            <path
              d={line}
              fill="none"
              stroke={tone}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {h && hover !== null && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={PAD.top}
                  y2={PAD.top + H}
                  stroke="currentColor"
                  className="text-white/25"
                />
                <circle
                  cx={x(hover)}
                  cy={y(h.v)}
                  r="4.5"
                  fill={tone}
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        </div>
      )}
    </section>
  );
}
