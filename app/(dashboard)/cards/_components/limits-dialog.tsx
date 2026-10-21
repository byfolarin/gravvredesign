"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Card, LimitPeriod } from "../_data";
import { dateFmt, money, usageTone } from "../_lib/format";

export type LimitSettings = Pick<
  Card,
  "monthlyLimit" | "limitPeriod" | "perTransactionLimit" | "alertAt"
>;

const periods: LimitPeriod[] = ["Daily", "Weekly", "Monthly"];

export function parseAmount(raw: string) {
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function AmountInput({
  value,
  onChange,
  size = "lg",
  autoFocus = false,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  size?: "lg" | "md";
  autoFocus?: boolean;
  label: string;
}) {
  return (
    <label
      className={`flex items-baseline gap-1 rounded-lg border border-white/10 bg-white/3 px-3 focus-within:border-brand ${
        size === "lg" ? "py-2.5" : "py-1.5"
      }`}
    >
      <span
        className={
          size === "lg"
            ? "text-xl text-neutral-500"
            : "text-sm text-neutral-500"
        }
      >
        $
      </span>
      <input
        aria-label={label}
        autoFocus={autoFocus}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        className={`min-w-0 flex-1 bg-transparent text-white tabular-nums outline-none ${
          size === "lg" ? "text-[26px] tracking-[-0.02em]" : "text-sm"
        }`}
      />
      <span className="text-xs text-neutral-500">USD</span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand" : "bg-white/15"}`}
    >
      <span
        className={`absolute top-0.5 size-4 rounded-full transition-[left] ${
          checked ? "left-[18px] bg-black" : "left-0.5 bg-neutral-400"
        }`}
      />
    </button>
  );
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: LimitPeriod;
  onChange: (p: LimitPeriod) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Limit period"
      className="flex rounded-md border border-white/8 p-0.5"
    >
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          onClick={() => onChange(p)}
          className={`h-7 flex-1 rounded text-xs transition-colors ${
            value === p
              ? "bg-white/10 text-white"
              : "text-neutral-500 hover:text-neutral-200"
          }`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}

export function resetCopy(period: LimitPeriod, resetsOn: string) {
  if (period === "Daily") return "Resets every day at 00:00 UTC";
  if (period === "Weekly") return "Resets every Monday at 00:00 UTC";
  return `Resets ${dateFmt.format(new Date(resetsOn))}`;
}

export function LimitsDialog({
  card,
  onClose,
  onSave,
}: {
  card: Card;
  onClose: () => void;
  onSave: (settings: LimitSettings) => void;
}) {
  const [amount, setAmount] = useState(String(card.monthlyLimit));
  const [period, setPeriod] = useState<LimitPeriod>(card.limitPeriod);
  const [txnOn, setTxnOn] = useState(card.perTransactionLimit !== null);
  const [txnAmount, setTxnAmount] = useState(
    String(card.perTransactionLimit ?? 500),
  );
  const [alertOn, setAlertOn] = useState(card.alertAt !== null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const limit = parseAmount(amount);
  const txnLimit = parseAmount(txnAmount);
  const valid = limit > 0 && (!txnOn || (txnLimit > 0 && txnLimit <= limit));
  const first = card.holder.split(" ")[0];

  // Live consequence preview. Spend-to-date is only known for the monthly period.
  const monthly = period === "Monthly";
  const ratio = monthly && limit > 0 ? card.spentThisMonth / limit : 0;
  const headroom = Math.max(0, limit - card.spentThisMonth);
  const below = monthly && limit > 0 && limit < card.spentThisMonth;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(0_0_0/0.6)] p-4 backdrop-blur-[2px]"
      onPointerDown={(e) => {
        if (!panel.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="limits-title"
        className="w-full max-w-[440px] rounded-xl border border-white/10 bg-raised shadow-2xl"
      >
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h2
              id="limits-title"
              className="text-[15px] font-medium text-white"
            >
              Spending limit
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
              {card.holder} · ••{card.last4}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-5 px-6 pt-5 pb-6">
          <div className="space-y-2">
            <AmountInput
              value={amount}
              onChange={setAmount}
              autoFocus
              label="Spending limit amount"
            />
            <PeriodPicker value={period} onChange={setPeriod} />
            <p className="text-xs text-neutral-500">
              {resetCopy(period, card.resetsOn)}
            </p>
          </div>

          {/* Consequence preview */}
          <div className="rounded-lg border border-white/8 bg-white/2 p-4">
            {monthly ? (
              <>
                <div className="flex items-baseline justify-between text-xs tabular-nums">
                  <span className="text-neutral-400">
                    {money(card.spentThisMonth)} spent of {money(limit)}
                  </span>
                  <span className="text-neutral-500">
                    {limit > 0 ? Math.round(ratio * 100) : 0}%
                  </span>
                </div>
                <div className="mt-2 h-1 rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${usageTone(ratio)}`}
                    style={{ width: `${Math.min(100, ratio * 100)}%` }}
                  />
                </div>
                <p
                  className={`mt-3 text-[13px] ${below ? "font-medium text-white" : "text-neutral-200"}`}
                >
                  {limit <= 0
                    ? "Enter a limit to see the effect."
                    : below
                      ? `This is below the ${money(card.spentThisMonth)} already spent. New purchases will be declined until the limit resets.`
                      : `${first} can spend ${money(headroom)} more before ${dateFmt.format(new Date(card.resetsOn))}.`}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-neutral-200">
                {limit > 0
                  ? `${first} can spend up to ${money(limit)} per ${period === "Daily" ? "day" : "week"}.`
                  : "Enter a limit to see the effect."}
              </p>
            )}
          </div>

          <div className="space-y-4 border-t border-white/7 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px] text-neutral-100">
                  Per-transaction limit
                </div>
                <div className="text-xs text-neutral-500">
                  Decline any single purchase above this amount
                </div>
              </div>
              <Toggle
                checked={txnOn}
                onChange={setTxnOn}
                label="Per-transaction limit"
              />
            </div>
            {txnOn && (
              <div>
                <AmountInput
                  value={txnAmount}
                  onChange={setTxnAmount}
                  size="md"
                  label="Per-transaction limit amount"
                />
                {txnLimit > limit && limit > 0 && (
                  <p className="mt-1.5 text-xs font-medium text-white">
                    Can’t be higher than the {period.toLowerCase()} limit.
                  </p>
                )}
              </div>
            )}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[13px] text-neutral-100">Alert at 80%</div>
                <div className="text-xs text-neutral-500">
                  Email card admins when spend reaches 80% of the limit
                </div>
              </div>
              <Toggle
                checked={alertOn}
                onChange={setAlertOn}
                label="Alert at 80%"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/7 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md px-3 text-[13px] text-neutral-300 hover:bg-white/6 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onSave({
                monthlyLimit: limit,
                limitPeriod: period,
                perTransactionLimit: txnOn ? txnLimit : null,
                alertAt: alertOn ? 0.8 : null,
              })
            }
            className="h-8 rounded-md bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save limit
          </button>
        </div>
      </div>
    </div>
  );
}
