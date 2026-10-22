import { BANKS, type Category, type Currency } from "../_data";
import { RAILS, READY_IN } from "./currency";

/**
 * What the Open account flow needs to let you compare and decide — modelled on Gravv's real
 * flow (category → location → currency → bank → account type → settlement wallet), with the
 * facts it hides surfaced up front.
 */

export type Rail = { name: string; speed: string };
export type Provider = {
  bank: string;
  /** Identity tint for the bank's mark. */
  tint: string;
  rails: Rail[];
  readyIn: string;
  /** Accounts one holder can have with this bank. */
  perHolder: number;
  /** What the account details look like. */
  details: string;
  /** The one thing worth knowing, if any. */
  note?: string;
  /** States it doesn't open accounts in. */
  notIn?: string[];
};

const RICH: Partial<Record<Currency, Provider[]>> = {
  USD: [
    {
      bank: "Lead Bank",
      tint: "#3b82f6",
      rails: [
        { name: "ACH", speed: "1–3 days" },
        { name: "Wire", speed: "Same day" },
        { name: "FedNow", speed: "Instant" },
      ],
      readyIn: "1–2 business days",
      perHolder: 20,
      details: "Routing and account number",
      note: "Most used on Gravv",
    },
    {
      bank: "Cross River Bank",
      tint: "#f97316",
      rails: [
        { name: "ACH", speed: "1–3 days" },
        { name: "Wire", speed: "Same day" },
        { name: "RTP", speed: "Instant" },
      ],
      readyIn: "1–3 business days",
      perHolder: 20,
      details: "Routing and account number",
    },
    {
      bank: "Stearns Bank",
      tint: "#14b8a6",
      rails: [
        { name: "ACH", speed: "1–3 days" },
        { name: "Wire", speed: "Same day" },
      ],
      readyIn: "2–3 business days",
      perHolder: 10,
      details: "Routing and account number",
    },
    {
      bank: "Choice Microfinance Bank",
      tint: "#a855f7",
      rails: [
        { name: "ACH", speed: "1–3 days" },
        { name: "Wire", speed: "Same day" },
      ],
      readyIn: "3–5 business days",
      perHolder: 5,
      details: "Routing and account number",
      notIn: ["Ohio", "Texas"],
    },
  ],
  EUR: [
    {
      bank: "Banking Circle S.A.",
      tint: "#2563eb",
      rails: [
        { name: "SEPA", speed: "Next day" },
        { name: "SEPA Instant", speed: "10 seconds" },
        { name: "SWIFT", speed: "1–3 days" },
      ],
      readyIn: "1–3 business days",
      perHolder: 20,
      details: "IBAN and BIC in the holder's name",
    },
  ],
  GBP: [
    {
      bank: "Clear Junction Limited",
      tint: "#8b5cf6",
      rails: [
        { name: "Faster Payments", speed: "Seconds" },
        { name: "CHAPS", speed: "Same day" },
        { name: "BACS", speed: "3 days" },
      ],
      readyIn: "1–3 business days",
      perHolder: 10,
      details: "Sort code and account number",
    },
  ],
};

const TINTS = ["#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];

export function providersFor(c: Currency): Provider[] {
  return (
    RICH[c] ??
    BANKS[c].map((b, i) => ({
      bank: b.bank,
      tint: TINTS[i % TINTS.length],
      rails: RAILS[c].split(/, | and /).map((name) => ({ name, speed: "" })),
      readyIn: READY_IN[c],
      perHolder: 10,
      details: `${b.routing().label} and account number`,
    }))
  );
}

/** Gravv's account types, said as what the account is for. */
export const PURPOSES = [
  {
    id: "Operating",
    gravv: "Operating",
    line: "Day-to-day money in and out of the business.",
  },
  {
    id: "Collections",
    gravv: "Default",
    line: "Where payments from customers and payers land.",
  },
  {
    id: "Card funding",
    gravv: "Card",
    line: "Holds the money behind cards issued through the API.",
  },
  {
    id: "General",
    gravv: "Regular",
    line: "No set use yet.",
  },
] as const;
export type Purpose = (typeof PURPOSES)[number]["id"];

export type Chain =
  "Polygon" | "Base" | "Avalanche" | "Ethereum" | "Stellar" | "Solana" | "Tron";

export const NETWORKS: {
  chain: Chain;
  name: string;
  speed: string;
  fee: string;
  note?: string;
}[] = [
  {
    chain: "Polygon",
    name: "Polygon",
    speed: "~2 s",
    fee: "< $0.01",
    note: "Most used",
  },
  { chain: "Base", name: "Base", speed: "~2 s", fee: "< $0.01" },
  { chain: "Solana", name: "Solana", speed: "< 1 s", fee: "< $0.01" },
  { chain: "Stellar", name: "Stellar", speed: "~5 s", fee: "< $0.01" },
  {
    chain: "Avalanche",
    name: "Avalanche C-Chain",
    speed: "~1 s",
    fee: "~ $0.02",
  },
  { chain: "Tron", name: "Tron", speed: "~3 s", fee: "~ $1" },
  { chain: "Ethereum", name: "Ethereum", speed: "~12 s", fee: "$0.50–$3" },
];

export type Wallet = {
  id: string;
  label: string;
  chain: Chain;
  address: string;
  balance: number;
};
export const WALLETS: Wallet[] = [
  {
    id: "w1",
    label: "Treasury",
    chain: "Polygon",
    address: "0x6E83dC…4470",
    balance: 248_320.55,
  },
  {
    id: "w2",
    label: "Payouts",
    chain: "Base",
    address: "0xb5a8eC…752C",
    balance: 61_904.1,
  },
  {
    id: "w3",
    label: "Collections",
    chain: "Stellar",
    address: "GBX4R2…QK2L",
    balance: 18_220,
  },
  {
    id: "w4",
    label: "Reserve",
    chain: "Ethereum",
    address: "0x1d7c4A…9a02",
    balance: 502_000,
  },
];

export type Holder = {
  name: string;
  email: string;
  category: Category;
  state: string;
  country: string;
  /** Why they can't hold an account yet. */
  blocked?: string;
};

/** Your own business — Gravv already holds its verification. */
export const BUSINESS: Holder = {
  name: "Kredete Ltd",
  email: "treasury@kredete.com",
  category: "Business",
  state: "Ohio",
  country: "United States",
};

/** Customers who can't hold an account yet, and why. */
export const UNVERIFIED: Holder[] = [
  {
    name: "Jordan Parker",
    email: "jordan@parkerstudio.co",
    category: "Individual",
    state: "California",
    country: "United States",
    blocked: "Identity check not started",
  },
  {
    name: "Summit Supply Co",
    email: "ops@summitsupply.com",
    category: "Business",
    state: "Texas",
    country: "United States",
    blocked: "Waiting on business documents",
  },
  {
    name: "Noble Foods Ltd",
    email: "finance@noblefoods.ng",
    category: "Business",
    state: "Lagos",
    country: "Nigeria",
    blocked: "Director's ID expired",
  },
  {
    name: "Ama Owusu",
    email: "ama.owusu@gmail.com",
    category: "Individual",
    state: "Greater Accra",
    country: "Ghana",
    blocked: "Identity check not started",
  },
];

const STATES = [
  "Ohio",
  "New York",
  "California",
  "Delaware",
  "Florida",
  "Texas",
];
/** Stable US state for a customer, so banks on offer don't jump around. */
export function stateFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return STATES[h % STATES.length];
}
