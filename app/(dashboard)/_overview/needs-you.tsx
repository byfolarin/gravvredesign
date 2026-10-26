"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronUp, ListChecks, X } from "lucide-react";
import { compact, needs, plural, type Need } from "./widgets";

const CARD_H = 74;
const PEEK = 9;
const GAP = 8;
const SNOOZE_KEY = "gravv-needs-snoozed";
const TODAY = "2026-10-20";

/** Items put away for today (×), remembered until tomorrow. */
function useSnoozed() {
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? "null");
        if (v?.day === TODAY && Array.isArray(v.keys))
          setSnoozed(new Set(v.keys));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const save = (next: Set<string>) => {
    setSnoozed(next);
    try {
      localStorage.setItem(
        SNOOZE_KEY,
        JSON.stringify({ day: TODAY, keys: [...next] }),
      );
    } catch {}
  };
  return {
    snoozed,
    snooze: (k: string) => save(new Set([...snoozed, k])),
    snoozeAll: (ks: string[]) => save(new Set([...snoozed, ...ks])),
    restore: () => save(new Set()),
  };
}

export function useNeeds() {
  const all = needs();
  const s = useSnoozed();
  return { all, list: all.filter((n) => !s.snoozed.has(n.key)), ...s };
}

function Clock({ n }: { n: Need }) {
  return (
    <span className={n.urgent ? "text-rose-300" : "text-amber-200"}>
      {n.when}
    </span>
  );
}

/* ——— Variant A: an overlapping stack, like the product updates ——— */

/**
 * Needs you as a stack under the heading, shaped like the promotions stack: the most
 * pressing decision in front with its action, the rest peeking behind. Click to fan them
 * out; × puts one away until tomorrow.
 */
export function NeedsStack({ className = "mt-8" }: { className?: string }) {
  const { list, snooze, snoozeAll } = useNeeds();
  const [open, setOpen] = useState(false);
  const n = list.length;
  if (!n) return null;
  const fanned = open && n > 1;
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
        {list.map((item, i) => {
          const back = !fanned && i > 0;
          const depth = Math.min(i, 2);
          return (
            <div
              key={item.key}
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
              <div
                className={`flex h-[74px] items-center gap-4 rounded-xl border border-white/8 bg-surface px-5 ${back ? "shadow-[0_2px_6px_-2px_rgb(0_0_0/0.12)]" : ""}`}
              >
                <div className={`contents ${back ? "[&>*]:opacity-0" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-[12px]">
                      {i === 0 && !fanned && (
                        <span className="text-neutral-500">Needs you ·</span>
                      )}
                      <Clock n={item} />
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 text-[13.5px] font-medium text-white">
                        {item.title}
                      </span>
                      {item.stake !== undefined && (
                        <span className="amount shrink-0 text-[13px] text-neutral-400 tabular-nums">
                          {compact(item.stake)}
                        </span>
                      )}
                      <span className="min-w-0 truncate text-[12.5px] text-neutral-500">
                        · {item.detail}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={item.href}
                    className="flex h-8 shrink-0 items-center rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
                  >
                    {item.action}
                  </Link>
                  {i === 0 && n > 1 && !fanned && (
                    <span
                      title={`${n} things need you`}
                      className="flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] text-neutral-400 tabular-nums shadow-[0_0_0_1px_rgb(0_0_0/0.08)]"
                    >
                      <ListChecks size={13} strokeWidth={1.75} />
                      {n}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Put away until tomorrow"
                    title="Put away until tomorrow"
                    onClick={() => {
                      snooze(item.key);
                      if (n <= 2) setOpen(false);
                    }}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-500 shadow-[0_0_0_1px_rgb(0_0_0/0.08)] hover:text-white"
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
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
            onClick={() => {
              snoozeAll(list.map((x) => x.key));
              setOpen(false);
            }}
            className="hover:text-white"
          >
            Put all away until tomorrow
          </button>
        </div>
      )}
    </div>
  );
}

/* ——— Variant B: a drawer you open from the header ——— */

/** The header button: how many things need you, and what's at stake. */
export function NeedsButton({ onOpen }: { onOpen: () => void }) {
  const { list } = useNeeds();
  if (!list.length) return null;
  const urgent = list.some((n) => n.urgent);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-8 items-center gap-2 rounded-full border border-white/12 pr-3.5 pl-2 text-[12.5px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
    >
      <span
        className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium tabular-nums ${urgent ? "bg-rose-400/15 text-rose-300" : "bg-amber-300/15 text-amber-200"}`}
      >
        {list.length}
      </span>
      Need you
    </button>
  );
}

/**
 * Needs you as a drawer: out of the way until you ask for it. Everything waiting, most
 * pressing first, each with its stake, its clock and the one action that clears it.
 */
export function NeedsDrawer({ onClose }: { onClose: () => void }) {
  const { list, all, snooze, restore } = useNeeds();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const total = list.reduce((s, n) => s + (n.stake ?? 0), 0);
  const away = all.length - list.length;
  return (
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
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[420px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-5 pb-5">
          <div>
            <h2 className="text-[17px] font-medium text-white">Needs you</h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              {list.length ? (
                <>
                  <span className="amount text-neutral-200">
                    {compact(total)}
                  </span>{" "}
                  waiting on {plural(list.length, "decision")}
                </>
              ) : (
                "Nothing waiting on you."
              )}
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
        <ul className="divide-y divide-white/6 px-6">
          {list.map((n) => (
            <li key={n.key} className="py-4">
              <div className="text-[12px]">
                <Clock n={n} />
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium text-white">
                  {n.title}
                </span>
                {n.stake !== undefined && (
                  <span className="amount shrink-0 text-[13px] text-neutral-300 tabular-nums">
                    {compact(n.stake)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-neutral-500">
                {n.detail}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={n.href}
                  onClick={onClose}
                  className="flex h-8 items-center rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
                >
                  {n.action}
                </Link>
                <button
                  type="button"
                  onClick={() => snooze(n.key)}
                  className="h-8 rounded-full px-3 text-[12.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                >
                  Not today
                </button>
              </div>
            </li>
          ))}
        </ul>
        {away > 0 && (
          <button
            type="button"
            onClick={restore}
            className="mx-6 mt-2 mb-6 self-start text-[12.5px] text-neutral-500 hover:text-white"
          >
            Show {plural(away, "item")} put away today
          </button>
        )}
      </aside>
    </>
  );
}
