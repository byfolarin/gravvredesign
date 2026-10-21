"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ChevronRight, Copy, X } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import {
  pendingSteps,
  type AccountType,
  type Rail,
  type Recipient,
} from "../_data";
import { arrival } from "./send-money";

const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);

const FLAGS: Record<string, string> = {
  "United States": "🇺🇸",
  Nigeria: "🇳🇬",
  Ghana: "🇬🇭",
  Kenya: "🇰🇪",
  Morocco: "🇲🇦",
  "United Kingdom": "🇬🇧",
  Luxembourg: "🇱🇺",
  "United Arab Emirates": "🇦🇪",
  Singapore: "🇸🇬",
  India: "🇮🇳",
  Germany: "🇩🇪",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
  Spain: "🇪🇸",
  Ireland: "🇮🇪",
};

type InstitutionType = "Bank" | "Mobile money";
/** Global bank accounts: paid locally in the recipient's own currency, from Gravv's institution list. */
const GLOBAL: Record<
  string,
  { currency: string; institutions: Partial<Record<InstitutionType, string[]>> }
> = {
  Nigeria: {
    currency: "NGN",
    institutions: {
      Bank: [
        "Guaranty Trust Bank",
        "Access Bank",
        "Zenith Bank",
        "First Bank of Nigeria",
        "Kuda Microfinance Bank",
      ],
      "Mobile money": ["OPay", "PalmPay", "Moniepoint"],
    },
  },
  Ghana: {
    currency: "GHS",
    institutions: {
      Bank: ["GCB Bank", "Ecobank Ghana", "Stanbic Bank Ghana"],
      "Mobile money": ["MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
    },
  },
  Kenya: {
    currency: "KES",
    institutions: {
      Bank: ["Equity Bank", "KCB Bank"],
      "Mobile money": ["M-Pesa", "Airtel Money"],
    },
  },
  Morocco: {
    currency: "MAD",
    institutions: {
      Bank: ["Attijariwafa Bank", "Bank of Africa", "Banque Populaire"],
    },
  },
};
const SEPA_COUNTRIES = [
  "Germany",
  "France",
  "Netherlands",
  "Spain",
  "Ireland",
  "Luxembourg",
];

// Codes Gravv already knows, so the bank name fills itself in instead of being typed twice.
const ROUTING: Record<string, string> = {
  "101019644": "Lead Bank",
  "021000021": "JPMorgan Chase",
  "021214891": "Cross River Bank",
  "091202590": "Stearns Bank",
  "026009593": "Bank of America",
};
const BIC: Record<string, string> = {
  BCIRLULL: "Banking Circle S.A.",
  CLJUGB21: "Clear Junction Limited",
  ABNGNGLA: "Access Bank Plc",
  BARCGB22: "Barclays",
  DEUTDEFF: "Deutsche Bank",
  BNPAFRPP: "BNP Paribas",
  INGBNL2A: "ING Bank",
  NTSBDEB1: "N26",
};

const currencyFor = (t: AccountType, country: string) =>
  t === "global"
    ? (GLOBAL[country]?.currency ?? "USD")
    : t === "sepa"
      ? "EUR"
      : "USD";
export const typeOf = (r: Pick<Recipient, "rail">): AccountType =>
  r.rail === "ACH" || r.rail === "Wire"
    ? "us"
    : r.rail === "Swift"
      ? "swift"
      : r.rail === "SEPA"
        ? "sepa"
        : "global";

/** Every country Gravv pays to, with what you'd most likely use there. For flags and requests. */
export const COUNTRIES: {
  name: string;
  flag: string;
  currency: string;
  rails: Rail[];
}[] = Object.keys(FLAGS).map((name) => {
  const t: AccountType =
    name === "United States"
      ? "us"
      : GLOBAL[name]
        ? "global"
        : SEPA_COUNTRIES.includes(name) && name !== "Luxembourg"
          ? "sepa"
          : "swift";
  const rail: Rail =
    t === "us"
      ? "ACH"
      : t === "global"
        ? "Local transfer"
        : t === "sepa"
          ? "SEPA"
          : "Swift";
  return {
    name,
    flag: FLAGS[name],
    currency: currencyFor(t, name),
    rails: [rail],
  };
});

const ALL_COUNTRIES = Object.keys(FLAGS);

/** Every way Gravv can pay a bank in this country, best first — this is the "account type". */
function methodsFor(country: string) {
  const out: {
    key: string;
    type: AccountType;
    rail: Rail;
    inst?: InstitutionType;
    label: string;
    hint: string;
  }[] = [];
  if (country === "United States") {
    out.push({
      key: "us-ACH",
      type: "us",
      rail: "ACH",
      label: "USD by ACH",
      hint: "No fee · 1–2 days",
    });
    out.push({
      key: "us-Wire",
      type: "us",
      rail: "Wire",
      label: "USD by wire",
      hint: "$15 · same day",
    });
    return out;
  }
  const local = GLOBAL[country];
  if (local) {
    out.push({
      key: "global-Bank",
      type: "global",
      rail: "Local transfer",
      inst: "Bank",
      label: `${local.currency} to a bank account`,
      hint: "Minutes · no fee",
    });
    if (local.institutions["Mobile money"])
      out.push({
        key: "global-Mobile money",
        type: "global",
        rail: "Local transfer",
        inst: "Mobile money",
        label: `${local.currency} to mobile money`,
        hint: "Minutes · no fee",
      });
  }
  if (SEPA_COUNTRIES.includes(country))
    out.push({
      key: "sepa",
      type: "sepa",
      rail: "SEPA",
      label: "EUR by SEPA",
      hint: "No fee · usually today",
    });
  out.push({
    key: "swift",
    type: "swift",
    rail: "Swift",
    label: "USD by SWIFT",
    hint: "$25 · 1–2 days",
  });
  return out;
}

const digits = (v: string) => v.replace(/[\s-]/g, "");

/** What to call the account field, and the plain-words check for it. */
function accountRule(t: AccountType, country: string, inst: InstitutionType) {
  if (t === "us")
    return {
      label: "Account number",
      placeholder: "219079072561",
      test: /^\d{4,17}$/,
      words: "US account numbers are 4–17 digits.",
    };
  if (t === "sepa")
    return {
      label: "IBAN",
      placeholder: "DE89 3704 0044 0532 0130 00",
      test: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i,
      words: "An IBAN starts with two letters and two digits, like DE89…",
    };
  if (t === "swift")
    return {
      label: "IBAN or account number",
      placeholder: "GB29 NWBK 6016 1331 9268 19",
      test: /^[A-Z0-9]{8,34}$/i,
      words: "8–34 letters and digits.",
    };
  if (inst === "Mobile money")
    return {
      label: "Mobile money number",
      placeholder: country === "Kenya" ? "0712 345 678" : "024 123 4567",
      test: /^0\d{9}$/,
      words: "10 digits, starting with 0.",
    };
  if (country === "Nigeria")
    return {
      label: "Account number (NUBAN)",
      placeholder: "0123456789",
      test: /^\d{10}$/,
      words: "Nigerian account numbers are 10 digits.",
    };
  if (country === "Morocco")
    return {
      label: "RIB",
      placeholder: "007780000123456789012345",
      test: /^\d{24}$/,
      words: "A Moroccan RIB is exactly 24 digits.",
    };
  return {
    label: "Account number",
    placeholder: "1234567890123",
    test: /^\d{8,16}$/,
    words: "8–16 digits.",
  };
}

// Prototype stand-in for the bank's name lookup on local accounts.
const LOOKUP = [
  "TOLULOPE ADEYEMI",
  "GRACE MENSAH",
  "WANJIKU KAMAU",
  "CHIOMA EZE VENTURES LTD",
  "YOUSSEF EL AMRANI",
  "KWAME ASANTE",
];

type Step = "account" | "who" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "who", label: "Recipient" },
  { id: "review", label: "Review" },
];

/**
 * Add a recipient (Gravv's four account types) or edit one. Pick the type and country first,
 * so every field after it is the right one; bank names fill in from the code, and local
 * accounts look the holder's name up so nobody retypes it.
 */
export function RecipientFlow({
  editing,
  focus,
  nextId,
  onClose,
  onSave,
}: {
  editing?: Recipient;
  /** "bank" opens an edit on the account step with the old numbers cleared. */
  focus?: "bank";
  nextId: string;
  onClose: () => void;
  onSave: (r: Recipient, bankChanged: boolean) => void;
}) {
  const e = editing;
  const isEdit = !!editing;
  const fixing = focus === "bank";
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return onClose();
    setLeaving(true);
    setTimeout(onClose, 260);
  }, [onClose]);
  const guard = useDiscardGuard(close);

  const [step, setStep] = useState<Step>(
    fixing ? "account" : e ? "review" : "account",
  );
  const [type, setType] = useState<AccountType>(e ? typeOf(e) : "global");
  const [country, setCountry] = useState(e?.country ?? "");
  const [instType, setInstType] = useState<InstitutionType>(
    e?.institutionType ?? "Bank",
  );
  const [institution, setInstitution] = useState(
    e && !fixing && e.institution !== "—" ? e.institution : "",
  );
  const [usRail, setUsRail] = useState<Rail>(
    e?.rail === "Wire" ? "Wire" : "ACH",
  );
  const [account, setAccount] = useState(fixing ? "" : (e?.account ?? ""));
  const [code, setCode] = useState(fixing ? "" : (e?.routing?.value ?? ""));
  const [kind, setKind] = useState<Recipient["kind"]>(e?.kind ?? "Business");
  const [name, setName] = useState(e?.name ?? "");
  const [email, setEmail] = useState(e?.email ?? "");
  // Local-account name lookup: idle → looking → found.
  const [lookup, setLookup] = useState<{
    state: "idle" | "looking" | "found";
    name?: string;
  }>({ state: "idle" });

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || guard.asking) return;
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [guard]);

  const g = GLOBAL[country];
  const methodKey =
    type === "us"
      ? `us-${usRail}`
      : type === "global"
        ? `global-${instType}`
        : type;
  const rule = accountRule(type, country, instType);
  const acct = digits(account);
  const acctProblem = acct && !rule.test.test(acct) ? rule.words : null;
  const cleanCode = digits(code).toUpperCase();
  const needsCode = type !== "global";
  const codeLabel =
    type === "us"
      ? "Routing number"
      : type === "sepa"
        ? "BIC (optional)"
        : "SWIFT / BIC";
  const codeProblem = !cleanCode
    ? null
    : type === "us"
      ? /^\d{9}$/.test(cleanCode)
        ? null
        : "Routing numbers are 9 digits."
      : /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleanCode)
        ? null
        : "SWIFT / BIC codes are 8 or 11 characters, like BCIRLULL.";
  const knownBank = type === "us" ? ROUTING[cleanCode] : BIC[cleanCode];
  // Global: picked from Gravv's list. Others: from the code when Gravv knows it, otherwise typed.
  const [typedBank, setTypedBank] = useState(
    e && !fixing && type !== "global" && e.institution !== "—"
      ? e.institution
      : "",
  );
  const bankName =
    type === "global" ? institution : (knownBank ?? typedBank.trim());
  const rail: Rail =
    type === "us"
      ? usRail
      : type === "swift"
        ? "Swift"
        : type === "sepa"
          ? "SEPA"
          : "Local transfer";
  const currency = currencyFor(type, country);

  // Look the holder's name up once a local account number is complete.
  const lookupKey =
    type === "global" && institution && acct && !acctProblem
      ? `${institution}|${acct}`
      : "";
  useEffect(() => {
    if (!lookupKey) {
      const t = setTimeout(() => setLookup({ state: "idle" }), 0);
      return () => clearTimeout(t);
    }
    const a = setTimeout(() => setLookup({ state: "looking" }), 0);
    const b = setTimeout(() => {
      const found = LOOKUP[Number(lookupKey.slice(-1)) % LOOKUP.length];
      setLookup({ state: "found", name: found });
      // The bank's name says whether it's a company; only for new recipients.
      if (!isEdit)
        setKind(
          /\b(LTD|LIMITED|VENTURES|PLC|INC)\b/.test(found)
            ? "Business"
            : "Individual",
        );
      setName(
        (n) =>
          n ||
          found
            .replace(/\b(\w)(\w*)/g, (_, f, r) => f + r.toLowerCase())
            .replace(/\bLtd\b/i, "Ltd"),
      );
    }, 900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [lookupKey, isEdit]);

  const ready = {
    account:
      !!country &&
      !!bankName &&
      !!acct &&
      !acctProblem &&
      (!needsCode || type === "sepa" || (!!cleanCode && !codeProblem)) &&
      !codeProblem &&
      (type !== "global" || lookup.state === "found"),
    who: name.trim().length > 1 && (!email || /\S+@\S+\.\S+/.test(email)),
  };
  const at = STEPS.findIndex((s) => s.id === step);
  const bankChanged =
    !e ||
    acct !== (e.account ?? "") ||
    cleanCode !== (e.routing?.value ?? "") ||
    rail !== e.rail ||
    bankName !== e.institution;
  const dirtyEdit =
    !!e &&
    (bankChanged ||
      name.trim() !== e.name ||
      (email.trim() || undefined) !== e.email ||
      kind !== e.kind ||
      country !== e.country);

  const save = () => {
    const r: Recipient = {
      id: e?.id ?? nextId,
      name: name.trim(),
      kind,
      image: e?.image,
      country,
      institution: bankName,
      institutionType: type === "global" ? instType : undefined,
      account: acct,
      routing: cleanCode
        ? {
            label: type === "us" ? "Routing number" : "SWIFT / BIC",
            value: cleanCode,
          }
        : undefined,
      currency,
      rail,
      status: e && !bankChanged ? e.status : "Pending",
      createdAt: e?.createdAt ?? new Date(AS_OF).toISOString(),
      email: email.trim() || undefined,
      verification: e && !bankChanged ? e.verification : pendingSteps(bankName),
      duplicateOf: e && !bankChanged ? e.duplicateOf : undefined,
      payments: e?.payments ?? [],
    };
    guard.clear();
    onSave(r, bankChanged);
    close();
  };

  const input =
    "h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/35";
  const wide =
    "[&>button]:h-10 [&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button>svg:last-child]:ml-auto";

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

        <div className="mx-auto grid max-w-[860px] grid-cols-[150px_minmax(0,1fr)] gap-12 px-6 pb-20">
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
            className="mt-10 max-w-[520px]"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (step === "account" && ready.account) setStep("who");
              else if (step === "who" && ready.who) setStep("review");
              else if (step === "review" && ready.account && ready.who) save();
            }}
          >
            {step === "account" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  {fixing
                    ? `New account for ${e?.name.split(" ")[0]}`
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
                  <Field label="Where is their bank?">
                    <Dropdown
                      label="Bank country"
                      value={country}
                      active={!!country}
                      placeholder="Choose a country"
                      options={ALL_COUNTRIES.map((n) => ({
                        value: n,
                        label: n,
                        icon: <span aria-hidden>{FLAGS[n]}</span>,
                      }))}
                      onChange={(v) => {
                        if (v === country) return;
                        setCountry(v);
                        const m = methodsFor(v)[0];
                        setType(m.type);
                        if (m.inst) setInstType(m.inst);
                        if (m.rail === "ACH" || m.rail === "Wire")
                          setUsRail(m.rail);
                        setInstitution("");
                        setAccount("");
                        setCode("");
                        setTypedBank("");
                      }}
                      className={wide}
                    />
                  </Field>

                  {/* The account type follows from the country; only ask when there's a real choice. */}
                  {country && methodsFor(country).length > 1 && (
                    <Field label="Pay in">
                      <Dropdown
                        label="Pay in"
                        value={methodKey}
                        active
                        options={methodsFor(country).map((m) => ({
                          value: m.key,
                          label: m.label,
                          hint: m.hint,
                        }))}
                        onChange={(k) => {
                          const m = methodsFor(country).find(
                            (x) => x.key === k,
                          )!;
                          setType(m.type);
                          if (m.inst) setInstType(m.inst);
                          if (m.rail === "ACH" || m.rail === "Wire")
                            setUsRail(m.rail);
                          if (m.type !== type) {
                            setInstitution("");
                            setAccount("");
                            setCode("");
                          }
                        }}
                        className={wide}
                      />
                    </Field>
                  )}

                  {country && type === "global" && (
                    <>
                      <Field
                        label={
                          instType === "Mobile money" ? "Provider" : "Bank"
                        }
                      >
                        <Dropdown
                          label={
                            instType === "Mobile money" ? "Provider" : "Bank"
                          }
                          value={institution}
                          active={!!institution}
                          placeholder={
                            instType === "Mobile money"
                              ? "Choose a provider"
                              : "Choose a bank"
                          }
                          options={(g.institutions[instType] ?? []).map(
                            (n) => ({ value: n, label: n }),
                          )}
                          onChange={setInstitution}
                          className={wide}
                        />
                      </Field>
                    </>
                  )}

                  {country && (type !== "global" || institution) && (
                    <>
                      {needsCode && (
                        <Field label={codeLabel}>
                          <input
                            value={code}
                            onChange={(ev) => setCode(ev.target.value)}
                            placeholder={
                              type === "us"
                                ? "101019644"
                                : type === "sepa"
                                  ? "DEUTDEFF"
                                  : "BCIRLULL"
                            }
                            className={`${input} font-mono text-[12.5px] uppercase ${codeProblem ? "border-rose-400/50" : ""}`}
                          />
                          {codeProblem ? (
                            <Hint tone="bad">{codeProblem}</Hint>
                          ) : knownBank ? (
                            <Hint>
                              <span className="text-neutral-200">
                                {knownBank}
                              </span>
                            </Hint>
                          ) : null}
                        </Field>
                      )}
                      {needsCode && cleanCode && !codeProblem && !knownBank && (
                        <Field label="Bank name">
                          <input
                            value={typedBank}
                            onChange={(ev) => setTypedBank(ev.target.value)}
                            placeholder="We don't know this code yet — type the bank's name"
                            className={input}
                          />
                        </Field>
                      )}
                      {type === "sepa" && !cleanCode && (
                        <Field label="Bank name">
                          <input
                            value={typedBank}
                            onChange={(ev) => setTypedBank(ev.target.value)}
                            placeholder="N26"
                            className={input}
                          />
                        </Field>
                      )}
                      <Field label={rule.label}>
                        <input
                          inputMode={
                            type === "global" || type === "us"
                              ? "numeric"
                              : undefined
                          }
                          value={account}
                          onChange={(ev) => setAccount(ev.target.value)}
                          placeholder={rule.placeholder}
                          className={`${input} font-mono text-[12.5px] ${acctProblem ? "border-rose-400/50" : ""}`}
                        />
                        {acctProblem ? (
                          <Hint tone="bad">{acctProblem}</Hint>
                        ) : type === "global" && lookup.state === "looking" ? (
                          <Hint>Checking the name with {institution}…</Hint>
                        ) : type === "global" && lookup.state === "found" ? (
                          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[13px]">
                            <Check
                              size={14}
                              strokeWidth={2}
                              className="shrink-0 text-[var(--flow-in)]"
                            />
                            <span className="text-neutral-400">
                              Account name
                            </span>
                            <span className="ml-auto truncate font-medium text-white">
                              {lookup.name}
                            </span>
                          </div>
                        ) : (
                          <Hint>
                            Paid in {currency} by{" "}
                            {rail === "Local transfer"
                              ? instType === "Mobile money"
                                ? "mobile money"
                                : "local transfer"
                              : rail}{" "}
                            · arrives {arrival[rail].toLowerCase()}.
                          </Hint>
                        )}
                      </Field>
                    </>
                  )}
                </div>
              </>
            )}

            {step === "who" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  Who is it?
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
                  <Field label="Account holder name">
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
                      {lookup.state === "found"
                        ? `Filled in from ${institution}. Check it's who you mean to pay.`
                        : "Exactly as it appears on their bank account — the bank checks it."}
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
                    label="Pay in"
                    value={`${methodsFor(country).find((x) => x.key === methodKey)?.label ?? "—"}${instType === "Mobile money" && type === "global" ? " · mobile money" : ""} · arrives ${arrival[rail].toLowerCase()}`}
                    onEdit={() => setStep("account")}
                  />
                  <Row
                    label="Country"
                    value={
                      country
                        ? `${FLAGS[country] ?? ""} ${country} · ${currency}`
                        : "—"
                    }
                    onEdit={() => setStep("account")}
                  />
                  <Row
                    label={
                      type === "global" && instType === "Mobile money"
                        ? "Provider"
                        : "Bank"
                    }
                    value={bankName || "—"}
                    onEdit={() => setStep("account")}
                  />
                  {cleanCode && (
                    <Row
                      label={codeLabel.replace(" (optional)", "")}
                      value={cleanCode}
                      mono
                      onEdit={() => setStep("account")}
                    />
                  )}
                  <Row
                    label={rule.label.split(" (")[0]}
                    value={acct || "—"}
                    mono
                    onEdit={() => setStep("account")}
                  />
                  <Row
                    label="Holder"
                    value={`${name || "—"} · ${kind}`}
                    onEdit={() => setStep("who")}
                  />
                  <Row
                    label="Email"
                    value={email || "No email"}
                    onEdit={() => setStep("who")}
                  />
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
                  {!bankChanged
                    ? "Only their name or email changed, so they stay ready to pay."
                    : lookup.state === "found"
                      ? `${institution} already confirmed the account name. Gravv runs a quick compliance check — usually minutes.`
                      : `Before the first payment, Gravv checks with ${bankName || "the bank"} that the account name matches — usually under 1 business day.`}
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
                  step === "account"
                    ? !ready.account
                    : step === "who"
                      ? !ready.who
                      : !(ready.account && ready.who) || (!!e && !dirtyEdit)
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
                className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-start [&>button]:rounded-lg [&>button>svg:last-child]:ml-auto"
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
