"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { UPDATES, updateDate, type Update } from "./updates-data";

export { UPDATES, updateDate, type Update } from "./updates-data";

/**
 * Gravv product updates — one list feeds the Overview "What's new", the sidebar "New" card,
 * on-page notices and the What's new page. Images are real screenshots of the product,
 * set on a soft gradient (the one place gradients belong: news, not working surfaces).
 */
/** Dismissals per place, remembered in this browser; storage can fail and the page still works. */
export function useDismissed(place: string) {
  const key = `gravv-updates-dismissed-${place}`;
  const [gone, setGone] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
        if (Array.isArray(saved)) setGone(new Set(saved));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [key]);
  const dismiss = (id: string) =>
    setGone((s) => {
      const next = new Set(s).add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  return { gone, dismiss };
}

/** The screenshot, framed on its gradient. */
export function UpdateArt({
  u,
  className = "",
}: {
  u: Update;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, ${u.glow[0]}38, transparent 60%), radial-gradient(110% 90% at 100% 100%, ${u.glow[1]}3d, transparent 62%), var(--surface-2)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local product screenshots */}
      <img
        src={u.image}
        alt=""
        loading="lazy"
        className="absolute top-[14%] left-[8%] w-[92%] max-w-none rounded-tl-lg border-t border-l border-black/10 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
      />
    </div>
  );
}

/** An update as a card: image, what it is, and where to try it. */
export function UpdateCard({
  u,
  onDismiss,
}: {
  u: Update;
  onDismiss?: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/8 bg-surface">
      <UpdateArt u={u} className="aspect-[16/8]" />
      <div className="p-5">
        <div className="text-[12px] text-neutral-500">
          {u.area} · {updateDate(u)}
        </div>
        <h3 className="mt-1.5 text-[15px] font-medium text-white">{u.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
          {u.body}
        </p>
        <Link
          href={u.href}
          className="mt-4 inline-flex items-center gap-1 text-[13px] text-white hover:underline"
        >
          {u.cta}
          <ArrowRight size={13} strokeWidth={1.75} />
        </Link>
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={`Dismiss "${u.title}"`}
          onClick={onDismiss}
          className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
    </article>
  );
}

/**
 * The on-page "New" strip: screenshot, one line, one action, dismiss. Each page shows the update
 * that matters there; `onAction` does it on the spot, otherwise the button goes to `href`.
 */
export function UpdateNotice({
  id,
  place,
  cta,
  onAction,
  className = "mt-8",
}: {
  id: string;
  /** Dismissals are remembered per place. */
  place: string;
  cta?: string;
  onAction?: () => void;
  className?: string;
}) {
  const { gone, dismiss } = useDismissed(place);
  const u = UPDATES.find((x) => x.id === id);
  if (!u || gone.has(u.id)) return null;
  const button =
    "flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200";
  return (
    <div
      className={`relative isolate flex items-center gap-4 overflow-hidden rounded-xl border border-white/8 bg-surface pr-4 ${className}`}
    >
      <PixelField seed={u.id} />
      <UpdateArt u={u} className="h-[72px] w-[124px] shrink-0 max-sm:hidden" />
      <div className="min-w-0 flex-1 py-3 max-sm:pl-4">
        <div className="text-[13px] font-medium text-white">
          New · {u.title}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-neutral-400">
          {u.line}
        </div>
      </div>
      {onAction ? (
        <button type="button" onClick={onAction} className={button}>
          {cta ?? u.cta}
        </button>
      ) : (
        <Link href={u.href} className={button}>
          {cta ?? u.cta}
        </Link>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(u.id)}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-neutral-500 shadow-[0_0_0_1px_var(--color-white)/0.08] hover:text-white"
      >
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}

/** Flip "hide amounts" the same way ⇧H does (the top bar owns the state). */
export function toggleHideAmounts() {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "H", shiftKey: true, bubbles: true }),
  );
}

/**
 * Brand-mint pixels anchored to the right edge, thinning out and fading to nothing before the
 * text. Seeded by the update id, so each notice keeps its own pattern.
 */
const CELL = 6,
  GAP = 2,
  COLS = 46,
  ROWS = 12;

/** Which cells are lit, and how brightly: denser and brighter towards the right edge. */
function pixelCells(seed: string) {
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
  const cells: { c: number; r: number; o: number }[] = [];
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const toRight = c / (COLS - 1); // 0 at the left of the field, 1 at the edge
      if (rand() < toRight * toRight * 0.42)
        cells.push({ c, r, o: 0.1 + rand() * 0.42 * toRight });
    }
  return cells;
}

function PixelField({ seed }: { seed: string }) {
  const cells = pixelCells(seed);
  const W = COLS * (CELL + GAP),
    H = ROWS * (CELL + GAP);
  return (
    <svg
      aria-hidden
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="pointer-events-none absolute top-1/2 right-0 -z-10 -translate-y-1/2"
      style={{
        maskImage: "linear-gradient(to left, #000 15%, transparent 95%)",
        WebkitMaskImage: "linear-gradient(to left, #000 15%, transparent 95%)",
      }}
    >
      {cells.map(({ c, r, o }) => (
        <rect
          key={`${c}-${r}`}
          x={c * (CELL + GAP)}
          y={r * (CELL + GAP)}
          width={CELL}
          height={CELL}
          rx={1}
          fill="var(--brand)"
          opacity={o.toFixed(2)}
        />
      ))}
    </svg>
  );
}
