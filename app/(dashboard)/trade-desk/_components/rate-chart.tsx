"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Roll } from "@/app/_components/roll";
import { PairMark } from "./asset-mark";
import {
  AS_OF,
  ASSET_NAME,
  HISTORY_DAYS,
  RANGES,
  candlesFor,
  dateFmt,
  fmt,
  stepFor,
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
const DAY = 24 * 3600_000;
const UP = "var(--flow-in)";
const DOWN = "var(--color-red-400)";
type Span = { from: number; to: number };

/**
 * The selected pair's rate over time — the "is now a good moment?" read before a quote.
 * Same pattern as the Wallets / Transactions charts: a header row with the range switch and a
 * "Hide chart" pill; hiding removes the plot and keeps the header. No panel background.
 *   lead   — full width under the facts       column — top of the right column
 *   ticket — compact, inside the quote ticket row    — inline under the selected rate
 * Candles, not a line: each block is one interval's open → close (mint up, red down), the wick
 * its high and low — what a trader reads before asking for a quote. Presets 1H / 1D / 7D / 30D,
 * or pick your own days on the calendar (last 90 days). Hover shows that candle's O/H/L/C.
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
  const [range, setRange] = useState<Range | "custom">("1D");
  const [custom, setCustom] = useState<Span | null>(null);
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [stored, setOpen] = useState(true);
  const open = place === "row" || stored;
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(560);

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

  const span: Span =
    range === "custom" && custom
      ? custom
      : {
          from: AS_OF - RANGES.find((r) => r.id === range)!.spanMs,
          to: AS_OF,
        };
  const step =
    range === "custom"
      ? stepFor(span.to - span.from)
      : RANGES.find((r) => r.id === range)!.stepMs;
  const data = useMemo(
    () => candlesFor(pair, pair.rate, span.from, span.to, step),
    [pair, span.from, span.to, step],
  );
  const first = data[0].o,
    last = data[data.length - 1].c;
  const change = ((last - first) / first) * 100;
  const flat = Math.abs(change) < 0.005;
  const toneText = flat
    ? "text-neutral-400"
    : change > 0
      ? "text-[var(--flow-in)]"
      : "text-red-400";
  const changeText = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  const spanName =
    range === "custom"
      ? `${dateFmt.format(span.from)} – ${dateFmt.format(span.to - 1)}`
      : range;

  const min = Math.min(...data.map((d) => d.l)),
    max = Math.max(...data.map((d) => d.h));
  const pad = (max - min || max * 0.001) * 0.1;
  const lo = min - pad,
    hi = max + pad;
  const iw = w - PAD.left - PAD.right;
  const slot = iw / data.length;
  const x = (i: number) => PAD.left + (i + 0.5) * slot;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * H;
  const body = Math.max(2, Math.min(14, slot * 0.62));
  const ticks = (compact ? [0.2, 0.8] : [0.15, 0.5, 0.85]).map(
    (k) => lo + (hi - lo) * (1 - k),
  );
  const xTicks = [0, 1, 2, 3].map((k) =>
    Math.round((k / 3) * (data.length - 1)),
  );
  const intraday = step < DAY;
  const xLabel = (t: number) =>
    span.to - span.from <= DAY ? timeFmt.format(t) : dateFmt.format(t);
  const h = hover === null ? null : data[hover];
  const hoverWhen = h
    ? span.to - span.from <= DAY
      ? timeFmt.format(h.t)
      : intraday
        ? `${dateFmt.format(h.t)}, ${timeFmt.format(h.t)}`
        : dateFmt.format(h.t)
    : "";

  const rangeSwitch = (
    <div className="relative flex items-center gap-1.5">
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
            onClick={() => {
              setRange(r.id);
              setHover(null);
            }}
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
      <button
        type="button"
        aria-expanded={picking}
        aria-label="Pick dates"
        onClick={() => setPicking((p) => !p)}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs tabular-nums transition-colors ${
          range === "custom"
            ? "border-[var(--ok-fg)]/40 bg-[var(--ok-bg)] text-[var(--ok-fg)]"
            : "border-white/10 text-neutral-400 hover:border-white/25 hover:text-white"
        }`}
      >
        <CalendarDays size={13} strokeWidth={1.75} />
        {range === "custom" ? spanName : "Dates"}
      </button>
      {picking && (
        <DayRangePicker
          value={range === "custom" ? custom : null}
          onClose={() => setPicking(false)}
          onPick={(v) => {
            setCustom(v);
            setRange("custom");
            setHover(null);
            setPicking(false);
          }}
        />
      )}
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
              ? `${rateLabel(pair, h.c)} · ${hoverWhen}`
              : `${changeText} over ${spanName}`}
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
                  rateLabel(pair, h.c)
                ) : (
                  <Roll value={rateLabel(pair, pair.rate)} />
                )}
              </span>
              <span
                className={`text-[13px] tabular-nums ${h ? "text-neutral-500" : toneText}`}
              >
                {h ? hoverWhen : `${changeText} ${spanName}`}
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
            aria-label={`${pair.sell} to ${pair.get} rate, ${spanName}: ${rateLabel(pair, first)} to ${rateLabel(pair, last)} (${changeText})`}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.floor((e.clientX - r.left - PAD.left) / slot);
              setHover(Math.max(0, Math.min(data.length - 1, i)));
            }}
            onPointerLeave={() => setHover(null)}
          >
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
                {/* The live-rate tag wins when they'd overlap */}
                {(range === "custom" || Math.abs(y(v) - y(last)) > 16) && (
                  <text
                    x={w - 4}
                    y={y(v) + 4}
                    textAnchor="end"
                    className="fill-neutral-500 text-[11px] tabular-nums"
                  >
                    {rateLabel(pair, v)}
                  </text>
                )}
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
                {k === xTicks.length - 1 && range !== "custom"
                  ? "Now"
                  : xLabel(data[i].t)}
              </text>
            ))}
            {h && hover !== null && (
              <rect
                x={x(hover) - slot / 2}
                y={PAD.top}
                width={slot}
                height={H}
                fill="currentColor"
                className="text-white/[0.05]"
              />
            )}
            {data.map((c, i) => {
              const up = c.c >= c.o;
              const top = y(Math.max(c.o, c.c));
              return (
                <g key={c.t} opacity={hover === null || hover === i ? 1 : 0.45}>
                  <line
                    x1={x(i)}
                    x2={x(i)}
                    y1={y(c.h)}
                    y2={y(c.l)}
                    stroke={up ? UP : DOWN}
                    strokeWidth="1"
                  />
                  <rect
                    x={x(i) - body / 2}
                    y={top}
                    width={body}
                    height={Math.max(1.5, y(Math.min(c.o, c.c)) - top)}
                    rx={Math.min(2, body / 4)}
                    fill={up ? UP : DOWN}
                  />
                </g>
              );
            })}
            {/* The live rate, marked on the axis */}
            {range !== "custom" && (
              <g>
                <line
                  x1={PAD.left}
                  x2={PAD.left + iw}
                  y1={y(last)}
                  y2={y(last)}
                  stroke="currentColor"
                  strokeDasharray="2 3"
                  className="text-white/25"
                />
                <rect
                  x={PAD.left + iw + 4}
                  y={y(last) - 9}
                  width={PAD.right - 6}
                  height={18}
                  rx={4}
                  fill={change >= 0 ? UP : DOWN}
                />
                <text
                  x={w - 5}
                  y={y(last) + 4}
                  textAnchor="end"
                  className="fill-black text-[11px] font-medium tabular-nums"
                >
                  {rateLabel(pair, last)}
                </text>
              </g>
            )}
          </svg>
          {h && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-[168px] rounded-xl border border-white/10 bg-surface px-3 py-2.5 text-xs shadow-[0_8px_24px_-8px_rgb(0_0_0/0.45)]"
              style={{
                left:
                  x(hover) > iw / 2
                    ? x(hover) - slot / 2 - 176
                    : x(hover) + slot / 2 + 8,
              }}
            >
              <div className="text-neutral-500">{hoverWhen}</div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
                {(
                  [
                    ["Open", h.o],
                    ["High", h.h],
                    ["Low", h.l],
                    ["Close", h.c],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="text-right text-white">
                      {rateLabel(pair, v)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div
                className={`mt-1.5 border-t border-white/8 pt-1.5 text-right ${
                  h.c >= h.o ? "text-[var(--flow-in)]" : "text-red-400"
                }`}
              >
                {h.c >= h.o ? "+" : ""}
                {(((h.c - h.o) / h.o) * 100).toFixed(2)}%
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});
const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Pick a day range on a month calendar: first click starts it, second click ends it.
 * Only the last 90 days have rates. Esc or a click outside closes it.
 */
function DayRangePicker({
  value,
  onPick,
  onClose,
}: {
  value: Span | null;
  onPick: (v: Span) => void;
  onClose: () => void;
}) {
  const today = dayStart(AS_OF);
  const earliest = today - HISTORY_DAYS * DAY;
  const [month, setMonth] = useState(() => {
    const d = new Date(value?.from ?? AS_OF);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const [start, setStart] = useState<number | null>(
    value ? dayStart(value.from) : null,
  );
  const [end, setEnd] = useState<number | null>(
    value ? dayStart(value.to - 1) : null,
  );
  const [over, setOver] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  const m = new Date(month);
  const lead = (m.getDay() + 6) % 7; // weeks start Monday
  const days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: days }, (_, i) =>
      new Date(m.getFullYear(), m.getMonth(), i + 1).getTime(),
    ),
  ];
  const shift = (n: number) =>
    setMonth(new Date(m.getFullYear(), m.getMonth() + n, 1).getTime());
  const canBack = month > earliest;
  const canNext =
    new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime() <= today;

  const tail = end ?? (start !== null ? over : null);
  const [a, b] =
    start !== null && tail !== null
      ? [Math.min(start, tail), Math.max(start, tail)]
      : [start, start];

  const click = (d: number) => {
    if (start === null || end !== null) {
      setStart(d);
      setEnd(null);
    } else setEnd(d);
  };
  const ready = start !== null && end !== null;
  const nDays = a !== null && b !== null ? Math.round((b - a) / DAY) + 1 : 0;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label="Pick dates"
      className="orbit-pop absolute top-10 right-0 z-30 w-[284px] rounded-2xl border border-white/10 bg-surface p-4 shadow-[0_16px_48px_-12px_rgb(0_0_0/0.5)]"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canBack}
          onClick={() => shift(-1)}
          className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          <ChevronLeft size={15} strokeWidth={1.75} />
        </button>
        <span className="text-[13px] font-medium text-white">
          {monthFmt.format(month)}
        </span>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canNext}
          onClick={() => shift(1)}
          className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-white/[0.06] hover:text-white disabled:opacity-25"
        >
          <ChevronRight size={15} strokeWidth={1.75} />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-neutral-500">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="pb-1.5">
            {d}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const off = d > today || d < earliest;
          const edge = d === a || d === b;
          const inside = a !== null && b !== null && d > a && d < b;
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              onClick={() => click(d)}
              onPointerEnter={() => setOver(d)}
              className={`my-px h-8 text-[12px] tabular-nums transition-colors ${
                edge
                  ? "rounded-lg bg-white font-medium text-black"
                  : inside
                    ? "bg-white/[0.08] text-white"
                    : off
                      ? "text-neutral-700"
                      : "rounded-lg text-neutral-300 hover:bg-white/[0.06] hover:text-white"
              } ${d === today && !edge ? "underline decoration-white/30 underline-offset-4" : ""}`}
            >
              {new Date(d).getDate()}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3">
        <span className="text-xs text-neutral-500">
          {start === null
            ? "Pick a start day"
            : !ready
              ? "Now pick an end day"
              : `${nDays} ${nDays === 1 ? "day" : "days"}`}
        </span>
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            a !== null &&
            b !== null &&
            onPick({ from: a, to: Math.min(AS_OF, b + DAY) })
          }
          className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          Show
        </button>
      </div>
    </div>
  );
}
