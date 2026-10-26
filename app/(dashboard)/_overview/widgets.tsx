"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  ALL_CURRENCIES,
  AS_OF as ACCOUNTS_AS_OF,
  accounts,
  type Currency,
} from "../account/_data";
import {
  BalancePanel,
  MAX_SHOWN,
  SHOWN_KEY,
} from "../account/_components/accounts-workspace";
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
import { ORDERS, PAIRS, usdValue } from "../trade-desk/_data";
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

/**
 * The Accounts page's own balance chart — same line, previous period, daily change, 7D/30D/90D
 * and currency set (shared with Accounts through storage), so both pages always agree.
 */
function BalanceWidget() {
  const router = useRouter();
  const [shown, setShown] = useState<Currency[]>(["USD", "EUR", "GBP", "NGN"]);
  const [c, setC] = useState<Currency>("USD");
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "null");
        if (Array.isArray(saved)) {
          const valid = saved
            .filter((x): x is Currency => ALL_CURRENCIES.includes(x))
            .slice(0, MAX_SHOWN);
          if (valid.length) {
            setShown(valid);
            setC(valid[0]);
          }
        }
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const save = (next: Currency[]) => {
    setShown(next);
    if (!next.includes(c) && next.length) setC(next[0]);
    try {
      localStorage.setItem(SHOWN_KEY, JSON.stringify(next));
    } catch {}
  };
  const held = accounts.filter(
    (a) => a.currency === c && (a.status === "Active" || a.status === "Frozen"),
  );
  const waiting = accounts.filter(
    (a) => a.currency === c && a.status === "Pending",
  );
  const all = accounts.filter((a) => a.currency === c).length;
  return (
    <BalancePanel
      label=""
      total={held.reduce((s, a) => s + a.balance, 0)}
      currency={c}
      currencies={shown}
      onCurrency={setC}
      onCurrencies={save}
      counts={
        Object.fromEntries(
          ALL_CURRENCIES.map((k) => [
            k,
            accounts.filter((a) => a.currency === k).length,
          ]),
        ) as Record<Currency, number>
      }
      onOpenAccount={() => router.push("/account")}
      funded={held.length}
      waiting={
        waiting.length
          ? { count: waiting.length, bank: waiting[0].bank }
          : undefined
      }
      accountsNote={`Across ${held.length.toLocaleString("en-US")} of ${all.toLocaleString("en-US")} accounts`}
    />
  );
}

/* ——— Needs you ——— */

/**
 * One decision waiting on you: said as the thing to do, with what's at stake, how long it has
 * waited (or when it's due), and the one action that clears it. Deel's "For you today" rows and
 * Gusto's task cards, with money and deadlines up front because this is a money product.
 */
type Need = {
  key: string;
  /** Imperative: "Approve 42 payments". */
  title: string;
  detail: string;
  /** USD-eq at stake, when there is money on the line. */
  stake?: number;
  /** "Due in 2 days" / "Oldest 3d" — the clock on it. */
  when: string;
  urgent: boolean;
  action: string;
  href: string;
  /** Lower goes first. */
  rank: number;
};

const TO_USD: Record<string, number> = {
  USD: 1,
  USDC: 1,
  EUR: 1.08,
  GBP: 1.27,
  NGN: 1 / 1600,
};
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function needs(): Need[] {
  const out: Need[] = [];
  const respond = disputes.filter((d) => d.status === "Needs response");
  if (respond.length) {
    const next = Math.min(...respond.map((d) => daysUntil(d.dueAt)));
    out.push({
      key: "disputes",
      title: `Answer ${plural(respond.length, "dispute")}`,
      detail:
        "Held until you respond — the bank decides without you after the deadline",
      stake: respond.reduce((s, d) => s + d.amount, 0),
      when: next <= 0 ? "Due today" : `Due in ${plural(next, "day")}`,
      urgent: next <= 3,
      action: "Respond",
      href: "/card-collection/disputes",
      rank: next <= 3 ? 0 : 3,
    });
  }
  const stuck = collections.filter(isStuck);
  if (stuck.length)
    out.push({
      key: "stuck",
      title: `Retry ${plural(stuck.length, "card payment")}`,
      detail: "Charged to the card but not settled to you in USDC",
      stake: stuck.reduce((s, c) => s + c.subtotal, 0),
      when: "Waiting now",
      urgent: true,
      action: "Retry",
      href: "/card-collection/collections",
      rank: 1,
    });
  const pending = REQUESTS.filter((r) => r.state === "pending");
  if (pending.length) {
    const oldest = Math.min(...pending.map((r) => Date.parse(r.requestedAt)));
    const days = Math.max(1, Math.round((NOW - oldest) / DAY));
    out.push({
      key: "approvals",
      title: `Approve ${plural(pending.length, "payment")}`,
      detail: `Requested by your team — nothing goes out until someone signs off`,
      stake: pending.reduce(
        (s, r) => s + r.amount * (TO_USD[r.currency] ?? 1),
        0,
      ),
      when: `Oldest ${days}d`,
      urgent: false,
      action: "Review",
      href: "/manage/approvals",
      rank: 2,
    });
  }
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
      key: "desk",
      title: `Finish ${plural(desk.length, "trade desk order")}`,
      detail: desk
        .slice(0, 2)
        .map((o) => `${o.id} ${o.status.toLowerCase()}`)
        .join(" · "),
      stake: desk.reduce((s, o) => s + usdValue(o.sell, o.sellAmount), 0),
      when: "Rate held 15 min",
      urgent: false,
      action: "Open",
      href: "/trade-desk",
      rank: 4,
    });
  const near = cards.filter((c) => c.spentThisMonth / c.monthlyLimit >= 0.85);
  if (near.length)
    out.push({
      key: "cards",
      title: `Check ${plural(near.length, "card")} near the limit`,
      detail: `${near.map((c) => c.holder.split(" ")[0]).join(" and ")} will start declining at the limit`,
      when: `Resets ${dayFmt.format(Date.UTC(2026, 10, 1))}`,
      urgent: false,
      action: "Raise limit",
      href: "/cards",
      rank: 5,
    });
  return out.sort((x, y) => x.rank - y.rank);
}

function NeedsWidget() {
  const list = needs();
  if (!list.length)
    return (
      <p className="py-6 text-[13px] text-neutral-500">
        Nothing needs you right now.
      </p>
    );
  const [first, ...rest] = list;
  const total = list.reduce((s, n) => s + (n.stake ?? 0), 0);
  return (
    <div>
      <p className="-mt-2 text-[13px] text-neutral-400">
        <span className="amount font-medium text-white">{compact(total)}</span>{" "}
        waiting on {plural(list.length, "decision")}
      </p>

      {/* Do this first */}
      <div className="mt-4 rounded-xl bg-white/[0.04] p-4">
        <div
          className={`text-[12px] ${first.urgent ? "text-rose-300" : "text-amber-200"}`}
        >
          Do this first · {first.when}
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[15px] font-medium text-white">
              {first.title}
              {first.stake !== undefined && (
                <span className="amount ml-2 font-normal text-neutral-400 tabular-nums">
                  {compact(first.stake)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] leading-snug text-neutral-500">
              {first.detail}
            </p>
          </div>
          <Link
            href={first.href}
            className="flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
          >
            {first.action}
          </Link>
        </div>
      </div>

      {/* Then the rest, most pressing first */}
      <ul className="mt-2 divide-y divide-white/6">
        {rest.map((n) => (
          <li key={n.key} className="flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] text-neutral-100">
                {n.title}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-neutral-500">
                {n.stake !== undefined && (
                  <span className="amount text-neutral-300 tabular-nums">
                    {compact(n.stake)} ·{" "}
                  </span>
                )}
                <span className={n.urgent ? "text-rose-300" : ""}>
                  {n.when}
                </span>
              </div>
            </div>
            <Link
              href={n.href}
              className="flex h-7 shrink-0 items-center rounded-full border border-white/12 px-3 text-[12px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              {n.action}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ——— Stat cards: one figure, one sentence, at most one visual (Mercury home) ——— */

function Stat({
  figure,
  line,
  children,
}: {
  figure: React.ReactNode;
  line: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[26px] leading-none font-medium tracking-[-0.03em] text-white">
        {figure}
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">
        {line}
      </p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

const month = transactions.filter(
  (t) =>
    t.status === "Completed" &&
    NOW - new Date(t.createdAt).getTime() <= 30 * DAY,
);
const party = (t: Transaction) =>
  (t.direction === "Credit" ? t.source : t.destination).name;
/** The counterparty that moved the most, one direction. */
function topParty(dir: "Credit" | "Debit") {
  const by = new Map<string, number>();
  for (const t of month.filter((t) => t.direction === dir))
    by.set(party(t), (by.get(party(t)) ?? 0) + t.amount);
  return [...by.entries()].sort((x, y) => y[1] - x[1])[0];
}

function MoneyInWidget() {
  const list = month.filter((t) => t.direction === "Credit");
  const top = topParty("Credit");
  return (
    <Stat
      figure={
        <span className="amount text-[var(--ok-fg)] tabular-nums">
          +$
          <Roll value={usd(list.reduce((s, t) => s + t.amount, 0)).slice(1)} />
        </span>
      }
      line={
        <>
          {list.length} payments in over 30 days
          {top && (
            <>
              {" "}
              · most from <span className="text-neutral-200">{top[0]}</span>
            </>
          )}
        </>
      }
    />
  );
}

function MoneyOutWidget() {
  const list = month.filter((t) => t.direction === "Debit");
  const top = topParty("Debit");
  return (
    <Stat
      figure={
        <span className="amount tabular-nums">
          −$
          <Roll value={usd(list.reduce((s, t) => s + t.amount, 0)).slice(1)} />
        </span>
      }
      line={
        <>
          {list.length} payments out over 30 days
          {top && (
            <>
              {" "}
              · most to <span className="text-neutral-200">{top[0]}</span>
            </>
          )}
        </>
      }
    />
  );
}

function CardsWidget() {
  const spent = monthlySpend.spent;
  const pace = (spent / SPEND_DAY) * MONTH_DAYS;
  const at = (v: number) => `${Math.min(100, (v / PROGRAM_LIMIT) * 100)}%`;
  return (
    <Stat
      figure={<Big value={spent} />}
      line={
        <>
          Spent on cards this month · on pace for{" "}
          <span className="amount text-neutral-200">{compact(pace)}</span> of{" "}
          {compact(PROGRAM_LIMIT)}
        </>
      }
    >
      <div className="flex h-2 gap-[3px]" aria-hidden>
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
    </Stat>
  );
}

function CollectionsWidget() {
  const recent = collections.filter(
    (c) => NOW - new Date(c.createdAt).getTime() <= 30 * DAY,
  );
  const settled = recent.filter((c) => c.status === "Settlement completed");
  const stuck = recent.filter(isStuck).length;
  return (
    <Stat
      figure={
        <>
          <Big value={settled.reduce((s, c) => s + c.subtotal, 0)} />
          <span className="ml-1.5 text-[13px] font-normal tracking-normal text-neutral-500">
            USDC
          </span>
        </>
      }
      line={
        <>
          Settled from cards in 30 days · {settled.length} of {recent.length}{" "}
          payments made it
          {stuck > 0 && `, ${stuck} waiting to settle`}
        </>
      }
    />
  );
}

function LinksWidget() {
  const toUsd = (v: number, c: string) => (c === "NGN" ? v / 1500 : v);
  const rows = links
    .map((l) => ({
      l,
      v: l.payments
        .filter(
          (p) =>
            p.status === "Paid" && NOW - new Date(p.date).getTime() <= 30 * DAY,
        )
        .reduce((s, p) => s + toUsd(p.amount, l.currency), 0),
    }))
    .sort((a, b) => b.v - a.v);
  const total = rows.reduce((s, r) => s + r.v, 0);
  return (
    <Stat
      figure={<Big value={total} />}
      line={
        <>
          Collected by payment links in 30 days · most from{" "}
          <span className="text-neutral-200">{rows[0]?.l.name}</span>
        </>
      }
    />
  );
}

function DeskWidget() {
  const p = PAIRS[0];
  const open = ORDERS.filter(
    (o) => !["Settled", "Cancelled", "Rejected"].includes(o.status),
  ).length;
  return (
    <Stat
      figure={
        <span className="tabular-nums">
          {p.rate.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          <span className="ml-1.5 text-[13px] font-normal tracking-normal text-neutral-500">
            {p.sell} → {p.get}
          </span>
        </span>
      }
      line={
        <>
          <span
            className={
              p.change24h > 0.05
                ? "text-[var(--ok-fg)]"
                : p.change24h < -0.05
                  ? "text-rose-300"
                  : ""
            }
          >
            {p.change24h > 0 ? "+" : ""}
            {p.change24h.toFixed(2)}%
          </span>{" "}
          in 24h · {open} open order{open === 1 ? "" : "s"} on the desk
        </>
      }
    />
  );
}

/* ——— Recent transactions ——— */

function RecentWidget() {
  const rows = [...transactions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7);
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
  const days = oldest
    ? Math.round((ACCOUNTS_AS_OF - new Date(oldest.createdAt).getTime()) / DAY)
    : 0;
  return (
    <Stat
      figure={<Roll value={pending.length.toLocaleString("en-US")} />}
      line={
        <>
          Accounts the banks are still opening
          {oldest && ` · oldest waiting ${days} days at ${oldest.bank}`}
        </>
      }
    />
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
  | "moneyIn"
  | "moneyOut"
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
    /** Sits open on the page — no panel, no inner padding (Balance, like on Accounts). */
    bare?: boolean;
    body: () => React.ReactNode;
  }
> = {
  balance: {
    title: "Balance",
    bare: true,
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
  moneyIn: {
    title: "Money in",
    about: "What came in over 30 days, and from whom",
    href: "/transactions",
    widths: [2, 3, 4, 6],
    body: () => <MoneyInWidget />,
  },
  moneyOut: {
    title: "Money out",
    about: "What went out over 30 days, and to whom",
    href: "/transactions",
    widths: [2, 3, 4, 6],
    body: () => <MoneyOutWidget />,
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

/** Mercury-style: two columns, cards of the same kind side by side so rows come out even. */
export const DEFAULT_LAYOUT: Slot[] = [
  { id: "balance", w: 6 },
  { id: "recent", w: 6 },
  { id: "moneyIn", w: 3 },
  { id: "moneyOut", w: 3 },
  { id: "cards", w: 3 },
  { id: "collections", w: 3 },
  { id: "links", w: 3 },
  { id: "desk", w: 3 },
];
