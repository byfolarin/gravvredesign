"use client";

import { CurrencyFlag } from "@/app/_components/currency-flag";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Download, FileText, X } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { AS_OF, PROVISION_STEPS, accountMeta, type Account } from "../_data";
import { NAMES, SYMBOL } from "./currency";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function ago(iso: string) {
  const m = Math.max(1, Math.round((AS_OF - Date.parse(iso)) / 60_000));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const short = (v: string) => `${v.slice(0, 8)}…${v.slice(-6)}`;
const DAY = 86_400_000;
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

/** Seeded from the account id, so the same account always shows the same history. */
function seeded(id: string) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h =
      (Math.imul(h ^ (h >>> 15), 2246822507) ^
        Math.imul(h ^ (h >>> 13), 3266489909)) >>>
      0;
    return (h % 10000) / 10000;
  };
}

const PAYERS = [
  "Northwind Logistics",
  "Meridian Trade Co",
  "Atlas Relief Foundation",
  "Kite & Kettle Ltd",
  "Brightpath Studio",
  "Lumen Labs Inc",
];
const PAYEES = [
  "Payout to wallet",
  "Supplier payment",
  "Card funding",
  "Payroll run",
];

type Move = {
  id: string;
  at: number;
  who: string;
  how: string;
  amount: number;
};

/** The account's recent money in and out, and its 30-day balance path ending at today's. */
function historyOf(a: Account) {
  const r = seeded(a.id);
  const rails =
    a.currency === "USD"
      ? ["ACH", "Wire"]
      : a.currency === "EUR"
        ? ["SEPA", "SEPA Instant"]
        : a.currency === "GBP"
          ? ["Faster Payments"]
          : ["Bank transfer"];
  const typical = Math.max(a.balance * 0.08, 50);
  const moves: Move[] = Array.from({ length: 6 }, (_, i) => {
    const inbound = r() < 0.65;
    return {
      id: `${a.id.slice(0, 4)}${i}`,
      at: AS_OF - (i * 2.3 + r() * 2) * DAY,
      who: inbound
        ? PAYERS[Math.floor(r() * PAYERS.length)]
        : PAYEES[Math.floor(r() * PAYEES.length)],
      how: rails[Math.floor(r() * rails.length)],
      amount:
        ((inbound ? 1 : -1) * Math.round(typical * (0.4 + r() * 1.6) * 100)) /
        100,
    };
  });
  const trend: number[] = [];
  let v = a.balance;
  for (let d = 0; d < 30; d++) {
    trend.unshift(v);
    v = Math.max(0, v - (r() - 0.42) * typical * 0.9);
  }
  return { moves, trend };
}

/** A printable letter confirming the account: opens in a new tab, ready to print or save as PDF. */
function openLetter(a: Account, numberLabel: string) {
  const today = new Date(AS_OF).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const html = `<!doctype html><meta charset="utf-8"><title>Proof of account — ${a.label}</title>
<style>body{font:15px/1.6 -apple-system,Helvetica,Arial,sans-serif;color:#111;max-width:620px;margin:64px auto;padding:0 24px}
h1{font-size:20px;font-weight:600;margin:0 0 4px}.muted{color:#666}table{border-collapse:collapse;width:100%;margin:24px 0}
td{padding:8px 0;border-bottom:1px solid #eee}td:first-child{color:#666;width:44%}.sign{margin-top:48px}</style>
<p class="muted">${today}</p><h1>Proof of account</h1><p class="muted">Issued by Kredete through Gravv</p>
<p>This letter confirms that the account below is held in the name of <b>${a.customer.name}</b> and is open to receive payments.</p>
<table><tr><td>Account holder</td><td>${a.customer.name}</td></tr><tr><td>Bank</td><td>${a.bank}</td></tr>
<tr><td>${numberLabel}</td><td>${a.accountNumber}</td></tr><tr><td>${a.routing.label}</td><td>${a.routing.value}</td></tr>
<tr><td>Currency</td><td>${NAMES[a.currency]} (${a.currency})</td></tr><tr><td>Opened</td><td>${dateFmt.format(new Date(a.createdAt))}</td></tr></table>
<p class="sign">Kredete Operations<br><span class="muted">Reference ${a.id}</span></p>
<script>setTimeout(()=>print(),300)</script>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A month's statement as CSV: opening and closing balance and every movement. */
function downloadStatement(a: Account, month: Date, moves: Move[]) {
  const rows = [
    ["Date", "Description", "Method", "Amount", "Currency"],
    ...moves.map((m) => [
      new Date(m.at).toISOString().slice(0, 10),
      m.who,
      m.how,
      m.amount.toFixed(2),
      a.currency,
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${a.label.replace(/[^a-z0-9]+/gi, "-")}-${month.toISOString().slice(0, 7)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const money = (c: Account["currency"], v: number) =>
  `${SYMBOL[c]}${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Everything about one account: what it holds and whether that number is fresh, how to
 * pay into it, what it is, and the references support will ask for.
 */
export function AccountSheet({
  account: a,
  chip,
  balance,
  onClose,
}: {
  account: Account;
  /** The status chip, as the table shows it. */
  chip: React.ReactNode;
  /** The balance, formatted the way the table formats money. */
  balance: React.ReactNode;
  onClose: () => void;
}) {
  const meta = accountMeta(a);
  const pending = a.status === "Pending";
  const sync = meta.sync;
  const { moves, trend } = historyOf(a);
  // Where money that lands goes; editable here, saved for this visit.
  const [inflow, setInflow] = useState(meta.inflow);
  const [saved, setSaved] = useState(false);
  const [day, setDay] = useState<number | null>(null);
  const pickInflow = (v: typeof inflow) => {
    if (v === inflow) return;
    setInflow(v);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };
  const lo = Math.min(...trend),
    hi = Math.max(...trend);
  const change = trend[0] ? (a.balance - trend[0]) / trend[0] : 0;
  const months = [0, 1, 2].map(
    (i) =>
      new Date(
        new Date(AS_OF).getFullYear(),
        new Date(AS_OF).getMonth() - i,
        1,
      ),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Close the sheet only, not the row preview underneath.
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const numberLabel = a.currency === "EUR" ? "IBAN" : "Account number";
  const details = `${a.customer.name}\n${a.bank}\n${numberLabel}: ${a.accountNumber}\n${a.routing.label}: ${a.routing.value}`;

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
        aria-label="Account details"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        {/* Identity */}
        <div className="border-b border-white/8 px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <CurrencyFlag code={a.currency} size={28} />
              <div className="min-w-0">
                <div className="truncate text-[15px] text-white">{a.label}</div>
                <div className="truncate text-[12px] text-neutral-500">
                  {a.bank} · {NAMES[a.currency]}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {chip}
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

          {/* Balance, and how fresh it is */}
          <div className="mt-6">
            <div className="text-[12px] text-neutral-500">
              Available balance
            </div>
            {pending ? (
              <div className="mt-1.5 text-[15px] text-neutral-300">
                Available once the account is active
              </div>
            ) : (
              <div className="amount mt-1.5 text-[28px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
                {balance}
              </div>
            )}
            {!pending && a.balance > 0 && (
              <div className="mt-5">
                {/* The figure first, then the bars across the full width */}
                <div className="flex items-baseline justify-between text-[12px] text-neutral-500">
                  <span>Last 30 days</span>
                  <span
                    className={`text-right tabular-nums ${day !== null ? "text-neutral-300" : change >= 0 ? "text-[var(--ok-fg)]" : "text-neutral-400"}`}
                  >
                    {day !== null ? (
                      <>
                        {money(a.currency, trend[day])}
                        <span className="text-neutral-500">
                          {" "}
                          ·{" "}
                          {dayFmt.format(
                            AS_OF - (trend.length - 1 - day) * DAY,
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        {change >= 0 ? "+" : "−"}
                        {Math.abs(change * 100).toFixed(1)}% · 30d
                      </>
                    )}
                  </span>
                </div>
                <div
                  className="mt-2 flex h-14 w-full items-end gap-[2px]"
                  onMouseLeave={() => setDay(null)}
                >
                  {trend.map((v, i) => {
                    const today = i === trend.length - 1;
                    const on = day === i;
                    return (
                      // The whole column is the hover target, not just the bar.
                      <span
                        key={i}
                        onMouseEnter={() => setDay(i)}
                        className="flex h-full flex-1 items-end"
                      >
                        <span
                          className="w-full rounded-[1.5px] transition-opacity"
                          style={{
                            height: `${Math.max(10, ((v - lo) / (hi - lo || 1)) * 100)}%`,
                            background: "var(--flow-in)",
                            opacity:
                              on || (day === null && today)
                                ? 1
                                : day === null
                                  ? 0.35
                                  : 0.2,
                          }}
                        />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {!pending && (
              <div className="mt-2 text-[12px] text-neutral-500">
                {sync.kind === "live"
                  ? `Updated ${ago(sync.at)} from ${a.bank}`
                  : sync.kind === "cooling"
                    ? `Last updated ${ago(sync.at)} · ${a.bank} limits refreshes, next sync in ${sync.retryMins} min`
                    : sync.kind === "paused"
                      ? `Sync paused while the account is ${a.status.toLowerCase()}`
                      : `Last updated ${ago(sync.at)}`}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center gap-2">
            <Link
              href={`/transactions?q=${encodeURIComponent(a.customer.name)}`}
              className="flex h-8 items-center gap-1 rounded-full border border-white/12 pr-2.5 pl-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              View transactions
              <ArrowUpRight size={13} strokeWidth={1.75} />
            </Link>
            {!pending && (
              <span className="flex h-8 items-center gap-1 rounded-full border border-white/12 pr-1.5 pl-3 text-[13px] text-neutral-200">
                Bank details
                <CopyButton value={details} label="Copy bank details" />
              </span>
            )}
          </div>
        </div>

        {/* Only when something is off — and say what happens next */}
        {sync.kind === "unreachable" && (
          <div className="mx-6 mt-5 rounded-lg bg-white/[0.04] px-4 py-3 text-[12px] leading-relaxed text-neutral-300">
            <>
              {a.bank} couldn&apos;t be reached on the last attempt,{" "}
              {ago(sync.at)}. It retries on its own — next try in{" "}
              {sync.retryMins} min. Nothing to do unless it keeps failing.
            </>
          </div>
        )}

        <div className="space-y-6 px-6 pt-6 pb-8">
          {pending && a.step !== undefined && (
            <Group title="Setting up">
              <ol className="pt-1">
                {PROVISION_STEPS.map((s, i) => {
                  const done = i <= a.step!;
                  const now = i === a.step! + 1;
                  return (
                    <li
                      key={s}
                      className="relative flex gap-3 pb-3.5 last:pb-0"
                    >
                      {i < PROVISION_STEPS.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute top-5 bottom-0 left-[9px] w-px bg-white/10"
                        />
                      )}
                      <span
                        className={`relative flex size-[19px] shrink-0 items-center justify-center rounded-full border text-[10px] tabular-nums ${
                          done
                            ? "border-[var(--flow-in)] bg-[var(--flow-in)] text-[#04301c]"
                            : now
                              ? "border-dashed border-white/50 text-white"
                              : "border-white/15 text-neutral-500"
                        }`}
                      >
                        {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="pt-px text-[13px]">
                        <span
                          className={
                            done || now ? "text-white" : "text-neutral-500"
                          }
                        >
                          {s}
                        </span>
                        {now && a.stepSince && (
                          <span className="ml-2 text-neutral-500">
                            since {dateFmt.format(new Date(a.stepSince))}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Group>
          )}

          {!pending && (
            <Group
              title="Recent activity"
              action={
                <Link
                  href={`/transactions?q=${encodeURIComponent(a.customer.name)}`}
                  className="text-[12px] text-neutral-400 hover:text-white"
                >
                  View all
                </Link>
              }
            >
              <ul>
                {moves.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 border-b border-white/6 py-2.5 last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-neutral-100">
                        {m.who}
                      </span>
                      <span className="block text-[11.5px] text-neutral-500">
                        {m.how} · {dayFmt.format(m.at)}
                      </span>
                    </span>
                    <span
                      className={`amount shrink-0 text-[13px] tabular-nums ${m.amount > 0 ? "text-[var(--ok-fg)]" : "text-neutral-200"}`}
                    >
                      {m.amount > 0 ? "+" : "−"}
                      {money(a.currency, m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Group>
          )}

          {!pending && (
            <Group title="Settings">
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="min-w-0">
                  <span className="block text-[13px] text-neutral-100">
                    Incoming money
                  </span>
                  <span
                    className={`block text-[11.5px] ${saved ? "text-[var(--ok-fg)]" : "text-neutral-500"}`}
                  >
                    {saved
                      ? "Saved — applies to the next deposit"
                      : inflow === "Settle"
                        ? "Converted to USDC and sent to the linked wallet"
                        : `Stays in this account, in ${a.currency}`}
                  </span>
                </span>
                <Dropdown
                  label="Incoming money"
                  variant="compact"
                  align="right"
                  value={inflow}
                  options={[
                    { value: "Settle", label: "Settle to wallet" },
                    { value: "Hold", label: "Hold here" },
                  ]}
                  onChange={pickInflow}
                />
              </div>
            </Group>
          )}

          {!pending && (
            <Group title="Statements and letters">
              <ul>
                {months.map((m) => (
                  <li
                    key={m.toISOString()}
                    className="flex items-center justify-between gap-3 border-b border-white/6 py-2.5"
                  >
                    <span className="text-[13px] text-neutral-100">
                      {monthFmt.format(m)}
                      {m.getMonth() === new Date(AS_OF).getMonth() && (
                        <span className="ml-2 text-[11.5px] text-neutral-500">
                          so far
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => downloadStatement(a, m, moves)}
                      className="flex items-center gap-1 text-[12px] text-neutral-400 hover:text-white"
                    >
                      <Download size={13} strokeWidth={1.75} />
                      CSV
                    </button>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-[13px] text-neutral-100">
                      Proof of account
                    </span>
                    <span className="block text-[11.5px] text-neutral-500">
                      A signed letter with the holder and bank details
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openLetter(a, numberLabel)}
                    className="flex shrink-0 items-center gap-1 text-[12px] text-neutral-400 hover:text-white"
                  >
                    <FileText size={13} strokeWidth={1.75} />
                    Open letter
                  </button>
                </li>
              </ul>
            </Group>
          )}

          <Group title="Bank details">
            <Field label="Account holder" value={a.customer.name} copy />
            <Field
              label={numberLabel}
              value={pending ? "Issued when active" : a.accountNumber}
              mono={!pending}
              copy={!pending}
              muted={pending}
            />
            <Field label={a.routing.label} value={a.routing.value} mono copy />
            <Field label="Bank" value={a.bank} />
          </Group>

          <Group title="About this account">
            <Field
              label="Currency"
              value={`${NAMES[a.currency]} (${a.currency})`}
            />
            <Field label="Account type" value={meta.type} />
            <Field label="Category" value={meta.tier} />
            <Field label="Holder" value={a.category} />

            <Field
              label="Opened"
              value={dateFmt.format(new Date(a.createdAt))}
            />
          </Group>

          <Group title="References">
            <Field
              label="Account reference"
              value={a.id}
              display={short(a.id)}
              mono
              copy
            />
            <Field
              label="Application reference"
              value={meta.applicationRef}
              display={short(meta.applicationRef)}
              mono
              copy
            />
            <Field
              label="Customer reference"
              value={meta.customerRef}
              display={short(meta.customerRef)}
              mono
              copy
            />
          </Group>
        </div>
      </aside>
    </>
  );
}

function Group({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/8 pt-5 first:border-0 first:pt-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13.5px] font-medium tracking-[-0.01em] text-white">
          {title}
        </h3>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  display,
  hint,
  mono = false,
  copy = false,
  muted = false,
}: {
  label: string;
  value: string;
  display?: string;
  hint?: string;
  mono?: boolean;
  copy?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 py-2.5 last:border-0">
      <span className="shrink-0 pt-px text-[12px] text-neutral-500">
        {label}
      </span>
      <span className="min-w-0 text-right">
        <span className="flex min-w-0 items-center justify-end gap-1">
          <span
            title={value}
            className={`truncate tabular-nums ${
              mono
                ? "font-mono text-[12px] text-neutral-300"
                : muted
                  ? "text-[13px] text-neutral-500"
                  : "text-[13px] text-neutral-100"
            }`}
          >
            {display ?? value}
          </span>
          {copy && (
            <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
          )}
        </span>
        {hint && (
          <span className="block text-[11px] text-neutral-500">{hint}</span>
        )}
      </span>
    </div>
  );
}
