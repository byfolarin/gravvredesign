"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dropdown } from "./dropdown";

export const PAGE_SIZES = [10, 20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Paging for any table: rows per page is the viewer's pick (10 / 20 / 50 / 100), remembered
 * per table in this browser. Changing the size or the rows goes back to page 1.
 */
export function usePager<T>(rows: T[], key: string, initial: PageSize = 20) {
  const storeKey = `gravv-page-size-${key}`;
  const [size, setSize] = useState<PageSize>(initial);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const n = Number(localStorage.getItem(storeKey));
        if (PAGE_SIZES.includes(n as PageSize)) setSize(n as PageSize);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [storeKey]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages);
  return {
    visible: rows.slice((current - 1) * size, current * size),
    page: current,
    pages,
    size,
    total: rows.length,
    setPage,
    setSize: (n: PageSize) => {
      setSize(n);
      setPage(1);
      try {
        localStorage.setItem(storeKey, String(n));
      } catch {}
    },
  };
}

function pageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

/** The footer every table shares: what's showing · rows per page · pages. */
export function TablePager({
  pager,
  noun = "results",
  className = "mt-2",
}: {
  pager: ReturnType<typeof usePager>;
  /** What the rows are, for "No {noun}". */
  noun?: string;
  className?: string;
}) {
  const { page, pages, size, total, setPage, setSize } = pager;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-white/6 pt-4 text-[13px] text-neutral-500 ${className}`}
    >
      <span className="flex items-center gap-4 tabular-nums">
        <span>
          {total === 0
            ? `No ${noun}`
            : `Showing ${fmt(from)}–${fmt(to)} of ${fmt(total)}`}
        </span>
        <span className="flex items-center gap-2">
          Rows per page
          <Dropdown
            label="Rows per page"
            variant="compact"
            placement="top"
            value={size}
            options={PAGE_SIZES.map((n) => ({ value: n, label: String(n) }))}
            onChange={setSize}
          />
        </span>
      </span>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <PagerButton
            label="Previous page"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </PagerButton>
          {pageList(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap${i}`} className="w-6 text-center text-neutral-600">
                …
              </span>
            ) : (
              <PagerButton
                key={p}
                label={`Page ${p}`}
                active={p === page}
                onClick={() => setPage(p)}
              >
                {p}
              </PagerButton>
            ),
          )}
          <PagerButton
            label="Next page"
            disabled={page === pages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </PagerButton>
        </div>
      )}
    </div>
  );
}

function PagerButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors disabled:opacity-30 ${
        active
          ? "bg-white/10 text-white"
          : "text-neutral-400 enabled:hover:bg-white/[0.06] enabled:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
