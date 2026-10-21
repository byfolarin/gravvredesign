// Seeded placeholder data for the OTC trade desk: large conversions at a firm, time-boxed
// quote (request for quote), settled from a Gravv wallet/account into a wallet or bank account.

export const AS_OF = Date.UTC(2026, 9, 21, 9, 0, 0);

export type Asset = "USDC" | "USDT" | "USD" | "EUR" | "NGN" | "KES" | "GHS";

export const ASSET_NAME: Record<Asset, string> = {
  USDC: "USD Coin",
  USDT: "Tether",
  USD: "US Dollar",
  EUR: "Euro",
  NGN: "Nigerian Naira",
  KES: "Kenyan Shilling",
  GHS: "Ghanaian Cedi",
};

const PREFIX: Partial<Record<Asset, string>> = {
  USD: "$",
  EUR: "€",
  NGN: "₦",
  KES: "KSh ",
  GHS: "GH₵",
};

/** "₦403,100,000.00" / "250,000.00 USDC" */
export function fmt(asset: Asset, amount: number, digits = 2) {
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  const p = PREFIX[asset];
  return p ? `${p}${n}` : `${n} ${asset}`;
}

/** "₦403.1M" / "250k USDC" */
export function compact(asset: Asset, amount: number) {
  const a = Math.abs(amount);
  const n =
    a >= 1e9
      ? `${Number((amount / 1e9).toFixed(2))}B`
      : a >= 1e6
        ? `${Number((amount / 1e6).toFixed(2))}M`
        : a >= 1e3
          ? `${Number((amount / 1e3).toFixed(1))}k`
          : amount.toFixed(0);
  const p = PREFIX[asset];
  return p ? `${p}${n}` : `${n} ${asset}`;
}

/** Where the desk takes funds from when you sell. */
/**
 * Where the desk takes what you sell. Gravv wallets/accounts are debited automatically the
 * moment an order is placed; "outside" means you send the funds in yourself (deposit).
 */
export type Source = {
  id: string;
  label: string;
  asset: Asset;
  detail: string;
  balance: number;
  external?: boolean;
};
export const SOURCES: Source[] = [
  {
    id: "treasury",
    label: "Treasury wallet",
    asset: "USDC",
    detail: "USDC · Ethereum",
    balance: 4_820_000,
  },
  {
    id: "payouts",
    label: "Payouts float",
    asset: "USDC",
    detail: "USDC · Solana",
    balance: 96_400,
  },
  {
    id: "tron",
    label: "USDT reserve",
    asset: "USDT",
    detail: "USDT · Tron",
    balance: 1_250_400,
  },
  {
    id: "usd",
    label: "USD operating account",
    asset: "USD",
    detail: "USD · Lead Bank ••0187",
    balance: 2_642_118.2,
  },
  {
    id: "eur",
    label: "EUR account",
    asset: "EUR",
    detail: "EUR · IBAN ••7741",
    balance: 381_950,
  },
  // Funds sent in from outside Gravv, one per asset.
  ...(["USDC", "USDT", "USD", "EUR"] as Asset[]).map((a) => ({
    id: `ext-${a}`,
    label: "Send from outside Gravv",
    asset: a,
    detail:
      a === "USDC" || a === "USDT"
        ? "You deposit to a desk address"
        : "You wire it in",
    balance: Infinity,
    external: true,
  })),
];

/** Where an outside deposit goes, per asset (the reference is the order ID). */
export const DEPOSIT: Partial<
  Record<Asset, { via: string; to: string; extra?: [string, string] }>
> = {
  USDC: { via: "Ethereum", to: "0x5c1e9a4b72f03d68e1a2c9b40f7d3e86a15b2c90" },
  USDT: { via: "Tron", to: "TJ7xQe3vKcP9mR2nWbL5sYt8uDf4Ah6GqZ" },
  USD: {
    via: "Wire · Lead Bank",
    to: "4100998812",
    extra: ["Routing", "101019644"],
  },
  EUR: {
    via: "SEPA · Banking Circle",
    to: "DK8389000099112233",
    extra: ["BIC", "SXPYDKKK"],
  },
};
export const DEPOSIT_WINDOW_MS = 2 * 3600_000;

/** Orders over this (USD-equivalent) need one more approver before they're placed. */
export const APPROVAL_OVER = 500_000;
export const DESK_APPROVERS = ["Chioma Eze", "Folarin Folarin"];
export const RATE_HOLD_MS = 15 * 60_000;

/**
 * Settlement instructions (SSIs): saved bank accounts and wallet addresses the desk pays out
 * to. One default per currency is picked automatically when you create an order.
 */
export type SsiKind = "bank" | "wallet";
export type Destination = {
  id: string;
  asset: Asset;
  kind: SsiKind;
  /** Bank name, or the wallet's network. */
  provider: string;
  accountName: string;
  /** Account number, or wallet address. */
  number: string;
  country?: string;
  isDefault: boolean;
  /** Removed from the list; kept so past orders still show where they paid out. */
  removed?: boolean;
  /** Derived: "Providus Bank ••4412" / "Treasury wallet". */
  label: string;
  /** Derived: account holder / "USDC · Ethereum". */
  detail: string;
};

export const mask = (n: string) =>
  n.length > 12 ? `${n.slice(0, 6)}…${n.slice(-4)}` : `••${n.slice(-4)}`;

export function makeSsi(x: Omit<Destination, "label" | "detail">): Destination {
  return {
    ...x,
    label:
      x.kind === "bank" ? `${x.provider} ${mask(x.number)}` : x.accountName,
    detail: x.kind === "bank" ? x.accountName : `${x.asset} · ${x.provider}`,
  };
}

export const NETWORKS: Partial<Record<Asset, string[]>> = {
  USDC: ["Ethereum", "Solana", "Polygon", "Base"],
  USDT: ["Tron", "Ethereum"],
};
export const COUNTRY: Partial<Record<Asset, string>> = {
  NGN: "NG",
  KES: "KE",
  GHS: "GH",
  USD: "US",
  EUR: "DE",
};

export const DESTINATIONS: Destination[] = [
  makeSsi({
    id: "ngn",
    asset: "NGN",
    kind: "bank",
    provider: "Providus Bank",
    accountName: "Kredete Technologies Ltd",
    number: "5401224412",
    country: "NG",
    isDefault: true,
  }),
  makeSsi({
    id: "ngn-alt",
    asset: "NGN",
    kind: "bank",
    provider: "Alternative Bank",
    accountName: "Kredete Technologies Ltd",
    number: "8120262111",
    country: "NG",
    isDefault: false,
  }),
  makeSsi({
    id: "ngn-ab",
    asset: "NGN",
    kind: "bank",
    provider: "AB Microfinance Bank",
    accountName: "Kredete Payouts",
    number: "8120254644",
    country: "NG",
    isDefault: false,
  }),
  makeSsi({
    id: "kes",
    asset: "KES",
    kind: "bank",
    provider: "M-Pesa paybill",
    accountName: "Kredete Kenya",
    number: "400200",
    country: "KE",
    isDefault: true,
  }),
  makeSsi({
    id: "ghs",
    asset: "GHS",
    kind: "bank",
    provider: "Ecobank",
    accountName: "Kredete Ghana",
    number: "1441000091",
    country: "GH",
    isDefault: true,
  }),
  makeSsi({
    id: "usdc",
    asset: "USDC",
    kind: "wallet",
    provider: "Ethereum",
    accountName: "Treasury wallet",
    number: "0x8f3a2c71b04e9d6a51c2f8e07b3d94a1c6e2b7f0",
    isDefault: true,
  }),
  makeSsi({
    id: "usdc-poly",
    asset: "USDC",
    kind: "wallet",
    provider: "Polygon",
    accountName: "Polygon payouts wallet",
    number: "0x2b91e4d70c3a85f6e1d9b2c4a7f03e58d6c1a9b4",
    isDefault: false,
  }),
  makeSsi({
    id: "usdt",
    asset: "USDT",
    kind: "wallet",
    provider: "Tron",
    accountName: "USDT reserve",
    number: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    isDefault: true,
  }),
  makeSsi({
    id: "usd-out",
    asset: "USD",
    kind: "bank",
    provider: "Lead Bank",
    accountName: "USD operating account",
    number: "4100230187",
    country: "US",
    isDefault: true,
  }),
];

/** Address checks per network, so a pasted address can't go to the wrong chain. */
export function addressProblem(network: string, address: string) {
  const a = address.trim();
  if (!a) return "Add the wallet address";
  if (
    ["Ethereum", "Polygon", "Base"].includes(network) &&
    !/^0x[0-9a-fA-F]{40}$/.test(a)
  )
    return `${network} addresses start with 0x and have 42 characters`;
  if (network === "Tron" && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a))
    return "Tron addresses start with T and have 34 characters";
  if (network === "Solana" && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a))
    return "That doesn't look like a Solana address";
  return null;
}

export type Pair = {
  id: string;
  sell: Asset;
  get: Asset;
  /** units of `get` per 1 `sell` */
  rate: number;
  change24h: number; // percent
  settles: string;
  /** 24 hourly points, oldest first */
  history: number[];
};

function history(seed: number, rate: number, change: number) {
  const out: number[] = [];
  let x = seed;
  const rand = () => (x = (x * 9301 + 49297) % 233280) / 233280 - 0.5;
  const start = rate / (1 + change / 100);
  for (let i = 0; i < 24; i++) {
    const trend = start + ((rate - start) * i) / 23;
    out.push(trend * (1 + rand() * 0.0007));
  }
  out[23] = rate;
  return out;
}

const pair = (
  sell: Asset,
  get: Asset,
  rate: number,
  change24h: number,
  settles: string,
  seed: number,
): Pair => ({
  id: `${sell}-${get}`,
  sell,
  get,
  rate,
  change24h,
  settles,
  history: history(seed, rate, change24h),
});

export const PAIRS: Pair[] = [
  pair("USDC", "NGN", 1612.4, 0.42, "~15 min", 11),
  pair("USDT", "NGN", 1609.85, 0.38, "~15 min", 23),
  pair("USD", "NGN", 1598.2, 0.21, "Same day", 37),
  pair("USDC", "KES", 129.35, -0.12, "~20 min", 41),
  pair("USDC", "GHS", 15.62, 0.64, "~30 min", 53),
  pair("EUR", "USDC", 1.0842, -0.09, "~10 min", 67),
  pair("USD", "USDC", 0.9996, 0.0, "~10 min", 71),
  pair("USDC", "USD", 0.999, 0.0, "Same day", 83),
];

export const LIMITS = {
  daily: 2_000_000,
  usedToday: 420_000,
  minTicket: 10_000,
};
export const MONTH = { traded: 12_430_000, orders: 31, avgSpreadBps: 18 };

/** USD-equivalent of an amount, for limits and totals. */
export function usdValue(asset: Asset, amount: number) {
  const toUsd: Record<Asset, number> = {
    USDC: 1,
    USDT: 1,
    USD: 1,
    EUR: 1.0842,
    NGN: 1 / 1612.4,
    KES: 1 / 129.35,
    GHS: 1 / 15.62,
  };
  return amount * toUsd[asset];
}

export type OrderStatus =
  | "Awaiting approval"
  | "Awaiting funds"
  | "Settling"
  | "Settled"
  | "Cancelled"
  // Problems — each has a plain explanation and a next step on the order.
  | "Payout returned"
  | "Short deposit"
  | "Rejected";

/** What went wrong (or why it was cancelled), shown on the order. */
export type Problem =
  | { kind: "returned"; note: string }
  | { kind: "short"; received: number }
  | { kind: "rejected"; by: string; note: string }
  | { kind: "expired" }
  | { kind: "cancelled"; by: string };

export type Order = {
  id: string;
  createdAt: number;
  pairId: string;
  sell: Asset;
  get: Asset;
  sellAmount: number;
  rate: number;
  getAmount: number;
  status: OrderStatus;
  sourceId: string;
  destinationId: string;
  placedBy: string;
  /** Set when the order was over APPROVAL_OVER. */
  approval?: { approvers: string[]; by?: string; at?: number };
  problem?: Problem;
  /** When each step happened (ms), undefined = not yet. */
  steps: {
    accepted: number;
    funded?: number;
    paidOut?: number;
    settled?: number;
  };
};

const H = 3600_000;
const M = 60_000;

const seed: [number, string, number, OrderStatus, string, string, string][] = [
  // hours ago, pair, sell amount, status, source, destination, placed by
  [0.4, "USDC-NGN", 250_000, "Settling", "treasury", "ngn", "Oluwatobi Bello"],
  [1.2, "USDT-NGN", 120_000, "Awaiting funds", "ext-USDT", "ngn", "Chioma Eze"],
  [3.6, "USDC-KES", 80_000, "Settled", "treasury", "kes", "Oluwatobi Bello"],
  [6.1, "EUR-USDC", 150_000, "Settled", "eur", "usdc", "Folarin Folarin"],
  [26, "USDC-NGN", 500_000, "Settled", "treasury", "ngn", "Oluwatobi Bello"],
  [29, "USD-USDC", 300_000, "Settled", "usd", "usdc", "Chioma Eze"],
  [50, "USDC-GHS", 45_000, "Settled", "treasury", "ghs", "Oluwatobi Bello"],
  [54, "USDT-NGN", 210_000, "Cancelled", "tron", "ngn", "Chioma Eze"],
  [75, "USDC-NGN", 1_000_000, "Settled", "treasury", "ngn", "Oluwatobi Bello"],
  [98, "USD-NGN", 180_000, "Settled", "usd", "ngn", "Folarin Folarin"],
  [122, "USDC-USD", 400_000, "Settled", "treasury", "usd-out", "Chioma Eze"],
  [146, "USDC-KES", 60_000, "Settled", "treasury", "kes", "Oluwatobi Bello"],
  [170, "USDC-NGN", 750_000, "Settled", "treasury", "ngn", "Oluwatobi Bello"],
  [194, "EUR-USDC", 90_000, "Settled", "eur", "usdc", "Folarin Folarin"],
];

const SEEDED: Order[] = seed.map(
  ([ago, pairId, sellAmount, status, sourceId, destinationId, placedBy], i) => {
    const p = PAIRS.find((x) => x.id === pairId)!;
    // Older orders traded a little off today's rate.
    const rate = Number(
      (p.rate * (1 - (ago / 200) * 0.006 * (i % 2 ? 1 : -1))).toFixed(
        p.rate > 10 ? 2 : 4,
      ),
    );
    const createdAt = AS_OF - ago * H;
    const done = status === "Settled";
    return {
      id: `OTC-${2291 - i}`,
      createdAt,
      pairId,
      sell: p.sell,
      get: p.get,
      sellAmount,
      rate,
      getAmount: sellAmount * rate,
      status,
      sourceId,
      destinationId,
      placedBy,
      steps: {
        accepted: createdAt,
        funded:
          status === "Awaiting funds" || status === "Cancelled"
            ? undefined
            : createdAt + 4 * M,
        paidOut: done ? createdAt + 13 * M : undefined,
        settled: done ? createdAt + 14 * M : undefined,
      },
    };
  },
);

/** A large order waiting on a second approver (also in Manage › Approvals). */
const AWAITING_APPROVAL: Order = {
  id: "OTC-2292",
  createdAt: AS_OF - 6 * M,
  pairId: "USDC-NGN",
  sell: "USDC",
  get: "NGN",
  sellAmount: 650_000,
  rate: 1612.21,
  getAmount: 650_000 * 1612.21,
  status: "Awaiting approval",
  sourceId: "treasury",
  destinationId: "ngn",
  placedBy: "Oluwatobi Bello",
  approval: { approvers: DESK_APPROVERS },
  steps: { accepted: AS_OF - 6 * M },
};

export const ORDERS: Order[] = [AWAITING_APPROVAL, ...SEEDED];

export const ago = (ms: number, now = AS_OF) => {
  const d = now - ms;
  if (d < M) return "just now";
  if (d < H) return `${Math.round(d / M)} min ago`;
  if (d < 24 * H) return `${Math.round(d / H)}h ago`;
  return `${Math.round(d / (24 * H))}d ago`;
};

export const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
export const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export type Range = "24H" | "7D" | "30D";
export const RANGES: {
  id: Range;
  points: number;
  stepMs: number;
  changeScale: number;
}[] = [
  { id: "24H", points: 48, stepMs: 30 * 60_000, changeScale: 1 },
  { id: "7D", points: 84, stepMs: 2 * 3600_000, changeScale: 2.4 },
  { id: "30D", points: 120, stepMs: 6 * 3600_000, changeScale: 4.1 },
];

/**
 * Seeded rate history for a pair and range, ending at `rate` (the live rate) and starting
 * `change` percent lower/higher. A random walk around the trend line, so it looks traded.
 */
export function seriesFor(
  pair: Pair,
  range: Range,
  rate: number,
): { t: number; v: number }[] {
  const r = RANGES.find((x) => x.id === range)!;
  const change =
    (pair.change24h || 0.03) * r.changeScale * (pair.change24h === 0 ? 0 : 1);
  const start = rate / (1 + change / 100);
  let x =
    pair.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0) * (r.points + 7);
  const rand = () => (x = (x * 9301 + 49297) % 233280) / 233280 - 0.5;
  const vol =
    rate * (pair.sell === "USD" && pair.get === "USDC" ? 0.00012 : 0.0011);
  const out: { t: number; v: number }[] = [];
  let walk = 0;
  for (let i = 0; i < r.points; i++) {
    walk = walk * 0.82 + rand() * vol;
    const trend = start + ((rate - start) * i) / (r.points - 1);
    out.push({
      t: AS_OF - (r.points - 1 - i) * r.stepMs,
      v: trend + walk * Math.min(1, (r.points - 1 - i) / 6), // walk eases out into the live rate,
    });
  }
  return out;
}

/* ——— Quote requests (RFQs) ———
 * Every "Get quote" is a request. It holds its price for 30 seconds and ends one of three
 * ways: accepted (becomes an order), let go (expired), or cancelled by you (declined). */

export type RequestOutcome =
  "Live" | "Accepted" | "Expired" | "Declined" | "With the desk";

/** Desk traders who price tickets above the self-serve limit. */
export const DESK_TRADER = "Adaeze Okoro";
export const DESK_HOLD_MS = 5 * 60_000;

export type QuoteRequest = {
  id: string;
  createdAt: number;
  expiresAt: number;
  pairId: string;
  sell: Asset;
  get: Asset;
  amount: number;
  rate: number;
  outcome: RequestOutcome;
  orderId?: string;
  requestedBy: string;
  /** Large tickets priced by a trader instead of the screen. */
  desk?: { trader: string; timing: string; note?: string };
};

/** Deterministic 32-char hex id for a seed. */
export function hexId(seed: number) {
  let x = (seed * 2654435761) >>> 0;
  let out = "";
  for (let i = 0; i < 32; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out += ((x >>> 16) & 15).toString(16);
  }
  return out;
}
export const shortId = (id: string) => `${id.slice(0, 8)}…${id.slice(-4)}`;

const QUOTE_MS = 30_000;

const unaccepted: [number, string, number, "Expired" | "Declined"][] = [
  // hours ago, pair, amount, outcome
  [0.8, "USDC-NGN", 300_000, "Expired"],
  [2.1, "USDC-KES", 120_000, "Declined"],
  [4.4, "USDT-NGN", 95_000, "Expired"],
  [27, "EUR-USDC", 200_000, "Expired"],
  [31, "USDC-NGN", 650_000, "Declined"],
  [52, "USDC-GHS", 40_000, "Expired"],
  [77, "USD-NGN", 250_000, "Expired"],
  [125, "USDC-NGN", 900_000, "Declined"],
  [150, "USDT-NGN", 60_000, "Expired"],
];

/** The accepted request behind each order (placed ~40s before it). */
export const requestsFor = (orders: Order[], seed = 100): QuoteRequest[] =>
  orders.map((o, i) => ({
    id: hexId(seed + i),
    createdAt: o.createdAt - 40_000,
    expiresAt: o.createdAt - 40_000 + QUOTE_MS,
    pairId: o.pairId,
    sell: o.sell,
    get: o.get,
    amount: o.sellAmount,
    rate: o.rate,
    outcome: "Accepted" as const,
    orderId: o.id,
    requestedBy: o.placedBy,
  }));

export const REQUESTS: QuoteRequest[] = [
  // One accepted request behind every order (placed ~40s before the order).
  ...ORDERS.map((o, i) => ({
    id: hexId(100 + i),
    createdAt: o.createdAt - 40_000,
    expiresAt: o.createdAt - 40_000 + QUOTE_MS,
    pairId: o.pairId,
    sell: o.sell,
    get: o.get,
    amount: o.sellAmount,
    rate: o.rate,
    outcome: "Accepted" as const,
    orderId: o.id,
    requestedBy: o.placedBy,
  })),
  ...unaccepted.map(([ago, pairId, amount, outcome], i) => {
    const p = PAIRS.find((x) => x.id === pairId)!;
    const createdAt = AS_OF - ago * 3600_000;
    return {
      id: hexId(400 + i),
      createdAt,
      expiresAt: createdAt + QUOTE_MS,
      pairId,
      sell: p.sell,
      get: p.get,
      amount,
      rate: Number((p.rate * (1 - 0.0003)).toFixed(p.rate >= 10 ? 2 : 4)),
      outcome,
      requestedBy: i % 2 ? "Chioma Eze" : "Oluwatobi Bello",
    };
  }),
].sort((a, b) => b.createdAt - a.createdAt);

/* ——— Error-state examples (State dropdown › Errors) ——— */
const err = (
  id: string,
  minsAgo: number,
  pairId: string,
  sellAmount: number,
  status: OrderStatus,
  sourceId: string,
  problem: Problem,
  steps: Partial<Order["steps"]> = {},
  extra: Partial<Order> = {},
): Order => {
  const p = PAIRS.find((x) => x.id === pairId)!;
  const createdAt = AS_OF - minsAgo * M;
  return {
    id,
    createdAt,
    pairId,
    sell: p.sell,
    get: p.get,
    sellAmount,
    rate: p.rate,
    getAmount: sellAmount * p.rate,
    status,
    sourceId,
    destinationId: DESTINATIONS.find((d) => d.asset === p.get && d.isDefault)!
      .id,
    placedBy: "Oluwatobi Bello",
    problem,
    steps: { accepted: createdAt, ...steps },
    ...extra,
  };
};

export const ERROR_ORDERS: Order[] = [
  err(
    "OTC-2299",
    18,
    "USDC-NGN",
    180_000,
    "Payout returned",
    "treasury",
    {
      kind: "returned",
      note: "Providus Bank returned it: the account name didn't match the one on the account.",
    },
    { funded: AS_OF - 17 * M, paidOut: AS_OF - 9 * M },
  ),
  err(
    "OTC-2298",
    42,
    "USDT-NGN",
    120_000,
    "Short deposit",
    "ext-USDT",
    { kind: "short", received: 118_500 },
    { funded: AS_OF - 20 * M },
  ),
  err(
    "OTC-2297",
    65,
    "USDC-NGN",
    720_000,
    "Rejected",
    "treasury",
    {
      kind: "rejected",
      by: "Chioma Eze",
      note: "Split this into two tickets under $500k — we don't want one rate for all of it.",
    },
    {},
    {
      approval: {
        approvers: DESK_APPROVERS,
        by: "Chioma Eze",
        at: AS_OF - 58 * M,
      },
    },
  ),
  err("OTC-2296", 190, "USDC-KES", 90_000, "Cancelled", "ext-USDC", {
    kind: "expired",
  }),
];
