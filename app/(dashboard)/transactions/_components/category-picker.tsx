"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";

/** Starting set; people add their own from the picker. */
export const DEFAULT_CATEGORIES = [
  "Customer funding",
  "Payroll",
  "Vendor payment",
  "Treasury",
  "Refund",
  "Fees",
];

/**
 * Pick, change, create or clear a transaction's category.
 * Search narrows the list; typing a name that doesn't exist offers to create it.
 */
export function CategoryPicker({
  value,
  categories,
  onChange,
  onCreate,
  variant = "cell",
  align = "left",
}: {
  value: string | null;
  categories: string[];
  onChange: (v: string | null) => void;
  onCreate: (name: string) => void;
  /** cell: quiet text in a table row · field: bordered control in a panel. */
  variant?: "cell" | "field";
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const q = query.trim();
  const matches = categories.filter((c) =>
    c.toLowerCase().includes(q.toLowerCase()),
  );
  const canCreate =
    q.length > 0 &&
    !categories.some((c) => c.toLowerCase() === q.toLowerCase());
  // Options in keyboard order: matches, then "Create", then "Remove".
  const items: { kind: "pick" | "create" | "clear"; label: string }[] = [
    ...matches.map((c) => ({ kind: "pick" as const, label: c })),
    ...(canCreate ? [{ kind: "create" as const, label: q }] : []),
    ...(value && !q
      ? [{ kind: "clear" as const, label: "Remove category" }]
      : []),
  ];

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const choose = (it: (typeof items)[number]) => {
    if (it.kind === "create") {
      onCreate(it.label);
      onChange(it.label);
    } else onChange(it.kind === "clear" ? null : it.label);
    close();
  };

  const trigger =
    variant === "field"
      ? `h-8 rounded-full border px-3 ${open ? "border-white/30" : "border-white/12 hover:border-white/30"} ${value ? "text-neutral-100" : "text-neutral-400"}`
      : `-ml-2 h-7 rounded-md px-2 ${open ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"} ${value ? "text-neutral-200" : "text-neutral-600 group-hover:text-neutral-400"}`;

  return (
    <div
      ref={root}
      data-category-picker
      className="relative min-w-0"
      // Keep clicks inside from toggling the row underneath.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `Category: ${value}. Change` : "Add category"}
        onClick={() => {
          setCursor(0);
          setOpen((o) => !o);
        }}
        className={`flex max-w-full items-center gap-1 text-[13px] transition-colors ${trigger}`}
      >
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <>
            <Plus size={12} strokeWidth={2} className="shrink-0" />
            <span className="truncate">Add category</span>
          </>
        )}
        {variant === "field" && (
          <ChevronDown
            size={13}
            strokeWidth={1.75}
            className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div
          className={`orbit-pop absolute top-full z-50 mt-1.5 w-60 rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)] ${align === "right" ? "right-0" : "left-0"}`}
        >
          <div className="flex items-center gap-2 border-b border-white/8 px-2.5 pt-1 pb-2">
            <Search
              size={13}
              strokeWidth={1.75}
              className="shrink-0 text-neutral-500"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  close();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(items.length - 1, c + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(0, c - 1));
                } else if (e.key === "Enter" && items[cursor]) {
                  e.preventDefault();
                  choose(items[cursor]);
                }
              }}
              placeholder="Search or create…"
              aria-label="Search or create a category"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </div>
          <div
            role="listbox"
            aria-label="Categories"
            className="max-h-64 overflow-y-auto pt-1"
          >
            {items.map((it, i) => (
              <button
                key={`${it.kind}-${it.label}`}
                type="button"
                role="option"
                aria-selected={it.kind === "pick" && it.label === value}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(it)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  cursor === i
                    ? "bg-white/[0.06] text-white"
                    : "text-neutral-300"
                } ${it.kind === "clear" ? "mt-1 border-t border-white/8 text-neutral-400" : ""}`}
              >
                {it.kind === "create" && (
                  <Plus size={13} strokeWidth={2} className="shrink-0" />
                )}
                {it.kind === "clear" && (
                  <X size={13} strokeWidth={1.75} className="shrink-0" />
                )}
                <span className="flex-1 truncate">
                  {it.kind === "create" ? (
                    <>
                      Create <span className="text-white">“{it.label}”</span>
                    </>
                  ) : (
                    it.label
                  )}
                </span>
                {it.kind === "pick" && (
                  <Check
                    size={13}
                    strokeWidth={2.25}
                    className={it.label === value ? "text-white" : "invisible"}
                  />
                )}
              </button>
            ))}
            {items.length === 0 && (
              <div className="px-2.5 py-2 text-[13px] text-neutral-500">
                No categories yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
