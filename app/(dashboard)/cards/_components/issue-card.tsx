"use client";

import { useEffect, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { FlatCard } from "./flat-card";
import {
  AmountInput,
  parseAmount,
  PeriodPicker,
  resetCopy,
  Toggle,
} from "./limits-dialog";
import type { CardType, FundingSource, LimitPeriod } from "../_data";
import { money, units } from "../_lib/format";

export type IssueCardInput = {
  holder: string;
  customerId: string;
  type: CardType;
  funding: FundingSource;
  limit: number;
  period: LimitPeriod;
  perTransactionLimit: number | null;
  online: boolean;
  international: boolean;
};

const perUnit: Record<LimitPeriod, string> = {
  Daily: "day",
  Weekly: "week",
  Monthly: "month",
};

const cardTypes: { type: CardType; title: string; body: string }[] = [
  {
    type: "Virtual",
    title: "Virtual",
    body: "Ready instantly. For online spend, subscriptions and Apple Pay.",
  },
  {
    type: "Physical",
    title: "Physical",
    body: "Shipped in 5–7 business days. Works in-store and at ATMs.",
  },
];

export function IssueCardFlow({
  sources,
  onClose,
  onIssue,
}: {
  sources: (FundingSource & { balance: number })[];
  onClose: () => void;
  onIssue: (input: IssueCardInput) => void;
}) {
  const [type, setType] = useState<CardType>("Virtual");
  const [holder, setHolder] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [sourceId, setSourceId] = useState(sources[0].id);
  const [amount, setAmount] = useState("2500");
  const [period, setPeriod] = useState<LimitPeriod>("Monthly");
  const [advanced, setAdvanced] = useState(false);
  const [txnOn, setTxnOn] = useState(false);
  const [txnAmount, setTxnAmount] = useState("500");
  const [online, setOnline] = useState(true);
  const [international, setInternational] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const source = sources.find((s) => s.id === sourceId)!;
  const limit = parseAmount(amount);
  const txnLimit = parseAmount(txnAmount);
  const name = holder.trim();
  const valid =
    name.length > 1 &&
    limit > 0 &&
    (!txnOn || (txnLimit > 0 && txnLimit <= limit));
  // How many full limit periods the funding source can cover today.
  const runway = limit > 0 ? Math.floor(source.balance / limit) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-takeover"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-title"
    >
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/7 px-6">
        <div className="flex items-center gap-3">
          <span className="text-[15px] font-bold tracking-[-0.03em] text-white">
            Gravv.
          </span>
          <span className="h-4 w-px bg-white/10" />
          <h1 id="issue-title" className="text-sm text-neutral-200">
            Issue card
          </h1>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
        >
          <X size={17} strokeWidth={1.75} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Form */}
        <div className="sidebar-scroll min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[560px] space-y-10 px-6 py-10">
            <FormSection step="1" title="Card type">
              <div className="grid grid-cols-2 gap-3">
                {cardTypes.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    aria-pressed={type === c.type}
                    onClick={() => setType(c.type)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      type === c.type
                        ? "border-brand bg-brand/6"
                        : "border-white/8 hover:border-white/20"
                    }`}
                  >
                    <div className="text-[13px] text-white">{c.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-neutral-500">
                      {c.body}
                    </div>
                  </button>
                ))}
              </div>
            </FormSection>

            <FormSection step="2" title="Cardholder">
              <div className="space-y-3">
                <TextField
                  label="Name on card"
                  value={holder}
                  onChange={setHolder}
                  placeholder="e.g. Amara Okafor"
                  autoFocus
                />
                <TextField
                  label="Customer ID"
                  hint="Optional — link the card to one of your customers"
                  value={customerId}
                  onChange={setCustomerId}
                  placeholder="cus_…"
                  mono
                />
              </div>
            </FormSection>

            <FormSection
              step="3"
              title="Funded from"
              note="Spend settles from this balance at the moment of purchase. No pre-funding needed."
            >
              <div
                role="radiogroup"
                className="divide-y divide-white/6 rounded-lg border border-white/8"
              >
                {sources.map((s) => {
                  const selected = s.id === sourceId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setSourceId(s.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/2"
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-brand" : "border-white/25"
                        }`}
                      >
                        {selected && (
                          <span className="size-2 rounded-full bg-brand" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-white">
                          {s.asset === "USDC" ? `USDC · ${s.label}` : s.label}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {s.asset === "USDC"
                            ? `Stablecoin wallet on ${s.network}`
                            : "Fiat account"}
                        </span>
                      </span>
                      <span className="text-[13px] text-neutral-300 tabular-nums">
                        {s.asset === "USDC"
                          ? `${units(s.balance)} USDC`
                          : money(s.balance)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <FormSection step="4" title="Spending limit">
              <div className="space-y-2">
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  label="Spending limit amount"
                />
                <PeriodPicker value={period} onChange={setPeriod} />
                <p className="text-xs text-neutral-500">
                  {resetCopy(period, "2026-11-30")}
                </p>
              </div>

              <button
                type="button"
                aria-expanded={advanced}
                onClick={() => setAdvanced((a) => !a)}
                className="mt-5 flex items-center gap-1.5 text-[13px] text-neutral-400 hover:text-white"
              >
                Advanced controls
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className={`transition-transform ${advanced ? "rotate-180" : ""}`}
                />
              </button>
              {advanced && (
                <div className="mt-4 space-y-4 rounded-lg border border-white/8 p-4">
                  <SwitchRow
                    title="Per-transaction limit"
                    body="Decline any single purchase above this amount"
                    checked={txnOn}
                    onChange={setTxnOn}
                  />
                  {txnOn && (
                    <AmountInput
                      value={txnAmount}
                      onChange={setTxnAmount}
                      size="md"
                      label="Per-transaction limit amount"
                    />
                  )}
                  <SwitchRow
                    title="Online payments"
                    body="Allow e-commerce and in-app purchases"
                    checked={online}
                    onChange={setOnline}
                  />
                  <SwitchRow
                    title="International payments"
                    body="Allow merchants outside the cardholder’s country"
                    checked={international}
                    onChange={setInternational}
                  />
                </div>
              )}
            </FormSection>
          </div>
        </div>

        {/* Live preview */}
        <aside className="hidden w-2/5 shrink-0 border-l border-white/7 bg-surface-2 lg:block">
          <div className="sticky top-0 mx-auto max-w-[460px] px-10 py-10">
            <div className="card-stage rounded-2xl px-8 py-10">
              <FlatCard
                card={{
                  holder: name || "Cardholder name",
                  last4: "••••",
                  type,
                  expiry: "2029-10-31",
                }}
                frozen={false}
              />
            </div>

            <dl className="mt-8 divide-y divide-white/6 border-y border-white/7 text-[13px]">
              <SummaryRow
                label="Cardholder"
                value={name || "—"}
                muted={!name}
              />
              <SummaryRow label="Type" value={type} />
              <SummaryRow
                label="Limit"
                value={limit > 0 ? `${money(limit)} / ${perUnit[period]}` : "—"}
                muted={limit <= 0}
              />
              <SummaryRow
                label="Funded from"
                value={
                  source.asset === "USDC"
                    ? `USDC · ${source.label}`
                    : source.label
                }
              />
            </dl>

            <div className="mt-6 rounded-lg border border-white/8 p-4">
              <div className="text-xs text-neutral-500">Funding runway</div>
              <div className="mt-1 text-[13px] text-neutral-100">
                {limit > 0 ? (
                  <>
                    {source.label} covers this limit{" "}
                    <span className="text-white tabular-nums">
                      {runway.toLocaleString("en-US")}×
                    </span>{" "}
                    at today’s balance.
                  </>
                ) : (
                  "Set a limit to see how long this balance lasts."
                )}
              </div>
              {source.asset === "USDC" && (
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Purchases convert USDC to USD at the moment of spend, so funds
                  stay in your wallet until they’re used.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex h-16 shrink-0 items-center justify-end gap-2 border-t border-white/7 px-6">
        <button
          type="button"
          onClick={onClose}
          className="h-9 rounded-md px-4 text-[13px] text-neutral-300 hover:bg-white/6 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() =>
            onIssue({
              holder: name,
              customerId: customerId.trim(),
              type,
              funding: source,
              limit,
              period,
              perTransactionLimit: txnOn ? txnLimit : null,
              online,
              international,
            })
          }
          className="h-9 rounded-md bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Issue {type.toLowerCase()} card
        </button>
      </footer>
    </div>
  );
}

function FormSection({
  step,
  title,
  note,
  children,
}: {
  step: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="text-xs text-neutral-600 tabular-nums">{step}</span>
        <div>
          <h2 className="text-[15px] font-medium text-white">{title}</h2>
          {note && <p className="mt-0.5 text-xs text-neutral-500">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  autoFocus = false,
  mono = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1.5 block h-10 w-full rounded-lg border border-white/10 bg-white/3 px-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-brand ${
          mono ? "font-mono text-[13px]" : ""
        }`}
      />
      {hint && (
        <span className="mt-1.5 block text-xs text-neutral-600">{hint}</span>
      )}
    </label>
  );
}

function SwitchRow({
  title,
  body,
  checked,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[13px] text-neutral-100">{title}</div>
        <div className="text-xs text-neutral-500">{body}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-neutral-500">{label}</dt>
      <dd
        className={`truncate ${muted ? "text-neutral-600" : "text-neutral-100"}`}
      >
        {value}
      </dd>
    </div>
  );
}
