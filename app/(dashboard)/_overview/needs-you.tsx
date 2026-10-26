"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { compact, needs, plural, type Need } from "./widgets";

const TODAY = "2026-10-20";
const DONE_KEY = "gravv-needs-done";

/** One light green for every decision's art (owner's call), soft at two corners. */
const MINT: [string, string] = ["#00ffb4", "#7dd3a8"];

/** Each decision's page, as a real screenshot on the soft gradient — the product-updates look. */
const ART: Record<
  string,
  { image: string; glow: [string, string]; area: string }
> = {
  disputes: {
    image: "/updates/disputes.png",
    glow: MINT,
    area: "Disputes",
  },
  stuck: {
    image: "/updates/funnel.png",
    glow: MINT,
    area: "Collections",
  },
  approvals: {
    image: "/updates/approval.png",
    glow: MINT,
    area: "Approvals",
  },
  desk: {
    image: "/updates/trade-desk.png",
    glow: MINT,
    area: "Trade desk",
  },
  cards: {
    image: "/updates/cards.png",
    glow: MINT,
    area: "Cards",
  },
};

function NeedArt({ k, className = "" }: { k: string; className?: string }) {
  const a = ART[k];
  if (!a) return <div className={`bg-surface-2 ${className}`} />;
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 0% 0%, ${a.glow[0]}38, transparent 60%), radial-gradient(110% 90% at 100% 100%, ${a.glow[1]}3d, transparent 62%), var(--surface-2)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local product screenshots */}
      <img
        src={a.image}
        alt=""
        loading="lazy"
        // Scaled to the frame and read from the top (header + key figures), never a stray corner.
        className="absolute top-[13%] left-[9%] h-auto w-[82%] max-w-none rounded-t-md border border-b-0 border-black/10 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.35)]"
      />
    </div>
  );
}

/** Decisions acted on today (their action was clicked), for the ring. */
function useDone() {
  const [done, setDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? "null");
        if (v?.day === TODAY && Array.isArray(v.keys)) setDone(new Set(v.keys));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return {
    done,
    mark: (k: string) => {
      const next = new Set([...done, k]);
      setDone(next);
      try {
        localStorage.setItem(
          DONE_KEY,
          JSON.stringify({ day: TODAY, keys: [...next] }),
        );
      } catch {}
    },
  };
}

function Ring({ value, size = 18 }: { value: number; size?: number }) {
  const r = (size - 3) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgb(255 255 255 / 0.12)"
        strokeWidth={2.5}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={`${Math.max(0.001, value) * c} ${c}`}
        className="transition-[stroke-dasharray] duration-500"
      />
    </svg>
  );
}

function Mark({ n, done }: { n: Need; done: boolean }) {
  return done ? (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="7" cy="7" r="6" fill="var(--brand)" />
      <path
        d="M4.2 7.2l1.8 1.8 3.8-4"
        fill="none"
        stroke="#04301c"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-hidden
      className={`shrink-0 ${n.urgent ? "text-rose-300" : "text-neutral-500"}`}
    >
      <circle
        cx="7"
        cy="7"
        r="5.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="1.6 2"
      />
    </svg>
  );
}

/**
 * Needs you lives in the sidebar on every page, as a checklist (from a "Getting started"
 * pattern): a ring for what you've cleared today and one row per decision. Clicking opens
 * the Needs you drawer — laid out like the Inbox's Promotions tab: the picked decision
 * large with its page's screenshot on a soft gradient, the rest as thumbnail rows.
 */
export function NeedsSidebar() {
  const all = needs();
  const { done, mark } = useDone();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [top, setTop] = useState(0);
  if (!all.length) return null;
  const cleared = all.filter((n) => done.has(n.key)).length;
  const h = hover === null ? null : all[hover];
  return (
    <>
      <div
        className="relative mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
        onMouseLeave={() => setHover(null)}
      >
        <Ring value={cleared / all.length} />
        <div className="mt-2.5 flex items-baseline justify-between">
          <span className="text-[13px] font-medium text-white">Needs you</span>
          <span className="text-[11.5px] text-neutral-500 tabular-nums">
            {cleared}/{all.length}
          </span>
        </div>
        <ul className="mt-2 space-y-0.5">
          {all.map((n, i) => {
            const isDone = done.has(n.key);
            return (
              <li
                key={n.key}
                onMouseEnter={(e) => {
                  setHover(i);
                  setTop(e.currentTarget.offsetTop);
                }}
              >
                <Link
                  href={n.href}
                  onClick={() => mark(n.key)}
                  onFocus={() => setHover(i)}
                  className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12.5px] transition-colors ${hover === i ? "bg-white/[0.07] text-white" : isDone ? "text-neutral-600" : "text-neutral-300"}`}
                >
                  <Mark n={n} done={isDone} />
                  <span
                    className={`min-w-0 flex-1 truncate ${isDone ? "line-through" : ""}`}
                  >
                    {n.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            setHover(null);
            setOpen(true);
          }}
          className="mt-2 px-1.5 text-[12px] text-neutral-400 hover:text-white"
        >
          View all
        </button>

        {/* The hovered decision beside the sidebar: its page on a gradient, then the action */}
        {h && hover !== null && (
          <div
            className="orbit-pop absolute left-full z-50 ml-4 w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.6)]"
            style={{ top: Math.max(-160, top - 110) }}
            onMouseEnter={() => setHover(hover)}
          >
            <NeedArt k={h.key} className="h-[150px]" />
            <div className="px-4 pt-3.5 pb-4">
              <div className="text-[11.5px] text-neutral-500">
                {ART[h.key]?.area} ·{" "}
                <span className={h.urgent ? "text-rose-300" : "text-amber-200"}>
                  {h.when}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-white">
                  {h.title}
                </span>
                {h.stake !== undefined && (
                  <span className="amount shrink-0 text-[13px] text-neutral-300 tabular-nums">
                    {compact(h.stake)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
                {h.detail}
              </p>
              <Link
                href={h.href}
                onClick={() => mark(h.key)}
                className="mt-3.5 inline-flex h-8 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
              >
                {h.action}
              </Link>
            </div>
          </div>
        )}
      </div>
      {open && (
        <NeedsDrawer
          lead={all[0].key}
          done={done}
          onAct={mark}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** The drawer, in the content's own theme (portalled into the content panel). */
function NeedsDrawer({
  lead,
  done,
  onAct,
  onClose,
}: {
  lead: string;
  done: Set<string>;
  onAct: (k: string) => void;
  onClose: () => void;
}) {
  const all = needs();
  const [picked, onPick] = useState(lead);
  const [target, setTarget] = useState<Element | null>(null);
  useEffect(() => {
    const t = setTimeout(
      () =>
        setTarget(document.querySelector(".content-theme") ?? document.body),
      0,
    );
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const first = all.find((n) => n.key === picked) ?? all[0];
  const rest = all.filter((n) => n.key !== first.key);
  const open = all.filter((n) => !done.has(n.key));
  const total = open.reduce((s, n) => s + (n.stake ?? 0), 0);
  if (!target) return null;

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Needs you"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-1">
          <div>
            <h2 className="text-[17px] font-medium text-white">Needs you</h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              <span className="amount text-neutral-200">{compact(total)}</span>{" "}
              waiting on {plural(open.length, "decision")}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-3">
          {/* The picked decision, large — like the newest update in Promotions */}
          <Link
            href={first.href}
            onClick={() => {
              onAct(first.key);
              onClose();
            }}
            className="group block overflow-hidden rounded-xl ring-1 ring-white/8"
          >
            <NeedArt k={first.key} className="aspect-[16/8]" />
            <div className="px-4 py-3.5">
              <div className="text-[11.5px] text-neutral-500">
                {ART[first.key]?.area} ·{" "}
                <span
                  className={first.urgent ? "text-rose-300" : "text-amber-200"}
                >
                  {first.when}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span
                  className={`text-[14px] font-medium text-white ${done.has(first.key) ? "line-through opacity-60" : ""}`}
                >
                  {first.title}
                </span>
                {first.stake !== undefined && (
                  <span className="amount shrink-0 text-[13px] text-neutral-300 tabular-nums">
                    {compact(first.stake)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
                {first.detail}
              </p>
              <span className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] text-white group-hover:underline">
                {first.action}
                <ArrowRight size={12} strokeWidth={1.75} />
              </span>
            </div>
          </Link>

          {/* The rest as thumbnail rows; picking one brings it to the top */}
          <ul className="mt-2">
            {rest.map((n) => (
              <li key={n.key}>
                <button
                  type="button"
                  onClick={() => onPick(n.key)}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <NeedArt
                    k={n.key}
                    className="h-[44px] w-[72px] shrink-0 rounded-md ring-1 ring-white/8"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] text-white ${done.has(n.key) ? "line-through opacity-60" : ""}`}
                    >
                      {n.title}
                    </span>
                    <span className="block truncate text-[11.5px] text-neutral-500">
                      {n.stake !== undefined && (
                        <span className="amount tabular-nums">
                          {compact(n.stake)} ·{" "}
                        </span>
                      )}
                      <span className={n.urgent ? "text-rose-300" : ""}>
                        {n.when}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>,
    target,
  );
}
