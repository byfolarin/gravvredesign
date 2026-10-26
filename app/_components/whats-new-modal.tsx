"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { UpdateArt } from "./updates";
import { UPDATES, type Update } from "./updates-data";

const SEEN_KEY = "gravv-whatsnew-seen";
export const SHOW_WHATS_NEW = "gravv-show-whats-new";
/** The modal never shows more than this many at once; the page has the rest. */
const MAX = 3;

const newest = [...UPDATES].sort((a, b) => b.date.localeCompare(a.date));

function readSeen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
function markSeen(ids: string[]) {
  try {
    const all = new Set([...readSeen(), ...ids]);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...all]));
  } catch {}
}

/** Show the modal again from anywhere (the What's new page's "Replay"). */
export const replayWhatsNew = () => {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {}
  window.dispatchEvent(new Event(SHOW_WHATS_NEW));
};

/**
 * What's new, once per release: shortly after you land, the updates you haven't seen
 * (newest first, up to three) in a centred modal — the screen it changed on its gradient,
 * when and where, what it does, and the one action to try it. Several step with "2 of 3"
 * and arrows; × or "Got it" puts them all away, "See all updates" opens the page.
 * From Manus / Lovable / HubSpot announcement modals.
 */
export function WhatsNewModal() {
  const [list, setList] = useState<Update[]>([]);
  const [i, setI] = useState(0);
  const [armed, setArmed] = useState(false);
  const [opened, setOpened] = useState(0);

  const show = useCallback(() => {
    const seen = readSeen();
    const unseen = newest.filter((u) => !seen.has(u.id)).slice(0, MAX);
    setI(0);
    setArmed(false);
    setOpened(performance.now());
    setList(unseen);
  }, []);

  useEffect(() => {
    // A moment after landing, so it doesn't fight the page for attention.
    const t = setTimeout(show, 1200);
    window.addEventListener(SHOW_WHATS_NEW, show);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SHOW_WHATS_NEW, show);
    };
  }, [show]);

  const close = useCallback(() => {
    markSeen(list.map((u) => u.id));
    setList([]);
  }, [list]);

  useEffect(() => {
    if (!list.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((x) => Math.min(list.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [list, close]);

  if (!list.length) return null;
  const u = list[i];
  const last = i === list.length - 1;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      {/* Only a click that starts on the backdrop closes — not the click that opened it */}
      <div
        aria-hidden
        onPointerDown={(e) => {
          // Ignore the double-click that opened it: only arm after half a second.
          if (e.target === e.currentTarget && e.timeStamp - opened > 500)
            setArmed(true);
        }}
        onClick={() => armed && close()}
        className="scrim-in absolute inset-0 bg-black/60"
      />
      {/* Brand surface in every theme: deep green ground, cream type, lime as the one active colour */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="orbit-pop relative w-[600px] max-w-full overflow-hidden rounded-2xl bg-[#0D1906] text-[#FFFCCC] shadow-[0_30px_90px_-20px_rgb(0_0_0/0.7)]"
      >
        <div className="relative">
          <UpdateArt key={u.id} u={u} className="aspect-[16/8]" />
          <PixelSeam seed={u.id} />
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-[#0B1605]/70 text-[#FFFCCC] backdrop-blur hover:bg-[#0B1605]"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-7 pt-6 pb-7">
          <div className="flex items-center justify-between gap-3 font-mono text-[11px] tracking-[0.08em] text-[#FFFCCC]/55 uppercase">
            <span>What&apos;s new in Gravv</span>
            {list.length > 1 && (
              <span className="tabular-nums">
                {String(i + 1).padStart(2, "0")} /{" "}
                {String(list.length).padStart(2, "0")}
              </span>
            )}
          </div>
          <h2
            id="whats-new-title"
            className="mt-3 text-[22px] leading-[1.2] font-medium tracking-[-0.025em]"
          >
            {u.title}
          </h2>
          <p className="mt-3 text-[14px] leading-[1.55] font-medium text-[#FFFCCC]/72">
            {u.body}
          </p>

          <div className="mt-7 flex items-center justify-between gap-3">
            <Link
              href="/whats-new"
              onClick={close}
              className="font-mono text-[11px] tracking-[0.08em] text-[#FFFCCC]/60 uppercase hover:text-[#FFFCCC]"
            >
              All updates →
            </Link>
            <div className="flex items-center gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI((x) => x - 1)}
                  className="h-9 rounded-full px-3 text-[13px] font-medium text-[#FFFCCC]/65 hover:text-[#FFFCCC]"
                >
                  Back
                </button>
              )}
              <Link
                href={u.href}
                onClick={close}
                className="flex h-9 items-center rounded-full border border-[#FFFCCC]/25 px-4 text-[13px] font-medium hover:border-[#FFFCCC]/60"
              >
                {u.cta}
              </Link>
              <button
                type="button"
                onClick={last ? close : () => setI((x) => x + 1)}
                className="h-9 rounded-full bg-[#8FFF4B] px-4 text-[13px] font-medium text-[#0B1605] hover:bg-[#A3FF6E]"
              >
                {last ? "Got it" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** On the What's new page: see the announcement again, as if these were new. */
export function ReplayWhatsNew() {
  return (
    <button
      type="button"
      onClick={replayWhatsNew}
      className="h-8 rounded-full border border-white/12 px-3.5 text-[12.5px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
    >
      Show the announcement
    </button>
  );
}

/**
 * The image's bottom edge breaking into the deep green body in 5px pixels — solid at the
 * seam, thinning out upward (the brand's dot dissolve).
 */
/** Which 8px cells are filled: every cell on the seam row, thinning out upward. */
function seamCells(seed: string, COLS: number, ROWS: number) {
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
  const cells: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) {
    // 0 at the top of the band, 1 at the seam
    const t = r / (ROWS - 1);
    const keep = r === ROWS - 1 ? 1 : Math.pow(t, 2) * 0.7;
    for (let c = 0; c < COLS; c++) if (rand() < keep) cells.push([c, r]);
  }
  return cells;
}

function PixelSeam({ seed }: { seed: string }) {
  const COLS = 120;
  const ROWS = 4;
  const cells = seamCells(seed, COLS, ROWS);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${COLS * 5} ${ROWS * 5}`}
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-5 w-full"
    >
      {cells.map(([c, r]) => (
        <rect
          key={`${c}-${r}`}
          x={c * 5}
          y={r * 5}
          width={5}
          height={5}
          fill="#0D1906"
        />
      ))}
    </svg>
  );
}
