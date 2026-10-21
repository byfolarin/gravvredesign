"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Copy, X } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { pendingSteps, type Rail, type Recipient } from "../_data";
import { arrival } from "./send-money";

const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);

/** Where Gravv pays out, and how: the country decides the currency and the rails on offer. */
export const COUNTRIES: {
  name: string;
  flag: string;
  currency: string;
  rails: Rail[];
}[] = [
  {
    name: "United States",
    flag: "🇺🇸",
    currency: "USD",
    rails: ["ACH", "Wire"],
  },
  { name: "United Kingdom", flag: "🇬🇧", currency: "USD", rails: ["Swift"] },
  { name: "Luxembourg", flag: "🇱🇺", currency: "USD", rails: ["Swift"] },
  { name: "Nigeria", flag: "🇳🇬", currency: "USD", rails: ["Swift"] },
  { name: "Morocco", flag: "🇲🇦", currency: "MAD", rails: ["Local transfer"] },
];

const RAIL_WORDS: Record<Rail, string> = {
  ACH: "Cheapest · no fee",
  Wire: "Same day · $15 fee",
  Swift: "International · $25 fee",
  "Local transfer": "Paid out in dirham · no fee",
};

const isUS = (r: Rail) => r === "ACH" || r === "Wire";
const accountLabel = (r: Rail) =>
  isUS(r)
    ? "Account number"
    : r === "Swift"
      ? "IBAN or account number"
      : "RIB (24 digits)";
const routingLabel = (r: Rail) => (isUS(r) ? "Routing number" : "SWIFT / BIC");

/** Plain-words problem with a typed bank field, or null when it looks right. */
function accountProblem(rail: Rail, v: string) {
  const s = v.replace(/\s/g, "");
  if (!s) return null;
  if (isUS(rail))
    return /^\d{4,17}$/.test(s) ? null : "US account numbers are 4–17 digits.";
  if (rail === "Local transfer")
    return /^\d{24}$/.test(s) ? null : "A Moroccan RIB is exactly 24 digits.";
  return /^[A-Z0-9]{8,34}$/i.test(s)
    ? null
    : "That doesn't look like an IBAN or account number (8–34 letters and digits).";
}
function routingProblem(rail: Rail, v: string) {
  const s = v.replace(/\s/g, "");
  if (!s) return null;
  if (isUS(rail))
    return /^\d{9}$/.test(s) ? null : "Routing numbers are 9 digits.";
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i.test(s)
    ? null
    : "SWIFT codes are 8 or 11 characters, like BCIRLULL.";
}

type Step = "who" | "bank" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "who", label: "Recipient" },
  { id: "bank", label: "Bank details" },
  { id: "review", label: "Review" },
];

/**
 * Add a recipient by entering their details, or edit one (opens on the step that needs it).
 * New and changed bank details go through Gravv's bank check before they can be paid.
 */
export function RecipientFlow({
  editing,
  focus,
  nextId,
  onClose,
  onSave,
}: {
  editing?: Recipient;
  /** Open an edit on this step, e.g. "bank" to fix a closed account. */
  focus?: Step;
  nextId: string;
  onClose: () => void;
  onSave: (r: Recipient, bankChanged: boolean) => void;
}) {
  const e = editing;
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return onClose();
    setLeaving(true);
    setTimeout(onClose, 260);
  }, [onClose]);
  const guard = useDiscardGuard(close);

  const [step, setStep] = useState<Step>(focus ?? (e ? "review" : "who"));
  const [kind, setKind] = useState<Recipient["kind"]>(e?.kind ?? "Business");
  const [name, setName] = useState(e?.name ?? "");
  const [email, setEmail] = useState(e?.email ?? "");
  const [country, setCountry] = useState(e?.country ?? "United States");
  const c = COUNTRIES.find((x) => x.name === country) ?? COUNTRIES[0];
  const [rail, setRail] = useState<Rail>(e?.rail ?? c.rails[0]);
  // A fix starts with the bank fields empty, so the closed account isn't resent by mistake.
  const fixing = focus === "bank";
  const [bank, setBank] = useState(
    fixing || !e || e.institution === "—" ? "" : e.institution,
  );
  const [account, setAccount] = useState(fixing ? "" : (e?.account ?? ""));
  const [routing, setRouting] = useState(
    fixing ? "" : (e?.routing?.value ?? ""),
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || guard.asking) return;
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [guard]);

  const aProblem = accountProblem(rail, account);
  const rProblem = routingProblem(rail, routing);
  const ready = {
    who: name.trim().length > 1 && (!email || /\S+@\S+\.\S+/.test(email)),
    bank:
      bank.trim().length > 1 &&
      !!account.trim() &&
      !aProblem &&
      !!routing.trim() &&
      !rProblem,
  };
  const at = STEPS.findIndex((s) => s.id === step);
  const bankChanged =
    !e ||
    account.replace(/\s/g, "") !== (e.account ?? "") ||
    routing.replace(/\s/g, "") !== (e.routing?.value ?? "") ||
    rail !== e.rail ||
    bank.trim() !== e.institution;
  const dirtyEdit =
    !!e &&
    (bankChanged ||
      name.trim() !== e.name ||
      (email.trim() || undefined) !== e.email ||
      kind !== e.kind ||
      country !== e.country);

  const save = () => {
    const cleanAccount = account.replace(/\s/g, "");
    const base: Recipient = {
      id: e?.id ?? nextId,
      name: name.trim(),
      kind,
      image: e?.image,
      country,
      institution: bank.trim(),
      account: cleanAccount,
      routing: {
        label: routingLabel(rail),
        value: routing.replace(/\s/g, "").toUpperCase(),
      },
      currency: c.currency,
      rail,
      status: e && !bankChanged ? e.status : "Pending",
      createdAt: e?.createdAt ?? new Date(AS_OF).toISOString(),
      email: email.trim() || undefined,
      verification:
        e && !bankChanged ? e.verification : pendingSteps(bank.trim()),
      duplicateOf: e && !bankChanged ? e.duplicateOf : undefined,
      payments: e?.payments ?? [],
    };
    guard.clear();
    onSave(base, bankChanged);
    close();
  };

  const input =
    "h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/35";

  return (
    <div className="fixed inset-0 z-50" data-leaving={leaving || undefined}>
      <div
        aria-hidden
        onClick={guard.requestClose}
        className="sheet-scrim absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={e ? `Edit ${e.name}` : "Add a recipient"}
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        className="sheet-panel sidebar-scroll absolute inset-x-0 top-[7vh] bottom-0 overflow-y-auto rounded-t-[22px] bg-takeover shadow-[0_-24px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/8"
      >
        {guard.asking && (
          <DiscardConfirm
            title={e ? "Discard your changes?" : "Discard this recipient?"}
            onKeep={guard.keep}
            onDiscard={guard.discard}
            className="fixed inset-0"
          />
        )}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-[13px] text-neutral-300">
            {e ? `Edit ${e.name}` : "Add a recipient"}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={guard.requestClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-auto grid max-w-[820px] grid-cols-[150px_minmax(0,1fr)] gap-12 px-6 pb-20">
          <ol className="sticky top-6 mt-10 h-fit border-l border-white/8">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!e && i > at}
                  onClick={() => setStep(s.id)}
                  className={`-ml-px block w-full border-l py-1.5 pl-4 text-left text-[13px] ${
                    s.id === step
                      ? "border-white text-white"
                      : i < at || e
                        ? "border-transparent text-neutral-300 hover:text-white"
                        : "border-transparent text-neutral-600"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ol>

          <form
            className="mt-10 max-w-[480px]"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (step === "who" && ready.who) setStep("bank");
              else if (step === "bank" && ready.bank) setStep("review");
              else if (step === "review" && ready.who && ready.bank) save();
            }}
          >
            {step === "who" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  Who are you paying?
                </h2>
                <div className="mt-8 space-y-6">
                  <div
                    role="radiogroup"
                    aria-label="Type"
                    className="flex rounded-full bg-white/[0.06] p-0.5"
                  >
                    {(["Business", "Individual"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={kind === k}
                        onClick={() => setKind(k)}
                        className={`h-8 flex-1 rounded-full text-[13px] transition-colors ${kind === k ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" : "text-neutral-400 hover:text-white"}`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                  <Field
                    label={
                      kind === "Business" ? "Legal business name" : "Full name"
                    }
                  >
                    <input
                      autoFocus
                      value={name}
                      onChange={(ev) => setName(ev.target.value)}
                      placeholder={
                        kind === "Business"
                          ? "Northwind Logistics S.à r.l."
                          : "Amara Nwosu"
                      }
                      className={input}
                    />
                    <Hint>
                      Exactly as it appears on their bank account — the bank
                      checks it.
                    </Hint>
                  </Field>
                  <Field label="Email" optional>
                    <input
                      type="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      placeholder="finance@company.com"
                      className={input}
                    />
                    <Hint>We send them a receipt each time you pay.</Hint>
                  </Field>
                  <Field label="Bank country">
                    <Dropdown
                      label="Bank country"
                      value={country}
                      options={COUNTRIES.map((x) => ({
                        value: x.name,
                        label: x.name,
                        hint: x.currency,
                        icon: <span aria-hidden>{x.flag}</span>,
                      }))}
                      onChange={(v) => {
                        setCountry(v);
                        const next = COUNTRIES.find((x) => x.name === v)!;
                        if (!next.rails.includes(rail)) setRail(next.rails[0]);
                      }}
                      className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
                    />
                  </Field>
                </div>
              </>
            )}

            {step === "bank" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  {fixing
                    ? `New bank details for ${name.split(" ")[0]}`
                    : "Where should the money go?"}
                </h2>
                {fixing && (
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
                    The last payment to {e?.institution} ••
                    {e?.account?.slice(-4)} came back. Enter the account
                    they&apos;d like to use now.
                  </p>
                )}
                <div className="mt-8 space-y-6">
                  {c.rails.length > 1 && (
                    <Field label="Send by">
                      <div role="radiogroup" className="grid grid-cols-2 gap-2">
                        {c.rails.map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="radio"
                            aria-checked={rail === r}
                            onClick={() => setRail(r)}
                            className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${rail === r ? "border-white/40 bg-white/[0.05]" : "border-white/10 hover:border-white/25"}`}
                          >
                            <div className="text-[13px] text-white">{r}</div>
                            <div className="mt-0.5 text-[11px] text-neutral-500">
                              {RAIL_WORDS[r]}
                            </div>
                          </button>
                        ))}
                      </div>
                      <Hint>Arrives {arrival[rail].toLowerCase()}.</Hint>
                    </Field>
                  )}
                  <Field label="Bank name">
                    <input
                      autoFocus
                      value={bank}
                      onChange={(ev) => setBank(ev.target.value)}
                      placeholder={
                        isUS(rail) ? "Lead Bank" : "Banking Circle S.A."
                      }
                      className={input}
                    />
                  </Field>
                  <Field label={routingLabel(rail)}>
                    <input
                      value={routing}
                      onChange={(ev) => setRouting(ev.target.value)}
                      placeholder={isUS(rail) ? "101019644" : "BCIRLULL"}
                      className={`${input} font-mono text-[12.5px] uppercase ${rProblem ? "border-rose-400/50" : ""}`}
                    />
                    {rProblem && <Hint tone="bad">{rProblem}</Hint>}
                  </Field>
                  <Field label={accountLabel(rail)}>
                    <input
                      value={account}
                      onChange={(ev) => setAccount(ev.target.value)}
                      placeholder={
                        isUS(rail)
                          ? "219079072561"
                          : rail === "Local transfer"
                            ? "007780000123456789012345"
                            : "LU094080000047100391"
                      }
                      className={`${input} font-mono text-[12.5px] ${aProblem ? "border-rose-400/50" : ""}`}
                    />
                    {aProblem ? (
                      <Hint tone="bad">{aProblem}</Hint>
                    ) : (
                      <Hint>
                        {c.rails.length === 1
                          ? `Paid by ${rail} in ${c.currency} · arrives ${arrival[rail].toLowerCase()}.`
                          : "Ask them to copy it from their bank app, not a cheque."}
                      </Hint>
                    )}
                  </Field>
                </div>
              </>
            )}

            {step === "review" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  {e ? "Check your changes" : "Check the details"}
                </h2>
                <div className="mt-8 divide-y divide-white/6 rounded-xl border border-white/8">
                  <Row
                    label="Recipient"
                    value={`${name || "—"} · ${kind}`}
                    onEdit={() => setStep("who")}
                  />
                  <Row
                    label="Email"
                    value={email || "No email"}
                    onEdit={() => setStep("who")}
                  />
                  <Row
                    label="Country"
                    value={`${c.flag} ${country} · ${c.currency}`}
                    onEdit={() => setStep("who")}
                  />
                  <Row
                    label="Send by"
                    value={`${rail} · arrives ${arrival[rail].toLowerCase()}`}
                    onEdit={() => setStep("bank")}
                  />
                  <Row
                    label="Bank"
                    value={bank || "—"}
                    onEdit={() => setStep("bank")}
                  />
                  <Row
                    label={routingLabel(rail)}
                    value={routing.toUpperCase() || "—"}
                    mono
                    onEdit={() => setStep("bank")}
                  />
                  <Row
                    label={accountLabel(rail).split(" (")[0]}
                    value={account || "—"}
                    mono
                    onEdit={() => setStep("bank")}
                  />
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
                  {bankChanged
                    ? `Before the first payment, Gravv checks with ${bank || "the bank"} that the account name matches — usually under 1 business day. You'll see them under Needs attention until then.`
                    : "Only their name or email changed, so they stay ready to pay."}
                </p>
              </>
            )}

            <div className="mt-10 flex justify-between">
              {at > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep(STEPS[at - 1].id)}
                  className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] pr-4 pl-3 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                >
                  <ArrowLeft size={14} strokeWidth={1.75} />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={guard.requestClose}
                  className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={
                  step === "who"
                    ? !ready.who
                    : step === "bank"
                      ? !ready.bank
                      : !(ready.who && ready.bank) || (!!e && !dirtyEdit)
                }
                className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
              >
                {step === "review"
                  ? e
                    ? "Save changes"
                    : "Add recipient"
                  : "Continue"}
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Invite them to add their own bank details: Mercury's "request details" pattern. */
export function AskForDetails({
  nextId,
  onClose,
  onSend,
}: {
  nextId: string;
  onClose: () => void;
  onSend: (r: Recipient) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Recipient["kind"]>("Business");
  const [country, setCountry] = useState("United States");
  const guard = useDiscardGuard(onClose);
  const ok = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);
  const link = `https://pay.gravv.xyz/details/${nextId.slice(-8)}`;
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || guard.asking) return;
      ev.stopImmediatePropagation();
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [guard]);
  const c = COUNTRIES.find((x) => x.name === country)!;
  const input =
    "h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35";
  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={guard.requestClose}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ask for their details"
        onInputCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        className="orbit-pop absolute top-[14vh] left-1/2 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        {guard.asking && (
          <DiscardConfirm
            title="Discard this request?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
          />
        )}
        <form
          className="p-6"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!ok) return;
            guard.clear();
            onSend({
              id: nextId,
              name: name.trim(),
              kind,
              country,
              institution: "—",
              account: null,
              currency: c.currency,
              rail: c.rails[0],
              status: "Pending",
              createdAt: new Date(AS_OF).toISOString(),
              email: email.trim(),
              invite: {
                email: email.trim(),
                link,
                sentAt: new Date(AS_OF).toISOString(),
              },
              verification: [
                { label: "Request sent", state: "done" },
                {
                  label: "Their bank details",
                  state: "current",
                  note: `We emailed ${email.trim()} a secure link to add their account. It expires in 7 days.`,
                },
                { label: "Bank account check", state: "upcoming" },
              ],
              payments: [],
            });
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-medium text-white">
                Ask them for their details
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                They get a secure link to add their own bank account. Nobody on
                your team has to type or see it.
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
          <div className="mt-6 space-y-5">
            <div
              role="radiogroup"
              aria-label="Type"
              className="flex rounded-full bg-white/[0.06] p-0.5"
            >
              {(["Business", "Individual"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-8 flex-1 rounded-full text-[13px] transition-colors ${kind === k ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" : "text-neutral-400 hover:text-white"}`}
                >
                  {k}
                </button>
              ))}
            </div>
            <Field label="Name">
              <input
                autoFocus
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                className={input}
              />
            </Field>
            <Field label="Their email">
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="finance@company.com"
                className={input}
              />
            </Field>
            <Field label="Bank country">
              <Dropdown
                label="Bank country"
                value={country}
                options={COUNTRIES.map((x) => ({
                  value: x.name,
                  label: x.name,
                  hint: x.currency,
                  icon: <span aria-hidden>{x.flag}</span>,
                }))}
                onChange={setCountry}
                className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
              />
            </Field>
          </div>
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              data-keeps-clean
              onClick={() =>
                navigator.clipboard?.writeText(link).catch(() => {})
              }
              className="flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-white"
            >
              <Copy size={12} strokeWidth={1.75} />
              Copy link instead
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={guard.requestClose}
                className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ok}
                className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
              >
                Send request
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
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
      <div className="mb-1.5 text-[12px] text-neutral-400">
        {label}
        {optional && <span className="text-neutral-600"> (optional)</span>}
      </div>
      {children}
    </div>
  );
}

function Hint({ children, tone }: { children: React.ReactNode; tone?: "bad" }) {
  return (
    <p
      className={`mt-1.5 text-[12px] leading-relaxed ${tone === "bad" ? "text-rose-300" : "text-neutral-500"}`}
    >
      {children}
    </p>
  );
}

function Row({
  label,
  value,
  mono = false,
  onEdit,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 text-[13px]">
      <span className="w-28 shrink-0 text-neutral-500">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-neutral-100 ${mono ? "font-mono text-[12.5px]" : ""}`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 text-[12px] text-neutral-500 hover:text-white"
      >
        Edit
      </button>
    </div>
  );
}
