"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  HelpCircleIcon,
  Logout01Icon,
  PaintBoardIcon,
  SparklesIcon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { ThemeMenuItems } from "../theme-switch";
import { PersonAvatar } from "../person-avatar";

const item =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 transition-colors hover:bg-white/[0.06] hover:text-white";

/**
 * The account block at the bottom of the sidebar. Clicking it opens a menu upward with
 * account options; Theme opens a submenu to the side (Light / Dark / System).
 */
export function AccountMenu({
  user,
  compact = false,
}: {
  user: { name: string; email: string };
  /** Collapsed sidebar: avatar only, and the menu opens wider than the rail. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setThemeOpen(false);
  };

  return (
    <div ref={root} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className={`orbit-pop absolute bottom-full left-0 z-50 mb-2 rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.6)] ${compact ? "w-60" : "right-0"}`}
        >
          <div className="px-2.5 pt-1.5 pb-2">
            <div className="truncate text-[13px] font-medium text-white">
              {user.name}
            </div>
            <div className="truncate text-[12px] text-neutral-500">
              {user.email}
            </div>
          </div>
          <div className="border-t border-white/8 pt-1">
            <Link
              href="/manage/team"
              role="menuitem"
              onClick={close}
              className={item}
            >
              <HugeiconsIcon
                icon={UserIcon}
                size={15}
                strokeWidth={1.6}
                className="text-neutral-400"
              />
              Profile
            </Link>
            <Link
              href="/manage/configure"
              role="menuitem"
              onClick={close}
              className={item}
            >
              <HugeiconsIcon
                icon={Settings01Icon}
                size={15}
                strokeWidth={1.6}
                className="text-neutral-400"
              />
              Settings
            </Link>

            {/* Theme: a submenu that opens to the side on hover or click */}
            <div
              className="relative"
              onMouseEnter={() => setThemeOpen(true)}
              onMouseLeave={() => setThemeOpen(false)}
            >
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={themeOpen}
                onClick={() => setThemeOpen((v) => !v)}
                className={`${item} ${themeOpen ? "bg-white/[0.06] text-white" : ""}`}
              >
                <HugeiconsIcon
                  icon={PaintBoardIcon}
                  size={15}
                  strokeWidth={1.6}
                  className="text-neutral-400"
                />
                <span className="flex-1">Theme</span>
                <ChevronRight
                  size={13}
                  strokeWidth={1.75}
                  className="text-neutral-500"
                />
              </button>
              {themeOpen && (
                // Padding (not margin) bridges the gap, so moving the pointer across keeps it open.
                <div className="absolute bottom-0 left-full z-50 pl-1.5">
                  <div
                    role="menu"
                    aria-label="Theme"
                    className="orbit-pop w-44 rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.6)]"
                  >
                    <ThemeMenuItems itemClass={item} />
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/whats-new"
              role="menuitem"
              onClick={close}
              className={item}
            >
              <HugeiconsIcon
                icon={SparklesIcon}
                size={15}
                strokeWidth={1.6}
                className="text-neutral-400"
              />
              What&apos;s new
            </Link>

            <a
              href="mailto:support@gravv.xyz"
              role="menuitem"
              onClick={close}
              className={item}
            >
              <HugeiconsIcon
                icon={HelpCircleIcon}
                size={15}
                strokeWidth={1.6}
                className="text-neutral-400"
              />
              Help & support
            </a>
          </div>
          <div className="mt-1 border-t border-white/8 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={close}
              className={`${item} text-neutral-400`}
            >
              <HugeiconsIcon icon={Logout01Icon} size={15} strokeWidth={1.6} />
              Sign out
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center gap-2.5 rounded-lg py-1.5 text-left transition-colors ${compact ? "justify-center px-0" : "px-1.5"} ${
          open ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
        }`}
      >
        <PersonAvatar name={user.name} size={28} />
        <span className={compact ? "sr-only" : "min-w-0 flex-1"}>
          <span className="block truncate text-[13px] text-white">
            {user.name}
          </span>
          <span className="block truncate text-[11px] text-neutral-500">
            {user.email}
          </span>
        </span>
        {!compact && (
          <ChevronsUpDown
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-500"
          />
        )}
      </button>
    </div>
  );
}
