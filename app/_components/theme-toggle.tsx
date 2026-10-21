"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle light and dark mode"
      title="Toggle light and dark mode"
      onClick={() => {
        const root = document.documentElement;
        const next =
          root.getAttribute("data-theme") === "light" ? "dark" : "light";
        root.setAttribute("data-theme", next);
        try {
          localStorage.setItem("gravv-theme", next);
        } catch {
          // Storage can be unavailable (private mode); the toggle still works for this visit.
        }
      }}
      className="flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
    >
      <Sun size={15} strokeWidth={1.75} className="theme-icon-sun" />
      <Moon size={15} strokeWidth={1.75} className="theme-icon-moon" />
    </button>
  );
}
