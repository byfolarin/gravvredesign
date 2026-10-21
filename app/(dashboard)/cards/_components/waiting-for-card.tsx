"use client";

import Link from "next/link";
import { CopyButton } from "@/app/_components/copy-button";
import type { CardsRequest } from "./cards-onboarding";

const BASE = "https://sandbox.api.gravv.xyz/v1";

/**
 * Empty Cards table right after card issuing is granted: cards come from the API, so the page
 * shows the one call that creates a card and listens for it. A test card stands in for the
 * customer's first request.
 */
export function WaitingForFirstCard({
  request,
  onTest,
}: {
  request: CardsRequest;
  onTest: () => void;
}) {
  const type = (request.types[0] ?? "Virtual").toLowerCase();
  const snippet = [
    `curl ${BASE}/cards \\`,
    `  -H "Authorization: Bearer $GRAVV_SECRET_KEY" \\`,
    `  -d holder_name="Amara Okafor" \\`,
    `  -d type=${type} \\`,
    `  -d funding_source=${request.funding.id} \\`,
    `  -d "spending_limit[amount]"=2500 \\`,
    `  -d "spending_limit[period]"=monthly`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-[620px] text-left">
      <div className="text-[15px] font-medium text-white">
        Waiting for your first card
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
        Card issuing is on. Create a card from your backend with your sandbox
        secret key and it shows up here.
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
        <div className="flex items-center justify-between border-b border-white/6 py-1.5 pr-1.5 pl-3 text-xs text-neutral-500">
          <span>
            <span className="font-mono text-neutral-300">POST</span> /v1/cards
          </span>
          <CopyButton value={snippet} />
        </div>
        <pre className="overflow-x-auto px-3 py-3 font-mono text-[12px] leading-relaxed text-neutral-300">
          {snippet}
        </pre>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 text-xs">
        <span className="flex items-center gap-2 text-neutral-400">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className="intro-spin shrink-0"
            aria-hidden
          >
            <circle
              cx="6"
              cy="6"
              r="4.75"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="1.5"
            />
            <path
              d="M6 1.25a4.75 4.75 0 0 1 4.75 4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Listening for{" "}
          <span className="font-mono text-neutral-300">card.created</span>
        </span>
        <span className="flex items-center gap-1">
          <Link
            href="/manage/configure"
            className="h-8 rounded-full px-3 leading-8 text-neutral-400 hover:text-white"
          >
            API keys
          </Link>
          <button
            type="button"
            onClick={onTest}
            className="h-8 rounded-full border border-white/12 px-3 text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            Send a test card
          </button>
        </span>
      </div>
    </div>
  );
}
