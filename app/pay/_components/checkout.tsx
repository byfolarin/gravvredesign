"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CreditCard, Landmark, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  DEFAULT_CHECKOUT,
  loadCheckoutSettings,
  type CheckoutSettings,
} from "@/app/(dashboard)/payment-links/_components/checkout-customizer";
import {
  AS_OF,
  type Method,
  type PaymentLink,
} from "@/app/(dashboard)/payment-links/_data";

/**
 * The payer's side of a payment link (pay.gravv.xyz/…): always light, branded from the
 * business's checkout settings. Pay by bank transfer, USDC or card; a receipt when it lands;
 * plain pages for paused, expired and sold-out links. A small prototype control switches
 * states for presenting.
 */

type LinkState = "live" | "paused" | "expired" | "soldout";
type Phase =
  | { k: "form" }
  | { k: "processing" }
  | { k: "waiting"; method: Method }
  | { k: "declined" }
  | { k: "paid"; method: Method; amount: number; ref: string };

const NETWORKS = ["Ethereum", "Solana", "Polygon", "Base"] as const;
const DEPOSIT: Record<(typeof NETWORKS)[number], string> = {
  Ethereum: "0x7e2a91c4b05d38f6a1e9c2b74f0d3a86e15c2b44",
  Solana: "7Hq3xB9pLmN2vKcR8sTfWd4YzE6uJgA1oPiQ5rXnM2bC",
  Polygon: "0x3c8f1a2e94b7d05c6e1f8a2b9d4c7e03f5a6b1d2",
  Base: "0x9b4e2d71c3a85f06e2d1c9b8a7f4e3d2c1b0a998",
};

const money = (currency: PaymentLink["currency"], v: number) => {
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
  return currency === "USD"
    ? `$${n}`
    : currency === "NGN"
      ? `₦${n}`
      : `${n} USDC`;
};
const RADIUS: Record<CheckoutSettings["shape"], string> = {
  rounded: "10px",
  pill: "999px",
  square: "4px",
};
const onColor = (hex: string) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 160 ? "#0a0a0a" : "#ffffff";
};
const longDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function initialState(l: PaymentLink): LinkState {
  if (l.status === "Paused") return "paused";
  if (l.status === "Expired") return "expired";
  if (
    l.limit &&
    l.payments.filter((p) => p.status === "Paid").length >= l.limit
  )
    return "soldout";
  return "live";
}

export function Checkout({ link: l }: { link: PaymentLink }) {
  const [s, setS] = useState<CheckoutSettings>(DEFAULT_CHECKOUT);
  useEffect(() => {
    const t = setTimeout(() => setS(loadCheckoutSettings()), 0);
    return () => clearTimeout(t);
  }, []);

  const [state, setState] = useState<LinkState>(() => initialState(l));
  const [declineCards, setDeclineCards] = useState(false);
  const [phase, setPhase] = useState<Phase>({ k: "form" });
  const [method, setMethod] = useState<Method>(l.methods[0]);
  const [name, setName] = useState(l.customer?.name ?? "");
  const [email, setEmail] = useState(l.customer?.email ?? "");
  const [custom, setCustom] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("Polygon");
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [tried, setTried] = useState(false);

  const fg = onColor(s.color);
  const radius = RADIUS[s.shape];
  const anyAmount = l.amount === null;
  const amount = anyAmount
    ? Number(custom.replace(/[^0-9.]/g, "")) || 0
    : l.amount!;
  const ref = `${l.id.slice(6, 12).toUpperCase()}-${(email.length * 97 + amount).toString(36).toUpperCase().slice(-4).padStart(4, "0")}`;

  const cardDigits = card.number.replace(/\D/g, "");
  const problems = {
    amount: anyAmount && amount <= 0 ? "Enter an amount" : null,
    name: s.collectName && !name.trim() ? "Add your name" : null,
    email: !/^\S+@\S+\.\S+$/.test(email.trim())
      ? "Add an email for your receipt"
      : null,
    card:
      method === "Card" &&
      (cardDigits.length !== 16 ||
        !/^\d\d\s?\/\s?\d\d$/.test(card.exp.trim()) ||
        card.cvc.length < 3)
        ? "Check the card number, expiry and CVC"
        : null,
  };
  const valid =
    !problems.amount && !problems.name && !problems.email && !problems.card;

  const pay = () => {
    setTried(true);
    if (!valid) return;
    if (method === "Card") {
      setPhase({ k: "processing" });
      setTimeout(() => {
        if (declineCards || cardDigits === "4000000000000002")
          setPhase({ k: "declined" });
        else setPhase({ k: "paid", method, amount, ref });
      }, 1500);
    } else {
      setPhase({ k: "waiting", method });
      // Prototype: the transfer / on-chain payment is seen a few seconds later.
      setTimeout(
        () => setPhase({ k: "paid", method, amount, ref }),
        method === "USDC" ? 5000 : 4000,
      );
    }
  };

  const brand = (
    <div className="flex items-center gap-2.5">
      {s.showLogo && (
        <span
          className="flex size-8 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: s.logo ? "transparent" : s.color }}
        >
          {s.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- business logo from settings (data URL)
            <img src={s.logo} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[13px] font-semibold" style={{ color: fg }}>
              {s.name[0] ?? "K"}
            </span>
          )}
        </span>
      )}
      <span className="text-[14px] font-medium text-neutral-900">{s.name}</span>
    </div>
  );

  const primary = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2 text-[14px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
      style={{ background: s.color, color: fg, borderRadius: radius }}
    >
      {label}
    </button>
  );

  // ——— Link not taking payments ———
  if (state !== "live") {
    const copy =
      state === "paused"
        ? {
            title: "This link isn't taking payments right now",
            body: `${s.name} has paused it. If you were asked to pay, check with them for a new link.`,
          }
        : state === "expired"
          ? {
              title: "This link has expired",
              body: `It stopped taking payments${l.expiresAt ? ` on ${longDate.format(new Date(l.expiresAt))}` : ""}. Ask ${s.name} for a new one.`,
            }
          : {
              title: "All spots are taken",
              body: `${l.name} has reached its limit of ${l.limit} payments. ${s.name} may open more.`,
            };
    return (
      <Shell
        state={state}
        onState={setState}
        decline={declineCards}
        onDecline={setDeclineCards}
        linkId={l.id}
      >
        <div className="mx-auto max-w-[440px] rounded-2xl border border-neutral-200 bg-white p-8 text-center">
          <div className="flex justify-center">{brand}</div>
          <h1 className="mt-6 text-[19px] font-medium tracking-[-0.015em] text-neutral-900">
            {copy.title}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-neutral-500">
            {copy.body}
          </p>
          <a
            href={`mailto:${s.supportEmail}`}
            className="mt-6 inline-block text-[13px] text-neutral-700 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-900"
          >
            Contact {s.supportEmail}
          </a>
        </div>
      </Shell>
    );
  }

  // ——— Paid: receipt ———
  if (phase.k === "paid") {
    return (
      <Shell
        state={state}
        onState={setState}
        decline={declineCards}
        onDecline={setDeclineCards}
        linkId={l.id}
      >
        <div className="mx-auto max-w-[440px] rounded-2xl border border-neutral-200 bg-white p-8">
          {brand}
          <span className="mt-8 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check size={20} strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 text-[22px] font-medium tracking-[-0.02em] text-neutral-900">
            {money(l.currency, phase.amount)} paid
          </h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
            {s.after === "redirect" && s.redirectUrl
              ? `Taking you back to ${s.name}…`
              : s.message}
          </p>
          <dl className="mt-6 divide-y divide-neutral-100 border-y border-neutral-100 text-[13px]">
            {[
              ["To", s.name],
              ["For", l.name],
              [
                "Paid with",
                phase.method === "USDC" ? `USDC on ${network}` : phase.method,
              ],
              ["Reference", phase.ref],
              ["Date", longDate.format(new Date(AS_OF))],
              ["Receipt sent to", email],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 py-2.5">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            onClick={() => {
              const text = `Receipt — ${s.name}\n${l.name}\n${money(l.currency, phase.amount)} paid with ${phase.method}\nReference ${phase.ref}\n${longDate.format(new Date(AS_OF))}\nPaid by ${name || email}`;
              const url = URL.createObjectURL(
                new Blob([text], { type: "text/plain" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `receipt-${phase.ref}.txt`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
            className="mt-6 h-10 w-full rounded-lg border border-neutral-200 text-[13px] text-neutral-800 hover:bg-neutral-50"
          >
            Download receipt
          </button>
        </div>
      </Shell>
    );
  }

  const field =
    "h-11 w-full rounded-lg border bg-white px-3 text-[14px] text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900";
  const err = (m: string | null) =>
    tried && m ? <p className="mt-1.5 text-xs text-rose-600">{m}</p> : null;
  const busy = phase.k === "processing" || phase.k === "waiting";

  return (
    <Shell
      state={state}
      onState={setState}
      decline={declineCards}
      onDecline={setDeclineCards}
      linkId={l.id}
    >
      <div className="mx-auto grid max-w-[920px] gap-10 md:grid-cols-[minmax(0,1fr)_420px]">
        {/* What you're paying */}
        <section className="pt-2">
          {brand}
          <p className="mt-10 text-[13px] text-neutral-500">
            {l.customer ? `For ${l.customer.name}` : "Pay"}
          </p>
          <h1 className="mt-1 text-[24px] leading-tight font-medium tracking-[-0.02em] text-neutral-900">
            {l.name}
          </h1>
          {l.description && (
            <p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-neutral-500">
              {l.description}
            </p>
          )}
          <div className="mt-8 text-[36px] leading-none font-medium tracking-[-0.03em] text-neutral-900 tabular-nums">
            {anyAmount
              ? amount
                ? money(l.currency, amount)
                : "You choose"
              : money(l.currency, amount)}
          </div>
          {l.expiresAt && (
            <p className="mt-3 text-[13px] text-neutral-500">
              Pay by {longDate.format(new Date(l.expiresAt))}
            </p>
          )}
        </section>

        {/* How you pay */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6">
          <fieldset disabled={busy} className="space-y-4">
            {anyAmount && (
              <label className="block">
                <span className="text-[13px] text-neutral-700">Amount</span>
                <input
                  inputMode="decimal"
                  value={custom}
                  onChange={(e) =>
                    setCustom(e.target.value.replace(/[^0-9.,]/g, ""))
                  }
                  placeholder="0.00"
                  className={`${field} mt-1.5 tabular-nums ${tried && problems.amount ? "border-rose-400" : "border-neutral-200"}`}
                />
                {err(problems.amount)}
              </label>
            )}
            {s.collectName && (
              <label className="block">
                <span className="text-[13px] text-neutral-700">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`${field} mt-1.5 ${tried && problems.name ? "border-rose-400" : "border-neutral-200"}`}
                />
                {err(problems.name)}
              </label>
            )}
            <label className="block">
              <span className="text-[13px] text-neutral-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={`${field} mt-1.5 ${tried && problems.email ? "border-rose-400" : "border-neutral-200"}`}
              />
              {err(problems.email)}
            </label>

            {l.methods.length > 1 && (
              <div>
                <span className="text-[13px] text-neutral-700">Pay with</span>
                <div
                  role="radiogroup"
                  aria-label="Pay with"
                  className="mt-1.5 grid grid-cols-3 gap-2"
                >
                  {l.methods.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={method === m}
                      onClick={() => {
                        setMethod(m);
                        setPhase({ k: "form" });
                      }}
                      className={`flex h-16 flex-col items-start justify-between rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors ${
                        method === m
                          ? "border-neutral-900 text-neutral-900"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                      }`}
                    >
                      {m === "Card" ? (
                        <CreditCard size={16} />
                      ) : m === "Bank transfer" ? (
                        <Landmark size={16} />
                      ) : (
                        <UsdcMark />
                      )}
                      {m === "Bank transfer" ? "Bank" : m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method === "Card" && (
              <div className="space-y-2">
                <input
                  inputMode="numeric"
                  value={card.number}
                  onChange={(e) =>
                    setCard({
                      ...card,
                      number: e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 16)
                        .replace(/(\d{4})(?=\d)/g, "$1 "),
                    })
                  }
                  placeholder="Card number"
                  aria-label="Card number"
                  className={`${field} font-mono tabular-nums ${tried && problems.card ? "border-rose-400" : "border-neutral-200"}`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={card.exp}
                    onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCard({
                        ...card,
                        exp:
                          d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d,
                      });
                    }}
                    placeholder="MM / YY"
                    aria-label="Expiry"
                    className={`${field} tabular-nums ${tried && problems.card ? "border-rose-400" : "border-neutral-200"}`}
                  />
                  <input
                    inputMode="numeric"
                    value={card.cvc}
                    onChange={(e) =>
                      setCard({
                        ...card,
                        cvc: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    placeholder="CVC"
                    aria-label="CVC"
                    className={`${field} tabular-nums ${tried && problems.card ? "border-rose-400" : "border-neutral-200"}`}
                  />
                </div>
                {err(problems.card)}
                <p className="text-xs text-neutral-400">
                  Test card: 4242 4242 4242 4242 · any future date · any CVC.
                </p>
              </div>
            )}

            {method === "Bank transfer" && phase.k !== "waiting" && (
              <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-[13px] leading-relaxed text-neutral-600">
                You&apos;ll get account details to send{" "}
                {amount
                  ? money(l.currency === "USDC" ? "USD" : l.currency, amount)
                  : "the amount"}{" "}
                from your bank. It confirms once it lands — usually within
                minutes.
              </p>
            )}
            {method === "USDC" && phase.k !== "waiting" && (
              <div>
                <span className="text-[13px] text-neutral-700">Network</span>
                <div
                  role="radiogroup"
                  aria-label="Network"
                  className="mt-1.5 flex rounded-lg border border-neutral-200 p-0.5"
                >
                  {NETWORKS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={network === n}
                      onClick={() => setNetwork(n)}
                      className={`h-8 flex-1 rounded-md text-xs transition-colors ${
                        network === n
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-600 hover:text-neutral-900"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>

          {/* Waiting on a transfer / on-chain payment: show where to send it */}
          {phase.k === "waiting" && (
            <div className="mt-5 rounded-xl border border-neutral-200 p-4">
              {phase.method === "USDC" ? (
                <div className="flex gap-4">
                  <div className="shrink-0 rounded-lg border border-neutral-200 p-1.5">
                    <QRCodeSVG
                      value={`${DEPOSIT[network]}?amount=${amount}`}
                      size={96}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                    />
                  </div>
                  <div className="min-w-0 text-[13px]">
                    <div className="text-neutral-900">
                      Send exactly {amount.toFixed(2)} USDC
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      on {network} — other tokens or networks won&apos;t arrive
                    </div>
                    <Copyable value={DEPOSIT[network]} mono />
                  </div>
                </div>
              ) : (
                <dl className="space-y-2 text-[13px]">
                  {[
                    [
                      "Amount",
                      money(l.currency === "USDC" ? "USD" : l.currency, amount),
                    ],
                    [
                      "Bank",
                      l.currency === "NGN" ? "Providus Bank" : "Lead Bank",
                    ],
                    [
                      "Account",
                      l.currency === "NGN" ? "9012447801" : "4100772913",
                    ],
                    ...(l.currency === "NGN" ? [] : [["Routing", "101019644"]]),
                    ["Name", `${s.name} · Gravv`],
                    ["Reference", ref],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-3"
                    >
                      <dt className="text-neutral-500">{k}</dt>
                      <dd>
                        <Copyable
                          value={v}
                          mono={k !== "Name" && k !== "Bank"}
                          inline
                        />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3 text-[13px] text-neutral-600">
                <span
                  className="size-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"
                  aria-hidden
                />
                {phase.method === "USDC"
                  ? "Watching the network for your payment…"
                  : "Waiting for your transfer to land…"}
              </div>
            </div>
          )}

          {phase.k === "declined" && (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] text-rose-700">
              Your bank declined this card. Nothing was charged — try another
              card, or pay by{" "}
              {l.methods
                .filter((m) => m !== "Card")
                .map((m) => (m === "USDC" ? m : m.toLowerCase()))
                .join(" or ") || "another method"}
              .
            </div>
          )}

          <div className="mt-5">
            {phase.k === "waiting"
              ? null
              : primary(
                  phase.k === "processing"
                    ? "Processing…"
                    : method === "Card"
                      ? `${s.buttonLabel} ${amount ? money(l.currency === "USDC" ? "USD" : l.currency, amount) : ""}`.trim()
                      : method === "USDC"
                        ? "Show where to send USDC"
                        : "Show bank details",
                  () => {
                    if (phase.k === "declined") setPhase({ k: "form" });
                    pay();
                  },
                  phase.k === "processing",
                )}
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
            <Lock size={12} /> Secured by Gravv
          </p>
        </section>
      </div>
    </Shell>
  );
}

function UsdcMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill="#fff"
      >
        $
      </text>
    </svg>
  );
}

function Copyable({
  value,
  mono = false,
  inline = false,
}: {
  value: string;
  mono?: boolean;
  inline?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      title="Copy"
      className={`group flex max-w-full items-center gap-1.5 text-left text-neutral-900 ${inline ? "" : "mt-2 rounded-md bg-neutral-50 px-2 py-1.5"}`}
    >
      <span className={`truncate ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </span>
      <span className="shrink-0 text-[11px] text-neutral-400 group-hover:text-neutral-700">
        {done ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

/** Light page frame + the prototype state control (bottom-left). */
function Shell({
  children,
  state,
  onState,
  decline,
  onDecline,
  linkId,
}: {
  children: ReactNode;
  state: LinkState;
  onState: (s: LinkState) => void;
  decline: boolean;
  onDecline: (v: boolean) => void;
  linkId: string;
}) {
  return (
    <div className="min-h-screen bg-[#f6f6f5] px-5 py-12 text-neutral-900 sm:px-8 sm:py-16">
      {children}
      <div className="fixed bottom-4 left-4 flex items-center gap-2 rounded-xl border border-neutral-200 bg-white p-1.5 text-xs text-neutral-600 shadow-lg">
        <Link
          href={`/payment-links/${linkId}`}
          className="flex h-7 items-center gap-1 rounded-md px-2 hover:bg-neutral-100"
        >
          <ArrowLeft size={12} /> Gravv
        </Link>
        <span className="h-4 w-px bg-neutral-200" />
        <span className="pl-1 text-neutral-400">Prototype</span>
        <select
          aria-label="Link state"
          value={state}
          onChange={(e) => onState(e.target.value as LinkState)}
          className="h-7 rounded-md border border-neutral-200 bg-white px-1.5 text-xs"
        >
          <option value="live">Live</option>
          <option value="paused">Paused</option>
          <option value="expired">Expired</option>
          <option value="soldout">Sold out</option>
        </select>
        <label className="flex h-7 items-center gap-1.5 px-1.5">
          <input
            type="checkbox"
            checked={decline}
            onChange={(e) => onDecline(e.target.checked)}
          />
          Cards decline
        </label>
      </div>
    </div>
  );
}
