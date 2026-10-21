/** Data snapshot time so relative times agree on server and client. */
export const AS_OF = Date.UTC(2026, 9, 21, 10, 0, 0);
const MIN = 60_000;
const at = (minsAgo: number) => new Date(AS_OF - minsAgo * MIN).toISOString();

export type Rule = {
  id: string;
  /** What sends a payment here. */
  when: { kind: "amount"; min: number } | { kind: "newRecipient" };
  approvals: number;
  /** Roles whose people can approve. */
  from: string[];
};

export const RULES: Rule[] = [
  {
    id: "r1",
    when: { kind: "amount", min: 10_000 },
    approvals: 1,
    from: ["finance", "admin"],
  },
  {
    id: "r2",
    when: { kind: "amount", min: 50_000 },
    approvals: 2,
    from: ["finance", "admin"],
  },
  { id: "r3", when: { kind: "newRecipient" }, approvals: 1, from: ["admin"] },
];

export type Settings = {
  /** People can't approve payments they asked for. */
  noSelfApproval: boolean;
  /** Per person per day, in USD; past it, everything needs approval. */
  dailyMax: number | null;
};
export const SETTINGS: Settings = { noSelfApproval: true, dailyMax: 100_000 };

export type Decision = {
  by: string;
  at: string;
  kind: "approved" | "rejected";
  note?: string;
};

export type Request = {
  id: string;
  amount: number;
  currency: "USD" | "USDC" | "EUR" | "GBP" | "NGN";
  recipient: { name: string; detail: string; isNew?: boolean };
  from: string;
  requestedBy: string;
  requestedAt: string;
  note?: string;
  /** Why it's here: a rule, or the requester's own role cap. */
  reason: { kind: "rule"; ruleId: string } | { kind: "cap"; cap: number };
  needed: number;
  approvers: string[];
  decisions: Decision[];
  state: "pending" | "approved" | "rejected";
  /** What an approver needs to decide: money, destination, paperwork, history, risk. */
  context?: Context;
};

export type Context = {
  /** Balance of the paying account before this payment, in the request's currency. */
  balance: number;
  rail: string;
  arrival: string;
  /** Gravv's fee in USD. */
  fee: number;
  fx?: { rate: string; gets: string };
  bank: {
    label: string;
    value: string;
    routing?: { label: string; value: string };
  };
  invoice?: { file: string; number: string; amount: number; due: string };
  /** Payments you've made to this recipient before. */
  history: {
    since?: string;
    count: number;
    total: number;
    usual?: number;
    last?: { amount: number; at: string };
  };
  detailsChangedAt?: string;
  /** A similar payment to the same recipient recently. */
  similar?: { amount: number; at: string; id: string };
  screening: "clear" | "review";
  /** The request lapses (and the requester has to ask again) after this. */
  expiresAt: string;
  comments?: { by: string; at: string; text: string }[];
};

const req = (
  r: Omit<Request, "decisions" | "state"> &
    Partial<Pick<Request, "decisions" | "state">>,
): Request => ({
  decisions: [],
  state: "pending",
  ...r,
});

export const REQUESTS: Request[] = [
  // From the Trade desk: an OTC order over the desk's $500k approval line.
  req({
    id: "apr_otc2292",
    amount: 650_000,
    currency: "USDC",
    recipient: {
      name: "Trade desk · USDC → NGN",
      detail: "Providus Bank ••4412 · rate held 15 min",
    },
    from: "Treasury wallet · USDC",
    requestedBy: "Oluwatobi Bello",
    requestedAt: at(66),
    note: "OTC-2292 · ₦1,047,936,500.00 at ₦1,612.21",
    reason: { kind: "cap", cap: 500_000 },
    needed: 1,
    approvers: ["Chioma Eze", "Folarin Folarin"],
  }),
  req({
    id: "apr_9f21",
    amount: 72_500,
    currency: "USD",
    recipient: { name: "Meridian Trade Co", detail: "Lead Bank ••4410" },
    from: "Operating · USD",
    requestedBy: "Tolu Adeyemi",
    requestedAt: at(38),
    note: "October supplier settlement, invoice MTC-1182",
    reason: { kind: "rule", ruleId: "r2" },
    needed: 2,
    approvers: ["finance", "admin"],
    decisions: [{ by: "Ikenna Obi", at: at(21), kind: "approved" }],
  }),
  req({
    id: "apr_9f1c",
    amount: 18_240,
    currency: "USDC",
    recipient: {
      name: "Atlas Relief Foundation",
      detail: "Polygon 0x8b2e…41fa",
      isNew: true,
    },
    from: "Treasury wallet",
    requestedBy: "Musa Bello",
    requestedAt: at(95),
    note: "Grant disbursement, Q4 tranche 1",
    reason: { kind: "rule", ruleId: "r3" },
    needed: 1,
    approvers: ["admin"],
  }),
  req({
    id: "apr_9f0a",
    amount: 6_800,
    currency: "USD",
    recipient: { name: "Brightpath Studio", detail: "Cross River Bank ••0921" },
    from: "Payouts · USD",
    requestedBy: "Priya Nair",
    requestedAt: at(160),
    note: "Design retainer, October",
    reason: { kind: "cap", cap: 5_000 },
    needed: 1,
    approvers: ["finance", "admin"],
  }),
  req({
    id: "apr_9ee4",
    amount: 24_000,
    currency: "EUR",
    recipient: { name: "Kite & Kettle Ltd", detail: "Banking Circle ••LU42" },
    from: "Operating · EUR",
    requestedBy: "Oluwatobi Bello",
    requestedAt: at(210),
    reason: { kind: "rule", ruleId: "r1" },
    needed: 1,
    approvers: ["finance", "admin"],
  }),
  req({
    id: "apr_9ed2",
    amount: 54_000,
    currency: "USD",
    recipient: { name: "Northwind Logistics", detail: "Stearns Bank ••7731" },
    from: "Operating · USD",
    requestedBy: "Grace Mensah",
    requestedAt: at(300),
    note: "Freight, September invoices",
    reason: { kind: "rule", ruleId: "r2" },
    needed: 2,
    approvers: ["finance", "admin"],
    decisions: [{ by: "Oluwatobi Bello", at: at(240), kind: "approved" }],
  }),
  req({
    id: "apr_9eb0",
    amount: 12_600,
    currency: "GBP",
    recipient: {
      name: "Harbor Freight Partners",
      detail: "Clear Junction ••3390",
    },
    from: "Operating · GBP",
    requestedBy: "Chioma Eze",
    requestedAt: at(60 * 26),
    reason: { kind: "rule", ruleId: "r1" },
    needed: 1,
    approvers: ["finance", "admin"],
    decisions: [{ by: "Amara Nwosu", at: at(60 * 25), kind: "approved" }],
    state: "approved",
  }),
  req({
    id: "apr_9e91",
    amount: 9_400,
    currency: "USDC",
    recipient: {
      name: "Sable Analytics",
      detail: "Ethereum 0x1d7c…9a02",
      isNew: true,
    },
    from: "Treasury wallet",
    requestedBy: "Daniel Okafor",
    requestedAt: at(60 * 30),
    reason: { kind: "rule", ruleId: "r3" },
    needed: 1,
    approvers: ["admin"],
    decisions: [
      {
        by: "Oluwatobi Bello",
        at: at(60 * 29),
        kind: "rejected",
        note: "Address doesn't match the one on their invoice — confirm with Sable first.",
      },
    ],
    state: "rejected",
  }),
  req({
    id: "apr_9e70",
    amount: 150_000,
    currency: "USD",
    recipient: { name: "Lumen Labs Inc", detail: "Lead Bank ••2208" },
    from: "Treasury · USD",
    requestedBy: "Tolu Adeyemi",
    requestedAt: at(60 * 50),
    note: "Intercompany sweep",
    reason: { kind: "rule", ruleId: "r2" },
    needed: 2,
    approvers: ["finance", "admin"],
    decisions: [
      { by: "Ikenna Obi", at: at(60 * 49), kind: "approved" },
      { by: "Amara Nwosu", at: at(60 * 47), kind: "approved" },
    ],
    state: "approved",
  }),
  req({
    id: "apr_9e5d",
    amount: 5_400_000,
    currency: "NGN",
    recipient: { name: "Chioma Eze", detail: "Access Bank ••5521" },
    from: "Payouts · NGN",
    requestedBy: "Musa Bello",
    requestedAt: at(60 * 72),
    note: "Contractor payout, September",
    reason: { kind: "cap", cap: 5_000 },
    needed: 1,
    approvers: ["finance", "admin"],
    decisions: [{ by: "Grace Mensah", at: at(60 * 70), kind: "approved" }],
    state: "approved",
  }),
];

const ahead = (mins: number) => new Date(AS_OF + mins * MIN).toISOString();
const CONTEXT: Record<string, Context> = {
  apr_otc2292: {
    balance: 1_240_000,
    rail: "Trade desk settlement",
    arrival:
      "NGN lands at Providus Bank about 10 minutes after the last approval",
    fee: 0,
    fx: { rate: "1 USDC = ₦1,612.21 (held 15 min)", gets: "₦1,047,936,500.00" },
    bank: { label: "Providus Bank", value: "1304 4412 ••4412" },
    history: {
      since: "2026-03-02T09:00:00Z",
      count: 31,
      total: 9_420_000,
      usual: 300_000,
      last: { amount: 420_000, at: at(60 * 24 * 6) },
    },
    screening: "clear",
    expiresAt: ahead(4),
  },
  apr_9f21: {
    balance: 184_320,
    rail: "Wire",
    arrival: "Today, if approved before 4pm ET",
    fee: 15,
    bank: {
      label: "Lead Bank",
      value: "2190 7907 4410",
      routing: { label: "Routing", value: "101019644" },
    },
    invoice: {
      file: "MTC-1182.pdf",
      number: "MTC-1182",
      amount: 72_500,
      due: "2026-10-25T00:00:00Z",
    },
    history: {
      since: "2026-03-11T00:00:00Z",
      count: 7,
      total: 151_800,
      usual: 21_700,
      last: { amount: 22_400, at: at(60 * 24 * 21) },
    },
    detailsChangedAt: at(60 * 24 * 2),
    screening: "clear",
    expiresAt: ahead(60 * 24 * 3),
    comments: [
      {
        by: "Ikenna Obi",
        at: at(23),
        text: "Bank details changed on Monday, so I called Meridian on the number from our contract — they confirmed the new Lead Bank account. Big one because it's three months of shipments in one invoice.",
      },
    ],
  },
  apr_9f1c: {
    balance: 48_210,
    rail: "USDC on Polygon",
    arrival: "In about a minute",
    fee: 0,
    bank: {
      label: "Polygon wallet",
      value: "0x8b2e9c4d1f07a3b6e52c9d18e4f0a7c3b29e41fa",
    },
    history: { count: 0, total: 0 },
    screening: "clear",
    expiresAt: ahead(60 * 24 * 5),
  },
  apr_9f0a: {
    balance: 22_904,
    rail: "ACH",
    arrival: "In 1–2 business days",
    fee: 1,
    bank: {
      label: "Cross River Bank",
      value: "3431 8115 0921",
      routing: { label: "Routing", value: "021214891" },
    },
    invoice: {
      file: "BPS-0412.pdf",
      number: "BPS-0412",
      amount: 6_800,
      due: "2026-10-31T00:00:00Z",
    },
    history: {
      since: "2026-01-20T00:00:00Z",
      count: 9,
      total: 52_000,
      usual: 5_800,
      last: { amount: 5_800, at: at(60 * 24 * 23) },
    },
    screening: "clear",
    expiresAt: ahead(60 * 24 * 6),
  },
  apr_9ee4: {
    balance: 61_200,
    rail: "SEPA",
    arrival: "Usually today",
    fee: 0,
    bank: {
      label: "Banking Circle",
      value: "LU42 4080 0000 4711 0942",
      routing: { label: "BIC", value: "BCIRLULL" },
    },
    invoice: {
      file: "KK-2291.pdf",
      number: "KK-2291",
      amount: 24_000,
      due: "2026-10-30T00:00:00Z",
    },
    history: {
      since: "2026-05-04T00:00:00Z",
      count: 4,
      total: 81_000,
      usual: 19_000,
      last: { amount: 24_000, at: at(60 * 24 * 7) },
    },
    similar: { amount: 24_000, at: at(60 * 24 * 7), id: "pay_8c21" },
    screening: "clear",
    expiresAt: ahead(60 * 24 * 4),
  },
  apr_9ed2: {
    balance: 184_320,
    rail: "Wire",
    arrival: "Today, if approved before 4pm ET",
    fee: 15,
    bank: {
      label: "Stearns Bank",
      value: "1000 0057 7731",
      routing: { label: "Routing", value: "091202590" },
    },
    invoice: {
      file: "NW-Sept.pdf",
      number: "NW-0917 + 2 more",
      amount: 54_000,
      due: "2026-10-28T00:00:00Z",
    },
    history: {
      since: "2025-11-02T00:00:00Z",
      count: 11,
      total: 410_000,
      usual: 48_000,
      last: { amount: 46_500, at: at(60 * 24 * 32) },
    },
    screening: "clear",
    expiresAt: ahead(60 * 24 * 2),
  },
  apr_9eb0: {
    balance: 40_100,
    rail: "Swift",
    arrival: "In 1–2 business days",
    fee: 25,
    bank: { label: "Clear Junction", value: "GB29 CLJU 0099 3390" },
    history: {
      since: "2026-02-14T00:00:00Z",
      count: 5,
      total: 58_000,
      usual: 11_800,
    },
    screening: "clear",
    expiresAt: at(60 * 24),
  },
  apr_9e91: {
    balance: 48_210,
    rail: "USDC on Ethereum",
    arrival: "In a few minutes",
    fee: 0,
    bank: {
      label: "Ethereum wallet",
      value: "0x1d7c4a92e8b3f05d61c7a2e9b4d8f3a1c6e09a02",
    },
    history: { count: 0, total: 0 },
    screening: "clear",
    expiresAt: at(60 * 20),
  },
  apr_9e70: {
    balance: 2_400_000,
    rail: "Book transfer",
    arrival: "Instantly",
    fee: 0,
    bank: { label: "Lead Bank", value: "2190 7907 2208" },
    history: {
      since: "2025-09-01T00:00:00Z",
      count: 14,
      total: 1_950_000,
      usual: 140_000,
    },
    screening: "clear",
    expiresAt: at(60 * 40),
  },
  apr_9e5d: {
    balance: 31_000_000,
    rail: "Local transfer",
    arrival: "In minutes",
    fee: 0,
    bank: { label: "Access Bank", value: "0690 0055 21" },
    history: {
      since: "2026-04-01T00:00:00Z",
      count: 6,
      total: 30_600_000,
      usual: 5_100_000,
    },
    screening: "clear",
    expiresAt: at(60 * 60),
  },
};
for (const r of REQUESTS) r.context = CONTEXT[r.id];

export function until(iso: string) {
  const m = Math.round((Date.parse(iso) - AS_OF) / MIN);
  if (m <= 0) return "now";
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)} days`;
}

export function ago(iso: string) {
  const m = Math.max(1, Math.round((AS_OF - Date.parse(iso)) / MIN));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
