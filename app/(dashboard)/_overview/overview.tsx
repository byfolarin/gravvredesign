"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Roll } from "@/app/_components/roll";
import { ME, MEMBERS } from "../manage/roles/_data";
import { REQUESTS } from "../manage/approvals/_data";
import { disputes, daysUntil } from "../card-collection/disputes/_data";
import { collections, isStuck } from "../card-collection/collections/_data";
import { recipients } from "../recipients/_data";
import { AS_OF as ACCOUNTS_AS_OF, accounts } from "../account/_data";
import {
  AS_OF,
  DAY,
  OUTS,
  RANGES,
  SOURCES,
  buckets,
  totals,
  type Bucket,
  type Range,
} from "./data";

const RANGE_WORDS: Record<Range, string> = {
  "30D": "30 days",
  "90D": "90 days",
  "12M": "12 months",
};
const usd = (v: number) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const compact = (v: number) => {
  const a = Math.abs(v);
  const s =
    a >= 1e6
      ? `${(a / 1e6).toFixed(2)}M`
      : a >= 1e3
        ? `${(a / 1e3).toFixed(1)}k`
        : `${Math.round(a)}`;
  return `$${s}`;
};
const pct = (now: number, before: number) =>
  before ? ((now - before) / Math.abs(before)) * 100 : 0;
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const month = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});
const monthYear = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function Money({
  value,
  signed = false,
  className = "",
}: {
  value: number;
  signed?: boolean;
  className?: string;
}) {
  const [w, c] = usd(Math.abs(value)).split(".");
  const sign = signed ? (value < 0 ? "−" : "+") : "";
  return (
    <span className={`amount tabular-nums ${className}`}>
      <Roll value={`${sign}$${w}`} />
      <sup className="ml-0.5 align-[0.85em] text-[0.42em] font-normal tracking-normal text-neutral-500">
        .{c}
      </sup>
    </span>
  );
}

function Change({
  value,
  invert = false,
}: {
  value: number;
  invert?: boolean;
}) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.5)
    return <span className="text-neutral-500">flat</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={good ? "text-[var(--ok-fg)]" : "text-neutral-400"}>
      {value > 0 ? "↑" : "↓"} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`;
/** Compare how deposits and spending moved, in words that stay true whichever way they went. */
function paceWords(inn: number, out: number) {
  if (Math.abs(inn - out) < 2)
    return "money in and out moved at about the same pace.";
  const both = inn >= 0 === out >= 0;
  if (!both)
    return inn > out
      ? `deposits rose (${signed(inn)}) while spending fell (${signed(out)}).`
      : `deposits fell (${signed(inn)}) while spending rose (${signed(out)}).`;
  if (inn >= 0)
    return inn > out
      ? `deposits grew faster (${signed(inn)}) than spending (${signed(out)}).`
      : `spending grew faster (${signed(out)}) than deposits (${signed(inn)}).`;
  return inn > out
    ? `deposits fell less (${signed(inn)}) than spending (${signed(out)}).`
    : `spending fell less (${signed(out)}) than deposits (${signed(inn)}).`;
}

export function Overview() {
  const [range, setRange] = useState<Range>("30D");
  const r = RANGES.find((x) => x.id === range)!;
  const to = AS_OF + DAY;
  const from = to - r.days * DAY;
  const cur = totals(from, to);
  const prev = totals(from - r.days * DAY, from);
  const net = cur.inTotal - cur.outTotal;
  const prevNet = prev.inTotal - prev.outTotal;
  const words = RANGE_WORDS[range];

  // ——— What changed, worked out from the numbers ———
  const topSource = SOURCES.map((s) => ({ s, v: cur.in[s.id] })).sort(
    (a, b) => b.v - a.v,
  )[0];
  const outMoves = OUTS.map((o) => ({
    o,
    now: cur.out[o.id],
    change: pct(cur.out[o.id], prev.out[o.id]),
  })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  const fastest = SOURCES.map((s) => ({
    s,
    change: pct(cur.in[s.id], prev.in[s.id]),
    now: cur.in[s.id],
  })).sort((a, b) => b.change - a.change)[0];
  const inChange = pct(cur.inTotal, prev.inTotal);
  const outChange = pct(cur.outTotal, prev.outTotal);
  const netChange = pct(net, prevNet);
  const insights: { text: React.ReactNode; href: string }[] = [
    {
      text: (
        <>
          Net cashflow is{" "}
          <b>
            {netChange >= 0 ? "up" : "down"} {Math.abs(netChange).toFixed(0)}%
          </b>{" "}
          on the previous {words} — {paceWords(inChange, outChange)}
        </>
      ),
      href: "/transactions",
    },
    {
      text: (
        <>
          <b>{topSource.s.label}</b> brought in{" "}
          <b>{Math.round((topSource.v / cur.inTotal) * 100)}%</b> of deposits (
          <span className="amount">{compact(topSource.v)}</span>).
        </>
      ),
      href: topSource.s.href,
    },
    {
      text: (
        <>
          <b>{outMoves[0].o.label}</b>{" "}
          {outMoves[0].change >= 0 ? "rose" : "fell"}{" "}
          <b>{Math.abs(outMoves[0].change).toFixed(0)}%</b> to{" "}
          <span className="amount">{compact(outMoves[0].now)}</span> — the
          biggest change in spending.
        </>
      ),
      href: outMoves[0].o.href,
    },
    {
      text: (
        <>
          <b>{fastest.s.label}</b> is your fastest-growing source,{" "}
          {fastest.change >= 0 ? "up" : "down"}{" "}
          <b>{Math.abs(fastest.change).toFixed(0)}%</b> to{" "}
          <span className="amount">{compact(fastest.now)}</span>.
        </>
      ),
      href: fastest.s.href,
    },
  ];

  // ——— Needs you: from the pages themselves, so the counts match ———
  const myRole = MEMBERS.find((m) => m.name === ME)?.role;
  const approvals = REQUESTS.filter(
    (q) =>
      q.state === "pending" &&
      !!myRole &&
      q.approvers.includes(myRole) &&
      q.requestedBy !== ME &&
      !q.decisions.some((d) => d.by === ME),
  );
  const respond = disputes
    .filter((d) => d.status === "Needs response")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const stuck = collections.filter(isStuck);
  const blockedRecipients = recipients.filter(
    (x) => x.status === "Pending" || x.payments.some((p) => p.failure),
  );
  const provisioning = accounts.filter((a) => a.status === "Pending");
  const oldest = provisioning.reduce<string | null>(
    (o, a) => (!o || a.createdAt < o ? a.createdAt : o),
    null,
  );
  const needs = [
    approvals.length && {
      n: approvals.length,
      text: `payment${approvals.length === 1 ? "" : "s"} waiting on your approval`,
      sub: `Largest ${compact(Math.max(...approvals.map((q) => q.amount)))}`,
      href: "/manage/approvals",
      urgent: true,
    },
    respond.length && {
      n: respond.length,
      text: `dispute${respond.length === 1 ? "" : "s"} to answer`,
      sub: `Next due in ${daysUntil(respond[0].dueAt)} days`,
      href: "/card-collection/disputes",
      urgent: daysUntil(respond[0].dueAt) <= 3,
    },
    stuck.length && {
      n: stuck.length,
      text: `card payment${stuck.length === 1 ? "" : "s"} charged but not settled`,
      sub: `${compact(stuck.reduce((s, c) => s + c.subtotal, 0))} held by Gravv`,
      href: "/card-collection/collections",
      urgent: false,
    },
    blockedRecipients.length && {
      n: blockedRecipients.length,
      text: `recipient${blockedRecipients.length === 1 ? "" : "s"} can't be paid yet`,
      sub: "Bank checks and a closed account",
      href: "/recipients",
      urgent: false,
    },
    provisioning.length && {
      n: provisioning.length,
      text: "accounts being set up by banks",
      sub: oldest
        ? `Oldest waiting ${Math.round((ACCOUNTS_AS_OF - Date.parse(oldest)) / DAY)} days`
        : "",
      href: "/account",
      urgent: false,
    },
  ].filter(Boolean) as {
    n: number;
    text: string;
    sub: string;
    href: string;
    urgent: boolean;
  }[];

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-20">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Overview
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Money across every wallet and account, compared with the {words}{" "}
              before.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Range"
            className="flex rounded-full bg-white/[0.07] p-0.5"
          >
            {RANGES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={range === x.id}
                onClick={() => setRange(x.id)}
                className={`h-8 rounded-full px-3.5 text-[13px] tabular-nums transition-colors ${
                  range === x.id
                    ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                {x.id}
              </button>
            ))}
          </div>
        </div>

        {/* Headline */}
        <div className="mt-10 border-t border-white/8 pt-7">
          <div className="text-[13px] text-neutral-500">
            Net cashflow · last {words}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-10 gap-y-4">
            <div className="text-[40px] leading-none font-medium tracking-[-0.035em] text-white">
              <Money
                value={net}
                signed
                className={net >= 0 ? "text-[var(--ok-fg)]" : ""}
              />
            </div>
            <div className="flex gap-10 pb-1 text-[13px]">
              <div>
                <div className="text-neutral-500">Money in</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="amount text-[17px] font-medium text-white tabular-nums">
                    {compact(cur.inTotal)}
                  </span>
                  <Change value={inChange} />
                </div>
              </div>
              <div>
                <div className="text-neutral-500">Money out</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="amount text-[17px] font-medium text-white tabular-nums">
                    {compact(cur.outTotal)}
                  </span>
                  <Change value={outChange} invert />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-2xl border border-white/5 bg-white/[0.015] px-6 pt-5 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-medium text-white">In and out</h2>
              <div className="flex items-center gap-4 text-[12px] text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-1.5 rounded-[1px] bg-[var(--flow-in)]"
                  />
                  In
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-1.5 rounded-[1px] bg-[var(--flow-out)]"
                  />
                  Out
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-[2px] w-3 rounded bg-white" />
                  Net
                </span>
              </div>
            </div>
            <FlowChart data={buckets(range)} range={range} />
          </section>

          <section className="rounded-2xl border border-white/8 bg-surface p-5">
            <h2 className="text-[15px] font-medium text-white">Needs you</h2>
            <ul className="mt-3 divide-y divide-white/6">
              {needs.map((x) => (
                <li key={x.href}>
                  <Link
                    href={x.href}
                    className="group flex items-center gap-3 py-3"
                  >
                    <span
                      className={`w-9 shrink-0 text-[20px] font-medium tracking-[-0.02em] tabular-nums ${x.urgent ? "text-rose-300" : "text-white"}`}
                    >
                      {x.n.toLocaleString("en-US")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug text-neutral-100">
                        {x.text}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-neutral-500">
                        {x.sub}
                      </span>
                    </span>
                    <ChevronRight
                      size={14}
                      strokeWidth={1.75}
                      className="shrink-0 text-neutral-600 group-hover:text-white"
                    />
                  </Link>
                </li>
              ))}
              {needs.length === 0 && (
                <li className="py-3 text-[13px] text-neutral-500">
                  Nothing needs you today.
                </li>
              )}
            </ul>
          </section>
        </div>

        <section className="mt-12">
          <h2 className="text-[15px] font-medium text-white">What changed</h2>
          <ul className="mt-3 grid gap-x-10 border-t border-white/8 lg:grid-cols-2">
            {insights.map((x, i) => (
              <li key={i} className="border-b border-white/6">
                <Link
                  href={x.href}
                  className="group flex items-start justify-between gap-4 py-4 text-[14px] leading-relaxed text-neutral-400 [&_b]:font-medium [&_b]:text-white"
                >
                  <span>{x.text}</span>
                  <ArrowRight
                    size={14}
                    strokeWidth={1.75}
                    className="mt-1.5 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** In above the line in mint, out below in grey, net drawn across. One axis, values in USD. */
function FlowChart({ data, range }: { data: Bucket[]; range: Range }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(320, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 240;
  const left = 52;
  const maxIn = Math.max(...data.map((d) => d.in), 1);
  const maxOut = Math.max(...data.map((d) => d.out), 1);
  const scale = (H - 16) / (maxIn + maxOut);
  const zero = 8 + maxIn * scale;
  const band = (w - left) / data.length;
  const barW = Math.max(3, Math.min(28, band * 0.56));
  const cx = (i: number) => left + band * (i + 0.5);
  const net = data
    .map(
      (d, i) =>
        `${i ? "L" : "M"}${cx(i).toFixed(1)},${(zero - (d.in - d.out) * scale).toFixed(1)}`,
    )
    .join("");
  const label = (b: Bucket) =>
    range === "12M"
      ? monthYear.format(b.start)
      : range === "90D"
        ? `Week of ${day.format(b.start)}`
        : day.format(b.start);
  const tick = (b: Bucket) =>
    range === "12M" ? month.format(b.start) : day.format(b.start);
  const ticks = [maxIn, maxIn / 2, 0, -maxOut / 2, -maxOut];
  const h = hover === null ? null : data[hover];

  return (
    <div
      ref={wrap}
      className="relative mt-5"
      onMouseLeave={() => setHover(null)}
    >
      <svg
        width={w}
        height={H + 22}
        className="block"
        role="img"
        aria-label={`Money in and out per ${range === "12M" ? "month" : range === "90D" ? "week" : "day"}`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={left}
              x2={w}
              y1={zero - v * scale}
              y2={zero - v * scale}
              stroke="currentColor"
              className={v === 0 ? "text-white/20" : "text-white/[0.05]"}
            />
            <text
              x={left - 10}
              y={zero - v * scale + 4}
              textAnchor="end"
              className="fill-neutral-500 text-[10px] tabular-nums"
            >
              {v === 0
                ? "0"
                : `${v > 0 ? "+" : "−"}${compact(Math.abs(v)).slice(1)}`}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.start} opacity={dim ? 0.35 : 1}>
              {hover === i && (
                <rect
                  x={cx(i) - band / 2}
                  y={0}
                  width={band}
                  height={H}
                  className="fill-white/[0.04]"
                />
              )}
              <rect
                x={cx(i) - barW / 2}
                y={zero - d.in * scale}
                width={barW}
                height={Math.max(1, d.in * scale - 1)}
                rx={2}
                fill="var(--flow-in)"
              />
              <rect
                x={cx(i) - barW / 2}
                y={zero + 1}
                width={barW}
                height={Math.max(1, d.out * scale - 1)}
                rx={2}
                fill="var(--flow-out)"
              />
            </g>
          );
        })}
        <path
          d={net}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinejoin="round"
          className="text-white/80"
        />
        {[0, Math.floor(data.length / 2), data.length - 1].map((i) => (
          <text
            key={i}
            x={cx(i)}
            y={H + 16}
            textAnchor={
              i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
            }
            className="fill-neutral-500 text-[11px]"
          >
            {i === data.length - 1
              ? range === "12M"
                ? "This month"
                : range === "90D"
                  ? "This week"
                  : "Today"
              : tick(data[i])}
          </text>
        ))}
        {data.map((d, i) => (
          <rect
            key={`hit${d.start}`}
            x={cx(i) - band / 2}
            y={0}
            width={band}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-48 rounded-lg border border-white/10 bg-raised px-3 py-2.5 text-xs shadow-2xl"
          style={{ left: `clamp(0px, ${cx(hover) - 96}px, ${w - 192}px)` }}
        >
          <div className="text-neutral-400">{label(h)}</div>
          <div className="mt-1.5 flex justify-between tabular-nums">
            <span className="text-neutral-400">In</span>
            <span className="amount text-[var(--ok-fg)]">+{compact(h.in)}</span>
          </div>
          <div className="mt-0.5 flex justify-between tabular-nums">
            <span className="text-neutral-400">Out</span>
            <span className="amount text-neutral-200">−{compact(h.out)}</span>
          </div>
          <div className="mt-1.5 flex justify-between border-t border-white/8 pt-1.5 font-medium text-white tabular-nums">
            <span>Net</span>
            <span className="amount">
              {h.in - h.out >= 0 ? "+" : "−"}
              {compact(Math.abs(h.in - h.out))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
