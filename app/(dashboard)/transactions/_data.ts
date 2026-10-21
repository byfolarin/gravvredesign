export type TxnStatus = "Completed" | "Pending" | "Failed";
export type TxnType =
  "Account Funding" | "Crypto Transfer" | "Offramp" | "Payout";
export type Channel = "ACH" | "Wire" | "Polygon" | "Ethereum" | "Stellar";

export type Party = {
  /** Display name, e.g. "Lead Bank USD master account" or a wallet. */
  name: string;
  /** Masked account or short address. */
  detail: string;
  kind: "bank" | "wallet";
  /** Full on-chain address for wallets — what gets copied. */
  address?: string;
};

export type TxnEvent = { label: string; at: string };

export type Transaction = {
  id: string;
  createdAt: string;
  type: TxnType;
  direction: "Credit" | "Debit";
  status: TxnStatus;
  channel: Channel;
  amount: number;
  /** What the money was sent in and what it settled as, e.g. USD → USDC. */
  from: string;
  to: string;
  rate: number;
  fee: number;
  source: Party;
  destination: Party;
  customer: { id: string; name: string; email: string };
  /** On-chain hash for crypto legs; absent for pure fiat. */
  hash?: string;
  failureReason?: string;
  events: TxnEvent[];
};

/** Data snapshot time; "2h ago" style times are measured from here so server and client agree. */
export const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);

// Placeholder data shaped like the live Gravv Transactions table (Oct 2026): mostly small
// ACH account fundings into Lead Bank / CRB accounts, plus Polygon crypto transfers out.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(11);
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
const hex = (n: number) =>
  Array.from(
    { length: n },
    () => "0123456789abcdef"[Math.floor(rand() * 16)],
  ).join("");
const uuid = () =>
  `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;
const evm = () => {
  const body = hex(40);
  return `0x${[...body].map((c) => (/[a-f]/.test(c) && rand() > 0.5 ? c.toUpperCase() : c)).join("")}`;
};
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const MIN = 60 * 1000;

const customers = [
  { id: uuid(), name: "James Bond", email: "jamesbond@email.com" },
  { id: uuid(), name: "Jacinta Olukoya", email: "jacinta@olukoya.co" },
  { id: uuid(), name: "Jasper Smith", email: "jasper@creativityhub.com" },
  { id: uuid(), name: "John Doe", email: "johndoe@kredete.com" },
  { id: uuid(), name: "Amara Nwosu", email: "amara.nwosu@example.com" },
];
const fundingAccounts: Party[] = [
  { name: "Lead Bank USD master account", detail: "••4410", kind: "bank" },
  { name: "Lead Bank USD master account", detail: "••4410", kind: "bank" },
  { name: "CRB USD Sub-Account", detail: "••7781", kind: "bank" },
];
const customerBanks: Party[] = [
  { name: "Chase Bank", detail: "••9876", kind: "bank" },
  { name: "Bank of America", detail: "••5678", kind: "bank" },
  { name: "Wells Fargo", detail: "••3021", kind: "bank" },
];
const wallets: Party[] = [
  {
    name: "wallet_afa4b905",
    detail: "0x77f1…a7e2",
    kind: "wallet",
    address: "0x77f1c09B2e4d3A85f6E1b7d90c3F42a8D5e1a7e2",
  },
  {
    name: "wallet_e7d60a5d",
    detail: "0x34bd…642E",
    kind: "wallet",
    address: "0x34bd8E71a0C5f29d4B6e3A1c78D0f5b29E7c642E",
  },
  {
    name: "wallet_85034797",
    detail: "0xBE83…305d",
    kind: "wallet",
    address: "0xBE83a4F1c6D29e07B5d8E3f1A9c62b47D0e8305d",
  },
];
const failures = [
  "Insufficient balance in source wallet",
  "Receiving bank rejected the account name",
  "ACH return: account closed (R02)",
];

function make(i: number, createdAt: number): Transaction {
  const r = rand();
  const type: TxnType =
    r < 0.62
      ? "Account Funding"
      : r < 0.84
        ? "Crypto Transfer"
        : r < 0.93
          ? "Offramp"
          : "Payout";
  const status: TxnStatus =
    i < 2 ? "Pending" : rand() < 0.08 ? "Failed" : "Completed";
  const customer = pick(customers);
  const wallet = pick(wallets);

  let source: Party,
    destination: Party,
    channel: Channel,
    from: string,
    to: string,
    direction: Transaction["direction"],
    amount: number;
  switch (type) {
    case "Account Funding":
      // Small, frequent ACH fundings — 10 to 600 USDC, like the live table.
      amount = pick([10, 20, 30, 50, 50, 150, 300, 400, 450, 560]);
      [source, destination, channel, from, to, direction] = [
        pick(customerBanks),
        pick(fundingAccounts),
        "ACH",
        "USD",
        "USDC",
        "Credit",
      ];
      break;
    case "Crypto Transfer": {
      amount = pick([450, 450, 300, 1140, 75, 980]);
      const address = evm();
      [source, destination, channel, from, to, direction] = [
        wallet,
        {
          name: shortAddr(address),
          detail: "External wallet",
          kind: "wallet",
          address,
        },
        pick(["Polygon", "Polygon", "Polygon", "Ethereum"] as const),
        "USDC",
        "USDC",
        "Debit",
      ];
      break;
    }
    case "Offramp":
      amount = pick([500, 1200, 2500, 4700]);
      [source, destination, channel, from, to, direction] = [
        wallet,
        pick(customerBanks),
        pick(["ACH", "Wire"] as const),
        "USDC",
        "USD",
        "Debit",
      ];
      break;
    default:
      amount = pick([250, 800, 1500]);
      [source, destination, channel, from, to, direction] = [
        wallet,
        {
          name: customer.name,
          detail: pick(customerBanks).detail,
          kind: "bank",
        },
        pick(["ACH", "Wire"] as const),
        "USDC",
        "USD",
        "Debit",
      ];
  }

  const fee = channel === "Wire" ? 5 : channel === "ACH" ? 1 : 0.02;
  const onChain = !["ACH", "Wire"].includes(channel) || from !== to;
  const at = (offset: number) =>
    new Date(createdAt + offset * MIN).toISOString();
  const events: TxnEvent[] = [
    { label: "Initiated", at: at(0) },
    { label: "Processing", at: at(1) },
    ...(status === "Completed"
      ? [
          {
            label: "Completed",
            at: at(channel === "ACH" ? 180 : channel === "Wire" ? 45 : 2),
          },
        ]
      : []),
    ...(status === "Failed" ? [{ label: "Failed", at: at(6) }] : []),
  ];

  return {
    id: uuid(),
    createdAt: new Date(createdAt).toISOString(),
    type,
    direction,
    status,
    channel,
    amount,
    from,
    to,
    // USD and USDC convert 1:1 on Gravv.
    rate: 1,
    fee,
    source,
    destination,
    customer,
    hash: onChain ? `0x${hex(64)}` : undefined,
    failureReason:
      status === "Failed"
        ? type === "Crypto Transfer"
          ? failures[0]
          : type === "Account Funding"
            ? failures[2]
            : failures[1]
        : undefined,
    events,
  };
}

let t = AS_OF - 35 * MIN;
export const transactions: Transaction[] = Array.from(
  { length: 60 },
  (_, i) => {
    const txn = make(i, t);
    // Bursts of activity, then quieter gaps, across roughly the last month.
    t -= (rand() < 0.55 ? 3 + rand() * 90 : 400 + rand() * 2200) * MIN;
    return txn;
  },
);
