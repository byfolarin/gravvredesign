"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Search, X } from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { Dropdown } from "@/app/_components/dropdown";
import { PixelField, wash } from "@/app/_components/pixel-field";
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
  ACCOUNT_TYPES,
  BUSINESS,
  NETWORKS,
  UNVERIFIED,
  WALLETS,
  providersFor,
  stateFor,
  type AccountType,
  type Chain,
  type Holder,
} from "./open-account-data";

type Step = "holder" | "account" | "settlement" | "review" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "holder", label: "Account holder" },
  { id: "account", label: "Account" },
  { id: "settlement", label: "Settlement" },
  { id: "review", label: "Review & open" },
];

/**
 * Open an account — Gravv's real flow (category → customer / location → currency → bank →
 * account type → settlement wallet → label → review), in the same sheet as Create payment
 * link: step rail, one form, the account taking shape in the summary on the right.
 * What Gravv hides is said here: why a customer can't hold an account yet, what the chosen
 * bank receives by and how fast, and what happens after you open it.
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
  const [step, setStep] = useState<Step>("holder");
  const [category, setCategory] = useState<"sub" | "main">("sub");
  const [customer, setCustomer] = useState<Holder | null>(null);
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [currency, setCurrency] = useState<Currency | "">(
    initialCurrency ?? "",
  );
  const [bank, setBank] = useState("");
  const [type, setType] = useState<AccountType>("Regular");
  const [walletMode, setWalletMode] = useState<"mint" | "existing">("mint");
  const [chain, setChain] = useState<Chain>("Polygon");
  const [walletId, setWalletId] = useState("");
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc closes an open picker first, never the whole sheet with it.
      if (pickerOpen) return setPickerOpen(false);
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose, pickerOpen]);

  // Verified customers are the ones who already hold accounts.
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
  const needle = query.trim().toLowerCase();
  const match = (h: Holder) =>
    !needle || `${h.name} ${h.email}`.toLowerCase().includes(needle);
  const matches = customers.filter(match).slice(0, 6);
  const blocked = UNVERIFIED.filter(match);

  const holder = category === "main" ? BUSINESS : customer;
  const providers = currency ? providersFor(currency) : [];
  const offered = providers.filter(
    (p) => !holder || !p.notIn?.includes(holder.state),
  );
  const notOffered = providers.filter((p) => !offered.includes(p));
  const provider = offered.find((p) => p.bank === bank) ?? null;
  const wallet = WALLETS.find((w) => w.id === walletId) ?? null;
  const network = NETWORKS.find((n) => n.chain === chain)!;
  const label =
    nickname.trim() ||
    (holder && currency
      ? `${holder.category === "Business" ? holder.name : holder.name.split(" ")[0]} · ${type}`
      : "");
  const settlesTo =
    walletMode === "mint"
      ? `New wallet on ${network.name}`
      : wallet
        ? `${wallet.label} · ${wallet.chain}`
        : undefined;
  const at = STEPS.findIndex((s) => s.id === step);

  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    const list = providersFor(c).filter(
      (p) => !holder || !p.notIn?.includes(holder.state),
    );
    // One bank on offer: nothing to choose.
    setBank(list.length === 1 ? list[0].bank : "");
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
        className="sheet-panel absolute inset-x-0 top-[7vh] bottom-0 overflow-y-auto rounded-t-[22px] bg-takeover ring-1 ring-white/8"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-[13px] text-neutral-300">Open an account</div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            data-keeps-clean
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
                    data-keeps-clean
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
            {step === "holder" && (
              <StepForm
                title="Account holder"
                lead="A main account belongs to your own business. A sub account belongs to one of your customers, in their name."
                canContinue={!!holder}
                onContinue={() => setStep("account")}
                onCancel={requestClose}
              >
                <Field label="Category">
                  <Segmented
                    value={category}
                    options={[
                      { value: "sub", label: "Sub account" },
                      { value: "main", label: "Main account" },
                    ]}
                    onChange={setCategory}
                  />
                </Field>

                {category === "sub" ? (
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
                              setTimeout(() => setPickerOpen(false), 150)
                            }
                            placeholder="Search customers by name or email"
                            data-keeps-clean
                            className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
                          />
                        </label>
                        {pickerOpen && (
                          <div className="absolute inset-x-0 top-full z-10 mt-1.5 max-h-[320px] overflow-y-auto rounded-lg border border-white/10 bg-surface p-1">
                            {matches.map((c) => (
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
                            ))}
                            {matches.length === 0 && (
                              <p className="px-2 py-2 text-[12px] text-neutral-500">
                                No verified customer matches “{query}”.
                              </p>
                            )}
                            {/* Not verified: shown with the reason, and the way to fix it */}
                            {blocked.length > 0 && (
                              <>
                                <div className="mx-2 mt-1.5 border-t border-white/[0.06] pt-2 pb-1 text-[11px] text-neutral-500">
                                  Can&apos;t hold an account yet
                                </div>
                                {blocked.map((c) => (
                                  <div
                                    key={c.name}
                                    className="flex items-center gap-3 px-2 py-1.5"
                                  >
                                    <Initials name={c.name} muted />
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[13px] text-neutral-500">
                                        {c.name}
                                      </span>
                                      <span className="block truncate text-[11px] text-neutral-500">
                                        {c.blocked}
                                      </span>
                                    </span>
                                    {sent.has(c.name) ? (
                                      <span className="flex shrink-0 items-center gap-1 text-[11.5px] text-neutral-400">
                                        <Check size={12} strokeWidth={2.25} />
                                        Link sent
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        data-keeps-clean
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                          setSent((s) => new Set(s).add(c.name))
                                        }
                                        className="shrink-0 text-[11.5px] text-neutral-300 underline decoration-white/20 underline-offset-4 hover:text-white"
                                      >
                                        Send verification link
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <Hint>
                      Only verified customers can hold an account. We use the
                      verification on file, so there&apos;s nothing to upload.
                    </Hint>
                  </Field>
                ) : (
                  <Field label="Business">
                    <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3 py-2.5">
                      <Initials name={BUSINESS.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-neutral-100">
                          {BUSINESS.name}
                        </span>
                        <span className="block truncate text-[11px] text-neutral-500">
                          Verified business · {BUSINESS.email}
                        </span>
                      </span>
                    </div>
                  </Field>
                )}

                {holder && (
                  <Hint>
                    {category === "main" ? "Registered" : "Based"} in{" "}
                    <span className="text-neutral-300">
                      {holder.state}, {holder.country}
                    </span>
                    . This decides which banks can open the account.
                  </Hint>
                )}
              </StepForm>
            )}

            {step === "account" && holder && (
              <StepForm
                title="Account"
                lead="Pick the currency, then the bank that opens it. Banks differ in how money reaches the account and how quickly it opens."
                canContinue={!!currency && !!provider}
                onContinue={() => setStep("settlement")}
                onBack={() => setStep("holder")}
              >
                <Field label="Currency">
                  <Dropdown
                    label="Currency"
                    value={currency}
                    placeholder={currency ? undefined : "Select a currency"}
                    options={ALL_CURRENCIES.map((c) => ({
                      value: c,
                      label: `${c} · ${NAMES[c]}`,
                      icon: (
                        <span className="text-[15px] leading-none">
                          {FLAGS[c]}
                        </span>
                      ),
                    }))}
                    onChange={(v) => pickCurrency(v as Currency)}
                    className="w-full"
                  />
                </Field>

                {currency && (
                  <Field label="Bank">
                    <Dropdown
                      label="Bank"
                      value={bank}
                      placeholder={bank ? undefined : "Select a bank"}
                      options={offered.map((p) => ({
                        value: p.bank,
                        label: p.bank,
                        hint: `Ready in ${p.readyIn}`,
                      }))}
                      onChange={setBank}
                      className="w-full"
                    />
                    {provider ? (
                      <Hint>
                        Receives by{" "}
                        {provider.rails
                          .map((r) =>
                            r.speed
                              ? `${r.name} (${r.speed.toLowerCase()})`
                              : r.name,
                          )
                          .join(", ")}
                        . Comes with {provider.details.toLowerCase()}; up to{" "}
                        {provider.perHolder} per holder.
                      </Hint>
                    ) : (
                      <Hint>
                        {offered.length}{" "}
                        {offered.length === 1 ? "bank opens" : "banks open"}{" "}
                        {currency} accounts
                        {holder.country === "United States"
                          ? ` in ${holder.state}`
                          : ""}
                        .
                      </Hint>
                    )}
                    {notOffered.map((p) => (
                      <Hint key={p.bank}>
                        {p.bank} doesn&apos;t open accounts in {holder.state}.
                      </Hint>
                    ))}
                  </Field>
                )}

                {provider && (
                  <>
                    <Field label="Account type">
                      <Dropdown
                        label="Account type"
                        value={type}
                        options={ACCOUNT_TYPES.map((t) => ({
                          value: t.id,
                          label: t.id,
                          hint: t.hint,
                        }))}
                        onChange={setType}
                        className="w-full"
                      />
                      <Hint>
                        {ACCOUNT_TYPES.find((t) => t.id === type)!.line}
                      </Hint>
                    </Field>
                    <Field label="Label" optional>
                      <input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        maxLength={255}
                        placeholder={label}
                        className="h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35"
                      />
                      <Hint>
                        A name for your own records. Leave it empty to use the
                        suggestion.
                      </Hint>
                    </Field>
                  </>
                )}
              </StepForm>
            )}

            {step === "settlement" && (
              <StepForm
                title="Settlement"
                lead="Money that lands in this account is converted to USDC and settles to a wallet, automatically."
                canContinue={walletMode === "mint" || !!wallet}
                onContinue={() => setStep("review")}
                onBack={() => setStep("account")}
              >
                <Field label="Settlement wallet">
                  <Segmented
                    value={walletMode}
                    options={[
                      { value: "mint", label: "Mint a new wallet" },
                      { value: "existing", label: "Use an existing wallet" },
                    ]}
                    onChange={setWalletMode}
                  />
                </Field>
                {walletMode === "mint" ? (
                  <Field label="Settlement network">
                    <Dropdown
                      label="Settlement network"
                      value={chain}
                      options={NETWORKS.map((n) => ({
                        value: n.chain,
                        label: n.name,
                        hint: `${n.speed} · fee ${n.fee}`,
                        icon: <ChainMark chain={n.chain} size={16} />,
                      }))}
                      onChange={setChain}
                      className="w-full"
                    />
                    <Hint>
                      Gravv mints a wallet on {network.name} for this account.
                      Each settlement takes {network.speed} and costs{" "}
                      {network.fee}.
                    </Hint>
                  </Field>
                ) : (
                  <Field label="Wallet">
                    <div role="radiogroup" className="space-y-2">
                      {WALLETS.map((w) => (
                        <button
                          key={w.id}
                          type="button"
                          role="radio"
                          aria-checked={walletId === w.id}
                          onClick={() => setWalletId(w.id)}
                          className={`flex w-full items-center justify-between gap-4 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                            walletId === w.id
                              ? "border-white/30 bg-white/[0.04]"
                              : "border-white/8 hover:border-white/20"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <ChainMark chain={w.chain} size={18} />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] text-neutral-100">
                                {w.label}
                              </span>
                              <span className="block text-[11px] text-neutral-500">
                                {w.chain} · {w.address}
                              </span>
                            </span>
                          </span>
                          <span className="amount shrink-0 text-[13px] text-neutral-300 tabular-nums">
                            {w.balance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USDC
                          </span>
                        </button>
                      ))}
                    </div>
                    <Hint>
                      The account settles on this wallet&apos;s own network.
                    </Hint>
                  </Field>
                )}
              </StepForm>
            )}

            {step === "review" && holder && currency && provider && (
              <StepForm
                title="Review & open"
                lead={`${provider.bank} sets the account up. It usually takes ${provider.readyIn}; you can follow it in Accounts. Nothing is sent until you press Open account.`}
                canContinue
                continueLabel="Open account"
                onContinue={submit}
                onBack={() => setStep("settlement")}
              >
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/10">
                  <ReviewRow
                    label="Holder"
                    value={`${holder.name} · ${category === "main" ? "Main account" : "Sub account"}`}
                    onEdit={() => setStep("holder")}
                  />
                  <ReviewRow
                    label="Currency"
                    value={`${FLAGS[currency]}  ${NAMES[currency]} (${currency})`}
                    onEdit={() => setStep("account")}
                  />
                  <ReviewRow
                    label="Bank"
                    value={provider.bank}
                    onEdit={() => setStep("account")}
                  />
                  <ReviewRow
                    label="Type"
                    value={type}
                    onEdit={() => setStep("account")}
                  />
                  <ReviewRow
                    label="Label"
                    value={label}
                    onEdit={() => setStep("account")}
                  />
                  <ReviewRow
                    label="Settles to"
                    value={settlesTo ?? "—"}
                    onEdit={() => setStep("settlement")}
                  />
                </div>
                <div>
                  <div className="mb-3 text-[13px] text-neutral-200">
                    What happens next
                  </div>
                  <Timeline at={-1} readyIn={provider.readyIn} />
                </div>
              </StepForm>
            )}

            {step === "done" && created && provider && (
              <div className="mt-10">
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  {created.currency} account requested
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                  {provider.bank} is setting up “{created.label}”. It shows in
                  Accounts as Pending until the bank issues the account details
                  — usually {provider.readyIn}.
                </p>
                <div className="mt-8">
                  <Timeline at={0} readyIn={provider.readyIn} />
                </div>
                <div className="mt-10 flex justify-between">
                  <button
                    type="button"
                    onClick={() => onCreated(created, false)}
                    className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => onCreated(created, true)}
                    className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black hover:bg-neutral-200"
                  >
                    View account
                    <ChevronRight size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* What you're opening, filling in as you go; lights up once requested */}
          <aside
            className="sticky isolate top-6 mt-10 h-fit overflow-hidden rounded-2xl bg-white/[0.03] p-5"
            style={step === "done" ? wash("mint", "100% 0%", 18) : undefined}
          >
            {step === "done" && (
              <PixelField
                seed={`opened-${currency}`}
                className="orbit-pop top-0 right-0 h-[30%] w-[42%]"
                solid={0.2}
                strength={0.9}
                cols={14}
                rows={10}
              />
            )}
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
                  {holder ? holder.name : "Account holder not chosen"}
                </span>
              </span>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-white/[0.07] pt-4 text-[12px]">
              <SummaryRow
                label="Category"
                value={
                  holder
                    ? category === "main"
                      ? "Main account"
                      : "Sub account"
                    : undefined
                }
              />
              <SummaryRow label="Bank" value={provider?.bank} />
              <SummaryRow label="Type" value={provider ? type : undefined} />
              <SummaryRow
                label="Receives by"
                value={provider?.rails.map((r) => r.name).join(", ")}
              />
              <SummaryRow
                label="Settles to"
                value={at >= 2 || step === "done" ? settlesTo : undefined}
              />
              <SummaryRow label="Ready in" value={provider?.readyIn} />
            </dl>
            {step === "done" && (
              <p className="mt-4 border-t border-white/[0.07] pt-3 text-[12px] text-[var(--ok-fg)]">
                Requested
              </p>
            )}
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

/** Provisioning steps with when each usually happens; `at` is the last step done. */
function Timeline({ at, readyIn }: { at: number; readyIn: string }) {
  const when = [
    at >= 0 ? "Just now" : "When you open it",
    "Within a few hours",
    "",
    `In ${readyIn}`,
  ];
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
            <span className="flex min-w-0 flex-1 justify-between gap-3 pt-px text-[13px]">
              <span>
                <span
                  className={
                    done || current ? "text-white" : "text-neutral-500"
                  }
                >
                  {s}
                </span>
                {current && (
                  <span className="ml-2 text-neutral-500">In progress</span>
                )}
              </span>
              <span className="shrink-0 text-[12px] text-neutral-500">
                {when[i]}
              </span>
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
            data-keeps-clean
            className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] pr-4 pl-3 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            data-keeps-clean
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canContinue}
          data-keeps-clean
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

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
      {children}
    </p>
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

/** Neutral initials — the flow doesn't tint people. */
function Initials({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-medium ${
        muted
          ? "bg-white/[0.04] text-neutral-600"
          : "bg-white/[0.08] text-neutral-300"
      }`}
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
        data-keeps-clean
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
