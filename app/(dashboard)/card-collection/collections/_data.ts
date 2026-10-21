/**
 * Card collections: a customer pays by card (checkout or API), Gravv screens it (Protection,
 * 3-D Secure), charges it, then settles the money to you in USDC. Two stages can fail —
 * the card charge, and the settlement after it — and the statuses follow Gravv's own words.
 * Placeholder data; nothing persists.
 */

export type CollectionStatus =
  | "Settlement completed"
  | "Settlement pending"
  | "Settlement failed"
  | "Payment failed"
  | "Expired"
  | "Abandoned"
  | "Refunded"
  | "Partially refunded";

export type Protection = "Approved" | "Declined" | "Review";
export type ThreeDS = "Challenge" | "Frictionless" | "Not required" | "Failed";

export type Collection = {
  id: string;
  reference: string;
  createdAt: string;
  status: CollectionStatus;
  /** What the card was charged, in the card's currency. */
  charged: { amount: number; currency: "USD" | "EUR" | "GBP" | "NGN" };
  /** What reaches you in USDC (the real screen's "Subtotal"). */
  subtotal: number;
  fee: number;
  card: {
    brand: "Visa" | "Mastercard" | "Amex" | "Verve";
    last4: string;
    funding: "Credit" | "Debit";
    country: string;
    issuer: string;
  };
  customer: { id: string; name: string; email: string };
  /** Where the payment came from: a payment link or your own integration. */
  source: { kind: "Payment link"; name: string } | { kind: "API" };
  protection: Protection;
  riskScore: number;
  threeDS: ThreeDS;
  cvc: "Passed" | "Failed" | "Not checked";
  /** Plain-words reason when something didn't go through. */
  problem?: string;
  settledTo: string;
  settlementHash?: string;
  refunded?: number;
  disputed?: boolean;
  events: { label: string; at: string; tone?: "danger" }[];
};

export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
export const SETTLE_TO = "Treasury wallet · USDC · Polygon";
export const FEE_RATE = 0.029;
export const FEE_FIXED = 0.3;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(7);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const hex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join(
    "",
  );
const uuid = () =>
  `${hex(8)}-${hex(4)}-4${hex(3)}-${pick(["8", "9", "a", "b"])}${hex(3)}-${hex(12)}`;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const CUSTOMERS = [
  ["Tolu Adeyemi", "tolu@adeyemi.co", "NG"],
  ["Grace Mensah", "grace.mensah@example.com", "GH"],
  ["Jordan Blake", "jordan@blake.studio", "US"],
  ["Chioma Eze", "chioma.eze@example.com", "NG"],
  ["Lena Fischer", "lena.fischer@example.de", "DE"],
  ["Kwame Asante", "kwame@asante.africa", "GH"],
  ["Musa Bello", "musa.bello@kredete.com", "NG"],
  ["Priya Nair", "priya@nair.in", "GB"],
  ["Sofia Alvarez", "sofia@alvarez.mx", "US"],
  ["Daniel Okafor", "daniel@okafor.dev", "NG"],
] as const;

const ISSUERS: Record<string, string[]> = {
  NG: ["Access Bank", "GTBank", "Zenith Bank"],
  GH: ["Ecobank Ghana", "Stanbic Ghana"],
  US: ["Chase", "Capital One", "Bank of America"],
  DE: ["Deutsche Bank", "N26"],
  GB: ["Monzo", "Barclays"],
};
const CURRENCY: Record<string, Collection["charged"]["currency"]> = {
  NG: "USD",
  GH: "USD",
  US: "USD",
  DE: "EUR",
  GB: "GBP",
};
const TO_USD = { USD: 1, EUR: 1.08, GBP: 1.27, NGN: 1 / 1550 };

const LINKS = [
  "Annual membership",
  "Lagos Fintech Week · Early bird",
  "Consulting call · 60 min",
  "Merch drop · Hoodie",
  "Workshop · Stablecoin payouts 101",
];

const PAYMENT_FAILURES = [
  "Protection declined it — the card's country didn't match the customer's IP and the risk score was high. Nothing was charged.",
  "The customer's bank declined the card (insufficient funds). Nothing was charged — they can try another card.",
  "The bank said “do not honor” without a reason. Nothing was charged — the customer should call their bank or use another card.",
  "3-D Secure failed — the customer didn't complete the bank's check. Nothing was charged.",
  "Too many attempts on this card in 10 minutes, so Protection blocked it. Nothing was charged.",
];
const SETTLEMENT_FAILURES = [
  "The card was charged, but converting to USDC timed out while Polygon was congested. The money is held by Gravv — retry to settle it.",
  "The card was charged, but the rate moved past the 1% tolerance before conversion. The money is held by Gravv — retry at the current rate.",
  "The card was charged, but the card network hasn't released the funds yet (held for review). Retry once it clears, usually within a day.",
];

// Outcome mix roughly like the real account: many fail at the card, a few after charging.
const PLAN: CollectionStatus[] = [
  "Settlement completed",
  "Payment failed",
  "Settlement completed",
  "Expired",
  "Settlement completed",
  "Payment failed",
  "Settlement completed",
  "Settlement failed",
  "Settlement completed",
  "Abandoned",
  "Settlement completed",
  "Payment failed",
  "Settlement completed",
  "Refunded",
  "Settlement completed",
  "Settlement failed",
  "Payment failed",
  "Settlement completed",
  "Expired",
  "Settlement completed",
  "Settlement pending",
  "Settlement completed",
  "Partially refunded",
  "Payment failed",
  "Settlement completed",
  "Settlement failed",
  "Settlement completed",
  "Abandoned",
  "Settlement completed",
  "Payment failed",
  "Settlement completed",
  "Settlement completed",
  "Expired",
  "Settlement failed",
  "Settlement completed",
  "Payment failed",
  "Settlement completed",
  "Settlement completed",
];
const AMOUNTS = [
  3, 20, 15, 4, 240, 150, 45, 65, 10, 12.35, 5.65, 180, 1, 3, 20,
];

const round = (v: number) => Math.round(v * 100) / 100;

function make(i: number, status: CollectionStatus): Collection {
  const [name, email, country] = pick(CUSTOMERS);
  // Newest first, spread over ~90 days with a few clustered on the same day.
  const t = AS_OF - Math.floor(i * 0.64 * DAY + rand() * 0.5 * DAY);
  const currency = CURRENCY[country];
  const usd = pick(AMOUNTS);
  const chargedAmount = round(usd / TO_USD[currency]);
  const fee = round(usd * FEE_RATE + FEE_FIXED);
  const charged =
    status !== "Payment failed" &&
    status !== "Expired" &&
    status !== "Abandoned";
  const protection: Protection =
    status === "Payment failed"
      ? pick(["Declined", "Declined", "Approved"] as const)
      : status === "Expired" || status === "Abandoned"
        ? "Approved"
        : rand() < 0.1
          ? "Review"
          : "Approved";
  const threeDS: ThreeDS =
    status === "Payment failed" && rand() < 0.25
      ? "Failed"
      : pick([
          "Not required",
          "Not required",
          "Challenge",
          "Frictionless",
        ] as const);
  const problem =
    status === "Payment failed"
      ? protection === "Declined"
        ? pick([PAYMENT_FAILURES[0], PAYMENT_FAILURES[4]])
        : threeDS === "Failed"
          ? PAYMENT_FAILURES[3]
          : pick([PAYMENT_FAILURES[1], PAYMENT_FAILURES[2]])
      : status === "Settlement failed"
        ? pick(SETTLEMENT_FAILURES)
        : status === "Expired"
          ? "The checkout stayed open for 30 minutes without a payment, so it expired. Nothing was charged."
          : status === "Abandoned"
            ? "The customer closed the checkout before paying. Nothing was charged."
            : undefined;
  const at = (m: number) => new Date(t + m * MIN).toISOString();
  const events: Collection["events"] = [
    { label: "Checkout opened", at: at(0) },
  ];
  if (status === "Expired") events.push({ label: "Expired", at: at(30) });
  else if (status === "Abandoned")
    events.push({ label: "Closed by customer", at: at(3) });
  else {
    events.push({
      label: `Protection ${protection === "Declined" ? "declined" : protection === "Review" ? "flagged for review, then approved" : "approved"}`,
      at: at(1),
      tone: protection === "Declined" ? "danger" : undefined,
    });
    if (protection !== "Declined" && threeDS !== "Not required")
      events.push({
        label:
          threeDS === "Failed"
            ? "3-D Secure failed"
            : `3-D Secure ${threeDS.toLowerCase()} passed`,
        at: at(2),
        tone: threeDS === "Failed" ? "danger" : undefined,
      });
    if (
      status === "Payment failed" &&
      protection !== "Declined" &&
      threeDS !== "Failed"
    )
      events.push({ label: "Declined by the bank", at: at(2), tone: "danger" });
    if (charged) {
      events.push({ label: "Card charged", at: at(2) });
      if (status === "Settlement failed")
        events.push({ label: "Settlement failed", at: at(9), tone: "danger" });
      else if (status === "Settlement pending")
        events.push({ label: "Settling to USDC", at: at(3) });
      else events.push({ label: "Settled to USDC", at: at(6) });
      if (status === "Refunded" || status === "Partially refunded")
        events.push({
          label: status === "Refunded" ? "Refunded in full" : "Partly refunded",
          at: at(2 * 24 * 60),
        });
    }
  }
  return {
    id: uuid(),
    reference: rand() < 0.3 ? `INV-2026-${100 + i}` : uuid(),
    createdAt: new Date(t).toISOString(),
    status,
    charged: { amount: chargedAmount, currency },
    subtotal: usd,
    fee,
    card: {
      brand:
        country === "NG" && rand() < 0.3
          ? "Verve"
          : pick(["Visa", "Visa", "Mastercard", "Amex"] as const),
      last4: String(1000 + Math.floor(rand() * 9000)),
      funding: rand() < 0.6 ? "Debit" : "Credit",
      country,
      issuer: pick(ISSUERS[country]),
    },
    customer: { id: `cus_${hex(6)}`, name, email },
    source:
      rand() < 0.55
        ? { kind: "Payment link", name: pick(LINKS) }
        : { kind: "API" },
    protection,
    riskScore:
      protection === "Declined"
        ? 78 + Math.floor(rand() * 20)
        : protection === "Review"
          ? 55 + Math.floor(rand() * 15)
          : 4 + Math.floor(rand() * 30),
    threeDS,
    cvc: protection === "Declined" && rand() < 0.4 ? "Failed" : "Passed",
    problem,
    settledTo: SETTLE_TO,
    settlementHash:
      charged &&
      status !== "Settlement failed" &&
      status !== "Settlement pending"
        ? `0x${hex(64)}`
        : undefined,
    refunded:
      status === "Refunded"
        ? usd
        : status === "Partially refunded"
          ? round(usd / 2)
          : undefined,
    disputed: i === 12,
    events,
  };
}

// ~140 payments over 90 days: the hand-written start (newest), then a weighted mix like the
// real account — most settle, a fair share fail at the card, a few fail after charging.
const MIX: [CollectionStatus, number][] = [
  ["Settlement completed", 0.56],
  ["Payment failed", 0.18],
  ["Expired", 0.08],
  ["Abandoned", 0.05],
  ["Settlement failed", 0.04],
  ["Refunded", 0.05],
  ["Partially refunded", 0.04],
];
const mixed = (): CollectionStatus => {
  let r = rand();
  for (const [st, w] of MIX) if ((r -= w) < 0) return st;
  return "Settlement completed";
};
// Older payments that failed to settle have long since been retried; keep the stuck ones recent.
const plan: CollectionStatus[] = [
  ...PLAN.slice(0, 14),
  ...Array.from({ length: 126 }, (_, i) => {
    const st = mixed();
    return st === "Settlement failed" && i > 30 ? "Settlement completed" : st;
  }),
];

export const collections: Collection[] = plan.map((s, i) => make(i, s));

/** Money stuck after the card was charged. */
export const isStuck = (c: Collection) => c.status === "Settlement failed";
export const wasCharged = (c: Collection) =>
  !["Payment failed", "Expired", "Abandoned"].includes(c.status);
