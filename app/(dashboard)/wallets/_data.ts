export type Network = "Polygon" | "Ethereum" | "Stellar" | "Avalanche";
export type Capability = "Transfer" | "Remittance" | "Receive";

export type WalletActivity = {
  id: string;
  direction: "in" | "out";
  amount: number;
  counterparty: string;
  date: string;
};

export type Wallet = {
  id: string;
  accountId: string;
  /** Auto-generated as wallet_<customer id prefix> unless renamed. */
  name: string;
  network: Network;
  address: string;
  /** Stellar wallets need a memo on incoming transfers. */
  memo?: string;
  customerId: string;
  accountType: "Saving" | "Checking";
  balance: number;
  capabilities: Capability[];
  /** Frozen wallets can't send or receive until unfrozen. */
  frozen?: boolean;
  /** When the wallet was frozen; shown on the badge. */
  frozenAt?: string;
  createdAt: string;
  activity: WalletActivity[];
};

/** Network-specific notes shown with the deposit address. */
export const networkNotes: Record<Network, string> = {
  Stellar: "Senders must include the memo, or funds can't be matched to this wallet.",
  Polygon: "Only send USDC on Polygon PoS to this address.",
  Ethereum: "Only send USDC on Ethereum mainnet to this address.",
  Avalanche: "Only send USDC on Avalanche C-Chain to this address.",
};

// Placeholder data shaped like the live dashboard's Wallets page (Oct 2026):
// auto-named wallets, mostly Polygon, many still unfunded. Seeded so server and client match.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

const rand = seeded(42);
const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rand() * 16)]).join("");
const evm = () => {
  const body = hex(40);
  // Mixed case, like an EIP-55 checksummed address.
  return `0x${[...body].map((c) => (/[a-f]/.test(c) && rand() > 0.5 ? c.toUpperCase() : c)).join("")}`;
};
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;

const customers = Array.from({ length: 9 }, uuid);
const counterparties = ["Lumen Labs Inc", "Northwind Logistics", "Card settlement", "Treasury top-up", "Payout batch", "Atlas Relief Foundation"];
const balances = [0, 450, 0, 0, 450, 1140, 300, 0, 0, 600, 2500, 0, 75, 3200, 0, 980, 0, 900, 12400, 0, 0, 450, 0, 0];

/** Data snapshot time; relative times ("2h ago") are measured from here so server and client agree. */
export const AS_OF = Date.UTC(2026, 9, 19, 18, 0, 0);
const HOUR = 1000 * 60 * 60;

let created = Date.UTC(2026, 9, 19, 11, 59, 30);

/**
 * Activity that nets to the balance: 1–3 deposits, and for larger wallets one withdrawal,
 * all between creation and AS_OF. Newest first.
 */
const payees = ["Payout to Lagos", "Card settlement", "Off-ramp to USD", "Supplier payment"];
function history(i: number, balance: number, createdAt: number): WalletActivity[] {
  if (balance <= 0) return [];
  const span = Math.max(HOUR, AS_OF - createdAt - HOUR);
  const when = () => new Date(createdAt + HOUR + Math.floor(rand() * span)).toISOString();
  const out = balance >= 400 && i % 3 !== 2 ? Math.round(balance * (0.25 + rand() * 0.45)) : 0;
  const inTotal = balance + out;
  const count = inTotal >= 1000 ? 3 : inTotal >= 400 ? 2 : 1;
  const parts = Array.from({ length: count }, (_, k) => (k === count - 1 ? 0 : Math.round((inTotal / count) * (0.6 + rand() * 0.6))));
  parts[count - 1] = inTotal - parts.slice(0, -1).reduce((a, b) => a + b, 0);
  const ins: WalletActivity[] = parts.map((amount, k) => ({
    id: `${i}-in-${k}`,
    direction: "in",
    amount,
    counterparty: counterparties[(i + k) % counterparties.length],
    // The first deposit usually lands within two days of creation; later ones any time after.
    date: k === 0 ? new Date(Math.min(AS_OF - HOUR, createdAt + HOUR + Math.floor(rand() * 48 * HOUR))).toISOString() : when(),
  }));
  // A withdrawal can only follow the first deposit.
  const firstIn = ins.reduce((a, b) => (a.date < b.date ? a : b)).date;
  const outs: WalletActivity[] = out
    ? [
        {
          id: `${i}-out`,
          direction: "out",
          amount: out,
          counterparty: payees[i % payees.length],
          date: new Date(Date.parse(firstIn) + Math.floor(rand() * Math.max(HOUR, AS_OF - Date.parse(firstIn)))).toISOString(),
        },
      ]
    : [];
  return [...ins, ...outs].sort((a, b) => b.date.localeCompare(a.date));
}

export const wallets: Wallet[] = balances.map((balance, i) => {
  const customerId = customers[i % customers.length];
  const network: Network = i === 3 || i === 13 ? "Ethereum" : i === 9 ? "Stellar" : i === 17 ? "Avalanche" : "Polygon";
  const createdAt = new Date(created).toISOString();
  // Wallets arrive in bursts: often a few the same day, then a quiet stretch.
  created -= rand() < 0.45 ? 1000 * 60 * (60 + Math.floor(rand() * 300)) : 1000 * 60 * (1800 + Math.floor(rand() * 5400));
  return {
    id: uuid(),
    accountId: uuid(),
    name: `wallet_${customerId.slice(0, 8)}`,
    network,
    address:
      network === "Stellar"
        ? `G${Array.from({ length: 55 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[Math.floor(rand() * 32)]).join("")}`
        : evm(),
    memo: network === "Stellar" ? String(1_000_000_000 + Math.floor(rand() * 8_999_999_999)) : undefined,
    customerId,
    accountType: i % 3 === 0 ? "Saving" : "Checking",
    balance,
    capabilities: i % 4 === 1 ? ["Receive"] : ["Transfer", "Remittance", "Receive"],
    // One wallet starts frozen so the state is visible in the prototype.
    frozen: i === 5 ? true : undefined,
    frozenAt: i === 5 ? "2026-10-16T09:20:00Z" : undefined,
    createdAt,
    activity: history(i, balance, Date.parse(createdAt)),
  };
});
