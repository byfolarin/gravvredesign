"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";

// Nour arrives 7:45 AM local time on 26 October 2026 (month is 0-based).
const TARGET = new Date(2026, 9, 26, 7, 45, 0);

const POSITION_KEY = "gravv-nour-countdown-pos";
const NAME_KEY = "gravv-countdown-name";
const DEFAULT_NAME = "Nour";
type Pos = { x: number; y: number };

function clamp(pos: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 300;
  const h = el?.offsetHeight ?? 160;
  return {
    x: Math.min(Math.max(8, pos.x), window.innerWidth - w - 8),
    y: Math.min(Math.max(8, pos.y), window.innerHeight - h - 8),
  };
}

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
    weeks: total / 604_800,
  };
}

/**
 * Floating countdown to 26 October, 7:45 AM. Renders only on the client because it
 * depends on the current time (avoids a server/client hydration mismatch).
 */
export function Countdown() {
  const [now, setNow] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // null = default bottom-right placement; otherwise where the user dragged it.
  const [pos, setPos] = useState<Pos | null>(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  // Latest dragged position, so pointer-up saves where the card was actually dropped.
  const latest = useRef<Pos | null>(null);
  const [name, setName] = useState(DEFAULT_NAME);
  const [editingName, setEditingName] = useState(false);

  function saveName(value: string) {
    const next = value.trim() || DEFAULT_NAME;
    setName(next);
    try {
      localStorage.setItem(NAME_KEY, next);
    } catch {
      // Storage unavailable; name just won't persist.
    }
  }

  function savePos(p: Pos) {
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(p));
    } catch {
      // Storage unavailable; position just won't persist.
    }
  }

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(() => {
      tick();
      try {
        const savedName = localStorage.getItem(NAME_KEY);
        if (savedName) setName(savedName);
      } catch {
        // Ignore unreadable saved name.
      }
      try {
        const saved = localStorage.getItem(POSITION_KEY);
        if (saved) setPos(clamp(JSON.parse(saved) as Pos, ref.current));
      } catch {
        // Ignore unreadable saved position.
      }
    }, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  if (dismissed || now === null) return null;

  const remaining = TARGET.getTime() - now;
  const done = remaining <= 0;
  const p = parts(remaining);
  const wholeWeeks = Math.floor(p.weeks);
  const extraDays = p.days - wholeWeeks * 7;

  return (
    <div
      ref={ref}
      role="timer"
      tabIndex={0}
      aria-label={`${name} countdown to ${dateFmt.format(TARGET)}, ${timeFmt.format(TARGET)}. Drag to move, or use arrow keys.`}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        const r = e.currentTarget.getBoundingClientRect();
        grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (!grab.current) return;
        const next = clamp(
          { x: e.clientX - grab.current.dx, y: e.clientY - grab.current.dy },
          ref.current,
        );
        latest.current = next;
        setPos(next);
      }}
      onPointerUp={() => {
        grab.current = null;
        setDragging(false);
        if (latest.current) savePos(latest.current);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10;
        const d = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }[e.key];
        if (!d) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        const next = clamp({ x: r.left + d[0], y: r.top + d[1] }, ref.current);
        setPos(next);
        savePos(next);
      }}
      className={`theme-lock-dark orbit-pop fixed z-30 w-[300px] touch-none rounded-2xl border border-white/10 bg-[#0b0b0c] p-4 text-white outline-none select-none focus-visible:ring-2 focus-visible:ring-white/30 ${
        pos ? "" : "right-6 bottom-20"
      } ${dragging ? "cursor-grabbing shadow-[0_32px_80px_-20px_rgb(0_0_0/0.75)]" : "cursor-grab shadow-[0_24px_60px_-20px_rgb(0_0_0/0.6)]"}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center text-[13px] font-medium">
            {editingName ? (
              <input
                autoFocus
                defaultValue={name}
                maxLength={24}
                aria-label="Countdown name"
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  saveName(e.currentTarget.value);
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = name;
                    e.currentTarget.blur();
                  }
                }}
                className="w-24 rounded-sm border-b border-white/40 bg-transparent px-0 text-[13px] font-medium text-white outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                title="Rename"
                className="group/name -mx-1 inline-flex items-center gap-1 rounded px-1 decoration-white/30 decoration-dotted underline-offset-4 hover:bg-white/6 hover:underline"
              >
                {name}
                <Pencil
                  size={10}
                  strokeWidth={2}
                  className="text-neutral-500 opacity-0 transition-opacity group-hover/name:opacity-100"
                />
              </button>
            )}
            <span className="ml-1">countdown</span>
          </div>
          <div className="text-[11px] text-neutral-500">
            Until {dateFmt.format(TARGET)}, {timeFmt.format(TARGET)}
          </div>
        </div>
        <button
          type="button"
          aria-label={`Dismiss ${name} countdown`}
          onClick={() => setDismissed(true)}
          className="-mt-1 -mr-1 flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      {done ? (
        <p className="mt-4 text-sm text-neutral-200">She’s here.</p>
      ) : (
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          <Unit value={p.days} label="Days" />
          <Unit value={p.hours} label="Hours" />
          <Unit value={p.minutes} label="Mins" />
          <Unit value={p.seconds} label="Secs" />
        </div>
      )}

      {/* Weeks, bottom-right */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-neutral-500 tabular-nums">
        <span className="text-neutral-200">{p.weeks.toFixed(1)} weeks</span>
        <span>·</span>
        <span>
          {wholeWeeks}w {extraDays}d
        </span>
      </div>
    </div>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-white/6 py-2 text-center">
      <div className="text-[20px] leading-none font-medium tracking-tight tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">{label}</div>
    </div>
  );
}
