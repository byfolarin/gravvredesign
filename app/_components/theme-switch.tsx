"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { Check } from "lucide-react";

type Mode = "light" | "dark" | "system";
const KEY = "gravv-theme";
const MODES: { mode: Mode; label: string; icon: IconSvgElement }[] = [
  { mode: "light", label: "Light", icon: Sun03Icon },
  { mode: "dark", label: "Dark", icon: Moon02Icon },
  { mode: "system", label: "System", icon: ComputerIcon },
];

const systemTheme = () =>
  matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
function apply(mode: Mode) {
  document.documentElement.setAttribute(
    "data-theme",
    mode === "system" ? systemTheme() : mode,
  );
}

/** The saved theme choice. "System" follows the OS and keeps following it while the page is open. */
function useThemeMode() {
  const [mode, setMode] = useState<Mode>("system");

  // Read the saved choice after hydration so server and client markup agree.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved === "light" || saved === "dark") setMode(saved);
      } catch {
        // Storage unavailable; stay on System.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const choose = (next: Mode) => {
    setMode(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable; the choice still applies for this visit.
    }
  };
  return { mode, choose };
}

/** Theme as a section of the account menu: a label and three checkable rows. */
export function ThemeMenuItems({ itemClass }: { itemClass: string }) {
  const { mode, choose } = useThemeMode();
  return (
    <div role="group" aria-label="Theme">
      <div className="px-2.5 pt-1.5 pb-1 text-[11px] text-neutral-500">
        Theme
      </div>
      {MODES.map(({ mode: m, label, icon }) => (
        <button
          key={m}
          type="button"
          role="menuitemradio"
          aria-checked={mode === m}
          onClick={() => choose(m)}
          className={`${itemClass} gap-2.5`}
        >
          <HugeiconsIcon
            icon={icon}
            size={15}
            strokeWidth={1.6}
            className="text-neutral-400"
          />
          <span className="flex-1">{label}</span>
          {mode === m && <Check size={13} strokeWidth={2.25} />}
        </button>
      ))}
    </div>
  );
}
