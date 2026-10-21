"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, X } from "lucide-react";

type Message = { role: "user" | "orbit"; text: string };

const suggestionsByPage: Record<string, string[]> = {
  "/cards": [
    "Which cards are near their limit?",
    "Freeze all inactive cards",
    "Why was Liam's Slack payment declined?",
  ],
  "/": [
    "Summarise this week's money movement",
    "What needs my approval?",
    "Show USDC balance by wallet",
  ],
};

const fallbackSuggestions = [
  "What can you help me with?",
  "Summarise my account",
  "Show recent transactions",
];

/**
 * Orbit — Gravv's AI assistant. A pill centred in the top bar that drops open into a chat panel.
 * Not connected to a model yet: replies say so plainly.
 */
export function Orbit({
  placement = "center",
}: {
  placement?: "center" | "side";
}) {
  const side = placement === "side";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the pill + panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const suggestions = suggestionsByPage[pathname] ?? fallbackSuggestions;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    panelRef.current
      ?.querySelector("[data-scroll]")
      ?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [messages]);

  function send(text: string) {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      {
        role: "orbit",
        text: "I'm not connected yet — this is a design prototype. Once Orbit is wired to your Gravv data, I'll answer questions like this and can take actions with your approval.",
      },
    ]);
    setInput("");
  }

  return (
    <div ref={rootRef} className={side ? "relative w-full" : "relative"}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`orbit-pill flex h-8 items-center gap-2 rounded-full border border-white/12 bg-[#0b0b0c] pr-1.5 pl-3.5 text-[13px] text-white transition-colors hover:border-white/25 ${
          open ? "border-white/25" : ""
        } ${side ? "w-full" : ""}`}
      >
        <span className="font-medium">Ask Orbit</span>
        <kbd className="ml-auto rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">
          ⌘J
        </kbd>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Orbit, Gravv AI"
          className={`theme-lock-dark orbit-pop absolute z-50 flex ${side ? "top-0 left-full ml-3" : "top-full left-1/2 mt-2 -ml-[220px]"} max-h-[min(560px,75vh)] w-[440px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] text-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7),0_0_0_1px_rgb(0_255_180/0.06)]`}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3">
            <OrbitMark />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Orbit</div>
              <div className="text-[11px] text-neutral-500">
                Gravv AI · Prototype
              </div>
            </div>
            <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-neutral-500">
              ⌘J
            </kbd>
            <button
              type="button"
              aria-label="Close Orbit"
              onClick={() => setOpen(false)}
              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>

          {/* Body */}
          <div
            data-scroll
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <div>
                <p className="text-[15px] font-medium tracking-[-0.01em]">
                  How can I help?
                </p>
                <p className="mt-1 text-[13px] text-neutral-400">
                  Ask about your cards, balances and payments, or ask me to take
                  an action.
                </p>
                <div className="mt-4 flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-white/8 px-3 py-2 text-left text-[13px] text-neutral-200 transition-colors hover:border-white/20 hover:bg-white/4"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m, i) =>
                  m.role === "user" ? (
                    <div key={i} className="flex justify-end">
                      <span className="max-w-[85%] rounded-2xl rounded-br-md bg-white px-3 py-2 text-[13px] text-black">
                        {m.text}
                      </span>
                    </div>
                  ) : (
                    <div key={i} className="flex gap-2.5">
                      <OrbitMark small />
                      <p className="max-w-[85%] text-[13px] leading-relaxed text-neutral-300">
                        {m.text}
                      </p>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-white/8 p-3"
          >
            <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2 focus-within:border-brand/60">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Ask Orbit anything…"
                className="max-h-28 min-h-6 flex-1 resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim()}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[#03140d] transition-opacity disabled:opacity-30"
              >
                <ArrowUp size={15} strokeWidth={2.25} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** Orbit's mascot: a friendly little helper with an antenna. Drawn in SVG so it's crisp at any size. */
function OrbitMark({ small = false }: { small?: boolean }) {
  const size = small ? 22 : 30;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="orbit-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9d9de" />
        </linearGradient>
      </defs>
      {/* Antenna */}
      <path
        d="M16 8.5V4.6"
        stroke="#d9d9de"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="3.4" r="2.2" fill="#00ffb4" />
      {/* Head */}
      <rect
        x="3"
        y="8"
        width="26"
        height="21.5"
        rx="10.75"
        fill="url(#orbit-head)"
      />
      {/* Eyes */}
      <ellipse cx="11.6" cy="17.6" rx="2.3" ry="3.1" fill="#0b0b0c" />
      <ellipse cx="20.4" cy="17.6" rx="2.3" ry="3.1" fill="#0b0b0c" />
      <circle cx="12.3" cy="16.4" r="0.8" fill="#ffffff" />
      <circle cx="21.1" cy="16.4" r="0.8" fill="#ffffff" />
      {/* Cheeks */}
      <ellipse
        cx="7.6"
        cy="22"
        rx="1.9"
        ry="1.1"
        fill="#00ffb4"
        opacity="0.45"
      />
      <ellipse
        cx="24.4"
        cy="22"
        rx="1.9"
        ry="1.1"
        fill="#00ffb4"
        opacity="0.45"
      />
      {/* Smile */}
      <path
        d="M13.6 23.2q2.4 2 4.8 0"
        stroke="#0b0b0c"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
