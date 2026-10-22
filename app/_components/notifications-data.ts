/**
 * What happened on the account — things that need you, or money that moved. Seeded from the
 * same stories the pages tell, so every notification lands somewhere real.
 * `tone` is the colour's job: rose went wrong, amber needs you, mint money in / done, blue news.
 */
export type Notification = {
  id: string;
  /** Minutes before the prototype's "now". */
  minsAgo: number;
  tone: "rose" | "amber" | "mint" | "blue" | "grey";
  icon:
    | "approval"
    | "returned"
    | "dispute"
    | "settled"
    | "arrived"
    | "account"
    | "card"
    | "security"
    | "webhook"
    | "billing";
  /** Shows their photo instead of an icon. */
  person?: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
};

export const NOTIFICATIONS: Notification[] = [
  {
    id: "n-approvals",
    minsAgo: 12,
    tone: "amber",
    icon: "approval",
    title: "39 payments are waiting on you",
    body: "Meridian Trade Co $72,500 and 38 more — about $944k in total.",
    href: "/manage/approvals",
    unread: true,
  },
  {
    id: "n-comment",
    minsAgo: 23,
    tone: "grey",
    icon: "approval",
    person: "Ikenna Obi",
    title: "Ikenna Obi commented on a request",
    body: "“Bank details changed on Monday, so I called Meridian on the number from our contract…”",
    href: "/manage/approvals",
    unread: true,
  },
  {
    id: "n-webhook",
    minsAgo: 41,
    tone: "rose",
    icon: "webhook",
    title: "A webhook endpoint is failing",
    body: "api.kredete.com/hooks/gravv — 14 deliveries failed in the last hour. Gravv keeps retrying.",
    href: "/manage/configure",
    unread: true,
  },
  {
    id: "n-settled",
    minsAgo: 64,
    tone: "mint",
    icon: "settled",
    title: "OTC-2291 settled",
    body: "₦403,332,500.00 landed in Providus Bank ••4412.",
    href: "/trade-desk",
    unread: true,
  },
  {
    id: "n-dispute",
    minsAgo: 60 * 3,
    tone: "amber",
    icon: "dispute",
    title: "Respond to a dispute in 2 days",
    body: "Chioma Eze · Fraud — card not present · 12.35 USDC. Answer by Oct 22 or the customer keeps it.",
    href: "/card-collection/disputes",
    unread: false,
  },
  {
    id: "n-arrived",
    minsAgo: 60 * 5,
    tone: "mint",
    icon: "arrived",
    title: "$48,000.00 arrived",
    body: "Wire from Northwind Logistics to Operating · USD.",
    href: "/transactions",
    unread: false,
  },
  {
    id: "n-returned",
    minsAgo: 60 * 26,
    tone: "rose",
    icon: "returned",
    title: "A payout to Marcus Reid came back",
    body: "Stearns Bank says the account is closed. Update their bank details to pay them again.",
    href: "/recipients",
    unread: false,
  },
  {
    id: "n-account",
    minsAgo: 60 * 30,
    tone: "mint",
    icon: "account",
    title: "Your EUR account is active",
    body: "Banking Circle issued the IBAN for Lena · Savings.",
    href: "/account",
    unread: false,
  },
  {
    id: "n-card",
    minsAgo: 60 * 44,
    tone: "blue",
    icon: "card",
    title: "A card was issued through the API",
    body: "Card ••4242 for Ava Walker, from your production key.",
    href: "/cards",
    unread: false,
  },
  {
    id: "n-security",
    minsAgo: 60 * 52,
    tone: "amber",
    icon: "security",
    person: "Grace Mensah",
    title: "Grace Mensah hasn't turned on two-step",
    body: "She can't approve payments or trade until she does.",
    href: "/manage/team",
    unread: false,
  },
  {
    id: "n-billing",
    minsAgo: 60 * 24 * 4,
    tone: "grey",
    icon: "billing",
    title: "Your cycle renews Nov 3",
    body: "Starter · $385.76 in fees so far this cycle.",
    href: "/billing",
    unread: false,
  },
];

export function agoWords(mins: number) {
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}
