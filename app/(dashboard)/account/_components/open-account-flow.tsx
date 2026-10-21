"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import {
  ALL_CURRENCIES,
  BANKS,
  PROVISION_STEPS,
  type Account,
  type Category,
  type Currency,
} from "../_data";
import { FLAGS, NAMES, RAILS, READY_IN } from "./currency";

type Step = "currency" | "holder" | "review" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "currency", label: "Currency" },
  { id: "holder", label: "Account holder" },
  { id: "review", label: "Review & open" },
];
const PURPOSES = ["Operating", "Collections", "Payouts", "Payroll", "Treasury"];
const WORKSPACE = { name: "Kredete", email: "treasury@kredete.com" };

type Holder = { name: string; email: string; category: Category };

/**
 * Open an account: pick the currency, say who holds it, review. The bank does the rest —
 * the new account lands in the list as Provisioning and moves through the same steps.
 */
export function OpenAccountFlow({
  accounts,
  initialCurrency,
  onClose,
  onCreated,
}: {
  accounts: Account[];
  /** Chosen before the flow opened, e.g. from the balance's currency editor. */
  initialCurrency?: Currency;
  onClose: () => void;
  /** `view` is true when they asked to see the account straight away. */
  onCreated: (a: Account, view: boolean) => void;
}) {
  const [step, setStep] = useState<Step>(
    initialCurrency ? "holder" : "currency",
  );
  const [currency, setCurrency] = useState<Currency | null>(
    initialCurrency ?? null,
  );
  const [holderKind, setHolderKind] = useState<"customer" | "workspace">(
    "customer",
  );
  const [customer, setCustomer] = useState<Holder | null>(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [nickname, setNickname] = useState("");
  const [created, setCreated] = useState<Account | null>(null);

  // Bottom sheet: slides up, and back down before it unmounts.
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return onClose();
    setLeaving(true);
    setTimeout(onClose, 260);
  }, [onClose]);
  const guard = useDiscardGuard(close);
  const ask = guard.requestClose;
  // Once requested, closing any way keeps the account (same as Done); before that, ask.
  const requestClose = useCallback(
    () => (created ? onCreated(created, false) : ask()),
    [created, onCreated, ask],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // How many accounts already exist per currency, and who the customers are.
  const held = useMemo(() => {
    const out = {} as Record<Currency, number>;
    for (const c of ALL_CURRENCIES) out[c] = 0;
    for (const a of accounts) if (a.status !== "Closed") out[a.currency]++;
    return out;
  }, [accounts]);
  const customers = useMemo(() => {
    const seen = new Map<string, Holder>();
    for (const a of accounts)
      if (!seen.has(a.customer.name))
        seen.set(a.customer.name, { ...a.customer, category: a.category });
    return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [accounts]);
  const matches = customers
    .filter((c) =>
      `${c.name} ${c.email}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice(0, 6);

  const holder: Holder | null =
    holderKind === "workspace"
      ? { ...WORKSPACE, category: "Business" }
      : customer;
  const label =
    nickname.trim() ||
    (holder
      ? `${holder.category === "Business" ? holder.name : holder.name.split(" ")[0]} · ${purpose}`
      : "");
  const bank = currency ? BANKS[currency][0] : null;
  const at = STEPS.findIndex((s) => s.id === step);

  const open = (view: boolean) => {
    if (created) return onCreated(created, view);
  };
  const submit = () => {
    if (!currency || !holder || !bank) return;
    const now = new Date().toISOString();
    const digits = (n: number) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
    const a: Account = {
      id: crypto.randomUUID(),
      label,
      customer: { name: holder.name, email: holder.email },
      category: holder.category,
      bank: bank.bank,
      currency,
      balance: 0,
      status: "Pending",
      accountNumber: currency === "GBP" ? digits(8) : digits(12),
      routing: bank.routing(),
      createdAt: now,
      step: 0,
      stepSince: now,
    };
    guard.clear();
    setCreated(a);
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-50" data-leaving={leaving || undefined}>
      <div
        aria-hidden
        onClick={requestClose}
        className="sheet-scrim absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Open an account"
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        className="sheet-panel absolute inset-x-0 top-[7vh] bottom-0 overflow-y-auto rounded-t-[22px] bg-takeover shadow-[0_-24px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/8"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-[13px] text-neutral-300">Open an account</div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-auto grid max-w-[1100px] grid-cols-[160px_minmax(0,440px)_300px] gap-12 px-6 pb-20">
          {/* Step rail — completed steps can be revisited */}
          <ol className="sticky top-6 mt-10 h-fit border-l border-white/8">
            {STEPS.map((st, i) => {
              const current = st.id === step;
              const done = step === "done" || at > i;
              return (
                <li key={st.id}>
                  <button
                    type="button"
                    disabled={!done || step === "done"}
                    onClick={() => setStep(st.id)}
                    className={`-ml-px block w-full border-l py-1.5 pl-4 text-left text-[13px] ${
                      current
                        ? "border-white text-white"
                        : done
                          ? "border-transparent text-neutral-300 enabled:hover:text-white"
                          : "border-transparent text-neutral-600"
                    }`}
                  >
                    {st.label}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="min-w-0">
            {step === "currency" && (
              <StepForm
                title="Currency"
                lead="Which currency should the account hold? Each one comes with local bank details, so payers send money the way they already do."
                canContinue={!!currency}
                onContinue={() => setStep("holder")}
                onCancel={requestClose}
              >
                <div
                  role="radiogroup"
                  aria-label="Currency"
                  className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10"
                >
                  {ALL_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={currency === c}
                      onClick={() => setCurrency(c)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        currency === c
                          ? "bg-white/[0.06]"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="text-[17px] leading-none">
                        {FLAGS[c]}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-white">
                          {NAMES[c]}{" "}
                          <span className="text-neutral-500">{c}</span>
                        </span>
                        <span className="block text-[12px] text-neutral-500">
                          Receive by {RAILS[c]}
                        </span>
                      </span>
                      <span className="shrink-0 text-[12px] text-neutral-500 tabular-nums">
                        {held[c]
                          ? `${held[c].toLocaleString("en-US")} open`
                          : "New"}
                      </span>
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          currency === c
                            ? "border-white bg-white text-black"
                            : "border-white/20"
                        }`}
                      >
                        {currency === c && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>
                  ))}
                </div>
              </StepForm>
            )}

            {step === "holder" && (
              <StepForm
                title="Account holder"
                lead="Who the account belongs to. We use the verification already on file for them, so there's nothing to upload."
                canContinue={!!holder}
                onContinue={() => setStep("review")}
                onBack={() => setStep("currency")}
              >
                <Segmented
                  value={holderKind}
                  options={[
                    { value: "customer", label: "A customer" },
                    {
                      value: "workspace",
                      label: `${WORKSPACE.name} (your business)`,
                    },
                  ]}
                  onChange={setHolderKind}
                />
                {holderKind === "customer" && (
                  <Field label="Customer">
                    {customer ? (
                      <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3 py-2.5">
                        <Initials name={customer.name} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] text-neutral-100">
                            {customer.name}
                          </span>
                          <span className="block truncate text-[11px] text-neutral-500">
                            {customer.category} · {customer.email}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomer(null);
                            setPickerOpen(true);
                          }}
                          className="text-[12px] text-neutral-500 hover:text-white"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="relative">
                        <label className="flex h-10 items-center gap-2 rounded-lg border border-white/12 px-3 transition-colors focus-within:border-white/35">
                          <Search
                            size={14}
                            strokeWidth={1.75}
                            className="text-neutral-500"
                          />
                          <input
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setPickerOpen(true);
                            }}
                            onFocus={() => setPickerOpen(true)}
                            onBlur={() =>
                              setTimeout(() => setPickerOpen(false), 120)
                            }
                            placeholder="Search customers by name or email"
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
                          />
                        </label>
                        {pickerOpen && (
                          <div className="absolute inset-x-0 top-full z-10 mt-1.5 rounded-lg border border-white/10 bg-surface p-1 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]">
                            {matches.length ? (
                              matches.map((c) => (
                                <button
                                  key={c.name}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setCustomer(c);
                                    setQuery("");
                                    setPickerOpen(false);
                                  }}
                                  className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.06]"
                                >
                                  <Initials name={c.name} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-[13px] text-neutral-100">
                                      {c.name}
                                    </span>
                                    <span className="block truncate text-[11px] text-neutral-500">
                                      {c.category} · {c.email}
                                    </span>
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-2 py-2 text-[12px] text-neutral-500">
                                No customer matches “{query}”.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Field>
                )}
                <Field label="What it's for">
                  <div className="flex flex-wrap gap-1.5">
                    {PURPOSES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={purpose === p}
                        onClick={() => setPurpose(p)}
                        className={`h-8 rounded-full border px-3 text-[12px] transition-colors ${
                          purpose === p
                            ? "border-white/40 bg-white/[0.08] text-white"
                            : "border-white/10 text-neutral-400 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Account name" optional>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={label || "e.g. Toronto collections"}
                    className="h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35"
                  />
                  <p className="mt-1.5 text-[12px] text-neutral-500">
                    Only your team sees this. Leave it empty to use the
                    suggestion.
                  </p>
                </Field>
              </StepForm>
            )}

            {step === "review" && currency && holder && bank && (
              <StepForm
                title="Review & open"
                lead={`${bank.bank} sets the account up. It usually takes ${READY_IN[currency]}; you can follow it in Accounts.`}
                canContinue
                continueLabel="Open account"
                onContinue={submit}
                onBack={() => setStep("holder")}
              >
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10">
                  <ReviewRow
                    label="Currency"
                    value={`${FLAGS[currency]}  ${NAMES[currency]} (${currency})`}
                    onEdit={() => setStep("currency")}
                  />
                  <ReviewRow
                    label="Holder"
                    value={`${holder.name} · ${holder.category}`}
                    onEdit={() => setStep("holder")}
                  />
                  <ReviewRow
                    label="Name"
                    value={label}
                    onEdit={() => setStep("holder")}
                  />
                </div>
                <div>
                  <div className="mb-3 text-[13px] text-neutral-200">
                    What happens next
                  </div>
                  <Timeline at={-1} />
                </div>
              </StepForm>
            )}

            {step === "done" && created && (
              <div className="mt-10">
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  {created.currency} account requested
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                  {created.bank} is setting up “{created.label}”. It shows in
                  Accounts as Provisioning until the bank issues the account
                  details — usually {READY_IN[created.currency]}.
                </p>
                <div className="mt-8">
                  <Timeline at={0} />
                </div>
                <div className="mt-10 flex justify-between">
                  <button
                    type="button"
                    onClick={() => open(false)}
                    className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => open(true)}
                    className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black hover:bg-neutral-200"
                  >
                    View account
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* What you're opening, filling in as you go */}
          <aside className="sticky top-6 mt-10 h-fit rounded-2xl border border-white/10 p-5">
            <div className="text-[10.5px] tracking-[0.08em] text-neutral-500 uppercase">
              New account
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-[22px] leading-none">
                {currency ? FLAGS[currency] : ""}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-white">
                  {currency ? `${currency} account` : "Choose a currency"}
                </span>
                <span className="block truncate text-[12px] text-neutral-500">
                  {label || "Account holder not chosen"}
                </span>
              </span>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4 text-[12px]">
              <SummaryRow label="Bank" value={bank?.bank} />
              <SummaryRow label="Details" value={bank?.routing().label} />
              <SummaryRow
                label="Receives by"
                value={currency ? RAILS[currency] : undefined}
              />
              <SummaryRow
                label="Ready in"
                value={currency ? READY_IN[currency] : undefined}
              />
            </dl>
          </aside>
        </div>
      </div>
      {guard.asking && (
        <DiscardConfirm
          title="Discard this account?"
          onKeep={guard.keep}
          onDiscard={guard.discard}
          className="absolute inset-x-0 top-[7vh] bottom-0 rounded-t-[22px]"
        />
      )}
    </div>
  );
}

/** Provisioning steps; `at` is the step in progress (-1 when nothing has started). */
function Timeline({ at }: { at: number }) {
  return (
    <ol className="space-y-0">
      {PROVISION_STEPS.map((s, i) => {
        const done = i <= at;
        const current = at >= 0 && i === at + 1;
        return (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
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
                  : current
                    ? "border-dashed border-white/50 text-white"
                    : "border-white/15 text-neutral-500"
              }`}
            >
              {done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className="pt-px text-[13px]">
              <span
                className={done || current ? "text-white" : "text-neutral-500"}
              >
                {s}
              </span>
              {current && (
                <span className="ml-2 text-neutral-500">In progress</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepForm({
  title,
  lead,
  children,
  canContinue,
  continueLabel = "Continue",
  onContinue,
  onBack,
  onCancel,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
  canContinue: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="mt-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
    >
      <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
        {title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        {lead}
      </p>
      <div className="mt-8 space-y-6">{children}</div>
      <div className="mt-10 flex justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] pr-4 pl-3 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canContinue}
          className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          {continueLabel}
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  optional = false,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] text-neutral-200">
        {label}
        {optional && <span className="ml-1 text-neutral-500">(Optional)</span>}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-full bg-white/[0.07] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-3.5 text-[12px] transition-colors ${
            value === o.value
              ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 text-[13px]">
      <span className="w-20 shrink-0 text-neutral-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-neutral-100">{value}</span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-[12px] text-neutral-500 transition-colors hover:text-white"
      >
        Edit
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="truncate text-right text-neutral-200">{value ?? "—"}</dd>
    </div>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[11px] text-neutral-200">
      {name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
