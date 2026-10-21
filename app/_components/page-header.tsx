"use client";

import { usePathname } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { findNavLink } from "./sidebar/nav-config";
import { ThemeToggle } from "./theme-toggle";

export function PageHeader() {
  const pathname = usePathname();
  const title = findNavLink(pathname)?.label ?? "";

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/7 px-5">
      <h1 className="text-sm text-white">{title}</h1>
      <button
        type="button"
        className="ml-auto flex h-7 w-60 whitespace-nowrap items-center gap-2 rounded-md border border-white/8 bg-white/3 px-2.5 text-[13px] text-neutral-500 transition-colors hover:border-white/12 hover:text-neutral-300"
      >
        <Search size={14} strokeWidth={1.75} />
        Search…
        <kbd className="ml-auto rounded border border-white/10 px-1 font-sans text-[10px] text-neutral-500">
          ⌘K
        </kbd>
      </button>
      <ThemeToggle />
      <button
        type="button"
        aria-label="Notifications"
        className="relative flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-white/6 hover:text-white"
      >
        <Bell size={15} strokeWidth={1.75} />
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-brand" />
      </button>
    </header>
  );
}
