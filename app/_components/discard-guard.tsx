"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Don't lose work to a stray click: once anything is entered, closing (scrim, Esc, ×,
 * Cancel) asks first. Untouched forms still close straight away; call `clear()` when the
 * flow finishes so the last close doesn't ask.
 *
 * Wire `markDirty` to the panel's onInputCapture / onChangeCapture / onClickCapture.
 * Anything inside `[data-keeps-clean]` (a search box, a design picker) doesn't count.
 */
export function useDiscardGuard(
  close: () => void,
  /** The flow's own "has something in it" — counts even when no input event fired
   *  (picking from a custom list, a prefilled step). */
  touched = false,
) {
  const [marked, setDirty] = useState(false);
  const [cleared, setCleared] = useState(false);
  const dirty = !cleared && (marked || touched);
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(
    () => (dirty ? setAsking(true) : close()),
    [dirty, close],
  );
  useEffect(() => {
    if (!asking) return;
    // Esc while asking = keep editing (and stop the flow's own Esc from closing).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setAsking(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [asking]);
  const markDirty = useCallback((e: React.SyntheticEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-keeps-clean]")) return;
    if (
      e.type === "input" ||
      e.type === "change" ||
      t.closest(
        '[role="radio"],[role="switch"],[role="checkbox"],[role="option"],[aria-pressed]',
      )
    )
      // After the keystroke lands: updating state mid-event made controlled inputs drop the
      // first character typed into a clean form.
      setTimeout(() => setDirty(true), 0);
  }, []);
  return {
    asking,
    requestClose,
    markDirty,
    /** The flow finished (sent, created): closing no longer asks. */
    clear: () => {
      setDirty(false);
      setCleared(true);
    },
    keep: () => setAsking(false),
    discard: () => {
      setAsking(false);
      close();
    },
  };
}

/** The centred "Discard this …?" card, laid over the flow it guards. */
export function DiscardConfirm({
  title,
  onKeep,
  onDiscard,
  className = "absolute inset-0",
}: {
  /** e.g. "Discard this invite?" */
  title: string;
  onKeep: () => void;
  onDiscard: () => void;
  /** Where the dimmed layer sits; defaults to covering the positioned parent. */
  className?: string;
}) {
  return (
    <div
      className={`${className} z-20 flex items-start justify-center bg-black/40 pt-[18vh]`}
    >
      <div
        role="alertdialog"
        aria-labelledby="discard-title"
        className="orbit-pop w-[360px] rounded-2xl border border-white/10 bg-raised p-5 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <h2 id="discard-title" className="text-[15px] font-medium text-white">
          {title}
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
          What you&apos;ve entered won&apos;t be saved.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onKeep}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="h-9 rounded-full px-4 text-[13px] text-rose-400 hover:bg-rose-500/10"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
