"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowRight,
  GripVertical,
  HandCoins,
  Landmark,
  Plus,
  Repeat,
  Send,
  X,
} from "lucide-react";
import { Roll } from "@/app/_components/roll";
import { ShotArt } from "./needs-you";
import { accounts } from "../account/_data";
import {
  MONTH_DAYS,
  PROGRAM_LIMIT,
  SPEND_DAY,
  monthlySpend,
} from "../cards/_data";
import { collections, isStuck } from "../card-collection/collections/_data";
import { links } from "../payment-links/_data";
import { ORDERS, PAIRS } from "../trade-desk/_data";
import { transactions } from "../transactions/_data";

/* ——— The numbers, from each page's own data ——— */

const NOW = Date.UTC(2026, 9, 20, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const usd = (v: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v);
const compact = (v: number) =>
  v >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`
    : v >= 10_000
      ? `$${Math.round(v / 1000)}k`
      : usd(v);

const held = accounts.filter(
  (a) =>
    a.currency === "USD" && (a.status === "Active" || a.status === "Frozen"),
);
const balance = held.reduce((s, a) => s + a.balance, 0);
const month = transactions.filter(
  (t) => t.status === "Completed" && NOW - Date.parse(t.createdAt) <= 30 * DAY,
);
const moneyIn = month.filter((t) => t.direction === "Credit");
const moneyOut = month.filter((t) => t.direction === "Debit");
const sum = (xs: { amount: number }[]) => xs.reduce((s, t) => s + t.amount, 0);
const pace = (monthlySpend.spent / SPEND_DAY) * MONTH_DAYS;
const recentCollections = collections.filter(
  (c) => NOW - Date.parse(c.createdAt) <= 30 * DAY,
);
const settled = recentCollections.filter(
  (c) => c.status === "Settlement completed",
);
const linkTotal = links.reduce(
  (s, l) =>
    s +
    l.payments
      .filter(
        (p) => p.status === "Paid" && NOW - Date.parse(p.date) <= 30 * DAY,
      )
      .reduce(
        (x, p) => x + (l.currency === "NGN" ? p.amount / 1500 : p.amount),
        0,
      ),
  0,
);
const openOrders = ORDERS.filter(
  (o) => !["Settled", "Cancelled", "Rejected"].includes(o.status),
).length;
const pending = accounts.filter((a) => a.status === "Pending").length;

type TileId =
  | "balance"
  | "moneyIn"
  | "moneyOut"
  | "cards"
  | "collections"
  | "links"
  | "desk"
  | "provisioning";

/** Each tile: a label, one figure and a short note — Midday's home tiles. */
const TILES: Record<
  TileId,
  { label: string; href: string; figure: string; note: string; tone?: "in" }
> = {
  balance: {
    label: "Balance",
    href: "/account",
    figure: usd(balance),
    note: `across ${held.length.toLocaleString("en-US")} USD accounts`,
  },
  moneyIn: {
    label: "Money in",
    href: "/transactions",
    figure: `+${usd(sum(moneyIn))}`,
    note: `${moneyIn.length} payments · 30 days`,
    tone: "in",
  },
  moneyOut: {
    label: "Money out",
    href: "/transactions",
    figure: `−${usd(sum(moneyOut))}`,
    note: `${moneyOut.length} payments · 30 days`,
  },
  cards: {
    label: "Card spend",
    href: "/cards",
    figure: usd(monthlySpend.spent),
    note: `on pace for ${compact(pace)} of ${compact(PROGRAM_LIMIT)}`,
  },
  collections: {
    label: "Collections",
    href: "/card-collection/collections",
    figure: usd(settled.reduce((s, c) => s + c.subtotal, 0)),
    note: `${settled.length} of ${recentCollections.length} settled${collections.some(isStuck) ? " · 1 waiting" : ""}`,
  },
  links: {
    label: "Payment links",
    href: "/payment-links",
    figure: usd(linkTotal),
    note: `collected · ${links.filter((l) => l.status === "Active").length} links live`,
  },
  desk: {
    label: "Trade desk",
    href: "/trade-desk",
    figure: PAIRS[0].rate.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    }),
    note: `${PAIRS[0].sell} → ${PAIRS[0].get} · ${openOrders} open orders`,
  },
  provisioning: {
    label: "Being set up",
    href: "/account",
    figure: pending.toLocaleString("en-US"),
    note: "accounts the banks are opening",
  },
};
const ALL = Object.keys(TILES) as TileId[];
const DEFAULT: TileId[] = [
  "balance",
  "moneyIn",
  "moneyOut",
  "cards",
  "collections",
  "links",
];
const TILES_KEY = "gravv-overview-tiles";

const ACTIONS = [
  { label: "Send money", href: "/recipients", icon: Send },
  { label: "Request payment", href: "/payment-links", icon: HandCoins },
  { label: "Move between accounts", href: "/account", icon: ArrowLeftRight },
  { label: "Convert", href: "/trade-desk", icon: Repeat },
  { label: "Open an account", href: "/account", icon: Landmark },
];

const greeting = () => {
  const h = new Date(NOW).getUTCHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/**
 * Overview, rebuilt on Midday's home: a greeting and one sentence about your money, the
 * actions you take most, then six quiet tiles — each a number that opens its page. Nothing
 * to read closely here; the pages hold the detail. Customize reorders, removes and adds
 * tiles in place. A new workspace (`?state=empty`) sees three ways to start instead.
 */
export function Overview() {
  const [tiles, setTiles] = useState<TileId[]>(DEFAULT);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(TILES_KEY) ?? "null");
        if (Array.isArray(v) && v.every((x) => ALL.includes(x))) setTiles(v);
      } catch {}
      setEmpty(
        new URLSearchParams(window.location.search).get("state") === "empty",
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TileId[]>(tiles);
  const [drag, setDrag] = useState<TileId | null>(null);
  const [adding, setAdding] = useState(false);
  const shown = editing ? draft : tiles;
  const hidden = ALL.filter((id) => !shown.includes(id));
  const save = () => {
    setTiles(draft);
    try {
      localStorage.setItem(TILES_KEY, JSON.stringify(draft));
    } catch {}
    setEditing(false);
    setAdding(false);
  };
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAdding(false);
      setEditing(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editing]);
  const moveTo = (over: TileId) => {
    if (!drag || drag === over) return;
    setDraft((d) => {
      const rest = d.filter((x) => x !== drag);
      const i = d.indexOf(over);
      const next = [...rest];
      next.splice(i, 0, drag);
      return next.join() === d.join() ? d : next;
    });
  };

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[880px] px-8 pt-24 pb-20">
        {/* Greeting + the one sentence */}
        <div className="text-center">
          <h1 className="text-[40px] leading-[1.1] font-medium tracking-[-0.035em] text-white">
            {greeting()}, <span className="text-neutral-500">Oluwatobi</span>
          </h1>
          <p className="mt-3 text-[15px] text-neutral-400">
            {empty ? (
              "Nothing's moving yet — start with one of these."
            ) : (
              <>
                Your USD balance sits at{" "}
                <span className="amount text-neutral-100">{usd(balance)}</span>{" "}
                across {held.length.toLocaleString("en-US")} accounts.
              </>
            )}
          </p>
        </div>

        {/* What you do most */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {ACTIONS.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
            >
              <a.icon
                size={13}
                strokeWidth={1.75}
                className="text-neutral-400"
              />
              {a.label}
            </Link>
          ))}
        </div>

        {empty ? (
          <GetStarted />
        ) : (
          <>
            {/* The tiles */}
            <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {shown.map((id) => (
                <Tile
                  key={id}
                  id={id}
                  editing={editing}
                  dragging={drag === id}
                  onDragStart={() => setDrag(id)}
                  onDragEnd={() => setDrag(null)}
                  onOver={() => moveTo(id)}
                  onRemove={() => setDraft((d) => d.filter((x) => x !== id))}
                />
              ))}
              {editing && hidden.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={adding}
                    onClick={() => setAdding((a) => !a)}
                    className="flex h-full min-h-[112px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-[12.5px] text-neutral-400 hover:border-white/30 hover:text-white"
                  >
                    <Plus size={15} strokeWidth={1.75} />
                    Add a tile
                  </button>
                  {adding && (
                    <div className="orbit-pop absolute top-full left-0 z-20 mt-2 w-full min-w-[220px] rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]">
                      {hidden.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setDraft((d) => [...d, id]);
                            setAdding(false);
                          }}
                          className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-white hover:bg-white/[0.06]"
                        >
                          {TILES[id].label}
                          <span className="amount text-[12px] text-neutral-500 tabular-nums">
                            {TILES[id].figure}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customize, quietly */}
            <div className="mt-4 flex justify-center gap-2 text-[12.5px]">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDraft(DEFAULT)}
                    className="h-8 rounded-full px-3 text-neutral-400 hover:text-white"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setAdding(false);
                    }}
                    className="h-8 rounded-full px-3 text-neutral-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    className="h-8 rounded-full bg-white px-4 font-medium text-black hover:bg-neutral-200"
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(tiles);
                    setEditing(true);
                  }}
                  className="h-8 rounded-full px-3 text-neutral-500 hover:text-white"
                >
                  Customize tiles
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({
  id,
  editing,
  dragging,
  onDragStart,
  onDragEnd,
  onOver,
  onRemove,
}: {
  id: TileId;
  editing: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOver: () => void;
  onRemove: () => void;
}) {
  const t = TILES[id];
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-[13px] text-neutral-500">
        <span className="flex items-center gap-1">
          {editing && (
            <GripVertical size={13} strokeWidth={1.75} className="-ml-1" />
          )}
          {t.label}
        </span>
        {editing && (
          <button
            type="button"
            aria-label={`Remove ${t.label}`}
            onClick={(e) => {
              e.preventDefault();
              onRemove();
            }}
            className="flex size-6 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={13} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="mt-auto pt-5">
        <span
          className={`amount text-[20px] leading-none font-medium tracking-[-0.02em] tabular-nums ${t.tone === "in" ? "text-[var(--ok-fg)]" : "text-white"}`}
        >
          <Roll value={t.figure} />
        </span>
        <div className="mt-1.5 truncate text-[12.5px] text-neutral-500">
          {t.note}
        </div>
      </div>
    </>
  );
  const cls = `flex min-h-[112px] flex-col rounded-xl border border-white/8 p-4 transition-[border-color,opacity] ${dragging ? "opacity-40" : ""}`;
  return editing ? (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onOver();
      }}
      className={`${cls} cursor-grab border-white/15 active:cursor-grabbing`}
    >
      {body}
    </div>
  ) : (
    <Link href={t.href} className={`${cls} hover:border-white/20`}>
      {body}
    </Link>
  );
}

const STARTERS = [
  {
    image: "/needs/accounts.png",
    area: "Accounts",
    time: "Ready in 1–2 business days",
    title: "Open your first account",
    line: "Local bank details in USD, EUR, GBP or NGN, in your name or a customer's.",
    action: "Open an account",
    href: "/account",
  },
  {
    image: "/needs/cards.png",
    area: "Cards",
    time: "Issued through the API",
    title: "Turn on card issuing",
    line: "Request access once, then issue virtual and physical cards to your team or customers.",
    action: "Request card issuing",
    href: "/cards",
  },
  {
    image: "/needs/payment-links.png",
    area: "Payment links",
    time: "Live in a minute",
    title: "Get paid with a link",
    line: "One link, paid by card, bank transfer or USDC — no website needed.",
    action: "Create a payment link",
    href: "/payment-links",
  },
];

/** A new workspace: three ways to start, each with its page moving on the light green. */
function GetStarted() {
  return (
    <div className="mt-12 grid gap-3 md:grid-cols-3">
      {STARTERS.map((s, i) => (
        <Link
          key={s.title}
          href={s.href}
          className="group block overflow-hidden rounded-xl border border-white/8 transition-colors hover:border-white/20"
        >
          <ShotArt
            src={s.image}
            className="aspect-[16/10]"
            moving
            delay={i * 5}
          />
          <div className="px-4 pt-3.5 pb-4">
            <div className="text-[12px] text-neutral-500">
              {s.area} · {s.time}
            </div>
            <div className="mt-1 text-[14px] font-medium text-white">
              {s.title}
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
              {s.line}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] text-white group-hover:underline">
              {s.action}
              <ArrowRight size={12} strokeWidth={1.75} />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
