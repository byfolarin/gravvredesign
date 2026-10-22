/**
 * The inbox, seeded from the same stories the pages tell.
 *
 *   needs   — something only you can move forward. Carries what you need to decide, and the
 *             action, done in place (Approve, Retry, Send reminder) or on its page (Respond).
 *   activity — what happened. One sentence, the name or amount that matters in **bold**.
 *
 * `tone` is the colour's job: rose went wrong, amber waiting on you, mint money in / done.
 */
export type Tone = "rose" | "amber" | "mint" | "blue" | "grey";
export type Icon =
  | "approval"
  | "returned"
  | "dispute"
  | "settled"
  | "arrived"
  | "account"
  | "card"
  | "security"
  | "webhook"
  | "billing"
  | "comment";

export type Action =
  /** Done right here; `done` is what the row says afterwards (with Undo). */
  | { label: string; done: string }
  /** Goes to the page where it's done. */
  | { label: string; href: string };

export type Needs = {
  id: string;
  minsAgo: number;
  tone: Tone;
  icon: Icon;
  /** Their photo instead of an icon. */
  person?: string;
  /** Sentence with **bold** parts. */
  text: string;
  /** What you need to decide, in a few words each. Flags (`!`) read in the tone colour. */
  facts: { text: string; flag?: boolean }[];
  primary: Action;
  secondary?: Action;
  /** More of the same behind this one. */
  more?: { text: string; href: string };
};

export type Activity = {
  id: string;
  minsAgo: number;
  tone: Tone;
  icon: Icon;
  person?: string;
  text: string;
  /** A quote or one detail, shown under the sentence. */
  quote?: string;
  href: string;
  unread: boolean;
};

export const NEEDS: Needs[] = [
  {
    id: "n-approve",
    minsAgo: 38,
    tone: "amber",
    icon: "approval",
    person: "Tolu Adeyemi",
    text: "**Tolu Adeyemi** asked you to approve **$72,500.00** to Meridian Trade Co",
    facts: [
      { text: "Wire · today" },
      { text: "Matches invoice MTC-1182" },
      { text: "Bank details changed 2d ago", flag: true },
    ],
    primary: {
      label: "Approve",
      done: "You approved $72,500.00 to Meridian Trade Co",
    },
    secondary: { label: "Review", href: "/manage/approvals" },
    more: { text: "38 more waiting on you", href: "/manage/approvals" },
  },
  {
    id: "n-webhook",
    minsAgo: 41,
    tone: "rose",
    icon: "webhook",
    text: "**api.kredete.com/hooks/gravv** stopped accepting events",
    facts: [
      { text: "14 failed in the last hour", flag: true },
      { text: "HTTP 503" },
      { text: "Gravv retries for 3 days" },
    ],
    primary: {
      label: "Retry now",
      done: "Retrying 14 events — you'll hear if they fail again",
    },
    secondary: { label: "Open", href: "/manage/configure" },
  },
  {
    id: "n-dispute",
    minsAgo: 60 * 3,
    tone: "amber",
    icon: "dispute",
    person: "Chioma Eze",
    text: "**Chioma Eze** disputed a card payment of **12.35 USDC**",
    facts: [
      { text: "Fraud — card not present" },
      { text: "3-D Secure passed" },
      { text: "Respond in 2 days", flag: true },
    ],
    primary: { label: "Respond", href: "/card-collection/disputes" },
  },
  {
    id: "n-returned",
    minsAgo: 60 * 26,
    tone: "rose",
    icon: "returned",
    person: "Marcus Reid",
    text: "**$2,400.00** to **Marcus Reid** came back",
    facts: [
      { text: "Stearns Bank: account closed", flag: true },
      { text: "Money is back in Operating · USD" },
    ],
    primary: { label: "Update details", href: "/recipients" },
  },
  {
    id: "n-2fa",
    minsAgo: 60 * 52,
    tone: "amber",
    icon: "security",
    person: "Grace Mensah",
    text: "**Grace Mensah** can't approve payments yet",
    facts: [
      { text: "Two-step is off", flag: true },
      { text: "Finance · joined Sep 2024" },
    ],
    primary: {
      label: "Send reminder",
      done: "Reminder sent to grace@kredete.com",
    },
  },
];

export const ACTIVITY: Activity[] = [
  {
    id: "a-comment",
    minsAgo: 23,
    tone: "grey",
    icon: "comment",
    person: "Ikenna Obi",
    text: "**Ikenna Obi** commented on $72,500.00 to Meridian Trade Co",
    quote:
      "Bank details changed on Monday, so I called Meridian on the number from our contract — they confirmed.",
    href: "/manage/approvals",
    unread: true,
  },
  {
    id: "a-settled",
    minsAgo: 64,
    tone: "mint",
    icon: "settled",
    text: "**OTC-2291** settled — **₦403,332,500.00** in Providus Bank ••4412",
    href: "/trade-desk",
    unread: true,
  },
  {
    id: "a-arrived",
    minsAgo: 60 * 5,
    tone: "mint",
    icon: "arrived",
    text: "**Northwind Logistics** sent **$48,000.00** to Operating · USD",
    href: "/transactions",
    unread: false,
  },
  {
    id: "a-account",
    minsAgo: 60 * 30,
    tone: "mint",
    icon: "account",
    text: "Your **EUR account** is active — Banking Circle issued the IBAN",
    href: "/account",
    unread: false,
  },
  {
    id: "a-card",
    minsAgo: 60 * 44,
    tone: "blue",
    icon: "card",
    text: "Card **••4242** issued to Ava Walker through the API",
    href: "/cards",
    unread: false,
  },
  {
    id: "a-billing",
    minsAgo: 60 * 24 * 4,
    tone: "grey",
    icon: "billing",
    text: "Your cycle renews **Nov 3** — $385.76 in fees so far",
    href: "/billing",
    unread: false,
  },
];

export function agoWords(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
