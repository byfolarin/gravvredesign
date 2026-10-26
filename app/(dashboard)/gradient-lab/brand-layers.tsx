"use client";

import { useEffect, useState, type ReactNode } from "react";

const DEEP = "#0D1906";
const FOREST = "#17260F";
const CREAM = "#FFFCCC";
const LIME = "#8FFF4B";
const ORANGE = "#FF9F43";

/** The art box, in grid cells: 48 × 30 cells of 8px. */
const COLS = 48;
const ROWS = 30;
const CELL = 8;
const DOT = 2.6;
/** Round so server and browser print identical attributes. */
const q = (v: number) => Math.round(v * 100) / 100;

type Lit = { c: number; r: number; o?: number; tone?: string; s?: number };

/** The dot field (brand 06): square dots on the grid, flat cream, a few lit lime. */
function Field({
  lit = [],
  faint = 0.1,
  hide,
}: {
  lit?: Lit[];
  faint?: number;
  /** Cells to leave empty (where a formation sits). */
  hide?: (c: number, r: number) => boolean;
}) {
  // Drawn in the browser only: thousands of computed positions don't need SSR.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  const key = new Map(lit.map((l) => [`${l.c},${l.r}`, l]));
  const dots: ReactNode[] = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const l = key.get(`${c},${r}`);
      if (!l && hide?.(c, r)) continue;
      const s = l?.s ?? DOT;
      dots.push(
        <rect
          key={`${c}-${r}`}
          x={q(c * CELL + (CELL - s) / 2)}
          y={q(r * CELL + (CELL - s) / 2)}
          width={s}
          height={s}
          fill={l ? (l.tone ?? LIME) : CREAM}
          opacity={q(l ? (l.o ?? 1) : faint)}
        />,
      );
    }
  return (
    <svg
      viewBox={`0 0 ${COLS * CELL} ${ROWS * CELL}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      {dots}
    </svg>
  );
}

/** The data card (brand 08.4): one glass card, a lexicon state, a title, one line of proof. */
function DataCard({
  state,
  title,
  proof,
  processing = false,
  className = "",
}: {
  state: string;
  title: string;
  proof: string;
  processing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`absolute border px-4 py-3.5 backdrop-blur-sm ${className}`}
      style={{
        background: "rgb(255 252 204 / 0.07)",
        borderColor: "rgb(255 252 204 / 0.2)",
        color: CREAM,
      }}
    >
      <span
        className="inline-block px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em]"
        style={{ background: processing ? ORANGE : LIME, color: DEEP }}
      >
        {state}
      </span>
      <div className="mt-2 text-[15px] leading-tight font-medium">{title}</div>
      <div className="mt-1 text-[12px]" style={{ opacity: 0.6 }}>
        {proof}
      </div>
    </div>
  );
}

// ——— Formations: business objects built from dots ———

/** Ground: one place on the field lights up — something just happened there. */
const ground: Lit[] = (() => {
  const out: Lit[] = [];
  const cx = 33,
    cy = 12;
  for (let c = cx - 5; c <= cx + 5; c++)
    for (let r = cy - 4; r <= cy + 4; r++) {
      const d = Math.hypot((c - cx) / 1.2, r - cy);
      if (d <= 4.6)
        out.push({ c, r, o: Math.max(0.25, 1 - d / 4.6), s: d < 1.5 ? 4 : 3 });
    }
  return out;
})();

/** Path: a run of dots rising to the right, the head lit — money on its way. */
const path: Lit[] = (() => {
  const out: Lit[] = [];
  const pts = [
    [4, 24],
    [10, 24],
    [14, 21],
    [20, 21],
    [24, 17],
    [30, 17],
    [34, 12],
    [40, 12],
    [44, 7],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    const [c0, r0] = pts[i],
      [c1, r1] = pts[i + 1];
    const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let k = 0; k <= n; k++) {
      const c = Math.round(c0 + ((c1 - c0) * k) / n),
        r = Math.round(r0 + ((r1 - r0) * k) / n);
      const t = c / 44;
      out.push({
        c,
        r,
        tone: t > 0.85 ? LIME : CREAM,
        o: t > 0.85 ? 1 : 0.35 + t * 0.6,
        s: 3.2,
      });
    }
  }
  out.push({ c: 44, r: 7, s: 5 });
  return out;
})();

/** Deposit: a mountain of dots by column — the balance as a shape, its top row lit. */
const deposit: Lit[] = (() => {
  const out: Lit[] = [];
  for (let c = 2; c < COLS - 2; c++) {
    const h = Math.round(
      6 +
        8 * Math.sin(c / 6) ** 2 +
        6 * Math.sin(c / 11 + 1) ** 2 +
        (c > 30 ? (c - 30) * 0.45 : 0),
    );
    for (let k = 0; k < h; k++)
      out.push({
        c,
        r: ROWS - 3 - k,
        tone: k === h - 1 ? LIME : CREAM,
        o: k === h - 1 ? 1 : 0.55,
        s: 2.8,
      });
  }
  return out;
})();

/** Corridor: two places joined by an arc of lime — NGN to USD. */
const corridor: Lit[] = (() => {
  const out: Lit[] = [];
  const blob = (cx: number, cy: number) => {
    for (let c = cx - 4; c <= cx + 4; c++)
      for (let r = cy - 4; r <= cy + 4; r++)
        if (Math.hypot(c - cx, r - cy) <= 4.2)
          out.push({ c, r, o: 0.6, tone: CREAM, s: 3 });
  };
  blob(9, 19);
  blob(39, 19);
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    const c = Math.round(9 + 30 * t),
      r = Math.round(19 - Math.sin(t * Math.PI) * 13);
    out.push({ c, r, s: 3.4, o: 0.4 + 0.6 * Math.sin(t * Math.PI) });
  }
  return out;
})();

/** Stack: three blocks of dots stepping up, the newest lit. */
const stack: Lit[] = (() => {
  const out: Lit[] = [];
  const blocks: [number, number, number, boolean][] = [
    [6, 8, 8, false],
    [18, 8, 13, false],
    [30, 8, 19, true],
  ];
  for (const [c0, w, h, lit] of blocks)
    for (let c = c0; c < c0 + w; c++)
      for (let k = 0; k < h; k++)
        out.push({
          c,
          r: ROWS - 4 - k,
          tone: lit ? LIME : CREAM,
          o: lit ? 0.9 : 0.45,
          s: 3,
        });
  return out;
})();

type Layer = {
  n: string;
  name: string;
  how: string;
  art: ReactNode;
};

const LAYERS: Layer[] = [
  {
    n: "A",
    name: "Ground + bloom",
    how: "The dot field over the bloom; one place lights up where the event happened. The card names it.",
    art: (
      <>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 90% at 70% 35%, rgb(77 160 26 / 0.55), transparent 65%), ${DEEP}`,
          }}
        />
        <Field lit={ground} />
        <DataCard
          state="SETTLED"
          title="Payment received"
          proof="$72,500 · Meridian Trade Co"
          className="bottom-5 left-5"
        />
      </>
    ),
  },
  {
    n: "B",
    name: "Path + horizon",
    how: "A run of dots climbing to the right, the head lit lime: money on its way. Horizon light under it.",
    art: (
      <>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 60% at 50% 120%, rgb(143 255 75 / 0.45), transparent 60%), ${DEEP}`,
          }}
        />
        <Field lit={path} faint={0.07} />
        <DataCard
          state="IN TRANSIT"
          processing
          title="Payout on its way"
          proof="Lands in about 2 minutes"
          className="top-5 left-5"
        />
      </>
    ),
  },
  {
    n: "C",
    name: "Deposit",
    how: "The balance as a mountain of dots by column, the top row lit. A chart that's on-brand.",
    art: (
      <>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${DEEP} 30%, ${FOREST})`,
          }}
        />
        <Field lit={deposit} faint={0.06} />
        <div className="absolute top-5 left-5" style={{ color: CREAM }}>
          <div
            className="font-mono text-[10px] tracking-[0.12em]"
            style={{ opacity: 0.6 }}
          >
            BALANCE · 90D
          </div>
          <div className="mt-1 text-[30px] leading-none font-medium tracking-[-0.03em]">
            +6.6%
          </div>
        </div>
      </>
    ),
  },
  {
    n: "D",
    name: "Corridor",
    how: "Two places joined by an arc of lime — the corridor Gravv moves money along.",
    art: (
      <>
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(60% 70% at 50% 30%, rgb(52 109 17 / 0.6), transparent 70%), ${DEEP}`,
          }}
        />
        <Field lit={corridor} faint={0.06} />
        <div
          className="absolute bottom-4 left-[10%] font-mono text-[10px] tracking-[0.1em]"
          style={{ color: CREAM, opacity: 0.7 }}
        >
          NGN
        </div>
        <div
          className="absolute right-[10%] bottom-4 font-mono text-[10px] tracking-[0.1em]"
          style={{ color: CREAM, opacity: 0.7 }}
        >
          USD
        </div>
        <DataCard
          state="LIVE"
          title="₦1,611.87"
          proof="USDC → NGN · held 30s"
          className="top-5 right-5"
        />
      </>
    ),
  },
  {
    n: "E",
    name: "Stack + columns",
    how: "Blocks of dots stepping up, the newest lit, over a ghost of the gradient columns. Growth without a chart.",
    art: (
      <>
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, ${DEEP}, ${DEEP} 40%, #1E3522)`,
          }}
        />
        <div
          className="absolute top-[18%] right-[6%] h-[70%] w-[9%] opacity-30"
          style={{ background: "linear-gradient(to bottom, #346d11, #8fff4b)" }}
        />
        <Field lit={stack} faint={0.06} />
        <DataCard
          state="NEW"
          title="3 accounts opened"
          proof="This week · Lead Bank"
          className="top-5 left-5"
        />
      </>
    ),
  },
  {
    n: "F",
    name: "Edge light + grid",
    how: "The quietest: a lit top lip and the bare dot grid, one dot lime. For everyday surfaces.",
    art: (
      <>
        <div className="absolute inset-0" style={{ background: DEEP }} />
        <div
          className="absolute inset-x-0 top-0 h-1/2"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, rgb(143 255 75 / 0.22), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-x-[8%] top-0 h-px"
          style={{
            background: `linear-gradient(to right, transparent, ${LIME}, transparent)`,
          }}
        />
        <Field lit={[{ c: 24, r: 15, s: 5 }]} faint={0.08} />
      </>
    ),
  },
];

/**
 * The brand on the green: the dot system (06), its formations, and the data card (08.4),
 * layered over the gradients — what makes the forest feel like Gravv.
 */
export function BrandLayers() {
  return (
    <section className="mt-12">
      <div className="font-mono text-[11px] tracking-[0.12em] text-neutral-500">
        MAKE IT POP · THE DOT SYSTEM ON THE GREEN
      </div>
      <h2 className="mt-2 text-[20px] font-medium tracking-[-0.02em] text-white">
        Brand layers
      </h2>
      <p className="mt-1.5 max-w-[640px] text-[13.5px] leading-relaxed text-neutral-400">
        The guidelines say it: the dot field is the core, the columns are the
        same field up close, and one glass data card tells you what happened.
        Put those on the forest green and it stops being a gradient — it becomes
        Gravv.
      </p>
      <div className="mt-8 grid gap-x-6 gap-y-10 md:grid-cols-2 xl:grid-cols-3">
        {LAYERS.map((l) => (
          <figure key={l.n}>
            <div
              className="relative isolate aspect-[16/10] overflow-hidden rounded-2xl"
              style={{ background: DEEP }}
            >
              {l.art}
            </div>
            <figcaption className="mt-3">
              <div className="text-[14px] font-medium text-white">
                <span className="font-mono text-neutral-500">{l.n} · </span>
                {l.name}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-500">
                {l.how}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
