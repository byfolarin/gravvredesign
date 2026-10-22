"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  MapPin,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { PersonAvatar } from "@/app/_components/person-avatar";
import { PixelField, wash } from "@/app/_components/pixel-field";
import { toneClass, toneFor } from "@/app/_components/tone";
import {
  ALL_CURRENCIES,
  BANKS,
  PROVISION_STEPS,
  type Account,
  type Currency,
} from "../_data";
import { ChainMark } from "./chain-mark";
import { FLAGS, NAMES } from "./currency";
import {
  BUSINESS,
  NETWORKS,
  PURPOSES,
  UNVERIFIED,
  WALLETS,
  providersFor,
  stateFor,
  type Chain,
  type Holder,
  type Provider,
  type Purpose,
} from "./open-account-data";

const STEPS = ["Holder", "Account", "Settlement", "Review"] as const;
type Settle = { kind: "new"; chain: Chain } | { kind: "existing"; id: string };

/**
 * Open an account — a full-screen flow built from Gravv's real one (who it's for → where →
 * currency → bank → account type → settlement wallet → review), split so each screen asks one
 * thing. Choices are shown side by side so they can be compared, and the account takes shape
 * on the right as you go: holder, bank, how money reaches it, where it settles.
 */
export function OpenAccountFlow({
  accounts,
  initialCurrency,
  onClose,
  onCreated,
}: {
  accounts: Account[];
  initialCurrency?: Currency;
  onClose: () => void;
  /** `view` is true when they asked to see the account straight away. */
  onCreated: (a: Account, view: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [kind, setKind] = useState<"business" | "customer" | null>(null);
  const [customer, setCustomer] = useState<Holder | null>(null);
  const [currency, setCurrency] = useState<Currency | null>(
    initialCurrency ?? null,
  );
  const [bank, setBank] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("Operating");
  const [nickname, setNickname] = useState("");
  const [settle, setSettle] = useState<Settle>({
    kind: "new",
    chain: "Polygon",
  });
  const [created, setCreated] = useState<Account | null>(null);

  const close = useCallback(() => onClose(), [onClose]);
  const guard = useDiscardGuard(close);
  const ask = guard.requestClose;
  const requestClose = useCallback(
    () => (created ? onCreated(created, false) : ask()),
    [created, onCreated, ask],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Verified customers are the ones who already hold accounts; the rest can't yet.
  const customers = useMemo(() => {
    const seen = new Map<string, Holder>();
    for (const a of accounts)
      if (!seen.has(a.customer.name))
        seen.set(a.customer.name, {
          ...a.customer,
          category: a.category,
          state: stateFor(a.customer.name),
          country: "United States",
        });
    return [...seen.values()].sort((x, y) => x.name.localeCompare(y.name));
  }, [accounts]);

  const holder = kind === "business" ? BUSINESS : customer;
  const providers = currency ? providersFor(currency) : [];
  const offered = providers.filter(
    (p) => !holder || !p.notIn?.includes(holder.state),
  );
  const notOffered = providers.filter((p) => !offered.includes(p));
  const provider = offered.find((p) => p.bank === bank) ?? null;
  const label =
    nickname.trim() ||
    (holder && currency
      ? `${holder.category === "Business" ? holder.name : holder.name.split(" ")[0]} · ${purpose}`
      : "");

  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    const list = providersFor(c).filter(
      (p) => !holder || !p.notIn?.includes(holder.state),
    );
    // One bank on offer: nothing to choose.
    setBank(list.length === 1 ? list[0].bank : null);
  };

  const ready = [
    !!holder,
    !!currency && !!provider,
    settle.kind === "new" || !!settle.id,
    true,
  ];
  const missing = [
    "Choose who will hold it",
    currency ? "Choose a bank" : "Choose a currency",
    "Choose a wallet",
    "",
  ][step];

  const go = (s: number) => {
    setStep(s);
    setReached((r) => Math.max(r, s));
  };

  const submit = () => {
    if (!holder || !currency || !provider) return;
    const now = new Date().toISOString();
    const digits = (n: number) =>
      Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
    const known = BANKS[currency].find((b) => b.bank === provider.bank);
    const a: Account = {
      id: crypto.randomUUID(),
      label,
      customer: { name: holder.name, email: holder.email },
      category: holder.category,
      bank: provider.bank,
      currency,
      balance: 0,
      status: "Pending",
      accountNumber: currency === "GBP" ? digits(8) : digits(12),
      routing: known
        ? known.routing()
        : { label: "Routing number", value: "Issued on activation" },
      createdAt: now,
      step: 0,
      stepSince: now,
    };
    guard.clear();
    setCreated(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Open an account"
      onInputCapture={guard.markDirty}
      onChangeCapture={guard.markDirty}
      onClickCapture={guard.markDirty}
      className="orbit-pop fixed inset-0 z-50 flex flex-col bg-takeover text-neutral-200"
    >
      {/* Top bar: leave on the left, where you are in the middle */}
      <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-white/8 px-5">
        <div className="flex w-[220px] items-center gap-3">
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            data-keeps-clean
            className="flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
          <span className="text-[14px] text-white">Open an account</span>
        </div>
        <ol className="flex items-center gap-2 max-md:hidden">
          {STEPS.map((s, i) => {
            const done = !!created || i < step;
            const here = !created && i === step;
            const can = !created && i <= reached && i !== step;
            return (
              <li key={s} className="flex items-center gap-2">
                {i > 0 && (
                  <span
                    aria-hidden
                    className={`h-px w-8 ${i <= step || created ? "bg-white/30" : "bg-white/10"}`}
                  />
                )}
                <button
                  type="button"
                  disabled={!can}
                  onClick={() => go(i)}
                  data-keeps-clean
                  className={`flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-[13px] transition-colors ${
                    here
                      ? "text-white"
                      : done
                        ? "text-neutral-300 enabled:hover:text-white"
                        : "text-neutral-600"
                  }`}
                >
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums ${
                      done
                        ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
                        : here
                          ? "bg-white text-black"
                          : "ring-1 ring-white/15"
                    }`}
                  >
                    {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  {s}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="w-[220px]" />
      </header>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1120px] gap-16 px-8 pt-14 pb-10 lg:grid-cols-[minmax(0,1fr)_380px]">
          <main key={created ? "done" : step} className="orbit-pop min-w-0">
            {created && provider ? (
              <Done
                a={created}
                provider={provider}
                onDone={() => onCreated(created, false)}
                onView={() => onCreated(created, true)}
              />
            ) : step === 0 ? (
              <HolderStep
                kind={kind}
                onKind={setKind}
                customer={customer}
                onCustomer={(c) => {
                  setCustomer(c);
                  // A bank that doesn't serve their state can't stay picked.
                  if (currency && bank) {
                    const p = providersFor(currency).find(
                      (x) => x.bank === bank,
                    );
                    if (p?.notIn?.includes(c.state)) setBank(null);
                  }
                }}
                customers={customers}
              />
            ) : step === 1 && holder ? (
              <AccountStep
                holder={holder}
                currency={currency}
                onCurrency={pickCurrency}
                offered={offered}
                notOffered={notOffered}
                bank={bank}
                onBank={setBank}
                purpose={purpose}
                onPurpose={setPurpose}
                nickname={nickname}
                onNickname={setNickname}
                suggestion={label}
              />
            ) : step === 2 ? (
              <SettlementStep settle={settle} onSettle={setSettle} />
            ) : holder && currency && provider ? (
              <ReviewStep
                holder={holder}
                currency={currency}
                provider={provider}
                purpose={purpose}
                label={label}
                settle={settle}
                onEdit={go}
              />
            ) : null}
          </main>

          <aside className="max-lg:hidden">
            <div className="sticky top-0">
              <AccountPreview
                holder={holder}
                currency={currency}
                provider={provider}
                label={label}
                settle={step >= 2 || created ? settle : null}
                requested={!!created}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Footer: back, what's missing, continue */}
      {!created && (
        <footer className="shrink-0 border-t border-white/8">
          <div className="mx-auto flex h-[72px] max-w-[1120px] items-center gap-4 px-8">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => go(step - 1)}
                data-keeps-clean
                className="flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <ArrowLeft size={15} strokeWidth={1.75} />
                Back
              </button>
            ) : (
              <span />
            )}
            <span className="ml-auto text-[12.5px] text-neutral-500">
              {step === 3
                ? "Nothing is sent until you open it."
                : ready[step]
                  ? ""
                  : missing}
            </span>
            <button
              type="button"
              disabled={!ready[step]}
              onClick={() => (step === 3 ? submit() : go(step + 1))}
              data-keeps-clean
              className="h-10 rounded-full bg-white px-6 text-[13.5px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-35"
            >
              {step === 3 ? "Open account" : "Continue"}
            </button>
          </div>
        </footer>
      )}

      {guard.asking && (
        <DiscardConfirm
          title="Discard this account?"
          onKeep={guard.keep}
          onDiscard={guard.discard}
        />
      )}
    </div>
  );
}

/* ——— Shared pieces ——— */

function Heading({
  step,
  title,
  sub,
}: {
  step: number;
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-10">
      <div className="text-[12px] tracking-[0.02em] text-neutral-500">
        Step {step + 1} of {STEPS.length}
      </div>
      <h1 className="mt-2 text-[30px] leading-[1.15] font-medium tracking-[-0.03em] text-white">
        {title}
      </h1>
      <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-neutral-400">
        {sub}
      </p>
    </div>
  );
}

function Label({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 className="text-[13px] font-medium text-white">{children}</h2>
      {hint && <span className="text-[12px] text-neutral-500">{hint}</span>}
    </div>
  );
}

/** The selected mark: a filled disc with a check, or an empty ring. */
function Tick({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-5 shrink-0 items-center justify-center rounded-full transition-colors ${
        on ? "bg-white text-black" : "ring-1 ring-white/20"
      }`}
    >
      {on && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

const OPTION =
  "group flex w-full items-center gap-4 rounded-2xl border px-5 text-left transition-[border-color,background-color]";
const optionState = (on: boolean) =>
  on
    ? "border-white/45 bg-white/[0.035]"
    : "border-white/10 hover:border-white/25";

function Initials({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[10px] text-[12px] font-medium ${toneClass(toneFor(name))}`}
      style={{ width: size, height: size }}
    >
      {name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}

function HolderMark({ h, size = 36 }: { h: Holder; size?: number }) {
  return h.category === "Individual" ? (
    <PersonAvatar name={h.name} size={size} />
  ) : (
    <Initials name={h.name} size={size} />
  );
}

/* ——— Step 1: holder ——— */

function HolderStep({
  kind,
  onKind,
  customer,
  onCustomer,
  customers,
}: {
  kind: "business" | "customer" | null;
  onKind: (k: "business" | "customer") => void;
  customer: Holder | null;
  onCustomer: (c: Holder) => void;
  customers: Holder[];
}) {
  const [q, setQ] = useState("");
  const [showBlocked, setShowBlocked] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const needle = q.trim().toLowerCase();
  const match = (h: Holder) =>
    !needle || `${h.name} ${h.email}`.toLowerCase().includes(needle);
  const list = customers.filter(match);
  const blocked = UNVERIFIED.filter(match);
  const holder = kind === "business" ? BUSINESS : customer;

  return (
    <>
      <Heading
        step={0}
        title="Who will hold this account?"
        sub="The account is opened in their name. Where they're based decides which banks can open it."
      />
      <div role="radiogroup" className="space-y-3">
        <button
          type="button"
          role="radio"
          aria-checked={kind === "business"}
          onClick={() => onKind("business")}
          className={`${OPTION} py-4 ${optionState(kind === "business")}`}
        >
          <Initials name={BUSINESS.name} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] text-white">
              Your business
            </span>
            <span className="mt-0.5 block text-[12.5px] text-neutral-500">
              {BUSINESS.name} · verified · {BUSINESS.state}, {BUSINESS.country}
            </span>
          </span>
          <Tick on={kind === "business"} />
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={kind === "customer"}
          onClick={() => onKind("customer")}
          className={`${OPTION} py-4 ${optionState(kind === "customer")}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.06] text-neutral-300">
            <Users size={17} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] text-white">
              One of your customers
            </span>
            <span className="mt-0.5 block text-[12.5px] text-neutral-500">
              For their own money, in their name. They need to be verified.
            </span>
          </span>
          <Tick on={kind === "customer"} />
        </button>
      </div>

      {kind === "customer" && (
        <section className="orbit-pop mt-10">
          <Label hint={`${customers.length} verified`}>Which customer?</Label>
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 transition-colors focus-within:border-white/30">
            <Search size={15} strokeWidth={1.75} className="text-neutral-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email"
              data-keeps-clean
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
          <div
            role="radiogroup"
            className="sidebar-scroll mt-3 max-h-[330px] overflow-y-auto rounded-2xl border border-white/10"
          >
            {list.map((c) => {
              const on = customer?.name === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onCustomer(c)}
                  className={`flex w-full items-center gap-3.5 border-b border-white/[0.06] px-4 py-3 text-left transition-colors last:border-0 ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}
                >
                  <HolderMark h={c} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-white">
                      {c.name}
                    </span>
                    <span className="block truncate text-[12px] text-neutral-500">
                      {c.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] text-neutral-500">
                    {c.category} · {c.state}
                  </span>
                  <Tick on={on} />
                </button>
              );
            })}
            {list.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-neutral-500">
                No verified customer matches “{q}”.
              </div>
            )}
          </div>

          {/* Not ready yet: shown, explained, one click from fixing — never pickable */}
          {blocked.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowBlocked((v) => !v)}
                data-keeps-clean
                className="flex items-center gap-1.5 text-[12.5px] text-neutral-400 hover:text-white"
              >
                <ChevronDown
                  size={14}
                  strokeWidth={1.75}
                  className={`transition-transform ${showBlocked ? "rotate-180" : ""}`}
                />
                {blocked.length} customers can&apos;t hold an account yet
              </button>
              {showBlocked && (
                <ul className="orbit-pop mt-3 space-y-1">
                  {blocked.map((c) => (
                    <li
                      key={c.name}
                      className="flex items-center gap-3.5 rounded-xl px-4 py-2.5"
                    >
                      <span className="opacity-50 grayscale">
                        <HolderMark h={c} size={28} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-neutral-400">
                          {c.name}
                        </span>
                        <span className="block truncate text-[12px] text-amber-300/90">
                          {c.blocked}
                        </span>
                      </span>
                      {sent.has(c.name) ? (
                        <span className="flex items-center gap-1 text-[12px] text-[var(--ok-fg)]">
                          <Check size={13} strokeWidth={2.25} />
                          Link sent
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-keeps-clean
                          onClick={() => setSent((s) => new Set(s).add(c.name))}
                          className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-neutral-200 ring-1 ring-white/12 transition-colors hover:text-white hover:ring-white/30"
                        >
                          <Send size={12} strokeWidth={1.75} />
                          Send verification link
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {holder && (
        <p className="orbit-pop mt-8 flex items-center gap-2 text-[12.5px] text-neutral-500">
          <MapPin size={13} strokeWidth={1.75} />
          <span>
            {kind === "business" ? "Registered" : "Based"} in{" "}
            <span className="text-neutral-200">
              {holder.state}, {holder.country}
            </span>{" "}
            — from{" "}
            {kind === "business" ? "your business profile" : "their profile"}.
          </span>
        </p>
      )}
    </>
  );
}

/* ——— Step 2: currency, bank, purpose ——— */

function Flag({ c, size = 22 }: { c: Currency; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] leading-none"
      style={{ width: size, height: size, fontSize: size * 0.82 }}
    >
      {FLAGS[c]}
    </span>
  );
}

function BankMark({ p, size = 40 }: { p: Provider; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[11px] text-[13px] font-medium"
      style={{
        width: size,
        height: size,
        color: "#fff",
        background: `linear-gradient(140deg, ${p.tint}, color-mix(in oklab, ${p.tint} 55%, black))`,
      }}
    >
      {p.bank[0]}
    </span>
  );
}

function RailLine({ rails }: { rails: Provider["rails"] }) {
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
      {rails.map((r) => (
        <span key={r.name} className="whitespace-nowrap">
          <span className="text-neutral-200">{r.name}</span>
          {r.speed && (
            <span
              className={`ml-1.5 ${/instant|second/i.test(r.speed) ? "text-[var(--ok-fg)]" : "text-neutral-500"}`}
            >
              {r.speed}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

function AccountStep({
  holder,
  currency,
  onCurrency,
  offered,
  notOffered,
  bank,
  onBank,
  purpose,
  onPurpose,
  nickname,
  onNickname,
  suggestion,
}: {
  holder: Holder;
  currency: Currency | null;
  onCurrency: (c: Currency) => void;
  offered: Provider[];
  notOffered: Provider[];
  bank: string | null;
  onBank: (b: string) => void;
  purpose: Purpose;
  onPurpose: (p: Purpose) => void;
  nickname: string;
  onNickname: (v: string) => void;
  suggestion: string;
}) {
  const who = holder.name === BUSINESS.name ? "you" : holder.name.split(" ")[0];
  return (
    <>
      <Heading
        step={1}
        title="Which account?"
        sub={`Pick the currency, then the bank that opens it. Banks are paid by different rails, so compare how fast money will reach ${who}.`}
      />

      <section>
        <Label>Currency</Label>
        <div
          role="radiogroup"
          className="grid grid-cols-4 gap-2 max-sm:grid-cols-2"
        >
          {ALL_CURRENCIES.map((c) => {
            const on = currency === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onCurrency(c)}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-[border-color,background-color] ${optionState(on)}`}
              >
                <Flag c={c} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-white">
                    {c}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {NAMES[c]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {currency && (
        <section key={currency} className="orbit-pop mt-12">
          <Label
            hint={
              holder.country === "United States"
                ? `Opening ${currency} accounts in ${holder.state}`
                : `Opening ${currency} accounts`
            }
          >
            Bank
          </Label>
          <div role="radiogroup" className="space-y-3">
            {offered.map((p) => {
              const on = bank === p.bank;
              return (
                <button
                  key={p.bank}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onBank(p.bank)}
                  className={`${OPTION} items-start py-4 ${optionState(on)}`}
                >
                  <BankMark p={p} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="text-[14.5px] text-white">{p.bank}</span>
                      <span className="shrink-0 text-[12.5px] text-neutral-400">
                        Ready in {p.readyIn}
                      </span>
                    </span>
                    {p.note && (
                      <span className="mt-0.5 block text-[12px] text-[var(--ok-fg)]">
                        {p.note}
                      </span>
                    )}
                    <span className="mt-3 block border-t border-white/[0.06] pt-3">
                      <RailLine rails={p.rails} />
                    </span>
                    <span className="mt-1.5 block text-[12px] text-neutral-500">
                      {p.details} · up to {p.perHolder} per holder
                    </span>
                  </span>
                  <span className="pt-2.5">
                    <Tick on={on} />
                  </span>
                </button>
              );
            })}
          </div>
          {notOffered.map((p) => (
            <p key={p.bank} className="mt-3 text-[12.5px] text-neutral-500">
              {p.bank} doesn&apos;t open accounts in {holder.state}.
            </p>
          ))}
        </section>
      )}

      {currency && bank && (
        <section className="orbit-pop mt-12">
          <Label>What it&apos;s for</Label>
          <div
            role="radiogroup"
            className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"
          >
            {PURPOSES.map((p) => {
              const on = purpose === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onPurpose(p.id)}
                  className={`${OPTION} items-start py-3.5 ${optionState(on)}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-white">
                      {p.id}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                      {p.line}
                    </span>
                  </span>
                  <span className="pt-0.5">
                    <Tick on={on} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <Label hint="Only your team sees this">Name</Label>
            <input
              value={nickname}
              onChange={(e) => onNickname(e.target.value)}
              maxLength={60}
              placeholder={suggestion}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-[13.5px] text-white transition-colors outline-none placeholder:text-neutral-400 focus:border-white/30"
            />
            {!nickname && (
              <p className="mt-2 text-[12px] text-neutral-500">
                Leave it and we&apos;ll call it “{suggestion}”.
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}

/* ——— Step 3: settlement ——— */

function SettlementStep({
  settle,
  onSettle,
}: {
  settle: Settle;
  onSettle: (s: Settle) => void;
}) {
  const [lastChain, setLastChain] = useState<Chain>(
    settle.kind === "new" ? settle.chain : "Polygon",
  );
  const [lastWallet, setLastWallet] = useState(
    settle.kind === "existing" ? settle.id : "",
  );
  return (
    <>
      <Heading
        step={2}
        title="Where should the money go?"
        sub="Money that lands in this account is turned into USDC and moved to a wallet, automatically. Choose which one."
      />
      <div
        role="radiogroup"
        className="grid grid-cols-2 gap-3 max-sm:grid-cols-1"
      >
        {(
          [
            ["new", "A new wallet", "Gravv creates one just for this account."],
            [
              "existing",
              "A wallet you have",
              `${WALLETS.length} wallets in Gravv.`,
            ],
          ] as const
        ).map(([k, title, line]) => {
          const on = settle.kind === k;
          return (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() =>
                onSettle(
                  k === "new"
                    ? { kind: "new", chain: lastChain }
                    : { kind: "existing", id: lastWallet },
                )
              }
              className={`${OPTION} items-start py-4 ${optionState(on)}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] text-white">{title}</span>
                <span className="mt-0.5 block text-[12px] text-neutral-500">
                  {line}
                </span>
              </span>
              <Tick on={on} />
            </button>
          );
        })}
      </div>

      {settle.kind === "new" ? (
        <section className="orbit-pop mt-12">
          <Label hint="Speed and cost of each transfer">Network</Label>
          <div
            role="radiogroup"
            className="overflow-hidden rounded-2xl border border-white/10"
          >
            {NETWORKS.map((n) => {
              const on = settle.chain === n.chain;
              return (
                <button
                  key={n.chain}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setLastChain(n.chain);
                    onSettle({ kind: "new", chain: n.chain });
                  }}
                  className={`flex w-full items-center gap-3.5 border-b border-white/[0.06] px-4 py-3.5 text-left transition-colors last:border-0 ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}
                >
                  <ChainMark chain={n.chain} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-white">
                      {n.name}
                    </span>
                    {n.note && (
                      <span className="block text-[12px] text-[var(--ok-fg)]">
                        {n.note}
                      </span>
                    )}
                  </span>
                  <span className="w-16 text-right text-[12.5px] text-neutral-400 tabular-nums">
                    {n.speed}
                  </span>
                  <span className="w-20 text-right text-[12.5px] text-neutral-500 tabular-nums">
                    {n.fee}
                  </span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="orbit-pop mt-12">
          <Label hint="Settles on the wallet's own network">Wallet</Label>
          <div
            role="radiogroup"
            className="overflow-hidden rounded-2xl border border-white/10"
          >
            {WALLETS.map((w) => {
              const on = settle.id === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setLastWallet(w.id);
                    onSettle({ kind: "existing", id: w.id });
                  }}
                  className={`flex w-full items-center gap-3.5 border-b border-white/[0.06] px-4 py-3.5 text-left transition-colors last:border-0 ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"}`}
                >
                  <ChainMark chain={w.chain} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] text-white">
                      {w.label}
                    </span>
                    <span className="block font-mono text-[11.5px] text-neutral-500">
                      {w.chain} · {w.address}
                    </span>
                  </span>
                  <span className="amount text-right text-[13px] text-neutral-200 tabular-nums">
                    {w.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    <span className="text-[11px] text-neutral-500">USDC</span>
                  </span>
                  <Tick on={on} />
                </button>
              );
            })}
          </div>
        </section>
      )}
      <p className="mt-5 text-[12.5px] text-neutral-500">
        You can point the account at a different wallet later.
      </p>
    </>
  );
}

function settleWords(s: Settle) {
  if (s.kind === "new")
    return {
      chain: s.chain,
      text: `New wallet on ${NETWORKS.find((n) => n.chain === s.chain)!.name}`,
    };
  const w = WALLETS.find((x) => x.id === s.id);
  return w ? { chain: w.chain, text: `${w.label} · ${w.chain}` } : null;
}

/* ——— Step 4: review ——— */

function ReviewStep({
  holder,
  currency,
  provider,
  purpose,
  label,
  settle,
  onEdit,
}: {
  holder: Holder;
  currency: Currency;
  provider: Provider;
  purpose: Purpose;
  label: string;
  settle: Settle;
  onEdit: (step: number) => void;
}) {
  const s = settleWords(settle);
  const sections: {
    title: string;
    step: number;
    rows: [string, React.ReactNode][];
  }[] = [
    {
      title: "Holder",
      step: 0,
      rows: [
        [
          "Name",
          <span key="n" className="flex items-center justify-end gap-2">
            <HolderMark h={holder} size={20} />
            {holder.name}
          </span>,
        ],
        ["Type", holder.category],
        ["Based in", `${holder.state}, ${holder.country}`],
      ],
    },
    {
      title: "Account",
      step: 1,
      rows: [
        [
          "Currency",
          <span key="c" className="flex items-center justify-end gap-2">
            <Flag c={currency} size={18} />
            {currency} · {NAMES[currency]}
          </span>,
        ],
        ["Bank", provider.bank],
        [
          "Receives by",
          <span key="r" className="flex justify-end">
            <RailLine rails={provider.rails} />
          </span>,
        ],
        ["For", purpose],
        ["Name", label],
      ],
    },
    {
      title: "Settlement",
      step: 2,
      rows: [
        ["Converts to", "USDC, automatically"],
        [
          "Sends to",
          s ? (
            <span key="s" className="flex items-center justify-end gap-2">
              <ChainMark chain={s.chain} size={18} />
              {s.text}
            </span>
          ) : (
            "—"
          ),
        ],
      ],
    },
  ];
  return (
    <>
      <Heading
        step={3}
        title="Check it over"
        sub={`${provider.bank} reviews the application and issues the account details, usually in ${provider.readyIn}.`}
      />
      <div className="space-y-4">
        {sections.map((sec) => (
          <section
            key={sec.title}
            className="rounded-2xl border border-white/10 px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[12.5px] text-neutral-500">{sec.title}</h2>
              <button
                type="button"
                onClick={() => onEdit(sec.step)}
                data-keeps-clean
                className="text-[12.5px] text-neutral-300 underline decoration-white/20 underline-offset-4 hover:text-white"
              >
                Edit
              </button>
            </div>
            <dl className="mt-2">
              {sec.rows.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between gap-6 border-t border-white/[0.06] py-2.5 text-[13.5px] first:border-0"
                >
                  <dt className="shrink-0 text-neutral-500">{k}</dt>
                  <dd className="min-w-0 text-right text-white">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <Label>What happens next</Label>
        <Timeline at={-1} bank={provider.bank} readyIn={provider.readyIn} />
      </section>
    </>
  );
}

/** Provisioning, with when each step usually happens. `at` = last step done. */
function Timeline({
  at,
  bank,
  readyIn,
}: {
  at: number;
  bank: string;
  readyIn: string;
}) {
  const when = [
    at >= 0 ? "Just now" : "When you open it",
    "Usually within a few hours",
    bank,
    `In ${readyIn}`,
  ];
  return (
    <ol>
      {PROVISION_STEPS.map((s, i) => {
        const done = i <= at;
        const now = at >= 0 && i === at + 1;
        return (
          <li key={s} className="relative flex gap-4 pb-5 last:pb-0">
            {i < PROVISION_STEPS.length - 1 && (
              <span
                aria-hidden
                className={`absolute top-6 bottom-0 left-[10px] w-px ${done ? "bg-[var(--ok-fg)]/40" : "bg-white/10"}`}
              />
            )}
            <span
              className={`relative mt-0.5 flex size-[21px] shrink-0 items-center justify-center rounded-full text-[10.5px] tabular-nums ${
                done
                  ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
                  : now
                    ? "border border-dashed border-white/60 text-white"
                    : "text-neutral-500 ring-1 ring-white/15"
              }`}
            >
              {done ? <Check size={11} strokeWidth={3} /> : i + 1}
            </span>
            <span className="flex min-w-0 flex-1 items-baseline justify-between gap-4 text-[13.5px]">
              <span className={done || now ? "text-white" : "text-neutral-400"}>
                {s}
                {now && (
                  <span className="ml-2 text-[12px] text-neutral-500">
                    In progress
                  </span>
                )}
              </span>
              <span className="shrink-0 text-[12.5px] text-neutral-500">
                {when[i]}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ——— Done ——— */

function Done({
  a,
  provider,
  onDone,
  onView,
}: {
  a: Account;
  provider: Provider;
  onDone: () => void;
  onView: () => void;
}) {
  return (
    <>
      <div className="mb-10">
        <div className="text-[12px] text-[var(--ok-fg)]">Requested</div>
        <h1 className="mt-2 text-[30px] leading-[1.15] font-medium tracking-[-0.03em] text-white">
          Your {a.currency} account is on its way
        </h1>
        <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-neutral-400">
          {provider.bank} is opening “{a.label}” for {a.customer.name}. It shows
          in Accounts as Pending, and its numbers appear when it&apos;s active —
          usually in {provider.readyIn}. We&apos;ll let you know in your inbox.
        </p>
      </div>
      <Timeline at={0} bank={provider.bank} readyIn={provider.readyIn} />
      <div className="mt-12 flex items-center gap-3">
        <button
          type="button"
          onClick={onView}
          className="h-10 rounded-full bg-white px-5 text-[13.5px] font-medium text-black hover:bg-neutral-200"
        >
          View account
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-10 rounded-full px-5 text-[13.5px] text-neutral-300 ring-1 ring-white/12 hover:text-white hover:ring-white/30"
        >
          Back to accounts
        </button>
      </div>
    </>
  );
}

/* ——— The account, taking shape ——— */

function Blank({ w = "w-24" }: { w?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 ${w} rounded-full bg-white/[0.07]`}
    />
  );
}

function AccountPreview({
  holder,
  currency,
  provider,
  label,
  settle,
  requested,
}: {
  holder: Holder | null;
  currency: Currency | null;
  provider: Provider | null;
  label: string;
  settle: Settle | null;
  requested: boolean;
}) {
  const routingLabel =
    currency === "EUR"
      ? "BIC"
      : currency === "GBP"
        ? "Sort code"
        : currency && currency !== "USD"
          ? "Bank code"
          : "Routing number";
  const numberLabel = currency === "EUR" ? "IBAN" : "Account number";
  const s = settle ? settleWords(settle) : null;
  const rows: [string, React.ReactNode][] = [
    ["Bank", provider ? provider.bank : <Blank key="b" />],
    [
      routingLabel,
      provider ? (
        <span key="r" className="font-mono tracking-wider text-neutral-400">
          •••• ••••
        </span>
      ) : (
        <Blank key="r" w="w-16" />
      ),
    ],
    [
      numberLabel,
      provider ? (
        <span key="n" className="font-mono tracking-wider text-neutral-400">
          •••• •••• ••••
        </span>
      ) : (
        <Blank key="n" w="w-28" />
      ),
    ],
    [
      "Receives by",
      provider ? (
        <span key="rails" className="space-y-1 text-right">
          {provider.rails.map((r) => (
            <span key={r.name} className="block">
              {r.name}
              {r.speed && (
                <span className="ml-1.5 text-neutral-500">{r.speed}</span>
              )}
            </span>
          ))}
        </span>
      ) : (
        <Blank key="v" w="w-20" />
      ),
    ],
    [
      "Settles to",
      s ? (
        <span key="s" className="flex items-center justify-end gap-1.5">
          <ChainMark chain={s.chain} size={16} />
          {s.text}
        </span>
      ) : (
        <Blank key="s" w="w-28" />
      ),
    ],
  ];

  return (
    <div
      className="relative isolate overflow-hidden rounded-[22px] border border-white/10 bg-surface shadow-[0_30px_80px_-40px_rgb(0_0_0/0.45)]"
      style={requested ? wash("mint", "100% 0%", 18) : undefined}
    >
      {requested && (
        <PixelField
          seed={`preview-${currency}`}
          className="orbit-pop top-0 right-0 h-[24%] w-[34%]"
          solid={0.18}
          strength={0.85}
          cols={16}
          rows={12}
        />
      )}
      <div className="px-6 pt-6 pb-5">
        <div className="flex items-center justify-between">
          {currency ? (
            <span className="flex items-center gap-2.5">
              <Flag c={currency} size={30} />
              <span className="text-[13px] text-neutral-300">
                {currency} account
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2.5">
              <span className="size-[30px] rounded-full bg-white/[0.06]" />
              <Blank w="w-20" />
            </span>
          )}
          <span
            className={`text-[12px] ${requested ? "text-[var(--ok-fg)]" : "text-neutral-500"}`}
          >
            {requested ? "Requested" : "Draft"}
          </span>
        </div>
        <div className="mt-7 text-[11.5px] tracking-[0.04em] text-neutral-500 uppercase">
          Account holder
        </div>
        <div className="mt-1.5 flex min-h-7 items-center gap-2.5">
          {holder ? (
            <>
              <HolderMark h={holder} size={26} />
              <span className="truncate text-[19px] font-medium tracking-[-0.02em] text-white">
                {holder.name}
              </span>
            </>
          ) : (
            <Blank w="w-40" />
          )}
        </div>
        <div className="mt-1.5 min-h-5 text-[12.5px] text-neutral-500">
          {holder && currency && provider ? label : ""}
        </div>
      </div>
      <dl className="border-t border-white/[0.07] px-6 py-4">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-start justify-between gap-4 py-2 text-[12.5px]"
          >
            <dt className="shrink-0 text-neutral-500">{k}</dt>
            <dd className="min-w-0 text-right text-neutral-200">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-white/[0.07] px-6 py-4 text-[12px] leading-relaxed text-neutral-500">
        {provider
          ? `${provider.bank} issues the numbers when the account is active — ${provider.readyIn}.`
          : "Account numbers are issued by the bank once the account is active."}
      </div>
    </div>
  );
}
