"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { RecipientAvatar } from "./recipient-avatar";
import type { Rail, Recipient } from "../_data";
import type { FundingSource } from "../../cards/_data";
import { parseAmount } from "../../cards/_components/limits-dialog";
import { dateFmt, money } from "../../cards/_lib/format";

export type SentPayment = {
  recipientId: string;
  amount: number;
  source: string;
  reference: string;
};
type Source = FundingSource & { balance: number };
type Step = "recipient" | "amount" | "review" | "sent";

// Indicative USD → payout currency rates for the prototype.
const fx: Record<string, number> = {
  USD: 1,
  MAD: 9.18,
  NGN: 1550,
  GHS: 15.6,
  KES: 129,
  EUR: 0.92,
};

export const arrival: Record<Rail, string> = {
  ACH: "In 1–2 business days",
  Wire: "Today, if sent before 4pm ET",
  Swift: "In 1–2 business days",
  SEPA: "Usually today",
  "Local transfer": "In minutes",
};

const fmt = (v: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(v);
const sourceName = (s: Source) =>
  s.asset === "USDC" ? s.label : "USD account";
const lastPaid = (r: Recipient) =>
  r.payments.reduce<string | null>(
    (a, p) => (!a || p.date > a ? p.date : a),
    null,
  );

export function SendMoneyFlow({
  recipients,
  sources,
  initialRecipientId,
  onClose,
  onSent,
}: {
  recipients: Recipient[];
  sources: Source[];
  initialRecipientId?: string;
  onClose: () => void;
  onSent: (p: SentPayment) => void;
}) {
  const [step, setStep] = useState<Step>(
    initialRecipientId ? "amount" : "recipient",
  );
  const [recipientId, setRecipientId] = useState(initialRecipientId ?? null);
  const [query, setQuery] = useState("");
  const [raw, setRaw] = useState("");
  const [sourceId, setSourceId] = useState(sources[0].id);
  const [reference, setReference] = useState("");

  // Searching for someone doesn't count as work; an amount, source or reference does.
  const guard = useDiscardGuard(onClose);
  const { requestClose } = guard;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const recipient = recipients.find((r) => r.id === recipientId) ?? null;
  const source = sources.find((s) => s.id === sourceId)!;
  const usd = parseAmount(raw);
  const rate = recipient ? (fx[recipient.currency] ?? 1) : 1;
  const receives = usd * rate;
  const over = usd > source.balance;
  const canContinue = usd > 0 && !over;

  const pick = (r: Recipient) => {
    setRecipientId(r.id);
    setStep("amount");
  };

  const steps: { key: Step; label: string }[] = [
    { key: "recipient", label: "Recipient" },
    { key: "amount", label: "Amount" },
    { key: "review", label: "Review" },
  ];
  const stepIndex =
    step === "sent" ? 3 : steps.findIndex((s) => s.key === step);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-takeover"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-title"
      onInputCapture={guard.markDirty}
      onChangeCapture={guard.markDirty}
      onClickCapture={guard.markDirty}
    >
      {/* Top bar */}
      <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-white/7 px-6">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold tracking-[-0.03em] text-white">
            Gravv.
          </span>
          <span className="h-4 w-px bg-white/10" />
          <h1 id="send-title" className="text-sm text-neutral-200">
            Send money
          </h1>
        </div>
        <ol className="flex items-center gap-6 text-xs">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className={`flex items-center gap-2 ${i === stepIndex ? "text-white" : i < stepIndex ? "text-neutral-400" : "text-neutral-600"}`}
            >
              <span
                className={`flex size-[18px] items-center justify-center rounded-full text-[10px] tabular-nums ${
                  i < stepIndex
                    ? "bg-white/15 text-white"
                    : i === stepIndex
                      ? "bg-white text-black"
                      : "border border-white/12"
                }`}
              >
                {i < stepIndex ? <Check size={10} strokeWidth={3} /> : i + 1}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
        <button
          type="button"
          aria-label="Close"
          onClick={requestClose}
          className="flex size-8 items-center justify-center justify-self-end rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
        >
          <X size={17} strokeWidth={1.75} />
        </button>
      </header>

      {step === "recipient" && (
        <PickRecipient
          recipients={recipients}
          query={query}
          onQuery={setQuery}
          onPick={pick}
        />
      )}

      {recipient && (step === "amount" || step === "review") && (
        <div className="flex min-h-0 flex-1">
          {/* Form — 60% */}
          <div className="sidebar-scroll min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[520px] px-6 py-10">
              <button
                type="button"
                onClick={() =>
                  setStep(step === "review" ? "amount" : "recipient")
                }
                className="-ml-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft size={13} strokeWidth={1.75} />
                {step === "review" ? "Edit amount" : "Change recipient"}
              </button>

              {step === "amount" ? (
                <form
                  className="mt-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (canContinue) setStep("review");
                  }}
                >
                  <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                    How much?
                  </h2>

                  <label className="mt-6 flex items-baseline gap-2 border-b border-white/12 pb-3 focus-within:border-white/50">
                    <span className="text-[36px] leading-none text-neutral-500">
                      $
                    </span>
                    <input
                      autoFocus
                      aria-label="Amount in USD"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={raw}
                      onChange={(e) =>
                        setRaw(e.target.value.replace(/[^0-9.,]/g, ""))
                      }
                      className="min-w-0 flex-1 bg-transparent text-[44px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums outline-none placeholder:text-neutral-700"
                    />
                    <span className="text-sm text-neutral-500">USD</span>
                  </label>
                  <p
                    className={`mt-2 text-xs tabular-nums ${over ? "text-white" : "text-neutral-500"}`}
                  >
                    {over
                      ? `${sourceName(source)} only has ${money(source.balance)}`
                      : `${money(source.balance)} available in ${sourceName(source)}`}
                  </p>

                  <fieldset className="mt-8">
                    <legend className="mb-3 text-[13px] text-white">
                      Pay from
                    </legend>
                    <div
                      role="radiogroup"
                      className="divide-y divide-white/6 rounded-xl border border-white/8"
                    >
                      {sources.map((s) => {
                        const on = s.id === sourceId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setSourceId(s.id)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/2"
                          >
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                                on ? "border-white" : "border-white/25"
                              }`}
                            >
                              {on && (
                                <span className="size-2 rounded-full bg-white" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] text-neutral-100">
                                {sourceName(s)}
                              </span>
                              <span className="block text-xs text-neutral-500">
                                {s.asset === "USDC"
                                  ? `USDC · ${s.network}`
                                  : "USD · Operating"}
                              </span>
                            </span>
                            <span className="text-[13px] text-neutral-300 tabular-nums">
                              {money(s.balance)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <label className="mt-8 block">
                    <span className="mb-3 block text-[13px] text-white">
                      Reference
                    </span>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={40}
                      placeholder="Shows on their bank statement"
                      className="h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={!canContinue}
                    className="mt-10 h-10 w-full rounded-full bg-white text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:bg-white/8 disabled:text-neutral-500"
                  >
                    Review payment
                  </button>
                </form>
              ) : (
                <div className="mt-6">
                  <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                    Check and send
                  </h2>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Payments can’t be cancelled once they reach the bank.
                  </p>
                  <dl className="mt-8 divide-y divide-white/6 border-y border-white/6 text-[13px]">
                    <ReviewRow label="To" value={recipient.name} />
                    <ReviewRow
                      label="Bank"
                      value={`${recipient.institution} ••${recipient.account?.slice(-4) ?? "—"}`}
                    />
                    <ReviewRow
                      label="Rail"
                      value={`${recipient.currency} · ${recipient.rail}`}
                    />
                    <ReviewRow
                      label="From"
                      value={`${sourceName(source)}${source.asset === "USDC" ? " · USDC" : ""}`}
                    />
                    <ReviewRow
                      label="Reference"
                      value={reference.trim() || "Payment"}
                    />
                    <ReviewRow label="Fee" value="None" />
                  </dl>
                  <button
                    type="button"
                    onClick={() => {
                      guard.clear();
                      onSent({
                        recipientId: recipient.id,
                        amount: receives,
                        source:
                          source.asset === "USDC"
                            ? `USDC · ${source.label}`
                            : "USD account",
                        reference: reference.trim() || "Payment",
                      });
                      setStep("sent");
                    }}
                    className="mt-10 h-10 w-full rounded-full bg-white text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
                  >
                    Send {fmt(receives, recipient.currency)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Where the money goes — 40% */}
          <aside className="hidden w-2/5 shrink-0 border-l border-white/7 bg-surface-2 lg:block">
            <div className="mx-auto max-w-[400px] px-8 py-10">
              <div className="text-xs text-neutral-500">Payment</div>
              <MoneyPath
                recipient={recipient}
                source={source}
                usd={usd}
                rate={rate}
                receives={receives}
              />
            </div>
          </aside>
        </div>
      )}

      {step === "sent" && recipient && (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-[400px] text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-black">
              <Check size={22} strokeWidth={2.5} />
            </span>
            <h2 className="mt-6 text-[22px] font-medium tracking-[-0.02em] text-white">
              {fmt(receives, recipient.currency)} is on its way
            </h2>
            <p className="mt-2 text-[13px] text-neutral-400">
              {recipient.name} should receive it{" "}
              {arrival[recipient.rail].toLowerCase()}. We’ll notify you when it
              lands.
            </p>
            <div className="mt-8 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRaw("");
                  setReference("");
                  setRecipientId(null);
                  setStep("recipient");
                }}
                className="h-9 rounded-full border border-white/12 px-4 text-[13px] text-neutral-200 hover:border-white/30"
              >
                Send another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-full bg-white px-5 text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {guard.asking && (
        <DiscardConfirm
          title="Discard this payment?"
          onKeep={guard.keep}
          onDiscard={guard.discard}
        />
      )}
    </div>
  );
}

function PickRecipient({
  recipients,
  query,
  onQuery,
  onPick,
}: {
  recipients: Recipient[];
  query: string;
  onQuery: (v: string) => void;
  onPick: (r: Recipient) => void;
}) {
  const q = query.trim().toLowerCase();
  const recent = recipients
    .filter((r) => r.status === "Active" && lastPaid(r))
    .sort((a, b) => lastPaid(b)!.localeCompare(lastPaid(a)!))
    .slice(0, 6);
  const matches = recipients
    .filter(
      (r) =>
        !q ||
        [r.name, r.institution, r.account ?? ""].some((v) =>
          v.toLowerCase().includes(q),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="sidebar-scroll flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[560px] px-6 py-14">
        <h2 className="text-center text-[28px] font-medium tracking-[-0.025em] text-white">
          Who are you paying?
        </h2>

        <label
          data-keeps-clean
          className="mt-8 flex h-11 items-center gap-3 rounded-full border border-white/12 px-4 transition-colors focus-within:border-white/40"
        >
          <Search
            size={15}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-500"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              const first = matches.find((r) => r.status === "Active");
              if (e.key === "Enter" && q && first) onPick(first);
            }}
            placeholder="Name, bank or account number"
            aria-label="Search recipients"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-neutral-500"
          />
        </label>

        {!q && (
          <>
            <h3 className="mt-10 text-xs text-neutral-500">Recent</h3>
            <div className="mt-4 grid grid-cols-6 gap-2">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onPick(r)}
                  className="group flex min-w-0 flex-col items-center gap-2.5 rounded-xl px-1 py-3 transition-colors hover:bg-white/4"
                >
                  <span className="rounded-full ring-white/0 transition group-hover:ring-2 group-hover:ring-white/15">
                    <RecipientAvatar recipient={r} size={48} />
                  </span>
                  <span className="w-full truncate text-center text-xs text-neutral-200">
                    {r.name.split(" ")[0]}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-10 mb-1 text-xs text-neutral-500">
          {q ? `${matches.length} found` : "All recipients"}
        </h3>
        <ul>
          {matches.map((r) => {
            const pending = r.status === "Pending";
            const last = lastPaid(r);
            return (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPick(r)}
                  className="group -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors enabled:hover:bg-white/4 disabled:opacity-50"
                >
                  <RecipientAvatar recipient={r} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-white">
                      {r.name}
                    </span>
                    <span className="block truncate text-xs text-neutral-500 tabular-nums">
                      {r.institution}
                      {r.account ? ` ••${r.account.slice(-4)}` : ""} ·{" "}
                      {r.currency} {r.rail}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                    {pending
                      ? "Verifying"
                      : last
                        ? `Paid ${dateFmt.format(new Date(last))}`
                        : "Never paid"}
                  </span>
                  {!pending && (
                    <ChevronRight
                      size={14}
                      strokeWidth={1.75}
                      className="text-neutral-600 group-hover:text-neutral-300"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** The route the money takes: source → conversion → recipient. Gravv's difference made visible. */
function MoneyPath({
  recipient: r,
  source,
  usd,
  rate,
  receives,
}: {
  recipient: Recipient;
  source: Source;
  usd: number;
  rate: number;
  receives: number;
}) {
  const usdc = source.asset === "USDC";
  const converts = usdc || rate !== 1;
  const nodes = [
    {
      title: usdc
        ? `${usd ? usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} USDC`
        : money(usd),
      body: `From ${sourceName(source)}${usdc ? ` · ${source.network}` : ""}`,
    },
    ...(converts
      ? [
          {
            title:
              usdc && rate === 1
                ? "1 USDC = 1.00 USD"
                : `1 USD = ${rate.toFixed(2)} ${r.currency}`,
            body: usdc
              ? `Converted to ${r.currency} at send · no spread`
              : "Indicative rate, locked when you send",
          },
        ]
      : []),
    {
      title: fmt(receives, r.currency),
      body: `${r.name} receives · ${r.institution} ••${r.account?.slice(-4) ?? "—"}`,
      strong: true,
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3">
        <RecipientAvatar recipient={r} size={40} />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium text-white">
            {r.name}
          </div>
          <div className="truncate text-xs text-neutral-500">
            {r.kind} · {r.country}
          </div>
        </div>
      </div>

      <ol className="mt-8">
        {nodes.map((n, i) => (
          <li key={i} className="relative flex gap-4 pb-7 last:pb-0">
            {i < nodes.length - 1 && (
              <span
                aria-hidden
                className="absolute top-4 bottom-0 left-[5px] w-px bg-white/12"
              />
            )}
            <span
              aria-hidden
              className={`relative mt-1.5 size-[11px] shrink-0 rounded-full ${n.strong ? "bg-white" : "border border-white/30 bg-surface-2"}`}
            />
            <div className="min-w-0">
              <div
                className={`tabular-nums ${n.strong ? "text-[26px] leading-tight font-medium tracking-[-0.02em] text-white" : "text-[14px] text-neutral-100"}`}
              >
                {n.title}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">{n.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-10 space-y-2.5 border-t border-white/7 pt-5 text-xs">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Arrives</dt>
          <dd className="text-neutral-200">{arrival[r.rail]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Rail</dt>
          <dd className="text-neutral-200">
            {r.currency} · {r.rail}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-500">Fee</dt>
          <dd className="text-neutral-200">None</dd>
        </div>
      </dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-24 shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-right text-neutral-100">
        {value}
      </dd>
    </div>
  );
}
