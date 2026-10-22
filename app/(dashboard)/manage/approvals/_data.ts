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
/**
 * A fuller queue so the page reads like a real working day: 36 more payments waiting on you,
 * mostly routine (paid before, matching invoice), with the occasional thing to look at.
 */
type Seed = [
  name: string,
  cur: Request["currency"],
  amount: number,
  bank: string,
  value: string,
  rail: string,
  note: string,
  by: string,
  flag?:
    | "changed"
    | "usual"
    | "dupe"
    | "new"
    | "mismatch"
    | "drain"
    | "expiring"
    | "screen",
];
const SEEDS: Seed[] = [
  [
    "Oakridge Supply Co",
    "USD",
    14_200,
    "Lead Bank",
    "2190 7907 1184",
    "ACH",
    "Packaging, October",
    "Tolu Adeyemi",
  ],
  [
    "Copperline Media",
    "USD",
    22_750,
    "Cross River Bank",
    "3431 8115 7720",
    "Wire",
    "Campaign media buy",
    "Priya Nair",
    "usual",
  ],
  [
    "Halcyon Freight",
    "EUR",
    31_400,
    "Banking Circle",
    "DE89 3704 0044 0532 0130",
    "SEPA",
    "Rotterdam freight, invoice HF-882",
    "Musa Bello",
  ],
  [
    "Ada Okonkwo",
    "NGN",
    2_850_000,
    "GTBank",
    "0123 4567 89",
    "Local transfer",
    "Contractor payout, October",
    "Daniel Okafor",
  ],
  [
    "Pinewood Software",
    "USD",
    11_900,
    "Stearns Bank",
    "1000 0057 3321",
    "ACH",
    "Annual licences",
    "Grace Mensah",
  ],
  [
    "Bluebird Couriers",
    "GBP",
    15_300,
    "Clear Junction",
    "GB33 CLJU 0099 1182",
    "Swift",
    "UK last-mile, September",
    "Chioma Eze",
    "changed",
  ],
  [
    "Sahel Agro Ltd",
    "USDC",
    42_000,
    "Polygon wallet",
    "0x4a9e2f61b0c8d37e5a1f9b2c6d4e8a0f3b7c91d2",
    "USDC on Polygon",
    "Cocoa forward, lot 14",
    "Musa Bello",
    "new",
  ],
  [
    "Marlow & Finch LLP",
    "USD",
    18_000,
    "Lead Bank",
    "2190 7907 5562",
    "Wire",
    "Legal retainer, Q4",
    "Tolu Adeyemi",
  ],
  [
    "Kora Foods",
    "NGN",
    9_400_000,
    "Access Bank",
    "0690 0112 74",
    "Local transfer",
    "Distributor rebate",
    "Priya Nair",
    "usual",
  ],
  [
    "Vantage Cloud",
    "USD",
    12_480,
    "Cross River Bank",
    "3431 8115 0045",
    "ACH",
    "Hosting, October",
    "Kwame Asante",
  ],
  [
    "Ember Studio",
    "EUR",
    13_600,
    "Banking Circle",
    "FR76 3000 6000 0112 3456 7890 189",
    "SEPA",
    "Brand refresh, milestone 2",
    "Grace Mensah",
    "mismatch",
  ],
  [
    "Nimbus Payroll",
    "USD",
    96_400,
    "Lead Bank",
    "2190 7907 9001",
    "Wire",
    "Payroll funding, Oct 25",
    "Ikenna Obi",
    "drain",
  ],
  [
    "Coastal Ports Authority",
    "USD",
    27_300,
    "Stearns Bank",
    "1000 0057 6610",
    "Wire",
    "Port fees, September",
    "Musa Bello",
  ],
  [
    "Zuri Textiles",
    "USDC",
    16_800,
    "Ethereum wallet",
    "0x9c3b5e7a1d2f4b6c8e0a9d7f5b3c1e2a4d6f8b07",
    "USDC on Ethereum",
    "Fabric order ZT-219",
    "Daniel Okafor",
    "dupe",
  ],
  [
    "Greenfield Energy",
    "USD",
    33_100,
    "Cross River Bank",
    "3431 8115 4419",
    "ACH",
    "Generator diesel, Lagos office",
    "Priya Nair",
  ],
  [
    "Thames Advisory",
    "GBP",
    21_000,
    "Clear Junction",
    "GB71 CLJU 0099 4471",
    "Swift",
    "Board advisory, Q4",
    "Chioma Eze",
  ],
  [
    "Lagos Fleet Services",
    "NGN",
    6_200_000,
    "Zenith Bank",
    "1012 3345 67",
    "Local transfer",
    "Vehicle lease, October",
    "Musa Bello",
  ],
  [
    "Orchid Health",
    "USD",
    19_750,
    "Lead Bank",
    "2190 7907 3380",
    "ACH",
    "Staff health cover",
    "Grace Mensah",
  ],
  [
    "Polaris Data",
    "USD",
    28_900,
    "Stearns Bank",
    "1000 0057 2290",
    "Wire",
    "Data licence renewal",
    "Kwame Asante",
    "expiring",
  ],
  [
    "Accra Logistics Hub",
    "USDC",
    24_500,
    "Polygon wallet",
    "0x2b8d4f6a0c1e3b5d7f9a2c4e6b8d0f1a3c5e7b93",
    "USDC on Polygon",
    "Ghana warehousing",
    "Daniel Okafor",
  ],
  [
    "Riverstone Partners",
    "EUR",
    45_000,
    "Banking Circle",
    "NL91 ABNA 0417 1643 00",
    "SEPA",
    "Fund admin fee",
    "Tolu Adeyemi",
    "usual",
  ],
  [
    "Tunde Bakare",
    "NGN",
    3_100_000,
    "Kuda MFB",
    "2001 4456 78",
    "Local transfer",
    "Field sales commission",
    "Priya Nair",
  ],
  [
    "Summit Insurance",
    "USD",
    41_200,
    "Lead Bank",
    "2190 7907 6631",
    "Wire",
    "Cargo insurance premium",
    "Ikenna Obi",
  ],
  [
    "Nova Print House",
    "GBP",
    10_800,
    "Clear Junction",
    "GB12 CLJU 0099 8820",
    "Swift",
    "Catalogue print run",
    "Chioma Eze",
    "new",
  ],
  [
    "Mosaic Research",
    "USD",
    15_600,
    "Cross River Bank",
    "3431 8115 2276",
    "ACH",
    "Customer study, wave 3",
    "Grace Mensah",
  ],
  [
    "Delta Customs Brokers",
    "USD",
    23_450,
    "Stearns Bank",
    "1000 0057 8812",
    "Wire",
    "Duty + clearance, Apapa",
    "Musa Bello",
    "screen",
  ],
  [
    "Kestrel Security",
    "USD",
    12_000,
    "Lead Bank",
    "2190 7907 4471",
    "ACH",
    "Pen test, October",
    "Kwame Asante",
  ],
  [
    "Baobab Microfinance",
    "USDC",
    60_000,
    "Ethereum wallet",
    "0x7e1a3c5b9d2f4e6a8c0b1d3f5a7c9e2b4d6f8a15",
    "USDC on Ethereum",
    "Liquidity top-up",
    "Tolu Adeyemi",
  ],
  [
    "Alder & Co",
    "EUR",
    16_250,
    "Banking Circle",
    "IE29 AIBK 9311 5212 3456 78",
    "SEPA",
    "Office fit-out, Dublin",
    "Grace Mensah",
  ],
  [
    "Ifeoma Nwankwo",
    "NGN",
    1_950_000,
    "GTBank",
    "0234 5678 90",
    "Local transfer",
    "Translation services",
    "Daniel Okafor",
  ],
  [
    "Cobalt Telecom",
    "USD",
    17_300,
    "Cross River Bank",
    "3431 8115 6603",
    "ACH",
    "SMS + voice, September",
    "Priya Nair",
    "changed",
  ],
  [
    "Westgate Property",
    "USD",
    38_000,
    "Lead Bank",
    "2190 7907 7712",
    "Wire",
    "Office rent, November",
    "Ikenna Obi",
  ],
  [
    "Savanna Seeds",
    "USDC",
    13_200,
    "Polygon wallet",
    "0x5d7f9b1c3e5a7d9f2b4c6e8a0d2f4b6c8e1a3d50",
    "USDC on Polygon",
    "Seed stock, Kano",
    "Musa Bello",
  ],
  [
    "Hartley Recruitment",
    "GBP",
    14_400,
    "Clear Junction",
    "GB54 CLJU 0099 2263",
    "Swift",
    "Placement fees x3",
    "Chioma Eze",
  ],
  [
    "Granite Audit Partners",
    "USD",
    52_000,
    "Stearns Bank",
    "1000 0057 1147",
    "Wire",
    "Year-end audit, deposit",
    "Tolu Adeyemi",
    "mismatch",
  ],
  [
    "Lumi Events",
    "EUR",
    11_700,
    "Banking Circle",
    "ES91 2100 0418 4502 0005 1332",
    "SEPA",
    "Summit venue, Lisbon",
    "Grace Mensah",
  ],
];

const FROM: Record<Request["currency"], [string, number]> = {
  USD: ["Operating · USD", 1_840_000],
  USDC: ["Treasury wallet", 920_000],
  EUR: ["Operating · EUR", 410_000],
  GBP: ["Operating · GBP", 186_000],
  NGN: ["Payouts · NGN", 84_000_000],
};
const ARRIVAL: Record<string, string> = {
  ACH: "In 1–2 business days",
  Wire: "Today, if approved before 4pm ET",
  SEPA: "Usually today",
  Swift: "In 1–2 business days",
  "Local transfer": "In minutes",
  "USDC on Polygon": "In about a minute",
  "USDC on Ethereum": "In a few minutes",
};
const FEE: Record<string, number> = { ACH: 1, Wire: 15, Swift: 25 };
const ROUTING: Record<string, { label: string; value: string }> = {
  "Lead Bank": { label: "Routing", value: "101019644" },
  "Cross River Bank": { label: "Routing", value: "021214891" },
  "Stearns Bank": { label: "Routing", value: "091202590" },
  "Banking Circle": { label: "BIC", value: "BCIRLULL" },
};

SEEDS.forEach(([name, cur, amount, bank, value, rail, note, by, flag], i) => {
  const id = `apr_8${(0xd90 - i * 7).toString(16)}`;
  const [from, balance] = FROM[cur];
  const usd =
    amount * { USD: 1, USDC: 1, EUR: 1.08, GBP: 1.27, NGN: 1 / 1600 }[cur];
  const big = usd >= 50_000;
  const usual =
    flag === "usual" ? Math.round(amount / 2.6) : Math.round(amount * 0.92);
  const isNew = flag === "new";
  const invNo = `${name.replace(/[^A-Z]/g, "").slice(0, 3) || "INV"}-${1040 + i * 13}`;
  const wallet = rail.startsWith("USDC");
  REQUESTS.push(
    req({
      id,
      amount,
      currency: cur,
      recipient: {
        name,
        detail: wallet
          ? `${bank.replace(" wallet", "")} ${value.slice(0, 6)}…${value.slice(-4)}`
          : `${bank} ••${value.replace(/\s/g, "").slice(-4)}`,
        isNew,
      },
      from,
      requestedBy: by,
      requestedAt: at(170 + i * 41),
      note,
      reason: isNew
        ? { kind: "rule", ruleId: "r3" }
        : big
          ? { kind: "rule", ruleId: "r2" }
          : usd < 10_000
            ? { kind: "cap", cap: 5_000 }
            : { kind: "rule", ruleId: "r1" },
      needed: big ? 2 : 1,
      approvers: isNew ? ["admin"] : ["finance", "admin"],
      decisions: big
        ? [
            {
              by: by === "Chioma Eze" ? "Ikenna Obi" : "Chioma Eze",
              at: at(150 + i * 41),
              kind: "approved",
            },
          ]
        : [],
    }),
  );
  CONTEXT[id] = {
    balance: flag === "drain" ? Math.round(amount * 1.08) : balance,
    rail,
    arrival: ARRIVAL[rail],
    fee: FEE[rail] ?? 0,
    bank: { label: bank, value, routing: ROUTING[bank] },
    invoice:
      wallet || cur === "NGN"
        ? undefined
        : {
            file: `${invNo}.pdf`,
            number: invNo,
            amount: flag === "mismatch" ? Math.round(amount * 0.9) : amount,
            due: new Date(AS_OF + (4 + (i % 9)) * 86_400_000).toISOString(),
          },
    history: isNew
      ? { count: 0, total: 0 }
      : {
          since: new Date(AS_OF - (90 + i * 11) * 86_400_000).toISOString(),
          count: 3 + (i % 11),
          total: usual * (3 + (i % 11)),
          usual,
          last: { amount: usual, at: at(60 * 24 * (8 + (i % 20))) },
        },
    detailsChangedAt:
      flag === "changed" ? at(60 * 24 * (1 + (i % 3))) : undefined,
    similar:
      flag === "dupe"
        ? { amount, at: at(60 * 24 * 5), id: `pay_7${i}a4` }
        : undefined,
    screening: flag === "screen" ? "review" : "clear",
    expiresAt: flag === "expiring" ? ahead(35) : ahead(60 * 24 * (2 + (i % 5))),
  };
});

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
