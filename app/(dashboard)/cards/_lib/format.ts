export const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    v,
  );

export const compactMoney = (v: number) =>
  v >= 1_000_000
    ? `$${Number((v / 1_000_000).toFixed(1))}M`
    : v >= 1000
      ? `$${Number((v / 1000).toFixed(1))}k`
      : money(v);

export const units = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const fullDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Usage bar fill. Near-limit cards are distinguished by a bolder amount, not the bar. */
export function usageTone(ratio: number) {
  return ratio >= 0.85 ? "bg-brand" : "bg-brand";
}
