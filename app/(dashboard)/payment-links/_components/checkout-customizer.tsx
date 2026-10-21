"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleCheck,
  CreditCard,
  ImagePlus,
  Landmark,
  Lock,
  X,
} from "lucide-react";
import { NetworkLogo } from "../../wallets/_components/network-logo";

/** Everything the hosted checkout takes from the business. Saved once, used by every link. */
export type CheckoutSettings = {
  name: string;
  supportEmail: string;
  logo: string | null;
  showLogo: boolean;
  color: string;
  shape: "rounded" | "pill" | "square";
  buttonLabel: "Pay" | "Pay now" | "Complete payment" | "Donate";
  collectName: boolean;
  collectPhone: boolean;
  collectAddress: boolean;
  cards: boolean;
  after: "confirm" | "redirect";
  message: string;
  redirectUrl: string;
};

export const DEFAULT_CHECKOUT: CheckoutSettings = {
  name: "Kredete",
  supportEmail: "payments@kredete.com",
  logo: null,
  showLogo: true,
  color: "#0a0a0a",
  shape: "rounded",
  buttonLabel: "Pay",
  collectName: true,
  collectPhone: false,
  collectAddress: false,
  cards: false,
  after: "confirm",
  message: "Thanks for your payment. A receipt is on its way to your inbox.",
  redirectUrl: "https://kredete.com/thanks",
};

const KEY = "gravv-checkout-settings";
const SWATCHES = [
  "#0a0a0a",
  "#00c48b",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#e11d48",
];
const RADIUS: Record<CheckoutSettings["shape"], string> = {
  rounded: "10px",
  pill: "999px",
  square: "4px",
};

/** Black or white text, whichever reads better on the brand colour. */
function onColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0a" : "#ffffff";
}
const validHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

export function loadCheckoutSettings(): CheckoutSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? {
          ...DEFAULT_CHECKOUT,
          ...(JSON.parse(raw) as Partial<CheckoutSettings>),
        }
      : DEFAULT_CHECKOUT;
  } catch {
    return DEFAULT_CHECKOUT;
  }
}

export function CheckoutCustomizer({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (s: CheckoutSettings) => void;
}) {
  const [saved, setSaved] = useState<CheckoutSettings>(DEFAULT_CHECKOUT);
  const [draft, setDraft] = useState<CheckoutSettings>(DEFAULT_CHECKOUT);
  const [hex, setHex] = useState(DEFAULT_CHECKOUT.color);
  const [view, setView] = useState<"checkout" | "confirmation">("checkout");
  const file = useRef<HTMLInputElement>(null);

  // Load what's saved after mount (storage isn't available during server render).
  useEffect(() => {
    const t = setTimeout(() => {
      const s = loadCheckoutSettings();
      setSaved(s);
      setDraft(s);
      setHex(s.color);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const set = (patch: Partial<CheckoutSettings>) =>
    setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dirty) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dirty, onClose]);

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Storage unavailable (or the logo is too large); keep it for this visit.
    }
    setSaved(draft);
    onSaved(draft);
  };

  const input =
    "h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/35";

  // Edit on the page itself: click a part of the pay page, a small toolbar opens beside it.
  const [spot, setSpot] = useState<Spot | null>(null);
  const [box, setBox] = useState<{
    top: number;
    left: number;
    side: "right" | "left";
  } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pick = (id: Spot, el: HTMLElement) => {
    // Sit beside the pay page, level with what was clicked; overlap it only when the window is too narrow.
    const st = stage.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const page = (
      el.closest("[data-paypage]") as HTMLElement
    ).getBoundingClientRect();
    const W = 272,
      gap = 16;
    const top = r.top - st.top + stage.current!.scrollTop;
    setSpot(id);
    if (st.right - page.right >= W + gap * 2)
      setBox({ top, left: page.right - st.left + gap, side: "right" });
    else if (page.left - st.left >= W + gap * 2)
      setBox({ top, left: page.left - st.left - gap - W, side: "left" });
    else
      setBox({
        top: top + r.height + 10,
        left: Math.min(r.left - st.left, st.width - W - gap),
        side: "right",
      });
  };
  useEffect(() => {
    if (!spot) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSpot(null);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [spot]);
  const switchView = (v: "checkout" | "confirmation") => {
    setView(v);
    setSpot(null);
  };

  const tools: Record<Spot, { title: string; body: React.ReactNode }> = {
    brand: {
      title: "Business",
      body: (
        <>
          <input
            aria-label="Name customers see"
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            className={input}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 text-[12px] text-white hover:bg-white/[0.12]"
            >
              <ImagePlus size={13} strokeWidth={1.75} />
              {draft.logo ? "Replace logo" : "Upload logo"}
            </button>
            {draft.logo && (
              <button
                type="button"
                onClick={() => set({ logo: null })}
                className="h-8 rounded-full px-3 text-[12px] text-neutral-400 hover:text-white"
              >
                Remove
              </button>
            )}
          </div>
          <Toggle
            on={draft.showLogo}
            onChange={() => set({ showLogo: !draft.showLogo })}
            label="Show logo"
          />
        </>
      ),
    },
    fields: {
      title: "What to ask for",
      body: (
        <>
          <p className="text-[12px] text-neutral-500">
            Email is always asked for, for the receipt.
          </p>
          <Toggle
            on={draft.collectName}
            onChange={() => set({ collectName: !draft.collectName })}
            label="Full name"
          />
          <Toggle
            on={draft.collectPhone}
            onChange={() => set({ collectPhone: !draft.collectPhone })}
            label="Phone number"
          />
          <Toggle
            on={draft.collectAddress}
            onChange={() => set({ collectAddress: !draft.collectAddress })}
            label="Address"
          />
        </>
      ),
    },
    methods: {
      title: "Ways to pay",
      body: (
        <>
          <p className="text-[12px] text-neutral-500">
            USDC and bank transfer are always on.
          </p>
          <Toggle
            on={draft.cards}
            onChange={() => set({ cards: !draft.cards })}
            label="Cards"
            hint="2.9% + 30¢"
          />
        </>
      ),
    },
    button: {
      title: "Pay button",
      body: (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => {
                  set({ color: c });
                  setHex(c);
                }}
                className="flex size-7 items-center justify-center rounded-full ring-offset-2 transition-shadow"
                style={{
                  background: c,
                  boxShadow:
                    draft.color === c
                      ? `0 0 0 2px var(--raised), 0 0 0 3.5px ${c === "#0a0a0a" ? "#fff" : c}`
                      : "inset 0 0 0 1px rgb(255 255 255 / 0.15)",
                }}
              >
                {draft.color === c && (
                  <Check
                    size={12}
                    strokeWidth={2.5}
                    style={{ color: onColor(c) }}
                  />
                )}
              </button>
            ))}
            <input
              aria-label="Hex colour"
              value={hex}
              onChange={(e) => {
                setHex(e.target.value);
                if (validHex(e.target.value)) set({ color: e.target.value });
              }}
              className="h-7 w-[84px] rounded-full border border-white/10 bg-white/[0.04] px-2.5 font-mono text-[11.5px] text-white outline-none focus:border-white/35"
            />
          </div>
          <Segmented
            value={draft.shape}
            onChange={(v) => set({ shape: v })}
            options={[
              { value: "rounded", label: "Rounded" },
              { value: "pill", label: "Pill" },
              { value: "square", label: "Square" },
            ]}
          />
          <div className="grid grid-cols-2 gap-1">
            {(["Pay", "Pay now", "Complete payment", "Donate"] as const).map(
              (v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set({ buttonLabel: v })}
                  className={`h-8 rounded-lg px-1 text-[12px] whitespace-nowrap transition-colors ${draft.buttonLabel === v ? "bg-white/[0.12] text-white" : "text-neutral-400 hover:bg-white/[0.05] hover:text-white"}`}
                >
                  {v}
                </button>
              ),
            )}
          </div>
        </>
      ),
    },
    support: {
      title: "Support email",
      body: (
        <>
          <input
            type="email"
            aria-label="Support email"
            value={draft.supportEmail}
            onChange={(e) => set({ supportEmail: e.target.value })}
            className={input}
          />
          <p className="text-[12px] text-neutral-500">
            Shown on the receipt and if a payment needs help.
          </p>
        </>
      ),
    },
    after: {
      title: "After paying",
      body: (
        <>
          <Segmented
            value={draft.after}
            onChange={(v) => set({ after: v })}
            options={[
              { value: "confirm", label: "Show this page" },
              { value: "redirect", label: "Send to my site" },
            ]}
          />
          {draft.after === "confirm" ? (
            <textarea
              rows={3}
              aria-label="Message"
              value={draft.message}
              onChange={(e) => set({ message: e.target.value })}
              className={`${input} h-auto resize-none py-2 leading-relaxed`}
            />
          ) : (
            <input
              aria-label="Redirect URL"
              value={draft.redirectUrl}
              placeholder="https://"
              onChange={(e) => set({ redirectUrl: e.target.value })}
              className={input}
            />
          )}
        </>
      ),
    },
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customize checkout"
      className="fixed inset-0 z-50 flex flex-col bg-takeover"
    >
      {/* Top bar: what this is, which page, and save */}
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-white">
            Customize checkout
          </div>
          <div className="text-[12px] text-neutral-500">
            Click anything on the page to change it. Applies to every link,
            including ones already shared.
          </div>
        </div>
        <div
          role="tablist"
          className="mx-auto flex items-center gap-1 rounded-full bg-white/[0.05] p-0.5"
        >
          {(["checkout", "confirmation"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={`h-8 rounded-full px-3.5 text-[13px] capitalize transition-colors ${view === v ? "bg-white/[0.1] font-medium text-white" : "text-neutral-500 hover:text-neutral-200"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(DEFAULT_CHECKOUT);
              setHex(DEFAULT_CHECKOUT.color);
              setSpot(null);
            }}
            className="h-9 rounded-full px-3 text-[12.5px] text-neutral-500 hover:text-white"
          >
            Reset
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => {
                setDraft(saved);
                setHex(saved.color);
                setSpot(null);
              }}
              className="h-9 rounded-full px-3 text-[13px] text-neutral-300 hover:text-white"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (dirty) save();
              onClose();
            }}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            {dirty ? "Save changes" : "Done"}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/png,image/svg+xml,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => set({ logo: String(reader.result) });
          reader.readAsDataURL(f);
          e.target.value = "";
        }}
      />

      {/* The pay page, full size, editable in place */}
      <div
        ref={stage}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSpot(null);
        }}
        className="cc-stage sidebar-scroll relative flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-8 pt-10 pb-16"
      >
        <PayPage s={draft} view={view} active={spot} onPick={pick} />
        {spot && box && (
          <div
            key={spot}
            className="cc-tool absolute z-10 w-[272px] rounded-2xl bg-raised p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] ring-1 ring-white/10"
            style={{ top: box.top, left: box.left }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] tracking-[0.08em] text-neutral-500 uppercase">
                {tools[spot].title}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSpot(null)}
                className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
              >
                <X size={13} strokeWidth={1.75} />
              </button>
            </div>
            <div className="space-y-3">{tools[spot].body}</div>
          </div>
        )}
      </div>
      <p className="cc-caption pb-4 text-center text-[11px] text-neutral-600">
        Sample link · pay.gravv.xyz/kredete/pro-annual
      </p>
    </div>
  );
}

type Spot = "brand" | "fields" | "methods" | "button" | "support" | "after";
const SPOT_LABEL: Record<Spot, string> = {
  brand: "Logo & name",
  fields: "Details asked",
  methods: "Ways to pay",
  button: "Pay button",
  support: "Support email",
  after: "After paying",
};

/** A part of the pay page you can click to edit: outlined on hover, labelled, ringed when open. */
function Editable({
  id,
  active,
  onPick,
  children,
  className = "",
}: {
  id: Spot;
  active?: Spot | null;
  onPick?: (id: Spot, el: HTMLElement) => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (!onPick) return <div className={className}>{children}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Edit ${SPOT_LABEL[id]}`}
      data-on={active === id || undefined}
      onClick={(e) => {
        e.stopPropagation();
        onPick(id, e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick(id, e.currentTarget);
        }
      }}
      className={`cc-spot ${className}`}
      data-label={SPOT_LABEL[id]}
    >
      {children}
    </div>
  );
}

/** The hosted pay page as customers get it — always light, at real scale. */
/** What a specific link puts on the pay page. Without one, the page shows a sample. */
export type PayLink = {
  title: string;
  amount: string;
  note?: string;
  email?: string;
  methods: ("USDC" | "Bank transfer" | "Card")[];
};

export function PayPage({
  s,
  view,
  active,
  onPick,
  link,
  compact = false,
}: {
  s: CheckoutSettings;
  view: "checkout" | "confirmation";
  active?: Spot | null;
  onPick?: (id: Spot, el: HTMLElement) => void;
  link?: PayLink;
  /** Tighter padding, for showing the page inside another panel. */
  compact?: boolean;
}) {
  const L: PayLink = link ?? {
    title: "Annual membership",
    amount: "$240.00",
    note: "12 months of Kredete Pro for your business.",
    methods: ["USDC", "Bank transfer", ...(s.cards ? (["Card"] as const) : [])],
  };
  const pad = compact ? "p-6" : "p-8";
  const E = (id: Spot, node: React.ReactNode, className = "") => (
    <Editable id={id} active={active} onPick={onPick} className={className}>
      {node}
    </Editable>
  );
  const fg = onColor(s.color);
  const radius = RADIUS[s.shape];
  const field =
    "h-10 rounded-lg border border-neutral-200 px-3 text-[13px] leading-10 text-neutral-400";
  const brand = (
    <div className="flex items-center gap-2.5">
      {s.showLogo && (
        <span
          className="flex size-8 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: s.logo ? "transparent" : s.color }}
        >
          {s.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={s.logo} alt="" className="size-full object-contain" />
          ) : (
            <span className="text-[13px] font-semibold" style={{ color: fg }}>
              {s.name[0] ?? "K"}
            </span>
          )}
        </span>
      )}
      <span className="text-[14px] font-medium text-[#0a0a0a]">
        {s.name || "Your business"}
      </span>
    </div>
  );

  if (view === "confirmation") {
    return (
      <div
        data-paypage
        className="theme-lock-light orbit-pop w-full max-w-[520px] rounded-2xl bg-white p-10 text-center text-[#0a0a0a] pay-sheet"
      >
        <div className="flex justify-center">
          {E("brand", brand, "-m-2 p-2")}
        </div>
        {E(
          "after",
          s.after === "confirm" ? (
            <>
              <CircleCheck
                size={40}
                strokeWidth={1.5}
                className="mx-auto mt-10"
                style={{ color: s.color === "#0a0a0a" ? "#0f9d6a" : s.color }}
              />
              <div className="mt-4 text-[22px] font-medium tracking-[-0.02em]">
                Payment received
              </div>
              <div className="mt-1 text-[28px] font-medium tracking-[-0.02em] tabular-nums">
                {L.amount}
              </div>
              <p className="mx-auto mt-4 max-w-[340px] text-[13px] leading-relaxed text-neutral-500">
                {s.message || "Thanks for your payment."}
              </p>
              <div className="mx-auto mt-8 max-w-[340px] divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-left text-[13px]">
                {[
                  ["Paid for", "Annual membership"],
                  ["Paid with", "USDC on Polygon"],
                  ["Receipt sent to", "tolu@adeyemi.co"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex justify-between gap-4 px-4 py-2.5"
                  >
                    <span className="text-neutral-500">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-6 text-[12px] text-neutral-400">
                Questions?{" "}
                <span
                  style={{ color: s.color === "#0a0a0a" ? undefined : s.color }}
                >
                  {s.supportEmail}
                </span>
              </p>
            </>
          ) : (
            <>
              <div
                className="mx-auto mt-12 size-8 animate-spin rounded-full border-2 border-neutral-200"
                style={{ borderTopColor: s.color }}
              />
              <div className="mt-5 text-[17px] font-medium">
                Payment received
              </div>
              <p className="mt-1 text-[13px] text-neutral-500">
                Taking you back to
              </p>
              <p className="mt-1 font-mono text-[12px] break-all text-neutral-700">
                {s.redirectUrl || "your website"}
              </p>
            </>
          ),
          "-mx-3 mt-2 px-3 pb-3",
        )}
      </div>
    );
  }

  return (
    <div
      data-paypage
      className="theme-lock-light orbit-pop grid w-full max-w-[860px] overflow-hidden rounded-2xl bg-white text-[#0a0a0a] pay-sheet md:grid-cols-[1fr_1.05fr]"
    >
      {/* Summary */}
      <div
        className={`border-b border-neutral-100 bg-neutral-50 md:border-r md:border-b-0 ${pad}`}
      >
        {E("brand", brand, "-m-2 w-fit p-2")}
        <div
          className={`${compact ? "mt-8" : "mt-10"} text-[13px] text-neutral-500`}
        >
          {L.title}
        </div>
        <div
          className={`mt-1 font-medium tracking-[-0.03em] tabular-nums ${compact ? "text-[28px]" : "text-[34px]"}`}
        >
          {L.amount}
        </div>
        {L.note && (
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-500">
            {L.note}
          </p>
        )}
        {E(
          "support",
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Lock size={11} strokeWidth={2} />
            Secured by Gravv · {s.supportEmail}
          </div>,
          "-mx-2 mt-8 w-fit px-2 py-1.5",
        )}
      </div>
      {/* Form */}
      <div className={pad}>
        {E(
          "fields",
          <>
            <div className="text-[13px] font-medium">Your details</div>
            <div className="mt-3 space-y-2">
              <div
                className={`${field} truncate ${L.email ? "text-neutral-800" : ""}`}
              >
                {L.email ?? "Email"}
              </div>
              {s.collectName && <div className={field}>Full name</div>}
              {s.collectPhone && <div className={field}>Phone number</div>}
              {s.collectAddress && (
                <>
                  <div className={field}>Address</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className={field}>City</div>
                    <div className={field}>Country</div>
                  </div>
                </>
              )}
            </div>
          </>,
          "-m-2 p-2",
        )}
        {E(
          "methods",
          <>
            <div className="text-[13px] font-medium">Pay with</div>
            <div className="mt-3 space-y-2">
              {L.methods
                .map((label) => ({
                  label,
                  icon:
                    label === "USDC" ? (
                      <NetworkLogo network="Polygon" size={16} />
                    ) : label === "Card" ? (
                      <CreditCard
                        size={15}
                        strokeWidth={1.75}
                        className="text-neutral-500"
                      />
                    ) : (
                      <Landmark
                        size={15}
                        strokeWidth={1.75}
                        className="text-neutral-500"
                      />
                    ),
                }))
                .map((m, i) => (
                  <div
                    key={m.label}
                    className="flex h-11 items-center gap-3 rounded-lg border px-3 text-[13px]"
                    style={{
                      borderColor: i === 0 ? s.color : "#e5e5e5",
                      boxShadow: i === 0 ? `0 0 0 1px ${s.color}` : undefined,
                    }}
                  >
                    <span
                      className="size-4 rounded-full border"
                      style={
                        i === 0
                          ? { borderColor: s.color, borderWidth: 5 }
                          : { borderColor: "#d4d4d4" }
                      }
                    />
                    {m.label}
                    <span className="ml-auto">{m.icon}</span>
                  </div>
                ))}
            </div>
          </>,
          "-mx-2 mt-4 p-2",
        )}
        {E(
          "button",
          <>
            <button
              type="button"
              tabIndex={-1}
              className="flex h-11 w-full items-center justify-center text-[14px] font-medium transition-[border-radius]"
              style={{ background: s.color, color: fg, borderRadius: radius }}
            >
              {s.buttonLabel} {L.amount}
            </button>
          </>,
          "-mx-2 mt-4 p-2",
        )}
        <p className="mt-3 text-center text-[11px] text-neutral-400">
          {s.after === "redirect"
            ? "You'll return to the merchant after paying."
            : "You'll get a receipt by email."}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex items-center gap-3 text-left"
    >
      <span
        aria-hidden
        style={{ width: 32, height: 18 }}
        className={`shrink-0 rounded-full p-0.5 transition-colors ${on ? "bg-white" : "bg-white/15"}`}
      >
        <span
          style={{
            width: 14,
            height: 14,
            transform: `translateX(${on ? 14 : 0}px)`,
          }}
          className={`block rounded-full transition-transform ${on ? "bg-black" : "bg-white"}`}
        />
      </span>
      <span className="text-[13px] text-neutral-200">
        {label}
        {hint && (
          <span className="ml-1.5 text-[12px] text-neutral-500">{hint}</span>
        )}
      </span>
    </button>
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
