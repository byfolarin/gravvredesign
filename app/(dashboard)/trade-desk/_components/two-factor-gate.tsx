"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/app/_components/copy-button";

const SECRET = "JBSW Y3DP EHPK 3PXP";
const OTPAUTH = `otpauth://totp/Gravv:tbello@kredete.com?secret=${SECRET.replaceAll(" ", "")}&issuer=Gravv`;

/** Six single-digit boxes; paste fills them all. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  autoFocus = false,
  disabled = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const set = (next: string) => {
    const v = next.replace(/\D/g, "").slice(0, 6);
    onChange(v);
    if (v.length === 6) onComplete?.(v);
    refs.current[Math.min(v.length, 5)]?.focus();
  };
  return (
    <div className="flex gap-2" role="group" aria-label="6-digit code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={value[i] ?? ""}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, "");
            if (d.length > 1) return set(value.slice(0, i) + d);
            set((value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              e.preventDefault();
              set(value.slice(0, i - 1));
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            set(e.clipboardData.getData("text"));
          }}
          className={`h-11 w-10 rounded-lg border bg-white/[0.03] text-center font-mono text-[17px] text-white tabular-nums outline-none transition-colors focus:border-white/40 disabled:opacity-50 ${
            value[i] ? "border-white/25" : "border-white/10"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * The desk stays closed until the account has a second factor. Instead of a modal over an
 * empty page, the set-up happens right here: scan, enter the code, the desk opens.
 */
export function TwoFactorGate({ onEnabled }: { onEnabled: () => void }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "done">("idle");

  const verify = (v = code) => {
    if (v.length !== 6 || state !== "idle") return;
    setState("checking");
    setTimeout(() => setState("done"), 700);
    setTimeout(onEnabled, 1500);
  };

  return (
    // A set-up step under the page title, not a second page: one heading per page.
    <section className="mt-8 max-w-[880px] rounded-2xl border border-white/8 px-8 pt-7 pb-6 max-sm:px-5">
      <div className="text-[12px] text-neutral-500">Before you trade</div>
      <h2 className="mt-1 text-[17px] font-medium tracking-[-0.01em] text-white">
        Turn on two-step
      </h2>
      <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-neutral-400">
        Every order on the desk moves money, so it opens once your account has a
        second factor. You&apos;ll also confirm each order with a code. It takes
        about a minute.
      </p>

      <div className="mt-7 grid gap-10 border-t border-white/8 pt-7 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="flex size-[152px] items-center justify-center rounded-xl bg-[#fafafa] p-3">
            <QRCodeSVG
              value={OTPAUTH}
              size={128}
              bgColor="#fafafa"
              fgColor="#0a0a0a"
            />
          </div>
        </div>
        <ol className="space-y-7">
          <li>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-neutral-500">1</span>
              <div>
                <div className="text-[14px] text-white">
                  Scan the code with your authenticator app
                </div>
                <p className="mt-1 text-[13px] text-neutral-500">
                  Google Authenticator, 1Password, Authy — any app that makes
                  6-digit codes. Can&apos;t scan? Enter this key instead:
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <code className="rounded-md bg-white/[0.05] px-2.5 py-1 font-mono text-[13px] tracking-wider text-neutral-200">
                    {SECRET}
                  </code>
                  <CopyButton
                    value={SECRET.replaceAll(" ", "")}
                    label="Copy key"
                  />
                </div>
              </div>
            </div>
          </li>
          <li>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-neutral-500">2</span>
              <div>
                <div className="text-[14px] text-white">
                  Enter the 6-digit code it shows
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <CodeInput
                    value={code}
                    onChange={setCode}
                    onComplete={verify}
                    disabled={state !== "idle"}
                  />
                  <button
                    type="button"
                    disabled={code.length !== 6 || state !== "idle"}
                    onClick={() => verify()}
                    className="flex h-9 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
                  >
                    {state === "done" && <Check size={14} strokeWidth={2.5} />}
                    {state === "idle"
                      ? "Turn on two-step"
                      : state === "checking"
                        ? "Checking…"
                        : "Two-step is on"}
                  </button>
                </div>
                <p className="mt-2.5 text-xs text-neutral-600">
                  Prototype: any 6 digits work.
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>

      <p className="mt-8 border-t border-white/8 pt-5 text-xs text-neutral-500">
        Admins can require two-step for everyone in{" "}
        <Link
          href="/manage/team"
          className="text-neutral-300 underline decoration-white/20 underline-offset-4 hover:text-white"
        >
          Team
        </Link>
        .
      </p>
    </section>
  );
}
