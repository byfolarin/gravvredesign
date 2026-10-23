"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, Search, X } from "lucide-react";
import { CurrencyFlag } from "@/app/_components/currency-flag";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { AS_OF, FX, freezeOf, type Account, type Currency } from "../_data";
import { SYMBOL } from "./currency";
import { Segmented } from "./open-account-flow";

/** Conversion spread when the currency changes on the way. Same currency is free. */
const SPREAD = 0.004;
/** Moves at or over this (in USD) wait for a second person, like Trade desk orders. */
const APPROVAL_USD = 50_000;
const APPROVERS = "Chioma Eze or Folarin Folarin";
const HOLD_SECONDS = 30;
const MAIN = "Kredete Ltd";

const DAY = 24 * 60 * 60 * 1000;
const dayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const places = (c: Currency) => (c === "JPY" ? 0 : 2);
const num = (v: number, c: Currency) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: places(c),
    maximumFractionDigits: places(c),
  });
const money = (v: number, c: Currency) => `${SYMBOL[c]}${num(v, c)}`;

/** Units of `to` for one unit of `from`, before the spread. */
const rateOf = (from: Currency, to: Currency) => FX[to] / FX[from];

export type TransferResult = {
  id: string;
  from: Account;
  to: Account;
  amount: number;
  /** What lands in `to`, in its currency. */
  gets: number;
  reference: string;
  /** "now", or the ISO day it's scheduled for. */
  when: string;
  approval: boolean;
};

type Pick = { account: Account; disabled?: string; hint?: string };
type Group = { title: string; items: Pick[] };

/** Why an account can't send, if it can't. */
function cantSend(a: Account) {
  const f = freezeOf(a);
  if (f) return "Frozen — money out is stopped";
  if (a.balance <= 0) return "Nothing in it to move";
  return undefined;
}
/** Why an account can't receive, if it can't. */
function cantReceive(a: Account) {
  if (a.status === "Pending") return "Not open yet";
  const f = freezeOf(a);
  if (f?.scope === "all") return "Frozen — not taking money in";
  return undefined;
}

/**
 * Moving money between your own Gravv accounts, as one instrument rather than a form:
 * what leaves, what lands, and both balances moving as you type. The route, the rate and
 * any approval are said in words before you press the button — and the button says
 * exactly what will happen.
 */
export function TransferFlow({
  accounts,
  initialFrom,
  onClose,
  onDone,
}: {
  accounts: Account[];
  initialFrom?: Account;
  onClose: () => void;
  /** Fired when it's confirmed — the page moves the balances (unless it waits). */
  onDone: (r: TransferResult) => void;
}) {
  const live = useMemo(
    () => accounts.filter((a) => a.status !== "Closed"),
    [accounts],
  );
  const defaultFrom = useMemo(
    () =>
      initialFrom && !cantSend(initialFrom)
        ? initialFrom
        : live
            .filter(
              (a) =>
                a.customer.name === MAIN &&
                a.currency === "USD" &&
                !cantSend(a),
            )
            .sort((x, y) => y.balance - x.balance)[0],
    [initialFrom, live],
  );
  const [fromId, setFromId] = useState(defaultFrom?.id ?? "");
  const [toId, setToId] = useState<string | null>(null);
  const from = live.find((a) => a.id === fromId) ?? defaultFrom;
  const to = toId ? (live.find((a) => a.id === toId) ?? null) : null;

  const [raw, setRaw] = useState("");
  const [reference, setReference] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const days = useMemo(
    () => [1, 2, 3, 6, 10].map((d) => new Date(AS_OF + d * DAY).toISOString()),
    [],
  );
  const [day, setDay] = useState(days[0]);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  // A changing rate is held for 30s, then re-quoted — the way the desk quotes.
  const cross = !!to && to.currency !== from.currency;
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!cross || result) return;
    const t = setInterval(() => setTicks((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [cross, result]);
  const left = HOLD_SECONDS - (ticks % HOLD_SECONDS);
  // Each new quote lands a touch away from the last.
  const quote = Math.floor(ticks / HOLD_SECONDS);
  const drift = 1 + Math.sin(quote * 12.9898 + 1) * 0.0015;

  const amount = Number(raw.replace(/,/g, "")) || 0;
  const rate = to
    ? rateOf(from.currency, to.currency) * (cross ? drift : 1)
    : 1;
  const fee = cross ? amount * SPREAD : 0;
  const gets = to ? (amount - fee) * rate : 0;
  const over = amount > from.balance;
  const usd = amount / FX[from.currency];
  const approval = usd >= APPROVAL_USD;
  const sameBank = !!to && to.bank === from.bank;

  const touched = raw !== "" || reference !== "" || toId !== null;
  const guard = useDiscardGuard(onClose, touched && !result);

  // Esc closes an open picker first, then asks before throwing a half-made move away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guard.asking) return;
      if (document.querySelector('[data-transfer] [role="listbox"]')) {
        // A Dropdown inside handles its own Esc.
        if (!picker) return;
      }
      e.stopImmediatePropagation();
      if (picker) setPicker(null);
      else if (result) onClose();
      else guard.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [guard, picker, result, onClose]);

  const typeAmount = (v: string) => {
    const p = places(from.currency);
    let s = v.replace(/[^\d.]/g, "");
    const dot = s.indexOf(".");
    if (dot >= 0)
      s =
        p === 0
          ? s.slice(0, dot)
          : s.slice(0, dot + 1) +
            s
              .slice(dot + 1)
              .replace(/\./g, "")
              .slice(0, p);
    const [w, c] = s.split(".");
    const whole = (w ?? "").replace(/^0+(?=\d)/, "").slice(0, 12);
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setRaw(c !== undefined ? `${grouped || "0"}.${c}` : grouped);
  };

  // ——— Who can be picked, grouped the way the money actually moves ———
  const fromGroups: Group[] = [
    {
      title: "Main accounts",
      items: live
        .filter((a) => a.customer.name === MAIN && a.status !== "Pending")
        .map((a) => ({ account: a, disabled: cantSend(a) })),
    },
    {
      title: "Customers' accounts",
      items: live
        .filter((a) => a.customer.name !== MAIN && a.status !== "Pending")
        .map((a) => ({ account: a, disabled: cantSend(a) })),
    },
  ];
  const receiving = (a: Account): Pick => {
    const f = freezeOf(a);
    return {
      account: a,
      disabled: cantReceive(a),
      hint:
        f?.scope === "out"
          ? "Frozen for money out — money in still lands"
          : undefined,
    };
  };
  const mainFrom = from.customer.name === MAIN;
  const toGroups: Group[] = mainFrom
    ? [
        {
          title: "Main accounts",
          items: live
            .filter((a) => a.customer.name === MAIN && a.id !== from.id)
            .map(receiving),
        },
        {
          title: "Top up a customer's account",
          items: live.filter((a) => a.customer.name !== MAIN).map(receiving),
        },
      ]
    : [
        {
          title: `${from.customer.name}'s other accounts`,
          items: live
            .filter(
              (a) => a.customer.name === from.customer.name && a.id !== from.id,
            )
            .map(receiving),
        },
        {
          title: "Main accounts",
          items: live.filter((a) => a.customer.name === MAIN).map(receiving),
        },
      ];

  const canSwap =
    !!to && !cantSend(to) && !cantReceive(from) && to.id !== from.id;
  const swap = () => {
    if (!to || !canSwap) return;
    setFromId(to.id);
    setToId(from.id);
    setRaw("");
  };

  const ready = !!to && amount > 0 && !over;
  const label = !to
    ? "Choose where it goes"
    : amount <= 0
      ? "Enter an amount"
      : over
        ? `Not enough in ${from.label}`
        : approval
          ? `Send ${money(amount, from.currency)} for approval`
          : when === "later"
            ? `Schedule ${money(amount, from.currency)}`
            : `Move ${money(amount, from.currency)}`;

  const confirm = () => {
    if (!to || !ready) return;
    const r: TransferResult = {
      id: `TRF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      from,
      to,
      amount,
      gets,
      reference: reference.trim(),
      when: when === "later" ? day : "now",
      approval,
    };
    guard.clear();
    setResult(r);
    onDone(r);
  };

  const again = () => {
    setResult(null);
    setRaw("");
    setReference("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-transfer
    >
      <div
        aria-hidden
        onClick={() => (result ? onClose() : guard.requestClose())}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="transfer-title"
        onInputCapture={guard.markDirty}
        className="orbit-pop relative w-[560px] max-w-full rounded-2xl border border-white/10 bg-raised shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        {result ? (
          <Done result={result} onAgain={again} onClose={onClose} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-5">
              <div>
                <h2
                  id="transfer-title"
                  className="text-[17px] font-medium text-white"
                >
                  Move money
                </h2>
                <p className="mt-1 text-[13px] text-neutral-400">
                  Between your Gravv accounts. Free when the currency stays the
                  same.
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

            {/* From */}
            <div className="relative mt-5 px-6">
              <Side
                caption="From"
                account={from}
                open={picker === "from"}
                onOpen={() => setPicker(picker === "from" ? null : "from")}
                after={
                  amount > 0 && !over
                    ? {
                        text: `${money(from.balance - amount, from.currency)} after`,
                        tone: "out",
                      }
                    : undefined
                }
              />
              {picker === "from" && (
                <Picker
                  groups={fromGroups}
                  prefer={to?.currency}
                  selected={from.id}
                  onPick={(a) => {
                    setFromId(a.id);
                    // A destination that can't take money from here goes.
                    if (
                      to &&
                      (to.id === a.id ||
                        (a.customer.name !== MAIN &&
                          to.customer.name !== MAIN &&
                          to.customer.name !== a.customer.name))
                    )
                      setToId(null);
                    setRaw("");
                    setPicker(null);
                  }}
                  onClose={() => setPicker(null)}
                />
              )}
            </div>

            {/* The amount — the biggest thing on the screen */}
            <div className="relative mt-4 border-y border-white/8 px-6 pt-5 pb-6">
              <label className="flex items-baseline gap-1.5">
                <span className="sr-only">Amount</span>
                <span className="text-[26px] text-neutral-500">
                  {SYMBOL[from.currency].trim()}
                </span>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={raw}
                  placeholder={places(from.currency) ? "0.00" : "0"}
                  onChange={(e) => typeAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirm()}
                  className={`amount min-w-0 flex-1 bg-transparent text-[46px] leading-none font-medium tracking-[-0.03em] tabular-nums outline-none placeholder:text-neutral-700 ${over ? "text-rose-300" : "text-white"}`}
                />
              </label>
              <div className="mt-3 flex items-center justify-between gap-4 text-[12.5px]">
                {over ? (
                  <span className="text-rose-300">
                    That&apos;s{" "}
                    <span className="amount">
                      {money(amount - from.balance, from.currency)}
                    </span>{" "}
                    more than {from.label} holds.
                  </span>
                ) : approval ? (
                  <span className="text-amber-200">
                    Over $50,000 — a second person approves this.
                  </span>
                ) : (
                  <span className="text-neutral-500">
                    {from.label} holds{" "}
                    <span className="amount text-neutral-300">
                      {money(from.balance, from.currency)}
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => typeAmount(num(from.balance, from.currency))}
                  className="shrink-0 text-neutral-300 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/60"
                >
                  Move all
                </button>
              </div>
              {/* Swap sits on the seam between what leaves and what lands */}
              <button
                type="button"
                aria-label="Swap from and to"
                title={
                  canSwap ? "Swap from and to" : "These two can't swap places"
                }
                disabled={!canSwap}
                onClick={swap}
                className="absolute -bottom-4 left-1/2 z-10 -translate-x-1/2 flex size-8 items-center justify-center rounded-full border border-white/12 bg-raised text-neutral-300 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUpDown size={14} strokeWidth={1.75} />
              </button>
            </div>

            {/* To */}
            <div className="relative mt-4 px-6">
              <Side
                caption="To"
                account={to}
                open={picker === "to"}
                onOpen={() => setPicker(picker === "to" ? null : "to")}
                after={
                  to && amount > 0 && !over
                    ? {
                        text: `${money(to.balance + gets, to.currency)} after`,
                        tone: "in",
                      }
                    : undefined
                }
              />
              {picker === "to" && (
                <Picker
                  groups={toGroups}
                  prefer={from.currency}
                  selected={to?.id}
                  footnote={
                    mainFrom
                      ? undefined
                      : "Paying a different customer? That's a payment — use Send money."
                  }
                  onPick={(a) => {
                    setToId(a.id);
                    setPicker(null);
                  }}
                  onClose={() => setPicker(null)}
                />
              )}
            </div>

            {/* What will happen, in words */}
            {to && (
              <dl className="mt-5 space-y-3 border-t border-white/8 px-6 pt-4 text-[13px]">
                {cross && (
                  <Row label="They get">
                    <span className="amount text-[15px] font-medium text-[var(--ok-fg)] tabular-nums">
                      {money(amount > 0 ? gets : 0, to.currency)}
                    </span>
                    <span className="ml-2 text-neutral-500 tabular-nums">
                      1 {from.currency} ={" "}
                      {rate.toLocaleString("en-US", {
                        maximumFractionDigits: rate < 10 ? 4 : 2,
                      })}{" "}
                      {to.currency} · held{" "}
                      <span className="text-neutral-300">
                        0:{String(left).padStart(2, "0")}
                      </span>
                    </span>
                  </Row>
                )}
                <Row label="Arrives">
                  {cross ? (
                    <>
                      In about 5 minutes, converted on the way ·{" "}
                      <span className="amount">
                        {money(fee, from.currency)}
                      </span>{" "}
                      fee (0.40%)
                    </>
                  ) : sameBank ? (
                    <>Instantly — both are at {from.bank} · Free</>
                  ) : (
                    <>
                      In about 2 minutes, {from.bank} to {to.bank} over USDC ·
                      Free
                    </>
                  )}
                </Row>
                {approval && (
                  <Row label="Approval">
                    {APPROVERS} approves it. Nothing moves until then
                    {cross ? "; the rate is held 15 minutes" : ""}.
                  </Row>
                )}
                <Row label="Reference">
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    maxLength={60}
                    placeholder="Optional — shows on both statements"
                    className="-my-1 h-8 w-full rounded-md border border-transparent bg-transparent px-2 -mx-2 text-[13px] text-white outline-none placeholder:text-neutral-600 hover:border-white/10 focus:border-white/25"
                  />
                </Row>
                <Row label="When">
                  <div className="-my-1 flex items-center gap-2">
                    <Segmented<"now" | "later">
                      value={when}
                      onChange={setWhen}
                      options={[
                        { value: "now", label: "Now" },
                        { value: "later", label: "Later" },
                      ]}
                    />
                    {when === "later" && (
                      <Dropdown
                        label="Day"
                        variant="compact"
                        value={day}
                        options={days.map((d) => ({
                          value: d,
                          label: dayFmt.format(new Date(d)),
                        }))}
                        onChange={setDay}
                      />
                    )}
                  </div>
                </Row>
              </dl>
            )}

            <div className="mt-6 flex items-center justify-end gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={guard.requestClose}
                className="h-10 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ready}
                onClick={confirm}
                className="h-10 rounded-full bg-white px-5 text-[13px] font-medium text-black tabular-nums hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {label}
              </button>
            </div>
          </>
        )}

        {guard.asking && (
          <DiscardConfirm
            title="Discard this transfer?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
            className="fixed inset-0"
          />
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <dt className="w-20 shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-neutral-200">{children}</dd>
    </div>
  );
}

/** One end of the move: the account (click to change) and its balance, now and after. */
function Side({
  caption,
  account: a,
  open,
  onOpen,
  after,
}: {
  caption: string;
  account: Account | null;
  open: boolean;
  onOpen: () => void;
  after?: { text: string; tone: "in" | "out" };
}) {
  return (
    <div>
      <div className="text-[12px] text-neutral-500">{caption}</div>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onOpen}
        className={`group mt-1.5 flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${open ? "border-white/30" : "border-white/10 hover:border-white/20"}`}
      >
        {a ? (
          <CurrencyFlag code={a.currency} size={28} />
        ) : (
          <span className="size-7 shrink-0 rounded-full border border-dashed border-white/20" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[14px] ${a ? "font-medium text-white" : "text-neutral-400"}`}
          >
            {a ? a.label : "Choose an account"}
          </span>
          <span className="block truncate text-[12px] text-neutral-500">
            {a
              ? `${a.customer.name} · ${a.bank} ••${a.accountNumber.slice(-4)}`
              : "Your main accounts, or the same customer's"}
          </span>
        </span>
        {a && (
          <span className="shrink-0 text-right">
            <span className="amount block text-[13.5px] text-neutral-200 tabular-nums">
              {money(a.balance, a.currency)}
            </span>
            <span
              className={`amount block text-[12px] tabular-nums transition-opacity ${after ? "opacity-100" : "opacity-0"} ${after?.tone === "in" ? "text-[var(--ok-fg)]" : "text-neutral-400"}`}
            >
              {after?.text ?? "—"}
            </span>
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
    </div>
  );
}

const PER_GROUP = 25;

/**
 * Thousands of accounts don't fit a dropdown: search first (label, holder, bank, last 4),
 * grouped by where money is allowed to go, with the reason an account can't be picked.
 */
function Picker({
  groups,
  selected,
  footnote,
  prefer,
  onPick,
  onClose,
}: {
  /** The other side's currency: same-currency accounts (free) come first. */
  prefer?: Currency;
  groups: Group[];
  selected?: string;
  footnote?: string;
  onPick: (a: Account) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (root.current?.contains(t)) return;
      // The trigger toggles itself.
      if (t.closest('[aria-haspopup="listbox"]')) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [onClose]);
  const s = q.trim().toLowerCase();
  const shown = groups
    .map((g) => {
      const hits = g.items.filter(
        ({ account: a }) =>
          !s ||
          [
            a.label,
            a.customer.name,
            a.bank,
            a.accountNumber.slice(-4),
            a.currency,
          ]
            .join(" ")
            .toLowerCase()
            .includes(s),
      );
      // Pickable first, then the same currency, then biggest balances.
      hits.sort(
        (x, y) =>
          Number(!!x.disabled) - Number(!!y.disabled) ||
          Number(y.account.currency === prefer) -
            Number(x.account.currency === prefer) ||
          y.account.balance / FX[y.account.currency] -
            x.account.balance / FX[x.account.currency],
      );
      return { ...g, hits };
    })
    .filter((g) => g.hits.length);

  return (
    <div
      ref={root}
      className="orbit-pop absolute top-full right-6 left-6 z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-raised shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]"
    >
      <div className="flex items-center gap-2 border-b border-white/8 px-3">
        <Search size={14} strokeWidth={1.75} className="text-neutral-500" />
        <input
          autoFocus
          data-keeps-clean
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, holder, bank or last 4"
          className="h-10 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-600"
        />
      </div>
      <div
        role="listbox"
        aria-label="Accounts"
        className="sidebar-scroll max-h-[320px] overflow-y-auto p-1.5"
      >
        {shown.map((g) => (
          <div key={g.title} className="mb-1">
            <div className="px-2.5 pt-2 pb-1 text-[11px] text-neutral-500">
              {g.title}
            </div>
            {g.hits
              .slice(0, PER_GROUP)
              .map(({ account: a, disabled, hint }) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={a.id === selected}
                  aria-disabled={!!disabled}
                  onClick={() => !disabled && onPick(a)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${disabled ? "cursor-default" : "hover:bg-white/[0.06]"} ${a.id === selected ? "bg-white/[0.05]" : ""}`}
                >
                  <span className={disabled ? "opacity-40" : ""}>
                    <CurrencyFlag code={a.currency} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] ${disabled ? "text-neutral-500" : "text-white"}`}
                    >
                      {a.label}
                    </span>
                    <span
                      className={`block truncate text-[11.5px] ${disabled ? "text-neutral-500" : hint ? "text-sky-300" : "text-neutral-500"}`}
                    >
                      {disabled ??
                        hint ??
                        `${a.customer.name} · ${a.bank} ••${a.accountNumber.slice(-4)}`}
                    </span>
                  </span>
                  <span
                    className={`amount shrink-0 text-[12.5px] tabular-nums ${disabled ? "text-neutral-600" : "text-neutral-300"}`}
                  >
                    {a.status === "Pending"
                      ? "—"
                      : money(a.balance, a.currency)}
                  </span>
                </button>
              ))}
            {g.hits.length > PER_GROUP && (
              <div className="px-2.5 py-1.5 text-[11.5px] text-neutral-500">
                {(g.hits.length - PER_GROUP).toLocaleString("en-US")} more —
                keep typing to narrow it down
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && (
          <div className="px-3 py-8 text-center text-[13px] text-neutral-500">
            No account matches “{q}”.
          </div>
        )}
      </div>
      {footnote && (
        <div className="border-t border-white/8 px-3 py-2.5 text-[12px] text-neutral-500">
          {footnote}
        </div>
      )}
    </div>
  );
}

/**
 * The moment it happens: both balances roll from where they were to where they are now —
 * one down, one up — so you see the money land rather than read that it did.
 */
function Done({
  result: r,
  onAgain,
  onClose,
}: {
  result: TransferResult;
  onAgain: () => void;
  onClose: () => void;
}) {
  const moved = !r.approval && r.when === "now";
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!moved) return;
    const t = setTimeout(() => setSettled(true), 650);
    return () => clearTimeout(t);
  }, [moved]);
  const cross = r.from.currency !== r.to.currency;
  const title = r.approval
    ? "Waiting for approval"
    : r.when !== "now"
      ? `Scheduled for ${dayFmt.format(new Date(r.when))}`
      : "Moved";

  const end = (
    a: Account,
    before: number,
    afterV: number,
    delta: string,
    tone: "in" | "out",
  ) => (
    <div className="flex items-center gap-3 py-3">
      <CurrencyFlag code={a.currency} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-white">
          {a.label}
        </div>
        <div className="truncate text-[12px] text-neutral-500">
          {a.customer.name} · {a.bank} ••{a.accountNumber.slice(-4)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="amount text-[15px] font-medium text-white tabular-nums">
          {SYMBOL[a.currency].trim()}
          <Roll value={num(moved && settled ? afterV : before, a.currency)} />
        </div>
        <div
          className={`amount text-[12px] tabular-nums transition-opacity duration-500 ${settled || !moved ? "opacity-100" : "opacity-0"} ${tone === "in" ? "text-[var(--ok-fg)]" : "text-neutral-400"}`}
        >
          {moved ? delta : `${delta} when it goes`}
        </div>
      </div>
    </div>
  );

  return (
    <div className="px-6 pt-6 pb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[13px] text-neutral-400">{title}</div>
          <div className="amount mt-1 text-[34px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
            {SYMBOL[r.from.currency].trim()}
            <Roll value={num(r.amount, r.from.currency)} />
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
        {end(
          r.from,
          r.from.balance,
          r.from.balance - r.amount,
          `−${money(r.amount, r.from.currency)}`,
          "out",
        )}
        {end(
          r.to,
          r.to.balance,
          r.to.balance + r.gets,
          `+${money(r.gets, r.to.currency)}`,
          "in",
        )}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">
        {r.approval ? (
          <>
            {APPROVERS} needs to approve it. Nothing moves until then —
            you&apos;ll get a notification either way.
          </>
        ) : r.when !== "now" ? (
          <>
            Goes out {dayFmt.format(new Date(r.when))} at 9:00 AM if{" "}
            {r.from.label} still holds enough. You can cancel it until then.
          </>
        ) : cross ? (
          <>Converted and on its way — lands in about 5 minutes.</>
        ) : r.from.bank === r.to.bank ? (
          <>Arrived instantly · {timeFmt.format(new Date(AS_OF))}</>
        ) : (
          <>On its way over USDC — lands in about 2 minutes.</>
        )}
        {r.reference && <> · “{r.reference}”</>}
      </p>

      <div className="mt-5 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1 font-mono text-[12px] text-neutral-400">
          {r.id}
          <CopyButton value={r.id} label="Copy transfer ID" />
        </span>
        <div className="flex items-center gap-2">
          {r.approval ? (
            <Link
              href="/approvals"
              className="flex h-10 items-center rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
            >
              Open in Approvals
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAgain}
              className="h-10 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
            >
              Move more
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full bg-white px-5 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
