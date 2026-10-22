/**
 * Gravv's two soft colour treatments, for moments rather than working surfaces:
 *
 *   PixelField — solid colour at the right edge that dithers into pixels and fades out.
 *   wash()     — a soft radial tint from one corner, for cards whose state means something.
 *
 * Colour keeps its job: mint = money in / good, blue = in progress, amber = needs you.
 * One of these per card, never behind numbers you have to read closely.
 */

const CELL = 8,
  GAP = 0;

/**
 * A dither, not a scatter: the last columns are solid, then the colour breaks into pixels
 * that thin out to nothing — the pixels themselves do the fading.
 */
function pixelCells(seed: string, solid: number, COLS: number, ROWS: number) {
  let x = [...seed].reduce(
    (h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619),
    2166136261,
  );
  const rand = () => {
    x =
      Math.imul(x ^ (x >>> 15), 2246822507) ^
      Math.imul(x ^ (x >>> 13), 3266489909);
    return ((x >>> 0) % 1000) / 1000;
  };
  const edge = 1 - solid;
  const cells: { c: number; r: number; o: number }[] = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const t = c / (COLS - 1); // 0 at the left of the field, 1 at the edge
      const keep = t > edge ? 1 : Math.pow(t / edge, 1.7);
      if (rand() < keep)
        cells.push({ c, r, o: t > edge ? 0.22 : 0.12 + rand() * 0.14 });
    }
  return cells;
}

export function PixelField({
  seed,
  color = "var(--brand)",
  className = "inset-y-0 right-0 h-full w-1/4",
  solid = 0.28,
  strength = 1,
  cols = 38,
  rows = 10,
}: {
  /** Same seed, same pattern. */
  seed: string;
  color?: string;
  /** Position + size of the field inside a `relative isolate` parent. */
  className?: string;
  /** Share of the field that is solid colour at the edge. */
  solid?: number;
  /** Multiplies every pixel's opacity. */
  strength?: number;
  /** Grid size: match the box's shape so pixels stay about 8px. */
  cols?: number;
  rows?: number;
}) {
  const cells = pixelCells(seed, solid, cols, rows);
  const W = cols * (CELL + GAP),
    H = rows * (CELL + GAP);
  return (
    // "slice" keeps the pixels square whatever the box.
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMaxYMid slice"
      className={`pointer-events-none absolute -z-10 ${className}`}
      style={{
        maskImage: "linear-gradient(to left, #000 85%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to left, #000 85%, transparent 100%)",
      }}
    >
      {cells.map(({ c, r, o }) => (
        <rect
          key={`${c}-${r}`}
          x={c * (CELL + GAP)}
          y={r * (CELL + GAP)}
          width={CELL}
          height={CELL}
          fill={color}
          opacity={(o * strength).toFixed(3)}
        />
      ))}
    </svg>
  );
}

export type WashTone = "mint" | "blue" | "amber";
const WASH: Record<WashTone, string> = {
  mint: "var(--brand)",
  blue: "#60a5fa",
  amber: "#f59e0b",
};

/** Soft tint from a corner: `background` for a card whose state means something. */
export function wash(
  tone: WashTone,
  at = "100% 0%",
  strength = 14,
): React.CSSProperties {
  return {
    backgroundImage: `radial-gradient(90% 120% at ${at}, color-mix(in oklab, ${WASH[tone]} ${strength}%, transparent), transparent 70%)`,
  };
}
