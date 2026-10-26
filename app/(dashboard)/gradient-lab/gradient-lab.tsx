"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

/** The Gravv green ramp (brand guidelines 04.4), darkest to lightest. */
const RAMP = [
  "#162619",
  "#1E3522",
  "#284C12",
  "#346D11",
  "#4DA01A",
  "#8FFF4B",
  "#A3FF6E",
  "#DDFBA5",
  "#FFFCCC",
];
const DEEP = "#0D1906";
const CREAM = "#FFFCCC";
const LIME = "#8FFF4B";

/** Brand 04.10: two neighbouring ramp tones per column, darker top, brighter base. */
const COLUMNS: [number, number, number, string, string][] = [
  [132, 240, 384, "#346d11", "#8fff4b"],
  [132, 624, 336, "#ddfba5", "#fffccc"],
  [300, 384, 408, "#a3ff6e", "#ddfba5"],
  [300, 792, 168, "#8fff4b", "#a3ff6e"],
  [468, 480, 480, "#a3ff6e", "#fffccc"],
  [636, 240, 720, "#1e3522", "#346d11"],
  [804, 312, 216, "#4da01a", "#a3ff6e"],
  [804, 528, 432, "#162619", "#284c12"],
  [972, 288, 672, "#ddfba5", "#fffccc"],
  [1140, 336, 360, "#a3ff6e", "#ddfba5"],
  [1140, 696, 264, "#8fff4b", "#ddfba5"],
  [1308, 192, 288, "#ddfba5", "#fffccc"],
  [1308, 480, 480, "#8fff4b", "#a3ff6e"],
  [1476, 336, 624, "#a3ff6e", "#fffccc"],
  [1644, 240, 288, "#284c12", "#8fff4b"],
  [1644, 528, 432, "#162619", "#284c12"],
];

/** A dither: solid at one edge, breaking into 8px cells that thin out. */
function dither(cols: number, rows: number, seed = 7) {
  let x = seed;
  const rand = () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
  const cells: [number, number, number][] = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const t = c / (cols - 1);
      const keep = t > 0.78 ? 1 : Math.pow(t / 0.78, 2.2);
      if (rand() < keep) cells.push([c, r, t > 0.78 ? 1 : 0.35 + rand() * 0.5]);
    }
  return cells;
}
const DITHER = dither(48, 30);

const CSS = `
@keyframes gl-drift-a { 0%,100% { transform: translate(-8%, -4%) scale(1); } 50% { transform: translate(10%, 6%) scale(1.15); } }
@keyframes gl-drift-b { 0%,100% { transform: translate(6%, 8%) scale(1.1); } 50% { transform: translate(-10%, -6%) scale(0.95); } }
@keyframes gl-breathe { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
@keyframes gl-sweep { 0% { transform: translateX(-60%) rotate(18deg); } 100% { transform: translateX(160%) rotate(18deg); } }
@keyframes gl-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .gl-anim { animation: none !important; } }
`;

type Tile = {
  n: string;
  name: string;
  /** Where it earns its place in Gravv. */
  fits: string;
  art: ReactNode;
  /** Text tone on the art. */
  ink?: "cream" | "deep";
  /** Keep the line inside the dark part of the art. */
  narrow?: boolean;
};

function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="absolute inset-0"
      style={
        {
          background: DEEP,
          "--x": "50%",
          "--y": "40%",
        } as CSSProperties
      }
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          "--x",
          `${((e.clientX - r.left) / r.width) * 100}%`,
        );
        e.currentTarget.style.setProperty(
          "--y",
          `${((e.clientY - r.top) / r.height) * 100}%`,
        );
      }}
    >
      <div
        className="absolute inset-0 transition-[background] duration-150"
        style={{
          background: `radial-gradient(420px circle at var(--x) var(--y), ${LIME}cc, ${RAMP[4]}66 30%, transparent 62%)`,
        }}
      />
    </div>
  );
}

const TILES: Tile[] = [
  {
    n: "01",
    name: "Bloom",
    fits: "The first moment of something new — an announcement, a welcome, a card arriving.",
    art: (
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(90% 85% at 50% 0%, ${LIME} 0%, ${RAMP[4]}d9 34%, ${RAMP[1]}99 62%, ${DEEP} 100%)`,
        }}
      />
    ),
  },
  {
    n: "02",
    name: "Horizon",
    fits: "The brand rule as a ground: darker at the top, brighter at the base. Empty states, sign-in.",
    art: (
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(140% 70% at 50% 120%, ${LIME} 0%, ${RAMP[3]} 38%, ${DEEP} 72%)`,
        }}
      />
    ),
  },
  {
    n: "03",
    name: "Columns",
    narrow: true,
    fits: "Gravv's signature pattern (04.10). Big brand moments — onboarding, the What's new header.",
    art: (
      <div className="absolute inset-0" style={{ background: DEEP }}>
        {COLUMNS.map(([x, y, h, a, b], k) => (
          <span
            key={k}
            className="absolute"
            style={{
              left: `${(x / 1920) * 100}%`,
              top: `${(y / 1080) * 100}%`,
              width: `${(144 / 1920) * 100}%`,
              height: `${(h / 1080) * 100}%`,
              background: `linear-gradient(to bottom, ${a}, ${b})`,
            }}
          />
        ))}
        <div
          className="absolute inset-y-0 left-0 w-[42%]"
          style={{ background: "rgb(11 22 5 / 0.86)" }}
        />
      </div>
    ),
  },
  {
    n: "04",
    name: "Dissolve",
    narrow: true,
    fits: "Green that breaks into pixels at an edge. A quiet accent on a card or a seam between two surfaces.",
    art: (
      <div className="absolute inset-0" style={{ background: DEEP }}>
        <svg
          viewBox="0 0 384 240"
          preserveAspectRatio="xMaxYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          {DITHER.map(([c, r, o]) => (
            <rect
              key={`${c}-${r}`}
              x={c * 8}
              y={r * 8}
              width={8}
              height={8}
              fill={LIME}
              opacity={o}
            />
          ))}
        </svg>
      </div>
    ),
  },
  {
    n: "05",
    name: "Aurora",
    fits: "Two soft greens drifting slowly. Living backgrounds — a loading wait, the cards intro.",
    art: (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: DEEP }}
      >
        <div
          className="gl-anim absolute -top-1/4 -left-1/4 h-[90%] w-[80%] rounded-full blur-3xl"
          style={{
            background: LIME,
            opacity: 0.55,
            animation: "gl-drift-a 14s ease-in-out infinite",
          }}
        />
        <div
          className="gl-anim absolute -right-1/4 -bottom-1/3 h-[90%] w-[80%] rounded-full blur-3xl"
          style={{
            background: RAMP[4],
            opacity: 0.7,
            animation: "gl-drift-b 17s ease-in-out infinite",
          }}
        />
      </div>
    ),
  },
  {
    n: "06",
    name: "Beam",
    fits: "A single shaft of light sweeping across. Confirming something worked — money landed, access granted.",
    art: (
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ background: DEEP }}
      >
        <div
          className="gl-anim absolute -top-1/2 h-[200%] w-[28%] blur-2xl"
          style={{
            background: `linear-gradient(to right, transparent, ${LIME}aa, ${RAMP[7]}cc, ${LIME}aa, transparent)`,
            animation: "gl-sweep 6s cubic-bezier(.45,0,.25,1) infinite",
          }}
        />
      </div>
    ),
  },
  {
    n: "07",
    name: "Orbit",
    fits: "A ring of green turning around a point. Gravv AI (Orbbit) thinking, a sync in progress.",
    art: (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: DEEP }}
      >
        <div
          className="gl-anim aspect-square w-[58%] rounded-full"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${RAMP[3]} 120deg, ${LIME} 300deg, ${CREAM} 350deg, transparent 360deg)`,
            WebkitMask:
              "radial-gradient(farthest-side, transparent 78%, #000 80%)",
            mask: "radial-gradient(farthest-side, transparent 78%, #000 80%)",
            animation: "gl-spin 6s linear infinite",
          }}
        />
        <div
          className="absolute aspect-square w-[40%] rounded-full blur-2xl"
          style={{ background: `${LIME}33` }}
        />
      </div>
    ),
  },
  {
    n: "08",
    name: "Grain",
    fits: "The bloom with film grain over it — feels printed, less screen-glossy. Marketing, statements, the card art.",
    art: (
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(110% 90% at 20% 10%, ${LIME} 0%, ${RAMP[4]} 30%, ${RAMP[1]} 65%, ${DEEP} 100%)`,
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.35] mix-blend-overlay"
          aria-hidden
        >
          <filter id="gl-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.3" />
          </filter>
          <rect width="100%" height="100%" filter="url(#gl-grain)" />
        </svg>
      </div>
    ),
  },
  {
    n: "09",
    name: "Spotlight",
    fits: "Green follows the pointer. Interactive surfaces — the hover on a plan, a card you can pick. Move over it.",
    art: <Spotlight />,
  },
  {
    n: "10",
    name: "Steps",
    ink: "deep",
    fits: "The ramp as hard bands, no blending — the pixel-era version of a gradient. Data headers, the dot system.",
    art: (
      <div className="absolute inset-0 flex flex-col">
        {[DEEP, ...RAMP.slice(0, 7)].map((c) => (
          <div key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    ),
  },
  {
    n: "11",
    name: "Edge light",
    fits: "Light on the top edge only, like a lit lip. The most restrained — modals, the sidebar card, a selected row.",
    ink: "cream",
    art: (
      <div className="absolute inset-0" style={{ background: DEEP }}>
        <div
          className="absolute inset-x-[8%] top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${LIME}, transparent)`,
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, ${LIME}38, transparent 70%)`,
          }}
        />
      </div>
    ),
  },
  {
    n: "12",
    name: "Pulse",
    fits: "A slow breathing glow under one thing that needs you — waiting for funds, a deadline today.",
    art: (
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: DEEP }}
      >
        <div
          className="gl-anim aspect-square w-[70%] rounded-full blur-2xl"
          style={{
            background: `radial-gradient(circle, ${LIME}aa, ${RAMP[4]}55 45%, transparent 70%)`,
            animation: "gl-breathe 3.2s ease-in-out infinite",
          }}
        />
      </div>
    ),
  },
];

/**
 * Twelve ways to use the Gravv green, all from the brand ramp, no imagery. Each tile carries
 * the same line of type so they can be compared fairly.
 */
export function GradientLab() {
  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <style>{CSS}</style>
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-24">
        <div className="font-mono text-[11px] tracking-[0.12em] text-neutral-500">
          GRAVV · GREEN
        </div>
        <h1 className="mt-2 text-[28px] font-medium tracking-[-0.03em] text-white">
          Gradient lab
        </h1>
        <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-neutral-400">
          Twelve ways to use the green, built only from the brand ramp — no
          pictures. Each one says where it fits, so we can pick a small set and
          keep it serious.
        </p>
        <div className="mt-6 flex h-6 overflow-hidden rounded-full">
          {[DEEP, ...RAMP].map((c) => (
            <span
              key={c}
              className="flex-1"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>

        <div className="mt-10 grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
          {TILES.map((t) => (
            <figure key={t.n}>
              <div
                className="relative isolate aspect-[16/10] overflow-hidden rounded-2xl"
                style={{ background: DEEP }}
              >
                {t.art}
                <div
                  className={`pointer-events-none absolute bottom-5 left-5 ${t.narrow ? "w-[34%]" : "right-5"}`}
                  style={{ color: t.ink === "deep" ? DEEP : CREAM }}
                >
                  <div className="font-mono text-[10.5px] tracking-[0.12em] opacity-70">
                    {t.n} · {t.name.toUpperCase()}
                  </div>
                  <div className="mt-1 text-[20px] leading-tight font-medium tracking-[-0.02em]">
                    The constant in global money
                  </div>
                </div>
              </div>
              <figcaption className="mt-3">
                <div className="text-[14px] font-medium text-white">
                  {t.name}
                </div>
                <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">
                  {t.fits}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
