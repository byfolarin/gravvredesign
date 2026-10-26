import { accounts } from "@/app/(dashboard)/account/_data";
import { cards } from "@/app/(dashboard)/cards/_data";
import { disputes } from "@/app/(dashboard)/card-collection/disputes/_data";
import { liteAt, TOTAL } from "@/app/(dashboard)/customers/_data";
import { REQUESTS } from "@/app/(dashboard)/manage/approvals/_data";
import { links } from "@/app/(dashboard)/payment-links/_data";
import { recipients } from "@/app/(dashboard)/recipients/_data";
import { transactions } from "@/app/(dashboard)/transactions/_data";
import { navSections } from "../sidebar/nav-config";

export type Group =
  | "Actions"
  | "Pages"
  | "Transactions"
  | "People"
  | "Accounts"
  | "Cards"
  | "Payment links"
  | "Approvals"
  | "Disputes";

/** The chips under the field; Tab moves between them. */
export const SCOPES: { label: string; groups: Group[] | null }[] = [
  { label: "All", groups: null },
  { label: "Transactions", groups: ["Transactions"] },
  { label: "People", groups: ["People"] },
  { label: "Accounts", groups: ["Accounts"] },
  { label: "Cards", groups: ["Cards"] },
  { label: "Payments", groups: ["Payment links", "Approvals", "Disputes"] },
  { label: "Pages & actions", groups: ["Pages", "Actions"] },
];

export type Mark =
  | { kind: "initial"; text: string; seed: string }
  | { kind: "flag"; code: string }
  | { kind: "wallet" }
  | { kind: "icon"; name: IconName };

export type IconName =
  | "send"
  | "request"
  | "move"
  | "convert"
  | "account"
  | "invite"
  | "eye"
  | "theme"
  | "link"
  | "recipient"
  | "page";

export type Item = {
  id: string;
  group: Group;
  title: string;
  sub: string;
  /** Right side of the row: an amount or a short status. */
  meta?: string;
  tone?: "in" | "rose" | "amber";
  mark: Mark;
  href?: string;
  /** Actions that happen in place rather than on a page. */
  run?: "hide-amounts" | "theme-light" | "theme-dark";
  shortcut?: string;
  /** Lowercased words to match against. */
  hay: string;
  /** What the preview pane shows for this item. */
  facts?: [string, string][];
  amount?: number;
};

const usd = (v: number, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
const date = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

const ACTIONS: Item[] = [
  [
    "Send money",
    "Pay a recipient by bank, SWIFT or USDC",
    "/recipients",
    "send",
    "pay transfer payout",
  ],
  [
    "Request a payment",
    "Create a payment link and share it",
    "/payment-links",
    "request",
    "invoice link collect",
  ],
  [
    "Move money between accounts",
    "Between your own Gravv accounts",
    "/account",
    "move",
    "transfer internal",
  ],
  [
    "Convert currency",
    "Get a firm rate on the Trade desk",
    "/trade-desk",
    "convert",
    "fx exchange otc quote",
  ],
  [
    "Open an account",
    "Local bank details in USD, EUR, GBP or NGN",
    "/account",
    "account",
    "new bank iban",
  ],
  [
    "Add a recipient",
    "Save someone you pay",
    "/recipients",
    "recipient",
    "payee beneficiary",
  ],
  [
    "Invite a teammate",
    "Give someone access with a role",
    "/manage/team",
    "invite",
    "member user add",
  ],
].map(([title, sub, href, icon, words]) => ({
  id: `action:${title}`,
  group: "Actions" as const,
  title,
  sub,
  href,
  mark: { kind: "icon" as const, name: icon as IconName },
  hay: `${title} ${sub} ${words}`.toLowerCase(),
}));

const IN_PLACE: Item[] = [
  {
    id: "action:hide",
    group: "Actions",
    title: "Hide amounts",
    sub: "Turn every figure to pixels while you share your screen",
    run: "hide-amounts",
    shortcut: "⇧H",
    mark: { kind: "icon", name: "eye" },
    hay: "hide amounts privacy blur screen share pixel",
  },
  {
    id: "action:light",
    group: "Actions",
    title: "Switch to light theme",
    sub: "Paper white",
    run: "theme-light",
    mark: { kind: "icon", name: "theme" },
    hay: "light theme appearance mode white",
  },
  {
    id: "action:dark",
    group: "Actions",
    title: "Switch to dark theme",
    sub: "Dark",
    run: "theme-dark",
    mark: { kind: "icon", name: "theme" },
    hay: "dark theme appearance mode black night",
  },
];

const PAGES: Item[] = [
  ...navSections.flatMap((s) =>
    s.items.map((l) => ({ label: l.label, href: l.href, section: s.label })),
  ),
  { label: "What's new", href: "/whats-new", section: undefined },
].map((p) => ({
  id: `page:${p.href}`,
  group: "Pages" as const,
  title: p.label,
  sub: p.section ? `${p.section} › ${p.label}` : "Go to page",
  href: p.href,
  mark: { kind: "icon" as const, name: "page" as const },
  hay: `${p.label} ${p.section ?? ""} page go`.toLowerCase(),
}));

let built: Item[] | null = null;

/** Everything searchable, built once on first open. */
export function index(): Item[] {
  if (built) return built;
  const tx: Item[] = transactions.map((t) => {
    const party = t.direction === "Credit" ? t.source : t.destination;
    const wallet = party.kind === "wallet";
    return {
      id: `tx:${t.id}`,
      group: "Transactions",
      title: party.name,
      sub: `${t.type} · ${t.channel} · ${date(t.createdAt)}`,
      meta: `${t.direction === "Credit" ? "+" : "−"}${usd(t.amount)}`,
      tone:
        t.status === "Failed"
          ? "rose"
          : t.direction === "Credit"
            ? "in"
            : undefined,
      mark: wallet
        ? { kind: "wallet" }
        : { kind: "initial", text: party.name[0], seed: party.name },
      href: `/transactions?q=${encodeURIComponent(t.id)}`,
      amount: t.amount,
      hay: `${t.id} ${party.name} ${party.detail} ${t.type} ${t.channel} ${t.customer.name} ${t.status} ${t.hash ?? ""}`.toLowerCase(),
      facts: [
        ["Status", t.status],
        ["Amount", `${t.direction === "Credit" ? "+" : "−"}${usd(t.amount)}`],
        ["Channel", `${t.channel} · ${t.from} → ${t.to}`],
        ["Customer", t.customer.name],
        ["Date", date(t.createdAt)],
        ["ID", t.id],
      ],
    };
  });
  const people: Item[] = [
    ...recipients.map<Item>((r) => ({
      id: `rec:${r.id}`,
      group: "People",
      title: r.name,
      sub: `Recipient · ${r.institution}${r.account ? ` ••${r.account.slice(-4)}` : ""} · ${r.rail}`,
      meta: r.status === "Pending" ? "Verifying" : r.currency,
      tone: r.status === "Pending" ? "amber" : undefined,
      mark: { kind: "initial", text: r.name[0], seed: r.name },
      href: "/recipients",
      hay: `${r.name} ${r.institution} ${r.account ?? ""} ${r.email ?? ""} recipient ${r.country}`.toLowerCase(),
      facts: [
        [
          "Pays to",
          `${r.institution}${r.account ? ` ••${r.account.slice(-4)}` : ""}`,
        ],
        ["Rail", r.rail],
        ["Currency", r.currency],
        ["Country", r.country],
        ["Status", r.status === "Pending" ? "Verifying bank" : "Ready to pay"],
      ],
    })),
    ...Array.from({ length: Math.min(TOTAL, 3000) }, (_, i) =>
      liteAt(i),
    ).map<Item>((c) => ({
      id: `cus:${c.id}`,
      group: "People",
      title: c.name,
      sub: `Customer · ${c.kind} · ${c.email}`,
      meta: c.verification === "Verified" ? undefined : c.verification,
      tone:
        c.verification === "Action needed"
          ? "rose"
          : c.verification === "Pending"
            ? "amber"
            : undefined,
      mark: { kind: "initial", text: c.name[0], seed: c.name },
      href: `/customers`,
      hay: `${c.name} ${c.email} ${c.id} customer ${c.kind}`.toLowerCase(),
      facts: [
        ["Kind", c.kind],
        ["Email", c.email],
        ["Verification", c.verification],
        [
          "Paying",
          c.paying ? "Paid in the last 30 days" : "No payments in 30 days",
        ],
        ["ID", c.id],
      ],
    })),
  ];
  const accts: Item[] = accounts.map((a) => ({
    id: `acct:${a.id}`,
    group: "Accounts",
    title: a.label,
    sub: `${a.customer.name} · ${a.bank} ••${a.accountNumber.slice(-4)}`,
    meta: a.status === "Active" ? undefined : a.status,
    tone: a.status === "Frozen" ? "amber" : undefined,
    mark: { kind: "flag", code: a.currency },
    href: `/account`,
    amount: a.balance,
    hay: `${a.label} ${a.customer.name} ${a.bank} ${a.accountNumber} ${a.currency} ${a.id} account`.toLowerCase(),
    facts: [
      ["Holder", a.customer.name],
      ["Bank", `${a.bank} ••${a.accountNumber.slice(-4)}`],
      ["Currency", a.currency],
      ["Status", a.status],
      ["Opened", date(a.createdAt)],
    ],
  }));
  const cardItems: Item[] = cards.map((c) => ({
    id: `card:${c.id}`,
    group: "Cards",
    title: `${c.holder} ••${c.last4}`,
    sub: `${c.type} card · ${c.funding.label}`,
    meta: c.status === "Active" ? usd(c.spentThisMonth, 0) : c.status,
    tone: c.status === "Frozen" ? "amber" : undefined,
    mark: { kind: "initial", text: c.holder[0], seed: c.holder },
    href: "/cards",
    hay: `${c.holder} ${c.last4} ${c.type} card ${c.customerId}`.toLowerCase(),
    facts: [
      [
        "Spent this month",
        `${usd(c.spentThisMonth, 0)} of ${usd(c.monthlyLimit, 0)}`,
      ],
      ["Status", c.status],
      ["Funded from", c.funding.label],
      ["Type", c.type],
    ],
  }));
  const linkItems: Item[] = links.map((l) => ({
    id: `link:${l.id}`,
    group: "Payment links",
    title: l.name,
    sub: `pay.gravv.xyz/kredete/${l.slug}`,
    meta: l.status,
    tone: l.status === "Paused" ? "amber" : undefined,
    mark: { kind: "icon", name: "link" },
    href: `/payment-links/${l.id}`,
    hay: `${l.name} ${l.slug} ${l.customer?.name ?? ""} ${l.reference ?? ""} link`.toLowerCase(),
    facts: [
      ["Status", l.status],
      [
        "Price",
        l.amount === null
          ? "Customer chooses"
          : `${l.amount.toLocaleString("en-US")} ${l.currency}`,
      ],
      [
        "Payments",
        String(l.payments.filter((p) => p.status === "Paid").length),
      ],
      ["Created", date(l.createdAt)],
    ],
  }));
  const approvals: Item[] = REQUESTS.filter((r) => r.state === "pending").map(
    (r) => ({
      id: `apr:${r.id}`,
      group: "Approvals",
      title: `${r.amount.toLocaleString("en-US")} ${r.currency} to ${r.recipient.name}`,
      sub: `Requested by ${r.requestedBy} · waiting for approval`,
      meta: "Waiting",
      tone: "amber",
      mark: {
        kind: "initial",
        text: r.recipient.name[0],
        seed: r.recipient.name,
      },
      href: "/manage/approvals",
      amount: r.amount,
      hay: `${r.id} ${r.recipient.name} ${r.requestedBy} ${r.currency} approval`.toLowerCase(),
      facts: [
        ["Amount", `${r.amount.toLocaleString("en-US")} ${r.currency}`],
        ["To", r.recipient.name],
        ["From", r.from],
        ["Requested by", r.requestedBy],
        ["Approvals", `${r.decisions.length} of ${r.needed}`],
      ],
    }),
  );
  const disputeItems: Item[] = disputes.map((d) => ({
    id: `dsp:${d.id}`,
    group: "Disputes",
    title: `${d.payment.customer.name} · ${usd(d.amount)}`,
    sub: `Dispute · ${d.status}`,
    meta: d.status,
    tone: d.status === "Needs response" ? "rose" : undefined,
    mark: {
      kind: "initial",
      text: d.payment.customer.name[0],
      seed: d.payment.customer.name,
    },
    href: "/card-collection/disputes",
    amount: d.amount,
    hay: `${d.id} ${d.payment.customer.name} ${d.payment.id} dispute chargeback ${d.status}`.toLowerCase(),
    facts: [
      ["Status", d.status],
      ["Amount", usd(d.amount)],
      ["Customer", d.payment.customer.name],
      ["Respond by", date(d.dueAt)],
    ],
  }));
  built = [
    ...ACTIONS,
    ...IN_PLACE,
    ...PAGES,
    ...tx,
    ...people,
    ...accts,
    ...cardItems,
    ...linkItems,
    ...approvals,
    ...disputeItems,
  ];
  return built;
}

/** "450", "$450", "1.2k" — a money search. */
export function parseAmount(q: string): number | null {
  const m = q
    .trim()
    .toLowerCase()
    .match(/^\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
}

export const QUICK = [...ACTIONS.slice(0, 5), IN_PLACE[0]];
