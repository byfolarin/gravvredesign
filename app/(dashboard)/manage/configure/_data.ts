export type Env = "live" | "sandbox";

/** Snapshot time so relative times agree on server and client. */
export const AS_OF = Date.UTC(2026, 9, 21, 10, 0, 0);
const MIN = 60_000;
const at = (minsAgo: number) => new Date(AS_OF - minsAgo * MIN).toISOString();

export function ago(iso: string | null) {
  if (!iso) return "Never";
  const m = Math.max(1, Math.round((AS_OF - Date.parse(iso)) / MIN));
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export const ENV: Record<
  Env,
  { label: string; base: string; accountId: string; note: string }
> = {
  live: {
    label: "Live",
    base: "https://api.gravv.xyz/v1",
    accountId: "acct_kredete_7Hq2Lm",
    note: "Requests move real money.",
  },
  sandbox: {
    label: "Sandbox",
    base: "https://sandbox.api.gravv.xyz/v1",
    accountId: "acct_kredete_test_4Pz9",
    note: "Test with fake money — nothing leaves Kredete.",
  },
};

/** What a restricted key can do, in the same plain words as Roles. */
export const SCOPES = [
  { id: "balances.read", label: "Read balances", group: "Money" },
  { id: "transactions.read", label: "Read transactions", group: "Money" },
  { id: "payouts.write", label: "Send payouts", group: "Money" },
  { id: "accounts.write", label: "Open and manage accounts", group: "Money" },
  { id: "links.write", label: "Create payment links", group: "Getting paid" },
  {
    id: "customers.write",
    label: "Create and update customers",
    group: "Getting paid",
  },
  { id: "cards.write", label: "Issue and manage cards", group: "Cards" },
] as const;
export type ScopeId = (typeof SCOPES)[number]["id"];

export type ApiKey = {
  id: string;
  env: Env;
  name: string;
  /** Only the last characters are ever stored for display. */
  last4: string;
  access: "full" | ScopeId[];
  createdBy: string;
  createdAt: string;
  lastUsed: string | null;
  expires: string | null;
  /** A rolled key keeps working for a while so nothing breaks mid-deploy. */
  expiresSoon?: string;
};

export const KEYS: ApiKey[] = [
  {
    id: "key_1",
    env: "live",
    name: "Production backend",
    last4: "a91f",
    access: "full",
    createdBy: "Kwame Asante",
    createdAt: "Mar 4, 2026",
    lastUsed: at(1),
    expires: null,
  },
  {
    id: "key_2",
    env: "live",
    name: "Payouts service",
    last4: "3c07",
    access: ["balances.read", "transactions.read", "payouts.write"],
    createdBy: "Sarah Chen",
    createdAt: "Jun 18, 2026",
    lastUsed: at(4),
    expires: "Jun 18, 2027",
  },
  {
    id: "key_3",
    env: "live",
    name: "Finance reporting",
    last4: "e2d4",
    access: ["balances.read", "transactions.read"],
    createdBy: "Tolu Adeyemi",
    createdAt: "Aug 2, 2026",
    lastUsed: at(60 * 9),
    expires: null,
  },
  {
    id: "key_4",
    env: "live",
    name: "Old checkout integration",
    last4: "77b1",
    access: ["links.write", "customers.write"],
    createdBy: "Kwame Asante",
    createdAt: "Nov 12, 2025",
    lastUsed: at(60 * 24 * 41),
    expires: null,
  },
  {
    id: "key_5",
    env: "sandbox",
    name: "Local development",
    last4: "0f6a",
    access: "full",
    createdBy: "Sarah Chen",
    createdAt: "Feb 9, 2026",
    lastUsed: at(22),
    expires: null,
  },
  {
    id: "key_6",
    env: "sandbox",
    name: "CI tests",
    last4: "b88e",
    access: "full",
    createdBy: "Kwame Asante",
    createdAt: "Feb 9, 2026",
    lastUsed: at(60 * 3),
    expires: null,
  },
];

export const EVENT_GROUPS: { label: string; events: string[] }[] = [
  {
    label: "Transactions",
    events: ["transaction.completed", "transaction.failed", "deposit.received"],
  },
  {
    label: "Payouts",
    events: ["payout.created", "payout.completed", "payout.failed"],
  },
  {
    label: "Accounts",
    events: [
      "account.activated",
      "account.frozen",
      "application.account.updated",
    ],
  },
  {
    label: "Payment links",
    events: ["payment_link.paid", "payment_link.expired"],
  },
  { label: "Cards", events: ["card.authorized", "card.declined"] },
  { label: "Approvals", events: ["approval.requested", "approval.decided"] },
];

export type Delivery = {
  id: string;
  event: string;
  status: number | "timeout";
  at: string;
  attempts: number;
  ms: number;
  /** The money movement it's about, when there is one. */
  transactionId?: string;
  /** Still being retried; otherwise the last attempt is final. */
  retrying?: boolean;
};

export type Endpoint = {
  id: string;
  env: Env;
  url: string;
  description: string;
  events: string[];
  enabled: boolean;
  /** Set when Kredete switched it off after repeated failures. */
  autoDisabled?: boolean;
  secretLast4: string;
  createdAt: string;
  deliveries: Delivery[];
  /** When every delivery has failed for a while: since when, what it answers, and how many wait. */
  outage?: {
    since: string;
    error: string;
    queued: number;
    nextRetryMins: number;
  };
};

const txn = (r: () => number) =>
  `${Array.from({ length: 8 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("")}-${Array.from({ length: 4 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("")}-4${Array.from({ length: 3 }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("")}`;

/** An endpoint that's been answering 404 to everything — the live Gravv sandbox case. */
function notFound(
  seed: number,
  events: string[],
  n: number,
  start: number,
): Delivery[] {
  let s = seed;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
  let mins = start;
  return Array.from({ length: n }, (_, i) => {
    const event = events[Math.floor(r() * events.length)];
    const d: Delivery = {
      id: `evt_${(seed * 131 + i * 104729).toString(36)}`,
      event,
      status: 404,
      at: at(mins),
      attempts: 2 + Math.floor(r() * 6),
      ms: 60 + Math.floor(r() * 120),
      transactionId: event.startsWith("application") ? undefined : txn(r),
      retrying: true,
    };
    mins += 3 + Math.floor(r() * 25);
    return d;
  });
}

function deliveries(
  seed: number,
  events: string[],
  failEvery: number,
  n = 14,
  /** Minutes since the latest attempt. */
  start = 4,
): Delivery[] {
  let s = seed;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
  // Newest first, each one a little further back than the last.
  let mins = start;
  return Array.from({ length: n }, (_, i) => {
    const fail = failEvery > 0 && i % failEvery === 0;
    const status: Delivery["status"] = fail
      ? r() < 0.5
        ? 500
        : "timeout"
      : 200;
    const d: Delivery = {
      transactionId:
        /^(transaction|payout|deposit)/.test(events[0]) || r() < 0.5
          ? txn(r)
          : undefined,
      retrying: fail && i < failEvery * 2,
      id: `evt_${(seed * 97 + i * 7919).toString(36)}`,
      event: events[Math.floor(r() * events.length)],
      status,
      at: at(mins),
      attempts: fail ? 3 + Math.floor(r() * 3) : 1,
      // A timeout waited the full 10s; an error answered quickly.
      ms: status === "timeout" ? 10_000 : 80 + Math.floor(r() * 260),
    };
    mins += 9 + Math.floor(r() * 50);
    return d;
  });
}

export const ENDPOINTS: Endpoint[] = [
  {
    id: "we_1",
    env: "live",
    url: "https://api.kredete.com/webhooks/gravv",
    description: "Main backend — ledger and notifications",
    events: [
      "transaction.completed",
      "transaction.failed",
      "deposit.received",
      "payout.completed",
      "payout.failed",
      "account.activated",
    ],
    enabled: true,
    secretLast4: "9d2c",
    createdAt: "Mar 4, 2026",
    deliveries: deliveries(
      11,
      ["transaction.completed", "deposit.received", "payout.completed"],
      0,
      30,
    ),
  },
  {
    id: "we_2",
    env: "live",
    url: "https://hooks.slack.com/services/T04/B07/finance-alerts",
    description: "Finance alerts in Slack",
    events: ["payout.failed", "approval.requested"],
    enabled: true,
    secretLast4: "41ab",
    createdAt: "Jul 22, 2026",
    deliveries: deliveries(23, ["payout.failed", "approval.requested"], 6, 10),
  },
  {
    id: "we_3",
    env: "live",
    url: "https://erp.kredete.com/integrations/payments",
    description: "ERP sync",
    events: ["payment_link.paid", "transaction.completed"],
    enabled: false,
    autoDisabled: true,
    secretLast4: "c310",
    createdAt: "Jan 30, 2026",
    deliveries: deliveries(
      37,
      ["payment_link.paid", "transaction.completed"],
      1,
      8,
      60 * 24 * 3,
    ),
  },
  {
    id: "we_4",
    env: "sandbox",
    url: "https://kredete-dev.ngrok.app/webhooks",
    description: "Local tunnel",
    events: EVENT_GROUPS.flatMap((g) => g.events),
    enabled: true,
    secretLast4: "7e55",
    createdAt: "Feb 9, 2026",
    deliveries: deliveries(
      41,
      ["transaction.completed", "payout.created", "card.authorized"],
      5,
      12,
    ),
  },
  {
    id: "we_5",
    env: "sandbox",
    url: "https://webhook.site/139b2655-5e2c-499a-b1cf-4e99892fc9f5",
    description: "Sandbox webhook",
    events: [
      "transaction.completed",
      "transaction.failed",
      "payout.created",
      "payout.completed",
      "account.activated",
      "application.account.updated",
    ],
    enabled: true,
    secretLast4: "f9f5",
    createdAt: "Jul 21, 2026",
    deliveries: notFound(
      53,
      [
        "transaction.completed",
        "payout.created",
        "payout.completed",
        "application.account.updated",
      ],
      24,
      6,
    ),
    outage: {
      since: at(60 * 47 + 18),
      error: "404 Not Found",
      queued: 14_600,
      nextRetryMins: 4,
    },
  },
];

export type AllowedIp = {
  cidr: string;
  label: string;
  addedBy: string;
  addedAt: string;
};

export const ALLOWLIST: AllowedIp[] = [
  {
    cidr: "52.31.144.0/24",
    label: "Production servers (AWS eu-west-1)",
    addedBy: "Kwame Asante",
    addedAt: "Mar 4, 2026",
  },
  {
    cidr: "34.243.18.92",
    label: "Payouts worker",
    addedBy: "Sarah Chen",
    addedAt: "Jun 18, 2026",
  },
  {
    cidr: "102.89.40.17",
    label: "Lagos office",
    addedBy: "Oluwatobi Bello",
    addedAt: "Sep 2, 2026",
  },
];

// ——— Integration health ———

export type ApiRequest = {
  id: string;
  env: Env;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  status: number;
  keyId: string;
  ip: string;
  ms: number;
  at: string;
  /** Plain-words reason for a failed request. */
  why?: string;
};

const PATHS: [ApiRequest["method"], string][] = [
  ["POST", "/v1/transfers"],
  ["GET", "/v1/balances"],
  ["GET", "/v1/transactions"],
  ["POST", "/v1/payment_links"],
  ["GET", "/v1/accounts"],
  ["POST", "/v1/customers"],
  ["GET", "/v1/transfers/{id}"],
];

function requestLog(env: Env, seed: number, n: number): ApiRequest[] {
  let s = seed;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
  const keys = KEYS.filter(
    (k) =>
      k.env === env &&
      k.lastUsed &&
      AS_OF - Date.parse(k.lastUsed) < 7 * 86_400_000,
  );
  let mins = 1;
  return Array.from({ length: n }, (_, i) => {
    // A key revoked last week is still being called from one old server — the 401s.
    const revoked = env === "live" && r() < 0.14;
    const key = keys[Math.floor(r() * keys.length)];
    const [method, path] = PATHS[Math.floor(r() * PATHS.length)];
    const roll = r();
    const status = revoked
      ? 401
      : roll < 0.03
        ? 422
        : roll < 0.05
          ? 429
          : method === "POST"
            ? 201
            : 200;
    const ip = revoked
      ? "18.130.77.4"
      : key.id === "key_2"
        ? "34.243.18.92"
        : key.id === "key_3"
          ? "102.89.40.17"
          : env === "sandbox"
            ? "105.112.20.8"
            : `52.31.144.${10 + Math.floor(r() * 80)}`;
    const req: ApiRequest = {
      id: `req_${(seed * 7 + i * 131).toString(36)}${Math.floor(r() * 1e4).toString(36)}`,
      env,
      method,
      path,
      status,
      keyId: revoked ? "revoked" : key.id,
      ip,
      ms:
        status === 429
          ? 12
          : 60 + Math.floor(r() * (method === "POST" ? 320 : 160)),
      at: new Date(AS_OF - mins * 60_000).toISOString(),
      why:
        status === 401
          ? `This key was revoked on Oct 14, but a server at ${ip} is still using it. Update that server with a current key.`
          : status === 422
            ? "The amount was below the minimum for this corridor."
            : status === 429
              ? "Too many requests in a second — the caller should back off and retry."
              : undefined,
    };
    mins += 1 + Math.floor(r() * 6);
    return req;
  });
}

export const REQUEST_LOG: ApiRequest[] = [
  ...requestLog("live", 7, 60),
  ...requestLog("sandbox", 19, 30),
];

/** Last 24 hours, hour by hour, oldest first. */
export const HEALTH: Record<
  Env,
  {
    hourly: number[];
    requests: number;
    errors: number;
    p95: number;
    topError?: string;
  }
> = {
  live: {
    hourly: [
      420, 380, 310, 290, 300, 340, 520, 760, 980, 1120, 1210, 1180, 1090, 1150,
      1240, 1190, 1060, 930, 810, 690, 610, 560, 500, 454,
    ],
    requests: 18_204,
    errors: 71,
    p95: 182,
    topError: "Mostly 401s — a revoked key still in use",
  },
  sandbox: {
    hourly: [
      12, 4, 0, 0, 0, 2, 18, 64, 140, 210, 188, 160, 172, 240, 260, 198, 150,
      96, 40, 22, 14, 8, 30, 52,
    ],
    requests: 2_080,
    errors: 9,
    p95: 240,
  },
};

/** Requests in the last 24h, and where each key was last used from. */
export const KEY_USAGE: Record<string, { requests: number; lastIp: string }> = {
  key_1: { requests: 14_120, lastIp: "52.31.144.61" },
  key_2: { requests: 3_410, lastIp: "34.243.18.92" },
  key_3: { requests: 612, lastIp: "102.89.40.17" },
  key_4: { requests: 62, lastIp: "18.130.77.4" },
  key_5: { requests: 1_740, lastIp: "105.112.20.8" },
  key_6: { requests: 340, lastIp: "35.180.4.19" },
};

export type GoLive = { id: string; label: string; done: boolean; hint: string };
export const GO_LIVE: GoLive[] = [
  {
    id: "key",
    label: "Create a sandbox key",
    done: true,
    hint: "Local development",
  },
  {
    id: "call",
    label: "Make your first call",
    done: true,
    hint: "GET /v1/balances answered 200",
  },
  {
    id: "webhook",
    label: "Receive a webhook",
    done: true,
    hint: "kredete-dev.ngrok.app got transfer.completed",
  },
  {
    id: "verify",
    label: "Verify webhook signatures",
    done: false,
    hint: "Check the Kredete-Signature header on every event",
  },
  {
    id: "allow",
    label: "List your server addresses",
    done: true,
    hint: "3 addresses on the live allowlist",
  },
  {
    id: "live",
    label: "Create a live key",
    done: true,
    hint: "Production backend",
  },
];

export type App = {
  id: string;
  name: string;
  /** The company's site, for its logo. */
  domain: string;
  what: string;
  category: "Accounting" | "Alerts" | "Automation";
  connected?: { since: string; detail: string };
};
export const APPS: App[] = [
  {
    id: "xero",
    domain: "xero.com",
    name: "Xero",
    what: "Sync transactions and categories to your books",
    category: "Accounting",
    connected: {
      since: "Apr 2026",
      detail: "Synced 2 min ago · 1,204 transactions this month",
    },
  },
  {
    id: "qbo",
    domain: "quickbooks.intuit.com",
    name: "QuickBooks",
    what: "Sync transactions and categories to your books",
    category: "Accounting",
  },
  {
    id: "netsuite",
    domain: "netsuite.com",
    name: "NetSuite",
    what: "Post settlements and payouts to your ledger",
    category: "Accounting",
  },
  {
    id: "slack",
    domain: "slack.com",
    name: "Slack",
    what: "Approval requests and failed payouts in a channel",
    category: "Alerts",
    connected: {
      since: "Jul 2026",
      detail: "#finance-alerts · 14 messages this week",
    },
  },
  {
    id: "zapier",
    domain: "zapier.com",
    name: "Zapier",
    what: "Start workflows when money moves",
    category: "Automation",
  },
];

// ——— What each request carried ———

const COUNTERPARTIES = [
  "Meridian Trade Co",
  "Northwind Logistics",
  "Atlas Relief Foundation",
  "Brightpath Studio",
  "Kite & Kettle Ltd",
  "Sable Analytics",
  "Harbor Freight Partners",
];
const PEOPLE = [
  "Amara Nwosu",
  "Chioma Eze",
  "Daniel Okafor",
  "Sarah Chen",
  "Kwame Asante",
];

export type RequestDetail = {
  /** What it did, in a sentence. */
  summary: string;
  /** The few fields worth seeing at a glance. */
  facts: { label: string; value: string; mono?: boolean }[];
  request?: unknown;
  response: unknown;
  /** Where the object it touched lives in the dashboard. */
  link?: { label: string; href: string };
};

function hashOf(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export function requestDetail(r: ApiRequest): RequestDetail {
  const h = hashOf(r.id);
  const pick = <T>(xs: T[], salt = 0) => xs[(h + salt) % xs.length];
  const amount = ((h % 900) + 40) * 25;
  const money = `$${amount.toLocaleString("en-US")}.00`;
  const oid = (p: string) => `${p}_${(h >>> 3).toString(36).slice(0, 10)}`;
  const counterparty = pick(COUNTERPARTIES);
  const created = r.at;

  if (r.status >= 400) {
    const code =
      r.status === 401
        ? "key_revoked"
        : r.status === 429
          ? "rate_limited"
          : "amount_too_small";
    return {
      summary:
        r.status === 401
          ? "Refused — the key it used has been revoked."
          : r.status === 429
            ? "Refused — too many requests in the same second."
            : `Refused — ${money.replace(".00", "")} is below the minimum for this corridor.`,
      facts: [
        { label: "Error", value: code, mono: true },
        { label: "Charged", value: "Nothing — no money moved" },
      ],
      request:
        r.method === "POST"
          ? { amount, currency: "USD", recipient: oid("rcp") }
          : undefined,
      response: {
        error: { status: r.status, code, message: r.why, request_id: r.id },
      },
    };
  }

  switch (r.path) {
    case "/v1/transfers": {
      const id = oid("trf");
      return {
        summary: `Sent ${money} to ${counterparty}.`,
        facts: [
          { label: "Amount", value: money },
          { label: "To", value: counterparty },
          { label: "Status", value: "Pending → settles in ~2 min" },
          { label: "Transfer", value: id, mono: true },
        ],
        request: {
          amount,
          currency: "USD",
          recipient: oid("rcp"),
          source_wallet: "wal_treasury_usd",
          reference: `INV-${(h % 9000) + 1000}`,
        },
        response: {
          id,
          object: "transfer",
          status: "pending",
          amount,
          currency: "USD",
          fee: Math.round(amount * 0.002),
          recipient: { id: oid("rcp"), name: counterparty },
          created,
        },
        link: { label: "Open in Transactions", href: "/transactions" },
      };
    }
    case "/v1/transfers/{id}": {
      const id = oid("trf");
      return {
        summary: `Checked a transfer of ${money} to ${counterparty} — it has settled.`,
        facts: [
          { label: "Transfer", value: id, mono: true },
          { label: "Status", value: "Completed" },
          { label: "Amount", value: money },
        ],
        response: {
          id,
          object: "transfer",
          status: "completed",
          amount,
          currency: "USD",
          completed_at: created,
        },
        link: { label: "Open in Transactions", href: "/transactions" },
      };
    }
    case "/v1/balances": {
      const usd = 32_178_870 - (h % 50_000);
      return {
        summary: `Read balances — $${usd.toLocaleString("en-US")} across 4 currencies.`,
        facts: [
          { label: "USD", value: `$${usd.toLocaleString("en-US")}` },
          { label: "EUR", value: "€4,812,330" },
          { label: "Wallets", value: "6 returned" },
        ],
        response: {
          object: "list",
          data: [
            { currency: "USD", available: usd, pending: 184_200 },
            { currency: "EUR", available: 4_812_330, pending: 0 },
            { currency: "GBP", available: 1_120_904, pending: 12_000 },
            { currency: "USDC", available: 9_404_118, pending: 0 },
          ],
        },
        link: { label: "Open Wallets", href: "/wallets" },
      };
    }
    case "/v1/transactions": {
      const n = 20 + (h % 80);
      return {
        summary: `Listed ${n} transactions from the last 24 hours.`,
        facts: [
          { label: "Returned", value: `${n} transactions` },
          {
            label: "Has more",
            value: h % 2 ? "Yes — next page cursor sent" : "No",
          },
        ],
        response: {
          object: "list",
          has_more: Boolean(h % 2),
          data: [
            {
              id: oid("txn"),
              type: "credit",
              amount,
              currency: "USD",
              counterparty,
            },
            {
              id: `${oid("txn")}2`,
              type: "debit",
              amount: Math.round(amount / 3),
              currency: "USD",
              counterparty: pick(COUNTERPARTIES, 3),
            },
            "…",
          ],
        },
        link: { label: "Open Transactions", href: "/transactions" },
      };
    }
    case "/v1/payment_links": {
      const id = oid("plink");
      return {
        summary: `Created a ${money} payment link for ${counterparty}.`,
        facts: [
          { label: "Amount", value: money },
          { label: "For", value: counterparty },
          {
            label: "Link",
            value: `pay.kredete.com/${id.slice(6, 14)}`,
            mono: true,
          },
        ],
        request: {
          amount,
          currency: "USD",
          customer: oid("cus"),
          description: `Invoice ${(h % 900) + 100}`,
          expires_in_days: 30,
        },
        response: {
          id,
          object: "payment_link",
          url: `https://pay.kredete.com/${id.slice(6, 14)}`,
          status: "active",
          amount,
          currency: "USD",
          created,
        },
        link: { label: "Open Payment links", href: "/payment-links" },
      };
    }
    case "/v1/customers": {
      const name = pick(PEOPLE);
      const id = oid("cus");
      return {
        summary: `Added ${name} as a customer.`,
        facts: [
          { label: "Customer", value: name },
          { label: "Verification", value: "Started — awaiting ID" },
          { label: "ID", value: id, mono: true },
        ],
        request: {
          name,
          email: `${name.split(" ")[0].toLowerCase()}@example.com`,
          country: "NG",
          type: "individual",
        },
        response: {
          id,
          object: "customer",
          name,
          kyc_status: "pending",
          created,
        },
        link: { label: "Open Customers", href: "/customers" },
      };
    }
    default: {
      const n = 3 + (h % 8);
      return {
        summary: `Listed ${n} accounts.`,
        facts: [
          { label: "Returned", value: `${n} accounts` },
          { label: "Active", value: `${n - 1}` },
        ],
        response: {
          object: "list",
          data: [{ id: oid("acct"), currency: "USD", status: "active" }, "…"],
        },
        link: { label: "Open Accounts", href: "/account" },
      };
    }
  }
}
