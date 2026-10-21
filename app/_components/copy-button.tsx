"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard can be blocked (insecure context, permissions); fail quietly.
        }
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
    >
      {copied ? (
        <Check size={13} strokeWidth={2} className="text-brand" />
      ) : (
        <Copy size={13} strokeWidth={1.75} />
      )}
    </button>
  );
}
