"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import {
  DEPOSIT_WINDOW_MS,
  SOURCES,
  dateFmt,
  fmt,
  timeFmt,
  type Destination,
  type Order,
} from "../_data";

export type MenuItem = { label: string; run: () => void; danger?: boolean };

/** ⋮ row menu (stops row clicks). */
export function RowMenu({
  items,
  label = "More",
}: {
  items: MenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  if (!items.length) return null;
  return (
    <div
      ref={ref}
      className="relative inline-block"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/6 hover:text-white"
      >
        <Ellipsis size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-1 min-w-[190px] rounded-xl border border-white/10 bg-raised p-1.5 text-left shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.run();
              }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap hover:bg-white/[0.06] ${
                it.danger ? "text-rose-400" : "text-neutral-200"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Plain-text trade confirmation, downloaded as a file. */
export function downloadConfirmation(o: Order, ssis: Destination[]) {
  const src = SOURCES.find((s) => s.id === o.sourceId);
  const dst = ssis.find((d) => d.id === o.destinationId);
  const when = (t?: number) =>
    t ? `${dateFmt.format(t)} ${timeFmt.format(t)} UTC` : "—";
  const text = [
    "GRAVV TRADE DESK — TRADE CONFIRMATION",
    "",
    `Order            ${o.id}`,
    `Status           ${o.status}`,
    `Sold             ${fmt(o.sell, o.sellAmount)}`,
    `Bought           ${fmt(o.get, o.getAmount)}`,
    `Rate             1 ${o.sell} = ${fmt(o.get, o.rate, o.rate >= 10 ? 2 : 4)}`,
    `Fees             None (spread included)`,
    `Funded from      ${src?.label ?? "—"}`,
    `Paid out to      ${dst ? `${dst.label} · ${dst.detail}` : "—"}`,
    `Placed by        ${o.placedBy}`,
    `Accepted         ${when(o.steps.accepted)}`,
    `Settled          ${when(o.steps.settled)}`,
    "",
    "Kredete Technologies Ltd · issued by Gravv",
  ].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${o.id}-confirmation.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const payoutText = (o: Order, ssis: Destination[]) => {
  const d = ssis.find((x) => x.id === o.destinationId);
  return d ? `${d.label} · ${d.detail} · ${d.number}` : "";
};

/**
 * What went wrong on an order, in plain words, with the next step. Shown in the inline
 * preview for Payout returned / Short deposit / Rejected / Cancelled.
 */
export function ProblemPanel({
  order: o,
  ssis,
  onRetry,
  onSentRest,
  onSettleReceived,
  onRequestAgain,
}: {
  order: Order;
  ssis: Destination[];
  onRetry: (destinationId: string) => void;
  onSentRest: () => void;
  onSettleReceived: () => void;
  onRequestAgain: () => void;
}) {
  const p = o.problem;
  const [retryTo, setRetryTo] = useState(o.destinationId);
  if (!p) return null;
  const accounts = ssis.filter((d) => d.asset === o.get && !d.removed);
  const dst = ssis.find((d) => d.id === o.destinationId);

  const shell = (
    title: string,
    body: ReactNode,
    actions: ReactNode,
    tone: "problem" | "neutral" = "problem",
  ) => (
    <div
      className="mt-4 border-t border-white/8 pt-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className={`text-[13px] ${tone === "problem" ? "text-rose-400" : "text-neutral-200"}`}
      >
        {title}
      </div>
      <div className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-neutral-400">
        {body}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
  const primary = (label: string, run: () => void) => (
    <button
      type="button"
      onClick={run}
      className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black hover:bg-neutral-200"
    >
      {label}
    </button>
  );
  const secondary = (label: string, run: () => void) => (
    <button
      type="button"
      onClick={run}
      className="h-8 rounded-full border border-white/12 px-3.5 text-xs text-neutral-200 hover:border-white/30"
    >
      {label}
    </button>
  );

  if (p.kind === "returned")
    return shell(
      "The payout came back",
      <>
        {p.note} The{" "}
        <span className="amount text-neutral-200">
          {fmt(o.get, o.getAmount)}
        </span>{" "}
        is held by the desk at your rate — nothing is lost. Send it again to{" "}
        {dst?.label ?? "the same account"} once it&apos;s fixed, or to another{" "}
        {o.get} account.
      </>,
      <>
        <Dropdown
          label="Retry to"
          variant="compact"
          value={retryTo}
          options={accounts.map((d) => ({
            value: d.id,
            label: d.label,
            hint: d.isDefault ? "Default" : undefined,
          }))}
          onChange={setRetryTo}
        />
        {primary(
          retryTo === o.destinationId ? "Retry payout" : "Pay out here instead",
          () => onRetry(retryTo),
        )}
      </>,
    );
  if (p.kind === "short") {
    const missing = o.sellAmount - p.received;
    return shell(
      "Your deposit arrived short",
      <>
        We received{" "}
        <span className="amount text-neutral-200">
          {fmt(o.sell, p.received)}
        </span>{" "}
        of{" "}
        <span className="amount text-neutral-200">
          {fmt(o.sell, o.sellAmount)}
        </span>{" "}
        — usually a network fee taken on the way. Send the remaining{" "}
        <span className="amount text-neutral-200">{fmt(o.sell, missing)}</span>{" "}
        with reference {o.id} by{" "}
        {timeFmt.format(o.steps.accepted + DEPOSIT_WINDOW_MS)}, or settle what
        arrived at the same rate.
      </>,
      <>
        {primary("I've sent the rest", onSentRest)}
        {secondary(
          `Settle ${fmt(o.sell, p.received)} instead`,
          onSettleReceived,
        )}
      </>,
    );
  }
  if (p.kind === "rejected")
    return shell(
      `Rejected by ${p.by}`,
      <>&ldquo;{p.note}&rdquo; Nothing was taken and the quote was released.</>,
      primary("Request again", onRequestAgain),
    );
  if (p.kind === "expired")
    return shell(
      "Cancelled — no deposit arrived",
      <>
        Nothing reached the desk within 2 hours, so the order was cancelled and
        its rate released.
      </>,
      primary("Request again", onRequestAgain),
      "neutral",
    );
  return shell(
    `Cancelled by ${p.by}`,
    <>Nothing was taken and the quote was released.</>,
    primary("Request again", onRequestAgain),
    "neutral",
  );
}
