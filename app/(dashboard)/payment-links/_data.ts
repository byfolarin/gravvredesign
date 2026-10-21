export type LinkStatus = "Active" | "Paused" | "Expired";
export type Method = "Card" | "Bank transfer" | "USDC";

export type LinkPayment = {
  id: string;
  payer: string;
  email: string;
  amount: number;
  method: Method;
  date: string;
  status: "Paid" | "Refunded" | "Failed";
};

export type PaymentLink = {
  id: string;
  name: string;
  description?: string;
  /** Short path after pay.gravv.xyz/ */
  slug: string;
  /** null = the customer chooses how much to pay. */
  amount: number | null;
  currency: "USD" | "USDC" | "NGN";
  methods: Method[];
  status: LinkStatus;
  createdAt: string;
  expiresAt?: string;
  /** Stop accepting payments after this many (e.g. limited seats). */
  limit?: number;
  views: number;
  started: number;
  payments: LinkPayment[];
  /** Who it's for, when the link is made for one customer. */
  customer?: { name: string; email: string };
  /** Where the money settles, e.g. "Treasury wallet · USDC Polygon" or an external address. */
  settlesTo?: string;
  /** Where the payer goes after paying; blank keeps them on the Gravv page. */
  redirectUrl?: string;
  reference?: string;
  /** Changes made after the link went out, oldest first. */
  edits?: { at: string; by: string; changed: string[] }[];
};

/** Data snapshot time so relative dates agree on server and client. */
export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
export const LINK_HOST = "pay.gravv.xyz";

// Seeded so the placeholder data never changes between renders.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(42);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const payers = [
  ["Tolu Adeyemi", "tolu@adeyemi.co"],
  ["Grace Mensah", "grace.mensah@example.com"],
  ["Ikenna Obi", "ikenna@obi.dev"],
  ["Sarah Chen", "sarah@chenstudio.io"],
  ["Kwame Asante", "kwame@asante.africa"],
  ["Lena Fischer", "lena.fischer@example.de"],
  ["Musa Bello", "musa.bello@example.com"],
  ["Priya Nair", "priya@nair.in"],
  ["Jordan Blake", "jordan@blake.studio"],
  ["Chioma Eze", "chioma.eze@example.com"],
] as const;

function paymentsFor(
  n: number,
  amount: number | null,
  methods: Method[],
  span: number,
  start = AS_OF,
): LinkPayment[] {
  return Array.from({ length: n }, (_, i) => {
    const [payer, email] = pick(payers);
    const r = rand();
    return {
      id: `lp_${(1000 + i * 37 + Math.floor(rand() * 900)).toString(36)}${Math.floor(rand() * 1e6).toString(36)}`,
      payer,
      email,
      amount: amount ?? pick([25, 50, 50, 100, 150, 250, 500]),
      method: pick(methods),
      date: new Date(start - rand() * span * DAY).toISOString(),
      status: r < 0.06 ? "Failed" : r < 0.1 ? "Refunded" : "Paid",
    } satisfies LinkPayment;
  }).sort((a, b) => b.date.localeCompare(a.date));
}

const link = (
  l: Omit<PaymentLink, "payments"> & {
    paid: number;
    span: number;
    until?: number;
  },
): PaymentLink => {
  const { paid, span, until, ...rest } = l;
  return {
    ...rest,
    payments: paymentsFor(paid, l.amount, l.methods, span, until),
  };
};

export const links: PaymentLink[] = [
  link({
    id: "plink_8f2c01",
    name: "Annual membership",
    description: "12 months of Kredete Pro for your business.",
    slug: "kredete/pro-annual",
    amount: 240,
    currency: "USD",
    methods: ["Card", "Bank transfer", "USDC"],
    status: "Active",
    createdAt: "2026-08-02T10:00:00Z",
    views: 1840,
    started: 412,
    paid: 38,
    span: 70,
  }),
  link({
    id: "plink_31d9ae",
    name: "Invoice INV-2026-118 · Lumen Labs",
    slug: "kredete/inv-2026-118",
    amount: 18400,
    currency: "USDC",
    methods: ["USDC", "Bank transfer"],
    status: "Active",
    createdAt: "2026-10-14T09:12:00Z",
    expiresAt: "2026-10-28T23:59:00Z",
    limit: 1,
    views: 6,
    started: 2,
    paid: 0,
    span: 1,
  }),
  link({
    id: "plink_c47b10",
    name: "Lagos Fintech Week · Early bird",
    description: "One seat, includes the evening mixer.",
    slug: "kredete/lfw-early-bird",
    amount: 150,
    currency: "USD",
    methods: ["Card", "USDC"],
    status: "Active",
    createdAt: "2026-09-20T15:30:00Z",
    expiresAt: "2026-10-24T23:59:00Z",
    limit: 200,
    views: 3120,
    started: 860,
    paid: 64,
    span: 28,
  }),
  link({
    id: "plink_92ee5f",
    name: "Donate to Atlas Relief",
    description: "Every dollar goes to the Marrakesh school rebuild.",
    slug: "atlas-relief/donate",
    amount: null,
    currency: "USD",
    methods: ["Card", "Bank transfer", "USDC"],
    status: "Active",
    createdAt: "2026-07-11T08:00:00Z",
    views: 2210,
    started: 540,
    paid: 51,
    span: 95,
  }),
  link({
    id: "plink_0ab7d3",
    name: "Consulting call · 60 min",
    slug: "kredete/consult-60",
    amount: 180,
    currency: "USD",
    methods: ["Card"],
    status: "Active",
    createdAt: "2026-06-03T12:00:00Z",
    views: 640,
    started: 120,
    paid: 22,
    span: 120,
  }),
  link({
    id: "plink_5f1c88",
    name: "Wallet top-up",
    description: "Fund your Gravv wallet with any amount.",
    slug: "kredete/top-up",
    amount: null,
    currency: "USDC",
    methods: ["Bank transfer", "USDC"],
    status: "Active",
    createdAt: "2026-05-19T09:00:00Z",
    views: 980,
    started: 310,
    paid: 44,
    span: 140,
  }),
  link({
    id: "plink_e6a234",
    name: "Merch drop · Hoodie",
    slug: "kredete/hoodie",
    amount: 65,
    currency: "USD",
    methods: ["Card"],
    status: "Paused",
    createdAt: "2026-08-28T14:00:00Z",
    limit: 150,
    views: 1420,
    started: 300,
    paid: 31,
    span: 40,
    until: AS_OF - 12 * DAY,
  }),
  link({
    id: "plink_7c03f9",
    name: "Workshop · Stablecoin payouts 101",
    slug: "kredete/workshop-101",
    amount: 45,
    currency: "USD",
    methods: ["Card", "USDC"],
    status: "Expired",
    createdAt: "2026-08-01T10:00:00Z",
    expiresAt: "2026-09-15T18:00:00Z",
    limit: 80,
    views: 960,
    started: 240,
    paid: 46,
    span: 40,
    until: Date.parse("2026-09-15T18:00:00Z"),
  }),
  link({
    id: "plink_44b6c2",
    name: "Deposit · Office fit-out",
    slug: "kredete/fitout-deposit",
    amount: 2500000,
    currency: "NGN",
    methods: ["Bank transfer"],
    status: "Active",
    createdAt: "2026-10-08T11:00:00Z",
    expiresAt: "2026-10-22T23:59:00Z",
    limit: 1,
    views: 4,
    started: 1,
    paid: 0,
    span: 1,
  }),
  link({
    id: "plink_b81e07",
    name: "Summer cohort tuition",
    slug: "kredete/summer-cohort",
    amount: 900,
    currency: "USD",
    methods: ["Card", "Bank transfer"],
    status: "Expired",
    createdAt: "2026-04-10T10:00:00Z",
    expiresAt: "2026-06-30T23:59:00Z",
    limit: 40,
    views: 720,
    started: 160,
    paid: 33,
    span: 70,
    until: Date.parse("2026-06-30T23:59:00Z"),
  }),
];
