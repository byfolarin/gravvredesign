"use client";

import { useEffect, useRef, useState } from "react";
import { GripVertical, LayoutGrid, Plus, X } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import {
  DEFAULT_LAYOUT,
  Open,
  WIDGETS,
  type Slot,
  type WidgetId,
  type Width,
} from "./widgets";

// v4: Needs you hidden by default, Recent transactions full width (Oct 26).
const LAYOUT_KEY = "gravv-overview-layout-v4";
const STYLE_KEY = "gravv-overview-customize";
type Style = "panel" | "inplace";

const SPAN: Record<Width, string> = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
};
const WIDTH_LABEL: Record<Width, string> = {
  2: "⅓",
  3: "½",
  4: "⅔",
  6: "Full",
};
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
const valid = (l: unknown): l is Slot[] =>
  Array.isArray(l) &&
  l.every((s) => s && ALL.includes(s.id) && [2, 3, 4, 6].includes(s.w));

/**
 * Everything across Gravv on one page, arranged the way each person wants it. Customize
 * comes in two styles (switch in the header): with a panel — edit mode with a bar, drag
 * handles, widths and a side panel of widgets to add (Evernote / Asana) — or in place —
 * handles and × where the widgets sit, plus an Add tile (Midday / Apollo).
 */
export function Overview() {
  const [layout, setLayout] = useState<Slot[]>(DEFAULT_LAYOUT);
  const [style, setStyle] = useState<Style>("panel");
  useEffect(() => {
    const t = setTimeout(() => {
      const l = read<Slot[]>(LAYOUT_KEY);
      if (valid(l)) setLayout(l);
      const s = read<Style>(STYLE_KEY);
      if (s === "panel" || s === "inplace") setStyle(s);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Slot[]>(layout);
  const [drag, setDrag] = useState<WidgetId | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const shown = editing ? draft : layout;
  const hidden = ALL.filter((id) => !shown.some((s) => s.id === id));

  const start = () => {
    setDraft(layout);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setAdding(false);
  };
  const done = () => {
    setLayout(draft);
    write(LAYOUT_KEY, draft);
    setEditing(false);
    setAdding(false);
    setToast("Overview saved — it opens like this next time");
  };
  const reset = () => setDraft(DEFAULT_LAYOUT);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (adding) setAdding(false);
      else cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing, adding]);

  // ——— Edits ———
  const remove = (id: WidgetId) =>
    setDraft((d) => d.filter((s) => s.id !== id));
  const resize = (id: WidgetId, w: Width) =>
    setDraft((d) => d.map((s) => (s.id === id ? { ...s, w } : s)));
  const add = (id: WidgetId, at?: number) =>
    setDraft((d) => {
      if (d.some((s) => s.id === id)) return d;
      const w = WIDGETS[id].widths.includes(3) ? 3 : WIDGETS[id].widths[0];
      const next = [...d];
      next.splice(at ?? next.length, 0, { id, w });
      return next;
    });
  /** Move the dragged widget next to `over` — before or after, by where the pointer is. */
  const moveTo = (over: WidgetId, after: boolean) => {
    if (!drag || drag === over) return;
    setDraft((d) => {
      const item = d.find((s) => s.id === drag) ?? {
        id: drag,
        w: WIDGETS[drag].widths.includes(3) ? 3 : WIDGETS[drag].widths[0],
      };
      const rest = d.filter((s) => s.id !== drag);
      const i = rest.findIndex((s) => s.id === over) + (after ? 1 : 0);
      const next = [...rest];
      next.splice(i, 0, item);
      const same =
        next.length === d.length && next.every((s, k) => s.id === d[k].id);
      return same ? d : next;
    });
  };

  const panel = editing && style === "panel";

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      {/* Panel style: the page says it's being edited */}
      {panel && (
        <div className="sticky top-0 z-30 border-b border-white/8 bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-(--page-max) items-center justify-between gap-4 px-8 py-3">
            <p className="text-[13px] text-neutral-300">
              <span className="font-medium text-white">
                Customizing your Overview
              </span>{" "}
              · drag widgets where you want them, set their width, or add one
              from the right
            </p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={reset}
                className="h-8 rounded-full px-3 text-[12.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={cancel}
                className="h-8 rounded-full px-3 text-[12.5px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={done}
                className="h-8 rounded-full bg-white px-4 text-[12.5px] font-medium text-black hover:bg-neutral-200"
              >
                Done
              </button>
            </div>
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
                    setAdding(false);
                  }}
                />
                {editing && style === "inplace" ? (
                  <>
                    <button
                      type="button"
                      onClick={reset}
                      className="h-8 rounded-full px-3 text-[12.5px] text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={cancel}
                      className="h-8 rounded-full px-3 text-[12.5px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={done}
                      className="h-8 rounded-full bg-white px-4 text-[12.5px] font-medium text-black hover:bg-neutral-200"
                    >
                      Done
                    </button>
                  </>
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
              </div>
            </div>

            {/* The widgets */}
            <div
              className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-6"
              onDragOver={(e) => editing && drag && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                // Dropped from the panel onto empty space: it goes at the end.
                if (drag && !draft.some((s) => s.id === drag)) add(drag);
                setDrag(null);
              }}
            >
              {shown.map((s) => (
                <Frame
                  key={s.id}
                  slot={s}
                  editing={editing}
                  style={style}
                  dragging={drag === s.id}
                  onDragStart={() => setDrag(s.id)}
                  onDragEnd={() => setDrag(null)}
                  onOver={(after) => moveTo(s.id, after)}
                  onRemove={() => remove(s.id)}
                  onResize={(w) => resize(s.id, w)}
                />
              ))}
              {editing && style === "inplace" && (
                <AddTile
                  hidden={hidden}
                  open={adding}
                  onToggle={() => setAdding((a) => !a)}
                  onAdd={(id) => {
                    add(id);
                    setAdding(false);
                  }}
                />
              )}
              {shown.length === 0 && !editing && (
                <div className="py-20 text-center text-[13px] text-neutral-500 lg:col-span-6">
                  Your Overview is empty — Customize to add widgets.
                </div>
              )}
            </div>
          </div>

          {/* Panel style: what you can add */}
          {panel && (
            <aside className="sticky top-20 hidden w-[300px] shrink-0 lg:block">
              <div className="text-[13px] font-medium text-white">
                Add widgets
              </div>
              <p className="mt-1 text-[12px] text-neutral-500">
                Drag one into place, or Add puts it at the end.
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
  );
}

function Frame({
  slot: s,
  editing,
  style,
  dragging,
  onDragStart,
  onDragEnd,
  onOver,
  onRemove,
  onResize,
}: {
  slot: Slot;
  editing: boolean;
  style: Style;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOver: (after: boolean) => void;
  onRemove: () => void;
  onResize: (w: Width) => void;
}) {
  const w = WIDGETS[s.id];
  const ref = useRef<HTMLElement>(null);
  return (
    <section
      ref={ref}
      draggable={editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", s.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (!editing) return;
        e.preventDefault();
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        // Wide widgets read top/bottom; narrow ones left/right.
        const after =
          s.w === 6
            ? e.clientY > r.top + r.height / 2
            : e.clientX > r.left + r.width / 2;
        onOver(after);
      }}
      className={`relative min-w-0 rounded-2xl transition-[opacity,box-shadow] ${w.bare ? (editing ? "p-3" : "") : "bg-white/[0.025] p-6"} ${SPAN[s.w]} ${editing ? "cursor-grab ring-1 ring-white/12 active:cursor-grabbing" : ""} ${dragging ? "opacity-40" : ""}`}
    >
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {editing && (
            <GripVertical
              size={14}
              strokeWidth={1.75}
              className="-ml-1 shrink-0 text-neutral-500"
              aria-label="Drag to move"
            />
          )}
          <h2 className="truncate text-[13.5px] font-medium text-white">
            {w.title}
          </h2>
        </div>
        {editing ? (
          <div
            className="flex shrink-0 items-center gap-1"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {style === "panel" && w.widths.length > 1 && (
              <div
                role="tablist"
                aria-label="Width"
                className="flex items-center gap-0.5"
              >
                {w.widths.map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={s.w === k}
                    onClick={() => onResize(k)}
                    className={`h-6 min-w-6 rounded-full px-2 text-[11.5px] ${s.w === k ? "" : "text-neutral-500 hover:text-neutral-200"}`}
                  >
                    {WIDTH_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              aria-label={`Remove ${w.title}`}
              onClick={onRemove}
              className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          </div>
        ) : (
          <Open href={w.href} />
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
            {w.about}
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

/** In-place style: the empty tile at the end, with the widgets you can add. */
function AddTile({
  hidden,
  open,
  onToggle,
  onAdd,
}: {
  hidden: WidgetId[];
  open: boolean;
  onToggle: () => void;
  onAdd: (id: WidgetId) => void;
}) {
  return (
    <div className="relative lg:col-span-2">
      <button
        type="button"
        aria-expanded={open}
        disabled={!hidden.length}
        onClick={onToggle}
        className="flex h-full min-h-[148px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-[13px] text-neutral-400 transition-colors enabled:hover:border-white/30 enabled:hover:text-white disabled:opacity-50"
      >
        <Plus size={16} strokeWidth={1.75} />
        {hidden.length ? "Add widget" : "Every widget is showing"}
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
