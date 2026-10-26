"use client";

import { CommandPalette, openCommand } from "./command/command-palette";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SendMoneyFlow } from "@/app/(dashboard)/recipients/_components/send-money";
import { recipients } from "@/app/(dashboard)/recipients/_data";
import { fundingSources } from "@/app/(dashboard)/cards/_data";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  Link01Icon,
  RefreshIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  ViewIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { InboxBell } from "./inbox";
import { ExperienceSwitch } from "./experience-switch";

const HIDE_KEY = "gravv-hide-amounts";
/** Fired by the top bar's Send money while on Recipients, which opens its own flow. */
export const SEND_EVENT = "gravv:send-money";

/** Global bar above the content: search, move money, privacy, settings, notifications, account. */
export function TopBar() {
  const [hidden, setHidden] = useState(false);

  // On "System" (nothing saved), follow OS theme changes live — the menu that sets it isn't always mounted.
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      try {
        if (localStorage.getItem("gravv-theme")) return;
      } catch {
        // Storage unavailable; treat as System.
      }
      document.documentElement.setAttribute(
        "data-theme",
        mq.matches ? "light" : "dark",
      );
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ⌘K / Ctrl+K opens the command palette (it listens for the keys itself).

  // ⇧H toggles "hide amounts" (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, [contenteditable]")) return;
      if (
        e.shiftKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        e.key.toLowerCase() === "h"
      ) {
        e.preventDefault();
        apply(!document.documentElement.hasAttribute("data-hide-amounts"));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Restore "hide amounts" after hydration so server and client markup agree.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(HIDE_KEY) === "1") apply(true);
      } catch {
        // Storage unavailable; amounts stay visible.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function apply(next: boolean) {
    setHidden(next);
    document.documentElement.toggleAttribute("data-hide-amounts", next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      // Storage unavailable; the choice still applies for this visit.
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-6 px-3 text-neutral-200">
      {/* Mosaic filter for "Hide amounts": sample one pixel per 8×8 cell, then grow it to fill
          the cell. Used from globals.css as filter: url(#gravv-pixelate). */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="gravv-pixelate" x="0" y="0" width="100%" height="100%">
          <feFlood x="4" y="4" width="1" height="1" />
          <feComposite width="8" height="8" />
          <feTile result="grid" />
          <feComposite in="SourceGraphic" in2="grid" operator="in" />
          <feMorphology operator="dilate" radius="4" />
        </filter>
      </svg>
      {/* Search opens the command palette — ⌘K anywhere does the same */}
      <button
        type="button"
        onClick={openCommand}
        aria-label="Search Gravv (⌘K)"
        className="flex h-8 w-full max-w-[420px] items-center gap-2 rounded-md px-2 text-left text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.04]"
      >
        <HugeiconsIcon
          icon={Search01Icon}
          size={15}
          strokeWidth={1.6}
          className="shrink-0"
        />
        <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
        <kbd className="rounded border border-white/10 px-1.5 py-px font-sans text-[11px] text-neutral-500">
          ⌘K
        </kbd>
      </button>
      <CommandPalette />

      <div className="flex shrink-0 items-center gap-1">
        <ExperienceSwitch />
        <span className="mx-1.5 h-4 w-px bg-white/10" aria-hidden />
        <Freshness />
        <MoveMoney />
        <span className="mx-1.5 h-4 w-px bg-white/10" aria-hidden />
        <IconButton
          icon={hidden ? ViewIcon : ViewOffSlashIcon}
          label={hidden ? "Show amounts (⇧H)" : "Hide amounts (⇧H)"}
          pressed={hidden}
          onClick={() => apply(!hidden)}
        />
        <Link
          href="/manage/configure"
          aria-label="Settings"
          title="Settings"
          className="flex size-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
        >
          <HugeiconsIcon icon={Settings01Icon} size={16} strokeWidth={1.6} />
        </Link>
        <InboxBell />
      </div>
    </header>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  pressed,
}: {
  icon: IconSvgElement;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-md transition-colors hover:bg-white/6 hover:text-white ${pressed ? "text-white" : "text-neutral-400"}`}
    >
      <HugeiconsIcon icon={icon} size={16} strokeWidth={1.6} />
    </button>
  );
}

/**
 * "Move money" (Mercury's pattern): a quiet pill with the ways money leaves or changes —
 * send, request, convert. Send opens the flow over any page.
 */
function MoveMoney() {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const down = (e: PointerEvent) =>
      !root.current?.contains(e.target as Node) && setMenu(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [menu]);

  const items: {
    icon: IconSvgElement;
    label: string;
    hint: string;
    run: () => void;
  }[] = [
    {
      icon: SentIcon,
      label: "Send money",
      hint: "Pay a recipient",
      // Recipients owns its own flow (so the payment lands in its list); elsewhere open it here.
      run: () =>
        pathname === "/recipients"
          ? window.dispatchEvent(new Event(SEND_EVENT))
          : setOpen(true),
    },
    {
      icon: Link01Icon,
      label: "Request payment",
      hint: "Share a payment link",
      run: () => router.push("/payment-links"),
    },
    {
      icon: ArrowDataTransferHorizontalIcon,
      label: "Convert currency",
      hint: "Get a quote on the trade desk",
      run: () => router.push("/trade-desk"),
    },
  ];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className={`flex h-8 items-center gap-1.5 rounded-full pr-2.5 pl-3.5 text-[13px] font-medium text-white transition-colors ${
          menu ? "bg-white/[0.14]" : "bg-white/[0.08] hover:bg-white/[0.12]"
        }`}
      >
        Move money
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          strokeWidth={1.8}
          className={`text-neutral-400 transition-transform ${menu ? "rotate-180" : ""}`}
        />
      </button>
      {menu && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-[248px] rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                it.run();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-neutral-200">
                <HugeiconsIcon icon={it.icon} size={15} strokeWidth={1.7} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-white">{it.label}</span>
                <span className="block text-[11px] text-neutral-500">
                  {it.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && (
        <SendMoneyFlow
          recipients={recipients}
          sources={fundingSources}
          onClose={() => setOpen(false)}
          onSent={() => {}}
        />
      )}
    </div>
  );
}

/** How fresh the numbers are; click to refresh. Replaces a bare refresh icon. */
function Freshness() {
  const router = useRouter();
  const [at, setAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    const t0 = setTimeout(() => {
      const n = Date.now();
      setAt(n);
      setNow(n);
    }, 0);
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, []);
  const mins = at === null ? 0 : Math.floor((now - at) / 60_000);
  const label = spinning
    ? "Updating…"
    : mins < 1
      ? "Updated just now"
      : `Updated ${mins} min ago`;
  return (
    <button
      type="button"
      title="Refresh"
      onClick={() => {
        router.refresh();
        setSpinning(true);
        setTimeout(() => {
          const n = Date.now();
          setAt(n);
          setNow(n);
          setSpinning(false);
        }, 700);
      }}
      className="group mr-1.5 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-neutral-500 transition-colors hover:bg-white/[0.05] hover:text-neutral-200"
    >
      <HugeiconsIcon
        icon={RefreshIcon}
        size={13}
        strokeWidth={1.8}
        className={`transition-opacity ${spinning ? "animate-spin opacity-100 [animation-duration:700ms]" : "opacity-60 group-hover:opacity-100"}`}
      />
      <span className="tabular-nums">{label}</span>
    </button>
  );
}
