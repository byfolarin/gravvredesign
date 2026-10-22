"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronUp, Layers, X } from "lucide-react";
import { openInbox } from "./inbox-events";
import { PixelField } from "./pixel-field";
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

const CARD_H = 74; // screenshot 72 + border
const GAP = 8;
const PEEK = 7;
/** On a page: its own update first, then the newest others still showing — at most this many. */
const MAX_STACK = 3;

/**
 * The on-page "New" strip. One update shows as a single card; more stack behind it, peeking
 * out underneath. Click the stack to fan them out, "Show less" to fold them back. The stack
 * symbol on the front card opens every update on the platform in a side sheet.
 * `onAction` (page-specific action) applies to the page's own update; the others link.
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
  const [open, setOpen] = useState(false);
  const lead = UPDATES.find((x) => x.id === id);
  const list = [
    ...(lead && !gone.has(lead.id) ? [lead] : []),
    ...UPDATES.filter((u) => u.id !== id && !gone.has(u.id)),
  ].slice(0, MAX_STACK);
  const n = list.length;
  const fanned = open && n > 1;
  if (!n) return null;

  const height = fanned
    ? n * CARD_H + (n - 1) * GAP
    : CARD_H + PEEK * Math.min(n - 1, 2);

  return (
    <div className={className}>
      <div
        className={`relative transition-[height] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${!fanned && n > 1 ? "cursor-pointer" : ""}`}
        style={{ height }}
        onClick={(e) => {
          if (fanned || n < 2) return;
          if ((e.target as HTMLElement).closest("button, a")) return;
          setOpen(true);
        }}
      >
        {list.map((u, i) => {
          const back = !fanned && i > 0;
          const depth = Math.min(i, 2);
          return (
            <div
              key={u.id}
              className="absolute inset-x-0 top-0 transition-[transform,opacity] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{
                zIndex: n - i,
                transformOrigin: "bottom center",
                transform: fanned
                  ? `translateY(${i * (CARD_H + GAP)}px)`
                  : `translateY(${depth * PEEK}px) scale(${1 - depth * 0.035})`,
              }}
              inert={back}
            >
              <NoticeCard
                u={u}
                hidden={back}
                cta={u.id === id ? cta : undefined}
                onAction={u.id === id ? onAction : undefined}
                onDismiss={() => {
                  dismiss(u.id);
                  if (n <= 2) setOpen(false);
                }}
                count={i === 0 ? n : 0}
                onAll={() => openInbox("promotions")}
              />
            </div>
          );
        })}
      </div>
      {fanned && (
        <div className="orbit-pop mt-2.5 flex items-center justify-between text-[12px] text-neutral-500">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center gap-1 hover:text-white"
          >
            <ChevronUp size={13} strokeWidth={1.75} />
            Show less
          </button>
          <button
            type="button"
            onClick={() => openInbox("promotions")}
            className="flex items-center gap-1 hover:text-white"
          >
            All updates
            <ArrowRight size={12} strokeWidth={1.75} />
          </button>
        </div>
      )}
    </div>
  );
}

function NoticeCard({
  u,
  hidden,
  cta,
  onAction,
  onDismiss,
  count,
  onAll,
}: {
  u: Update;
  /** A card behind the front one: shape only, no content. */
  hidden: boolean;
  cta?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Non-zero on the front card, which carries the all-updates symbol. */
  count: number;
  onAll: () => void;
}) {
  const button =
    "flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200";
  return (
    <div
      className={`relative isolate flex h-[74px] items-center gap-4 overflow-hidden rounded-xl border border-white/8 bg-surface pr-4 ${
        hidden ? "shadow-[0_2px_6px_-2px_rgb(0_0_0/0.12)]" : ""
      }`}
    >
      <div
        className={`contents transition-opacity duration-200 ${hidden ? "[&>*]:opacity-0" : ""}`}
      >
        <PixelField seed={u.id} />
        <UpdateArt
          u={u}
          className="h-[72px] w-[124px] shrink-0 max-sm:hidden"
        />
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
        {count > 0 && (
          <button
            type="button"
            aria-label={`All updates (${UPDATES.length})`}
            title="All updates"
            onClick={onAll}
            className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-surface px-2 text-[12px] text-neutral-400 tabular-nums shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-white"
          >
            <Layers size={13} strokeWidth={1.75} />
            {UPDATES.length}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-neutral-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-white"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

/** Flip "hide amounts" the same way ⇧H does (the top bar owns the state). */
export function toggleHideAmounts() {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "H", shiftKey: true, bubbles: true }),
  );
}
