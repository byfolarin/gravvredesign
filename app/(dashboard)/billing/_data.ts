/**
 * What Gravv charges the business: a plan on a rolling 30-day cycle, plus a fee on each
 * money movement — taken from the transaction as it happens, or added to the cycle's invoice.
 * Shaped like Gravv's real Billing Overview / Fee History. Placeholder data.
 */

export type PlanId = "starter" | "growth" | "enterprise";
export const PLANS: {
  id: PlanId;
  name: string;
  price: number;
  pitch: string;
  perks: string[];
}[] = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    pitch: "Pay as you go",
    perks: [
      "Sandbox and live",
      "Standard rates on every rail",
      "Core reporting",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: 250,
    pitch: "Lower rates as volume grows",
    perks: [
      "Lower rates on payments, cards and FX",
      "Higher limits",
      "Multi-currency across regions",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 1500,
    pitch: "Your own terms",
    perks: [
      "Best rate on every rail",
      "Account manager and SLAs",
      "Priority routing",
    ],
  },
];

type Rate = { pct: number; flat: number } | "custom";
export type FeeTypeId =
  | "onramp_ach"
  | "ach_in"
  | "wire_in"
  | "sepa_in"
  | "payout_ach"
  | "payout_swift"
  | "card_withdrawal"
  | "card_issued"
  | "conversion"
  | "collection";

export type FeeType = {
  id: FeeTypeId;
  /** Gravv's own name for it, as on the real screen. */
  system: string;
  label: string;
  group: "Money in" | "Money out" | "Cards" | "Conversion";
  /** Taken from the transaction, or added to the cycle's invoice. */
  how: "Instant" | "Invoiced";
  rates: Record<PlanId, Rate>;
};

export const FEE_TYPES: FeeType[] = [
  {
    id: "onramp_ach",
    system: "Onramp Ach Debit Credit",
    label: "ACH deposit to USDC",
    group: "Money in",
    how: "Instant",
    rates: {
      starter: { pct: 0.4, flat: 0.5 },
      growth: { pct: 0.2, flat: 0.25 },
      enterprise: "custom",
    },
  },
  {
    id: "ach_in",
    system: "Ach In",
    label: "ACH deposit",
    group: "Money in",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 0.5 },
      growth: { pct: 0, flat: 0 },
      enterprise: { pct: 0, flat: 0 },
    },
  },
  {
    id: "wire_in",
    system: "Wire In",
    label: "Wire deposit",
    group: "Money in",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 10 },
      growth: { pct: 0, flat: 5 },
      enterprise: { pct: 0, flat: 0 },
    },
  },
  {
    id: "sepa_in",
    system: "Sepa In",
    label: "SEPA deposit",
    group: "Money in",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 1 },
      growth: { pct: 0, flat: 0.5 },
      enterprise: { pct: 0, flat: 0 },
    },
  },
  {
    id: "payout_ach",
    system: "Offramp Ach",
    label: "ACH payout",
    group: "Money out",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 1 },
      growth: { pct: 0, flat: 0.5 },
      enterprise: "custom",
    },
  },
  {
    id: "payout_swift",
    system: "Offramp Swift",
    label: "SWIFT payout",
    group: "Money out",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 25 },
      growth: { pct: 0, flat: 15 },
      enterprise: "custom",
    },
  },
  {
    id: "collection",
    system: "Card Collection",
    label: "Card payment collected",
    group: "Cards",
    how: "Instant",
    rates: {
      starter: { pct: 2.9, flat: 0.3 },
      growth: { pct: 2.5, flat: 0.3 },
      enterprise: "custom",
    },
  },
  {
    id: "card_issued",
    system: "Card Issuance",
    label: "Card issued",
    group: "Cards",
    how: "Invoiced",
    rates: {
      starter: { pct: 0, flat: 1 },
      growth: { pct: 0, flat: 0.5 },
      enterprise: { pct: 0, flat: 0 },
    },
  },
  {
    id: "card_withdrawal",
    system: "Card Withdrawal",
    label: "Card balance back to account",
    group: "Cards",
    how: "Instant",
    rates: {
      starter: { pct: 0, flat: 0 },
      growth: { pct: 0, flat: 0 },
      enterprise: { pct: 0, flat: 0 },
    },
  },
  {
    id: "conversion",
    system: "Stablecoin Conversion",
    label: "USDT ↔ USDC conversion",
    group: "Conversion",
    how: "Instant",
    rates: {
      starter: { pct: 0.1, flat: 0 },
      growth: { pct: 0.05, flat: 0 },
      enterprise: "custom",
    },
  },
];

export const feeOn = (r: Rate, base: number) =>
  r === "custom"
    ? null
    : Math.round(((base * r.pct) / 100) * 100) / 100 + r.flat;

export type FeeStatus = "Taken" | "To invoice" | "Not charged";
export type Fee = {
  id: string;
  type: FeeTypeId;
  /** The transaction the fee belongs to, and its amount. */
  txnId: string;
  base: number;
  amount: number;
  status: FeeStatus;
  createdAt: string;
};

export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
export const CURRENT_PLAN: PlanId = "starter";
/** Rolling 30-day cycle. */
export const CYCLE_START = Date.UTC(2026, 9, 4);
export const CYCLE_END = Date.UTC(2026, 10, 3);
export const API_MODE: "Sandbox" | "Live" = "Sandbox";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(11);
const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join(
    "",
  );
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
const DAY = 24 * 60 * 60 * 1000;

// How often each fee shows up, and the usual transaction size behind it.
const MIX: [FeeTypeId, number, () => number][] = [
  ["onramp_ach", 0.42, () => 400 + Math.round(rand() * 900)],
  ["collection", 0.2, () => [3, 15, 20, 45, 150, 240][Math.floor(rand() * 6)]],
  ["payout_ach", 0.1, () => 500 + Math.round(rand() * 4000)],
  ["conversion", 0.09, () => 1000 + Math.round(rand() * 20000)],
  ["card_issued", 0.06, () => 0],
  ["wire_in", 0.05, () => 5000 + Math.round(rand() * 40000)],
  ["payout_swift", 0.04, () => 2000 + Math.round(rand() * 18000)],
  ["sepa_in", 0.03, () => 300 + Math.round(rand() * 3000)],
  ["card_withdrawal", 0.01, () => 50 + Math.round(rand() * 400)],
];
const pickType = () => {
  let r = rand();
  for (const m of MIX) if ((r -= m[1]) < 0) return m;
  return MIX[0];
};

/** ~3 months of fees, newest first. Invoiced fees in the current cycle wait for the invoice. */
export const fees: Fee[] = Array.from({ length: 420 }, (_, i) => {
  const t = AS_OF - Math.floor(i * 0.22 * DAY + rand() * 0.2 * DAY);
  const [type, , baseOf] = pickType();
  const ft = FEE_TYPES.find((f) => f.id === type)!;
  const base = baseOf();
  const amount = feeOn(ft.rates.starter, base) ?? 0;
  const failed = rand() < 0.07;
  const status: FeeStatus = failed
    ? "Not charged"
    : ft.how === "Invoiced" && t >= CYCLE_START
      ? "To invoice"
      : "Taken";
  return {
    id: uuid(),
    type,
    txnId: `txn_${hex(10)}`,
    base,
    amount: Math.round(amount * 100) / 100,
    status,
    createdAt: new Date(t).toISOString(),
  };
});

export const typeOf = (id: FeeTypeId) => FEE_TYPES.find((f) => f.id === id)!;
