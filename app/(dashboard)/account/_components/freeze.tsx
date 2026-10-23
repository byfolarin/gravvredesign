"use client";

import { useEffect, useState } from "react";
import { Snowflake, X } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import {
  AS_OF,
  FREEZE_REASONS,
  waitingOn,
  type Account,
  type Freeze,
  type FreezeReason,
  type FreezeScope,
} from "../_data";
import { SYMBOL } from "./currency";
import { Segmented } from "./open-account-flow";

const DAY = 24 * 60 * 60 * 1000;
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const money = (a: Account, v: number) =>
  `${SYMBOL[a.currency]}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function M({ a, v }: { a: Account; v: number }) {
  return <span className="amount tabular-nums">{money(a, v)}</span>;
}

export function ago(iso: string) {
  const m = Math.max(0, (AS_OF - new Date(iso).getTime()) / 60_000);
  if (m < 2) return "just now";
  if (m < 60) return `${Math.round(m)} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h ago`;
  const d = Math.round(m / 60 / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const payments = (n: number) => `${n} scheduled payment${n === 1 ? "" : "s"}`;

/** The one-line effect of a freeze, for the table under the chip. */
export function freezeShort(f: Freeze) {
  return f.scope === "all" ? "Nothing in or out" : "Money out stopped";
}

/**
 * On a frozen account (row preview and details sheet): who froze it, when and why,
 * what that's doing right now, and the way out.
 */
export function FreezeNotice({
  account: a,
  freeze: f,
  onEdit,
  onUnfreeze,
  stacked = false,
  className = "",
}: {
  account: Account;
  freeze: Freeze;
  onEdit: () => void;
  onUnfreeze: () => void;
  /** Narrow places (the sheet): actions go under the words. */
  stacked?: boolean;
  className?: string;
}) {
  const actions = (
    <div
      className={`flex shrink-0 items-center gap-1.5 ${stacked ? "mt-3 flex-row-reverse justify-end" : ""}`}
    >
      <button
        type="button"
        onClick={onEdit}
        className="h-8 rounded-full px-3 text-[12.5px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onUnfreeze}
        className="h-8 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
      >
        Unfreeze
      </button>
    </div>
  );
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Snowflake
        size={15}
        strokeWidth={1.75}
        className="mt-[3px] shrink-0 text-sky-300"
      />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed whitespace-normal">
        <p className="text-neutral-100">
          Frozen {ago(f.at)} by {f.by} — {f.reason.toLowerCase()}.
        </p>
        <p className="text-neutral-400">
          {f.scope === "all" ? (
            f.held > 0 ? (
              <>
                Nothing moves in or out. <M a={a} v={f.held} /> has arrived and
                is held.
              </>
            ) : (
              "Nothing moves in or out. Money that arrives is held, not returned."
            )
          ) : (
            "Payouts and transfers out are stopped. Money coming in still lands."
          )}
          {f.waiting.count > 0 && (
            <>
              {" "}
              {payments(f.waiting.count)} (<M a={a} v={f.waiting.amount} />)
              waiting.
            </>
          )}
          {f.until &&
            ` Unfreezes by itself ${dateFmt.format(new Date(f.until))}.`}
        </p>
        {f.note && <p className="mt-1 text-neutral-300">“{f.note}”</p>}
        {stacked && actions}
      </div>
      {!stacked && actions}
    </div>
  );
}

type Until = "none" | "keep" | "1d" | "7d" | "30d";
const UNTIL_DAYS: Record<"1d" | "7d" | "30d", number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
};
/** Don't tip anyone off: fraud and compliance freezes don't email the holder by default. */
const quietFor = (r: FreezeReason) =>
  r === "Suspected fraud" || r === "Compliance review";

/**
 * Freezing as a decision, not a toggle: how much to stop, what that does to money already
 * moving, why (your team sees it), whether it lifts by itself, and whether the holder hears.
 */
export function FreezeDialog({
  account: a,
  editing,
  onCancel,
  onConfirm,
}: {
  account: Account;
  /** Changing an existing freeze. */
  editing?: Freeze;
  onCancel: () => void;
  onConfirm: (f: Freeze) => void;
}) {
  const [scope, setScope] = useState<FreezeScope>(editing?.scope ?? "out");
  const [reason, setReason] = useState<FreezeReason>(
    editing?.reason ?? "Suspected fraud",
  );
  const [note, setNote] = useState(editing?.note ?? "");
  const [until, setUntil] = useState<Until>(
    editing ? (editing.until ? "keep" : "none") : "none",
  );
  const [tellSet, setTell] = useState<boolean | null>(
    editing ? editing.told : null,
  );
  const tell = tellSet ?? !quietFor(reason);
  const sub = a.tier === "Sub account";
  const first =
    a.category === "Business" ? a.customer.name : a.customer.name.split(" ")[0];
  const waiting = editing?.waiting ?? waitingOn(a);
  const last4 = a.accountNumber.slice(-4);

  const touched = editing
    ? scope !== editing.scope ||
      reason !== editing.reason ||
      note !== (editing.note ?? "") ||
      until !== (editing.until ? "keep" : "none") ||
      tell !== editing.told
    : scope !== "out" ||
      reason !== "Suspected fraud" ||
      note !== "" ||
      until !== "none" ||
      tellSet !== null;
  const guard = useDiscardGuard(onCancel, touched);
  const needsNote = reason === "Other" && note.trim().length < 3;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guard.asking) return;
      // A picker that's open closes first.
      if (document.querySelector('[role="dialog"] [role="listbox"]')) return;
      e.stopImmediatePropagation();
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [guard]);

  const stops = [
    `Payouts and transfers out of ••${last4}`,
    ...(a.type === "Card" ? ["Card spend funded from it"] : []),
    ...(scope === "all"
      ? ["Money coming in is held — not sent back, added when you unfreeze"]
      : []),
    ...(waiting.count
      ? [
          `${payments(waiting.count)} (${money(a, waiting.amount)}) wait until you unfreeze`,
        ]
      : []),
  ];
  const keeps = [
    ...(scope === "out" ? ["Money coming in lands as usual"] : []),
    "Balance, statements and details stay visible",
    "You can unfreeze it any time",
  ];

  const confirm = () => {
    guard.clear();
    onConfirm({
      scope,
      reason,
      note: note.trim() || undefined,
      by: editing?.by ?? "You",
      at: editing?.at ?? new Date(AS_OF).toISOString(),
      until:
        until === "keep"
          ? editing?.until
          : until === "none"
            ? undefined
            : new Date(AS_OF + UNTIL_DAYS[until] * DAY).toISOString(),
      held: editing?.held ?? 0,
      waiting,
      told: sub && tell,
    });
  };

  const field =
    "[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={guard.requestClose}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="freeze-title"
        onInputCapture={guard.markDirty}
        className="orbit-pop relative w-[520px] max-w-full rounded-2xl border border-white/10 bg-raised p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="freeze-title"
              className="text-[17px] font-medium text-white"
            >
              {editing ? `Edit freeze on ${a.label}` : `Freeze ${a.label}?`}
            </h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              {a.customer.name} · {a.bank} ••{last4} ·{" "}
              <span className="amount text-neutral-300 tabular-nums">
                {money(a, a.balance)}
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={guard.requestClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* How much to stop */}
        <div className="mt-6 text-[12px] text-neutral-400">Stop</div>
        <div className="mt-1.5">
          <Segmented<FreezeScope>
            value={scope}
            onChange={setScope}
            options={[
              { value: "out", label: "Money out" },
              { value: "all", label: "Money in and out" },
            ]}
          />
        </div>

        {/* What that does, both ways */}
        <div className="mt-4 grid grid-cols-2 gap-6 border-y border-white/8 py-4 text-[12.5px] leading-relaxed">
          <div>
            <div className="text-[12px] font-medium text-white">Stops</div>
            <ul className="mt-1.5 space-y-1.5 text-neutral-300">
              {stops.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[12px] font-medium text-white">
              Keeps working
            </div>
            <ul className="mt-1.5 space-y-1.5 text-neutral-400">
              {keeps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[12px] text-neutral-400">Reason</div>
            <div className="mt-1.5">
              <Dropdown
                label="Reason"
                value={reason}
                options={FREEZE_REASONS.map((r) => ({ value: r, label: r }))}
                onChange={setReason}
                className={field}
              />
            </div>
          </div>
          <div>
            <div className="text-[12px] text-neutral-400">Unfreeze</div>
            <div className="mt-1.5">
              <Dropdown<Until>
                label="Unfreeze"
                value={until}
                options={[
                  { value: "none", label: "When someone unfreezes it" },
                  ...(editing?.until
                    ? [
                        {
                          value: "keep" as const,
                          label: `By itself ${dateFmt.format(new Date(editing.until))}`,
                        },
                      ]
                    : []),
                  { value: "1d", label: "By itself in 24 hours" },
                  { value: "7d", label: "By itself in 7 days" },
                  { value: "30d", label: "By itself in 30 days" },
                ]}
                onChange={setUntil}
                className={field}
              />
            </div>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] text-neutral-400">
            What happened{" "}
            <span className="text-neutral-600">
              {reason === "Other" ? "· needed for Other" : "· optional"}
            </span>
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Your team sees this on the account"
            className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
          />
        </label>

        {sub && (
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="text-[13px]">
              <div className="text-neutral-200">
                Email {first} that it&apos;s frozen
              </div>
              <div className="mt-0.5 text-[12px] text-neutral-500">
                {quietFor(reason)
                  ? "Off by default for fraud and compliance — so no one is tipped off."
                  : `${a.customer.email} · they see the reason, not your note.`}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tell}
              aria-label={`Email ${first}`}
              onClick={() => setTell(!tell)}
              className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${tell ? "bg-[var(--color-white)]" : "bg-white/15"}`}
            >
              <span
                className={`absolute top-0.5 size-4 rounded-full bg-[var(--color-black)] transition-[left] ${tell ? "left-[18px]" : "left-0.5"}`}
              />
            </button>
          </div>
        )}

        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={guard.requestClose}
            className="h-9 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          >
            {editing ? "Cancel" : "Keep it active"}
          </button>
          <button
            type="button"
            disabled={needsNote || (!!editing && !touched)}
            onClick={confirm}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {editing
              ? "Save changes"
              : scope === "all"
                ? "Freeze in and out"
                : "Freeze money out"}
          </button>
        </div>

        {guard.asking && (
          <DiscardConfirm
            title={editing ? "Discard these changes?" : "Discard this freeze?"}
            onKeep={guard.keep}
            onDiscard={guard.discard}
            className="fixed inset-0"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Unfreezing says what comes back: payouts work again, held money joins the balance, and
 * the payments that waited either go now or get cancelled — your call.
 */
export function UnfreezeDialog({
  account: a,
  freeze: f,
  onCancel,
  onConfirm,
}: {
  account: Account;
  freeze: Freeze;
  onCancel: () => void;
  onConfirm: (sendWaiting: boolean) => void;
}) {
  const [send, setSend] = useState<"send" | "cancel">("send");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={onCancel}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unfreeze-title"
        className="orbit-pop relative w-[460px] max-w-full rounded-2xl border border-white/10 bg-raised p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="unfreeze-title"
              className="text-[17px] font-medium text-white"
            >
              Unfreeze {a.label}?
            </h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              Frozen {ago(f.at)} by {f.by} · {f.reason}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        {f.note && (
          <p className="mt-3 text-[13px] leading-relaxed text-neutral-300">
            “{f.note}”
          </p>
        )}

        <div className="mt-5 border-y border-white/8 py-4">
          <div className="text-[12px] font-medium text-white">Comes back</div>
          <ul className="mt-1.5 space-y-1.5 text-[12.5px] leading-relaxed text-neutral-300">
            <li>Payouts and transfers out of ••{a.accountNumber.slice(-4)}</li>
            {f.scope === "all" && (
              <li>
                {f.held > 0
                  ? `${money(a, f.held)} that arrived while frozen joins the balance`
                  : "Money coming in lands as usual"}
              </li>
            )}
            {f.told && (
              <li>{a.customer.name} gets an email that it&apos;s open again</li>
            )}
          </ul>
        </div>

        {f.waiting.count > 0 && (
          <div className="mt-4">
            <div className="text-[12px] text-neutral-400">
              {payments(f.waiting.count)} ({money(a, f.waiting.amount)}) waited
            </div>
            <div className="mt-1.5">
              <Segmented<"send" | "cancel">
                value={send}
                onChange={setSend}
                options={[
                  { value: "send", label: "Send them now" },
                  { value: "cancel", label: "Cancel them" },
                ]}
              />
            </div>
          </div>
        )}

        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          >
            Keep frozen
          </button>
          <button
            type="button"
            onClick={() => onConfirm(send === "send")}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            Unfreeze
          </button>
        </div>
      </div>
    </div>
  );
}
