export type RecipientStatus = "Active" | "Pending";
export type Rail = "ACH Wire" | "Swift" | "Bank account";

export type VerificationStep = {
  label: string;
  state: "done" | "current" | "upcoming";
  note?: string;
};

export type RecipientPayment = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  status: "Completed" | "Processing" | "Failed";
  /** What the payment was funded from — USDC is converted at send time. */
  source: string;
  reference: string;
};

export type Recipient = {
  id: string;
  name: string;
  kind: "Business" | "Individual";
  /** Portrait for people, logo mark for businesses. Placeholder images for now. */
  image?: string;
  country: string;
  institution: string;
  /** null when the bank account number hasn't been provided. */
  account: string | null;
  routing?: { label: string; value: string };
  currency: string;
  rail: Rail;
  status: RecipientStatus;
  createdAt: string;
  email?: string;
  verification?: VerificationStep[];
  payments: RecipientPayment[];
};

const pendingSteps = (bank: string): VerificationStep[] => [
  { label: "Details submitted", state: "done" },
  {
    label: "Bank account check",
    state: "current",
    note: `Waiting for ${bank} to confirm the account name matches. Usually under 1 business day.`,
  },
  { label: "Compliance review", state: "upcoming" },
];

// Placeholder people and businesses, shaped like the live dashboard's recipients (Oct 2026).
const portrait = (path: string) => `https://randomuser.me/api/portraits/${path}.jpg`;
const logo = (seed: string) => `https://api.dicebear.com/9.x/shapes/svg?seed=${seed}`;

export const recipients: Recipient[] = [
  {
    id: "rcp_9f2a71c04e",
    name: "Northwind Logistics",
    image: logo("northwind"),
    kind: "Business",
    country: "Luxembourg",
    institution: "Banking Circle S.A.",
    account: "LU094080000047100391",
    routing: { label: "SWIFT / BIC", value: "BCIRLULL" },
    currency: "USD",
    rail: "Swift",
    status: "Active",
    createdAt: "2026-10-09T19:05:04Z",
    email: "finance@northwind.lu",
    payments: [
      { id: "pay_31a", amount: 18_400, currency: "USD", date: "2026-10-12T10:14:00Z", status: "Completed", source: "USDC · Treasury wallet", reference: "INV-2026-114" },
    ],
  },
  {
    id: "rcp_44c1e8b2aa",
    name: "Amara Nwosu",
    image: portrait("women/44"),
    kind: "Individual",
    country: "United Kingdom",
    institution: "Clear Junction Limited",
    account: "44132595",
    routing: { label: "SWIFT / BIC", value: "CLJUGB21" },
    currency: "USD",
    rail: "Swift",
    status: "Active",
    createdAt: "2026-10-09T13:33:44Z",
    email: "amara.nwosu@example.com",
    payments: [
      { id: "pay_29c", amount: 2_500, currency: "USD", date: "2026-10-10T09:02:00Z", status: "Completed", source: "USD account", reference: "Expense reimbursement" },
      { id: "pay_29d", amount: 1, currency: "USD", date: "2026-10-09T13:40:00Z", status: "Completed", source: "USD account", reference: "Test payment" },
    ],
  },
  {
    id: "rcp_7be09d3f15",
    name: "Lumen Labs Inc",
    image: logo("lumenlabs"),
    kind: "Business",
    country: "United States",
    institution: "Lead Bank",
    account: "219079072561",
    routing: { label: "Routing number", value: "101019644" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Active",
    createdAt: "2026-10-09T12:53:55Z",
    email: "ap@lumenlabs.io",
    payments: [
      { id: "pay_27e", amount: 42_750, currency: "USD", date: "2026-10-13T15:21:00Z", status: "Processing", source: "USDC · Payouts float", reference: "Oct services" },
      { id: "pay_27f", amount: 39_900, currency: "USD", date: "2026-10-10T11:48:00Z", status: "Completed", source: "USDC · Payouts float", reference: "Sep services" },
    ],
  },
  {
    id: "rcp_12d8f6a093",
    name: "Marcus Reid",
    image: portrait("men/52"),
    kind: "Individual",
    country: "United States",
    institution: "Stearns Bank",
    account: "1000005809",
    routing: { label: "Routing number", value: "091202590" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Active",
    createdAt: "2026-10-09T12:34:22Z",
    payments: [
      { id: "pay_25a", amount: 3_200, currency: "USD", date: "2026-10-11T08:30:00Z", status: "Failed", source: "USD account", reference: "Contractor — Oct" },
    ],
  },
  {
    id: "rcp_5a3c9e7d21",
    name: "Daniel Okafor",
    image: portrait("men/32"),
    kind: "Individual",
    country: "Nigeria",
    institution: "Access Bank Plc",
    account: "1720901996",
    routing: { label: "SWIFT / BIC", value: "ABNGNGLA" },
    currency: "USD",
    rail: "Swift",
    status: "Active",
    createdAt: "2026-10-01T13:50:44Z",
    payments: [
      { id: "pay_19b", amount: 5_000, currency: "USD", date: "2026-10-03T14:05:00Z", status: "Completed", source: "USDC · Treasury wallet", reference: "Payroll" },
      { id: "pay_19c", amount: 5_000, currency: "USD", date: "2026-09-03T14:02:00Z", status: "Completed", source: "USDC · Treasury wallet", reference: "Payroll" },
    ],
  },
  {
    id: "rcp_e0b47c5f88",
    name: "Atlas Relief Foundation",
    image: logo("atlasrelief"),
    kind: "Business",
    country: "Morocco",
    institution: "Attijariwafa Bank",
    account: null,
    currency: "MAD",
    rail: "Bank account",
    status: "Active",
    createdAt: "2026-09-22T12:50:39Z",
    email: "finance@atlasrelief.ma",
    payments: [
      { id: "pay_14d", amount: 120_000, currency: "MAD", date: "2026-09-29T10:00:00Z", status: "Completed", source: "USDC · Treasury wallet", reference: "Grant tranche 1" },
    ],
  },
  {
    id: "rcp_3c71a2e9d4",
    name: "Sofia Alvarez",
    image: portrait("women/68"),
    kind: "Individual",
    country: "United States",
    institution: "Cross River Bank",
    account: "343181156633",
    routing: { label: "Routing number", value: "021214891" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Active",
    createdAt: "2026-09-22T11:27:54Z",
    payments: [],
  },
  {
    id: "rcp_8d6e1f0b37",
    name: "Hannah Kim",
    image: portrait("women/21"),
    kind: "Individual",
    country: "United States",
    institution: "Lead Bank",
    account: "213553026988",
    routing: { label: "Routing number", value: "101019644" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Pending",
    createdAt: "2026-09-18T12:00:56Z",
    verification: pendingSteps("Lead Bank"),
    payments: [],
  },
  {
    id: "rcp_b29f4d6c10",
    name: "Meridian Trade Co",
    image: logo("meridian"),
    kind: "Business",
    country: "United States",
    institution: "Cross River Bank",
    account: "11434",
    routing: { label: "Routing number", value: "021214891" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Pending",
    createdAt: "2026-09-17T18:33:50Z",
    verification: [
      { label: "Details submitted", state: "done" },
      {
        label: "Bank account check",
        state: "current",
        note: "Account number looks too short for Cross River Bank. Check it with the recipient and edit the details.",
      },
      { label: "Compliance review", state: "upcoming" },
    ],
    payments: [],
  },
  {
    id: "rcp_b29f4d6c11",
    name: "Meridian Trade Co",
    image: logo("meridian"),
    kind: "Business",
    country: "United States",
    institution: "Cross River Bank",
    account: "11434",
    routing: { label: "Routing number", value: "021214891" },
    currency: "USD",
    rail: "ACH Wire",
    status: "Pending",
    createdAt: "2026-09-07T14:59:05Z",
    verification: [
      { label: "Details submitted", state: "done" },
      {
        label: "Bank account check",
        state: "current",
        note: "Same details as another Meridian Trade Co recipient added on Sep 17. Archive one of them.",
      },
      { label: "Compliance review", state: "upcoming" },
    ],
    payments: [],
  },
];
