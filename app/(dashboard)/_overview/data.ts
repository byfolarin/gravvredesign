/**
 * Money moving through the whole business — all wallets and accounts — one day at a time,
 * for two years, so any range can be compared with the one before it. Placeholder data,
 * seeded so it never changes between renders.
 */

export const AS_OF = Date.UTC(2026, 9, 21);
export const DAY = 24 * 60 * 60 * 1000;

export const SOURCES = [
  { id: "wells", label: "Wells Fargo", href: "/transactions" },
  { id: "chase", label: "Chase", href: "/transactions" },
  { id: "boa", label: "Bank of America", href: "/transactions" },
  { id: "wallets", label: "External wallets", href: "/wallets" },
  {
    id: "cards",
    label: "Card collections",
    href: "/card-collection/collections",
  },
] as const;
export const OUTS = [
  { id: "payouts", label: "Payouts", href: "/recipients" },
  { id: "offramps", label: "Offramps", href: "/transactions" },
  { id: "trades", label: "Trade desk", href: "/trade-desk" },
  { id: "cards", label: "Card spend", href: "/cards" },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];
export type OutId = (typeof OUTS)[number]["id"];
export type Day = {
  t: number;
  in: Record<SourceId, number>;
  out: Record<OutId, number>;
};

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}
const rand = seeded(2026);

// Typical day, and how each line grows over the two years (1 → 1+growth).
const IN_BASE: Record<SourceId, [number, number]> = {
  wells: [14_000, 0.9],
  chase: [6_500, 0.4],
  boa: [4_200, 0.2],
  wallets: [5_800, 1.4],
  cards: [1_300, 2.2],
};
const OUT_BASE: Record<OutId, [number, number]> = {
  payouts: [11_500, 1.1],
  offramps: [7_200, 0.5],
  trades: [5_400, 0.8],
  cards: [1_900, 0.6],
};

const LENGTH = 730;
export const days: Day[] = Array.from({ length: LENGTH }, (_, i) => {
  const t = AS_OF - (LENGTH - 1 - i) * DAY;
  const progress = i / LENGTH;
  const weekday = new Date(t).getUTCDay();
  const weekend = weekday === 0 || weekday === 6 ? 0.35 : 1;
  const day = (base: number, growth: number, spikes = 0.04) => {
    const noise = 0.55 + rand() * 0.9;
    const spike = rand() < spikes ? 2.5 + rand() * 3 : 1;
    return Math.round(base * (1 + growth * progress) * weekend * noise * spike);
  };
  const inn = Object.fromEntries(
    SOURCES.map((s) => [s.id, day(...IN_BASE[s.id])]),
  ) as Record<SourceId, number>;
  const out = Object.fromEntries(
    OUTS.map((o) => [o.id, day(...OUT_BASE[o.id], 0.06)]),
  ) as Record<OutId, number>;
  return { t, in: inn, out };
});

export type Range = "30D" | "90D" | "12M";
export const RANGES: {
  id: Range;
  days: number;
  bucket: "day" | "week" | "month";
}[] = [
  { id: "30D", days: 30, bucket: "day" },
  { id: "90D", days: 90, bucket: "week" },
  { id: "12M", days: 365, bucket: "month" },
];

export const sum = <K extends string>(xs: Record<K, number>) =>
  Object.values<number>(xs).reduce((s, v) => s + v, 0);

/** Totals by line for days in [from, to). */
export function totals(from: number, to: number) {
  const inn = Object.fromEntries(SOURCES.map((s) => [s.id, 0])) as Record<
    SourceId,
    number
  >;
  const out = Object.fromEntries(OUTS.map((o) => [o.id, 0])) as Record<
    OutId,
    number
  >;
  for (const d of days)
    if (d.t >= from && d.t < to) {
      for (const s of SOURCES) inn[s.id] += d.in[s.id];
      for (const o of OUTS) out[o.id] += d.out[o.id];
    }
  return { in: inn, out, inTotal: sum(inn), outTotal: sum(out) };
}

export type Bucket = { start: number; end: number; in: number; out: number };

/** The range cut into days, weeks or calendar months, oldest first. */
export function buckets(range: Range): Bucket[] {
  const r = RANGES.find((x) => x.id === range)!;
  const end = AS_OF + DAY;
  const from = end - r.days * DAY;
  const out: Bucket[] = [];
  if (r.bucket === "month") {
    const d = new Date(end - DAY);
    for (let k = 11; k >= 0; k--) {
      const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1);
      const stop = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k + 1, 1);
      out.push({ start, end: Math.min(stop, end), in: 0, out: 0 });
    }
  } else {
    const size = r.bucket === "day" ? DAY : 7 * DAY;
    for (let s = from; s < end; s += size)
      out.push({ start: s, end: Math.min(s + size, end), in: 0, out: 0 });
  }
  for (const b of out) {
    const t = totals(b.start, b.end);
    b.in = t.inTotal;
    b.out = t.outTotal;
  }
  return out;
}
