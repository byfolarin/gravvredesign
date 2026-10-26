"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  Eye,
  FileText,
  HandCoins,
  Landmark,
  Link2,
  Repeat,
  Search,
  Send,
  SunMoon,
  UserPlus,
  Users,
} from "lucide-react";
import { CurrencyFlag } from "../currency-flag";
import { CopyButton } from "../copy-button";
import { toneClass, toneFor } from "../tone";
import {
  QUICK,
  SCOPES,
  index,
  parseAmount,
  type Group,
  type IconName,
  type Item,
} from "./command-index";

export const OPEN_COMMAND = "gravv-open-command";
export const openCommand = () => window.dispatchEvent(new Event(OPEN_COMMAND));

const RECENT_KEY = "gravv-command-recent";
const PER_GROUP = 4;
const ORDER: Group[] = [
  "Actions",
  "Transactions",
  "People",
  "Accounts",
  "Cards",
  "Payment links",
  "Approvals",
  "Disputes",
  "Pages",
];

const ICONS: Record<IconName, typeof Send> = {
  send: Send,
  request: HandCoins,
  move: ArrowLeftRight,
  convert: Repeat,
  account: Landmark,
  invite: UserPlus,
  eye: Eye,
  theme: SunMoon,
  link: Link2,
  recipient: Users,
  page: FileText,
};

function MarkView({ item, size = 28 }: { item: Item; size?: number }) {
  const m = item.mark;
  if (m.kind === "flag") return <CurrencyFlag code={m.code} size={size - 6} />;
  if (m.kind === "wallet")
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-white/[0.07] font-mono text-[10px] text-neutral-300"
        style={{ width: size, height: size }}
      >
        0x
      </span>
    );
  if (m.kind === "icon") {
    const I = ICONS[m.name];
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-lg border border-white/10 text-neutral-300"
        style={{ width: size, height: size }}
      >
        <I size={14} strokeWidth={1.75} />
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${toneClass(toneFor(m.seed))}`}
      style={{ width: size, height: size }}
    >
      {m.text}
    </span>
  );
}

/** The matched part of a title in full ink; the rest quieter. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      <span className="text-neutral-300">{text.slice(0, i)}</span>
      <span className="text-white">{text.slice(i, i + q.length)}</span>
      <span className="text-neutral-300">{text.slice(i + q.length)}</span>
    </>
  );
}

function score(item: Item, q: string, amount: number | null) {
  const t = item.title.toLowerCase();
  if (amount !== null && item.amount !== undefined) {
    const d = Math.abs(item.amount - amount) / Math.max(1, amount);
    if (d < 0.005) return 100;
    if (d < 0.05) return 60;
  }
  if (!q) return 0;
  if (t === q) return 90;
  if (t.startsWith(q)) return 80;
  if (t.split(/\s+/).some((w) => w.startsWith(q))) return 70;
  if (t.includes(q)) return 50;
  if (item.hay.includes(q)) return 30;
  return 0;
}

const shortcutOf = (i: Item) => i.shortcut;

/**
 * ⌘K anywhere: jump to a page, run an action, or find a transaction, person, account, card,
 * link, approval or dispute — by name, ID, last 4, email or amount ("450", "$1.2k"). Before
 * you type: what you opened recently and the actions you take most. Tab moves between
 * scopes; the right side previews the highlighted result.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [recent, setRecent] = useState<Item[]>([]);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const show = () => {
      setOpen(true);
      setQ("");
      setScope(0);
      setCursor(0);
      try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        if (Array.isArray(v)) {
          const all = index();
          setRecent(
            v
              .map((id: string) => all.find((x) => x.id === id))
              .filter(Boolean) as Item[],
          );
        }
      } catch {}
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener(OPEN_COMMAND, show);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_COMMAND, show);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const query = q.trim().toLowerCase();
  const amount = parseAmount(q);
  const sections = useMemo(() => {
    if (!open) return [] as { group: string; items: Item[]; total: number }[];
    const groups = SCOPES[scope].groups;
    if (!query && amount === null) {
      const out: { group: string; items: Item[]; total: number }[] = [];
      if (scope === 0) {
        if (recent.length)
          out.push({
            group: "Recent",
            items: recent.slice(0, 4),
            total: recent.length,
          });
        out.push({ group: "Quick actions", items: QUICK, total: QUICK.length });
        return out;
      }
      const all = index().filter((x) => groups!.includes(x.group));
      return groups!.map((g) => {
        const items = all.filter((x) => x.group === g);
        return { group: g, items: items.slice(0, 12), total: items.length };
      });
    }
    const hits = index()
      .filter((x) => !groups || groups.includes(x.group))
      .map((x) => ({ x, s: score(x, query, amount) }))
      .filter((h) => h.s > 0)
      .sort((a, b) => b.s - a.s);
    return ORDER.filter((g) => !groups || groups.includes(g))
      .map((g) => {
        const items = hits.filter((h) => h.x.group === g).map((h) => h.x);
        return {
          group: g,
          items: items.slice(0, scope === 0 ? PER_GROUP : 30),
          total: items.length,
        };
      })
      .filter((s) => s.items.length)
      .sort((a, b) => {
        // The group holding the best match leads.
        const best = (s: typeof a) =>
          Math.max(...s.items.map((i) => score(i, query, amount)));
        return best(b) - best(a);
      });
  }, [open, scope, query, amount, recent]);

  const flat = sections.flatMap((s) => s.items);
  const active = flat[Math.min(cursor, flat.length - 1)];
  const count = sections.reduce((s, x) => s + x.total, 0);

  useEffect(() => {
    list.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
      const next = [
        item.id,
        ...(Array.isArray(v) ? v : []).filter((x: string) => x !== item.id),
      ].slice(0, 8);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    setOpen(false);
    if (item.run === "hide-amounts")
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "H",
          shiftKey: true,
          bubbles: true,
        }),
      );
    else if (item.run === "theme-light" || item.run === "theme-dark") {
      const mode = item.run === "theme-light" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", mode);
      try {
        localStorage.setItem("gravv-theme", mode);
      } catch {}
    } else if (item.href) router.push(item.href);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className="scrim-in absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Gravv"
        className="content-theme orbit-pop relative flex max-h-[min(640px,76vh)] w-[780px] max-w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-raised shadow-[0_30px_90px_-20px_rgb(0_0_0/0.65)]"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(flat.length - 1, c + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(active);
          } else if (e.key === "Tab") {
            e.preventDefault();
            setScope(
              (s) => (s + (e.shiftKey ? SCOPES.length - 1 : 1)) % SCOPES.length,
            );
            setCursor(0);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (q) setQ("");
            else setOpen(false);
          }
        }}
      >
        {/* Field */}
        <div className="flex items-center gap-3 border-b border-white/8 px-4">
          <Search
            size={16}
            strokeWidth={1.75}
            className="shrink-0 text-neutral-500"
          />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="Search transactions, people, accounts — or type an amount"
            className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-neutral-500"
          />
          <kbd className="rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] text-neutral-500">
            esc
          </kbd>
        </div>

        {/* Scopes */}
        <div
          role="tablist"
          className="flex items-center gap-1 border-b border-white/8 px-3 py-2"
        >
          {SCOPES.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={scope === i}
              onClick={() => {
                setScope(i);
                setCursor(0);
              }}
              className={`h-7 rounded-full px-2.5 text-[12px] transition-colors ${scope === i ? "" : "text-neutral-500 hover:text-neutral-200"}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Results */}
          <div
            ref={list}
            className="sidebar-scroll min-w-0 flex-1 overflow-y-auto p-2"
          >
            {sections.map((s) => (
              <div key={s.group} className="mb-1.5">
                <div className="flex items-baseline justify-between px-2.5 pt-2 pb-1 text-[11.5px] text-neutral-500">
                  <span>{s.group}</span>
                  {s.total > s.items.length && (
                    <span className="tabular-nums">
                      {s.items.length} of {s.total.toLocaleString("en-US")}
                    </span>
                  )}
                </div>
                {s.items.map((item) => {
                  const i = flat.indexOf(item);
                  const on = i === Math.min(cursor, flat.length - 1);
                  return (
                    <button
                      key={`${s.group}-${item.id}`}
                      type="button"
                      data-active={on}
                      onMouseMove={() => setCursor(i)}
                      onClick={() => choose(item)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${on ? "bg-white/[0.07]" : ""}`}
                    >
                      <MarkView item={item} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px]">
                          <Highlight text={item.title} q={query} />
                        </span>
                        <span className="block truncate text-[12px] text-neutral-500">
                          {item.sub}
                        </span>
                      </span>
                      {item.meta && (
                        <span
                          className={`amount shrink-0 text-[12.5px] tabular-nums ${item.tone === "in" ? "text-[var(--ok-fg)]" : item.tone === "rose" ? "text-rose-300" : item.tone === "amber" ? "text-amber-200" : "text-neutral-300"}`}
                        >
                          {item.meta}
                        </span>
                      )}
                      {shortcutOf(item) && (
                        <kbd className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 font-sans text-[11px] text-neutral-500">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {flat.length === 0 && (
              <div className="px-4 py-14 text-center">
                <div className="text-[14px] text-white">
                  Nothing matches “{q}”
                </div>
                <p className="mt-1 text-[12.5px] text-neutral-500">
                  Try a name, an ID, the last 4 of an account or card, or an
                  amount like 450.
                </p>
              </div>
            )}
          </div>

          {/* Preview of the highlighted result */}
          {active && (
            <aside className="hidden w-[290px] shrink-0 flex-col border-l border-white/8 p-5 md:flex">
              <MarkView item={active} size={40} />
              <div className="mt-3 text-[15px] leading-snug font-medium text-white">
                {active.title}
              </div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                {active.sub}
              </div>
              {active.facts && (
                <dl className="mt-5 space-y-2.5 border-t border-white/8 pt-4 text-[12.5px]">
                  {active.facts.map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <dt className="shrink-0 text-neutral-500">{k}</dt>
                      <dd className="amount min-w-0 truncate text-right text-neutral-200 tabular-nums">
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="mt-auto flex items-center gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => choose(active)}
                  className="flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
                >
                  {active.run
                    ? "Run"
                    : active.group === "Pages"
                      ? "Go"
                      : "Open"}
                  <ArrowRight size={12} strokeWidth={2} />
                </button>
                {active.facts?.find(([k]) => k === "ID") && (
                  <span className="flex items-center gap-1 text-[12px] text-neutral-500">
                    Copy ID
                    <CopyButton
                      value={active.facts.find(([k]) => k === "ID")![1]}
                      label="Copy ID"
                    />
                  </span>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Keys */}
        <div className="flex items-center justify-between gap-4 border-t border-white/8 px-4 py-2.5 text-[11.5px] text-neutral-500">
          <span className="flex items-center gap-4">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> Move
            </span>
            <span>
              <Kbd>↵</Kbd> Open
            </span>
            <span>
              <Kbd>Tab</Kbd> Next scope
            </span>
            <span>
              <Kbd>esc</Kbd> {q ? "Clear" : "Close"}
            </span>
          </span>
          {(query || amount !== null) && (
            <span className="tabular-nums">
              {count.toLocaleString("en-US")} result{count === 1 ? "" : "s"}
              {amount !== null &&
                ` · amounts near ${amount.toLocaleString("en-US")}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/10 px-1 py-px font-sans text-[10.5px] text-neutral-400">
      {children}
    </kbd>
  );
}
