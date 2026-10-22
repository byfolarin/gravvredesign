/**
 * Soft colour with a job. Each tone is a faint tint plus readable text, tuned for both
 * themes (the light theme darkens the *-300 text colours in globals.css).
 *
 *   identity  — a person or business keeps one tone everywhere (toneFor)
 *   kind      — what a row is: funding, payout, conversion, card, crypto
 *   status    — every state its own hue
 *
 * Never decorative: if a colour doesn't tell you something, leave it grey.
 */
export type Tone =
  | "mint"
  | "blue"
  | "violet"
  | "amber"
  | "sky"
  | "rose"
  | "teal"
  | "orange"
  | "grey";

export const TONE: Record<Tone, { bg: string; fg: string }> = {
  mint: { bg: "bg-emerald-400/12", fg: "text-emerald-300" },
  blue: { bg: "bg-blue-400/12", fg: "text-blue-300" },
  violet: { bg: "bg-violet-400/12", fg: "text-violet-300" },
  amber: { bg: "bg-amber-400/12", fg: "text-amber-300" },
  sky: { bg: "bg-sky-400/12", fg: "text-sky-300" },
  rose: { bg: "bg-rose-400/12", fg: "text-rose-300" },
  teal: { bg: "bg-teal-400/12", fg: "text-teal-300" },
  orange: { bg: "bg-orange-400/12", fg: "text-orange-300" },
  grey: { bg: "bg-white/[0.07]", fg: "text-neutral-300" },
};

const IDENTITY: Tone[] = [
  "blue",
  "violet",
  "teal",
  "amber",
  "sky",
  "orange",
  "rose",
  "mint",
];

/** The same name always gets the same tone, on every page. */
export function toneFor(name: string): Tone {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return IDENTITY[h % IDENTITY.length];
}

export const toneClass = (t: Tone) => `${TONE[t].bg} ${TONE[t].fg}`;
