/**
 * Gravv product updates — one list feeds the Overview "What's new", the sidebar "New" card,
 * on-page notices and the What's new page. Plain data (no "use client"), so server pages can
 * read it too. Images are real screenshots of the product.
 */
export type Update = {
  id: string;
  date: string;
  area: string;
  title: string;
  body: string;
  /** One line for the on-page notice. */
  line: string;
  image: string;
  href: string;
  cta: string;
  /** Gradient behind the screenshot: two soft stops. */
  glow: [string, string];
};

export const UPDATES: Update[] = [
  {
    id: "u-candles",
    date: "2026-10-22",
    area: "Trade desk",
    title: "Candles and your own dates on every rate",
    body: "Open any rate to read it as candles — 1H, 1D, 7D, 30D, or pick your own days on the calendar. Hover a candle for its open, high, low and close.",
    line: "Read each rate as candles, from the last hour to 30 days, or pick your own days.",
    image: "/updates/candles.png",
    href: "/trade-desk",
    cta: "Open Trade desk",
    glow: ["#00ffb4", "#38bdf8"],
  },
  {
    id: "u-approval",
    date: "2026-10-21",
    area: "Approvals",
    title: "Everything you need before you approve",
    body: "Each request shows what to check first, the balance before and after, the invoice, and what you've paid this recipient before.",
    line: "Each request shows the checks, the balance after, the invoice and your history with them.",
    image: "/updates/approval.png",
    href: "/manage/approvals",
    cta: "Open Approvals",
    glow: ["#f59e0b", "#a78bfa"],
  },
  {
    id: "u-hide",
    date: "2026-10-18",
    area: "Everywhere",
    title: "Hide amounts when you share your screen",
    body: "Press ⇧H or the eye in the top bar and every figure in Gravv turns to pixels. Press it again to bring them back.",
    line: "Press ⇧H or the eye in the top bar, and every figure turns to pixels.",
    image: "/updates/hide-amounts.png",
    href: "/transactions",
    cta: "Hide amounts",
    glow: ["#a78bfa", "#38bdf8"],
  },
  {
    id: "u-plans",
    date: "2026-10-16",
    area: "Billing",
    title: "Every plan priced on your own activity",
    body: "Billing works out what each plan would cost you this cycle at today's pace, and when moving up starts paying for itself.",
    line: "See what each plan would cost you this cycle, at today's pace.",
    image: "/updates/plans.png",
    href: "/billing",
    cta: "Compare plans",
    glow: ["#00ffb4", "#f59e0b"],
  },
  {
    id: "u-disputes",
    date: "2026-10-12",
    area: "Card collection",
    title: "Answer disputes with the evidence already attached",
    body: "When a customer disputes a card payment, Gravv attaches the payment record, 3-D Secure and checks. You add your side and send it.",
    line: "Gravv attaches the payment record and 3-D Secure; you add your side.",
    image: "/updates/disputes.png",
    href: "/card-collection/disputes",
    cta: "Open Disputes",
    glow: ["#f43f5e", "#a78bfa"],
  },
  {
    id: "u-recipients",
    date: "2026-10-10",
    area: "Recipients",
    title: "Recipient problems, in plain words",
    body: "See which recipients can't be paid and why — a closed account, a duplicate, details to check — with the fix one click away.",
    line: "See who can't be paid and why, with the fix one click away.",
    image: "/updates/recipients.png",
    href: "/recipients",
    cta: "Open Recipients",
    glow: ["#38bdf8", "#00ffb4"],
  },
  {
    id: "u-funnel",
    date: "2026-10-20",
    area: "Card collection",
    title: "See where card payments drop off",
    body: "Collections shows every step from checkout to settlement, and why each payment was lost — click a step to see those payments.",
    line: "Every step from checkout to settlement, and why each payment was lost.",
    image: "/updates/funnel.png",
    href: "/card-collection/collections",
    cta: "Open Collections",
    glow: ["#a78bfa", "#00ffb4"],
  },
  {
    id: "u-desk",
    date: "2026-10-14",
    area: "Trade desk",
    title: "Ask the desk for bigger trades",
    body: "Over your daily limit? Ask the desk for a firm quote on the spot, or request a higher limit — both from the quote ticket.",
    line: "Over your daily limit? Get a firm quote from the desk, or ask for a higher limit.",
    image: "/updates/trade-desk.png",
    href: "/trade-desk",
    cta: "Open Trade desk",
    glow: ["#f59e0b", "#f43f5e"],
  },
  {
    id: "u-checkout",
    date: "2026-10-08",
    area: "Payment links",
    title: "Your logo and colours on checkout",
    body: "Customers now pay on a checkout with your name, logo, colour and button text — card, bank transfer or USDC.",
    line: "Customers pay on a checkout with your name, logo and colour.",
    image: "/updates/checkout.png",
    href: "/payment-links",
    cta: "Customise checkout",
    glow: ["#38bdf8", "#a78bfa"],
  },
];

// Newest first, wherever the list is shown.
UPDATES.sort((a, b) => b.date.localeCompare(a.date));

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export const updateDate = (u: Update) =>
  dateFmt.format(new Date(`${u.date}T00:00:00Z`));
