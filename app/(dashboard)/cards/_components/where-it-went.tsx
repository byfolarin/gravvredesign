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
/** Plot height, and the room kept above the tallest bar for its callout. */
const H = 230;
const HEADROOM = 44;

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
 * Where card money went, month by month — the way Transactions marks its biggest moves:
 * one bar per month for what cards spent, and above each one the two merchants that took
 * the most that month. This month is solid for what's spent and hatched up to its pace.
 * Hover a month for its full ranking; pick a merchant to follow it alone (the table narrows
 * to the cards that pay it). Collapses to one sentence.
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

  const history = useMemo(() => merchantHistory(merchants), [merchants]);
  const months = history.slice(12 - range).map((h) => {
    const ranked = merchants
      .map((m) => ({ key: m.merchant, v: h.values[m.merchant] ?? 0 }))
      .filter((s) => s.v > 0)
      .sort((a, b) => b.v - a.v);
    return { ...h, ranked, total: ranked.reduce((s, x) => s + x.v, 0) };
  });
  type Month = (typeof months)[number];
  const valueOf = (m: Month) =>
    merchant ? (m.ranked.find((s) => s.key === merchant)?.v ?? 0) : m.total;
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
  const px = (v: number) => (v / ceil) * (H - HEADROOM);

  // The sentence: the peak month and who drove it — or the picked merchant's story.
  const full = months.slice(0, last);
  const peak = full.reduce<Month | undefined>(
    (b, m) => (!b || valueOf(m) > valueOf(b) ? m : b),
    undefined,
  );
  const thisMonth = months[last];
  const sentence = !peak
    ? null
    : merchant
      ? `${merchant}: most in ${peak.month} ${peak.year} (${compactMoney(valueOf(peak))}). This month ${compactMoney(valueOf(thisMonth))} so far, on pace for ${compactMoney(project(valueOf(thisMonth)))}.`
      : `Most in ${peak.month} ${peak.year} — ${compactMoney(peak.total)}, led by ${peak.ranked[0]?.key}. This month is on pace for ${compactMoney(project(thisMonth.total))}.`;

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
          {/* Follow one merchant: the bars become its spend, the table its cards */}
          <div className="mt-5 flex flex-wrap items-center gap-1">
            <button
              type="button"
              aria-pressed={!merchant}
              onClick={() => onMerchant(null)}
              className={`h-8 rounded-full px-3 text-[12.5px] transition-colors ${!merchant ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}
            >
              All merchants
            </button>
            {merchants.map((m) => {
              const on = merchant === m.merchant;
              return (
                <button
                  key={m.merchant}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onMerchant(on ? null : m.merchant)}
                  className={`h-8 rounded-full px-3 text-[12.5px] transition-colors ${on ? "bg-white/[0.08] text-white" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  {m.merchant}
                </button>
              );
            })}
            {merchant && (
              <span className="ml-2 text-[12px] text-neutral-500">
                Table shows the cards that pay {merchant}
              </span>
            )}
          </div>

          {/* Plot */}
          <div className="relative mt-4 flex gap-3">
            <div
              className="relative w-12 shrink-0 text-right text-[11px] text-neutral-500 tabular-nums"
              style={{ height: H }}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-0 translate-y-1/2"
                  style={{ bottom: px(t) }}
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
                    const v = valueOf(m);
                    const ahead = partial ? project(v) - v : 0;
                    const dim = hover !== null && hover !== i;
                    const rank = merchant
                      ? m.ranked.findIndex((s) => s.key === merchant) + 1
                      : 0;
                    return (
                      <div
                        key={`${m.month}${m.year}`}
                        className="flex h-full min-w-0 flex-1 cursor-crosshair flex-col items-center justify-end"
                        onMouseEnter={() => setHover(i)}
                      >
                        {/* The month's top two, like Transactions marks its biggest moves */}
                        <span
                          className={`mb-1.5 rounded-md bg-surface px-1.5 py-1 text-[10.5px] leading-[1.35] whitespace-nowrap ring-1 ring-white/10 transition-opacity ${hover !== null ? "opacity-0" : ""}`}
                        >
                          {merchant ? (
                            <span className="block text-neutral-300 tabular-nums">
                              {rank ? `#${rank} that month` : "Not paid"}
                            </span>
                          ) : (
                            m.ranked.slice(0, 2).map((s) => (
                              <span
                                key={s.key}
                                title={`${s.key} ${whole(s.v)}`}
                                className="flex items-baseline justify-between gap-2"
                              >
                                <span className="text-neutral-400">
                                  {s.key.split(" ")[0]}
                                </span>
                                <span className="amount text-neutral-200 tabular-nums">
                                  {compactMoney(s.v).replace("$", "")}
                                </span>
                              </span>
                            ))
                          )}
                        </span>
                        <div
                          className={`flex w-[56%] max-w-[44px] flex-col transition-opacity ${dim ? "opacity-40" : ""}`}
                        >
                          {ahead > 0 && (
                            <span
                              className="hatch-soft block rounded-t-[4px] border border-b-0 border-dashed border-white/25"
                              style={{ height: px(ahead) }}
                              title="Where this month's pace ends"
                            />
                          )}
                          <span
                            className={`block bg-[color-mix(in_srgb,var(--color-white)_62%,transparent)] transition-[height] duration-500 ${ahead > 0 ? "" : "rounded-t-[4px]"}`}
                            style={{ height: Math.max(1, px(v)) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hover !== null && (
                  <Tip
                    month={months[hover]}
                    prev={months[hover - 1]}
                    partial={hover === last}
                    only={merchant}
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
  only,
  project,
  left,
}: {
  month: {
    month: string;
    year: number;
    total: number;
    ranked: { key: string; v: number }[];
  };
  prev?: { total: number; ranked: { key: string; v: number }[] };
  partial: boolean;
  only: string | null;
  project: (v: number) => number;
  left: number;
}) {
  const pick = (x: { total: number; ranked: { key: string; v: number }[] }) =>
    only ? (x.ranked.find((s) => s.key === only)?.v ?? 0) : x.total;
  const total = pick(m);
  const before = prev ? pick(prev) : 0;
  const change = before && !partial ? (total - before) / before : null;
  const shown = m.ranked.slice(0, 5);
  const others = m.ranked.slice(5);
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-[240px] rounded-xl border border-white/10 bg-raised p-3 text-[12px] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)]"
      style={{
        left: `${left * 100}%`,
        transform: `translateX(${left > 0.7 ? "calc(-100% - 28px)" : "28px"})`,
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-neutral-400">
          {m.month} {m.year}
          {partial && " · so far"}
          {only && ` · ${only}`}
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
      <ol className="mt-2 space-y-1 border-t border-white/8 pt-2">
        {shown.map((s, i) => (
          <li
            key={s.key}
            className={`flex items-center gap-2 ${only && s.key !== only ? "opacity-45" : ""}`}
          >
            <span className="w-3 shrink-0 text-right text-neutral-600 tabular-nums">
              {i + 1}
            </span>
            <span
              className={`min-w-0 flex-1 truncate ${s.key === only ? "text-white" : "text-neutral-300"}`}
            >
              {s.key}
            </span>
            <span className="amount text-neutral-200 tabular-nums">
              {whole(s.v)}
            </span>
          </li>
        ))}
        {others.length > 0 && (
          <li className="flex items-center gap-2 text-neutral-500">
            <span className="w-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {others.length} more
            </span>
            <span className="amount tabular-nums">
              {whole(others.reduce((s, x) => s + x.v, 0))}
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}
