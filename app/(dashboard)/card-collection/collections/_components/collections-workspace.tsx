"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Download,
  ExternalLink,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { readOpen, writeOpen } from "@/app/_components/bucket-bars";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { RowMenu } from "@/app/(dashboard)/trade-desk/_components/order-extras";
import {
  AS_OF,
  isStuck,
  wasCharged,
  type Collection,
  type CollectionStatus,
} from "../_data";

const DAY = 24 * 60 * 60 * 1000;

type Tab =
  | "All"
  | "Settled"
  | "Settling"
  | "Settlement failed"
  | "Payment failed"
  | "Didn't finish";
const inTab = (c: Collection, t: Tab) =>
  t === "All"
    ? true
    : t === "Settled"
      ? c.status === "Settlement completed" ||
        c.status === "Refunded" ||
        c.status === "Partially refunded"
      : t === "Settling"
        ? c.status === "Settlement pending"
        : t === "Didn't finish"
          ? c.status === "Expired" || c.status === "Abandoned"
          : c.status === t;

type Scope = "Payment ID" | "Reference" | "Customer";
type Range = "7" | "30" | "90" | "all";

export const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
export const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
export const fullFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});
export const usdc = (v: number) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const fiat = (c: Collection["charged"]) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: c.currency,
  }).format(c.amount);
export const flag = (cc: string) =>
  String.fromCodePoint(...[...cc].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
export const short = (s: string, a = 8, b = 4) =>
  s.length <= a + b + 1 ? s : `${s.slice(0, a)}…${b ? s.slice(-b) : ""}`;
const net = (c: Collection) => c.subtotal - (c.refunded ?? 0);

/** USDC with superscript cents, marked so "Hide amounts" can pixelate it. */
export function Usdc({
  value,
  unit = true,
  big = false,
}: {
  value: number;
  unit?: boolean;
  /** Headline figures: quiet cents and a small unit, so the number leads. */
  big?: boolean;
}) {
  const [whole, cents] = usdc(value).split(".");
  return (
    <span className="amount tabular-nums">
      {whole}
      <sup
        className={
          big
            ? "ml-0.5 align-[0.85em] text-[0.42em] font-normal tracking-normal text-neutral-500"
            : "ml-px align-[0.5em] text-[0.62em]"
        }
      >
        .{cents}
      </sup>
      {unit && (
        <span
          className={
            big
              ? "ml-2 text-[13px] font-normal tracking-normal text-neutral-500"
              : "ml-1 text-[0.85em] text-neutral-500"
          }
        >
          USDC
        </span>
      )}
    </span>
  );
}

export function CollectionsWorkspace({ initial }: { initial: Collection[] }) {
  const [list, setList] = useState(initial);
  const [tab, setTab] = useState<Tab>("All");
  const [range, setRange] = useState<Range>("90");
  const [scope, setScope] = useState<Scope>("Payment ID");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [refundId, setRefundId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [period, setPeriod] = useState<30 | 90>(90);
  const [shown, setShown] = useState(50);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (id: string, f: (c: Collection) => Collection) =>
    setList((all) => all.map((c) => (c.id === id ? f(c) : c)));

  // Retry: back to settling, then (prototype) settled a few seconds later.
  const retry = (ids: string[]) => {
    const now = new Date(AS_OF).toISOString();
    ids.forEach((id) =>
      update(id, (c) => ({
        ...c,
        status: "Settlement pending",
        problem: undefined,
        events: [...c.events, { label: "Settlement retried", at: now }],
      })),
    );
    setToast(
      ids.length === 1
        ? "Retrying settlement — usually under a minute"
        : `Retrying ${ids.length} settlements`,
    );
    setTimeout(() => {
      ids.forEach((id) =>
        update(id, (c) => ({
          ...c,
          status: "Settlement completed",
          settlementHash: `0x${c.id.replace(/-/g, "").padEnd(64, "0")}`,
          events: [...c.events, { label: "Settled to USDC", at: now }],
        })),
      );
      setToast(
        ids.length === 1
          ? "Settled — the USDC is in your Treasury wallet"
          : `${ids.length} payments settled to your Treasury wallet`,
      );
    }, 3500);
  };

  const refund = (id: string, amount: number, reason: string) => {
    update(id, (c) => {
      const total = (c.refunded ?? 0) + amount;
      const full = total >= c.subtotal - 0.001;
      return {
        ...c,
        refunded: total,
        status: full ? "Refunded" : "Partially refunded",
        events: [
          ...c.events,
          {
            label: `${full ? "Refunded" : "Partly refunded"} ${usdc(amount)} USDC · ${reason.toLowerCase()}`,
            at: new Date(AS_OF).toISOString(),
          },
        ],
      };
    });
    setRefundId(null);
    setToast("Refund sent — the customer sees it in 5–10 business days");
  };

  // ——— Facts: last 30 days ———
  const last30 = list.filter((c) => Date.parse(c.createdAt) > AS_OF - 30 * DAY);
  const prev30 = list.filter((c) => {
    const t = Date.parse(c.createdAt);
    return t <= AS_OF - 30 * DAY && t > AS_OF - 60 * DAY;
  });
  const settledOf = (xs: Collection[]) => xs.filter((c) => inTab(c, "Settled"));
  const settledNow = settledOf(last30);
  const settledSum = settledNow.reduce((s, c) => s + net(c), 0);
  const settledPrev = settledOf(prev30).reduce((s, c) => s + net(c), 0);
  const fees = settledNow.reduce((s, c) => s + c.fee, 0);
  const change = settledPrev
    ? ((settledSum - settledPrev) / settledPrev) * 100
    : 0;
  const stuck = list.filter(isStuck);
  const stuckSum = stuck.reduce((s, c) => s + c.subtotal, 0);

  // ——— Table ———
  const q = query.trim().toLowerCase();
  const scoped = list
    .filter(
      (c) =>
        range === "all" ||
        Date.parse(c.createdAt) > AS_OF - Number(range) * DAY,
    )
    .filter((c) => {
      if (!q) return true;
      const fields =
        scope === "Payment ID"
          ? [c.id]
          : scope === "Reference"
            ? [c.reference]
            : [c.customer.name, c.customer.email, c.customer.id];
      return fields.some((v) => v.toLowerCase().includes(q));
    });
  const rows = scoped
    .filter((c) => inTab(c, tab))

    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const tabs: Tab[] = [
    "All",
    "Settled",
    ...(scoped.some((c) => inTab(c, "Settling"))
      ? (["Settling"] as const)
      : []),
    "Settlement failed",
    "Payment failed",
    "Didn't finish",
  ];
  const count = (t: Tab) => scoped.filter((c) => inTab(c, t)).length;
  const allChecked = rows.length > 0 && rows.every((c) => checked.has(c.id));
  const picked = list.filter((c) => checked.has(c.id));
  const pickedStuck = picked.filter(isStuck);

  const menu = (c: Collection) => [
    { label: "View all details", run: () => setSheetId(c.id) },
    ...(isStuck(c)
      ? [{ label: "Retry settlement", run: () => retry([c.id]) }]
      : []),
    ...(canRefund(c)
      ? [{ label: "Refund…", run: () => setRefundId(c.id) }]
      : []),
    {
      label: "Copy payment ID",
      run: () => {
        navigator.clipboard?.writeText(c.id).catch(() => {});
        setToast("Payment ID copied");
      },
    },
    {
      label: "Copy reference",
      run: () => {
        navigator.clipboard?.writeText(c.reference).catch(() => {});
        setToast("Reference copied");
      },
    },
  ];

  const sheet = list.find((c) => c.id === sheetId) ?? null;
  const refunding = list.find((c) => c.id === refundId) ?? null;

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-28">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Collections
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Card payments from your customers, settled to you in USDC. Times
              are in your local time.
            </p>
          </div>
          <Link
            href="/manage/configure"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-[13px] text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
          >
            API keys
            <ArrowRight size={13} strokeWidth={1.75} />
          </Link>
        </div>

        {/* Three facts: what arrived, what it cost, what's stuck */}
        <div className="mt-10 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Settled · 30 days"
            value={<Usdc value={settledSum} big />}
            aside={
              settledPrev ? (
                <span
                  className={
                    change >= 0 ? "text-[var(--flow-in)]" : "text-neutral-400"
                  }
                >
                  {change >= 0 ? "+" : "−"}
                  {Math.abs(change).toFixed(0)}%
                </span>
              ) : null
            }
            footer={
              <span className="tabular-nums">
                {settledNow.length}{" "}
                {settledNow.length === 1 ? "payment" : "payments"}
              </span>
            }
          />
          <Fact
            label="Card fees · 30 days"
            value={<Usdc value={fees} big />}
            aside={
              <span className="text-neutral-400 tabular-nums">
                {settledSum + fees
                  ? `${((fees / (settledSum + fees)) * 100).toFixed(1)}% effective`
                  : "—"}
              </span>
            }
            footer={<span>2.9% + 0.30 on each card payment that settles</span>}
          />
          <Fact
            label="Charged, not settled"
            value={stuck.length ? <Usdc value={stuckSum} big /> : "None"}
            aside={
              stuck.length ? (
                <span className="text-rose-300 tabular-nums">
                  {stuck.length} {stuck.length === 1 ? "payment" : "payments"}
                </span>
              ) : null
            }
            footer={
              stuck.length ? (
                <>
                  <span className="truncate">
                    Customers paid; Gravv is holding it
                  </span>
                  <button
                    type="button"
                    onClick={() => retry(stuck.map((c) => c.id))}
                    className="flex shrink-0 items-center gap-1 text-neutral-200 transition-colors hover:text-white"
                  >
                    <RotateCcw size={12} strokeWidth={1.75} />
                    Retry all
                  </button>
                </>
              ) : (
                <span>Everything charged has reached your wallet</span>
              )
            }
          />
        </div>

        <Funnel
          list={list}
          period={period}
          onPeriod={setPeriod}
          onOpen={(t) => {
            setTab(t);
            setRange(String(period) as Range);
            document
              .getElementById("collections-table")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />

        {/* Tabs + tools */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex flex-wrap items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                  tab === t
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                }`}
              >
                {t}
                <span
                  className={`text-xs tabular-nums ${tab === t ? "text-neutral-400" : "text-neutral-600"}`}
                >
                  {count(t)}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Date"
              value={range}
              active={range !== "90"}
              align="right"
              options={[
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "all", label: "All time" },
              ]}
              onChange={setRange}
            />
            <div className="flex h-9 w-[290px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] transition-colors focus-within:border-white/35 focus-within:bg-transparent hover:border-white/20">
              <Dropdown
                label="Search by"
                variant="bare"
                value={scope}
                options={(["Payment ID", "Reference", "Customer"] as const).map(
                  (s) => ({ value: s, label: s }),
                )}
                onChange={setScope}
                className="shrink-0 border-r border-white/10"
              />
              <Search
                size={14}
                strokeWidth={1.75}
                className="ml-3 shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Enter ${scope.toLowerCase()}…`}
                aria-label={`Search by ${scope}`}
                className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                exportCsv(rows);
                setToast(`${rows.length} payments exported`);
              }}
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={14} strokeWidth={1.75} />
              Export
            </button>
          </div>
        </div>

        <table
          id="collections-table"
          className="mt-3 w-full scroll-mt-6 table-fixed border-t border-white/15 text-[13px]"
        >
          <colgroup>
            <col className="w-11" />
            <col />
            <col className="w-[170px]" />
            <col className="w-[230px]" />
            <col className="w-[140px]" />
            <col className="w-[180px]" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="bg-white/[0.025] text-left text-[12px] font-medium text-neutral-400">
              <th className="py-3 pl-3 font-medium">
                <Check
                  on={allChecked}
                  label="Select all"
                  onChange={() =>
                    setChecked(
                      allChecked ? new Set() : new Set(rows.map((c) => c.id)),
                    )
                  }
                />
              </th>
              <th className="py-3 font-medium">Customer</th>
              <th className="py-3 pr-10 text-right font-medium">Amount</th>
              <th className="py-3 font-medium">Status</th>
              <th className="py-3 font-medium">Date</th>
              <th className="py-3 font-medium">Payment ID</th>
              <th className="py-3 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((c) => {
              const open = openId === c.id;
              const muted = !wasCharged(c);
              const why = reasonOf(c);
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : c.id)}
                    className={`group cursor-pointer border-t border-white/6 transition-colors ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
                  >
                    <td
                      className="py-4 pl-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Check
                        on={checked.has(c.id)}
                        label={`Select ${c.id}`}
                        onChange={() =>
                          setChecked((s) => {
                            const n = new Set(s);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="py-4 pr-6">
                      <div className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-white">
                        {c.customer.name}
                      </div>
                      <div className="mt-1 truncate text-[12px] text-neutral-500">
                        {c.card.brand} ••{c.card.last4}{" "}
                        <span aria-label={c.card.country}>
                          {flag(c.card.country)}
                        </span>
                        <span className="text-neutral-600">
                          {" "}
                          ·{" "}
                          {c.source.kind === "Payment link"
                            ? c.source.name
                            : "API"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 pr-10 text-right">
                      <div
                        className={
                          muted
                            ? "text-neutral-500"
                            : c.status === "Refunded"
                              ? "text-neutral-500 line-through decoration-neutral-600"
                              : "font-medium text-white"
                        }
                      >
                        <Usdc value={c.subtotal} />
                      </div>
                      <div className="amount mt-1 text-[12px] text-neutral-500 tabular-nums">
                        {muted ? "Not charged" : `${fiat(c.charged)} charged`}
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <Status status={c.status} />
                      {why && (
                        <div
                          className={`mt-1.5 truncate text-[12px] ${why.bad ? "text-rose-300" : "text-neutral-500"}`}
                        >
                          {why.text}
                        </div>
                      )}
                    </td>
                    <td className="py-4 tabular-nums">
                      <div className="text-neutral-400">
                        {dayFmt.format(new Date(c.createdAt))}
                      </div>
                      <div className="mt-1 text-[12px] text-neutral-500">
                        {timeFmt.format(new Date(c.createdAt))}
                      </div>
                    </td>
                    <td className="py-4 pr-2">
                      <span className="flex min-w-0 items-center gap-0.5">
                        <span
                          title={c.id}
                          className="truncate font-mono text-[12px] text-neutral-400"
                        >
                          {short(c.id, 13, 0)}
                        </span>
                        <span
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <CopyButton value={c.id} label="Copy payment ID" />
                        </span>
                      </span>
                    </td>
                    <td className="py-4 pr-2 text-right">
                      <RowMenu items={menu(c)} label="Payment actions" />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-white/[0.04]">
                      <td colSpan={7} className="px-3 pb-4">
                        <Preview
                          c={c}
                          onClose={() => setOpenId(null)}
                          onViewAll={() => setSheetId(c.id)}
                          onRetry={() => retry([c.id])}
                          onRefund={() => setRefundId(c.id)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  {tab === "Settlement failed"
                    ? "Nothing stuck — every charged payment has settled."
                    : "No payments match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-white/6 pt-4 text-[13px] text-neutral-500 tabular-nums">
          <span>
            {rows.length > shown
              ? `Showing ${shown} of ${rows.length} payments`
              : `${rows.length} ${rows.length === 1 ? "payment" : "payments"}`}
          </span>
          {rows.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + 50)}
              className="h-8 rounded-full border border-white/12 px-3.5 text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              Show {Math.min(50, rows.length - shown)} more
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions */}
      {checked.size > 0 && (
        <div className="orbit-pop fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-[0_20px_50px_-12px_rgb(0_0_0/0.7)] ring-1 ring-white/12">
          <span className="mr-2 tabular-nums">{checked.size} selected</span>
          {pickedStuck.length > 0 && (
            <button
              type="button"
              onClick={() => {
                retry(pickedStuck.map((c) => c.id));
                setChecked(new Set());
              }}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 hover:bg-white/10"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
              Retry settlement
              {pickedStuck.length < checked.size && ` (${pickedStuck.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              exportCsv(picked);
              setToast(`${picked.length} payments exported`);
            }}
            className="flex h-8 items-center gap-1.5 rounded-full px-3 hover:bg-white/10"
          >
            <Download size={13} strokeWidth={1.75} />
            Export
          </button>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setChecked(new Set())}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/10 hover:text-white"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {sheet && (
        <DetailsSheet
          c={sheet}
          onClose={() => setSheetId(null)}
          onRetry={() => retry([sheet.id])}
          onRefund={() => setRefundId(sheet.id)}
        />
      )}

      {refunding && (
        <RefundDialog
          c={refunding}
          onClose={() => setRefundId(null)}
          onRefund={(amount, reason) => refund(refunding.id, amount, reason)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const CHART_KEY = "gravv-collections-funnel";

/**
 * Where payments drop off, in order: checkout → checks → the bank → settlement. Each gap says
 * how many were lost there and why, and opens those payments. Numbers carry it, not shapes.
 */
function Funnel({
  list,
  period,
  onPeriod,
  onOpen,
}: {
  list: Collection[];
  period: 30 | 90;
  onPeriod: (p: 30 | 90) => void;
  onOpen: (t: Tab) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(readOpen(CHART_KEY)), 0);
    return () => clearTimeout(t);
  }, []);
  const xs = list.filter((c) => Date.parse(c.createdAt) > AS_OF - period * DAY);
  const expired = xs.filter((c) => c.status === "Expired").length;
  const closed = xs.filter((c) => c.status === "Abandoned").length;
  const atCheckout = xs.filter((c) => !inTab(c, "Didn't finish"));
  const blocked = atCheckout.filter(
    (c) =>
      c.status === "Payment failed" &&
      (c.protection === "Declined" || c.threeDS === "Failed"),
  );
  const passed = atCheckout.filter((c) => !blocked.includes(c));
  const bank = passed.filter((c) => c.status === "Payment failed");
  const charged = passed.filter(wasCharged);
  const notSettled = charged.filter(
    (c) =>
      c.status === "Settlement failed" || c.status === "Settlement pending",
  );
  const settled = charged.filter((c) => inTab(c, "Settled"));
  const settledUsdc = settled.reduce((s, c) => s + net(c), 0);
  const pct = (n: number) =>
    xs.length ? `${Math.round((n / xs.length) * 100)}%` : "—";

  const steps = [
    { label: "Started", n: xs.length, note: "Checkouts opened" },
    { label: "Paid at checkout", n: atCheckout.length, note: "Entered a card" },
    {
      label: "Passed checks",
      n: passed.length,
      note: "Protection and 3-D Secure",
    },
    { label: "Charged", n: charged.length, note: "The bank approved it" },
    {
      label: "Settled",
      n: settled.length,
      note: (
        <>
          <span className="amount text-neutral-300">{usdc(settledUsdc)}</span>{" "}
          USDC in your wallet
        </>
      ),
    },
  ];
  const drops: { n: number; words: string; tab: Tab; urgent?: boolean }[] = [
    {
      n: atCheckout.length - xs.length,
      words: `left the checkout${expired && closed ? ` · ${expired} timed out, ${closed} closed it` : ""}`,
      tab: "Didn't finish",
    },
    {
      n: -blocked.length,
      words: "blocked by Protection or 3-D Secure",
      tab: "Payment failed",
    },
    { n: -bank.length, words: "declined by their bank", tab: "Payment failed" },
    {
      n: -notSettled.length,
      words: "charged, not settled yet",
      tab: notSettled.some((c) => c.status === "Settlement failed")
        ? "Settlement failed"
        : "Settling",
      urgent: notSettled.some((c) => c.status === "Settlement failed"),
    },
  ];

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
          Where payments drop off
        </h2>
        <span className="text-xs text-neutral-500">
          {pct(settled.length)} of payments started in the last {period} days
          reached your wallet
        </span>
        <div className="ml-auto flex items-center gap-2">
          {open && (
            <div
              role="radiogroup"
              aria-label="Period"
              className="flex rounded-full bg-white/[0.07] p-0.5"
            >
              {([30, 90] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => onPeriod(p)}
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
          )}
          <button
            type="button"
            onClick={() => {
              writeOpen(CHART_KEY, !open);
              setOpen(!open);
            }}
            aria-expanded={open}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {open ? "Hide" : "Show"}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="orbit-pop mt-6 grid grid-cols-5 border-y border-white/8">
          {steps.map((st, i) => {
            const last = i === steps.length - 1;
            const drop = drops[i - 1];
            return (
              <div
                key={st.label}
                className={`flex min-w-0 flex-col py-5 ${i ? "border-l border-white/8 pl-5" : ""} pr-5`}
              >
                <div className="text-[12px] text-neutral-500">{st.label}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`text-[28px] leading-none font-medium tracking-[-0.03em] tabular-nums ${last ? "text-[var(--flow-in)]" : "text-white"}`}
                  >
                    <Roll value={String(st.n)} />
                  </span>
                  {i > 0 && (
                    <span className="text-[12px] text-neutral-500 tabular-nums">
                      {pct(st.n)}
                    </span>
                  )}
                </div>
                {/* Share of everything started still in at this step */}
                <div className="mt-3 h-[3px] rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${last ? "bg-[var(--flow-in)]" : "bg-white/45"}`}
                    style={{
                      width: xs.length ? `${(st.n / xs.length) * 100}%` : 0,
                    }}
                  />
                </div>
                <div className="mt-2 truncate text-[12px] text-neutral-500">
                  {st.note}
                </div>
                <div className="mt-auto pt-4">
                  {drop ? (
                    drop.n ? (
                      <button
                        type="button"
                        onClick={() => onOpen(drop.tab)}
                        className={`text-left text-[12px] leading-snug transition-colors hover:text-white ${drop.urgent ? "text-rose-300" : "text-neutral-400"}`}
                      >
                        <span className="tabular-nums">
                          −{Math.abs(drop.n)}
                        </span>{" "}
                        {drop.words}
                      </button>
                    ) : (
                      <span className="text-[12px] text-neutral-600">
                        None lost here
                      </span>
                    )
                  ) : (
                    <span className="text-[12px] text-neutral-600">&nbsp;</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** One short line under the status, only when it adds something. */
function reasonOf(c: Collection): { text: string; bad?: boolean } | null {
  if (c.status === "Payment failed")
    return {
      bad: true,
      text:
        c.protection === "Declined"
          ? "Blocked by Protection"
          : c.threeDS === "Failed"
            ? "3-D Secure failed"
            : "Declined by the bank",
    };
  if (c.status === "Settlement failed")
    return { bad: true, text: "Charged · Gravv is holding it" };
  if (c.status === "Partially refunded" && c.refunded)
    return { text: `${usdc(c.refunded)} USDC refunded` };
  if (c.disputed) return { bad: true, text: "Disputed" };
  return null;
}

const canRefund = (c: Collection) =>
  c.status === "Settlement completed" || c.status === "Partially refunded";

function Fact({
  label,
  value,
  aside,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  aside?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col border-white/8 lg:px-8 lg:first:pl-0 lg:last:pr-0 lg:[&:not(:first-child)]:border-l">
      <div className="text-[13px] text-neutral-500">{label}</div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-[34px] leading-none font-medium tracking-[-0.035em] text-white tabular-nums">
          {value}
        </span>
        {aside && (
          <span className="text-[13px] whitespace-nowrap">{aside}</span>
        )}
      </div>
      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 text-xs text-neutral-500">
        {footer}
      </div>
    </div>
  );
}

export function Check({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[5px] border transition-colors ${
        on
          ? "border-white bg-white text-black"
          : "border-white/20 hover:border-white/45"
      }`}
    >
      {on && (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <path
            d="M2.5 6.2 5 8.5l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

/** Status as words, same chip box for every state. Rose only where money or a sale was lost. */
function Status({ status }: { status: CollectionStatus }) {
  const tone =
    status === "Settlement completed"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : status === "Settlement pending"
        ? "border-dashed border-white/20 text-neutral-300"
        : status === "Settlement failed" || status === "Payment failed"
          ? "border-transparent bg-rose-400/10 text-rose-300"
          : status === "Refunded" || status === "Partially refunded"
            ? "border-transparent bg-white/[0.06] text-neutral-300"
            : "border-white/10 text-neutral-400";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap ${tone}`}
    >
      {status}
    </span>
  );
}

type Stage = { label: string; state: string; tone: "ok" | "bad" | "idle" };

/** The payment's path in words: checkout → checks → charge → settlement. The failing step is the one in rose. */
function stagesOf(c: Collection): Stage[] {
  const charged = wasCharged(c);
  const unfinished = c.status === "Expired" || c.status === "Abandoned";
  const bankDeclined =
    c.status === "Payment failed" &&
    c.protection !== "Declined" &&
    c.threeDS !== "Failed";
  return [
    {
      label: "Checkout",
      state: unfinished
        ? c.status === "Expired"
          ? "Expired"
          : "Closed"
        : "Card entered",
      tone: unfinished ? "bad" : "ok",
    },
    {
      label: "Protection",
      state: unfinished
        ? "—"
        : c.protection === "Declined"
          ? `Declined · risk ${c.riskScore}`
          : c.protection === "Review"
            ? `Reviewed · risk ${c.riskScore}`
            : `Approved · risk ${c.riskScore}`,
      tone: unfinished ? "idle" : c.protection === "Declined" ? "bad" : "ok",
    },
    {
      label: "3-D Secure",
      state:
        unfinished || c.protection === "Declined"
          ? "—"
          : c.threeDS === "Not required"
            ? "Not required"
            : c.threeDS === "Failed"
              ? "Failed"
              : `${c.threeDS} · passed`,
      tone:
        unfinished || c.protection === "Declined"
          ? "idle"
          : c.threeDS === "Failed"
            ? "bad"
            : "ok",
    },
    {
      label: "Card charge",
      state: charged
        ? fiat(c.charged)
        : bankDeclined
          ? "Declined by bank"
          : "Not charged",
      tone: charged ? "ok" : bankDeclined ? "bad" : "idle",
    },
    {
      label: "Settlement",
      state: !charged
        ? "—"
        : c.status === "Settlement failed"
          ? "Failed"
          : c.status === "Settlement pending"
            ? "Settling…"
            : `${usdc(c.subtotal - c.fee)} USDC`,
      tone: !charged
        ? "idle"
        : c.status === "Settlement failed"
          ? "bad"
          : c.status === "Settlement pending"
            ? "idle"
            : "ok",
    },
  ];
}

function Path({ c }: { c: Collection }) {
  const stages = stagesOf(c);
  return (
    <ol className="grid grid-cols-5 gap-2">
      {stages.map((s, i) => (
        <li key={s.label} className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-neutral-500">{s.label}</div>
            <div
              className={`mt-1 truncate text-[13px] tabular-nums ${
                s.tone === "bad"
                  ? "text-rose-300"
                  : s.tone === "idle"
                    ? "text-neutral-600"
                    : "text-neutral-100"
              }`}
            >
              <span
                className={
                  s.label === "Settlement" || s.label === "Card charge"
                    ? "amount"
                    : ""
                }
              >
                {s.state}
              </span>
            </div>
          </div>
          {i < stages.length - 1 && (
            <ArrowRight
              size={13}
              strokeWidth={1.75}
              className="mt-[18px] shrink-0 text-neutral-700"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

function Preview({
  c,
  onClose,
  onViewAll,
  onRetry,
  onRefund,
}: {
  c: Collection;
  onClose: () => void;
  onViewAll: () => void;
  onRetry: () => void;
  onRefund: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="orbit-pop cursor-default rounded-xl border border-white/8 bg-surface"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 py-4">
        <Path c={c} />
      </div>
      {c.problem && (
        <div className="border-t border-white/6 px-5 py-3 text-[13px] leading-relaxed whitespace-normal">
          <span className={isStuck(c) ? "text-rose-300" : "text-neutral-300"}>
            {isStuck(c)
              ? "Charged, not settled. "
              : c.status === "Payment failed"
                ? "Why it failed. "
                : "Didn't finish. "}
          </span>
          <span className="text-neutral-400">{c.problem}</span>
        </div>
      )}
      {c.disputed && (
        <div className="border-t border-white/6 px-5 py-3 text-[13px] text-neutral-300">
          The customer has disputed this payment with their bank.{" "}
          <Link
            href="/card-collection/disputes"
            className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
          >
            Respond in Disputes
          </Link>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-2.5">
        <span className="truncate text-[12px] text-neutral-500 tabular-nums">
          {wasCharged(c) ? (
            <>
              Fee <span className="amount">{usdc(c.fee)}</span> · you get{" "}
              <span className="amount text-neutral-300">
                {usdc(c.subtotal - c.fee)} USDC
              </span>{" "}
              in {c.settledTo}
              {c.refunded ? (
                <>
                  {" "}
                  · <span className="amount">{usdc(c.refunded)}</span> refunded
                </>
              ) : null}
            </>
          ) : (
            `${c.card.brand} ${c.card.funding.toLowerCase()} ••${c.card.last4} · ${c.card.issuer}`
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {isStuck(c) && (
            <button
              type="button"
              onClick={onRetry}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
            >
              <RotateCcw size={13} strokeWidth={1.75} />
              Retry settlement
            </button>
          )}
          {canRefund(c) && (
            <button
              type="button"
              onClick={onRefund}
              className="h-8 rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Refund
            </button>
          )}
          <button
            type="button"
            onClick={onViewAll}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/12 pr-2.5 pl-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            View all details
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailsSheet({
  c,
  onClose,
  onRetry,
  onRefund,
}: {
  c: Collection;
  onClose: () => void;
  onRetry: () => void;
  onRefund: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[data-refund-dialog]")) return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const charged = wasCharged(c);
  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Payment details"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[460px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">
              Card payment ·{" "}
              {c.source.kind === "Payment link" ? c.source.name : "API"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <span className="text-[28px] leading-none font-medium tracking-[-0.03em] text-white">
                <Usdc value={c.subtotal} unit={false} />
              </span>
              <span className="text-[13px] text-neutral-500">USDC</span>
              <span className="ml-1">
                <Status status={c.status} />
              </span>
            </div>
            <div className="mt-3 text-[13px] text-neutral-300">
              {c.customer.name}{" "}
              <span className="text-neutral-500">
                · {c.card.brand} ••{c.card.last4} {flag(c.card.country)}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close details"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {c.problem && (
          <div
            className={`border-b border-white/8 px-6 py-3 text-[13px] leading-relaxed ${isStuck(c) || c.status === "Payment failed" ? "bg-rose-400/[0.06] text-rose-200" : "text-neutral-300"}`}
          >
            {c.problem}
          </div>
        )}
        {(isStuck(c) || canRefund(c)) && (
          <div className="flex items-center gap-2 border-b border-white/8 px-6 py-3">
            {isStuck(c) && (
              <button
                type="button"
                onClick={onRetry}
                className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                Retry settlement
              </button>
            )}
            {canRefund(c) && (
              <button
                type="button"
                onClick={onRefund}
                className="h-8 rounded-full border border-white/12 px-3.5 text-[13px] text-neutral-200 hover:border-white/30"
              >
                Refund…
              </button>
            )}
          </div>
        )}

        <div className="grid gap-y-6 px-6 py-5">
          <Group title="Money">
            <Field
              label="Charged"
              value={charged ? fiat(c.charged) : "Not charged"}
              amount
            />
            <Field label="Subtotal" value={`${usdc(c.subtotal)} USDC`} amount />
            {charged && (
              <>
                <Field
                  label="Fee · 2.9% + 0.30"
                  value={`−${usdc(c.fee)} USDC`}
                  amount
                />
                {c.refunded ? (
                  <Field
                    label="Refunded"
                    value={`−${usdc(c.refunded)} USDC`}
                    amount
                  />
                ) : null}
                <Field
                  label="You get"
                  value={`${usdc(c.subtotal - c.fee - (c.refunded ?? 0))} USDC`}
                  strong
                  amount
                />
                <Field label="Settles to" value={c.settledTo} />
              </>
            )}
          </Group>

          <Group title="Checks">
            <Field
              label="Protection"
              value={`${c.protection === "Review" ? "Reviewed, then approved" : c.protection} · risk ${c.riskScore} of 100`}
              tone={c.protection === "Declined" ? "danger" : undefined}
            />
            <Field
              label="3-D Secure"
              value={
                c.threeDS === "Not required"
                  ? "Not required"
                  : c.threeDS === "Failed"
                    ? "Failed"
                    : `${c.threeDS} · passed`
              }
              tone={c.threeDS === "Failed" ? "danger" : undefined}
            />
            <Field
              label="CVC"
              value={c.cvc}
              tone={c.cvc === "Failed" ? "danger" : undefined}
            />
          </Group>

          <Group title="Card">
            <Field label="Card" value={`${c.card.brand} ••${c.card.last4}`} />
            <Field label="Type" value={c.card.funding} />
            <Field label="Issuer" value={c.card.issuer} />
            <Field
              label="Country"
              value={`${flag(c.card.country)} ${new Intl.DisplayNames(["en"], { type: "region" }).of(c.card.country)}`}
            />
          </Group>

          <Group title="Customer">
            <Field label="Name" value={c.customer.name} />
            <Field label="Email" value={c.customer.email} copy />
            <Field label="Customer ID" value={c.customer.id} mono copy />
          </Group>

          <Group title="Timeline">
            {c.events.map((e, i) => (
              <Field
                key={`${e.label}-${i}`}
                label={e.label}
                value={
                  timeFmt.format(new Date(e.at)) +
                  ", " +
                  dayFmt.format(new Date(e.at))
                }
                tone={e.tone}
              />
            ))}
          </Group>
        </div>

        <div className="grid border-t border-white/8 px-6 py-4">
          <Field
            label="Payment ID"
            value={c.id}
            display={short(c.id, 13, 6)}
            mono
            copy
          />
          <Field
            label="Reference"
            value={c.reference}
            display={short(c.reference, 13, 6)}
            mono
            copy
          />
          {c.settlementHash ? (
            <Field
              label="Settlement hash"
              value={c.settlementHash}
              display={short(c.settlementHash, 10, 8)}
              mono
              copy
              href={`https://polygonscan.com/tx/${c.settlementHash}`}
            />
          ) : null}
          <Field
            label="Created"
            value={fullFmt.format(new Date(c.createdAt))}
          />
          {c.disputed && (
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-[12px] text-neutral-500">Dispute</span>
              <Link
                href="/card-collection/disputes"
                className="text-[13px] text-white underline decoration-white/30 underline-offset-2"
              >
                Open in Disputes
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs text-neutral-500">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

export function Field({
  label,
  value,
  display,
  mono = false,
  copy = false,
  strong = false,
  amount = false,
  tone,
  href,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
  copy?: boolean;
  strong?: boolean;
  amount?: boolean;
  tone?: "danger";
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 py-2 last:border-0">
      <span className="shrink-0 text-[12px] text-neutral-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span
          title={value}
          className={`truncate tabular-nums ${amount ? "amount" : ""} ${
            mono
              ? "font-mono text-[12px] text-neutral-300"
              : tone === "danger"
                ? "text-[13px] text-rose-300"
                : strong
                  ? "text-[13px] font-medium text-white"
                  : "text-[13px] text-neutral-100"
          }`}
        >
          {display ?? value}
        </span>
        {copy && (
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in explorer"
            className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <ExternalLink size={12} strokeWidth={1.75} />
          </a>
        )}
      </span>
    </div>
  );
}

const REASONS = [
  "Requested by customer",
  "Duplicate payment",
  "Fraudulent",
  "Other",
] as const;

/** Full or partial refund back to the card. Asks before throwing away a typed amount or note. */
function RefundDialog({
  c,
  onClose,
  onRefund,
}: {
  c: Collection;
  onClose: () => void;
  onRefund: (amount: number, reason: string) => void;
}) {
  const left = c.subtotal - (c.refunded ?? 0);
  const [amount, setAmount] = useState(usdc(left).replace(/,/g, ""));
  const [reason, setReason] = useState<(typeof REASONS)[number]>(REASONS[0]);
  const [note, setNote] = useState("");
  const guard = useDiscardGuard(onClose);
  const value = Number(amount.replace(/,/g, "")) || 0;
  const valid = value > 0 && value <= left + 0.001;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guard.asking) return;
      e.stopImmediatePropagation();
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [guard]);

  return (
    <div className="fixed inset-0 z-50" data-refund-dialog>
      <div
        aria-hidden
        onClick={guard.requestClose}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        className="orbit-pop absolute top-[16vh] left-1/2 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        {guard.asking && (
          <DiscardConfirm
            title="Discard this refund?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
          />
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            guard.clear();
            onRefund(value, reason);
          }}
          className="p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="refund-title"
                className="text-[17px] font-medium text-white"
              >
                Refund {c.customer.name}
              </h2>
              <p className="mt-1 text-[13px] text-neutral-400">
                Back to {c.card.brand} ••{c.card.last4}. They&apos;ll see it in
                5–10 business days.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={guard.requestClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          <label className="mt-6 block text-[12px] text-neutral-400">
            Amount
            <div className="mt-1.5 flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 focus-within:border-white/35">
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value.replace(/[^\d.]/g, ""))
                }
                className="amount min-w-0 flex-1 bg-transparent text-[14px] text-white tabular-nums outline-none"
              />
              <span className="text-[13px] text-neutral-500">USDC</span>
            </div>
          </label>
          <div className="mt-1.5 flex items-center justify-between text-[12px] text-neutral-500">
            <span className={valid || !amount ? "" : "text-rose-300"}>
              {value > left + 0.001
                ? `You can refund up to ${usdc(left)} USDC`
                : `Up to ${usdc(left)} USDC${c.refunded ? ` (${usdc(c.refunded)} already refunded)` : ""}`}
            </span>
            {value !== left && (
              <button
                type="button"
                onClick={() => setAmount(usdc(left).replace(/,/g, ""))}
                className="text-neutral-300 hover:text-white"
              >
                Refund all
              </button>
            )}
          </div>

          <div className="mt-5 text-[12px] text-neutral-400">Reason</div>
          <div className="mt-1.5">
            <Dropdown
              label="Reason"
              value={reason}
              options={REASONS.map((r) => ({ value: r, label: r }))}
              onChange={setReason}
              className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
            />
          </div>

          <label className="mt-5 block text-[12px] text-neutral-400">
            Note{" "}
            <span className="text-neutral-600">(only your team sees this)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none focus:border-white/35"
            />
          </label>

          <p className="mt-5 text-[12px] leading-relaxed text-neutral-500">
            The USDC comes out of your Treasury wallet. Gravv&apos;s fee on the
            original payment isn&apos;t returned.
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={guard.requestClose}
              className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="amount h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
            >
              Refund {usdc(value)} USDC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function exportCsv(rows: Collection[]) {
  const head = [
    "Date",
    "Payment ID",
    "Reference",
    "Customer",
    "Email",
    "Card",
    "Charged",
    "Subtotal (USDC)",
    "Fee (USDC)",
    "Status",
    "Protection",
    "3D Secure",
  ];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    head,
    ...rows.map((c) => [
      c.createdAt,
      c.id,
      c.reference,
      c.customer.name,
      c.customer.email,
      `${c.card.brand} ${c.card.last4}`,
      wasCharged(c) ? `${c.charged.amount} ${c.charged.currency}` : "",
      c.subtotal,
      wasCharged(c) ? c.fee : 0,
      c.status,
      c.protection,
      c.threeDS,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "gravv-collections.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
