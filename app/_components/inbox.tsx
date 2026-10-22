"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  Check,
  CreditCard,
  Gavel,
  Landmark,
  MessageSquare,
  Receipt,
  RotateCcw,
  ShieldAlert,
  Stamp,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { INBOX_EVENT, type InboxTab } from "./inbox-events";
import {
  ACTIVITY,
  NEEDS,
  agoWords,
  type Activity,
  type Icon,
  type Needs,
  type Tone,
} from "./notifications-data";
import { PersonAvatar } from "./person-avatar";
import { TONE } from "./tone";
import { UPDATES, UpdateArt, updateDate } from "./updates";

const ICON: Record<Icon, LucideIcon> = {
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
  comment: MessageSquare,
};

/**
 * The bell and its inbox: a panel under the bell (Lovable / Remote pattern), not a page.
 * Notifications lead with what needs you — each with the facts to decide and its action,
 * done right there — then a quiet activity feed. Promotions: what's new in Gravv.
 * Pages open it on a tab with openInbox(tab).
 */
export function InboxBell() {
  const [tab, setTab] = useState<InboxTab | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [activity, setActivity] = useState(ACTIVITY);
  const root = useRef<HTMLDivElement>(null);
  const waiting = NEEDS.filter((n) => !done.has(n.id)).length;
  const unread = activity.filter((a) => a.unread).length;

  useEffect(() => {
    const on = (e: Event) => setTab((e as CustomEvent<InboxTab>).detail);
    window.addEventListener(INBOX_EVENT, on);
    return () => window.removeEventListener(INBOX_EVENT, on);
  }, []);
  useEffect(() => {
    if (!tab) return;
    const down = (e: PointerEvent) =>
      !root.current?.contains(e.target as Node) && setTab(null);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setTab(null);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [tab]);

  const toggle = (id: string, on: boolean) =>
    setDone((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={waiting ? `Inbox, ${waiting} need you` : "Inbox"}
        aria-expanded={!!tab}
        title="Inbox"
        onClick={() => setTab((t) => (t ? null : "notifications"))}
        className={`relative flex size-8 items-center justify-center rounded-md transition-colors hover:bg-white/6 hover:text-white ${tab ? "bg-white/6 text-white" : "text-neutral-400"}`}
      >
        <HugeiconsIcon icon={Notification01Icon} size={16} strokeWidth={1.6} />
        {waiting > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-medium text-[#04301c] tabular-nums ring-2 ring-[var(--surface)]">
            {waiting}
          </span>
        )}
      </button>

      {tab && (
        <div
          role="dialog"
          aria-label="Inbox"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 flex w-[440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_24px_60px_-16px_rgb(0_0_0/0.5)]"
          style={{
            maxHeight: "min(680px, calc(100dvh / var(--app-zoom, 1) - 72px))",
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5">
            <div
              role="tablist"
              className="flex items-center gap-1"
            >
              {(
                [
                  ["notifications", "Notifications", waiting],
                  ["promotions", "Promotions", UPDATES.length],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  // Ink pill, not the app's mint tab (rounded-[999px] keeps it out of that rule).
                  className={`flex h-7 items-center gap-1.5 rounded-[999px] px-3 text-[12.5px] transition-colors ${
                    tab === id
                      ? "bg-white font-medium text-black"
                      : "text-neutral-500 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {label}
                  <span
                    className={`tabular-nums ${tab === id ? "text-black/55" : "text-neutral-600"}`}
                  >
                    {n}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setTab(null)}
              className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          </div>

          <div
            key={tab}
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto"
            onClickCapture={(e) => {
              // A link takes you somewhere: the panel gets out of the way.
              if ((e.target as HTMLElement).closest("a")) setTab(null);
            }}
          >
            {tab === "notifications" ? (
              <>
                <SectionHead
                  label={waiting ? `Needs you · ${waiting}` : "Needs you"}
                />
                {waiting === 0 && done.size === 0 ? null : (
                  <ul>
                    {NEEDS.map((n) => (
                      <NeedsRow
                        key={n.id}
                        n={n}
                        done={done.has(n.id)}
                        onDone={(on) => toggle(n.id, on)}
                      />
                    ))}
                  </ul>
                )}
                <SectionHead
                  label="Activity"
                  action={
                    unread
                      ? {
                          label: "Mark all read",
                          run: () =>
                            setActivity((l) =>
                              l.map((a) => ({ ...a, unread: false })),
                            ),
                        }
                      : undefined
                  }
                />
                <ul className="pb-2">
                  {activity.map((a) => (
                    <ActivityRow
                      key={a.id}
                      a={a}
                      onArchive={() =>
                        setActivity((l) => l.filter((x) => x.id !== a.id))
                      }
                    />
                  ))}
                  {activity.length === 0 && (
                    <li className="px-4 py-6 text-center text-[12.5px] text-neutral-500">
                      You&apos;re all caught up.
                    </li>
                  )}
                </ul>
              </>
            ) : (
              <Promotions />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({
  label,
  action,
}: {
  label: string;
  action?: { label: string; run: () => void };
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1.5 text-[12px] text-neutral-500">
      <span>{label}</span>
      {action && (
        <button
          type="button"
          onClick={action.run}
          className="text-neutral-400 hover:text-white"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/** "**bold** rest" → the bold parts in white medium, the rest in the row's colour. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-medium text-white">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Mark({
  person,
  icon,
  tone,
  size,
}: {
  person?: string;
  icon: Icon;
  tone: Tone;
  size: number;
}) {
  if (person) return <PersonAvatar name={person} size={size} />;
  const I = ICON[icon];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${TONE[tone].bg} ${TONE[tone].fg}`}
      style={{ width: size, height: size }}
    >
      <I size={Math.round(size * 0.47)} strokeWidth={1.75} />
    </span>
  );
}

const PRIMARY =
  "flex h-7 items-center rounded-full bg-white px-3 text-[12px] font-medium text-black transition-colors hover:bg-neutral-200";
const SECONDARY =
  "flex h-7 items-center rounded-full px-3 text-[12px] text-neutral-300 ring-1 ring-white/12 transition-colors hover:text-white hover:ring-white/25";

function ActionButton({
  a,
  primary,
  onDone,
}: {
  a: Needs["primary"];
  primary: boolean;
  onDone: () => void;
}) {
  const cls = primary ? PRIMARY : SECONDARY;
  return "href" in a ? (
    <Link href={a.href} className={cls}>
      {a.label}
    </Link>
  ) : (
    <button type="button" onClick={onDone} className={cls}>
      {a.label}
    </button>
  );
}

function NeedsRow({
  n,
  done,
  onDone,
}: {
  n: Needs;
  done: boolean;
  onDone: (on: boolean) => void;
}) {
  const doneText =
    "done" in n.primary
      ? n.primary.done
      : n.secondary && "done" in n.secondary
        ? n.secondary.done
        : "Done";
  return (
    <li className="mx-2 rounded-xl px-2 py-3 transition-colors hover:bg-white/[0.03]">
      <div className="flex gap-3">
        <span className="relative mt-0.5 size-8 shrink-0 self-start">
          <Mark person={n.person} icon={n.icon} tone={n.tone} size={32} />
          {n.person && (
            // What it's about, pinned to the person
            <span className="absolute -right-1 -bottom-1 rounded-full bg-raised p-[2px]">
              <span
                className={`flex size-[15px] items-center justify-center rounded-full ${TONE[n.tone].bg} ${TONE[n.tone].fg}`}
              >
                {(() => {
                  const I = ICON[n.icon];
                  return <I size={9} strokeWidth={2.25} />;
                })()}
              </span>
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p
              className={`text-[13px] leading-snug ${done ? "text-neutral-500 [&_span]:font-normal [&_span]:text-neutral-400" : "text-neutral-300"}`}
            >
              <Rich text={n.text} />
            </p>
            <span className="shrink-0 pt-px text-[11.5px] text-neutral-500 tabular-nums">
              {agoWords(n.minsAgo)}
            </span>
          </div>

          {done ? (
            <div className="orbit-pop mt-2 flex items-center gap-2 text-[12px]">
              <Check
                size={13}
                strokeWidth={2.25}
                className="text-[var(--ok-fg)]"
              />
              <span className="text-neutral-300">{doneText}</span>
              <button
                type="button"
                onClick={() => onDone(false)}
                className="ml-auto text-neutral-500 hover:text-white"
              >
                Undo
              </button>
            </div>
          ) : (
            <>
              {/* The warning on its own line, in the tone's colour; the plain facts under it */}
              <div className="mt-1 text-[12px] leading-relaxed">
                {n.facts
                  .filter((f) => f.flag)
                  .map((f) => (
                    <div key={f.text} className={TONE[n.tone].fg}>
                      {f.text}
                    </div>
                  ))}
                <div className="text-neutral-500">
                  {n.facts
                    .filter((f) => !f.flag)
                    .map((f) => f.text)
                    .join("  ·  ")}
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <ActionButton
                  a={n.primary}
                  primary
                  onDone={() => onDone(true)}
                />
                {n.secondary && (
                  <ActionButton
                    a={n.secondary}
                    primary={false}
                    onDone={() => onDone(true)}
                  />
                )}
                {n.more && (
                  <Link
                    href={n.more.href}
                    className="ml-auto flex items-center gap-1 text-[12px] text-neutral-500 hover:text-white"
                  >
                    {n.more.text}
                    <ArrowRight size={12} strokeWidth={1.75} />
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function ActivityRow({ a, onArchive }: { a: Activity; onArchive: () => void }) {
  return (
    <li className="group relative mx-2">
      <Link
        href={a.href}
        className="flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/[0.03]"
      >
        <span className="mt-px">
          <Mark person={a.person} icon={a.icon} tone={a.tone} size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span
              className={`text-[12.5px] leading-snug ${a.unread ? "text-neutral-300" : "text-neutral-500 [&_span]:font-normal [&_span]:text-neutral-400"}`}
            >
              <Rich text={a.text} />
            </span>
            <span className="shrink-0 pt-px text-[11.5px] text-neutral-500 tabular-nums group-hover:invisible">
              {agoWords(a.minsAgo)}
            </span>
          </span>
          {a.quote && (
            <span className="mt-1.5 line-clamp-2 block border-l-2 border-white/10 pl-2.5 text-[12px] leading-relaxed text-neutral-500">
              {a.quote}
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        aria-label="Archive"
        title="Archive"
        onClick={onArchive}
        className="absolute top-2 right-3 hidden size-6 items-center justify-center rounded-full text-neutral-500 group-hover:flex hover:bg-white/8 hover:text-white"
      >
        <X size={13} strokeWidth={1.75} />
      </button>
    </li>
  );
}

/** The newest update large, the rest as rows with a thumbnail. */
function Promotions() {
  const [first, ...rest] = UPDATES;
  return (
    <div className="p-3">
      <Link
        href={first.href}
        className="group block overflow-hidden rounded-xl ring-1 ring-white/8"
      >
        <UpdateArt u={first} className="aspect-[16/8]" />
        <div className="px-4 py-3.5">
          <div className="text-[11.5px] text-neutral-500">
            New · {first.area} · {updateDate(first)}
          </div>
          <div className="mt-1 text-[14px] font-medium text-white">
            {first.title}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
            {first.line}
          </p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-[12.5px] text-white group-hover:underline">
            {first.cta}
            <ArrowRight size={12} strokeWidth={1.75} />
          </span>
        </div>
      </Link>
      <ul className="mt-2">
        {rest.map((u) => (
          <li key={u.id}>
            <Link
              href={u.href}
              className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]"
            >
              <UpdateArt
                u={u}
                className="h-[44px] w-[72px] shrink-0 rounded-md ring-1 ring-white/8"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-white">
                  {u.title}
                </span>
                <span className="block truncate text-[11.5px] text-neutral-500">
                  {u.area} · {updateDate(u)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/whats-new"
        className="mt-1 flex items-center justify-center gap-1 rounded-xl py-2.5 text-[12.5px] text-neutral-400 hover:text-white"
      >
        Everything on the What&apos;s new page
        <ArrowRight size={12} strokeWidth={1.75} />
      </Link>
    </div>
  );
}
