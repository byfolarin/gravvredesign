export type AccountStatus = "Active" | "Pending" | "Frozen" | "Closed";
export type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "NGN"
  | "JPY"
  | "CAD"
  | "AUD"
  | "CHF"
  | "KES"
  | "GHS"
  | "ZAR"
  | "AED";

/** Every currency an account can be held in, in the order pickers list them. */
export const ALL_CURRENCIES: Currency[] = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "KES",
  "GHS",
  "ZAR",
  "AED",
];
/** Rough units per USD, so seeded balances look right in each currency. */
const FX: Record<Currency, number> = {
  USD: 1,
  EUR: 1,
  GBP: 1,
  NGN: 900,
  JPY: 150,
  CAD: 1.37,
  AUD: 1.52,
  CHF: 0.88,
  KES: 129,
  GHS: 15.5,
  ZAR: 18.2,
  AED: 3.67,
};
export type Category = "Individual" | "Business";

/** Where a pending account is in provisioning (index into PROVISION_STEPS). */
export const PROVISION_STEPS = [
  "Application submitted",
  "Compliance review",
  "Bank provisioning",
  "Account active",
] as const;

/** Gravv's account types, chosen when the account is opened. */
export type AccountType = "Regular" | "Operating" | "Default" | "Card";

export type Account = {
  id: string;
  /** What the team calls it. Left blank when opening, it's "{currency} {type}", e.g. "USD Operating". */
  label: string;
  type: AccountType;
  /** Main = your own business; Sub = one of your customers. */
  tier: "Main account" | "Sub account";
  customer: { name: string; email: string };
  category: Category;
  bank: string;
  currency: Currency;
  balance: number;
  status: AccountStatus;
  /** Full account number / IBAN, and how to route to it. */
  accountNumber: string;
  routing: { label: string; value: string };
  createdAt: string;
  /** Pending only: current provisioning step (0–2) and when it started. */
  step?: number;
  stepSince?: string;
  /** Something stopping it: the bank wants documents, declined it, or stopped sending balances. */
  problem?: {
    kind: "needs-info" | "rejected" | "stale";
    text: string;
    since?: string;
  };
};

export type ApplicationStatus =
  "In review" | "Needs info" | "Approved" | "Rejected";
export type Application = {
  id: string;
  applicant: string;
  email: string;
  category: Category;
  bank: string;
  currency: Currency;
  submittedAt: string;
  status: ApplicationStatus;
  note?: string;
};

/** Data snapshot time so relative dates agree on server and client. */
export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(2509);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const hex = (n: number) =>
  Array.from(
    { length: n },
    () => "0123456789abcdef"[Math.floor(rand() * 16)],
  ).join("");
const digits = (n: number) =>
  Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");
const uuid = () =>
  `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;

const people = [
  "Amara Nwosu",
  "Tolu Adeyemi",
  "Grace Mensah",
  "Ikenna Obi",
  "Sarah Chen",
  "Kwame Asante",
  "Lena Fischer",
  "Musa Bello",
  "Priya Nair",
  "Jordan Blake",
  "Chioma Eze",
  "Daniel Okafor",
  "Marcus Reid",
  "Sofia Alvarez",
  "Hannah Kim",
  "Femi Okonkwo",
];
const businesses = [
  "Lumen Labs Inc",
  "Northwind Logistics",
  "Atlas Relief Foundation",
  "Meridian Trade Co",
  "Kite & Kettle Ltd",
  "Brightpath Studio",
  "Harbor Freight Partners",
  "Sable Analytics",
  "Orchid Health",
  "Tundra Supply",
];
export const BANKS: Record<
  Currency,
  { bank: string; routing: () => { label: string; value: string } }[]
> = {
  USD: [
    {
      bank: "Stearns Bank",
      routing: () => ({ label: "Routing number", value: "091202590" }),
    },
    {
      bank: "Lead Bank",
      routing: () => ({ label: "Routing number", value: "101019644" }),
    },
    {
      bank: "Cross River Bank",
      routing: () => ({ label: "Routing number", value: "021214891" }),
    },
  ],
  EUR: [
    {
      bank: "Banking Circle S.A.",
      routing: () => ({ label: "SWIFT / BIC", value: "BCIRLULL" }),
    },
  ],
  GBP: [
    {
      bank: "Clear Junction Limited",
      routing: () => ({ label: "Sort code", value: "04-13-07" }),
    },
  ],
  NGN: [
    {
      bank: "Access Bank Plc",
      routing: () => ({ label: "SWIFT / BIC", value: "ABNGNGLA" }),
    },
  ],
  JPY: [
    {
      bank: "GMO Aozora Net Bank",
      routing: () => ({ label: "SWIFT / BIC", value: "GMOAJPJT" }),
    },
  ],
  CAD: [
    {
      bank: "Peoples Trust Company",
      routing: () => ({ label: "Transit / institution", value: "00011-621" }),
    },
  ],
  AUD: [
    {
      bank: "Cuscal Limited",
      routing: () => ({ label: "BSB", value: "802-985" }),
    },
  ],
  CHF: [
    {
      bank: "Banking Circle S.A.",
      routing: () => ({ label: "SWIFT / BIC", value: "BCIRLULL" }),
    },
  ],
  KES: [
    {
      bank: "Equity Bank Kenya",
      routing: () => ({ label: "SWIFT / BIC", value: "EQBLKENA" }),
    },
  ],
  GHS: [
    {
      bank: "Ecobank Ghana",
      routing: () => ({ label: "SWIFT / BIC", value: "ECOCGHAC" }),
    },
  ],
  ZAR: [
    {
      bank: "Standard Bank",
      routing: () => ({ label: "Branch code", value: "051001" }),
    },
  ],
  AED: [
    {
      bank: "Zand Bank",
      routing: () => ({ label: "SWIFT / BIC", value: "ZANDAEAA" }),
    },
  ],
};
/** Names teams actually type when they don't take the suggestion. */
const customLabels = [
  "Payroll",
  "Supplier payouts",
  "Tax reserve",
  "Lagos collections",
  "Card float",
  "Treasury sweep",
  "Escrow — Q4",
  "Marketplace payouts",
  "Rent & utilities",
  "Contractor payments",
];

function make(i: number, only?: Currency): Account {
  // About one in eight is the workspace's own (main) account.
  const main = rand() < 0.12;
  const business = main || rand() < 0.45;
  const name = main
    ? "Kredete Ltd"
    : business
      ? pick(businesses)
      : pick(people);
  const r = rand();
  const currency: Currency = only
    ? only
    : r < 0.78
      ? "USD"
      : r < 0.88
        ? "EUR"
        : r < 0.95
          ? "GBP"
          : "NGN";
  const { bank, routing } = pick(BANKS[currency]);
  // The newest accounts are the ones still being provisioned, like the live list.
  const s = rand();
  const status: AccountStatus =
    i < 5
      ? "Pending"
      : s < 0.12
        ? "Pending"
        : s < 0.9
          ? "Active"
          : s < 0.95
            ? "Frozen"
            : "Closed";
  const age = i < 5 ? i * 0.4 : 1 + i * 0.12 + rand() * 6;
  // Provisioning takes days, not months — waiting accounts were opened recently.
  const createdAt = new Date(
    AS_OF -
      (status === "Pending" && i >= 5 ? 0.3 + ((i * 0.37) % 8) : age) * DAY,
  ).toISOString();
  const balance =
    status === "Active" || status === "Frozen"
      ? (Math.round(
          (rand() < 0.15
            ? rand() * 250_000
            : rand() < 0.5
              ? rand() * 12_000
              : rand() * 1_800) * 100,
        ) /
          100) *
        FX[currency]
      : 0;
  const step =
    status === "Pending" ? (i < 5 ? i % 3 : Math.floor(rand() * 3)) : undefined;
  const tr = rand();
  const type: AccountType =
    tr < 0.35
      ? "Regular"
      : tr < 0.65
        ? "Operating"
        : tr < 0.9
          ? "Default"
          : "Card";
  // Most teams take the suggestion; some name it themselves.
  const label = rand() < 0.62 ? `${currency} ${type}` : pick(customLabels);
  return {
    id: uuid(),
    label,
    type,
    tier: main ? "Main account" : "Sub account",
    customer: {
      name,
      email: `${name
        .toLowerCase()
        .replace(/[^a-z]+/g, ".")
        .replace(/\.$/, "")}@example.com`,
    },
    category: business ? "Business" : "Individual",
    bank,
    currency,
    balance,
    status,
    accountNumber:
      currency === "EUR"
        ? `LU${digits(2)}4080${digits(12)}`
        : currency === "GBP"
          ? digits(8)
          : digits(currency === "NGN" ? 10 : 12),
    routing: routing(),
    createdAt,
    step,
    stepSince:
      step !== undefined
        ? new Date(Date.parse(createdAt) + step * 0.6 * DAY).toISOString()
        : undefined,
  };
}

const core: Account[] = Array.from({ length: 2509 }, (_, i) => make(i));

export const applications: Application[] = Array.from(
  { length: 34 },
  (_, i) => {
    const business = rand() < 0.5;
    const applicant = business ? pick(businesses) : pick(people);
    const r = rand();
    const status: ApplicationStatus =
      i < 6
        ? "In review"
        : r < 0.25
          ? "In review"
          : r < 0.4
            ? "Needs info"
            : r < 0.9
              ? "Approved"
              : "Rejected";
    const currency: Currency = rand() < 0.8 ? "USD" : "EUR";
    return {
      id: `app_${hex(6)}`,
      applicant,
      email: `${applicant
        .toLowerCase()
        .replace(/[^a-z]+/g, ".")
        .replace(/\.$/, "")}@example.com`,
      category: business ? "Business" : "Individual",
      bank: pick(BANKS[currency]).bank,
      currency,
      submittedAt: new Date(AS_OF - (i * 0.7 + rand()) * DAY).toISOString(),
      status,
      note:
        status === "Needs info"
          ? pick([
              "Proof of address is older than 3 months",
              "Beneficial owner ID missing",
              "W-8BEN-E not signed",
            ])
          : status === "Rejected"
            ? "Couldn't verify the business registration"
            : undefined,
    };
  },
);

// Smaller books in the other currencies, generated after everything above so the
// original seeded accounts and applications are unchanged.
const EXTRA: [Currency, number][] = [
  ["JPY", 46],
  ["AUD", 31],
  ["KES", 42],
  ["GHS", 35],
  ["ZAR", 27],
];
let n = core.length;
export const accounts: Account[] = [
  ...core,
  ...EXTRA.flatMap(([c, count]) =>
    Array.from({ length: count }, () => make(n++, c)),
  ),
];

export type SyncState =
  | { kind: "live"; at: string }
  | { kind: "cooling"; at: string; retryMins: number }
  | { kind: "unreachable"; at: string; retryMins: number }
  | { kind: "paused" };

/** The record behind an account's details sheet, derived from its id so it never drifts. */
export type AccountMeta = {
  type: AccountType;
  tier: "Main account" | "Sub account";
  /** Settle: deposits move to the linked wallet. Hold: they stay in the account. */
  inflow: "Settle" | "Hold";
  applicationRef: string;
  customerRef: string;
  sync: SyncState;
};

export function accountMeta(a: Account): AccountMeta {
  let h = 2166136261;
  for (const ch of a.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const r = seeded(h);
  const hx = (n: number) =>
    Array.from(
      { length: n },
      () => "0123456789abcdef"[Math.floor(r() * 16)],
    ).join("");
  const ref = () => `${hx(8)}-${hx(4)}-4${hx(3)}-a${hx(3)}-${hx(12)}`;
  const mins = (m: number) => new Date(AS_OF - m * 60_000).toISOString();
  const roll = r();
  const sync: SyncState =
    a.status === "Frozen" || a.status === "Closed"
      ? { kind: "paused" }
      : a.status === "Pending"
        ? roll < 0.35
          ? {
              kind: "unreachable",
              at: mins(6 + Math.floor(r() * 40)),
              retryMins: 2 + Math.floor(r() * 8),
            }
          : { kind: "live", at: mins(1 + Math.floor(r() * 20)) }
        : roll < 0.1
          ? {
              kind: "cooling",
              at: mins(12 + Math.floor(r() * 30)),
              retryMins: 3 + Math.floor(r() * 10),
            }
          : { kind: "live", at: mins(1 + Math.floor(r() * 14)) };
  return {
    type: a.type,
    tier: a.tier,
    inflow: r() < 0.7 ? "Settle" : "Hold",
    applicationRef: ref(),
    customerRef: ref(),
    sync,
  };
}
