"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { CopyButton } from "./copy-button";

/**
 * The one destructive confirm (M2). Says exactly what's affected, what happens, and whether
 * it can be undone — then one red button with the real verb. Three weights:
 *   plain        — `lines` + the button
 *   irreversible — adds "This can't be undone"
 *   typed        — `confirmText`: type the name to unlock the button, for live, in-use things
 * From Clerk / Cloudflare / AirOps / Okta delete dialogs.
 */
export function ConfirmDialog({
  title,
  subject,
  lines = [],
  items,
  irreversible = false,
  confirmText,
  action,
  cancel = "Cancel",
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  /** The thing being acted on, as a row: mark, name, detail, and a fact on the right. */
  subject?: { mark?: ReactNode; title: string; sub?: string; meta?: string };
  /** What happens, in plain sentences — the first one is what stops. */
  lines?: string[];
  /** Several things at once (bulk): listed so nobody deletes the wrong set. */
  items?: { title: string; sub?: string }[];
  irreversible?: boolean;
  /** Type this to confirm. Only for actions that are live, in use and can't be undone. */
  confirmText?: string;
  /** The button: the real verb, e.g. "Revoke key". */
  action: string;
  cancel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra fields (a reason, a destination) between the facts and the buttons. */
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const ready = !confirmText || typed.trim() === confirmText;
  // The click that opened it must not land on the backdrop and close it.
  const opened = useRef(0);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    opened.current = performance.now();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        aria-hidden
        onPointerDown={(e) => {
          if (
            e.target === e.currentTarget &&
            e.timeStamp - opened.current > 400
          )
            setArmed(true);
        }}
        onClick={() => armed && onCancel()}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="orbit-pop relative w-[460px] max-w-full rounded-2xl border border-white/10 bg-raised p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="confirm-title"
            className="text-[17px] leading-snug font-medium text-white"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {subject && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/8 px-3.5 py-3">
            {subject.mark}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-medium text-white">
                {subject.title}
              </div>
              {subject.sub && (
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-neutral-500">
                  {subject.sub}
                </div>
              )}
            </div>
            {subject.meta && (
              <span className="shrink-0 text-[12px] text-neutral-400 tabular-nums">
                {subject.meta}
              </span>
            )}
          </div>
        )}

        {items && items.length > 0 && (
          <ul className="sidebar-scroll mt-4 max-h-[180px] divide-y divide-white/6 overflow-y-auto rounded-xl border border-white/8">
            {items.map((it) => (
              <li
                key={it.title + (it.sub ?? "")}
                className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-[13px]"
              >
                <span className="min-w-0 truncate text-neutral-100">
                  {it.title}
                </span>
                {it.sub && (
                  <span className="shrink-0 text-[12px] text-neutral-500 tabular-nums">
                    {it.sub}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {(lines.length > 0 || irreversible) && (
          <ul className="mt-4 space-y-1.5 text-[13px] leading-relaxed text-neutral-300">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
            {irreversible && (
              <li className="text-rose-300">This can&apos;t be undone.</li>
            )}
          </ul>
        )}

        {children && <div className="mt-5">{children}</div>}

        {confirmText && (
          <label className="mt-5 block">
            <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-neutral-400">
              Type
              <span className="inline-flex items-center gap-0.5 rounded-md bg-white/[0.07] py-0.5 pr-0.5 pl-1.5 font-mono text-[12px] text-white">
                {confirmText}
                <CopyButton value={confirmText} label="Copy name" />
              </span>
              to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ready && onConfirm()}
              spellCheck={false}
              autoComplete="off"
              className="mt-2 h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 font-mono text-[13px] text-white outline-none focus:border-white/35"
            />
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          >
            {cancel}
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={onConfirm}
            className="h-9 rounded-full bg-rose-600 px-4 text-[13px] font-medium text-white transition-opacity hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
