"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { UPDATES, updateDate, type Update } from "./updates-data";

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

  const show = useCallback(() => {
    const seen = readSeen();
    const unseen = newest.filter((u) => !seen.has(u.id)).slice(0, MAX);
    setI(0);
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
      <div
        aria-hidden
        onClick={close}
        className="scrim-in absolute inset-0 bg-black/60"
      />
      {/* Brand surface in every theme: deep green ground, cream type, lime as the one active colour */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="orbit-pop relative w-[600px] max-w-full overflow-hidden rounded-[6px] bg-[#0D1906] text-[#FFFCCC] shadow-[0_30px_90px_-20px_rgb(0_0_0/0.7)]"
      >
        {/* Art: the gradient columns + dot dissolve, the area in mono, the screen it changed */}
        <div className="relative aspect-[16/9] overflow-hidden bg-[#0D1906]">
          <BrandColumns />
          {/* eslint-disable-next-line @next/next/no-img-element -- brand texture from the Gravv guidelines */}
          <img
            src="/brand/dot-dissolve.svg"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute inset-y-0 left-0 w-[40%] bg-[rgba(11,22,5,0.86)]" />
          <div className="absolute top-0 left-0 bg-[#FFFCCC] px-2 py-1 font-mono text-[12px] font-medium text-[#0B1605]">
            NEW
          </div>
          <div className="absolute top-[18%] left-[5%] w-[32%] font-mono text-[22px] leading-[1.15] font-medium tracking-[-0.02em]">
            {u.area}
          </div>
          <div className="absolute bottom-[9%] left-[5%] font-mono text-[10.5px] tracking-[0.08em] text-[#FFFCCC]/55 uppercase">
            {updateDate(u)}
          </div>
          {/* The screen it changed, as a card object */}
          <div className="absolute top-[16%] left-[44%] w-[62%] overflow-hidden rounded-t-[4px] bg-[#FFFCCC] p-1 pb-0 shadow-[0_18px_50px_-14px_rgb(0_0_0/0.6)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local product screenshots */}
            <img
              key={u.id}
              src={u.image}
              alt=""
              className="block w-full rounded-t-[2px]"
            />
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-[4px] bg-[#0B1605]/70 text-[#FFFCCC] backdrop-blur hover:bg-[#0B1605]"
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
            className="mt-3 font-mono text-[22px] leading-[1.2] font-medium tracking-[-0.02em]"
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
                  className="h-9 rounded-[4px] px-3 text-[13px] font-medium text-[#FFFCCC]/65 hover:text-[#FFFCCC]"
                >
                  Back
                </button>
              )}
              <Link
                href={u.href}
                onClick={close}
                className="flex h-9 items-center rounded-[4px] border border-[#FFFCCC]/25 px-4 text-[13px] font-medium hover:border-[#FFFCCC]/60"
              >
                {u.cta}
              </Link>
              <button
                type="button"
                onClick={last ? close : () => setI((x) => x + 1)}
                className="h-9 rounded-[4px] bg-[#8FFF4B] px-4 text-[13px] font-medium text-[#0B1605] hover:bg-[#A3FF6E]"
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

/**
 * The Gravv gradient columns (guidelines 04.10 / 07.3): two neighbouring ramp tones per
 * column, darker at the top and brighter at the base, on the 1920×1080 grid.
 */
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

function BrandColumns() {
  return (
    <div aria-hidden className="absolute inset-0">
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
    </div>
  );
}

/** On the What's new page: see the announcement again, as if these were new. */
export function ReplayWhatsNew() {
  return (
    <button
      type="button"
      onClick={replayWhatsNew}
      className="h-8 rounded-[4px] border border-white/12 px-3.5 text-[12.5px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
    >
      Show the announcement
    </button>
  );
}
