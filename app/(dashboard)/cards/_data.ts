// Placeholder data mirroring the Cards module in the Gravv Figma file,
// until the Cards API is wired up.

export type CardStatus = "Active" | "Frozen" | "Inactive";
export type CardType = "Virtual" | "Physical";
export type TxnStatus = "Completed" | "Pending" | "Failed";

export type Address = {
  line1: string;
  country: string;
  city: string;
  state: string;
  zip: string;
};

export type CardTxn = {
  id: string;
  timestamp: string;
  merchant: string;
  amount: number;
  balanceAfter: number;
  status: TxnStatus;
  failureReason?: string;
};

export type FundingSource = {
  id: string;
  asset: "USDC" | "USD";
  label: string;
  network?: string;
};

export type LimitPeriod = "Daily" | "Weekly" | "Monthly";

export type Card = {
  id: string;
  customerId: string;
  holder: string;
  /** Placeholder portrait for the demo persona. */
  photo?: string;
  network: "VISA";
  last4: string;
  expiry: string;
  type: CardType;
  currency: "USD";
  balance: number;
  createdAt: string;
  status: CardStatus;
  monthlyLimit: number;
  limitPeriod: LimitPeriod;
  perTransactionLimit: number | null;
  alertAt: number | null;
  spentThisMonth: number;
  resetsOn: string;
  funding: FundingSource;
  billing: Address;
  shipping: Address;
  transactions: CardTxn[];
};

/** Program-wide cap on card spend per month, across every card. */
export const PROGRAM_LIMIT = 50_000;
/** Today, for the demo: the 20th of a 31-day month. */
export const SPEND_DAY = 20;
export const MONTH_DAYS = 31;

const address: Address = {
  line1: "1801 Main St., Kansas City",
  country: "US",
  city: "Newark",
  state: "Newark",
  zip: "19702",
};

const merchants = [
  "Facebook",
  "Netflix",
  "Tinder",
  "Slack",
  "Instagram",
  "Behance",
  "Coub",
  "YouTube Music",
];
const amounts = [5, 5, 5, 25, 25, 25, 25, 25];
const statuses: TxnStatus[] = [
  "Pending",
  "Completed",
  "Failed",
  "Completed",
  "Failed",
  "Completed",
  "Pending",
  "Failed",
];

function transactionsFor(seed: number, balance: number): CardTxn[] {
  let running = balance;
  return merchants.map((merchant, i) => {
    const k = (i + seed) % merchants.length;
    const status = statuses[(i + seed * 3) % statuses.length];
    const amount = amounts[k] * (1 + ((seed + i) % 3));
    const row: CardTxn = {
      id: `a7b2c3d4-e5f6-47${seed}${i}-9c1d-${(seed * 7919 + i * 104729).toString(16).padStart(12, "0").slice(0, 12)}`,
      timestamp: `2026-10-${String(20 - Math.floor(i / 3) - (seed % 3)).padStart(2, "0")}T0${7 - (i % 3)}:35:17.628Z`,
      merchant: merchants[k],
      amount,
      balanceAfter: running,
      status,
      failureReason:
        status === "Failed" ? "Insufficient card balance" : undefined,
    };
    if (status !== "Failed") running += amount;
    return row;
  });
}

const treasury: FundingSource = {
  id: "treasury",
  asset: "USDC",
  label: "Treasury wallet",
  network: "Ethereum",
};
const payouts: FundingSource = {
  id: "payouts",
  asset: "USDC",
  label: "Payouts float",
  network: "Solana",
};
const usd: FundingSource = {
  id: "usd",
  asset: "USD",
  label: "USD operating account",
};

/** Funding sources available when issuing a card, with live balances. */
export const fundingSources: (FundingSource & { balance: number })[] = [
  { ...treasury, balance: 210_000 },
  { ...payouts, balance: 96_400 },
  { ...usd, balance: 642_118.2 },
];

const people: [
  string,
  CardType,
  CardStatus,
  string,
  number,
  number,
  number,
  FundingSource,
][] = [
  // holder, type, status, last4, balance, monthly limit, spent this month, funding
  ["Alex Johnson", "Virtual", "Inactive", "4565", 3100, 3000, 1240, treasury],
  ["Mia Thompson", "Virtual", "Active", "4928", 2000, 5000, 4310, payouts],
  ["Ethan Brown", "Physical", "Inactive", "7012", 3100, 2500, 0, usd],
  ["Sophia Davis", "Virtual", "Frozen", "3381", 3100, 3000, 2875, treasury],
  ["Isabella Rodriguez", "Physical", "Inactive", "9254", 3100, 2500, 120, usd],
  ["Liam Wilson", "Virtual", "Frozen", "1147", 3100, 10000, 6420, treasury],
  ["Lucas Lee", "Physical", "Inactive", "6630", 3100, 2500, 0, usd],
  ["Olivia Martinez", "Virtual", "Frozen", "2209", 3100, 3000, 980, payouts],
  ["Ava Walker", "Physical", "Inactive", "8873", 3100, 2500, 45, usd],
  ["Noah Garcia", "Virtual", "Frozen", "4488", 3100, 5000, 1890, treasury],
];

// Demo persona portraits (randomuser.me placeholder set), assigned per persona.
const photos: Record<string, string> = {
  "Alex Johnson": "https://randomuser.me/api/portraits/men/32.jpg",
  "Mia Thompson": "https://randomuser.me/api/portraits/women/44.jpg",
  "Ethan Brown": "https://randomuser.me/api/portraits/men/46.jpg",
  "Sophia Davis": "https://randomuser.me/api/portraits/women/65.jpg",
  "Isabella Rodriguez": "https://randomuser.me/api/portraits/women/68.jpg",
  "Liam Wilson": "https://randomuser.me/api/portraits/men/75.jpg",
  "Lucas Lee": "https://randomuser.me/api/portraits/men/22.jpg",
  "Olivia Martinez": "https://randomuser.me/api/portraits/women/12.jpg",
  "Ava Walker": "https://randomuser.me/api/portraits/women/29.jpg",
  "Noah Garcia": "https://randomuser.me/api/portraits/men/36.jpg",
};

export const cards: Card[] = people.map(
  (
    [
      holder,
      type,
      status,
      last4,
      balance,
      monthlyLimit,
      spentThisMonth,
      funding,
    ],
    i,
  ) => ({
    id:
      i % 2
        ? "2d64e9f2-f6d0-4ee5-a319-d09bd968996f".replace(/.$/, String(i))
        : `a7b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c${i}`,
    customerId:
      i % 2
        ? `a7b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c${i}`
        : "2d64e9f2-f6d0-4ee5-a319-d09bd968996f".replace(/.$/, String(i)),
    holder,
    photo: photos[holder],
    network: "VISA",
    last4,
    expiry: "2027-06-05",
    type,
    currency: "USD",
    balance,
    createdAt: "2025-01-05T07:35:17.628Z",
    status,
    monthlyLimit,
    limitPeriod: "Monthly",
    perTransactionLimit: null,
    alertAt: 0.8,
    spentThisMonth,
    resetsOn: "2026-10-31",
    funding,
    billing: address,
    shipping: address,
    transactions: transactionsFor(i + 1, balance),
  }),
);

/** Card spend this month, summed from the cards themselves so the headline matches the table. */
export const monthlySpend = {
  spent: cards.reduce((s, c) => s + c.spentThisMonth, 0),
  limit: PROGRAM_LIMIT,
  period: "Oct 1 – Oct 31",
};

/**
 * Spend per day: this month up to today, and all of last month for comparison. Weekdays run
 * heavier than weekends (subscriptions and ads renew on weekdays); this month is scaled so it
 * sums exactly to `monthlySpend.spent`.
 */
function dailyShape(days: number, seed: number, firstWeekday: number) {
  return Array.from({ length: days }, (_, i) => {
    const weekend = (firstWeekday + i) % 7 >= 5;
    const wobble =
      0.65 +
      ((((Math.sin((i + 1) * 12.9898 + seed) * 43758.5453) % 1) + 1) % 1) * 0.7;
    return (weekend ? 0.45 : 1) * wobble * (i === 0 ? 1.8 : 1); // the 1st carries monthly renewals
  });
}
const thisShape = dailyShape(SPEND_DAY, 3, 2); // Oct 1, 2026 is a Thursday
const thisSum = thisShape.reduce((s, v) => s + v, 0);
const lastShape = dailyShape(30, 11, 0); // Sep 1, 2026 is a Tuesday
const lastSum = lastShape.reduce((s, v) => s + v, 0);
const LAST_MONTH_TOTAL = 24_610;
export const dailySpend = {
  thisMonth: thisShape.map(
    (v) => Math.round((v / thisSum) * monthlySpend.spent * 100) / 100,
  ),
  lastMonth: lastShape.map(
    (v) => Math.round((v / lastSum) * LAST_MONTH_TOTAL * 100) / 100,
  ),
};

/** What kind of spend each merchant is, in a word. */
export const MERCHANT_KIND: Record<string, string> = {
  Facebook: "Ads",
  Instagram: "Ads",
  Slack: "Software",
  Behance: "Design tools",
  Netflix: "Streaming",
  "YouTube Music": "Streaming",
  Tinder: "Subscription",
  Coub: "Video",
};

export type MerchantSpend = {
  merchant: string;
  kind: string;
  amount: number;
  /** Same days last month. */
  lastMonth: number;
  cards: Card[];
};

/**
 * This month's spend by merchant: each card's spend split across the merchants it actually
 * paid (its settled and pending transactions), so the merchants add up to the headline.
 */
export function merchantSpend(list: Card[]): MerchantSpend[] {
  const by = new Map<string, { amount: number; cards: Card[] }>();
  for (const c of list) {
    if (c.spentThisMonth <= 0) continue;
    const paid = c.transactions.filter((t) => t.status !== "Failed");
    const sum = paid.reduce((s, t) => s + t.amount, 0);
    if (!sum) continue;
    const share = new Map<string, number>();
    for (const t of paid)
      share.set(t.merchant, (share.get(t.merchant) ?? 0) + t.amount);
    for (const [m, v] of share) {
      const e = by.get(m) ?? { amount: 0, cards: [] };
      e.amount += (v / sum) * c.spentThisMonth;
      e.cards.push(c);
      by.set(m, e);
    }
  }
  return [...by.entries()]
    .map(([merchant, e]) => {
      let h = 7;
      for (const ch of merchant) h = (h * 31 + ch.charCodeAt(0)) % 9973;
      // Last month at the same point: a stable ±30% around this month.
      const f = 0.72 + ((h % 100) / 100) * 0.6;
      return {
        merchant,
        kind: MERCHANT_KIND[merchant] ?? "Other",
        amount: Math.round(e.amount * 100) / 100,
        lastMonth: Math.round((e.amount / f) * 100) / 100,
        cards: e.cards,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
