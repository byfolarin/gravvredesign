"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  X,
} from "lucide-react";
import { NavIcon } from "../icons/nav-icon";
import { navSections, type NavLink, type NavSection } from "./nav-config";
import { AccountMenu } from "./account-menu";
import { NeedsSidebar } from "@/app/(dashboard)/_overview/needs-you";
import { UPDATES, UpdateArt, useDismissed } from "../updates";

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const COLLAPSE_KEY = "gravv-nav-collapsed";
const LAYOUT_KEY = "gravv-nav-layout";
/** What's saved: the order of links in each section (by href) and which are hidden. */
type SavedLayout = { sections: string[][]; hidden: string[] };

const byHref = new Map(
  navSections.flatMap((s) => s.items.map((i) => [i.href, i] as const)),
);
/** Exact match, or a sub-page that isn't itself in the nav (Configure → API requests). */
const NAV_HREFS = new Set(
  navSections.flatMap((s) => s.items.map((i) => i.href)),
);
const isActive = (pathname: string, href: string) =>
  pathname === href ||
  (href !== "/" && pathname.startsWith(`${href}/`) && !NAV_HREFS.has(pathname));

const defaultOrder = () => navSections.map((s) => s.items.map((i) => i.href));

/** Rebuild sections from a saved order, keeping any links added since it was saved. */
function restore(saved: SavedLayout): string[][] {
  const seen = new Set(saved.sections.flat());
  return navSections.map((s, i) => [
    ...(saved.sections[i] ?? []).filter((h) => byHref.has(h)),
    ...s.items.map((it) => it.href).filter((h) => !seen.has(h)),
  ]);
}

export function Sidebar({
  workspace,
  user,
}: {
  workspace: string;
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [order, setOrder] = useState<string[][]>(defaultOrder);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  // Where the dragged link would land: section index + position inside it.
  const [drop, setDrop] = useState<{ s: number; i: number } | null>(null);
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);

  // Restore saved preferences after hydration so server and client markup agree.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
        const raw = localStorage.getItem(LAYOUT_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as SavedLayout;
          setOrder(restore(saved));
          setHidden(new Set(saved.hidden));
        }
      } catch {
        // Storage unavailable or corrupt; keep the defaults.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const save = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable; the change still applies for this visit.
    }
  };
  const toggleCollapsed = (next = !collapsed) => {
    setCollapsed(next);
    setTip(null);
    if (next) setEditing(false);
    save(COLLAPSE_KEY, next ? "1" : "0");
  };
  const commit = (nextOrder: string[][], nextHidden: Set<string>) => {
    setOrder(nextOrder);
    setHidden(nextHidden);
    save(
      LAYOUT_KEY,
      JSON.stringify({
        sections: nextOrder,
        hidden: [...nextHidden],
      } satisfies SavedLayout),
    );
  };

  // ⌘\ / Ctrl+\ collapses and expands.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const move = (href: string, to: { s: number; i: number }) => {
    const next = order.map((list) => [...list]);
    const fromS = next.findIndex((list) => list.includes(href));
    const fromI = next[fromS].indexOf(href);
    next[fromS].splice(fromI, 1);
    // Removing an earlier item in the same section shifts the target up by one.
    const at = fromS === to.s && fromI < to.i ? to.i - 1 : to.i;
    next[to.s].splice(Math.max(0, Math.min(at, next[to.s].length)), 0, href);
    commit(next, hidden);
  };

  const sections: (NavSection & { hrefs: string[] })[] = navSections.map(
    (s, i) => ({
      ...s,
      hrefs: order[i],
      items: order[i].map((h) => byHref.get(h)!),
    }),
  );

  return (
    <aside
      className={cx(
        "app-sidebar flex h-full shrink-0 flex-col text-neutral-200 transition-[width] duration-200 ease-out",
        collapsed ? "w-[60px]" : "w-60",
      )}
      style={{ "--sidebar-w": collapsed ? "60px" : "240px" } as CSSProperties}
    >
      {/* Workspace + collapse */}
      <div
        className={cx(
          "mt-2 flex h-12 items-center",
          collapsed ? "justify-center px-0" : "justify-between px-3",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => toggleCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar (⌘\)"
            className="group relative flex size-9 items-center justify-center rounded-md transition-colors hover:bg-white/6"
          >
            <span className="flex size-6 items-center justify-center rounded-[6px] bg-white text-xs font-semibold text-black transition-opacity group-hover:opacity-0">
              {workspace[0]}
            </span>
            <PanelLeftOpen
              size={16}
              strokeWidth={1.75}
              className="absolute text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-white/6"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-white text-xs font-semibold text-black">
                {workspace[0]}
              </span>
              <span className="truncate text-sm font-medium text-white">
                {workspace}
              </span>
              <ChevronDown
                size={13}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
            </button>
            <button
              type="button"
              onClick={() => toggleCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar (⌘\)"
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/6 hover:text-white"
            >
              <PanelLeftClose size={15} strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav
        aria-label="Main"
        className={cx(
          "sidebar-scroll flex-1 overflow-y-auto pt-2 pb-4",
          collapsed ? "overflow-x-hidden px-2.5" : "px-2",
          editing &&
            "mx-1.5 rounded-xl bg-white/[0.03] px-1 ring-1 ring-white/8",
        )}
        onMouseLeave={() => setTip(null)}
      >
        {editing && (
          <p className="px-2 pt-1 pb-3 text-[11px] leading-relaxed text-neutral-500">
            Drag to reorder. Hide what you don&apos;t use.
          </p>
        )}
        {sections.map((section, s) => {
          const open =
            editing ||
            collapsed ||
            !section.label ||
            !closedSections.has(section.label);
          const items = editing
            ? section.items
            : section.items.filter((it) => !hidden.has(it.href));
          if (!editing && items.length === 0) return null;
          return (
            <div
              key={section.label ?? s}
              className={cx(s > 0 && (collapsed ? "mt-3" : "mt-5"))}
            >
              {collapsed
                ? s > 0 && (
                    <div aria-hidden className="mx-2 mb-3 h-px bg-white/8" />
                  )
                : section.label && (
                    <button
                      type="button"
                      disabled={editing}
                      onClick={() =>
                        setClosedSections((prev) => {
                          const next = new Set(prev);
                          if (next.has(section.label!))
                            next.delete(section.label!);
                          else next.add(section.label!);
                          return next;
                        })
                      }
                      aria-expanded={open}
                      className="mb-1 flex items-center gap-1 px-2 py-1 text-[12px] text-neutral-500 transition-colors enabled:hover:text-neutral-300"
                    >
                      {section.label}
                      {!editing && (
                        <ChevronDown
                          size={12}
                          strokeWidth={2}
                          className={cx(
                            "transition-transform duration-150",
                            !open && "-rotate-90",
                          )}
                        />
                      )}
                    </button>
                  )}
              {open && (
                <ul
                  className="flex flex-col gap-px"
                  onDragOver={(e) => {
                    // Dropping on the empty space under a section adds to its end.
                    if (!drag || e.target !== e.currentTarget) return;
                    e.preventDefault();
                    setDrop({ s, i: section.items.length });
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag && drop) move(drag, drop);
                    setDrag(null);
                    setDrop(null);
                  }}
                >
                  {items.map((item) => {
                    const i = section.hrefs.indexOf(item.href);
                    return (
                      <li
                        key={item.href}
                        className="relative"
                        draggable={editing}
                        onDragStart={(e) => {
                          setDrag(item.href);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", item.href);
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setDrop(null);
                        }}
                        onDragOver={(e) => {
                          if (!drag) return;
                          e.preventDefault();
                          const r = e.currentTarget.getBoundingClientRect();
                          setDrop({
                            s,
                            i: e.clientY < r.top + r.height / 2 ? i : i + 1,
                          });
                        }}
                      >
                        {/* Drop line */}
                        {editing &&
                          drop &&
                          drop.s === s &&
                          drop.i === i &&
                          drag !== item.href && (
                            <span
                              aria-hidden
                              className="absolute -top-px right-2 left-2 z-10 h-0.5 rounded-full bg-[var(--brand)]"
                            />
                          )}
                        {editing ? (
                          <EditRow
                            link={item}
                            hidden={hidden.has(item.href)}
                            dragging={drag === item.href}
                            onToggle={() => {
                              const next = new Set(hidden);
                              if (next.has(item.href)) next.delete(item.href);
                              else next.add(item.href);
                              commit(order, next);
                            }}
                            onNudge={(dir) => {
                              const target = i + dir;
                              if (target >= 0 && target < section.hrefs.length)
                                move(item.href, {
                                  s,
                                  i: dir > 0 ? target + 1 : target,
                                });
                              else if (dir < 0 && s > 0)
                                move(item.href, {
                                  s: s - 1,
                                  i: order[s - 1].length,
                                });
                              else if (dir > 0 && s < order.length - 1)
                                move(item.href, { s: s + 1, i: 0 });
                            }}
                          />
                        ) : (
                          <Item
                            link={item}
                            active={isActive(pathname, item.href)}
                            collapsed={collapsed}
                            onTip={(label, el) =>
                              setTip(
                                label && el
                                  ? {
                                      label,
                                      top:
                                        el.getBoundingClientRect().top +
                                        el.offsetHeight / 2,
                                    }
                                  : null,
                              )
                            }
                          />
                        )}
                        {editing &&
                          drop &&
                          drop.s === s &&
                          drop.i === i + 1 &&
                          i === section.hrefs.length - 1 &&
                          drag !== item.href && (
                            <span
                              aria-hidden
                              className="absolute right-2 -bottom-px left-2 z-10 h-0.5 rounded-full bg-[var(--brand)]"
                            />
                          )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {/* Edit entry / controls */}
        {!collapsed && (
          <div
            className={cx(
              "mt-5 flex items-center gap-1 px-1",
              editing &&
                "sticky bottom-0 -mx-1 rounded-b-xl bg-[#0b0b0c] px-2 py-2",
            )}
          >
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => commit(defaultOrder(), new Set())}
                  className="h-7 rounded-md px-2 text-[12px] text-neutral-500 transition-colors hover:text-white"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="ml-auto h-7 rounded-full bg-white px-3 text-[12px] font-medium text-black transition-colors hover:bg-neutral-200"
                >
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
              >
                <Pencil size={12} strokeWidth={1.75} />
                Edit sidebar
                {hidden.size > 0 && (
                  <span className="text-neutral-600">
                    · {hidden.size} hidden
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </nav>

      {!collapsed && <NeedsSidebar />}
      {!collapsed && <SidebarNews />}

      {/* You — opens the account menu upward */}
      <div
        className={cx(
          "border-t border-white/6 py-3",
          collapsed ? "px-2.5" : "px-3",
        )}
      >
        <AccountMenu user={user} compact={collapsed} />
      </div>

      {/* Label for icons in the collapsed rail; fixed so the scrolling nav can't clip it */}
      {collapsed && tip && (
        <div
          role="tooltip"
          className="orbit-pop pointer-events-none fixed left-[66px] z-50 -translate-y-1/2 rounded-md border border-white/10 bg-raised px-2 py-1 text-[12px] whitespace-nowrap text-white shadow-xl"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </aside>
  );
}

function Item({
  link,
  active,
  collapsed,
  onTip,
}: {
  link: NavLink;
  active: boolean;
  collapsed: boolean;
  onTip: (label: string | null, el?: HTMLElement) => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  return (
    <Link
      ref={ref}
      href={link.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? link.label : undefined}
      onMouseEnter={() =>
        collapsed && ref.current && onTip(link.label, ref.current)
      }
      onFocus={() => collapsed && ref.current && onTip(link.label, ref.current)}
      onMouseLeave={() => onTip(null)}
      onBlur={() => onTip(null)}
      className={cx(
        "flex h-8 items-center rounded-md text-[13px] transition-colors",
        collapsed ? "w-9 justify-center" : "gap-2.5 px-2",
        active
          ? "bg-white/9 text-white"
          : "group text-neutral-300 hover:bg-white/5 hover:text-white",
      )}
    >
      <NavIcon
        icon={link.icon}
        size={18}
        className={cx("shrink-0", active && "is-active")}
      />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  );
}

/** A link in edit mode: handle to drag, the link itself, and show/hide. */
function EditRow({
  link,
  hidden,
  dragging,
  onToggle,
  onNudge,
}: {
  link: NavLink;
  hidden: boolean;
  dragging: boolean;
  onToggle: () => void;
  onNudge: (dir: -1 | 1) => void;
}) {
  return (
    <div
      className={cx(
        "group flex h-8 cursor-grab items-center gap-1.5 rounded-md pr-1 pl-0.5 text-[13px] transition-colors active:cursor-grabbing",
        dragging ? "bg-white/[0.08] opacity-50" : "hover:bg-white/5",
        hidden ? "text-neutral-600" : "text-neutral-200",
      )}
    >
      <button
        type="button"
        aria-label={`Move ${link.label} (Alt + arrow keys)`}
        title="Drag, or Alt + ↑/↓"
        onKeyDown={(e) => {
          if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            e.preventDefault();
            onNudge(e.key === "ArrowUp" ? -1 : 1);
          }
        }}
        className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-neutral-600 transition-colors group-hover:text-neutral-400 focus-visible:text-white"
      >
        <GripVertical size={13} strokeWidth={1.75} />
      </button>
      <NavIcon
        icon={link.icon}
        size={17}
        className={cx("shrink-0", hidden && "opacity-40")}
      />
      <span
        className={cx(
          "min-w-0 flex-1 truncate",
          hidden && "line-through decoration-white/20",
        )}
      >
        {link.label}
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-label={hidden ? `Show ${link.label}` : `Hide ${link.label}`}
        title={hidden ? "Show" : "Hide"}
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded transition-colors hover:bg-white/8 hover:text-white",
          hidden
            ? "text-neutral-500"
            : "text-neutral-600 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      >
        {hidden ? (
          <EyeOff size={13} strokeWidth={1.75} />
        ) : (
          <Eye size={13} strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

/** One launch at a time above your name, with its picture; gone once dismissed. */
function SidebarNews() {
  const { gone, dismiss } = useDismissed("sidebar");
  const u = UPDATES.find((x) => !gone.has(x.id));
  if (!u) return null;
  return (
    <div className="relative mx-3 mb-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <UpdateArt u={u} className="h-20" />
      <div className="px-3 pt-2.5 pb-3">
        <div className="text-[11px] text-[var(--brand)]">New</div>
        <Link
          href="/whats-new"
          className="mt-0.5 block text-[12.5px] leading-snug text-neutral-100 hover:text-white"
        >
          {u.title}
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(u.id)}
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-neutral-200 backdrop-blur hover:text-white"
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
