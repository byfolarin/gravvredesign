"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  Pencil,
  Search,
  Snowflake,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { NetworkLogo } from "./network-logo";
import { Roll } from "@/app/_components/roll";
import { AS_OF, networkNotes, type Network, type Wallet } from "../_data";

const NETWORKS: Network[] = ["Polygon", "Ethereum", "Stellar", "Avalanche"];
const PAGE_SIZES = [10, 20, 50, 100];
type Tab = "Address" | "Activity" | "Details";

const usdc = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

/** Cents (with the point) as a light superscript: 23,445.⁰⁰ */
function Cents({ value }: { value: string }) {
  return (
    <sup className="ml-px align-[0.55em] text-[0.5em] font-normal tracking-normal text-neutral-500">
      <Roll value={`.${value.split(".")[1]}`} />
    </sup>
  );
}
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});
const short = (v: string, head = 6, tail = 4) =>
  v.length > head + tail + 1 ? `${v.slice(0, head)}…${v.slice(-tail)}` : v;

const DAY = 1000 * 60 * 60 * 24;
/** One brand hue in four strengths; each network keeps its shade whatever its rank. */
const NETWORK_TONES: Record<Network, string> = {
  Polygon: "bg-brand",
  Ethereum: "bg-brand/65",
  Avalanche: "bg-brand/40",
  Stellar: "bg-brand/22",
};
type Segment = "Funded" | "Never funded" | "Frozen" | "All";

const ago = (iso: string) => {
  const h = Math.max(0, Math.round((AS_OF - Date.parse(iso)) / (DAY / 24)));
  return h < 1
    ? "just now"
    : h < 24
      ? `${h}h ago`
      : `${Math.round(h / 24)}d ago`;
};

/** Deposits per day over the last 14 days, oldest first. */
function dailyDeposits(wallets: Wallet[]) {
  const days = Array.from({ length: 14 }, () => 0);
  for (const w of wallets)
    for (const a of w.activity) {
      if (a.direction !== "in") continue;
      const back = Math.floor((AS_OF - Date.parse(a.date)) / DAY);
      if (back >= 0 && back < 14) days[13 - back] += a.amount;
    }
  return days;
}

type Flow = { day: number; in: number; out: number };
type Period = 7 | 30 | 90;
const PERIODS: Period[] = [7, 30, 90];

/**
 * Money in and out per day for `n` days, oldest first, ending `offset` days before today.
 * `day` is the UTC midnight timestamp.
 */
function dailyFlow(wallets: Wallet[], n: number, offset = 0): Flow[] {
  const today = Math.floor(AS_OF / DAY) * DAY - offset * DAY;
  const days: Flow[] = Array.from({ length: n }, (_, i) => ({
    day: today - (n - 1 - i) * DAY,
    in: 0,
    out: 0,
  }));
  for (const w of wallets)
    for (const a of w.activity) {
      const index =
        n - 1 - Math.floor((today + DAY - 1 - Date.parse(a.date)) / DAY);
      if (index < 0 || index >= n) continue;
      if (a.direction === "in") days[index].in += a.amount;
      else days[index].out += a.amount;
    }
  return days;
}

/** UTC midnight of the day an ISO timestamp falls on. */
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY) * DAY;

const shortDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const compact = (v: number) =>
  v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));

/** "↑ 18% vs previous 30d", or a plain note when there's nothing to compare against. */
function Change({
  now,
  before,
  period,
  inverse = false,
}: {
  now: number;
  before: number;
  period: Period;
  inverse?: boolean;
}) {
  if (before === 0)
    return <span className="text-xs text-neutral-600">no earlier data</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  // More money in is good; more money out is neutral, so it never turns "good" colour.
  const tone =
    pct === 0
      ? "text-neutral-500"
      : up && !inverse
        ? "text-[var(--flow-in)]"
        : "text-neutral-400";
  return (
    <span className={`text-xs tabular-nums ${tone}`}>
      {up ? "↑" : "↓"} {Math.abs(pct)}%{" "}
      <span className="text-neutral-600">vs previous {period}d</span>
    </span>
  );
}

const CHART_KEY = "gravv-wallets-flow-chart";

/**
 * Diverging daily bars: deposits above the zero line, withdrawals below, on one shared scale.
 * Direction is carried by position as well as colour. Clicking a day filters the table to it.
 */
function FlowChart({
  wallets,
  period,
  onPeriod,
  selectedDay,
  onSelectDay,
}: {
  wallets: Wallet[];
  period: Period;
  onPeriod: (p: Period) => void;
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Hidden by default; the viewer's choice is remembered in this browser.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(CHART_KEY) === "open") setOpen(true);
      } catch {
        // Storage unavailable; stay hidden.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(CHART_KEY, next ? "open" : "closed");
    } catch {
      // Storage unavailable; the toggle still works for this visit.
    }
  };

  const days = dailyFlow(wallets, period);
  const prev = dailyFlow(wallets, period, period);
  const totalIn = days.reduce((s, d) => s + d.in, 0);
  const totalOut = days.reduce((s, d) => s + d.out, 0);
  const prevIn = prev.reduce((s, d) => s + d.in, 0);
  const prevOut = prev.reduce((s, d) => s + d.out, 0);

  // Biggest single deposit and withdrawal in the period, for callouts.
  const start = days[0].day;
  const txns = wallets.flatMap((w) =>
    w.activity
      .filter((a) => dayOf(a.date) >= start)
      .map((a) => ({ ...a, wallet: w.name })),
  );
  const biggest = (dir: "in" | "out") =>
    txns
      .filter((a) => a.direction === dir)
      .reduce<(typeof txns)[number] | null>(
        (m, a) => (!m || a.amount > m.amount ? a : m),
        null,
      );
  const topIn = biggest("in");
  const topOut = biggest("out");

  // Quick stats
  const busiest = days.reduce(
    (m, d) => (d.in + d.out > m.in + m.out ? d : m),
    days[0],
  );
  const avgIn = totalIn / period;
  const depositCount = txns.filter((a) => a.direction === "in").length;
  const active = new Set(txns.map((a) => a.wallet)).size;

  const maxIn = Math.max(...days.map((d) => d.in), 1);
  const maxOut = Math.max(...days.map((d) => d.out), 0);
  const plot = 176;
  const scale = plot / (maxIn + maxOut || 1);
  const top = maxIn * scale + 26; // headroom for the deposit callout
  const bottom = Math.max(maxOut * scale, 24) + 26; // and for the withdrawal callout
  const zero = top;
  const h = hover === null ? null : days[hover];
  const at = (i: number) => `${((i + 0.5) / period) * 100}%`;
  const indexOf = (iso: string) => days.findIndex((d) => d.day === dayOf(iso));

  // Value axis: clean steps (1, 2, 2.5, 5 × 10ⁿ) above and below the zero line.
  const step = (() => {
    const raw = Math.max(maxIn, maxOut) / 2 || 1;
    const pow = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].find((m) => m * pow >= raw)! * pow;
  })();
  const ticks: { value: number; y: number }[] = [{ value: 0, y: zero }];
  for (let t = step; t <= maxIn * 1.02; t += step)
    ticks.push({ value: t, y: zero - t * scale });
  for (let t = step; t <= maxOut * 1.02; t += step)
    ticks.push({ value: -t, y: zero + t * scale });

  return (
    <div className="relative">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
          Money movement
        </h2>
        <span className="text-xs text-neutral-500">
          Deposits and withdrawals across all wallets
        </span>
      </div>

      {/* Summary line — always visible; the toggle shows or hides the chart */}
      <div
        className={`mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 ${open ? "mb-6" : ""}`}
      >
        <div className="flex items-baseline gap-2.5">
          <span
            className="h-2.5 w-1.5 self-center rounded-[1px] bg-[var(--flow-in)]"
            aria-hidden
          />
          <span className="text-xs text-neutral-500">In</span>
          <span className="amount text-[17px] font-medium tracking-[-0.01em] text-white tabular-nums">
            <Roll value={`+${usdc(totalIn)}`} />
          </span>
          <Change now={totalIn} before={prevIn} period={period} />
        </div>
        <div className="flex items-baseline gap-2.5">
          <span
            className="h-2.5 w-1.5 self-center rounded-[1px] bg-[var(--flow-out)]"
            aria-hidden
          />
          <span className="text-xs text-neutral-500">Out</span>
          <span className="amount text-[17px] font-medium tracking-[-0.01em] text-neutral-200 tabular-nums">
            <Roll value={`−${usdc(totalOut)}`} />
          </span>
          <Change now={totalOut} before={prevOut} period={period} inverse />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            role="radiogroup"
            aria-label="Period"
            className="flex rounded-full bg-white/[0.07] p-0.5"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => {
                  onPeriod(p);
                  onSelectDay(null);
                }}
                className={`h-7 rounded-full px-2.5 text-xs tabular-nums transition-colors ${
                  period === p
                    ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {p}D
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls="wallet-flow-chart"
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {open ? "Hide chart" : "Show chart"}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div
          id="wallet-flow-chart"
          className="orbit-pop rounded-2xl border border-white/5 bg-white/[0.015] px-6 pt-6 pb-5"
        >
          <div className="relative pl-12">
            {/* Value axis labels */}
            {ticks.map((t) => (
              <span
                key={t.value}
                className="pointer-events-none absolute left-0 w-10 -translate-y-1/2 text-right text-[10px] text-neutral-500 tabular-nums"
                style={{ top: t.y }}
                aria-hidden
              >
                {t.value === 0
                  ? "0"
                  : `${t.value > 0 ? "+" : "−"}${compact(Math.abs(t.value))}`}
              </span>
            ))}
            <div
              className={`relative flex ${period > 30 ? "gap-px" : "gap-[3px]"}`}
              style={{ height: top + bottom }}
              onMouseLeave={() => setHover(null)}
              role="group"
              aria-label={`Deposits and withdrawals per day, last ${period} days. Select a day to filter wallets.`}
            >
              {/* Gridlines + zero line */}
              {ticks
                .filter((t) => t.value !== 0)
                .map((t) => (
                  <span
                    key={t.value}
                    className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.05]"
                    style={{ top: t.y }}
                    aria-hidden
                  />
                ))}
              <span
                className="pointer-events-none absolute inset-x-0 h-px bg-white/15"
                style={{ top: zero }}
                aria-hidden
              />

              {/* Average daily deposits */}
              {avgIn > 0 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[2]"
                  style={{ top: zero - avgIn * scale }}
                  aria-hidden
                >
                  <div className="border-t border-dashed border-white/25" />
                  <span className="absolute left-0 -top-[18px] z-[2] rounded bg-surface px-1 text-[10px] text-neutral-400 tabular-nums">
                    avg {compact(avgIn)}/day
                  </span>
                </div>
              )}

              {days.map((d, i) => {
                const selected = selectedDay === d.day;
                const dim =
                  (hover !== null && hover !== i) ||
                  (selectedDay !== null && !selected && hover === null);
                return (
                  <button
                    key={d.day}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => onSelectDay(selected ? null : d.day)}
                    aria-pressed={selected}
                    aria-label={`${longDay.format(d.day)}: in ${usdc(d.in)}, out ${usdc(d.out)}`}
                    className="relative h-full flex-1 cursor-pointer outline-none"
                  >
                    <span
                      className={`absolute inset-0 rounded-sm transition-colors ${
                        selected
                          ? "bg-white/[0.07]"
                          : hover === i
                            ? "bg-white/[0.04]"
                            : ""
                      }`}
                      aria-hidden
                    />
                    {d.in > 0 && (
                      <span
                        className={`absolute inset-x-[15%] rounded-t-[3px] bg-[var(--flow-in)] transition-opacity ${dim ? "opacity-35" : ""}`}
                        style={{
                          bottom: bottom + 1,
                          height: Math.max(2, d.in * scale - 1),
                        }}
                        aria-hidden
                      />
                    )}
                    {d.out > 0 && (
                      <span
                        className={`absolute inset-x-[15%] rounded-b-[3px] bg-[var(--flow-out)] transition-opacity ${dim ? "opacity-35" : ""}`}
                        style={{
                          top: zero + 1,
                          height: Math.max(2, d.out * scale - 1),
                        }}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}

              {/* Callouts on the biggest movements */}
              {topIn && indexOf(topIn.date) >= 0 && hover === null && (
                <Callout
                  left={at(indexOf(topIn.date))}
                  top={zero - days[indexOf(topIn.date)].in * scale - 22}
                  text={`+${compact(topIn.amount)} · ${topIn.wallet}`}
                />
              )}
              {topOut && indexOf(topOut.date) >= 0 && hover === null && (
                <Callout
                  left={at(indexOf(topOut.date))}
                  top={zero + days[indexOf(topOut.date)].out * scale + 6}
                  text={`−${compact(topOut.amount)} · ${topOut.counterparty}`}
                  muted
                />
              )}

              {/* Tooltip */}
              {h && hover !== null && (
                <div
                  className="pointer-events-none absolute top-0 z-10 w-52 rounded-lg border border-white/10 bg-raised px-3 py-2.5 text-xs shadow-2xl"
                  style={{
                    left: `clamp(0px, calc(${at(hover)} - 104px), calc(100% - 208px))`,
                  }}
                >
                  <div className="text-neutral-400">
                    {longDay.format(h.day)}
                  </div>
                  <div className="mt-1.5 flex justify-between text-neutral-200 tabular-nums">
                    <span>In</span>
                    <span>+{usdc(h.in)}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-neutral-400 tabular-nums">
                    <span>Out</span>
                    <span>−{usdc(h.out)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between border-t border-white/8 pt-1.5 font-medium text-white tabular-nums">
                    <span>Net</span>
                    <span>
                      {h.in - h.out >= 0 ? "+" : "−"}
                      {usdc(Math.abs(h.in - h.out))}
                    </span>
                  </div>
                  {(h.in > 0 || h.out > 0) && (
                    <div className="mt-2 text-[11px] text-neutral-500">
                      {selectedDay === h.day
                        ? "Click to clear"
                        : "Click to see these wallets"}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date axis */}
          <div className="mt-2 flex justify-between pl-12 text-[11px] text-neutral-500 tabular-nums">
            <span>{shortDay.format(days[0].day)}</span>
            <span>{shortDay.format(days[Math.floor(period / 2)].day)}</span>
            <span>Today</span>
          </div>

          {/* Quick stats */}
          <dl className="mt-6 grid grid-cols-2 gap-y-4 border-t border-white/8 pt-5 sm:grid-cols-4">
            <Stat
              label="Busiest day"
              value={
                busiest.in + busiest.out > 0
                  ? shortDay.format(busiest.day)
                  : "—"
              }
              sub={
                busiest.in + busiest.out > 0
                  ? `${compact(busiest.in + busiest.out)} moved`
                  : undefined
              }
            />
            <Stat
              label="Average in"
              value={`${compact(avgIn)}`}
              sub="per day"
            />
            <Stat
              label="Deposits"
              value={String(depositCount)}
              sub={`in ${period} days`}
            />
            <Stat
              label="Active wallets"
              value={String(active)}
              sub={`of ${wallets.length}`}
            />
          </dl>
        </div>
      )}
    </div>
  );
}

function Callout({
  left,
  top,
  text,
  muted = false,
}: {
  left: string;
  top: number;
  text: string;
  muted?: boolean;
}) {
  return (
    <span
      className={`pointer-events-none absolute z-[1] -translate-x-1/2 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10.5px] whitespace-nowrap tabular-nums ${
        muted ? "text-neutral-400" : "text-neutral-100"
      }`}
      style={{ left: `clamp(80px, ${left}, calc(100% - 80px))`, top }}
    >
      {text}
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-[15px] font-medium text-white tabular-nums">
        {value}
        {sub && (
          <span className="ml-1.5 text-xs font-normal text-neutral-500">
            {sub}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Segmented column chart; the same segment language as the network bar. */
function DayBars({
  days,
  height = 40,
  width = 6,
  gap = 3,
  fill = false,
  format = usdc,
}: {
  days: number[];
  height?: number;
  width?: number;
  gap?: number;
  /** Stretch the bars to the container's width. */
  fill?: boolean;
  format?: (v: number) => string;
}) {
  const max = Math.max(...days, 1);
  return (
    <div className="flex items-end" style={{ height, gap }} aria-hidden>
      {days.map((v, i) => (
        <span
          key={i}
          title={v ? format(v) : undefined}
          className={`rounded-[1px] ${fill ? "flex-1" : ""} ${v ? (i === days.length - 1 ? "bg-[var(--flow-in)]" : "bg-white/60") : "bg-white/10"}`}
          style={{
            width: fill ? undefined : width,
            height: v ? Math.max(4, (v / max) * height) : 2,
          }}
        />
      ))}
    </div>
  );
}

export function WalletsWorkspace({
  initialWallets,
}: {
  initialWallets: Wallet[];
}) {
  // Local state until the Wallets API is wired up.
  const [list, setList] = useState(initialWallets);
  const [segment, setSegment] = useState<Segment>("Funded");
  const [period, setPeriod] = useState<Period>(30);
  const [day, setDay] = useState<number | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  // The row whose details are open inline, and the row being renamed.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  // Bulk selection, by wallet id. Survives paging and filtering until cleared.
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    message: string;
    undo?: () => void;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const notify = (message: string) => setToast({ message });
  const update = (id: string, patch: Partial<Wallet>) =>
    setList((l) => l.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  // Header facts
  const total = list.reduce((s, w) => s + w.balance, 0);
  const split = NETWORKS.map((n) => ({
    name: n,
    amount: list
      .filter((w) => w.network === n)
      .reduce((s, w) => s + w.balance, 0),
  }))
    .filter((n) => n.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const neverFunded = list.filter((w) => w.activity.length === 0).length;
  // Wallets created per day, last 30 days (oldest first)
  const today = Math.floor(AS_OF / DAY) * DAY;
  const created = Array.from({ length: 30 }, () => 0);
  for (const w of list) {
    const back = Math.round((today - dayOf(w.createdAt)) / DAY);
    if (back >= 0 && back < 30) created[29 - back] += 1;
  }
  const createdBefore = list.filter((w) => {
    const back = Math.round((today - dayOf(w.createdAt)) / DAY);
    return back >= 30 && back < 60;
  }).length;
  const createdNow = created.reduce((a, b) => a + b, 0);
  const fundedCount = list.length - neverFunded;
  const fundedBalance = list
    .filter((w) => w.activity.length > 0)
    .reduce((s, w) => s + w.balance, 0);
  const net30 = dailyFlow(list, 30).reduce((s, d) => s + d.in - d.out, 0);
  const busiestCreated = created.reduce(
    (m, c, i) => (c > m.count ? { count: c, day: today - (29 - i) * DAY } : m),
    { count: 0, day: today },
  );

  const inSegment = (w: Wallet, s: Segment) =>
    s === "All"
      ? true
      : s === "Frozen"
        ? !!w.frozen
        : s === "Funded"
          ? w.balance > 0
          : w.activity.length === 0;
  const count = (s: Segment) => list.filter((w) => inSegment(w, s)).length;

  const q = query.trim().toLowerCase();
  const rows = list
    .filter((w) => inSegment(w, segment))
    .filter(
      (w) => day === null || w.activity.some((a) => dayOf(a.date) === day),
    )
    .filter((w) => !network || w.network === network)
    .filter(
      (w) =>
        !q ||
        [w.name, w.address, w.customerId, w.id].some((v) =>
          v.toLowerCase().includes(q),
        ),
    )
    .sort(
      (a, b) => b.balance - a.balance || b.createdAt.localeCompare(a.createdAt),
    );
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * perPage, current * perPage);
  const go = (s: Segment) => {
    setSegment(s);
    setPage(1);
  };

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageIds = visible.map((w) => w.id);
  const pageAll = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const pageSome = !pageAll && pageIds.some((id) => checked.has(id));
  const picked = list.filter((w) => checked.has(w.id));
  const bulk = {
    freeze: () => {
      const ids = picked.filter((w) => !w.frozen).map((w) => w.id);
      const now = new Date().toISOString();
      setList((l) =>
        l.map((w) =>
          ids.includes(w.id) ? { ...w, frozen: true, frozenAt: now } : w,
        ),
      );
      notify(`${ids.length} ${ids.length === 1 ? "wallet" : "wallets"} frozen`);
      setChecked(new Set());
    },
    unfreeze: () => {
      const ids = picked.filter((w) => w.frozen).map((w) => w.id);
      setList((l) =>
        l.map((w) =>
          ids.includes(w.id) ? { ...w, frozen: false, frozenAt: undefined } : w,
        ),
      );
      notify(
        `${ids.length} ${ids.length === 1 ? "wallet" : "wallets"} unfrozen`,
      );
      setChecked(new Set());
    },
    download: () => {
      downloadStatements(picked);
      notify(
        `Statements for ${picked.length} ${picked.length === 1 ? "wallet" : "wallets"} downloaded`,
      );
    },
    archive: () => {
      const empty = picked.filter((w) => w.balance === 0);
      const before = list;
      setList((l) => l.filter((w) => !empty.some((e) => e.id === w.id)));
      setChecked(new Set());
      setToast({
        message: `${empty.length} empty ${empty.length === 1 ? "wallet" : "wallets"} archived`,
        undo: () => setList(before),
      });
    },
  };

  const actions = (w: Wallet) => ({
    onRename: (name: string) => {
      update(w.id, { name });
      notify(`Renamed to ${name}`);
    },
    onToggleFreeze: () => {
      update(w.id, {
        frozen: !w.frozen,
        frozenAt: w.frozen ? undefined : new Date().toISOString(),
      });
      notify(
        w.frozen ? `${w.name} unfrozen` : `${w.name} frozen — transfers paused`,
      );
    },
    onArchive: () => {
      const index = list.findIndex((x) => x.id === w.id);
      setList((l) => l.filter((x) => x.id !== w.id));
      if (selectedId === w.id) setSelectedId(null);
      setToast({
        message: `${w.name} archived`,
        undo: () =>
          setList((l) => [...l.slice(0, index), w, ...l.slice(index)]),
      });
    },
  });

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Wallets
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Manage and monitor blockchain wallets for your customers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => notify("Create wallet flow is next")}
              className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Create wallet
            </button>
          </div>
        </div>

        {/* Three facts, one structure: label · number + one more figure · full-width bar · one line of context */}
        <div className="mt-10 grid gap-y-10 border-t border-white/8 pt-7 lg:grid-cols-3">
          {/* Held, split by network */}
          <Fact
            label="Held · USDC"
            value={
              <span className="amount">
                <Roll value={usdc(total).split(".")[0]} />
                <Cents value={usdc(total)} />
              </span>
            }
            aside={
              <span
                className={
                  net30 >= 0 ? "text-[var(--flow-in)]" : "text-neutral-400"
                }
              >
                {net30 >= 0 ? "+" : "−"}
                {compact(Math.abs(net30))}{" "}
                <span className="text-neutral-500">30d</span>
              </span>
            }
            bar={
              <div className="flex h-3 gap-[2px]" aria-hidden>
                {split.flatMap((n) =>
                  Array.from(
                    {
                      length: Math.max(1, Math.round((n.amount / total) * 32)),
                    },
                    (_, i) => (
                      <span
                        key={`${n.name}-${i}`}
                        className={`flex-1 rounded-[1px] transition-opacity ${NETWORK_TONES[n.name]} ${network && network !== n.name ? "opacity-25" : ""}`}
                      />
                    ),
                  ),
                )}
              </div>
            }
            footer={
              <>
                <span className="flex items-center gap-2">
                  {/* Overlapping logos; each one filters */}
                  <span className="flex -space-x-1">
                    {split.map((n) => {
                      const pct = Math.round((n.amount / total) * 100);
                      return (
                        <button
                          key={n.name}
                          type="button"
                          aria-pressed={network === n.name}
                          aria-label={`${n.name} ${pct}%`}
                          title={`${n.name} ${pct}%`}
                          onClick={() => {
                            setNetwork(network === n.name ? null : n.name);
                            setPage(1);
                          }}
                          className={`rounded-full ring-2 ring-[var(--surface)] transition-[opacity,transform] hover:z-10 hover:-translate-y-px ${
                            network && network !== n.name ? "opacity-40" : ""
                          }`}
                        >
                          <NetworkLogo network={n.name} size={16} />
                        </button>
                      );
                    })}
                  </span>
                  <span className="tabular-nums">
                    {(() => {
                      const lead =
                        split.find((n) => n.name === network) ?? split[0];
                      if (!lead) return null;
                      return (
                        <>
                          <span className="text-neutral-300">
                            {lead.name}{" "}
                            {Math.round((lead.amount / total) * 100)}%
                          </span>
                          {!network &&
                            split.length > 1 &&
                            ` · ${split.length - 1} more`}
                        </>
                      );
                    })()}
                  </span>
                </span>
                {network && (
                  <button
                    type="button"
                    onClick={() => setNetwork(null)}
                    className="text-neutral-400 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </>
            }
          />

          {/* Funded wallets */}
          <Fact
            label="Funded wallets"
            value={
              <>
                <Roll value={String(fundedCount)} />
                <span className="ml-2 text-[15px] font-normal tracking-normal text-neutral-500">
                  of {list.length}
                </span>
              </>
            }
            aside={
              <span className="text-neutral-300">
                {Math.round((fundedCount / Math.max(1, list.length)) * 100)}%
              </span>
            }
            bar={
              <div className="flex h-3 gap-[2px]" aria-hidden>
                {Array.from({ length: 32 }, (_, i) => (
                  <span
                    key={i}
                    className={`flex-1 rounded-[1px] ${i < Math.round((fundedCount / Math.max(1, list.length)) * 32) ? "bg-brand" : "bg-white/10"}`}
                  />
                ))}
              </div>
            }
            footer={
              <>
                <span className="tabular-nums">
                  Avg{" "}
                  {Math.round(
                    fundedBalance / Math.max(1, fundedCount),
                  ).toLocaleString("en-US")}{" "}
                  USDC each
                </span>
                <button
                  type="button"
                  onClick={() => go("Never funded")}
                  className="flex items-center gap-0.5 font-medium text-white hover:underline hover:underline-offset-4"
                >
                  Show unfunded
                  <ChevronRight size={13} strokeWidth={2} />
                </button>
              </>
            }
          />

          {/* New wallets, last 30 days */}
          <Fact
            label="New wallets · 30 days"
            value={<Roll value={String(createdNow)} />}
            aside={
              createdBefore > 0 ? (
                <span
                  className={
                    createdNow >= createdBefore
                      ? "text-[var(--flow-in)]"
                      : "text-neutral-400"
                  }
                >
                  {createdNow >= createdBefore ? "↑" : "↓"}{" "}
                  {Math.abs(createdNow - createdBefore)}{" "}
                  <span className="text-neutral-500">vs prev 30d</span>
                </span>
              ) : undefined
            }
            bar={
              <DayBars
                days={created}
                height={24}
                gap={2}
                fill
                format={(v) => `${v} created`}
              />
            }
            footer={
              <span className="tabular-nums">
                {busiestCreated.count > 0
                  ? `Busiest ${shortDay.format(busiestCreated.day)} · ${busiestCreated.count} created`
                  : "None created yet"}
              </span>
            }
          />
        </div>

        {/* The anchor chart: money in vs out */}
        <section className="mt-14">
          <FlowChart
            wallets={list}
            period={period}
            onPeriod={setPeriod}
            selectedDay={day}
            onSelectDay={(d) => {
              setDay(d);
              setPage(1);
              // A day can include wallets outside the current tab (e.g. a withdrawal that emptied one).
              if (d !== null) setSegment("All");
            }}
          />
        </section>

        {/* Segments + search */}
        <div className="mt-14 flex items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
            {(["Funded", "Never funded", "Frozen", "All"] as Segment[]).map(
              (s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={segment === s}
                  onClick={() => go(s)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                    segment === s
                      ? "bg-white/[0.08] font-medium text-white"
                      : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  {s}
                  <span
                    className={`text-xs tabular-nums ${segment === s ? "text-neutral-400" : "text-neutral-600"}`}
                  >
                    <Roll value={String(count(s))} />
                  </span>
                </button>
              ),
            )}
          </div>
          <div className="flex items-center gap-3">
            {network && (
              <button
                type="button"
                onClick={() => setNetwork(null)}
                className="flex h-8 items-center gap-1.5 rounded-full bg-white/8 pr-2.5 pl-3 text-[13px] text-neutral-100 hover:bg-white/12"
              >
                {network}
                <X size={13} strokeWidth={1.75} className="text-neutral-400" />
              </button>
            )}
            <label className="flex h-9 w-72 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search wallet, address or customer"
                aria-label="Search wallets"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
          </div>
        </div>

        {day !== null && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5 text-[13px]">
            <span className="text-neutral-300">
              Showing wallets that moved money on{" "}
              <span className="font-medium text-white">
                {longDay.format(day)}
              </span>
              <span className="text-neutral-500">
                {" "}
                · {rows.length} {rows.length === 1 ? "wallet" : "wallets"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setDay(null)}
              className="flex items-center gap-1 text-neutral-400 hover:text-white"
            >
              <X size={13} strokeWidth={1.75} />
              Clear
            </button>
          </div>
        )}

        {/* Table — open rows on hairlines, money first */}
        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-[160px]" />
            <col className="w-[170px]" />
            <col className="w-[140px]" />
            <col className="w-[150px]" />
            <col className="w-14" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-4 font-normal">
                <Checkbox
                  checked={pageAll}
                  mixed={pageSome}
                  onChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      for (const id of pageIds) {
                        if (pageAll) next.delete(id);
                        else next.add(id);
                      }
                      return next;
                    })
                  }
                  label={
                    pageAll
                      ? "Deselect all on this page"
                      : "Select all on this page"
                  }
                />
              </th>
              <th className="py-2.5 font-normal">Wallet</th>
              <th className="py-2.5 pr-8 text-right font-normal">Balance</th>
              <th className="py-2.5 font-normal">Last deposit</th>
              <th className="py-2.5 font-normal">14 days</th>
              <th className="py-2.5 font-normal">Customer</th>
              <th className="py-2.5 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((w) => {
              const last = w.activity.find((a) => a.direction === "in");
              return (
                <Fragment key={w.id}>
                  <tr
                    onClick={() =>
                      renamingId !== w.id &&
                      setSelectedId((id) => (id === w.id ? null : w.id))
                    }
                    aria-expanded={selectedId === w.id}
                    className={`group cursor-pointer border-t border-white/6 transition-colors ${
                      selectedId === w.id || checked.has(w.id)
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <td
                      className="py-2.5 pl-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={checked.has(w.id)}
                        onChange={() => toggleChecked(w.id)}
                        label={`Select ${w.name}`}
                      />
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex min-w-0 items-center gap-2">
                        {renamingId === w.id ? (
                          <input
                            autoFocus
                            defaultValue={w.name}
                            maxLength={40}
                            aria-label="Wallet name"
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={(e) => {
                              const next = e.currentTarget.value.trim();
                              if (next && next !== w.name)
                                actions(w).onRename(next);
                              setRenamingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                e.currentTarget.value = w.name;
                                e.currentTarget.blur();
                              }
                            }}
                            className="min-w-0 flex-1 rounded-md border border-white/20 bg-transparent px-1.5 py-0.5 font-mono text-[12.5px] text-white outline-none focus:border-white/40"
                          />
                        ) : (
                          <span className="truncate font-mono text-[12.5px] text-white">
                            {w.name}
                          </span>
                        )}
                        {w.frozen && <FrozenBadge since={w.frozenAt} />}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
                        <NetworkLogo network={w.network} size={12} />
                        {w.network} · {short(w.address, 6, 4)}
                      </div>
                    </td>
                    <td className="py-2.5 pr-8 text-right tabular-nums">
                      {w.balance > 0 ? (
                        <span
                          className={
                            w.frozen
                              ? "amount text-neutral-500"
                              : "amount font-medium text-white"
                          }
                          title={w.frozen ? "Locked while frozen" : undefined}
                        >
                          {usdc(w.balance)}
                        </span>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 tabular-nums">
                      {last ? (
                        <>
                          <span className="amount text-neutral-100">
                            +{usdc(last.amount)}
                          </span>
                          <span className="text-neutral-500">
                            {" "}
                            · {ago(last.date)}
                          </span>
                        </>
                      ) : (
                        <span className="text-neutral-600">Never</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <DayBars
                        days={dailyDeposits([w])}
                        height={18}
                        width={5}
                      />
                    </td>
                    <td className="py-2.5">
                      <HoverCopy
                        value={w.customerId}
                        display={short(w.customerId, 8, 4)}
                        label="Copy customer ID"
                      />
                    </td>
                    <td
                      className="py-2.5 pr-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <WalletMenu
                        wallet={w}
                        onRename={() => setRenamingId(w.id)}
                        onCopyId={async () => {
                          try {
                            await navigator.clipboard.writeText(w.id);
                            notify("Wallet ID copied");
                          } catch {
                            notify("Couldn't copy — clipboard blocked");
                          }
                        }}
                        onDownload={() => {
                          downloadStatement(w);
                          notify(`Statement for ${w.name} downloaded`);
                        }}
                        onToggleFreeze={actions(w).onToggleFreeze}
                        onArchive={actions(w).onArchive}
                      />
                    </td>
                  </tr>
                  {selectedId === w.id && (
                    <tr className="bg-white/[0.04]">
                      <td colSpan={7} className="px-4 pb-5">
                        <WalletPanel
                          wallet={w}
                          onClose={() => setSelectedId(null)}
                          onAction={notify}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  {segment === "Frozen"
                    ? "No frozen wallets."
                    : "No wallets match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-4 text-[13px] text-neutral-500">
          <span className="tabular-nums">
            {rows.length === 0
              ? "No results"
              : `Showing ${(current - 1) * perPage + 1} to ${Math.min(current * perPage, rows.length)} of ${rows.length}`}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <PageButton
                label="Previous page"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
              </PageButton>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <PageButton
                  key={p}
                  label={`Page ${p}`}
                  active={p === current}
                  onClick={() => setPage(p)}
                >
                  {p}
                </PageButton>
              ))}
              <PageButton
                label="Next page"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={14} strokeWidth={1.75} />
              </PageButton>
            </div>
            <Dropdown
              label="Rows per page"
              variant="compact"
              placement="top"
              align="right"
              value={perPage}
              options={PAGE_SIZES.map((n) => ({
                value: n,
                label: `${n} per page`,
              }))}
              onChange={(v) => {
                setPerPage(v);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {checked.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="theme-lock-dark orbit-pop fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#0b0b0c] py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-[0_20px_60px_-12px_rgb(0_0_0/0.6)]"
        >
          <span className="mr-2 text-white tabular-nums">
            {checked.size} selected
            <span className="ml-1.5 text-neutral-500">
              · {usdc(picked.reduce((s, w) => s + w.balance, 0))} USDC
            </span>
          </span>
          <BulkButton
            icon={Snowflake}
            ice
            label="Freeze"
            disabled={!picked.some((w) => !w.frozen)}
            onClick={bulk.freeze}
          />
          <BulkButton
            icon={Snowflake}
            ice
            label="Unfreeze"
            disabled={!picked.some((w) => w.frozen)}
            onClick={bulk.unfreeze}
          />
          <BulkButton
            icon={Download}
            label="Statements"
            onClick={bulk.download}
          />
          <BulkButton
            icon={Archive}
            label="Archive"
            disabled={!picked.some((w) => w.balance === 0)}
            title={
              picked.some((w) => w.balance > 0)
                ? "Only wallets with a 0 balance are archived"
                : undefined
            }
            onClick={bulk.archive}
          />
          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setChecked(new Set())}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast.message}
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
              className="font-medium text-neutral-300 underline underline-offset-4 hover:text-white"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Checkbox({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors ${
        checked || mixed
          ? "border-white bg-white text-black"
          : "border-white/25 hover:border-white/50"
      }`}
    >
      {checked ? (
        <Check size={11} strokeWidth={3} />
      ) : mixed ? (
        <span className="h-[2px] w-2 rounded-full bg-black" />
      ) : null}
    </button>
  );
}

/** Ice-blue chip that marks freeze actions. */
function IceChip({ size = 20 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-sky-400/15 text-sky-300 ring-1 ring-sky-300/25"
      style={{ width: size, height: size }}
    >
      <Snowflake size={Math.round(size * 0.6)} strokeWidth={2} />
    </span>
  );
}

function BulkButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  title,
  ice = false,
}: {
  icon: typeof Snowflake;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  ice?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 items-center gap-1.5 rounded-full px-3 text-neutral-200 transition-colors enabled:hover:bg-white/8 enabled:hover:text-white disabled:text-neutral-600"
    >
      {ice ? <IceChip size={20} /> : <Icon size={13} strokeWidth={1.75} />}
      {label}
    </button>
  );
}

/** Quiet but unmistakable: the hatch texture used for frozen cards, an outline and a snowflake. */
function FrozenBadge({ since }: { since?: string }) {
  const label = since
    ? `Frozen since ${dateFmt.format(new Date(since))} — transfers paused`
    : "Frozen — transfers paused";
  return (
    <span
      title={label}
      aria-label={label}
      className="hatch-soft inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 py-px pr-2 pl-1.5 text-[10.5px] font-medium text-neutral-200"
    >
      <Snowflake size={10} strokeWidth={2} className="text-neutral-300" />
      Frozen
    </span>
  );
}

/** One header fact: label, number, a segmented bar on a shared baseline, and one line of context. */
function Fact({
  label,
  value,
  aside,
  bar,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  /** A second, smaller figure on the number's baseline. */
  aside?: React.ReactNode;
  bar: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex flex-col border-white/8 lg:px-8 lg:first:pl-0 lg:last:pr-0 lg:[&:not(:first-child)]:border-l">
      <div className="text-[13px] text-neutral-500">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[34px] leading-none font-medium tracking-[-0.035em] text-white tabular-nums">
          {value}
        </span>
        {aside && (
          <span className="text-[13px] whitespace-nowrap tabular-nums">
            {aside}
          </span>
        )}
      </div>
      {/* Bars share one baseline across all three columns */}
      <div className="mt-5 flex h-6 flex-col justify-end">{bar}</div>
      <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-neutral-500">
        {footer}
      </div>
    </div>
  );
}

/** Mono value with a copy button that only appears on row hover. */
function HoverCopy({
  value,
  display,
  label,
}: {
  value: string;
  display: string;
  label: string;
}) {
  return (
    <span
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className="truncate font-mono text-[12.5px] text-neutral-300"
        title={value}
      >
        {display}
      </span>
      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <CopyButton value={value} label={label} />
      </span>
    </span>
  );
}

function PageButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors disabled:opacity-30 ${
        active
          ? "bg-white/10 text-white"
          : "text-neutral-400 enabled:hover:bg-white/6 enabled:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/** Inline details that open under a row — a small drawer inside the table. */
function WalletPanel({
  wallet: w,
  onClose,
  onAction,
}: {
  wallet: Wallet;
  onClose: () => void;
  onAction: (msg: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("Address");
  const canSend =
    w.capabilities.includes("Transfer") && !w.frozen && w.balance > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="orbit-pop rounded-xl border border-white/8 bg-surface px-5 pt-4 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8">
        <div role="tablist" className="flex gap-6">
          {(["Address", "Activity", "Details"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative pb-3 text-[13px] font-medium transition-colors ${
                tab === t
                  ? "text-white"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-white" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <span className="mr-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <NetworkLogo network={w.network} size={12} />
            {w.network} · {w.accountType}
          </span>
          <button
            type="button"
            disabled={!canSend}
            onClick={() => onAction(`Send from ${w.name}`)}
            title={w.balance === 0 ? "Nothing to send yet" : undefined}
            className="h-8 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-white/8 disabled:text-neutral-500"
          >
            Send
          </button>
          <button
            type="button"
            disabled={w.frozen}
            onClick={() => setTab("Address")}
            className="h-8 rounded-full bg-white/8 px-3.5 text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/12 disabled:text-neutral-600"
          >
            Receive
          </button>
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {tab === "Address" && <AddressTab wallet={w} />}
      {tab === "Activity" && <ActivityTab wallet={w} />}
      {tab === "Details" && <DetailsTab wallet={w} />}
    </div>
  );
}

function AddressTab({ wallet: w }: { wallet: Wallet }) {
  const [copied, setCopied] = useState(false);
  if (w.frozen) {
    return (
      <p className="mt-6 text-[13px] leading-relaxed text-neutral-400">
        This wallet is frozen, so it can&apos;t receive deposits. Unfreeze it
        from the ⋮ menu to show the address again.
      </p>
    );
  }
  return (
    <div className="mt-5 flex flex-col gap-6 sm:flex-row">
      <div className="shrink-0 self-start rounded-xl bg-[#fafafa] p-2.5">
        <QRCodeSVG
          value={w.address}
          size={124}
          bgColor="#fafafa"
          fgColor="#0a0a0a"
          level="M"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-neutral-500">
          {w.network} deposit address
        </div>
        <div className="mt-1.5 font-mono text-[14px] leading-relaxed break-all text-white">
          {w.address}
        </div>
        {w.memo && (
          <div className="mt-4">
            <div className="text-xs text-neutral-500">Memo (required)</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-[14px] text-white">{w.memo}</span>
              <CopyButton value={w.memo} label="Copy memo" />
            </div>
          </div>
        )}
        <p className="mt-4 text-[13px] text-neutral-400">
          {networkNotes[w.network]}
        </p>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                w.memo ? `${w.address}\nMemo: ${w.memo}` : w.address,
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            } catch {
              // Clipboard can be blocked; fail quietly.
            }
          }}
          className="mt-5 flex h-9 items-center gap-1.5 rounded-full bg-white/8 px-4 text-[13px] font-medium text-neutral-100 transition-colors hover:bg-white/12"
        >
          {copied ? (
            <Check size={14} strokeWidth={2.25} />
          ) : (
            <Copy size={14} strokeWidth={1.75} />
          )}
          {copied
            ? "Copied"
            : w.memo
              ? "Copy address and memo"
              : "Copy address"}
        </button>
      </div>
    </div>
  );
}

function ActivityTab({ wallet: w }: { wallet: Wallet }) {
  if (w.activity.length === 0)
    return (
      <p className="mt-6 text-[13px] text-neutral-500">No activity yet.</p>
    );
  return (
    <ul className="mt-2">
      {w.activity.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-3 border-b border-white/6 py-3.5 last:border-0"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/6 text-neutral-300">
            {a.direction === "in" ? (
              <ArrowDownLeft size={14} strokeWidth={1.75} />
            ) : (
              <ArrowUpRight size={14} strokeWidth={1.75} />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] text-neutral-100">
              {a.counterparty}
            </span>
            <span className="block text-xs text-neutral-500">
              {a.direction === "in" ? "Received" : "Sent"} ·{" "}
              {dateFmt.format(new Date(a.date))}
            </span>
          </span>
          <span
            className={`amount text-[14px] tabular-nums ${a.direction === "in" ? "text-white" : "text-neutral-300"}`}
          >
            {a.direction === "in" ? "+" : "−"}
            {usdc(a.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DetailsTab({ wallet: w }: { wallet: Wallet }) {
  const rows: [string, string, boolean?][] = [
    ["Wallet ID", w.id, true],
    ["Account ID", w.accountId, true],
    ["Customer ID", w.customerId, true],
    ["Account type", w.accountType],
    ["Currency", "USDC"],
    ["Capability", w.capabilities.join(", ")],
    [
      "Created",
      `${dateFmt.format(new Date(w.createdAt))}, ${timeFmt.format(new Date(w.createdAt))} UTC`,
    ],
  ];
  return (
    <dl className="mt-2">
      {rows.map(([label, value, copy]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 border-b border-white/6 py-3 last:border-0"
        >
          <dt className="shrink-0 text-[13px] text-neutral-500">{label}</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <span
              className={`truncate ${copy ? "font-mono text-[12px] text-neutral-300" : "text-[13px] text-neutral-100"}`}
            >
              {value}
            </span>
            {copy && (
              <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One CSV covering several wallets, with a wallet column. */
function downloadStatements(wallets: Wallet[]) {
  const header = [
    "Wallet",
    "Network",
    "Date",
    "Type",
    "Counterparty",
    "Amount (USDC)",
  ];
  const lines = wallets.flatMap((w) =>
    w.activity.map((a) => [
      w.name,
      w.network,
      a.date.slice(0, 10),
      a.direction === "in" ? "Received" : "Sent",
      `"${a.counterparty.replace(/"/g, '""')}"`,
      (a.direction === "in" ? a.amount : -a.amount).toFixed(2),
    ]),
  );
  const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `wallet-statements-${wallets.length}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** CSV of the wallet's activity, saved in the browser. */
function downloadStatement(w: Wallet) {
  const header = ["Date", "Type", "Counterparty", "Amount (USDC)"];
  const lines = w.activity.map((a) => [
    a.date.slice(0, 10),
    a.direction === "in" ? "Received" : "Sent",
    `"${a.counterparty.replace(/"/g, '""')}"`,
    (a.direction === "in" ? a.amount : -a.amount).toFixed(2),
  ]);
  const csv = [
    `# ${w.name} · ${w.network} · ${w.address}`,
    header.join(","),
    ...lines.map((l) => l.join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${w.name}-${w.network.toLowerCase()}-statement.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function WalletMenu({
  wallet: w,
  onRename,
  onCopyId,
  onDownload,
  onToggleFreeze,
  onArchive,
}: {
  wallet: Wallet;
  onRename: () => void;
  onCopyId: () => void;
  onDownload: () => void;
  onToggleFreeze: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  const items: {
    label: string;
    icon: typeof Pencil;
    onClick: () => void;
    hint?: string;
    ice?: boolean;
  }[] = [
    { label: "Rename", icon: Pencil, onClick: onRename },
    { label: "Copy wallet ID", icon: Copy, onClick: onCopyId },
    {
      label: "Download statement",
      icon: Download,
      onClick: onDownload,
      hint: "CSV",
    },
    {
      label: w.frozen ? "Unfreeze wallet" : "Freeze wallet",
      icon: Snowflake,
      ice: true,
      onClick: onToggleFreeze,
      hint: w.frozen ? undefined : "Pauses transfers",
    },
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/8 hover:text-white ${
          open ? "bg-white/8 text-white" : "text-neutral-500"
        }`}
      >
        <EllipsisVertical size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={run(item.onClick)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/6 hover:text-white"
            >
              {item.ice ? (
                <IceChip size={18} />
              ) : (
                <item.icon
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-neutral-500"
                />
              )}
              <span className="flex-1">{item.label}</span>
              {item.hint && (
                <span className="text-[11px] text-neutral-500">
                  {item.hint}
                </span>
              )}
            </button>
          ))}
          <div className="my-1.5 h-px bg-white/8" />
          <button
            type="button"
            role="menuitem"
            disabled={w.balance > 0}
            onClick={run(onArchive)}
            title={
              w.balance > 0
                ? "Move the balance out before archiving"
                : undefined
            }
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 enabled:hover:bg-white/6 enabled:hover:text-white disabled:text-neutral-600"
          >
            <Archive size={14} strokeWidth={1.75} className="shrink-0" />
            <span className="flex-1">Archive</span>
            {w.balance > 0 && (
              <span className="text-[11px]">Balance must be 0</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
