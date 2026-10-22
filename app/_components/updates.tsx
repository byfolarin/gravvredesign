"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { updateDate, type Update } from "./updates-data";

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
