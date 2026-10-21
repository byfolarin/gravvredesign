"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { AS_OF, PROVISION_STEPS, accountMeta, type Account } from "../_data";
import { FLAGS, NAMES } from "./currency";

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
              <span aria-hidden className="text-[26px] leading-none">
                {FLAGS[a.currency]}
              </span>
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
              href="/transactions"
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

        <div className="space-y-6 px-6 py-5">
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
                            ? "border-[var(--flow-in)] bg-[var(--flow-in)] text-black"
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
              label="Inflow behaviour"
              value={meta.inflow}
              hint={
                meta.inflow === "Settle"
                  ? "Deposits move to the linked wallet"
                  : "Deposits stay in this account"
              }
            />
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs text-neutral-500">{title}</h3>
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
