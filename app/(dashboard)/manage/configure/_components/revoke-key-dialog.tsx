"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import { AS_OF, ago, type ApiKey } from "../_data";

/** The last 24 hours of calls, one bar per hour — busy in the working day, quiet at night. */
function hourly(total: number, seed: string) {
  const s = [...seed].reduce((h, c) => h + c.charCodeAt(0), 0);
  const raw = Array.from({ length: 24 }, (_, i) => {
    const hour = (i + 11) % 24; // ends at 10:00, now
    const day = hour >= 8 && hour <= 19 ? 1 : 0.28;
    return day * (0.7 + 0.3 * Math.abs(Math.sin((i + 1) * 1.9 + s)));
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => Math.round((v / sum) * total));
}

/**
 * Revoking a key, designed around what it would break. If the key is live and taking
 * traffic, the dialog leads with that traffic — the last 24 hours up to a pulsing "now" and
 * where it comes from — and offers the safe path first: roll it (new secret, 24h overlap).
 * Revoking stays one choice away and asks you to press and hold. An unused key is one click.
 */
export function RevokeKeyDialog({
  k,
  usage,
  source,
  onCancel,
  onRevoke,
  onRoll,
}: {
  k: ApiKey;
  usage?: { requests: number; lastIp: string };
  /** The allowlist entry the last call came from, e.g. "Production servers (AWS eu-west-1)". */
  source?: string;
  onCancel: () => void;
  onRevoke: () => void;
  onRoll: () => void;
}) {
  const live =
    !!usage && !!k.lastUsed && AS_OF - Date.parse(k.lastUsed) < 7 * 86_400_000;
  const [choice, setChoice] = useState<"roll" | "revoke">(
    live ? "roll" : "revoke",
  );

  if (!live)
    return (
      <ConfirmDialog
        title={`Revoke ${k.name}?`}
        lines={[
          k.lastUsed
            ? `Unused since ${ago(k.lastUsed)} — nothing should break.`
            : "It's never been used — nothing should break.",
          `Any request signed with ••${k.last4} will fail with 401.`,
        ]}
        irreversible
        action="Revoke key"
        onCancel={onCancel}
        onConfirm={onRevoke}
      />
    );

  const bars = hourly(usage!.requests, k.id);
  const max = Math.max(...bars, 1);

  return (
    <ConfirmDialog
      title={`${k.name} is in use`}
      action={choice === "roll" ? "Roll key" : "Revoke key"}
      tone={choice === "roll" ? "calm" : "danger"}
      hold={choice === "revoke"}
      onCancel={onCancel}
      onConfirm={choice === "roll" ? onRoll : onRevoke}
    >
      {/* What would stop: the traffic, up to now */}
      <div className="mt-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="amount text-[26px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
            {usage!.requests.toLocaleString("en-US")}
          </span>
          <span className="text-[12px] text-neutral-500">
            calls in the last 24h
          </span>
        </div>
        <div className="relative mt-5 flex h-14 items-end gap-[3px]">
          {bars.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-[2px] bg-[color-mix(in_srgb,var(--color-white)_40%,transparent)]"
              style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
            />
          ))}
          <span className="absolute -right-1 bottom-0 flex size-2.5 translate-x-1/2 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--brand)] opacity-60" />
            <span className="relative size-2 rounded-full bg-[var(--brand)]" />
          </span>
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10.5px] text-neutral-600">
          <span>Yesterday 10:00</span>
          <span>Now</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-neutral-300">
          Last call {ago(k.lastUsed)} from{" "}
          <span className="font-mono text-[12px] text-white">
            {usage!.lastIp}
          </span>
          {source && <span className="text-neutral-400"> · {source}</span>}.
          Whatever runs there depends on ••{k.last4}.
        </p>
      </div>

      {/* The two ways out */}
      <div
        role="radiogroup"
        aria-label="What to do"
        className="mt-7 grid gap-3"
      >
        {(
          [
            [
              "roll",
              "Roll it",
              `New secret now. ••${k.last4} keeps working for 24 hours, so you can deploy the new one without downtime.`,
              "Recommended",
            ],
            [
              "revoke",
              "Revoke now",
              `Every call with ••${k.last4} fails with 401 immediately. Can't be undone.`,
              null,
            ],
          ] as const
        ).map(([id, label, line, tag]) => {
          const on = choice === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setChoice(id)}
              className={`flex items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${on ? (id === "revoke" ? "border-rose-400/50 bg-rose-500/[0.06]" : "border-white/40 bg-white/[0.04]") : "border-white/10 hover:border-white/20"}`}
            >
              <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${on ? (id === "revoke" ? "border-rose-400" : "border-white") : "border-white/25"}`}
              >
                {on && (
                  <span
                    className={`size-2 rounded-full ${id === "revoke" ? "bg-rose-400" : "bg-white"}`}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-white">
                  {label}
                  {tag && (
                    <span className="rounded-full bg-[var(--ok-bg)] px-1.5 py-px text-[10.5px] font-medium text-[var(--ok-fg)]">
                      {tag}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-neutral-400">
                  {line}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </ConfirmDialog>
  );
}
