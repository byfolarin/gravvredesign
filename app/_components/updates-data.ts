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
  image: string;
  href: string;
  cta: string;
  /** Gradient behind the screenshot: two soft stops. */
  glow: [string, string];
};

export const UPDATES: Update[] = [
  {
    id: "u-funnel",
    date: "2026-10-20",
    area: "Card collection",
    title: "See where card payments drop off",
    body: "Collections shows every step from checkout to settlement, and why each payment was lost — click a step to see those payments.",
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
    image: "/updates/checkout.png",
    href: "/payment-links",
    cta: "Customise checkout",
    glow: ["#38bdf8", "#a78bfa"],
  },
];

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export const updateDate = (u: Update) =>
  dateFmt.format(new Date(`${u.date}T00:00:00Z`));
