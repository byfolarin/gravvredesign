"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ChevronRight,
  HandCoins,
  Repeat,
  Send,
} from "lucide-react";
import { Roll } from "@/app/_components/roll";
import { CurrencyFlag } from "@/app/_components/currency-flag";
import {
  AS_OF as ACCOUNTS_AS_OF,
  accounts,
  type Currency,
} from "../account/_data";
import { SYMBOL } from "../account/_components/currency";
import {
  MONTH_DAYS,
  PROGRAM_LIMIT,
  SPEND_DAY,
  cards,
  monthlySpend,
} from "../cards/_data";
import { REQUESTS } from "../manage/approvals/_data";
import { daysUntil, disputes } from "../card-collection/disputes/_data";
import { collections, isStuck } from "../card-collection/collections/_data";
import { links } from "../payment-links/_data";
import { ORDERS, PAIRS } from "../trade-desk/_data";
import { transactions, type Transaction } from "../transactions/_data";

/* ——— Shared bits ——— */

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 20, 9, 0, 0);
const usd = (v: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
const compact = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`
    : v >= 10_000
      ? `$${Math.round(v / 1000)}k`
      : v >= 1000
        ? `$${(v / 1000).toFixed(1)}k`
        : usd(v);
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/** Headline money: whole number big, cents quiet on the baseline. */
function Big({ value, symbol = "$" }: { value: number; symbol?: string }) {
  const [w, c] = value
    .toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  return (
    <span className="amount tabular-nums">
      {symbol}
      <Roll value={w} />
      <sub className="ml-px text-[0.5em] text-neutral-500">{c}</sub>
    </span>
  );
}

export function Open({
  href,
  label = "Open",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-0.5 text-[12px] text-neutral-500 transition-colors hover:text-white"
    >
      {label}
      <ChevronRight size={13} strokeWidth={1.75} />
    </Link>
  );
}

/* ——— Balance ——— */

const SHOWN: Currency[] = ["USD", "EUR", "GBP", "NGN"];

function BalanceWidget() {
  const [c, setC] = useState<Currency>("USD");
  const held = accounts.filter(
    (a) => a.currency === c && (a.status === "Active" || a.status === "Frozen"),
  );
  const total = held.reduce((s, a) => s + a.balance, 0);
  const pending = accounts.filter(
    (a) => a.currency === c && a.status === "Pending",
  ).length;
  // A stable 30-day change per currency for the prototype.
  const change = { USD: 6.8, EUR: 2.1, GBP: -1.4, NGN: 11.2 }[c as "USD"] ?? 0;
  const banks = [...new Set(held.map((a) => a.bank))];
  return (
    <div>
      <div role="tablist" className="flex items-center gap-0.5">
        {SHOWN.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={c === k}
            onClick={() => setC(k)}
            className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] ${c === k ? "" : "text-neutral-500 hover:text-neutral-200"}`}
          >
            <CurrencyFlag code={k} size={14} />
            {k}
          </button>
        ))}
      </div>
      <div className="mt-4 text-[34px] leading-none font-medium tracking-[-0.035em] text-white">
        <Big value={total} symbol={SYMBOL[c]} />
      </div>
      <p className="mt-2.5 text-[13px] text-neutral-400">
        <span
          className={change >= 0 ? "text-[var(--ok-fg)]" : "text-neutral-300"}
        >
          {change >= 0 ? "+" : "−"}
          {Math.abs(change).toFixed(1)}%
        </span>{" "}
        in 30 days · across {held.length.toLocaleString("en-US")} accounts at{" "}
        {banks.length} bank{banks.length === 1 ? "" : "s"}
        {pending > 0 && ` · ${pending} more being set up`}
      </p>
      <Trend
        total={total}
        change={change}
        symbol={SYMBOL[c]}
        seed={c.charCodeAt(0)}
      />
    </div>
  );
}

/** The last 30 days as daily bars; hover a day for its balance. */
function Trend({
  total,
  change,
  symbol,
  seed,
}: {
  total: number;
  change: number;
  symbol: string;
  seed: number;
}) {
  const [day, setDay] = useState<number | null>(null);
  const start = total / (1 + change / 100);
  const days = Array.from({ length: 30 }, (_, i) => {
    if (i === 29) return total;
    const wobble =
      Math.sin((i + 1) * 1.7 + seed) * 0.012 +
      Math.sin((i + 3) * 0.6 + seed) * 0.008;
    return (start + ((total - start) * i) / 29) * (1 + wobble);
  });
  const lo = Math.min(...days) * 0.985;
  const hi = Math.max(...days);
  const fmt = (v: number) =>
    `${symbol}${Math.round(v).toLocaleString("en-US")}`;
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between text-[12px] text-neutral-500 tabular-nums">
        <span>Last 30 days</span>
        <span className={day !== null ? "amount text-neutral-300" : ""}>
          {day !== null
            ? `${fmt(days[day])} · ${dayFmt.format(NOW - (29 - day) * DAY)}`
            : "Today"}
        </span>
      </div>
      <div
        className="mt-2 flex h-16 items-end gap-[2px]"
        onMouseLeave={() => setDay(null)}
      >
        {days.map((v, i) => (
          <span
            key={i}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setDay(i)}
          >
            <span
              className={`block w-full rounded-t-[2px] transition-opacity ${i === 29 ? "bg-[var(--flow-in)]" : "bg-[color-mix(in_srgb,var(--flow-in)_35%,transparent)]"} ${day !== null && day !== i ? "opacity-40" : ""}`}
              style={{
                height: `${Math.max(6, ((v - lo) / (hi - lo || 1)) * 100)}%`,
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ——— Needs you ——— */

type Need = {
  count: number;
  line: string;
  detail: string;
  href: string;
  tone: "amber" | "rose";
};

function needs(): Need[] {
  const out: Need[] = [];
  const pending = REQUESTS.filter((r) => r.state === "pending");
  if (pending.length) {
    const big = [...pending].sort((a, b) => b.amount - a.amount)[0];
    out.push({
      count: pending.length,
      line: `payment${pending.length === 1 ? "" : "s"} waiting for approval`,
      detail: `Biggest ${big.currency === "USD" || big.currency === "USDC" ? usd(big.amount) : `${big.amount.toLocaleString("en-US")} ${big.currency}`} to ${big.recipient.name}`,
      href: "/manage/approvals",
      tone: "amber",
    });
  }
  const respond = disputes.filter((d) => d.status === "Needs response");
  if (respond.length) {
    const next = Math.min(...respond.map((d) => daysUntil(d.dueAt)));
    out.push({
      count: respond.length,
      line: `dispute${respond.length === 1 ? "" : "s"} to answer`,
      detail:
        next <= 0
          ? "Next one is due today"
          : `Next one due in ${next} day${next === 1 ? "" : "s"}`,
      href: "/card-collection/disputes",
      tone: next <= 3 ? "rose" : "amber",
    });
  }
  const stuck = collections.filter(isStuck);
  if (stuck.length)
    out.push({
      count: stuck.length,
      line: `card payment${stuck.length === 1 ? "" : "s"} charged but not settled`,
      detail: `${usd(stuck.reduce((s, c) => s + c.subtotal, 0))} in USDC waiting · Retry from Collections`,
      href: "/card-collection/collections",
      tone: "rose",
    });
  const desk = ORDERS.filter((o) =>
    [
      "Awaiting approval",
      "Awaiting funds",
      "Payout returned",
      "Short deposit",
    ].includes(o.status),
  );
  if (desk.length)
    out.push({
      count: desk.length,
      line: `trade desk order${desk.length === 1 ? "" : "s"} waiting on you`,
      detail: desk
        .slice(0, 2)
        .map((o) => `${o.id} ${o.status.toLowerCase()}`)
        .join(" · "),
      href: "/trade-desk",
      tone: "amber",
    });
  const near = cards.filter((c) => c.spentThisMonth / c.monthlyLimit >= 0.85);
  if (near.length)
    out.push({
      count: near.length,
      line: `card${near.length === 1 ? "" : "s"} near their limit`,
      detail: near.map((c) => c.holder).join(", "),
      href: "/cards",
      tone: "amber",
    });
  return out;
}

function NeedsWidget() {
  const list = needs();
  if (!list.length)
    return (
      <p className="py-6 text-[13px] text-neutral-500">
        Nothing needs you right now.
      </p>
    );
  return (
    <ul className="-my-1 divide-y divide-white/6">
      {list.map((n) => (
        <li key={n.href}>
          <Link href={n.href} className="group flex items-start gap-3 py-2.5">
            <span
              className={`w-7 shrink-0 text-[18px] leading-6 font-medium tabular-nums ${n.tone === "rose" ? "text-rose-300" : "text-amber-200"}`}
            >
              {n.count}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-neutral-100">
                {n.line}
              </span>
              <span className="block truncate text-[12px] text-neutral-500">
                {n.detail}
              </span>
            </span>
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className="mt-1 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ——— Money in / out ——— */

const month = transactions.filter(
  (t) =>
    t.status === "Completed" &&
    NOW - new Date(t.createdAt).getTime() <= 30 * DAY,
);

function FlowWidget() {
  const inn = month
    .filter((t) => t.direction === "Credit")
    .reduce((s, t) => s + t.amount, 0);
  const out = month
    .filter((t) => t.direction === "Debit")
    .reduce((s, t) => s + t.amount, 0);
  const net = inn - out;
  const total = Math.max(1, inn + out);
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[12px] text-neutral-500">In</div>
          <div className="amount mt-1 text-[22px] font-medium tracking-[-0.03em] text-[var(--ok-fg)] tabular-nums">
            +{compact(inn)}
          </div>
        </div>
        <div>
          <div className="text-[12px] text-neutral-500">Out</div>
          <div className="amount mt-1 text-[22px] font-medium tracking-[-0.03em] text-white tabular-nums">
            −{compact(out)}
          </div>
        </div>
      </div>
      {/* In and out as one bar, split where they meet */}
      <div className="mt-4 flex h-2 gap-[3px]" aria-hidden>
        <span
          className="h-full rounded-full bg-[var(--flow-in)]"
          style={{ width: `${(inn / total) * 100}%` }}
        />
        <span className="h-full flex-1 rounded-full bg-[color-mix(in_srgb,var(--color-white)_55%,transparent)]" />
      </div>
      <p className="mt-3 text-[12.5px] text-neutral-400">
        {net >= 0 ? "Up" : "Down"}{" "}
        <span className="amount text-neutral-200">
          {compact(Math.abs(net))}
        </span>{" "}
        over 30 days · {month.length} completed transactions
      </p>
    </div>
  );
}

/* ——— Card spend ——— */

function CardsWidget() {
  const spent = monthlySpend.spent;
  const pace = (spent / SPEND_DAY) * MONTH_DAYS;
  const at = (v: number) => `${Math.min(100, (v / PROGRAM_LIMIT) * 100)}%`;
  return (
    <div>
      <div className="text-[22px] leading-none font-medium tracking-[-0.03em] text-white">
        <Big value={spent} />
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        On pace for{" "}
        <span className="amount text-neutral-200">{compact(pace)}</span> of the{" "}
        {compact(PROGRAM_LIMIT)} limit
      </p>
      <div className="mt-4 flex h-2 gap-[3px]" aria-hidden>
        <span
          className="h-full rounded-full bg-[var(--flow-in)]"
          style={{ width: at(spent) }}
        />
        <span
          className="hatch-pace h-full rounded-full border border-[color-mix(in_srgb,var(--flow-in)_60%,transparent)]"
          style={{ width: `calc(${at(pace - spent)} - 3px)` }}
        />
        <span className="h-full flex-1 rounded-full bg-white/[0.07]" />
      </div>
      <p className="mt-3 text-[12px] text-neutral-500">
        {cards.filter((c) => c.status === "Active").length} active of{" "}
        {cards.length} cards
      </p>
    </div>
  );
}

/* ——— Collections ——— */

function CollectionsWidget() {
  const recent = collections.filter(
    (c) => NOW - new Date(c.createdAt).getTime() <= 30 * DAY,
  );
  const settled = recent.filter((c) => c.status === "Settlement completed");
  const charged = recent.filter(
    (c) => !["Payment failed", "Expired", "Abandoned"].includes(c.status),
  );
  const steps = [
    { label: "Started", n: recent.length },
    { label: "Charged", n: charged.length },
    { label: "Settled", n: settled.length },
  ];
  return (
    <div>
      <div className="text-[22px] leading-none font-medium tracking-[-0.03em] text-white">
        <Big value={settled.reduce((s, c) => s + c.subtotal, 0)} />
        <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
          USDC
        </span>
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        Settled from card payments in 30 days
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="text-[15px] font-medium text-white tabular-nums">
              {s.n}
            </div>
            <div className="mt-1 h-1 rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[color-mix(in_srgb,var(--color-white)_60%,transparent)]"
                style={{
                  width: `${(s.n / Math.max(1, recent.length)) * 100}%`,
                }}
              />
            </div>
            <div className="mt-1 text-[11.5px] text-neutral-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ——— Payment links ——— */

function LinksWidget() {
  const toUsd = (v: number, c: string) => (c === "NGN" ? v / 1500 : v);
  const rows = links
    .map((l) => {
      const paid = l.payments.filter(
        (p) =>
          p.status === "Paid" && NOW - new Date(p.date).getTime() <= 30 * DAY,
      );
      return {
        l,
        n: paid.length,
        v: paid.reduce((s, p) => s + toUsd(p.amount, l.currency), 0),
      };
    })
    .filter((r) => r.n > 0)
    .sort((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0);
  const active = links.filter((l) => l.status === "Active").length;
  return (
    <div>
      <div className="text-[22px] leading-none font-medium tracking-[-0.03em] text-white">
        <Big value={total} />
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        Collected in 30 days (USD-eq) · {active} links live
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.slice(0, 3).map((r) => (
          <li
            key={r.l.id}
            className="flex items-baseline justify-between gap-3 text-[12.5px]"
          >
            <Link
              href={`/payment-links/${r.l.id}`}
              className="min-w-0 truncate text-neutral-200 hover:text-white"
            >
              {r.l.name}
            </Link>
            <span className="amount shrink-0 text-neutral-400 tabular-nums">
              {compact(r.v)} · {r.n} paid
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ——— Trade desk ——— */

function DeskWidget() {
  const open = ORDERS.filter(
    (o) => !["Settled", "Cancelled", "Rejected"].includes(o.status),
  );
  return (
    <div>
      <ul className="space-y-2">
        {PAIRS.slice(0, 4).map((p) => (
          <li
            key={p.id}
            className="flex items-baseline justify-between gap-3 text-[13px]"
          >
            <span className="text-neutral-200">
              {p.sell} <span className="text-neutral-600">→</span> {p.get}
            </span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="text-white">
                {p.rate.toLocaleString("en-US", {
                  maximumFractionDigits: p.rate < 10 ? 4 : 2,
                })}
              </span>
              <span
                className={`w-12 text-right text-[12px] ${p.change24h > 0.05 ? "text-[var(--ok-fg)]" : p.change24h < -0.05 ? "text-rose-300" : "text-neutral-500"}`}
              >
                {p.change24h > 0 ? "+" : ""}
                {p.change24h.toFixed(2)}%
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-white/6 pt-2.5 text-[12px] text-neutral-500">
        {open.length} open order{open.length === 1 ? "" : "s"} · rates are
        indicative
      </p>
    </div>
  );
}

/* ——— Recent transactions ——— */

const party = (t: Transaction) =>
  (t.direction === "Credit" ? t.source : t.destination).name;

function RecentWidget() {
  const rows = [...transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  return (
    <ul className="-my-1 divide-y divide-white/6">
      {rows.map((t) => (
        <li key={t.id}>
          <Link
            href={`/transactions?q=${encodeURIComponent(t.id)}`}
            className="flex items-center gap-4 py-2.5 text-[13px]"
          >
            <span className="w-14 shrink-0 text-[12px] text-neutral-500 tabular-nums">
              {dayFmt.format(new Date(t.createdAt))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-white">
                {party(t)}
              </span>
              <span className="block truncate text-[12px] text-neutral-500">
                {t.type} · {t.channel}
              </span>
            </span>
            {t.status !== "Completed" && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${t.status === "Failed" ? "bg-rose-400/10 text-rose-300" : "bg-amber-300/10 text-amber-200"}`}
              >
                {t.status}
              </span>
            )}
            <span
              className={`amount w-24 shrink-0 text-right tabular-nums ${t.status === "Failed" ? "text-neutral-600 line-through" : t.direction === "Credit" ? "text-[var(--ok-fg)]" : "text-white"}`}
            >
              {t.direction === "Credit" ? "+" : "−"}
              {usd(t.amount, 2)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ——— Accounts being set up ——— */

function ProvisioningWidget() {
  const pending = accounts.filter((a) => a.status === "Pending");
  const oldest = pending.reduce<(typeof pending)[number] | null>(
    (o, a) => (!o || a.createdAt < o.createdAt ? a : o),
    null,
  );
  const byBank = Object.entries(
    pending.reduce<Record<string, number>>(
      (m, a) => ((m[a.bank] = (m[a.bank] ?? 0) + 1), m),
      {},
    ),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const days = oldest
    ? Math.round((ACCOUNTS_AS_OF - new Date(oldest.createdAt).getTime()) / DAY)
    : 0;
  return (
    <div>
      <div className="text-[22px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
        <Roll value={pending.length.toLocaleString("en-US")} />
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-400">
        Accounts being set up
        {oldest && ` · oldest waiting ${days}d at ${oldest.bank}`}
      </p>
      <ul className="mt-3 space-y-1.5">
        {byBank.map(([bank, n]) => (
          <li
            key={bank}
            className="flex items-baseline justify-between text-[12.5px]"
          >
            <span className="text-neutral-300">{bank}</span>
            <span className="text-neutral-500 tabular-nums">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ——— Quick actions ——— */

function ActionsWidget() {
  const acts = [
    { label: "Send money", href: "/recipients", icon: Send },
    { label: "Request payment", href: "/payment-links", icon: HandCoins },
    { label: "Move between accounts", href: "/account", icon: ArrowLeftRight },
    { label: "Convert currency", href: "/trade-desk", icon: Repeat },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {acts.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="group flex items-center gap-2.5 rounded-xl border border-white/8 px-3 py-3 text-[13px] text-neutral-200 transition-colors hover:border-white/20 hover:text-white"
        >
          <a.icon
            size={15}
            strokeWidth={1.75}
            className="text-neutral-400 group-hover:text-white"
          />
          <span className="min-w-0 flex-1 truncate">{a.label}</span>
          <ArrowUpRight
            size={13}
            strokeWidth={1.75}
            className="text-neutral-600 group-hover:text-white"
          />
        </Link>
      ))}
    </div>
  );
}

/* ——— Registry ——— */

export type WidgetId =
  | "balance"
  | "needs"
  | "flow"
  | "cards"
  | "collections"
  | "links"
  | "desk"
  | "recent"
  | "provisioning"
  | "actions";

/** Width in a 6-column grid: ⅓ = 2, ½ = 3, ⅔ = 4, full = 6. */
export type Width = 2 | 3 | 4 | 6;

export const WIDGETS: Record<
  WidgetId,
  {
    title: string;
    /** One line for the Add panel. */
    about: string;
    href: string;
    /** Widths this widget reads well at. */
    widths: Width[];
    body: () => React.ReactNode;
  }
> = {
  balance: {
    title: "Balance",
    about: "Every account in one currency, and how it moved in 30 days",
    href: "/account",
    widths: [3, 4, 6],
    body: () => <BalanceWidget />,
  },
  needs: {
    title: "Needs you",
    about: "Approvals, disputes, stuck payments and orders waiting on you",
    href: "/manage/approvals",
    widths: [2, 3, 4, 6],
    body: () => <NeedsWidget />,
  },
  flow: {
    title: "Money in and out",
    about: "What came in and went out over 30 days",
    href: "/transactions",
    widths: [2, 3, 4, 6],
    body: () => <FlowWidget />,
  },
  cards: {
    title: "Card spend",
    about: "This month's spend against the program limit",
    href: "/cards",
    widths: [2, 3, 4, 6],
    body: () => <CardsWidget />,
  },
  collections: {
    title: "Collections",
    about: "What card payments settled, and where they dropped off",
    href: "/card-collection/collections",
    widths: [2, 3, 4, 6],
    body: () => <CollectionsWidget />,
  },
  links: {
    title: "Payment links",
    about: "What your links collected, and the top earners",
    href: "/payment-links",
    widths: [2, 3, 4, 6],
    body: () => <LinksWidget />,
  },
  desk: {
    title: "Trade desk",
    about: "Live rates for your pairs and open orders",
    href: "/trade-desk",
    widths: [2, 3, 4, 6],
    body: () => <DeskWidget />,
  },
  recent: {
    title: "Recent transactions",
    about: "The latest money in and out",
    href: "/transactions",
    widths: [3, 4, 6],
    body: () => <RecentWidget />,
  },
  provisioning: {
    title: "Accounts being set up",
    about: "Accounts the banks are still opening",
    href: "/account",
    widths: [2, 3, 4, 6],
    body: () => <ProvisioningWidget />,
  },
  actions: {
    title: "Quick actions",
    about: "Send, request, move and convert in one click",
    href: "/transactions",
    widths: [4, 6],
    body: () => <ActionsWidget />,
  },
};

export type Slot = { id: WidgetId; w: Width };

export const DEFAULT_LAYOUT: Slot[] = [
  { id: "balance", w: 4 },
  { id: "needs", w: 2 },
  { id: "flow", w: 2 },
  { id: "cards", w: 2 },
  { id: "collections", w: 2 },
  { id: "recent", w: 4 },
  { id: "desk", w: 2 },
  { id: "links", w: 3 },
  { id: "provisioning", w: 3 },
];
