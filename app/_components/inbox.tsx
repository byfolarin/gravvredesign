"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowRight,
  CheckCheck,
  CreditCard,
  Gavel,
  Landmark,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Stamp,
  Webhook,
  ArrowLeftRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { INBOX_EVENT, type InboxTab } from "./inbox-events";
import {
  NOTIFICATIONS,
  agoWords,
  type Notification,
} from "./notifications-data";
import { PersonAvatar } from "./person-avatar";
import { TONE } from "./tone";
import { UPDATES, UpdateCard } from "./updates";

const ICON: Record<Notification["icon"], LucideIcon> = {
  approval: Stamp,
  returned: RotateCcw,
  dispute: Gavel,
  settled: ArrowLeftRight,
  arrived: ArrowDownLeft,
  account: Landmark,
  card: CreditCard,
  security: ShieldAlert,
  webhook: Webhook,
  billing: Receipt,
};

/**
 * The bell and its panel. One inbox, two tabs: Notifications (what happened on your account)
 * and Promotions (what's new in Gravv). The bell opens Notifications; promo cards on pages open
 * Promotions via openInbox("promotions").
 */
export function InboxBell() {
  const [tab, setTab] = useState<InboxTab | null>(null);
  const [items, setItems] = useState(NOTIFICATIONS);
  const unread = items.filter((n) => n.unread).length;

  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<InboxTab>).detail);
    window.addEventListener(INBOX_EVENT, on);
    return () => window.removeEventListener(INBOX_EVENT, on);
  }, []);
  useEffect(() => {
    if (!tab) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && setTab(null);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [tab]);

  const read = (id?: string) =>
    setItems((list) =>
      list.map((n) => (!id || n.id === id ? { ...n, unread: false } : n)),
    );

  return (
    <>
      <button
        type="button"
        aria-label={
          unread ? `Notifications, ${unread} unread` : "Notifications"
        }
        title="Notifications"
        onClick={() => setTab("notifications")}
        className="relative flex size-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
      >
        <HugeiconsIcon icon={Notification01Icon} size={16} strokeWidth={1.6} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-medium text-black tabular-nums">
            {unread}
          </span>
        )}
      </button>

      {tab && (
        <div className="fixed inset-0 z-[70]">
          <div
            aria-hidden
            onClick={() => setTab(null)}
            className="scrim-in absolute inset-0 bg-black/40"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Inbox"
            className="drawer-in content-theme absolute inset-y-0 right-0 flex w-[460px] max-w-full flex-col bg-surface text-neutral-200 shadow-[-24px_0_80px_-20px_rgb(0_0_0/0.45)] ring-1 ring-white/8"
          >
            <div className="flex items-center justify-between px-6 pt-5">
              <div className="text-[15px] font-medium text-white">Inbox</div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setTab(null)}
                className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="mt-3 flex items-end justify-between border-b border-white/8 px-6">
              <div role="tablist" className="flex gap-6">
                {(
                  [
                    ["notifications", "Notifications", unread],
                    ["promotions", "Promotions", UPDATES.length],
                  ] as const
                ).map(([id, label, n]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={`-mb-px flex items-center gap-1.5 border-b pb-3 text-[14px] transition-colors ${
                      tab === id
                        ? "border-white text-white"
                        : "border-transparent text-neutral-500 hover:text-neutral-200"
                    }`}
                  >
                    {label}
                    {n > 0 && (
                      <span className="text-[12px] text-neutral-500 tabular-nums">
                        {n}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {tab === "notifications" && unread > 0 && (
                <button
                  type="button"
                  onClick={() => read()}
                  className="mb-2.5 flex items-center gap-1 text-[12px] text-neutral-400 hover:text-white"
                >
                  <CheckCheck size={13} strokeWidth={1.75} />
                  Mark all read
                </button>
              )}
            </div>

            <div
              className="sidebar-scroll flex-1 overflow-y-auto"
              onClickCapture={(e) => {
                // Any link inside takes you somewhere: the panel gets out of the way.
                if ((e.target as HTMLElement).closest("a")) setTab(null);
              }}
            >
              {tab === "notifications" ? (
                <Notifications
                  items={items}
                  onOpen={(id) => {
                    read(id);
                    setTab(null);
                  }}
                />
              ) : (
                <div className="space-y-4 p-6">
                  {UPDATES.map((u) => (
                    <UpdateCard key={u.id} u={u} />
                  ))}
                  <Link
                    href="/whats-new"
                    onClick={() => setTab(null)}
                    className="flex items-center justify-center gap-1 pt-2 text-[13px] text-neutral-400 hover:text-white"
                  >
                    Open the What&apos;s new page
                    <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

/** Today first, then earlier. Unread reads in white and medium; read in grey. */
function Notifications({
  items,
  onOpen,
}: {
  items: Notification[];
  onOpen: (id: string) => void;
}) {
  const groups = [
    ["Today", items.filter((n) => n.minsAgo < 60 * 10)],
    ["Earlier", items.filter((n) => n.minsAgo >= 60 * 10)],
  ] as const;
  return (
    <div className="px-3 pb-6">
      {groups.map(
        ([label, list]) =>
          list.length > 0 && (
            <section key={label} className="mt-4">
              <div className="px-3 pb-1.5 text-[12px] text-neutral-500">
                {label}
              </div>
              <ul>
                {list.map((n) => {
                  const Icon = ICON[n.icon];
                  return (
                    <li key={n.id}>
                      <Link
                        href={n.href}
                        onClick={() => onOpen(n.id)}
                        className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/[0.04]"
                      >
                        {n.person ? (
                          <PersonAvatar name={n.person} size={32} />
                        ) : (
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full ${TONE[n.tone].bg} ${TONE[n.tone].fg}`}
                          >
                            <Icon size={15} strokeWidth={1.75} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span
                              className={`text-[13.5px] ${n.unread ? "font-medium text-white" : "text-neutral-300"}`}
                            >
                              {n.title}
                            </span>
                            <span className="shrink-0 text-[11.5px] text-neutral-500">
                              {agoWords(n.minsAgo)}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-relaxed text-neutral-500">
                            {n.body}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
