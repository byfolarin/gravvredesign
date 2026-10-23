"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  MONTH_DAYS,
  SPEND_DAY,
  merchantHistory,
  type MerchantSpend,
} from "../_data";
import { compactMoney } from "../_lib/format";

const OPEN_KEY = "gravv-cards-where-open";
const OTHER = "Other";
/** Fixed categorical order (validated for colour-blind separation); "Other" stays grey. */
const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
];
const H = 200;

const whole = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/**
 * Where card money went, month by month: a year of spend stacked by merchant (top five
 * plus Other), this month's column solid for what's spent and hatched up to where the pace
 * ends it. Hover a month for its breakdown; pick a merchant to see it alone — and the table
 * narrows to the cards that pay it. Collapses to one sentence.
 */
export function WhereItWent({
  merchants,
  merchant,
  onMerchant,
}: {
  merchants: MerchantSpend[];
  merchant: string | null;
  onMerchant: (m: string | null) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(OPEN_KEY) === "0") setOpen(false);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  const [range, setRange] = useState<6 | 12>(12);
  const [hover, setHover] = useState<number | null>(null);

  const top = merchants.slice(0, 5);
  const rest = merchants.slice(5);
  const color = (k: string) =>
    k === OTHER
      ? "var(--series-other)"
      : SERIES[top.findIndex((m) => m.merchant === k)];
  const history = useMemo(() => merchantHistory(merchants), [merchants]);
  const months = history.slice(12 - range).map((h) => {
    const segs = [
      ...top.map((m) => ({ key: m.merchant, v: h.values[m.merchant] ?? 0 })),
      {
        key: OTHER,
        v: rest.reduce((s, m) => s + (h.values[m.merchant] ?? 0), 0),
      },
    ];
    return { ...h, segs, total: segs.reduce((s, x) => s + x.v, 0) };
  });
  const isolated = merchant && top.some((m) => m.merchant === merchant);
  const valueOf = (m: (typeof months)[number]) =>
    isolated ? (m.segs.find((s) => s.key === merchant)?.v ?? 0) : m.total;
  // This month is partial: the pace says where it lands.
  const project = (v: number) => (v * MONTH_DAYS) / SPEND_DAY;
  const last = months.length - 1;
  const max = Math.max(
    ...months.map((m, i) => (i === last ? project(valueOf(m)) : valueOf(m))),
    1,
  );
  const step = niceStep(max / 3);
  const ceil = Math.ceil(max / step) * step;
  const ticks = [0, 1, 2, 3].map((k) => k * step).filter((t) => t <= ceil);
  const px = (v: number) => (v / ceil) * H;

  // The sentence: the peak month and who drove it — or the picked merchant's story.
  const full = months.slice(0, last);
  const peakI = full.reduce(
    (b, m, i) => (valueOf(m) > valueOf(full[b]) ? i : b),
    0,
  );
  const peak = full[peakI];
  const leader = peak?.segs
    .filter((s) => s.key !== OTHER)
    .sort((a, b) => b.v - a.v)[0];
  const thisMonth = months[last];
  const sentence = !peak
    ? null
    : isolated
      ? `${merchant}: most in ${peak.month} ${peak.year} (${compactMoney(valueOf(peak))}). This month ${compactMoney(valueOf(thisMonth))} so far, on pace for ${compactMoney(project(valueOf(thisMonth)))}.`
      : `Most in ${peak.month} ${peak.year} — ${compactMoney(peak.total)}, led by ${leader?.key}. This month is on pace for ${compactMoney(project(thisMonth.total))}.`;

  const focus = months[hover ?? last];

  return (
    <section className="mt-10 border-t border-white/8 pt-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-white">Where it went</h2>
          {sentence && (
            <p className="mt-1 text-[13px] text-neutral-400">{sentence}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <div role="tablist" className="flex items-center gap-0.5">
              {([6, 12] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={range === r}
                  onClick={() => setRange(r)}
                  className={`h-7 rounded-full px-2.5 text-[12px] transition-colors ${range === r ? "" : "text-neutral-500 hover:text-neutral-200"}`}
                >
                  {r}M
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-expanded={open}
            onClick={toggle}
            className="flex h-7 items-center gap-1 rounded-full border border-white/12 pr-2 pl-3 text-[12px] text-neutral-300 transition-colors hover:border-white/30 hover:text-white"
          >
            {open ? "Hide chart" : "Show chart"}
            <ChevronDown
              size={13}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* Legend = the ranking, for the month in focus; click to see one merchant alone */}
          <div className="mt-5 flex flex-wrap items-center gap-1">
            {[
              ...top.map((m) => m.merchant),
              ...(rest.length ? [OTHER] : []),
            ].map((k) => {
              const on = merchant === k;
              const v = focus.segs.find((s) => s.key === k)?.v ?? 0;
              const pickable = k !== OTHER;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  disabled={!pickable}
                  title={
                    pickable
                      ? on
                        ? "Show every merchant"
                        : `See ${k} alone and its cards`
                      : rest.map((m) => m.merchant).join(", ")
                  }
                  onClick={() => onMerchant(on ? null : k)}
                  className={`flex h-8 items-center gap-2 rounded-full px-3 text-[12.5px] transition-[background-color,opacity] ${on ? "bg-white/[0.08] text-white" : "text-neutral-300 enabled:hover:bg-white/[0.05]"} ${isolated && !on ? "opacity-45" : ""} disabled:cursor-default`}
                >
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: color(k) }}
                  />
                  {k === OTHER ? `${rest.length} others` : k}
                  <span className="amount text-neutral-500 tabular-nums">
                    {whole(v)}
                  </span>
                </button>
              );
            })}
            {isolated && (
              <span className="ml-2 text-[12px] text-neutral-500">
                Table shows the cards that pay {merchant}
              </span>
            )}
          </div>

          {/* Plot */}
          <div className="relative mt-4 flex gap-3">
            {/* Value axis */}
            <div
              className="relative w-12 shrink-0 text-right text-[11px] text-neutral-500 tabular-nums"
              style={{ height: H }}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 translate-y-1/2"
                  style={{ bottom: px(t) - 0 }}
                >
                  {t === 0 ? "$0" : compactMoney(t)}
                </span>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <div
                className="relative"
                style={{ height: H }}
                onMouseLeave={() => setHover(null)}
              >
                {ticks.map((t) => (
                  <span
                    key={t}
                    aria-hidden
                    className={`absolute inset-x-0 h-px ${t === 0 ? "bg-white/15" : "bg-white/[0.05]"}`}
                    style={{ bottom: px(t) }}
                  />
                ))}
                <div className="absolute inset-0 flex items-end">
                  {months.map((m, i) => {
                    const partial = i === last;
                    const segs = isolated
                      ? m.segs.filter((s) => s.key === merchant)
                      : m.segs;
                    const v = valueOf(m);
                    const ahead = partial ? project(v) - v : 0;
                    const dim = hover !== null && hover !== i;
                    const shown = segs.filter((s) => s.v > 0);
                    return (
                      <div
                        key={`${m.month}${m.year}`}
                        className="flex h-full flex-1 cursor-crosshair items-end justify-center"
                        onMouseEnter={() => setHover(i)}
                      >
                        <div
                          className={`flex w-[56%] max-w-[44px] flex-col-reverse gap-[2px] transition-opacity ${dim ? "opacity-40" : ""}`}
                        >
                          {shown.map((s, k) => (
                            <span
                              key={s.key}
                              className={`block transition-[height] duration-500 ${k === shown.length - 1 && !ahead ? "rounded-t-[3px]" : ""}`}
                              style={{
                                height: Math.max(1, px(s.v) - 2),
                                background: color(s.key),
                              }}
                            />
                          ))}
                          {ahead > 0 && (
                            <span
                              className="hatch-soft block rounded-t-[3px] border border-b-0 border-dashed border-white/25"
                              style={{ height: px(ahead) }}
                              title="Where this month's pace ends"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* The month in focus, broken down */}
                {hover !== null && (
                  <Tip
                    month={months[hover]}
                    prev={months[hover - 1]}
                    partial={hover === last}
                    color={color}
                    only={isolated ? merchant : null}
                    project={project}
                    left={(hover + 0.5) / months.length}
                  />
                )}
              </div>
              <div className="mt-2 flex text-[11px] text-neutral-500">
                {months.map((m, i) => (
                  <span
                    key={`${m.month}${m.year}`}
                    className={`flex-1 text-center ${hover === i ? "text-neutral-200" : ""}`}
                  >
                    {m.month}
                    {(m.month === "Jan" || i === 0) && (
                      <span className="text-neutral-600">
                        {" "}
                        {String(m.year).slice(2)}
                      </span>
                    )}
                    {i === last && (
                      <span className="text-neutral-600"> · so far</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Tip({
  month: m,
  prev,
  partial,
  color,
  only,
  project,
  left,
}: {
  month: {
    month: string;
    year: number;
    total: number;
    segs: { key: string; v: number }[];
  };
  prev?: { total: number; segs: { key: string; v: number }[] };
  partial: boolean;
  color: (k: string) => string;
  only: string | null;
  project: (v: number) => number;
  left: number;
}) {
  const rows = (only ? m.segs.filter((s) => s.key === only) : m.segs)
    .filter((s) => s.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = only ? (rows[0]?.v ?? 0) : m.total;
  const before = prev
    ? only
      ? (prev.segs.find((s) => s.key === only)?.v ?? 0)
      : prev.total
    : 0;
  const change = before && !partial ? (total - before) / before : null;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-[230px] rounded-xl border border-white/10 bg-raised p-3 text-[12px] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)]"
      style={{
        left: `${left * 100}%`,
        transform: `translateX(${left > 0.7 ? "calc(-100% - 28px)" : "28px"})`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-neutral-400">
          {m.month} {m.year}
          {partial && " · so far"}
        </span>
        <span className="amount text-[13px] font-medium text-white tabular-nums">
          {whole(total)}
        </span>
      </div>
      <div className="mt-0.5 text-right text-[11px] text-neutral-500 tabular-nums">
        {partial
          ? `On pace for ${whole(project(total))}`
          : change !== null
            ? `${change >= 0 ? "↑" : "↓"} ${Math.abs(change * 100).toFixed(0)}% vs the month before`
            : " "}
      </div>
      <ul className="mt-2 space-y-1 border-t border-white/8 pt-2">
        {rows.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: color(s.key) }}
            />
            <span className="min-w-0 flex-1 truncate text-neutral-300">
              {s.key}
            </span>
            <span className="amount text-neutral-200 tabular-nums">
              {whole(s.v)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
