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
    recipient: { name: "Trade desk · USDC → NGN", detail: "Providus Bank ••4412 · rate held 15 min" },
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

export function ago(iso: string) {
  const m = Math.max(1, Math.round((AS_OF - Date.parse(iso)) / MIN));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
