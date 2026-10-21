"use client";

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import { NetworkLogo } from "../../wallets/_components/network-logo";
import { AS_OF, type Transaction, type TxnType } from "../_data";

/*
 * Chart explorer for Transactions — strictly for design exploration.
 * One dropdown swaps between chart types over the same data so they can be compared.
 */

export type ChartKind =
  | "grouped"
  | "net"
  | "flow"
  | "types"
  | "health"
  | "calendar"
  | "channels"
  | "hours";

/** The chart types explored during design; only the grouped chart is shown now. */
export const CHARTS: {
  value: ChartKind;
  label: string;
  hint: string;
  about: string;
}[] = [
  {
    value: "grouped",
    label: "Grouped in vs out",
    hint: "Paired columns",
    about:
      "Money in and out side by side for each counterparty, type, channel or customer. Who moves the most money, and which way?",
  },
  {
    value: "net",
    label: "Net position",
    hint: "Line",
    about:
      "Money in minus money out, added up day by day. Are we growing or draining?",
  },
  {
    value: "flow",
    label: "In vs out",
    hint: "Bars",
    about:
      "Deposits above the line, withdrawals below, per day on one scale. When did money move, and which way?",
  },
  {
    value: "types",
    label: "Breakdown by type",
    hint: "Table bars",
    about:
      "Volume per transaction type, with counts, failure rate and what's still pending. What drives our volume, and where do things break?",
  },
  {
    value: "health",
    label: "Health",
    hint: "Stacked bars",
    about:
      "Transactions per day split by outcome, plus the success rate. Is anything breaking?",
  },
  {
    value: "calendar",
    label: "Activity calendar",
    hint: "Heatmap",
    about:
      "Twelve weeks of days; darker means more money moved. Spots rhythm — busy weekdays, quiet weekends.",
  },
  {
    value: "channels",
    label: "By channel",
    hint: "Share bar",
    about:
      "How volume splits across ACH, Wire and each network. Which rails do customers rely on?",
  },
  {
    value: "hours",
    label: "Time of day",
    hint: "Columns",
    about:
      "When transactions happen across 24 hours (UTC). Useful for support cover and cut-off times.",
  },
];

const DAY = 24 * 60 * 60 * 1000;
const OPEN_KEY = "gravv-transactions-chart";
type Period = 7 | 30 | 90;

const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
const compact = (v: number) =>
  Math.abs(v) >= 1000
    ? `${Number((v / 1000).toFixed(1))}k`
    : String(Math.round(v));
const signed = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${money(Math.abs(v))}`;
const dayFmt = new Intl.DateTimeFormat("en-US", {
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
const dayOf = (iso: string) => Math.floor(Date.parse(iso) / DAY) * DAY;

/** A clean axis step (1, 2, 2.5, 5 × 10ⁿ) for a range. */
function niceStep(range: number, parts = 3) {
  const raw = Math.max(range, 1) / parts;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].find((m) => m * pow >= raw)! * pow;
}

type Day = {
  day: number;
  in: number;
  out: number;
  net: number;
  position: number;
  count: number;
  completed: number;
  pending: number;
  failed: number;
};

function bucketDays(txns: Transaction[], n: number): Day[] {
  const today = Math.floor(AS_OF / DAY) * DAY;
  const start = today - (n - 1) * DAY;
  const days: Day[] = Array.from({ length: n }, (_, i) => ({
    day: start + i * DAY,
    in: 0,
    out: 0,
    net: 0,
    position: 0,
    count: 0,
    completed: 0,
    pending: 0,
    failed: 0,
  }));
  for (const t of txns) {
    const i = Math.round((dayOf(t.createdAt) - start) / DAY);
    if (i < 0 || i >= n) continue;
    const d = days[i];
    d.count += 1;
    d[
      t.status === "Completed"
        ? "completed"
        : t.status === "Pending"
          ? "pending"
          : "failed"
    ] += 1;
    if (t.status === "Failed") continue;
    if (t.direction === "Credit") d.in += t.amount;
    else d.out += t.amount;
  }
  let running = 0;
  for (const d of days) {
    d.net = d.in - d.out;
    running += d.net;
    d.position = running;
  }
  return days;
}

export function ChartExplorer({
  txns,
  onSelectDay,
  onSelectType,
}: {
  txns: Transaction[];
  onSelectDay: (d: number | null) => void;
  onSelectType: (t: TxnType) => void;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(OPEN_KEY) === "closed") setOpen(false);
      } catch {
        // Storage unavailable; keep defaults.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const save = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable; the choice still applies for this visit.
    }
  };

  const days = bucketDays(txns, period);
  const inPeriod = txns.filter((t) => dayOf(t.createdAt) >= days[0].day);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
          Money movement
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {
            <div
              role="radiogroup"
              aria-label="Period"
              className="flex rounded-full bg-white/[0.07] p-0.5"
            >
              {([7, 30, 90] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => {
                    setPeriod(p);
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
          }
          <button
            type="button"
            onClick={() => {
              setOpen(!open);
              save(OPEN_KEY, open ? "closed" : "open");
            }}
            aria-expanded={open}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {open ? "Hide chart" : "Show chart"}
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "-rotate-90" : "rotate-90"}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="orbit-pop mt-4 rounded-2xl bg-white/[0.02] px-6 pt-6 pb-5">
          <GroupedChart
            txns={inPeriod}
            days={days}
            onSelectType={onSelectType}
            onSelectDay={onSelectDay}
          />
        </div>
      )}
    </section>
  );
}

/* ——— Shared pieces ——— */

function Tooltip({
  at,
  index,
  total,
  children,
}: {
  at: string;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute top-2 z-10 w-56 rounded-lg border border-white/10 bg-raised px-3 py-2.5 text-xs shadow-2xl"
      style={
        index > total / 2
          ? { right: `calc(100% - ${at} + 12px)` }
          : { left: `calc(${at} + 12px)` }
      }
    >
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between tabular-nums ${strong ? "mt-1.5 border-t border-white/8 pt-1.5 font-medium text-white" : "mt-1 text-neutral-300"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function DateAxis({ days }: { days: { day: number }[] }) {
  return (
    <div className="mt-2 flex justify-between pl-12 text-[11px] text-neutral-500 tabular-nums">
      <span>{dayFmt.format(days[0].day)}</span>
      <span>{dayFmt.format(days[Math.floor(days.length / 2)].day)}</span>
      <span>Today</span>
    </div>
  );
}

function ValueAxis({
  ticks,
  format = compact,
}: {
  ticks: { value: number; y: number }[];
  format?: (v: number) => string;
}) {
  return (
    <>
      {ticks.map((t) => (
        <span
          key={t.value}
          aria-hidden
          className="pointer-events-none absolute left-0 w-10 -translate-y-1/2 text-right text-[10px] text-neutral-500 tabular-nums"
          style={{ top: t.y }}
        >
          {format(t.value)}
        </span>
      ))}
    </>
  );
}

function Grid({
  ticks,
  zero,
}: {
  ticks: { value: number; y: number }[];
  zero?: number;
}) {
  return (
    <>
      {ticks.map((t) => (
        <span
          key={t.value}
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 h-px ${t.value === zero ? "bg-white/20" : "bg-white/[0.05]"}`}
          style={{ top: t.y }}
        />
      ))}
    </>
  );
}

/** Day columns that capture hover and click across a plot. */
function DayTargets({
  days,
  onHover,
  selectedDay,
  onSelectDay,
  label,
}: {
  days: Day[];
  onHover: (i: number | null) => void;
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
  label: (d: Day) => string;
}) {
  return (
    <div
      role="group"
      className="absolute inset-0 flex"
      onMouseLeave={() => onHover(null)}
    >
      {days.map((d, i) => (
        <button
          key={d.day}
          type="button"
          onMouseEnter={() => onHover(i)}
          onFocus={() => onHover(i)}
          onBlur={() => onHover(null)}
          onClick={() =>
            d.count > 0 && onSelectDay(selectedDay === d.day ? null : d.day)
          }
          aria-pressed={selectedDay === d.day}
          aria-label={label(d)}
          className={`h-full flex-1 outline-none ${d.count > 0 ? "cursor-pointer" : "cursor-default"}`}
        />
      ))}
    </div>
  );
}

/* ——— 0. Grouped in vs out (Mercury "To/From") ——— */

type GroupBy = "To/From" | "Type" | "Channel" | "Customer" | "In & out";
const GROUP_OPTIONS: GroupBy[] = [
  "To/From",
  "Type",
  "Channel",
  "Customer",
  "In & out",
];

function counterparty(t: Transaction) {
  const party = t.direction === "Credit" ? t.source : t.destination;
  // External wallets are one-off addresses; read them as one group.
  return party.detail === "External wallet" ? "External wallets" : party.name;
}

function GroupedChart({
  txns,
  days,
  onSelectType,
  onSelectDay,
}: {
  txns: Transaction[];
  days: Day[];
  onSelectType: (t: TxnType) => void;
  onSelectDay: (d: number | null) => void;
}) {
  const [by, setBy] = useState<GroupBy>("To/From");
  const [hover, setHover] = useState<number | null>(null);
  const keyOf = (t: Transaction) =>
    by === "To/From"
      ? counterparty(t)
      : by === "Type"
        ? t.type
        : by === "Channel"
          ? t.channel
          : t.customer.name;

  const map = new Map<string, { in: number; out: number; count: number }>();
  for (const t of txns) {
    if (t.status === "Failed") continue;
    const k = keyOf(t);
    const g = map.get(k) ?? { in: 0, out: 0, count: 0 };
    if (t.direction === "Credit") g.in += t.amount;
    else g.out += t.amount;
    g.count += 1;
    map.set(k, g);
  }
  const sorted = [...map.entries()]
    .map(([name, g]) => ({ name, ...g }))
    .sort((a, b) => b.in + b.out - (a.in + a.out));
  // Top five; the rest fold into "Other".
  const groups =
    sorted.length > 6
      ? [
          ...sorted.slice(0, 5),
          sorted.slice(5).reduce(
            (o, g) => ({
              name: "Other",
              in: o.in + g.in,
              out: o.out + g.out,
              count: o.count + g.count,
            }),
            {
              name: "Other",
              in: 0,
              out: 0,
              count: 0,
            },
          ),
        ]
      : sorted;
  const max = Math.max(...groups.flatMap((g) => [g.in, g.out]), 1);
  const H = 150;
  const ticks = [max, max / 2].map((v) => ({ value: v, y: H - (v / max) * H }));
  const h = hover === null ? null : groups[hover];

  const column = (v: number, tone: "in" | "out") => (
    <span className="relative flex h-full flex-1 items-end">
      <span
        className="relative w-full"
        style={{
          height: Math.max(2, (v / max) * H),
          background: `linear-gradient(to bottom, color-mix(in oklab, var(--flow-${tone}) ${tone === "in" ? 22 : 16}%, transparent), transparent)`,
        }}
      >
        {/* The value line on top of each column */}
        <span
          className={`absolute inset-x-0 top-0 h-[2px] rounded-full ${tone === "in" ? "bg-[var(--flow-in)]" : "bg-[var(--flow-out)]"}`}
        />
      </span>
    </span>
  );

  return (
    <div className="relative">
      <div className="mb-10 flex items-center justify-between">
        {/* Grouping picker */}
        <Dropdown
          label="Group by"
          variant="bare"
          value={by}
          options={GROUP_OPTIONS.map((g) => ({ value: g, label: g }))}
          onChange={(g) => {
            setBy(g);
            setHover(null);
          }}
          className="-ml-3.5 [&>button]:text-[15px] [&>button]:font-medium [&>button]:text-white"
        />
        <span className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full bg-[var(--flow-in)]" />
            In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-[2px] w-3 rounded-full bg-[var(--flow-out)]" />
            Out
          </span>
        </span>
      </div>

      {by === "In & out" ? (
        <CumulativeChart days={days} onSelectDay={onSelectDay} />
      ) : (
        <div className="relative pl-14">
          {ticks.map((t) => (
            <span
              key={t.value}
              aria-hidden
              className="pointer-events-none absolute left-0 -translate-y-1/2 text-[12px] text-neutral-300 tabular-nums"
              style={{ top: t.y }}
            >
              {compact(t.value)}
            </span>
          ))}
          <div
            className="relative"
            style={{ height: H }}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.slice(1).map((t) => (
              <span
                key={t.value}
                aria-hidden
                className="pointer-events-none absolute inset-x-0 h-px bg-white/[0.06]"
                style={{ top: t.y }}
              />
            ))}
            <div className="absolute inset-0 flex">
              {groups.map((g, i) => (
                <button
                  key={g.name}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() =>
                    by === "Type" && onSelectType(g.name as TxnType)
                  }
                  aria-label={`${g.name}: in ${money(g.in)}, out ${money(g.out)}`}
                  className={`flex h-full flex-1 items-end justify-center rounded-lg outline-none transition-opacity focus-visible:ring-1 focus-visible:ring-white/25 ${hover !== null && hover !== i ? "opacity-40" : ""} ${
                    by === "Type" ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  {/* The pair fills most of its slot, so fewer groups means wider columns */}
                  <span className="flex h-full w-[76%] items-end gap-0.5">
                    {column(g.in, "in")}
                    {column(g.out, "out")}
                  </span>
                </button>
              ))}
            </div>
            {h && hover !== null && (
              <Tooltip
                at={`${((hover + 0.5) / groups.length) * 100}%`}
                index={hover}
                total={groups.length}
              >
                <div className="font-medium text-white">{h.name}</div>
                <Row label="In" value={h.in ? `+${money(h.in)}` : "0.00"} />
                <Row label="Out" value={h.out ? `−${money(h.out)}` : "0.00"} />
                <Row
                  label={`${h.count} ${h.count === 1 ? "transaction" : "transactions"}`}
                  value={signed(h.in - h.out)}
                  strong
                />
              </Tooltip>
            )}
          </div>
          <div className="mt-3 flex">
            {groups.map((g) => (
              <span
                key={g.name}
                className="flex-1 truncate px-1 text-center text-[13px] text-neutral-300"
              >
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ——— In & out: running totals over the period ——— */

/** Smooth path through points without overshooting (monotone cubic, Fritsch–Carlson). */
function monotonePath(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return "";
  const d = pts
    .slice(0, -1)
    .map((p, k) => (pts[k + 1].y - p.y) / (pts[k + 1].x - p.x));
  const m = pts.map((_, k) =>
    k === 0
      ? d[0]
      : k === n - 1
        ? d[n - 2]
        : d[k - 1] * d[k] <= 0
          ? 0
          : (d[k - 1] + d[k]) / 2,
  );
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }
  let path = `M${pts[0].x},${pts[0].y}`;
  for (let k = 0; k < n - 1; k++) {
    const h = (pts[k + 1].x - pts[k].x) / 3;
    path += `C${pts[k].x + h},${pts[k].y + m[k] * h} ${pts[k + 1].x - h},${pts[k + 1].y - m[k + 1] * h} ${pts[k + 1].x},${pts[k + 1].y}`;
  }
  return path;
}

function CumulativeChart({
  days,
  onSelectDay,
}: {
  days: Day[];
  onSelectDay: (d: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  // Running totals: how much has come in and gone out since the start of the period.
  const totals = days.reduce<{ in: number; out: number }[]>((acc, d) => {
    const prev = acc[acc.length - 1] ?? { in: 0, out: 0 };
    acc.push({ in: prev.in + d.in, out: prev.out + d.out });
    return acc;
  }, []);
  const last = totals[n - 1];
  const peak = Math.max(last.in, last.out, 1);
  const step = niceStep(peak, 3);
  const top = peak * 1.12;
  const H = 180;
  const W = 1000;
  const pad = 4; // keeps the flat start of a line visible above the bottom edge
  const x = (i: number) => ((i + 0.5) / n) * W;
  const y = (v: number) => pad + (1 - v / top) * (H - pad * 2);
  const ticks = Array.from({ length: Math.floor(top / step) }, (_, k) => {
    const v = (k + 1) * step;
    return { value: v, y: y(v) };
  });
  const inPath = monotonePath(totals.map((t, i) => ({ x: x(i), y: y(t.in) })));
  const outPath = monotonePath(
    totals.map((t, i) => ({ x: x(i), y: y(t.out) })),
  );
  const area = `${inPath}L${x(n - 1)},${H}L${x(0)},${H}Z`;
  // Date guides: weekly on 30D, every other day on 7D, three weeks on 90D — counted back from today.
  const every = n <= 7 ? 2 : n <= 30 ? 7 : 21;
  const guides = days
    .map((_, i) => i)
    .filter((i) => (n - 1 - i) % every === 0 && i > 0);
  const at = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const h = hover === null ? null : { day: days[hover], ...totals[hover] };

  return (
    <div className="relative pl-14">
      {ticks.map((t) => (
        <span
          key={t.value}
          aria-hidden
          className="pointer-events-none absolute left-0 -translate-y-1/2 text-[12px] text-neutral-300 tabular-nums"
          style={{ top: t.y }}
        >
          {compact(t.value)}
        </span>
      ))}
      <div className="relative" style={{ height: H }}>
        {/* Vertical date guides */}
        {guides.map((i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.05]"
            style={{ left: at(i) }}
          />
        ))}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.08]"
        />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="cum-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--flow-in)" stopOpacity="0.14" />
              <stop offset="100%" stopColor="var(--flow-in)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#cum-in)" />
          <path
            d={outPath}
            fill="none"
            stroke="var(--flow-out)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={inPath}
            fill="none"
            stroke="var(--flow-in)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* Crosshair */}
        {hover !== null && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-px bg-white/25"
            style={{ left: at(hover) }}
          />
        )}
        <DayTargets
          days={days}
          onHover={setHover}
          selectedDay={null}
          onSelectDay={onSelectDay}
          label={(d) =>
            `${dayFmt.format(d.day)}: in ${money(d.in)}, out ${money(d.out)}`
          }
        />
        {h && hover !== null && (
          <Tooltip at={at(hover)} index={hover} total={n}>
            <div className="font-medium text-white">
              {longDay.format(h.day.day)}
            </div>
            <Row label="In so far" value={`+${money(h.in)}`} />
            <Row label="Out so far" value={`−${money(h.out)}`} />
            <Row label="That day" value={signed(h.day.in - h.day.out)} />
            <Row label="Net so far" value={signed(h.in - h.out)} strong />
          </Tooltip>
        )}
      </div>
      <div className="relative mt-3 h-4">
        {guides.map((i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 text-[12px] whitespace-nowrap text-neutral-400 tabular-nums"
            style={{ left: at(i) }}
          >
            {i === n - 1 ? "Today" : dayFmt.format(days[i].day)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ——— 1. Net position ——— */

export function NetChart({
  days,
  txns,
  selectedDay,
  onSelectDay,
}: {
  days: Day[];
  txns: Transaction[];
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const end = days[n - 1].position;
  const lo = Math.min(0, ...days.map((d) => d.position));
  const hi = Math.max(0, ...days.map((d) => d.position));
  const span = hi - lo || 1;
  const step = niceStep(span);
  const bottom = lo - span * 0.1;
  const top = hi + span * 0.12;
  const H = 200;
  const W = 1000;
  const y = (v: number) => ((top - v) / (top - bottom)) * H;
  const x = (i: number) => ((i + 0.5) / n) * W;
  const at = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const ticks: { value: number; y: number }[] = [];
  for (let v = Math.ceil(bottom / step) * step; v <= top; v += step)
    ticks.push({ value: Math.round(v), y: y(v) });
  const line = days
    .map(
      (d, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.position).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const growing = end >= 0;
  const moves = txns
    .filter((t) => t.status !== "Failed")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2)
    .map((t) => ({ t, i: days.findIndex((d) => d.day === dayOf(t.createdAt)) }))
    .filter((m) => m.i >= 0);
  const h = hover === null ? null : days[hover];

  return (
    <>
      <div className="mb-4 text-[13px] text-neutral-400">
        <span
          className={`text-[20px] font-medium tracking-[-0.02em] tabular-nums ${growing ? "text-[var(--ok-fg)]" : "text-white"}`}
        >
          {signed(end)}
        </span>{" "}
        USDC over {n} days
      </div>
      <div className="relative pl-12">
        <ValueAxis
          ticks={ticks}
          format={(v) =>
            v === 0 ? "0" : `${v > 0 ? "+" : "−"}${compact(Math.abs(v))}`
          }
        />
        <div className="relative" style={{ height: H }}>
          <Grid ticks={ticks} zero={0} />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient
                id="net-fill"
                x1="0"
                y1="0"
                x2="0"
                y2={H}
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset={Math.max(0, Math.min(1, y(0) / H))}
                  stopColor="var(--flow-in)"
                  stopOpacity="0.14"
                />
                <stop
                  offset={Math.max(0, Math.min(1, y(0) / H))}
                  stopColor="var(--color-white)"
                  stopOpacity="0.07"
                />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#net-fill)" />
            <path
              d={line}
              fill="none"
              stroke={growing ? "var(--flow-in)" : "var(--color-white)"}
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {hover === null &&
            moves.map(({ t, i }) => (
              <span
                key={t.id}
                className="pointer-events-none absolute z-[1] -translate-x-1/2 rounded-md bg-surface px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-neutral-300 tabular-nums ring-1 ring-white/10"
                style={{
                  left: `clamp(90px, ${at(i)}, calc(100% - 90px))`,
                  top:
                    y(days[i].position) + (t.direction === "Credit" ? -26 : 10),
                }}
              >
                <span
                  className={
                    t.direction === "Credit"
                      ? "text-[var(--ok-fg)]"
                      : "text-white"
                  }
                >
                  {t.direction === "Credit" ? "+" : "−"}
                  {compact(t.amount)}
                </span>{" "}
                ·{" "}
                {t.direction === "Credit"
                  ? `from ${t.source.name}`
                  : `to ${t.destination.name}`}
              </span>
            ))}
          {selectedDay !== null && days.some((d) => d.day === selectedDay) && (
            <span
              className="pointer-events-none absolute inset-y-0 w-px bg-white/40"
              style={{ left: at(days.findIndex((d) => d.day === selectedDay)) }}
            />
          )}
          {h && hover !== null && (
            <>
              <span
                className="pointer-events-none absolute inset-y-0 w-px bg-white/25"
                style={{ left: at(hover) }}
              />
              <span
                className={`pointer-events-none absolute size-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] ${growing ? "bg-[var(--flow-in)]" : "bg-white"}`}
                style={{ left: at(hover), top: y(h.position) }}
              />
            </>
          )}
          <DayTargets
            days={days}
            onHover={setHover}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
            label={(d) =>
              `${longDay.format(d.day)}: net ${signed(d.net)}, position ${signed(d.position)}`
            }
          />
          {h && hover !== null && (
            <Tooltip at={at(hover)} index={hover} total={n}>
              <div className="text-neutral-400">{longDay.format(h.day)}</div>
              <Row
                label="That day"
                value={h.count ? signed(h.net) : "No movement"}
              />
              <Row label="Net position" value={signed(h.position)} strong />
            </Tooltip>
          )}
        </div>
      </div>
      <DateAxis days={days} />
    </>
  );
}

/* ——— 2. In vs out ——— */

export function FlowChart({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: Day[];
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const maxIn = Math.max(...days.map((d) => d.in), 1);
  const maxOut = Math.max(...days.map((d) => d.out), 0);
  const scale = 168 / (maxIn + maxOut || 1);
  const zero = maxIn * scale + 6;
  const H = zero + Math.max(maxOut * scale, 20) + 4;
  const step = niceStep(Math.max(maxIn, maxOut), 2);
  const ticks = [{ value: 0, y: zero }];
  for (let v = step; v <= maxIn * 1.02; v += step)
    ticks.push({ value: v, y: zero - v * scale });
  for (let v = step; v <= maxOut * 1.02; v += step)
    ticks.push({ value: -v, y: zero + v * scale });
  const at = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const h = hover === null ? null : days[hover];
  const totalIn = days.reduce((s, d) => s + d.in, 0);
  const totalOut = days.reduce((s, d) => s + d.out, 0);

  return (
    <>
      <div className="mb-4 flex items-baseline gap-6 text-[13px] text-neutral-500">
        <span className="flex items-baseline gap-2">
          <span className="h-2.5 w-1.5 self-center rounded-[1px] bg-[var(--flow-in)]" />
          In{" "}
          <span className="text-[17px] font-medium text-white tabular-nums">
            +{money(totalIn)}
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="h-2.5 w-1.5 self-center rounded-[1px] bg-[var(--flow-out)]" />
          Out{" "}
          <span className="text-[17px] font-medium text-neutral-200 tabular-nums">
            −{money(totalOut)}
          </span>
        </span>
      </div>
      <div className="relative pl-12">
        <ValueAxis
          ticks={ticks}
          format={(v) =>
            v === 0 ? "0" : `${v > 0 ? "+" : "−"}${compact(Math.abs(v))}`
          }
        />
        <div
          className={`relative flex ${n > 30 ? "gap-px" : "gap-[3px]"}`}
          style={{ height: H }}
        >
          <Grid ticks={ticks} zero={0} />
          {days.map((d, i) => {
            const dim =
              (hover !== null && hover !== i) ||
              (selectedDay !== null && selectedDay !== d.day && hover === null);
            return (
              <div key={d.day} className="relative h-full flex-1">
                {d.in > 0 && (
                  <span
                    className={`absolute inset-x-[15%] rounded-t-[3px] bg-[var(--flow-in)] transition-opacity ${dim ? "opacity-35" : ""}`}
                    style={{
                      top: zero - d.in * scale,
                      height: Math.max(2, d.in * scale - 1),
                    }}
                  />
                )}
                {d.out > 0 && (
                  <span
                    className={`absolute inset-x-[15%] rounded-b-[3px] bg-[var(--flow-out)] transition-opacity ${dim ? "opacity-35" : ""}`}
                    style={{
                      top: zero + 1,
                      height: Math.max(2, d.out * scale - 1),
                    }}
                  />
                )}
              </div>
            );
          })}
          <DayTargets
            days={days}
            onHover={setHover}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
            label={(d) =>
              `${longDay.format(d.day)}: in ${money(d.in)}, out ${money(d.out)}`
            }
          />
          {h && hover !== null && (
            <Tooltip at={at(hover)} index={hover} total={n}>
              <div className="text-neutral-400">{longDay.format(h.day)}</div>
              <Row label="In" value={h.in ? `+${money(h.in)}` : "0.00"} />
              <Row label="Out" value={h.out ? `−${money(h.out)}` : "0.00"} />
              <Row label="Net" value={signed(h.net)} strong />
            </Tooltip>
          )}
        </div>
      </div>
      <DateAxis days={days} />
    </>
  );
}

/* ——— 3. Breakdown by type ——— */

export function TypesChart({
  txns,
  onSelectType,
}: {
  txns: Transaction[];
  onSelectType: (t: TxnType) => void;
}) {
  const types: TxnType[] = [
    "Account Funding",
    "Crypto Transfer",
    "Offramp",
    "Payout",
  ];
  const rows = types
    .map((type) => {
      const list = txns.filter((t) => t.type === type);
      const settled = list.filter((t) => t.status !== "Failed");
      return {
        type,
        volume: settled.reduce((s, t) => s + t.amount, 0),
        count: list.length,
        failed: list.filter((t) => t.status === "Failed").length,
        pending: list
          .filter((t) => t.status === "Pending")
          .reduce((s, t) => s + t.amount, 0),
        credit: list[0]?.direction === "Credit",
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.volume - a.volume);
  const max = Math.max(...rows.map((r) => r.volume), 1);

  return (
    <div>
      <div className="grid grid-cols-[150px_minmax(0,1fr)_110px_64px_72px_96px] gap-x-4 border-b border-white/8 pb-2 text-xs text-neutral-500">
        <span>Type</span>
        <span>Volume</span>
        <span className="text-right">USDC</span>
        <span className="text-right">Count</span>
        <span className="text-right">Failed</span>
        <span className="text-right">Pending</span>
      </div>
      {rows.map((r) => {
        const rate = r.count ? r.failed / r.count : 0;
        return (
          <button
            key={r.type}
            type="button"
            onClick={() => onSelectType(r.type)}
            className="grid w-full grid-cols-[150px_minmax(0,1fr)_110px_64px_72px_96px] items-center gap-x-4 border-b border-white/6 py-3 text-left text-[13px] transition-colors last:border-0 hover:bg-white/[0.02]"
            title={`Show ${r.type} only`}
          >
            <span className="text-white">{r.type}</span>
            <span className="h-2.5 rounded-full bg-white/[0.06]">
              <span
                className={`block h-full rounded-full ${r.credit ? "bg-[var(--flow-in)]" : "bg-white/60"}`}
                style={{ width: `${(r.volume / max) * 100}%` }}
              />
            </span>
            <span className="text-right text-neutral-100 tabular-nums">
              {money(r.volume)}
            </span>
            <span className="text-right text-neutral-300 tabular-nums">
              {r.count}
            </span>
            <span
              className={`text-right tabular-nums ${rate > 0.1 ? "text-rose-300" : "text-neutral-400"}`}
            >
              {Math.round(rate * 100)}%
            </span>
            <span className="text-right text-neutral-400 tabular-nums">
              {r.pending ? money(r.pending) : "—"}
            </span>
          </button>
        );
      })}
      <p className="mt-3 text-[11px] text-neutral-500">
        Mint bars are money in, grey are money out. Click a type to filter the
        table.
      </p>
    </div>
  );
}

/* ——— 4. Health ——— */

export function HealthChart({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: Day[];
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const total = days.reduce((s, d) => s + d.count, 0);
  const failed = days.reduce((s, d) => s + d.failed, 0);
  const pending = days.reduce((s, d) => s + d.pending, 0);
  const rate = total
    ? (total - failed - pending) / Math.max(1, total - pending)
    : 1;
  const max = Math.max(...days.map((d) => d.count), 1);
  const H = 160;
  const step = niceStep(max, 2);
  const ticks: { value: number; y: number }[] = [];
  for (let v = 0; v <= max; v += step)
    ticks.push({ value: v, y: H - (v / max) * H });
  const at = (i: number) => `${((i + 0.5) / n) * 100}%`;
  const h = hover === null ? null : days[hover];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] text-neutral-500">
        <span>
          <span className="text-[20px] font-medium tracking-[-0.02em] text-white tabular-nums">
            {Math.round(rate * 100)}%
          </span>{" "}
          success rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-white/55" />
          {total - failed - pending} completed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] border border-dashed border-white/50" />
          {pending} pending
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-rose-400/80" />
          {failed} failed
        </span>
      </div>
      <div className="relative pl-12">
        <ValueAxis ticks={ticks} format={(v) => String(v)} />
        <div
          className={`relative flex items-end ${n > 30 ? "gap-px" : "gap-[3px]"}`}
          style={{ height: H }}
        >
          <Grid ticks={ticks} zero={0} />
          {days.map((d, i) => {
            const dim =
              (hover !== null && hover !== i) ||
              (selectedDay !== null && selectedDay !== d.day && hover === null);
            const px = (c: number) => (c / max) * H;
            return (
              <div
                key={d.day}
                className={`relative flex h-full flex-1 flex-col justify-end gap-px transition-opacity ${dim ? "opacity-35" : ""}`}
              >
                {d.failed > 0 && (
                  <span
                    className="mx-[15%] rounded-t-[2px] bg-rose-400/80"
                    style={{ height: px(d.failed) - 1 }}
                  />
                )}
                {d.pending > 0 && (
                  <span
                    className="mx-[15%] rounded-[2px] border border-dashed border-white/50"
                    style={{ height: px(d.pending) - 1 }}
                  />
                )}
                {d.completed > 0 && (
                  <span
                    className="mx-[15%] rounded-[2px] bg-white/55"
                    style={{ height: px(d.completed) - 1 }}
                  />
                )}
              </div>
            );
          })}
          <DayTargets
            days={days}
            onHover={setHover}
            selectedDay={selectedDay}
            onSelectDay={onSelectDay}
            label={(d) =>
              `${longDay.format(d.day)}: ${d.count} transactions, ${d.failed} failed`
            }
          />
          {h && hover !== null && (
            <Tooltip at={at(hover)} index={hover} total={n}>
              <div className="text-neutral-400">{longDay.format(h.day)}</div>
              <Row label="Completed" value={String(h.completed)} />
              <Row label="Pending" value={String(h.pending)} />
              <Row label="Failed" value={String(h.failed)} />
              <Row label="Total" value={String(h.count)} strong />
            </Tooltip>
          )}
        </div>
      </div>
      <DateAxis days={days} />
    </>
  );
}

/* ——— 5. Activity calendar ——— */

export function CalendarChart({
  txns,
  selectedDay,
  onSelectDay,
}: {
  txns: Transaction[];
  selectedDay: number | null;
  onSelectDay: (d: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const weeks = 12;
  const today = Math.floor(AS_OF / DAY) * DAY;
  const weekday = (new Date(today).getUTCDay() + 6) % 7; // Monday = 0
  const start = today - (weeks * 7 - 1 - (6 - weekday)) * DAY;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const day = start + i * DAY;
    const list = txns.filter(
      (t) => dayOf(t.createdAt) === day && t.status !== "Failed",
    );
    return {
      day,
      volume: list.reduce((s, t) => s + t.amount, 0),
      count: list.length,
      future: day > today,
    };
  });
  const max = Math.max(...cells.map((c) => c.volume), 1);
  const level = (v: number) =>
    v === 0 ? 0 : Math.min(4, Math.ceil((Math.sqrt(v) / Math.sqrt(max)) * 4));
  const tones = [
    "bg-white/[0.05]",
    "bg-[var(--flow-in)]/25",
    "bg-[var(--flow-in)]/45",
    "bg-[var(--flow-in)]/70",
    "bg-[var(--flow-in)]",
  ];
  const h = hover === null ? null : cells[hover];
  const months = Array.from({ length: weeks }, (_, w) => {
    const d = new Date(start + w * 7 * DAY);
    const prev = w ? new Date(start + (w - 1) * 7 * DAY) : null;
    return !prev || prev.getUTCMonth() !== d.getUTCMonth()
      ? d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })
      : "";
  });

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between text-[13px] text-neutral-500">
        <span>Last 12 weeks · money moved per day</span>
        <span className="flex items-center gap-1.5 text-[11px]">
          Less
          {tones.map((t) => (
            <span key={t} className={`size-3 rounded-[3px] ${t}`} />
          ))}
          More
        </span>
      </div>
      <div className="flex gap-3">
        <div className="grid grid-rows-[repeat(7,20px)] gap-[4px] pt-5 text-[10px] text-neutral-500">
          {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((d, i) => (
            <span key={i} className="flex items-center">
              {d}
            </span>
          ))}
        </div>
        <div className="min-w-0">
          <div className="grid h-5 grid-cols-[repeat(12,20px)] gap-x-[4px] text-[10px] whitespace-nowrap text-neutral-500">
            {months.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-cols-[repeat(12,20px)] grid-rows-[repeat(7,20px)] gap-[4px]"
            onMouseLeave={() => setHover(null)}
          >
            {cells.map((c, i) => (
              <button
                key={c.day}
                type="button"
                disabled={c.future}
                onMouseEnter={() => setHover(i)}
                onClick={() =>
                  c.count > 0 &&
                  onSelectDay(selectedDay === c.day ? null : c.day)
                }
                aria-label={`${longDay.format(c.day)}: ${money(c.volume)} moved`}
                className={`size-5 rounded-[4px] transition-[outline] ${c.future ? "opacity-0" : tones[level(c.volume)]} ${
                  selectedDay === c.day
                    ? "outline-2 outline-white"
                    : hover === i
                      ? "outline-1 outline-white/50"
                      : ""
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      {h && !h.future && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-white/10 bg-raised px-3 py-2 text-xs shadow-2xl">
          <span className="text-neutral-400">{longDay.format(h.day)}</span> ·{" "}
          <span className="text-white tabular-nums">
            {h.count
              ? `${money(h.volume)} USDC · ${h.count} txns`
              : "No movement"}
          </span>
        </div>
      )}
    </div>
  );
}

/* ——— 6. By channel ——— */

export function ChannelsChart({ txns }: { txns: Transaction[] }) {
  const settled = txns.filter((t) => t.status !== "Failed");
  const total = settled.reduce((s, t) => s + t.amount, 0) || 1;
  const channels = [...new Set(settled.map((t) => t.channel))]
    .map((c) => {
      const list = settled.filter((t) => t.channel === c);
      return {
        channel: c,
        volume: list.reduce((s, t) => s + t.amount, 0),
        count: list.length,
      };
    })
    .sort((a, b) => b.volume - a.volume);
  const tones = [
    "bg-white/80",
    "bg-white/50",
    "bg-white/30",
    "bg-white/15",
    "bg-white/10",
  ];

  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-full">
        {channels.map((c, i) => (
          <span
            key={c.channel}
            className={`h-full ${tones[i] ?? tones[4]}`}
            style={{ width: `${(c.volume / total) * 100}%` }}
            title={c.channel}
          />
        ))}
      </div>
      <div className="mt-5 grid gap-x-10 gap-y-3 sm:grid-cols-2">
        {channels.map((c, i) => (
          <div
            key={c.channel}
            className="flex items-center gap-3 border-b border-white/6 pb-3 text-[13px]"
          >
            <span
              className={`h-3 w-1.5 shrink-0 rounded-[1px] ${tones[i] ?? tones[4]}`}
            />
            {c.channel === "Polygon" ||
            c.channel === "Ethereum" ||
            c.channel === "Stellar" ? (
              <NetworkLogo network={c.channel} size={14} />
            ) : null}
            <span className="flex-1 text-white">{c.channel}</span>
            <span className="text-neutral-500 tabular-nums">
              {c.count} txns
            </span>
            <span className="w-24 text-right text-neutral-100 tabular-nums">
              {money(c.volume)}
            </span>
            <span className="w-10 text-right text-neutral-400 tabular-nums">
              {Math.round((c.volume / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ——— 7. Time of day ——— */

export function HoursChart({ txns }: { txns: Transaction[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const list = txns.filter(
      (t) => new Date(t.createdAt).getUTCHours() === hour,
    );
    return {
      hour,
      count: list.length,
      volume: list
        .filter((t) => t.status !== "Failed")
        .reduce((s, t) => s + t.amount, 0),
    };
  });
  const max = Math.max(...hours.map((h) => h.count), 1);
  const busiest = hours.reduce((m, h) => (h.count > m.count ? h : m), hours[0]);
  const H = 150;
  const label = (h: number) => `${String(h).padStart(2, "0")}:00`;
  const hv = hover === null ? null : hours[hover];

  return (
    <div className="relative">
      <div className="mb-4 text-[13px] text-neutral-500">
        Busiest hour{" "}
        <span className="text-[17px] font-medium text-white tabular-nums">
          {label(busiest.hour)} UTC
        </span>{" "}
        · {busiest.count} transactions
      </div>
      <div
        className="flex items-end gap-[3px]"
        style={{ height: H }}
        onMouseLeave={() => setHover(null)}
      >
        {hours.map((h, i) => (
          <button
            key={h.hour}
            type="button"
            onMouseEnter={() => setHover(i)}
            aria-label={`${label(h.hour)}: ${h.count} transactions`}
            className="group relative flex h-full flex-1 items-end"
          >
            <span
              className={`w-full rounded-t-[3px] transition-colors ${
                h.hour === busiest.hour
                  ? "bg-[var(--flow-in)]"
                  : hover === i
                    ? "bg-white/80"
                    : "bg-white/40"
              }`}
              style={{ height: h.count ? Math.max(3, (h.count / max) * H) : 2 }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-500 tabular-nums">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      {hv && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-white/10 bg-raised px-3 py-2 text-xs shadow-2xl">
          <span className="text-neutral-400">{label(hv.hour)} UTC</span> ·{" "}
          <span className="text-white tabular-nums">
            {hv.count} txns · {money(hv.volume)} USDC
          </span>
        </div>
      )}
    </div>
  );
}
