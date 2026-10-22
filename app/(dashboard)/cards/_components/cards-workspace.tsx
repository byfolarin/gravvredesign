"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Eye,
  Globe,
  Search,
  SlidersHorizontal,
  Snowflake,
  Store,
  Tags,
  X,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { CardThumb, FlatCard } from "./flat-card";
import { Money } from "./money";
import type { IssueCardInput } from "./issue-card";
import Link from "next/link";
import { LimitsDialog, resetCopy, type LimitSettings } from "./limits-dialog";
import {
  MONTH_DAYS,
  SPEND_DAY,
  type Card,
  type CardStatus,
  type CardTxn,
  type FundingSource,
} from "../_data";
import { Roll } from "@/app/_components/roll";
import { CardsOnboarding, type CardsRequest } from "./cards-onboarding";
import { WaitingForFirstCard } from "./waiting-for-card";
import {
  compactMoney,
  dateFmt,
  fullDateFmt,
  money,
  timeFmt,
  usageTone,
} from "../_lib/format";

type Filter = "All" | CardStatus;

const wholeMoney = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);

const perSuffix: Record<Card["limitPeriod"], string> = {
  Daily: "/day",
  Weekly: "/wk",
  Monthly: "",
};

const ONBOARDED_KEY = "gravv-cards-onboarded";
const last4For = (index: number) =>
  String(1000 + ((index * 7919) % 9000)).slice(-4);

function newCard(input: IssueCardInput, index: number): Card {
  const last4 = last4For(index);
  const id = `c0ffee${index}-e5f6-47a8-b9c0-${Date.now().toString(16).slice(-12)}`;
  return {
    id,
    customerId: input.customerId || "—",
    holder: input.holder,
    network: "VISA",
    last4,
    expiry: "2029-10-31",
    type: input.type,
    currency: "USD",
    balance: 0,
    createdAt: new Date().toISOString(),
    status: input.type === "Virtual" ? "Active" : "Inactive",
    monthlyLimit: input.limit,
    limitPeriod: input.period,
    perTransactionLimit: input.perTransactionLimit,
    alertAt: 0.8,
    spentThisMonth: 0,
    resetsOn: "2026-10-31",
    funding: input.funding,
    billing: {
      line1: "1801 Main St., Kansas City",
      country: "US",
      city: "Newark",
      state: "Newark",
      zip: "19702",
    },
    shipping: {
      line1: "1801 Main St., Kansas City",
      country: "US",
      city: "Newark",
      state: "Newark",
      zip: "19702",
    },
    transactions: [],
  };
}

export function CardsWorkspace({
  initialCards,
  sources,
  spend,
  daily,
}: {
  initialCards: Card[];
  sources: (FundingSource & { balance: number })[];
  spend: { spent: number; limit: number; period: string };
  daily: { thisMonth: number[]; lastMonth: number[] };
}) {
  // Local state until the Cards API is wired up.
  const [cards, setCards] = useState(initialCards);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [editingLimitsFor, setEditingLimitsFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"All" | Card["type"]>("All");
  const [onlyNearLimit, setOnlyNearLimit] = useState(false);
  const [assetFilter, setAssetFilter] = useState<"All" | "USDC">("All");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  // First-run onboarding: a new account (no flag yet) starts with no cards and gets the
  // welcome → create-first-card sequence. "Replay intro" resets to a new account.
  // Pages stay alive in the background (Activity), so re-decide on every visit.
  const contentRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"unknown" | "onboard" | "normal">("unknown");
  const [revealed, setRevealed] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  // A new account's spend is just its own cards' spend, not the seeded month.
  const [fresh, setFresh] = useState(false);
  useLayoutEffect(
    () => () => {
      setRevealed(false);
      setMode("unknown");
    },
    [],
  );
  useEffect(() => {
    if (mode !== "unknown") return;
    const t = setTimeout(() => {
      let onboarded = true;
      try {
        onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
      } catch {}
      if (onboarded) {
        setMode("normal");
        setRevealed(true);
        setRevealKey((k) => k + 1);
      } else {
        setCards([]);
        setFresh(true);
        setMode("onboard");
      }
    }, 0);
    return () => clearTimeout(t);
  }, [mode]);
  const onReveal = useCallback(() => {
    setRevealed(true);
    setRevealKey((k) => k + 1);
  }, []);
  const onOnboarded = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {}
    setMode("normal");
  }, []);
  // Card issuing is granted in the dashboard; cards themselves come from the API.
  const [request, setRequest] = useState<CardsRequest | null>(null);
  const [arrivedId, setArrivedId] = useState<string | null>(null);
  const onGranted = useCallback((r: CardsRequest) => setRequest(r), []);
  const replayIntro = () => {
    try {
      localStorage.removeItem(ONBOARDED_KEY);
    } catch {}
    setRequest(null);
    setArrivedId(null);
    setRevealed(false);
    setMode("unknown");
  };
  // Stand-in for the first `POST /v1/cards` from the customer's backend.
  const firstCardArrives = useCallback(() => {
    if (!request) return;
    const input: IssueCardInput = {
      holder: "Amara Okafor",
      customerId: "cus_7f3a21",
      type: request.types[0] ?? "Virtual",
      funding: request.funding,
      limit: 2500,
      period: "Monthly",
      perTransactionLimit: null,
      online: true,
      international: true,
    };
    const card = newCard(input, 1);
    setCards([card]);
    setArrivedId(card.id);
    setToast(`Card ••${card.last4} issued through the API`);
  }, [request]);
  // Shown from the moment access is granted (the onboarding's dots land on it); the
  // stand-in first card only arrives once the onboarding has finished.
  const waiting = fresh && request !== null && cards.length === 0;
  const listening = waiting && mode === "normal";
  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(firstCardArrives, 6000);
    return () => clearTimeout(t);
  }, [listening, firstCardArrives]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (id: string, patch: Partial<Card>) =>
    setCards((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const statusOf = (c: Card) => c.status;
  const q = query.trim().toLowerCase();
  const visible = cards.filter((c) => {
    if (filter !== "All" && statusOf(c) !== filter) return false;
    if (!q) return true;
    return [c.holder, c.id, c.customerId, c.last4].some((v) =>
      v.toLowerCase().includes(q),
    );
  });
  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const count = (f: Filter) =>
    f === "All" ? cards.length : cards.filter((c) => statusOf(c) === f).length;

  const total = Math.max(1, cards.length);
  const spent = fresh
    ? cards.reduce((sum, c) => sum + c.spentThisMonth, 0)
    : spend.spent;
  const nearLimit = (c: Card) => c.spentThisMonth / c.monthlyLimit >= 0.85;
  const activeCount = cards.filter((c) => c.status === "Active").length;
  const nearLimitCount = cards.filter(nearLimit).length;
  const frozenCount = cards.filter((c) => c.status === "Frozen").length;
  const inactiveCount = cards.filter((c) => c.status === "Inactive").length;
  const usdcCount = cards.filter((c) => c.funding.asset === "USDC").length;
  const anyFilter =
    filter !== "All" ||
    onlyNearLimit ||
    assetFilter !== "All" ||
    typeFilter !== "All" ||
    query !== "";

  const rows = visible
    .filter((c) => typeFilter === "All" || c.type === typeFilter)
    .filter((c) => !onlyNearLimit || nearLimit(c))
    .filter((c) => assetFilter === "All" || c.funding.asset === assetFilter)
    .sort((a, b) =>
      sortDir === "desc"
        ? b.spentThisMonth - a.spentThisMonth
        : a.spentThisMonth - b.spentThisMonth,
    );
  const allChecked = rows.length > 0 && rows.every((c) => checked.has(c.id));

  const toggleChecked = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      {mode === "onboard" && (
        <CardsOnboarding
          contentRef={contentRef}
          sources={sources}
          workspace="Kredete"
          onGranted={onGranted}
          onReveal={onReveal}
          onDone={onOnboarded}
        />
      )}
      <div
        ref={contentRef}
        className={`mx-auto max-w-(--page-max) px-8 pt-12 pb-16 transition-opacity duration-700 ease-out ${
          revealed ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Title */}
        <div className="flex items-center justify-between gap-6">
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            Cards
          </h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={replayIntro}
              className="h-8 rounded-full px-3 text-[13px] text-neutral-500 transition-colors hover:text-white"
            >
              Replay intro
            </button>
            {/* Cards are issued through the API, not from the dashboard */}
            <Link
              href="/manage/configure"
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              API keys
            </Link>
          </div>
        </div>

        {/* Spend this month, drawn; the other figures beside it filter the table */}
        <div
          key={revealKey}
          className="mt-8 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-[minmax(0,1fr)_300px]"
        >
          <SpendPanel
            spent={spent}
            limit={spend.limit}
            daily={fresh ? null : daily}
          />
          <div className="flex flex-col border-white/8 lg:border-l lg:pl-8">
            <SideFact
              label="Cards"
              value={<Roll value={String(cards.length)} />}
              meta={`${activeCount} active · ${frozenCount} frozen · ${inactiveCount} inactive`}
              active={false}
              hint={anyFilter ? "Clear filters" : undefined}
              onClick={() => {
                setFilter("All");
                setOnlyNearLimit(false);
                setAssetFilter("All");
                setTypeFilter("All");
                setQuery("");
              }}
            >
              <Meter
                parts={[
                  { value: activeCount / total, tone: "bg-white/80" },
                  { value: frozenCount / total, tone: "hatch bg-white/30" },
                  { value: inactiveCount / total, tone: "bg-white/12" },
                ]}
              />
            </SideFact>
            <SideFact
              label="Near their limit"
              value={<Roll value={String(nearLimitCount)} />}
              meta="At 85% or more of their limit"
              active={onlyNearLimit}
              onClick={() => setOnlyNearLimit((v) => !v)}
            >
              <span className="flex -space-x-2">
                {cards
                  .filter(nearLimit)
                  .slice(0, 4)
                  .map((c) => (
                    <span
                      key={c.id}
                      title={c.holder}
                      className="rounded-full ring-2 ring-[var(--surface)]"
                    >
                      <Avatar name={c.holder} photo={c.photo} size={22} />
                    </span>
                  ))}
              </span>
            </SideFact>
            <SideFact
              label="Funded by USDC"
              value={
                <Roll value={`${Math.round((usdcCount / total) * 100)}%`} />
              }
              meta={`${usdcCount} on stablecoin wallets · ${cards.length - usdcCount} on USD`}
              active={assetFilter === "USDC"}
              onClick={() =>
                setAssetFilter((a) => (a === "USDC" ? "All" : "USDC"))
              }
            />
          </div>
        </div>

        {/* Tabs + tools, same as Payment links and Customers */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div
            key={revealKey}
            role="tablist"
            className="flex items-center gap-1"
          >
            {(["All", "Active", "Frozen", "Inactive"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                  filter === f
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                }`}
              >
                {f}
                <span
                  className={`text-xs tabular-nums ${filter === f ? "text-neutral-400" : "text-neutral-600"}`}
                >
                  {String(count(f))}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Type"
              value={typeFilter}
              active={typeFilter !== "All"}
              align="right"
              options={[
                { value: "All", label: "All types" },
                { value: "Virtual", label: "Virtual" },
                { value: "Physical", label: "Physical" },
              ]}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
            />
            <label className="flex h-9 w-[240px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, card or customer ID…"
                aria-label="Search cards"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
          </div>
        </div>

        {/* Bulk actions: the black floating bar, same as every other table */}
        {checked.size > 0 && (
          <div
            role="toolbar"
            aria-label="Bulk actions"
            className="theme-lock-dark orbit-pop fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#0b0b0c] py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-[0_20px_60px_-12px_rgb(0_0_0/0.6)]"
          >
            <span className="mr-2 text-white tabular-nums">
              {checked.size} selected
            </span>
            <button
              type="button"
              onClick={() => {
                setCards((list) =>
                  list.map((c) =>
                    checked.has(c.id) ? { ...c, status: "Frozen" } : c,
                  ),
                );
                setToast(
                  `${checked.size} card${checked.size > 1 ? "s" : ""} frozen`,
                );
                setChecked(new Set());
              }}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-white transition-colors hover:bg-white/8"
            >
              <Snowflake
                size={14}
                strokeWidth={1.75}
                className="text-sky-300"
              />{" "}
              Freeze
            </button>
            <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => setChecked(new Set())}
              className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {/* Table: a row opens in place; the full card is behind "View all details" */}
        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-[140px]" />
            <col className="w-[200px]" />
            <col className="w-[200px]" />
            <col className="w-[110px]" />
            <col className="w-[40px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-3 font-normal">
                <Checkbox
                  checked={allChecked}
                  onChange={() =>
                    setChecked(
                      allChecked ? new Set() : new Set(rows.map((c) => c.id)),
                    )
                  }
                  label="Select all cards"
                />
              </th>
              <th className="py-2.5 font-normal">Cardholder</th>
              <th className="py-2.5 font-normal">Card</th>
              <th className="py-2.5 pr-8 text-right font-normal">
                <button
                  type="button"
                  onClick={() =>
                    setSortDir((d) => (d === "desc" ? "asc" : "desc"))
                  }
                  className="inline-flex items-center gap-1 hover:text-neutral-200"
                >
                  Spent this month
                  {sortDir === "desc" ? (
                    <ArrowDown size={12} strokeWidth={2} />
                  ) : (
                    <ArrowUp size={12} strokeWidth={2} />
                  )}
                </button>
              </th>
              <th className="py-2.5 font-normal">Funded from</th>
              <th className="py-2.5 font-normal">Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const ratio = c.spentThisMonth / c.monthlyLimit;
              const open = c.id === openId;
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : c.id)}
                    className={`group cursor-pointer border-b border-white/6 transition-colors ${
                      open ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                    } ${c.id === arrivedId ? "card-arrived" : ""}`}
                  >
                    <td
                      className="py-3 pl-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={checked.has(c.id)}
                        onChange={() => toggleChecked(c.id)}
                        label={`Select ${c.holder}`}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={c.holder} photo={c.photo} />
                        <div className="min-w-0">
                          <div className="truncate text-white">{c.holder}</div>
                          <div className="truncate font-mono text-[11px] text-neutral-500">
                            {c.customerId === "—"
                              ? "No customer linked"
                              : `cus_${c.customerId.slice(-6)}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <CardThumb frozen={c.status === "Frozen"} />
                        <div>
                          <div className="text-neutral-100 tabular-nums">
                            ••{c.last4}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {c.type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-8">
                      <div
                        className={`text-right tabular-nums ${
                          c.status === "Frozen"
                            ? "text-neutral-500"
                            : ratio >= 0.85
                              ? "font-medium text-white"
                              : "text-neutral-100"
                        }`}
                      >
                        {wholeMoney(c.spentThisMonth)}
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-2.5">
                        <div className="h-[3px] w-14 rounded-full bg-white/8">
                          <div
                            className={`h-full rounded-full ${c.status === "Frozen" ? "bg-white/25" : ratio >= 0.85 ? "bg-white" : "bg-white/55"}`}
                            style={{ width: `${Math.min(100, ratio * 100)}%` }}
                          />
                        </div>
                        <span className="w-[54px] text-right text-[11px] whitespace-nowrap text-neutral-500 tabular-nums">
                          of {compactMoney(c.monthlyLimit)}
                          {perSuffix[c.limitPeriod]}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <FundingLabel funding={c.funding} />
                    </td>
                    <td className="py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <ChevronDown
                        size={15}
                        strokeWidth={1.75}
                        className={`ml-auto text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-white/6 bg-white/[0.03]">
                      <td colSpan={7} className="px-3 pb-4">
                        <CardPreview
                          card={c}
                          onFreeze={() => {
                            const frozen = c.status === "Frozen";
                            update(c.id, {
                              status: frozen ? "Active" : "Frozen",
                            });
                            setToast(
                              frozen
                                ? `Card ••${c.last4} unfrozen`
                                : `Card ••${c.last4} frozen`,
                            );
                          }}
                          onLimits={() => setEditingLimitsFor(c.id)}
                          onViewAll={() => setSelectedId(c.id)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-neutral-500">
                  {waiting && request ? (
                    <WaitingForFirstCard
                      request={request}
                      onTest={firstCardArrives}
                    />
                  ) : cards.length === 0 ? (
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-neutral-200">
                        Card issuing isn&apos;t on yet
                      </span>
                      <span>
                        Request it once, then issue cards to your customers or
                        team through the API.
                      </span>
                      <button
                        type="button"
                        onClick={replayIntro}
                        className="mt-2 h-8 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
                      >
                        Request card issuing
                      </button>
                    </div>
                  ) : (
                    "No cards match your filters."
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > 0 && (
          <div className="mt-4 text-xs text-neutral-500 tabular-nums">
            {rows.length} {rows.length === 1 ? "card" : "cards"}
          </div>
        )}

        {/* Full card: the existing detail drawer, until cards get their own page */}
        {selected && (
          <CardDrawer
            card={selected}
            status={statusOf(selected)}
            onClose={() => setSelectedId(null)}
            onEditLimits={() => setEditingLimitsFor(selected.id)}
            onToggleFreeze={() => {
              const frozen = selected.status === "Frozen";
              update(selected.id, { status: frozen ? "Active" : "Frozen" });
              setToast(
                frozen
                  ? `Card ••${selected.last4} unfrozen`
                  : `Card ••${selected.last4} frozen`,
              );
            }}
          />
        )}
      </div>

      {editingLimitsFor && (
        <LimitsDialog
          card={cards.find((c) => c.id === editingLimitsFor)!}
          onClose={() => setEditingLimitsFor(null)}
          onSave={(settings: LimitSettings) => {
            update(editingLimitsFor, settings);
            setEditingLimitsFor(null);
            setToast(
              `Limit updated to ${money(settings.monthlyLimit)} ${settings.limitPeriod.toLowerCase()}`,
            );
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/** Smooth path that never overshoots the data (monotone cubic), same as the Account balance chart. */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  const n = pts.length;
  const d = pts
    .slice(0, -1)
    .map(([x, y], k) => (pts[k + 1][1] - y) / (pts[k + 1][0] - x));
  const m = pts.map((_, k) =>
    k === 0
      ? d[0]
      : k === n - 1
        ? d[n - 2]
        : d[k - 1] * d[k] <= 0
          ? 0
          : (d[k - 1] + d[k]) / 2,
  );
  let path = `M${pts[0][0]},${pts[0][1]}`;
  for (let k = 0; k < n - 1; k++) {
    const h = (pts[k + 1][0] - pts[k][0]) / 3;
    path += `C${pts[k][0] + h},${pts[k][1] + m[k] * h} ${pts[k + 1][0] - h},${pts[k + 1][1] - m[k + 1] * h} ${pts[k + 1][0]},${pts[k + 1][1]}`;
  }
  return path;
}

/**
 * Spend this month, drawn the way Account draws balance: the running total in mint, the same
 * days last month dashed behind it, and daily spend as a strip of bars. Hovering moves the
 * headline to that day.
 */
function SpendPanel({
  spent,
  limit,
  daily,
}: {
  spent: number;
  limit: number;
  daily: { thisMonth: number[]; lastMonth: number[] } | null;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const today = daily?.thisMonth.length ?? SPEND_DAY;
  const run = (xs: number[]) =>
    xs.reduce<number[]>((a, v) => [...a, (a[a.length - 1] ?? 0) + v], []);
  const current = daily ? run(daily.thisMonth) : [];
  const previous = daily ? run(daily.lastMonth).slice(0, today) : [];
  const n = current.length;
  const i = hover ?? n - 1;
  // Resting on today, the headline is the exact total; hovering reads the running total that day.
  const shown = hover === null || !n ? spent : current[i];
  const vsPrev = previous[n - 1]
    ? (spent - previous[n - 1]) / previous[n - 1]
    : 0;
  const pace = today ? (spent / today) * MONTH_DAYS : 0;

  const W = 1000;
  const H = 150;
  const hi = Math.max(...current, ...previous, 1);
  const top = hi * 1.12;
  const X = (k: number) => (n < 2 ? 0 : (k / (n - 1)) * W);
  const Y = (v: number) => ((top - v) / top) * H;
  const cur = smooth(current.map((v, k) => [X(k), Y(v)]));
  const prev = smooth(previous.map((v, k) => [X(k), Y(v)]));
  const area = `${cur}L${W},${H}L0,${H}Z`;
  const maxDay = Math.max(...(daily?.thisMonth ?? [1]), 1);
  const pct = (k: number) => `${(X(k) / W) * 100}%`;

  return (
    <section className="min-w-0 pt-1 lg:pr-8">
      <div className="text-[13px] text-neutral-500">Spent this month</div>
      <div className="amount mt-3 text-[34px] leading-none font-medium tracking-[-0.035em] text-white">
        <Money value={shown} roll={hover === null} />
      </div>
      <div className="mt-2.5 flex h-5 items-center gap-2 text-[12px] text-neutral-500 tabular-nums">
        {!daily ? (
          <span>
            {((spent / limit) * 100).toFixed(1)}% of {compactMoney(limit)}{" "}
            program limit
          </span>
        ) : hover === null ? (
          <>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-medium text-neutral-300">
              {vsPrev >= 0 ? "+" : "−"}
              {Math.abs(vsPrev * 100).toFixed(1)}%
            </span>
            <span>
              vs Sep 1–{today} · {((spent / limit) * 100).toFixed(1)}% of{" "}
              {compactMoney(limit)} program limit · on pace for{" "}
              {compactMoney(pace)}
            </span>
          </>
        ) : (
          <>
            <span className="text-neutral-300">Oct {i + 1}</span>
            <span>·</span>
            <span className="text-neutral-300">
              {money(daily.thisMonth[i])} that day
            </span>
            <span>
              · Sep {i + 1} {money(previous[i])}
            </span>
          </>
        )}
      </div>

      {daily && (
        <>
          {/* Plot */}
          <div className="relative mt-6" onMouseLeave={() => setHover(null)}>
            <div className="relative" style={{ height: H }}>
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden
              >
                <defs>
                  <linearGradient
                    id="card-spend-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--flow-in)"
                      stopOpacity="0.18"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--flow-in)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                <path
                  d={prev}
                  fill="none"
                  stroke="currentColor"
                  className="text-neutral-500"
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path d={area} fill="url(#card-spend-fill)" />
                <path
                  d={cur}
                  fill="none"
                  stroke="var(--flow-in)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              </svg>
              {hover !== null && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--flow-in)] ring-[3px] ring-[var(--surface)]"
                  style={{ left: pct(i), top: `${(Y(shown) / H) * 100}%` }}
                />
              )}
            </div>

            {/* Daily spend, from a shared baseline */}
            <div
              className="relative mt-3 flex h-9 items-end gap-px"
              aria-hidden
            >
              <span className="absolute inset-x-0 bottom-0 h-px bg-white/[0.08]" />
              {daily.thisMonth.map((v, k) => (
                <span
                  key={k}
                  className="relative flex h-full flex-1 flex-col justify-end"
                >
                  <span
                    className={`mx-auto w-[60%] max-w-[6px] rounded-t-[1px] bg-[var(--flow-in)] transition-opacity ${
                      hover !== null && hover !== k ? "opacity-35" : ""
                    }`}
                    style={{ height: Math.max(1.5, (v / maxDay) * 32) }}
                  />
                </span>
              ))}
            </div>

            {/* Crosshair across both, and the hover targets */}
            {hover !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-white/20"
                style={{ left: pct(i) }}
              />
            )}
            <div className="absolute inset-0 flex">
              {current.map((_, k) => (
                <span
                  key={k}
                  className="h-full flex-1 cursor-crosshair"
                  onMouseEnter={() => setHover(k)}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
            <span>Oct 1</span>
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-3 rounded-full bg-[var(--flow-in)]" />
                Spend
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-neutral-500" />
                Same days in Sep
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex items-end gap-px">
                  <span className="h-1.5 w-1 rounded-[1px] bg-[var(--flow-in)]" />
                  <span className="h-2.5 w-1 rounded-[1px] bg-[var(--flow-in)]" />
                </span>
                Daily spend
              </span>
            </span>
            <span>Today</span>
          </div>
        </>
      )}
    </section>
  );
}

/** A figure beside the spend chart; clicking it filters the table. */
function SideFact({
  label,
  value,
  meta,
  active,
  hint,
  onClick,
  children,
}: {
  label: string;
  value: React.ReactNode;
  meta: string;
  active: boolean;
  hint?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="group border-b border-white/8 py-4 text-left first:pt-0 last:border-b-0 last:pb-0"
    >
      <div className="flex items-center justify-between text-[13px]">
        <span className={active ? "text-white" : "text-neutral-500"}>
          {label}
        </span>
        <span
          className={`text-[11px] ${active || hint ? "text-neutral-300" : "text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100"}`}
        >
          {hint ?? (active ? "Filtering · clear" : "Filter")}
        </span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-[24px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
          {value}
        </span>
        {children && (
          <span className="min-w-0 flex-1 [&>div]:ml-auto [&>div]:max-w-[140px]">
            {children}
          </span>
        )}
      </div>
      <div className="mt-2 truncate text-xs text-neutral-500 tabular-nums">
        {meta}
      </div>
    </button>
  );
}

/** The opened row: the card, where its spend stands, what funds it, and its latest activity. */
function CardPreview({
  card: c,
  onFreeze,
  onLimits,
  onViewAll,
}: {
  card: Card;
  onFreeze: () => void;
  onLimits: () => void;
  onViewAll: () => void;
}) {
  const frozen = c.status === "Frozen";
  const ratio = c.spentThisMonth / c.monthlyLimit;
  const usdc = c.funding.asset === "USDC";
  return (
    <div className="rounded-xl border border-white/8 bg-[var(--surface)]">
      <div className="grid grid-cols-[200px_minmax(0,1fr)] gap-8 px-5 py-5">
        <FlatCard card={c} frozen={frozen} />
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-6">
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">Spent this month</div>
              <div className="mt-1 text-[15px] text-white tabular-nums">
                {money(c.spentThisMonth)}
                <span className="text-[12px] text-neutral-500">
                  {" "}
                  of {compactMoney(c.monthlyLimit)}
                </span>
              </div>
              <div className="mt-2 h-1 rounded-full bg-white/8">
                <div
                  className={`h-full rounded-full ${frozen ? "bg-white/25" : ratio >= 0.85 ? "bg-white" : "bg-white/55"}`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
                {money(Math.max(0, c.monthlyLimit - c.spentThisMonth))} left ·{" "}
                {resetCopy(c.limitPeriod, c.resetsOn)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">Funded from</div>
              <div className="mt-1 truncate text-[13px] text-neutral-100">
                {usdc ? `USDC · ${c.funding.label}` : c.funding.label}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                {usdc
                  ? `Converted at the moment of spend · ${c.funding.network}`
                  : "Spends from your USD balance"}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs text-neutral-500">Per purchase</div>
              <div className="mt-1 text-[13px] text-neutral-100 tabular-nums">
                {c.perTransactionLimit
                  ? money(c.perTransactionLimit)
                  : "No cap"}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                Alerts at {Math.round((c.alertAt ?? 0.8) * 100)}% of the limit
              </div>
            </div>
          </div>
          <div className="mt-5 border-t border-white/8 pt-2">
            {c.transactions.length ? (
              c.transactions
                .slice(0, 3)
                .map((t) => <ActivityRow key={t.id} txn={t} />)
            ) : (
              <p className="py-3 text-[13px] text-neutral-500">
                No transactions yet.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3">
        <span className="text-xs text-neutral-500 tabular-nums">
          Visa ••{c.last4} · {c.type} · expires{" "}
          {fullDateFmt.format(new Date(c.expiry))}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFreeze}
            className="flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-[12.5px] text-neutral-100 transition-colors hover:bg-white/[0.1]"
          >
            <Snowflake size={13} strokeWidth={1.75} />
            {frozen ? "Unfreeze" : "Freeze"}
          </button>
          <button
            type="button"
            onClick={onViewAll}
            className="flex h-8 items-center gap-0.5 rounded-full px-3 text-[12.5px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View all details
            <ChevronRight size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onLimits}
            className="flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            Edit limits
          </button>
        </div>
      </div>
    </div>
  );
}

/** Thin segmented bar; parts are fractions of the whole, separated by a 2px gap. */
function Meter({ parts }: { parts: { value: number; tone: string }[] }) {
  return (
    <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-white/6">
      {parts
        .filter((p) => p.value > 0)
        .map((p, i) => (
          <span
            key={i}
            className={`h-full rounded-full ${p.tone}`}
            style={{ width: `${Math.min(100, p.value * 100)}%` }}
          />
        ))}
    </div>
  );
}

/** Cardholder portrait; falls back to initials when there's no photo. */
function Avatar({
  name,
  photo,
  size = 32,
}: {
  name: string;
  photo?: string;
  size?: number;
}) {
  if (!photo) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[11px] font-semibold text-neutral-200"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote placeholder portraits
    <img
      src={photo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full object-cover grayscale-[15%]"
      style={{ width: size, height: size }}
    />
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors ${
        checked
          ? "border-brand bg-brand text-[#03140d]"
          : "border-white/20 hover:border-white/40"
      }`}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

function StatusBadge({ status }: { status: CardStatus }) {
  if (status === "Frozen") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-black">
        <Snowflake size={11} strokeWidth={2} />
        Frozen
      </span>
    );
  }
  const active = status === "Active";
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-white/10 text-white"
          : "border border-white/8 text-neutral-500"
      }`}
    >
      {status}
    </span>
  );
}

function FundingLabel({ funding }: { funding: FundingSource }) {
  const usdc = funding.asset === "USDC";
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          usdc
            ? "bg-white/8 text-neutral-200"
            : "border border-white/12 text-neutral-300"
        }`}
        aria-hidden
      >
        $
      </span>
      <span className="min-w-0">
        <span className="block truncate text-neutral-100">
          {usdc ? funding.label : "USD account"}
        </span>
        <span className="block truncate text-[11px] text-neutral-500">
          {usdc ? `USDC · ${funding.network}` : "Operating"}
        </span>
      </span>
    </span>
  );
}

function CardDrawer({
  card,
  status,
  onClose,
  onToggleFreeze,
  onEditLimits,
}: {
  card: Card;
  status: CardStatus;
  onClose: () => void;
  onToggleFreeze: () => void;
  onEditLimits: () => void;
}) {
  const frozen = status === "Frozen";
  const ratio = card.spentThisMonth / card.monthlyLimit;
  const remaining = Math.max(0, card.monthlyLimit - card.spentThisMonth);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Scrim: click to close */}
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${card.holder} card details`}
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto panel-glow rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium text-white">
              {card.holder}
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
              Visa ••{card.last4} · {card.type}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton label="More actions">
              <Ellipsis size={16} strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Close" onClick={onClose}>
              <X size={16} strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>

        {/* Card + actions */}
        <div className="px-6 pt-6">
          <div className="card-stage rounded-xl px-6 py-7">
            <div className="mx-auto max-w-[270px]">
              <FlatCard card={card} frozen={frozen} />
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-8">
            <RoundAction icon={Eye} label="Details" />
            <RoundAction
              icon={Snowflake}
              label={frozen ? "Unfreeze" : "Freeze"}
              active={frozen}
              onClick={onToggleFreeze}
            />
            <RoundAction
              icon={SlidersHorizontal}
              label="Limits"
              onClick={onEditLimits}
            />
          </div>
        </div>

        {/* Spend — the focal number */}
        <Section className="mt-7">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Spent this month</span>
            <button
              type="button"
              onClick={onEditLimits}
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              Edit limit
            </button>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white">
              <Money value={card.spentThisMonth} roll />
            </span>
            <span className="text-[13px] text-neutral-500 tabular-nums">
              of {money(card.monthlyLimit)}
              {perSuffix[card.limitPeriod]}
            </span>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/8">
            <div
              className={`h-full rounded-full ${frozen ? "bg-white/25" : usageTone(ratio)}`}
              style={{ width: `${Math.min(100, ratio * 100)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs text-neutral-500 tabular-nums">
            <span>{money(remaining)} left</span>
            <span>{resetCopy(card.limitPeriod, card.resetsOn)}</span>
          </div>
        </Section>

        {/* Funding — Gravv's difference */}
        <Section title="Funded from">
          <div className="flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-full border border-white/10 text-[13px] text-neutral-200">
              {card.funding.asset === "USDC" ? "◎" : "$"}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-white">
                {card.funding.asset === "USDC"
                  ? `USDC · ${card.funding.label}`
                  : card.funding.label}
              </div>
              <div className="text-xs text-neutral-500">
                {card.funding.asset === "USDC"
                  ? `Converted to USD at the moment of spend · ${card.funding.network}`
                  : "Spends directly from your USD balance"}
              </div>
            </div>
            <button
              type="button"
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              Change
            </button>
          </div>
        </Section>

        {/* Controls */}
        <Section title="Spend controls" flush>
          <ControlRow
            icon={Tags}
            title="Merchant categories"
            value="All categories allowed"
          />
          <ControlRow
            icon={Store}
            title="Merchants"
            value="No merchants blocked"
          />
          <ControlRow
            icon={Globe}
            title="Countries"
            value="All countries allowed"
          />
        </Section>

        {/* Activity */}
        <Section title="Recent activity" action="View all" flush>
          {card.transactions.length === 0 && (
            <p className="py-3 text-[13px] text-neutral-500">
              No transactions yet.
            </p>
          )}
          {card.transactions.slice(0, 5).map((t) => (
            <ActivityRow key={t.id} txn={t} />
          ))}
        </Section>

        {/* Details */}
        <Section title="Card details" flush>
          <DetailRow label="Card ID" value={card.id} copy />
          <DetailRow label="Customer ID" value={card.customerId} copy />
          <DetailRow
            label="Expires"
            value={fullDateFmt.format(new Date(card.expiry))}
          />
          <DetailRow
            label="Created"
            value={fullDateFmt.format(new Date(card.createdAt))}
          />
          <DetailRow
            label="Billing address"
            value={`${card.billing.line1}, ${card.billing.zip}, ${card.billing.country}`}
            copy
          />
        </Section>

        <div className="h-6 shrink-0" />
      </aside>
    </>
  );
}

function Section({
  title,
  action,
  flush = false,
  className = "",
  children,
}: {
  title?: string;
  action?: string;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mx-6 border-t border-white/7 pt-5 pb-5 ${className}`}>
      {title && (
        <div
          className={`flex items-center justify-between ${flush ? "mb-1" : "mb-3"}`}
        >
          <h3 className="text-xs text-neutral-500">{title}</h3>
          {action && (
            <button
              type="button"
              className="text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {action}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/6 hover:text-white"
    >
      {children}
    </button>
  );
}

function RoundAction({
  icon: Icon,
  label,
  active = false,
  onClick,
}: {
  icon: typeof Eye;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2"
    >
      <span
        className={`flex size-10 items-center justify-center rounded-full transition-colors ${
          active
            ? "bg-white text-black"
            : "bg-white/7 text-neutral-200 group-hover:bg-white/12"
        }`}
      >
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="text-xs text-neutral-400 group-hover:text-neutral-200">
        {label}
      </span>
    </button>
  );
}

function ControlRow({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Eye;
  title: string;
  value: string;
}) {
  return (
    <button
      type="button"
      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-white/4"
    >
      <Icon size={15} strokeWidth={1.6} className="shrink-0 text-neutral-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-neutral-100">{title}</span>
        <span className="block text-xs text-neutral-500">{value}</span>
      </span>
      <ChevronRight size={14} strokeWidth={1.75} className="text-neutral-600" />
    </button>
  );
}

function ActivityRow({ txn: t }: { txn: CardTxn }) {
  const d = new Date(t.timestamp);
  const failed = t.status === "Failed";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/6 text-[11px] text-neutral-300">
        {t.merchant[0]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-neutral-100">
          {t.merchant}
        </span>
        <span className="block text-xs text-neutral-500 tabular-nums">
          {dateFmt.format(d)}, {timeFmt.format(d)}
          {t.status === "Pending" && (
            <span className="text-neutral-400"> · Pending</span>
          )}
          {failed && (
            <span
              className="font-medium text-neutral-300"
              title={t.failureReason}
            >
              {" "}
              · Declined
            </span>
          )}
        </span>
      </span>
      <span
        className={`text-[13px] tabular-nums ${failed ? "text-neutral-600 line-through" : "text-neutral-100"}`}
      >
        −{money(t.amount)}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  value,
  copy = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 shrink-0 text-xs text-neutral-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-200">
        {value}
      </span>
      {copy && (
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      )}
    </div>
  );
}
