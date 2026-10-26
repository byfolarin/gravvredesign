"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  GripVertical,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import { ShotArt } from "./needs-you";
import {
  DEFAULT_LAYOUT,
  RecentStyleContext,
  WIDGETS,
  type Column,
  type Layout,
  type RecentStyle,
  type WidgetId,
} from "./widgets";

// v5: Accounts-style two columns (Oct 26).
const LAYOUT_KEY = "gravv-overview-layout-v5";
const STYLE_KEY = "gravv-overview-customize";
const RECENT_KEY = "gravv-overview-recent";
type Style = "panel" | "inplace";
type PageState = "filled" | "empty";

const ALL = Object.keys(WIDGETS) as WidgetId[];
const today = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(Date.UTC(2026, 9, 20, 9));

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
const valid = (l: unknown): l is Layout => {
  const x = l as Layout;
  return (
    !!x &&
    Array.isArray(x.main) &&
    Array.isArray(x.side) &&
    [...x.main, ...x.side].every((id) => ALL.includes(id)) &&
    x.main.every((id) => WIDGETS[id].column === "main") &&
    x.side.every((id) => WIDGETS[id].column === "side")
  );
};

/**
 * Everything across Gravv on one page, laid out like Accounts: a wide main column (Balance,
 * Recent transactions) with a column of fact cards beside it. Customize moves and removes
 * things within each column — with a panel (Evernote / Asana) or in place (Midday / Apollo).
 * A new account sees three ways to get started instead.
 */
export function Overview() {
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const [style, setStyle] = useState<Style>("panel");
  const [recent, setRecent] = useState<RecentStyle>("list");
  const [state, setState] = useState<PageState>("filled");
  useEffect(() => {
    const t = setTimeout(() => {
      const l = read<Layout>(LAYOUT_KEY);
      if (valid(l)) setLayout(l);
      const s = read<Style>(STYLE_KEY);
      if (s === "panel" || s === "inplace") setStyle(s);
      const r = read<RecentStyle>(RECENT_KEY);
      if (r === "list" || r === "feed") setRecent(r);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Layout>(layout);
  const [drag, setDrag] = useState<WidgetId | null>(null);
  const [adding, setAdding] = useState<Column | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const shown = editing ? draft : layout;
  const hidden = ALL.filter(
    (id) => !shown.main.includes(id) && !shown.side.includes(id),
  );

  const start = () => {
    setDraft(layout);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setAdding(null);
  };
  const done = () => {
    setLayout(draft);
    write(LAYOUT_KEY, draft);
    setEditing(false);
    setAdding(null);
    setToast("Overview saved — it opens like this next time");
  };
  const reset = () => setDraft(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (adding) setAdding(null);
      else {
        setEditing(false);
        setAdding(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, adding]);

  // ——— Edits: each widget stays in its own column ———
  const remove = (id: WidgetId) =>
    setDraft((d) => ({
      main: d.main.filter((x) => x !== id),
      side: d.side.filter((x) => x !== id),
    }));
  const add = (id: WidgetId) =>
    setDraft((d) => {
      const c = WIDGETS[id].column;
      return d[c].includes(id) ? d : { ...d, [c]: [...d[c], id] };
    });
  /** Move the dragged widget before or after `over`, if they share a column. */
  const moveTo = (over: WidgetId, after: boolean) => {
    if (!drag || drag === over) return;
    const c = WIDGETS[drag].column;
    if (WIDGETS[over].column !== c) return;
    setDraft((d) => {
      const rest = d[c].filter((x) => x !== drag);
      const i = rest.indexOf(over) + (after ? 1 : 0);
      const next = [...rest];
      next.splice(i, 0, drag);
      return next.join() === d[c].join() ? d : { ...d, [c]: next };
    });
  };

  const panel = editing && style === "panel";
  const empty = state === "empty";
  const frame = (id: WidgetId) => (
    <Frame
      key={id}
      id={id}
      editing={editing}
      dragging={drag === id}
      onDragStart={() => setDrag(id)}
      onDragEnd={() => setDrag(null)}
      onOver={(after) => moveTo(id, after)}
      onRemove={() => remove(id)}
    />
  );
  const addTile = (c: Column) =>
    editing &&
    style === "inplace" && (
      <AddTile
        column={c}
        hidden={hidden.filter((id) => WIDGETS[id].column === c)}
        open={adding === c}
        onToggle={() => setAdding((a) => (a === c ? null : c))}
        onAdd={(id) => {
          add(id);
          setAdding(null);
        }}
      />
    );

  return (
    <RecentStyleContext.Provider value={recent}>
      <div className="sidebar-scroll h-full overflow-y-auto">
        {/* Panel style: the page says it's being edited */}
        {panel && (
          <div className="sticky top-0 z-30 border-b border-white/8 bg-[var(--surface)]/95 backdrop-blur">
            <div className="mx-auto flex max-w-(--page-max) items-center justify-between gap-4 px-8 py-3">
              <p className="text-[13px] text-neutral-300">
                <span className="font-medium text-white">
                  Customizing your Overview
                </span>{" "}
                · drag to reorder, × to remove, or add one from the right
              </p>
              <EditButtons onReset={reset} onCancel={cancel} onDone={done} />
            </div>
          </div>
        )}

        <div
          className={`mx-auto px-8 pt-12 pb-16 ${panel ? "max-w-[calc(var(--page-max)+340px)]" : "max-w-(--page-max)"}`}
        >
          <div className={panel ? "flex items-start gap-8" : ""}>
            <div className="min-w-0 flex-1">
              {/* Heading */}
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h1 className="text-[28px] leading-none font-medium tracking-[-0.03em] text-white">
                    Overview
                  </h1>
                  <p className="mt-2 text-[13px] text-neutral-500">{today}</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Prototype switches */}
                  <Dropdown<PageState>
                    label="State"
                    variant="compact"
                    align="right"
                    value={state}
                    options={[
                      { value: "filled", label: "Filled" },
                      { value: "empty", label: "Empty" },
                    ]}
                    onChange={(v) => {
                      setState(v);
                      cancel();
                    }}
                  />
                  {!empty && (
                    <>
                      <Dropdown<RecentStyle>
                        label="Recent transactions"
                        variant="compact"
                        align="right"
                        value={recent}
                        options={[
                          { value: "list", label: "Transactions as a list" },
                          { value: "feed", label: "Transactions as a feed" },
                        ]}
                        onChange={(v) => {
                          setRecent(v);
                          write(RECENT_KEY, v);
                        }}
                      />
                      <Dropdown<Style>
                        label="Customize style"
                        variant="compact"
                        align="right"
                        value={style}
                        options={[
                          { value: "panel", label: "Customize with a panel" },
                          { value: "inplace", label: "Customize in place" },
                        ]}
                        onChange={(s) => {
                          setStyle(s);
                          write(STYLE_KEY, s);
                          setAdding(null);
                        }}
                      />
                      {editing && style === "inplace" ? (
                        <EditButtons
                          onReset={reset}
                          onCancel={cancel}
                          onDone={done}
                        />
                      ) : (
                        !editing && (
                          <button
                            type="button"
                            onClick={start}
                            className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-[12.5px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
                          >
                            <LayoutGrid size={13} strokeWidth={1.75} />
                            Customize
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              </div>

              {empty ? (
                <GetStarted />
              ) : (
                /* Main column + fact cards beside it, like Accounts */
                <div
                  className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
                  onDragOver={(e) => editing && drag && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag && hidden.includes(drag)) add(drag);
                    setDrag(null);
                  }}
                >
                  <div className="flex min-w-0 flex-col gap-12">
                    {shown.main.map(frame)}
                    {addTile("main")}
                  </div>
                  <div className="flex min-w-0 flex-col gap-3">
                    {shown.side.map(frame)}
                    {addTile("side")}
                  </div>
                </div>
              )}
            </div>

            {/* Panel style: what you can add */}
            {panel && (
              <aside className="sticky top-20 hidden w-[300px] shrink-0 lg:block">
                <div className="text-[13px] font-medium text-white">
                  Add widgets
                </div>
                <p className="mt-1 text-[12px] text-neutral-500">
                  Drag one into its column, or Add puts it at the end.
                </p>
                <div className="sidebar-scroll mt-4 max-h-[calc(100dvh/var(--app-zoom)-220px)] space-y-3 overflow-y-auto pr-1">
                  {hidden.map((id) => (
                    <PanelItem
                      key={id}
                      id={id}
                      onDragStart={() => setDrag(id)}
                      onDragEnd={() => setDrag(null)}
                      onAdd={() => add(id)}
                    />
                  ))}
                  {hidden.length === 0 && (
                    <p className="rounded-xl border border-white/8 px-4 py-6 text-center text-[12.5px] text-neutral-500">
                      Every widget is on your Overview. Remove one with × to see
                      it here.
                    </p>
                  )}
                </div>
              </aside>
            )}
          </div>
        </div>

        {toast && (
          <div
            role="status"
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
          >
            {toast}
          </div>
        )}
      </div>
    </RecentStyleContext.Provider>
  );
}

function EditButtons({
  onReset,
  onCancel,
  onDone,
}: {
  onReset: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onReset}
        className="h-8 rounded-full px-3 text-[12.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
      >
        Reset
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-full px-3 text-[12.5px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onDone}
        className="h-8 rounded-full bg-white px-4 text-[12.5px] font-medium text-black hover:bg-neutral-200"
      >
        Done
      </button>
    </div>
  );
}

/**
 * A widget in place. Main-column widgets sit open on the page (no panel, like the Accounts
 * balance); side widgets are the Accounts fact cards — bordered, label on top, figure, note.
 * The title is the link to its page.
 */
function Frame({
  id,
  editing,
  dragging,
  onDragStart,
  onDragEnd,
  onOver,
  onRemove,
}: {
  id: WidgetId;
  editing: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOver: (after: boolean) => void;
  onRemove: () => void;
}) {
  const w = WIDGETS[id];
  const side = w.column === "side";
  const ref = useRef<HTMLElement>(null);
  return (
    <section
      ref={ref}
      draggable={editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        onOver(e.clientY > r.top + r.height / 2);
      }}
      className={`relative min-w-0 rounded-2xl transition-[opacity,box-shadow] ${side ? "border border-white/8 p-5" : editing ? "p-3" : ""} ${editing ? "cursor-grab ring-1 ring-white/12 active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <header
        className={`flex items-center justify-between gap-3 ${side ? "mb-3" : "mb-5"}`}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          {editing && (
            <GripVertical
              size={14}
              strokeWidth={1.75}
              className="-ml-1 shrink-0 text-neutral-500"
              aria-label="Drag to move"
            />
          )}
          {editing ? (
            <h2
              className={`truncate ${side ? "text-[13px] text-neutral-400" : "text-[15px] font-medium text-white"}`}
            >
              {w.title}
            </h2>
          ) : (
            // The title is the way in — no separate "Open" link.
            <Link
              href={w.href}
              className={`group/t flex min-w-0 items-center gap-1 ${side ? "text-[13px] text-neutral-500 hover:text-neutral-200" : "text-[15px] font-medium text-white"}`}
            >
              <span className="truncate">{w.title}</span>
              <ArrowUpRight
                size={13}
                strokeWidth={1.75}
                className="shrink-0 -translate-x-0.5 text-neutral-500 opacity-0 transition-[opacity,transform] group-hover/t:translate-x-0 group-hover/t:opacity-100"
              />
            </Link>
          )}
        </div>
        {editing && (
          <button
            type="button"
            aria-label={`Remove ${w.title}`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        )}
      </header>
      <div className={editing ? "pointer-events-none select-none" : ""}>
        {w.body()}
      </div>
    </section>
  );
}

/** A widget waiting in the panel: what it is, a live miniature, and Add. */
function PanelItem({
  id,
  onDragStart,
  onDragEnd,
  onAdd,
}: {
  id: WidgetId;
  onDragStart: () => void;
  onDragEnd: () => void;
  onAdd: () => void;
}) {
  const w = WIDGETS[id];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-xl border border-white/8 p-3 transition-colors hover:border-white/20 active:cursor-grabbing"
    >
      <div className="pointer-events-none relative h-[86px] overflow-hidden rounded-lg bg-white/[0.025] p-3">
        <div className="w-[200%] origin-top-left scale-50">{w.body()}</div>
      </div>
      <div className="mt-2.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] text-white">{w.title}</div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-neutral-500">
            {w.about} · {w.column === "main" ? "main column" : "side column"}
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/12 px-2.5 text-[12px] text-neutral-200 hover:border-white/30 hover:text-white"
        >
          <Plus size={12} strokeWidth={2} />
          Add
        </button>
      </div>
    </div>
  );
}

/** In-place style: the empty tile at the end of a column, with what can go there. */
function AddTile({
  column,
  hidden,
  open,
  onToggle,
  onAdd,
}: {
  column: Column;
  hidden: WidgetId[];
  open: boolean;
  onToggle: () => void;
  onAdd: (id: WidgetId) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        disabled={!hidden.length}
        onClick={onToggle}
        className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-[13px] text-neutral-400 transition-colors enabled:hover:border-white/30 enabled:hover:text-white disabled:opacity-50 ${column === "main" ? "min-h-[120px]" : "min-h-[96px]"}`}
      >
        <Plus size={16} strokeWidth={1.75} />
        {hidden.length ? "Add widget" : "Everything is showing"}
      </button>
      {open && (
        <div className="orbit-pop absolute top-full left-0 z-20 mt-2 w-[300px] rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]">
          {hidden.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onAdd(id)}
              className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.06]"
            >
              <span className="text-[13px] text-white">
                {WIDGETS[id].title}
              </span>
              <span className="text-[11.5px] text-neutral-500">
                {WIDGETS[id].about}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STARTERS = [
  {
    image: "/needs/accounts.png",
    area: "Accounts",
    time: "Ready in 1–2 business days",
    title: "Open your first account",
    line: "Get local bank details in USD, EUR, GBP or NGN, in your name or a customer's.",
    action: "Open an account",
    href: "/account",
  },
  {
    image: "/needs/cards.png",
    area: "Cards",
    time: "Issued through the API",
    title: "Turn on card issuing",
    line: "Request access once, then issue virtual and physical cards to your team or customers.",
    action: "Request card issuing",
    href: "/cards",
  },
  {
    image: "/needs/payment-links.png",
    area: "Payment links",
    time: "Live in a minute",
    title: "Get paid with a link",
    line: "Share one link and get paid by card, bank transfer or USDC — no website needed.",
    action: "Create a payment link",
    href: "/payment-links",
  },
];

/**
 * A new workspace: nothing to chart yet, so the page shows three ways to start — each card in
 * the Needs you style (its page on the light green, what it is, how long it takes, the action).
 */
function GetStarted() {
  return (
    <div className="mt-10">
      <h2 className="text-[17px] font-medium text-white">Get Gravv working</h2>
      <p className="mt-1 text-[13.5px] text-neutral-400">
        Your balance, money in and out and everything else show up here once
        money starts moving. Start with any of these.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {STARTERS.map((s, i) => (
          <Link
            key={s.title}
            href={s.href}
            className="group block overflow-hidden rounded-2xl ring-1 ring-white/8 transition-shadow hover:ring-white/20"
          >
            <ShotArt
              src={s.image}
              className="aspect-[16/9]"
              moving
              delay={i * 5}
            />
            <div className="px-5 pt-4 pb-5">
              <div className="text-[12px] text-neutral-500">
                {s.area} · {s.time}
              </div>
              <div className="mt-1.5 text-[15px] font-medium text-white">
                {s.title}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                {s.line}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[13px] text-white group-hover:underline">
                {s.action}
                <ArrowRight size={13} strokeWidth={1.75} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
