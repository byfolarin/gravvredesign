"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Search } from "lucide-react";
import { NavIcon } from "../icons/nav-icon";
import { Orbit } from "../orbit/orbit";
import {
  navSections,
  type NavLink,
  type NavSection,
} from "../sidebar/nav-config";
import { ThemeToggle } from "../theme-toggle";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Two-row top navigation. Row 1: workspace + global actions.
 * Row 2: the unlabelled nav section as tabs, labelled sections as dropdowns.
 * Always dark, independent of the content theme.
 */
export function TopNav({
  workspace,
  user,
}: {
  workspace: string;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const [primary, ...groups] = navSections;

  return (
    <header className="shrink-0 bg-background pt-2 text-neutral-200">
      {/* Both rows share the page content column (max 1180px, centred) so the nav lines up with the content. */}
      {/* Row 1 */}
      <div className="mx-auto grid h-14 w-full max-w-[1196px] grid-cols-[1fr_auto_1fr] items-center gap-3 px-8">
        <button
          type="button"
          className="-ml-1.5 flex items-center gap-2 justify-self-start rounded-md px-1.5 py-1 transition-colors hover:bg-white/6"
        >
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-white text-xs font-semibold text-black">
            {workspace[0]}
          </span>
          <span className="text-sm font-medium text-white">{workspace}</span>
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className="text-neutral-500"
          />
        </button>

        <Orbit />

        <div className="flex items-center justify-self-end gap-2">
          <button
            type="button"
            className="flex h-8 w-64 items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 text-[13px] whitespace-nowrap text-neutral-500 transition-colors hover:border-white/20 hover:text-neutral-300"
          >
            <Search size={14} strokeWidth={1.75} />
            Search…
            <kbd className="ml-auto rounded border border-white/10 px-1 font-sans text-[10px] text-neutral-500">
              ⌘K
            </kbd>
          </button>
          <ThemeToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="relative flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
          >
            <Bell size={15} strokeWidth={1.75} />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-white" />
          </button>
          <button
            type="button"
            title={`${user.name} · ${user.email}`}
            className="ml-1 flex size-8 items-center justify-center rounded-full bg-orange-500 text-[11px] font-semibold text-white ring-2 ring-transparent transition hover:ring-white/20"
          >
            {initials(user.name)}
          </button>
        </div>
      </div>

      {/* Row 2 */}
      <nav
        aria-label="Main"
        className="mx-auto mt-3 flex h-11 w-full max-w-[1196px] items-end gap-1 overflow-x-auto px-[22px] [scrollbar-width:none]"
      >
        {primary.items.map((item) => (
          <Tab key={item.href} link={item} active={pathname === item.href} />
        ))}
        <span
          className="mx-2 mb-3 h-4 w-px shrink-0 self-end bg-white/10"
          aria-hidden
        />
        {groups.map((g) => (
          <GroupTab key={g.label} group={g} pathname={pathname} />
        ))}
      </nav>
    </header>
  );
}

function Tab({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className="group relative flex h-full shrink-0 items-start px-0.5"
    >
      <span
        className={cx(
          "rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors",
          active
            ? "text-white"
            : "text-neutral-400 group-hover:bg-white/6 group-hover:text-white",
        )}
      >
        {link.label}
      </span>
      {active && (
        <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-white" />
      )}
    </Link>
  );
}

function GroupTab({
  group,
  pathname,
}: {
  group: NavSection;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const root = useRef<HTMLDivElement>(null);
  const active = group.items.some((i) => i.href === pathname);

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

  return (
    <div
      ref={root}
      className="relative flex h-full shrink-0 items-start px-0.5"
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          // The tab row scrolls horizontally, so the menu is fixed-positioned from the button.
          const r = e.currentTarget.getBoundingClientRect();
          setPos({ left: r.left, top: r.bottom + 8 });
          setOpen((o) => !o);
        }}
        className={cx(
          "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors",
          active || open
            ? "text-white"
            : "text-neutral-400 hover:bg-white/6 hover:text-white",
          open && "bg-white/6",
        )}
      >
        {group.label}
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={cx("transition-transform", open && "rotate-180")}
        />
      </button>
      {active && (
        <span className="absolute inset-x-2.5 bottom-0 h-[2px] rounded-full bg-white" />
      )}

      {open && (
        <div
          role="menu"
          style={{ left: pos.left, top: pos.top }}
          className="fixed z-50 w-56 rounded-xl border border-white/10 bg-[#0c0c0c] p-1.5 shadow-2xl"
        >
          {group.items.map((item) => {
            const isActive = item.href === pathname;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cx(
                  "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                  isActive
                    ? "bg-white/8 text-white"
                    : "text-neutral-300 hover:bg-white/6 hover:text-white",
                )}
              >
                <NavIcon
                  icon={item.icon}
                  size={16}
                  className={cx("shrink-0", isActive && "is-active")}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
