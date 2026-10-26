"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { UpdateArt } from "./updates";
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
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="content-theme orbit-pop relative w-[560px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_30px_90px_-20px_rgb(0_0_0/0.65)]"
      >
        <div className="relative">
          <UpdateArt key={u.id} u={u} className="aspect-[16/8]" />
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute top-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/65"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-6 pt-5 pb-6">
          <div className="flex items-center justify-between gap-3 text-[12px] text-neutral-500">
            <span>
              <span className="text-[var(--ok-fg)]">New</span> · {u.area} ·{" "}
              {updateDate(u)}
            </span>
            {list.length > 1 && (
              <span className="tabular-nums">
                {i + 1} of {list.length}
              </span>
            )}
          </div>
          <h2
            id="whats-new-title"
            className="mt-2 text-[20px] leading-snug font-medium tracking-[-0.02em] text-white"
          >
            {u.title}
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-neutral-400">
            {u.body}
          </p>

          <div className="mt-6 flex items-center justify-between gap-3">
            <Link
              href="/whats-new"
              onClick={close}
              className="text-[13px] text-neutral-400 hover:text-white"
            >
              See all updates
            </Link>
            <div className="flex items-center gap-2">
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => setI((x) => x - 1)}
                  className="h-9 rounded-full px-3 text-[13px] text-neutral-400 hover:text-white"
                >
                  Back
                </button>
              )}
              <Link
                href={u.href}
                onClick={close}
                className="flex h-9 items-center rounded-full border border-white/12 px-4 text-[13px] text-neutral-200 hover:border-white/30 hover:text-white"
              >
                {u.cta}
              </Link>
              <button
                type="button"
                onClick={last ? close : () => setI((x) => x + 1)}
                className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
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
