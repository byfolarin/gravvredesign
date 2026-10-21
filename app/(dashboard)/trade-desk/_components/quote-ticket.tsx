"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Check } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import { CodeInput } from "./two-factor-gate";
import { AssetMark } from "./asset-mark";
import {
  ASSET_NAME,
  LIMITS,
  SOURCES,
  APPROVAL_OVER,
  DESK_HOLD_MS,
  DESK_TRADER,
  DESK_APPROVERS,
  compact,
  fmt,
  usdValue,
  type Asset,
  hexId,
  type Destination,
  type Order,
  type QuoteRequest,
  type Pair,
} from "../_data";

const QUOTE_SECONDS = 30;

type Phase =
  | { k: "edit" }
  | { k: "requesting" }
  | {
      k: "quoted";
      rate: number;
      expiresAt: number;
      hold?: number;
      trader?: string;
    }
  // Over the daily limit: ask a trader, or ask for a higher limit.
  | { k: "desk-form" }
  | { k: "desk-wait"; timing: string }
  | { k: "limit-form" }
  | { k: "limit-sent"; to: number }
  | { k: "expired" }
  | { k: "confirm"; rate: number }
  | { k: "placing"; rate: number }
  | { k: "placed"; order: Order }
  // Problems the desk can hit while quoting:
  | { k: "refused"; reason: string }
  | { k: "repriced"; from: number; rate: number };

const rateText = (p: Pair, rate: number) =>
  `1 ${p.sell} = ${fmt(p.get, rate, rate >= 10 ? 2 : 4)}`;

/**
 * Request-for-quote ticket. Indicative rate while you type → "Get quote" → a firm rate held
 * for 30 seconds → accept with your two-step code → order placed and settling.
 * `size="hero"` is the larger, page-leading version (Ticket first layout).
 */
export function QuoteTicket({
  pairs,
  pairId,
  onPairChange,
  usedToday,
  nextId,
  onPlaced,
  onViewOrder,
  size = "rail",
  destinations,
  onAddSettlement,
  onEdit,
  prefill,
  demoErrors = false,
  onDeskQuoted,
  onLimitRequested,
  limitRequested = null,
  onQuoted,
  onQuoteEnded,
}: {
  pairs: Pair[];
  pairId: string;
  onPairChange: (id: string) => void;
  usedToday: number;
  nextId: string;
  onPlaced: (o: Order, requestId: string) => void;
  /** Saved settlement accounts (SSIs). */
  destinations: Destination[];
  /** Open the settlement sheet, adding one for this currency. */
  onAddSettlement: (asset: Asset) => void;
  /** A firm quote was issued (a new request, live for 30s). */
  onQuoted?: (r: QuoteRequest) => void;
  /** The live quote ended without an order. */
  onQuoteEnded?: (requestId: string, outcome: "Expired" | "Declined") => void;
  onViewOrder: (id: string) => void;
  size?: "rail" | "hero";
  /** Called when the user starts shaping a quote (types an amount). */
  onEdit?: () => void;
  /** "Request again": refill the amount (pair is set by the parent). */
  prefill?: { amount: number; n: number } | null;
  /** State › Errors: GHS route paused; the first confirm hits a price move. */
  demoErrors?: boolean;
  /** A desk trader priced a large-ticket request. */
  onDeskQuoted?: (requestId: string, rate: number, expiresAt: number) => void;
  /** A higher daily limit was requested. */
  onLimitRequested?: (to: number) => void;
  /** A limit increase is already pending. */
  limitRequested?: number | null;
}) {
  const pair = pairs.find((p) => p.id === pairId)!;
  const [raw, setRaw] = useState("250000");
  const [phase, setPhase] = useState<Phase>({ k: "edit" });
  const [code, setCode] = useState("");
  const [now, setNow] = useState(0);
  const reqId = useRef("");
  const repricedOnce = useRef(false);
  useEffect(() => {
    if (!prefill) return;
    const t = setTimeout(() => {
      setRaw(String(prefill.amount));
      setPhase({ k: "edit" });
    }, 0);
    return () => clearTimeout(t);
  }, [prefill]);
  // Latest callback without restarting the countdown effect.
  const endedRef = useRef(onQuoteEnded);
  useEffect(() => {
    endedRef.current = onQuoteEnded;
  });

  const amount = Number(raw.replace(/[^0-9.]/g, "")) || 0;
  // Where the funds come from: a Gravv wallet/account (debited automatically) or outside.
  const [pickedSrc, setPickedSrc] = useState<Record<string, string>>({});
  const sourceOptions = SOURCES.filter((s) => s.asset === pair.sell);
  const source =
    sourceOptions.find((s) => s.id === pickedSrc[pair.sell]) ??
    sourceOptions[0];
  const external = !!source.external;
  // Payout account: the currency's default, unless you picked another for this ticket.
  const [picked, setPicked] = useState<Record<string, string>>({});
  const options = destinations.filter(
    (d) => d.asset === pair.get && !d.removed,
  );
  const destination =
    options.find((d) => d.id === picked[pair.get]) ??
    options.find((d) => d.isDefault) ??
    options[0] ??
    null;
  const usd = usdValue(pair.sell, amount);
  const left = LIMITS.daily - usedToday;
  const needsApproval = usd > APPROVAL_OVER;
  const problem = !destination
    ? `Add a ${pair.get} settlement account to get a quote`
    : amount === 0
      ? null
      : usd < LIMITS.minTicket
        ? `The desk's minimum is $${(LIMITS.minTicket / 1000).toFixed(0)}k a ticket`
        : !external && amount > source.balance
          ? `${source.label} has ${fmt(pair.sell, source.balance)}`
          : usd > left
            ? `Over today's limit — ${compact("USD", left)} left`
            : null;

  // Over what's left today (but otherwise valid): offer the desk instead of a dead end.
  const overLimit =
    !!destination &&
    amount > 0 &&
    usd >= LIMITS.minTicket &&
    (external || amount <= source.balance) &&
    usd > left;
  const [timing, setTiming] = useState("Within the hour");
  const [deskNote, setDeskNote] = useState("");
  const [limitTo, setLimitTo] = useState(5_000_000);
  const [limitWhy, setLimitWhy] = useState("");

  const askDesk = () => {
    setPhase({ k: "desk-wait", timing });
    setTimeout(() => {
      const t = Date.now();
      const id = hexId(t % 1_000_000_007);
      reqId.current = id;
      onQuoted?.({
        id,
        createdAt: t,
        expiresAt: t,
        pairId: pair.id,
        sell: pair.sell,
        get: pair.get,
        amount,
        rate: pair.rate,
        outcome: "With the desk",
        requestedBy: "Oluwatobi Bello",
        desk: {
          trader: DESK_TRADER,
          timing,
          note: deskNote.trim() || undefined,
        },
      });
      // Prototype: the trader comes back with a firm price, held for 5 minutes.
      setTimeout(() => {
        const firm = Number(
          (pair.rate * (1 - 0.0008)).toFixed(pair.rate >= 10 ? 2 : 4),
        );
        const expiresAt = Date.now() + DESK_HOLD_MS;
        onDeskQuoted?.(id, firm, expiresAt);
        setPhase({
          k: "quoted",
          rate: firm,
          expiresAt,
          hold: DESK_HOLD_MS,
          trader: DESK_TRADER,
        });
      }, 6000);
    }, 0);
  };

  const locked =
    phase.k !== "edit" && phase.k !== "expired" && phase.k !== "refused";
  const firmRate =
    phase.k === "quoted" ||
    phase.k === "confirm" ||
    phase.k === "placing" ||
    phase.k === "repriced"
      ? phase.rate
      : null;
  const shownRate = firmRate ?? pair.rate;
  const getAmount = amount * shownRate;

  // Countdown for a live quote.
  useEffect(() => {
    if (phase.k !== "quoted") return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (n >= phase.expiresAt) {
        setPhase({ k: "expired" });
        endedRef.current?.(reqId.current, "Expired");
      }
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [phase]);

  const requestQuote = () => {
    if (!amount || problem) return;
    setPhase({ k: "requesting" });
    if (demoErrors && pair.get === "GHS") {
      setTimeout(
        () =>
          setPhase({
            k: "refused",
            reason:
              "The desk can't price cedi right now — the GHS payout route is paused while the partner bank runs maintenance. Usually back within the hour.",
          }),
        900,
      );
      return;
    }
    setTimeout(() => {
      // Firm price: a hair under the indicative one.
      const firm = Number(
        (pair.rate * (1 - 0.0003)).toFixed(pair.rate >= 10 ? 2 : 4),
      );
      const t = Date.now();
      const expiresAt = t + QUOTE_SECONDS * 1000;
      reqId.current = hexId(t % 1_000_000_007);
      onQuoted?.({
        id: reqId.current,
        createdAt: t,
        expiresAt,
        pairId: pair.id,
        sell: pair.sell,
        get: pair.get,
        amount,
        rate: firm,
        outcome: "Live",
        requestedBy: "Oluwatobi Bello",
      });
      setPhase({ k: "quoted", rate: firm, expiresAt });
    }, 900);
  };

  const place = (v = code) => {
    if (phase.k !== "confirm" || v.length !== 6) return;
    if (demoErrors && !repricedOnce.current) {
      // The price moved while the code was being typed: show the new one, don't place.
      repricedOnce.current = true;
      const moved = Number(
        (phase.rate * (1 - 0.0006)).toFixed(pair.rate >= 10 ? 2 : 4),
      );
      setPhase({ k: "repriced", from: phase.rate, rate: moved });
      setCode("");
      return;
    }
    const rate = phase.rate;
    setPhase({ k: "placing", rate });
    setTimeout(() => {
      const t = Date.now();
      const order: Order = {
        id: nextId,
        createdAt: t,
        pairId: pair.id,
        sell: pair.sell,
        get: pair.get,
        sellAmount: amount,
        rate,
        getAmount: amount * rate,
        // Over the approval line → waits for a second person; outside funds → waits for your
        // deposit; a Gravv wallet → debited now, straight to settling.
        status: needsApproval
          ? "Awaiting approval"
          : external
            ? "Awaiting funds"
            : "Settling",
        approval: needsApproval ? { approvers: DESK_APPROVERS } : undefined,
        sourceId: source.id,
        destinationId: destination!.id,
        placedBy: "Oluwatobi Bello",
        steps: {
          accepted: t,
          funded: !needsApproval && !external ? t : undefined,
        },
      };
      onPlaced(order, reqId.current);
      setPhase({ k: "placed", order });
      setCode("");
    }, 800);
  };

  const sells = [...new Set(pairs.map((p) => p.sell))];
  const gets = pairs.filter((p) => p.sell === pair.sell);
  const hero = size === "hero";
  const secondsLeft =
    phase.k === "quoted"
      ? Math.max(0, Math.ceil((phase.expiresAt - now) / 1000))
      : 0;

  if (phase.k === "placed") {
    const o = phase.order;
    return (
      <div className={hero ? "py-2" : ""}>
        <span className="flex size-8 items-center justify-center rounded-full bg-[var(--ok-bg)] text-[var(--ok-fg)]">
          <Check size={16} strokeWidth={2.5} />
        </span>
        <h3 className="mt-4 text-[17px] font-medium text-white">
          Order {o.id} placed
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
          {o.status === "Awaiting approval" ? (
            <>
              It&apos;s over {compact("USD", APPROVAL_OVER)}, so{" "}
              {DESK_APPROVERS.join(" or ")} approves it first. The rate is held
              for 15 minutes while they do.
            </>
          ) : o.status === "Awaiting funds" ? (
            <>
              Send{" "}
              <span className="amount text-neutral-200">
                {fmt(o.sell, o.sellAmount)}
              </span>{" "}
              to the desk with {o.id} as the reference — the address and details
              are on the order. Once it lands,{" "}
              <span className="amount text-neutral-200">
                {fmt(o.get, o.getAmount)}
              </span>{" "}
              goes to {destination?.label}.
            </>
          ) : (
            <>
              We&apos;ve taken{" "}
              <span className="amount text-neutral-200">
                {fmt(o.sell, o.sellAmount)}
              </span>{" "}
              from {source.label}.{" "}
              <span className="amount text-neutral-200">
                {fmt(o.get, o.getAmount)}
              </span>{" "}
              goes to {destination?.label} — usually {pair.settles}.
            </>
          )}
        </p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => onViewOrder(o.id)}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            {o.status === "Awaiting funds"
              ? "See deposit details"
              : "Track order"}
          </button>
          <button
            type="button"
            onClick={() => setPhase({ k: "edit" })}
            className="h-9 rounded-full border border-white/12 px-4 text-[13px] text-neutral-200 hover:border-white/30"
          >
            New quote
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* You sell */}
      <div
        className={`rounded-xl border border-white/8 bg-white/[0.02] ${hero ? "p-5" : "p-4"}`}
      >
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>You sell</span>
          <span className="flex items-center gap-1">
            {!external && (
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  setRaw(
                    String(
                      Math.floor(
                        Math.min(source.balance, left / usdValue(pair.sell, 1)),
                      ),
                    ),
                  )
                }
                className="h-7 rounded-md px-1.5 text-neutral-500 hover:text-white disabled:pointer-events-none"
              >
                Max
              </button>
            )}
            <Dropdown
              label="Take funds from"
              variant="bare"
              align="right"
              value={source.id}
              className="-my-1.5 -mr-2 [&>button]:h-7 [&>button]:pr-2 [&>button]:pl-2 [&>button]:text-xs [&>button]:text-neutral-400"
              options={sourceOptions.map((s) => ({
                value: s.id,
                label: s.external ? "from outside Gravv" : `from ${s.label}`,
                hint: s.external
                  ? s.detail
                  : `${compact(s.asset, s.balance)} · ${s.detail.split(" · ")[1] ?? s.detail}`,
              }))}
              onChange={(id: string) =>
                setPickedSrc((p) => ({ ...p, [pair.sell]: id }))
              }
            />
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <input
            aria-label="Amount to sell"
            inputMode="decimal"
            disabled={locked}
            value={amount ? new Intl.NumberFormat("en-US").format(amount) : raw}
            onChange={(e) => {
              setRaw(e.target.value.replace(/[^0-9.]/g, ""));
              onEdit?.();
              if (phase.k === "expired") setPhase({ k: "edit" });
            }}
            className={`amount min-w-0 flex-1 bg-transparent font-medium tracking-[-0.02em] text-white tabular-nums outline-none disabled:text-neutral-300 ${
              hero ? "text-[34px]" : "text-[26px]"
            }`}
          />
          <Dropdown
            label="Asset to sell"
            variant="compact"
            align="right"
            value={pair.sell}
            options={sells.map((a) => ({
              value: a,
              label: a,
              hint: ASSET_NAME[a],
              icon: <AssetMark asset={a} size={16} />,
            }))}
            onChange={(a: Asset) => {
              const next =
                pairs.find((p) => p.sell === a && p.get === pair.get) ??
                pairs.find((p) => p.sell === a)!;
              onPairChange(next.id);
              setPhase({ k: "edit" });
            }}
          />
        </div>
        {problem && destination && (
          <p className="mt-2 text-xs text-rose-400">{problem}</p>
        )}
      </div>

      <div className="relative z-10 -my-2.5 flex justify-center">
        <span className="flex size-7 items-center justify-center rounded-full border border-white/10 bg-[var(--surface)] text-neutral-400">
          <ArrowDown size={13} strokeWidth={1.75} />
        </span>
      </div>

      {/* You get */}
      <div
        className={`rounded-xl border border-white/8 bg-white/[0.02] ${hero ? "p-5" : "p-4"}`}
      >
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{firmRate ? "You get" : "You get, about"}</span>
          {destination ? (
            <Dropdown
              label="Pay out to"
              variant="bare"
              align="right"
              value={destination.id}
              className="-my-1.5 -mr-2 [&>button]:h-7 [&>button]:pr-2 [&>button]:pl-2 [&>button]:text-xs [&>button]:text-neutral-400"
              options={[
                ...options.map((d) => ({
                  value: d.id,
                  label: `to ${d.label}`,
                  hint: d.isDefault ? "Default" : undefined,
                })),
                { value: "__add", label: "Add an account…" },
              ]}
              onChange={(id: string) =>
                id === "__add"
                  ? onAddSettlement(pair.get)
                  : setPicked((p) => ({ ...p, [pair.get]: id }))
              }
            />
          ) : (
            <button
              type="button"
              onClick={() => onAddSettlement(pair.get)}
              className="text-xs text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              Add a {pair.get} settlement account
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className={`amount min-w-0 flex-1 truncate font-medium tracking-[-0.02em] tabular-nums ${
              hero ? "text-[34px]" : "text-[26px]"
            } ${firmRate ? "text-white" : "text-neutral-400"}`}
          >
            {amount ? fmt(pair.get, getAmount) : "—"}
          </div>
          <Dropdown
            label="Asset to get"
            variant="compact"
            align="right"
            value={pair.id}
            options={gets.map((p) => ({
              value: p.id,
              label: p.get,
              hint: ASSET_NAME[p.get],
              icon: <AssetMark asset={p.get} size={16} />,
            }))}
            onChange={(id: string) => {
              onPairChange(id);
              setPhase({ k: "edit" });
            }}
          />
        </div>
      </div>

      {/* Terms */}
      <dl className="mt-4 space-y-2 text-[13px]">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">
            {firmRate ? "Firm rate" : "Indicative rate"}
          </dt>
          <dd className="text-right text-neutral-100 tabular-nums">
            {rateText(pair, shownRate)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Fees</dt>
          <dd className="text-right text-neutral-300">
            None — spread included
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Settles</dt>
          <dd className="text-right text-neutral-300">
            {pair.settles} after funds land
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Funding</dt>
          <dd className="text-right text-neutral-300">
            {external
              ? "You send it in — details after you place it"
              : `Taken from ${source.label} when you place it`}
          </dd>
        </div>
        {needsApproval && (
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-500">Approval</dt>
            <dd className="text-right text-neutral-100">
              Over {compact("USD", APPROVAL_OVER)} ·{" "}
              {DESK_APPROVERS.join(" or ")} signs off
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Left today</dt>
          <dd className="amount text-right text-neutral-300 tabular-nums">
            {compact("USD", left)} of {compact("USD", LIMITS.daily)}
          </dd>
        </div>
      </dl>

      {/* Action area */}
      <div className="mt-5">
        {phase.k === "refused" && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-4">
            <div className="text-[13px] text-rose-400">
              The desk couldn&apos;t price this
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              {phase.reason}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={requestQuote}
                className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black hover:bg-neutral-200"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => setPhase({ k: "edit" })}
                className="h-8 rounded-full px-3 text-xs text-neutral-400 hover:text-white"
              >
                Pick another currency
              </button>
            </div>
          </div>
        )}
        {phase.k === "repriced" && (
          <div className="rounded-xl border border-white/15 p-4">
            <div className="text-[13px] text-white">
              The price moved before you confirmed
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              Your quote of {rateText(pair, phase.from)} lapsed while the code
              was being entered. The desk&apos;s new firm price is{" "}
              <span className="text-white">{rateText(pair, phase.rate)}</span> (
              {(((phase.rate - phase.from) / phase.from) * 100).toFixed(2)}%),
              held for 30 seconds.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPhase({ k: "confirm", rate: phase.rate })}
                className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black hover:bg-neutral-200"
              >
                Accept new price
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuoteEnded?.(reqId.current, "Declined");
                  setPhase({ k: "edit" });
                }}
                className="h-8 rounded-full px-3 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {phase.k === "desk-form" && (
          <div className="rounded-xl border border-white/12 p-4">
            <div className="text-[13px] text-white">
              Ask the desk for a price
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              {fmt(pair.sell, amount)} → {pair.get}. A trader prices it by hand
              and holds it for 5 minutes.
            </p>
            <div className="mt-4 text-xs text-neutral-400">
              When do you need it?
            </div>
            <div
              role="radiogroup"
              aria-label="Timing"
              className="mt-1.5 flex rounded-full border border-white/10 p-0.5"
            >
              {["Now", "Within the hour", "By end of day"].map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={timing === t}
                  onClick={() => setTiming(t)}
                  className={`h-7 flex-1 rounded-full px-2 text-xs transition-colors ${
                    timing === t
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs text-neutral-400">
              Note for the trader (optional)
            </div>
            <textarea
              value={deskNote}
              onChange={(e) => setDeskNote(e.target.value)}
              rows={2}
              placeholder="e.g. Happy to split across two days"
              className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/35"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={askDesk}
                className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                Send to the desk
              </button>
              <button
                type="button"
                onClick={() => setPhase({ k: "edit" })}
                className="h-9 rounded-full px-3 text-[13px] text-neutral-400 hover:text-white"
              >
                Back
              </button>
            </div>
          </div>
        )}
        {phase.k === "desk-wait" && (
          <div className="rounded-xl border border-white/12 p-4">
            <div className="flex items-center gap-2 text-[13px] text-white">
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
              {DESK_TRADER} is pricing it
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              {fmt(pair.sell, amount)} → {pair.get}, needed{" "}
              {phase.timing.toLowerCase()}. The quote lands here and in Requests
              — we&apos;ll notify you too.
            </p>
          </div>
        )}
        {phase.k === "limit-form" && (
          <div className="rounded-xl border border-white/12 p-4">
            <div className="text-[13px] text-white">
              Request a higher daily limit
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              Today it&apos;s {compact("USD", LIMITS.daily)}. Gravv reviews it,
              usually within a business day.
            </p>
            <div
              role="radiogroup"
              aria-label="New limit"
              className="mt-4 flex rounded-full border border-white/10 p-0.5"
            >
              {[5_000_000, 10_000_000, 25_000_000].map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={limitTo === v}
                  onClick={() => setLimitTo(v)}
                  className={`h-7 flex-1 rounded-full text-xs transition-colors ${
                    limitTo === v
                      ? "bg-white text-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {compact("USD", v)} a day
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs text-neutral-400">
              What&apos;s it for?
            </div>
            <textarea
              value={limitWhy}
              onChange={(e) => setLimitWhy(e.target.value)}
              rows={2}
              placeholder="e.g. Month-end payouts to suppliers in Lagos"
              className="mt-1.5 block w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/35"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!limitWhy.trim()}
                onClick={() => {
                  onLimitRequested?.(limitTo);
                  setPhase({ k: "limit-sent", to: limitTo });
                }}
                className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
              >
                Send request
              </button>
              <button
                type="button"
                onClick={() => setPhase({ k: "edit" })}
                className="h-9 rounded-full px-3 text-[13px] text-neutral-400 hover:text-white"
              >
                Back
              </button>
            </div>
          </div>
        )}
        {phase.k === "limit-sent" && (
          <div className="rounded-xl border border-white/12 p-4">
            <div className="flex items-center gap-2 text-[13px] text-white">
              <Check size={14} strokeWidth={2.25} /> Sent to Gravv
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
              We&apos;ll review {compact("USD", phase.to)} a day and email you —
              usually within a business day. Until then, the desk can still
              price anything bigger.
            </p>
            <button
              type="button"
              onClick={() => setPhase({ k: "edit" })}
              className="mt-3 h-8 rounded-full border border-white/12 px-3.5 text-xs text-neutral-200 hover:border-white/30"
            >
              Back to the quote
            </button>
          </div>
        )}
        {(phase.k === "edit" ||
          phase.k === "expired" ||
          phase.k === "requesting") && (
          <>
            {phase.k === "expired" && (
              <p className="mb-3 text-[13px] text-neutral-400">
                That quote expired. Prices move — get a fresh one.
              </p>
            )}
            {overLimit && phase.k !== "requesting" ? (
              <div className="rounded-xl border border-white/12 p-4">
                <div className="text-[13px] text-white">
                  This is bigger than today&apos;s limit
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                  You have {compact("USD", left)} left today. The desk can still
                  price it — a trader sends you a firm quote, usually within 15
                  minutes.
                  {limitRequested
                    ? ` Your increase to ${compact("USD", limitRequested)} is being reviewed.`
                    : ""}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase({ k: "desk-form" })}
                    className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
                  >
                    Ask the desk
                  </button>
                  {!limitRequested && (
                    <button
                      type="button"
                      onClick={() => setPhase({ k: "limit-form" })}
                      className="h-9 rounded-full border border-white/12 px-4 text-[13px] text-neutral-200 hover:border-white/30"
                    >
                      Request a higher limit
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!amount || !!problem || phase.k === "requesting"}
                onClick={requestQuote}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-white text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
              >
                {phase.k === "requesting"
                  ? "Getting a firm price…"
                  : phase.k === "expired"
                    ? "Get a new quote"
                    : "Get quote"}
              </button>
            )}
            <p className="mt-2 text-center text-xs text-neutral-600">
              A quote holds its price for {QUOTE_SECONDS} seconds.
            </p>
          </>
        )}

        {phase.k === "quoted" && (
          <>
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">
                  {phase.trader
                    ? `Priced by ${phase.trader} · held`
                    : "Price held"}
                </span>
                <span className="text-neutral-200 tabular-nums">
                  {secondsLeft >= 60
                    ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : `${secondsLeft}s`}
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-200 ease-linear"
                  style={{
                    width: `${(Math.max(0, phase.expiresAt - now) / (phase.hold ?? QUOTE_SECONDS * 1000)) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPhase({ k: "confirm", rate: phase.rate })}
                className="h-10 flex-1 rounded-full bg-white text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                Accept quote
              </button>
              <button
                type="button"
                onClick={() => {
                  onQuoteEnded?.(reqId.current, "Declined");
                  setPhase({ k: "edit" });
                }}
                className="h-10 rounded-full border border-white/12 px-4 text-[13px] text-neutral-300 hover:border-white/30 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {(phase.k === "confirm" || phase.k === "placing") && (
          <div className="rounded-xl border border-white/10 p-4">
            <div className="text-[13px] text-white">Confirm with two-step</div>
            <p className="mt-1 text-xs text-neutral-500">
              Enter the code from your authenticator to place this order.
            </p>
            <div className="mt-3">
              <CodeInput
                value={code}
                onChange={setCode}
                onComplete={place}
                autoFocus
                disabled={phase.k === "placing"}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={code.length !== 6 || phase.k === "placing"}
                onClick={() => place()}
                className="h-9 flex-1 rounded-full bg-white text-[13px] font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
              >
                {phase.k === "placing" ? "Placing order…" : "Place order"}
              </button>
              <button
                type="button"
                disabled={phase.k === "placing"}
                onClick={() => {
                  setCode("");
                  onQuoteEnded?.(reqId.current, "Declined");
                  setPhase({ k: "edit" });
                }}
                className="h-9 rounded-full px-3 text-[13px] text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
