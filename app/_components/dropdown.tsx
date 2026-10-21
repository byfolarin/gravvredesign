"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownOption<T extends string | number> = {
  value: T;
  label: string;
  hint?: string;
  /** Optional mark before the label (flag, logo), shown in the trigger and the menu. */
  icon?: ReactNode;
};

/**
 * Custom select: a trigger button and a styled menu (never the OS-native list).
 * Keyboard: Enter/Space/↓ opens, ↑/↓ move, Enter picks, Esc closes.
 */
export function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  label,
  variant = "pill",
  align = "left",
  placement = "bottom",
  active = false,
  placeholder,
  className = "",
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  /** Accessible name for the control. */
  label: string;
  /** pill: bordered rounded control · bare: no border, for use inside another field · compact: small bordered · chip: soft filled filter chip. */
  variant?: "pill" | "bare" | "compact" | "chip";
  align?: "left" | "right";
  placement?: "bottom" | "top";
  /** Highlight the trigger when a non-default value is picked. */
  active?: boolean;
  /** Text shown on the trigger while nothing is picked (e.g. "Date"); defaults to the current option's label. */
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (v: T) => {
    onChange(v);
    setOpen(false);
  };

  const openMenu = () => {
    setCursor(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };

  const trigger =
    variant === "chip"
      ? `h-8 rounded-lg px-2.5 ${active ? "bg-white/[0.12] text-white" : "bg-white/[0.05] text-neutral-300 hover:bg-white/[0.08] hover:text-white"}`
      : variant === "bare"
        ? "h-9 rounded-l-full pr-2.5 pl-3.5 text-neutral-200 hover:text-white"
        : variant === "compact"
          ? `h-8 rounded-full border bg-surface pr-2.5 pl-3 ${active ? "border-white/30 text-white" : "border-white/10 text-neutral-200 hover:border-white/25"}`
          : `h-9 rounded-full border bg-white/[0.03] pr-3 pl-3.5 ${active ? "border-white/30 text-white" : "border-white/10 text-neutral-300 hover:border-white/20"}`;

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.label}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openMenu();
            return;
          }
          if (!open) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(options.length - 1, c + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(0, c - 1));
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick(options[cursor].value);
          }
        }}
        className={`flex items-center gap-1.5 text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${trigger}`}
      >
        {current.icon && !(!active && placeholder) && (
          <span className="flex shrink-0 items-center">{current.icon}</span>
        )}
        {!active && placeholder ? placeholder : current.label}
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`orbit-pop absolute z-50 min-w-full rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)] ${
            align === "right" ? "right-0" : "left-0"
          } ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setCursor(i)}
                onClick={() => pick(o.value)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap transition-colors ${
                  cursor === i
                    ? "bg-white/[0.06] text-white"
                    : "text-neutral-300"
                }`}
              >
                {o.icon && (
                  <span className="flex shrink-0 items-center">{o.icon}</span>
                )}
                <span className="flex-1">{o.label}</span>
                {o.hint && (
                  <span className="text-[11px] text-neutral-500">{o.hint}</span>
                )}
                <Check
                  size={13}
                  strokeWidth={2.25}
                  className={selected ? "text-white" : "invisible"}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
