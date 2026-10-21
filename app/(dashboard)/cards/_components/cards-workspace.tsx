"use client";

import {
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
  ChevronLeft,
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
import { CardThumb, FlatCard } from "./flat-card";
import { Money } from "./money";
import type { IssueCardInput } from "./issue-card";
import Link from "next/link";
import { LimitsDialog, resetCopy, type LimitSettings } from "./limits-dialog";
import type { Card, CardStatus, CardTxn, FundingSource } from "../_data";
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
    resetsOn: "2026-11-30",
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
}: {
  initialCards: Card[];
  sources: (FundingSource & { balance: number })[];
  spend: { spent: number; limit: number; period: string };
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
        className={`mx-auto max-w-[1180px] px-8 pt-12 pb-16 transition-opacity duration-700 ease-out ${
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

        {/* Summary strip — each segment filters the table (Semrush / Mintlify pattern) */}
        <div
          key={revealKey}
          className="mt-8 grid gap-y-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Segment label="Spent this month">
            <div className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white">
              <Money value={spent} roll />
            </div>
            <Meter parts={[{ value: spent / spend.limit, tone: "bg-brand" }]} />
            <p className="text-xs text-neutral-500 tabular-nums">
              {((spent / spend.limit) * 100).toFixed(1)}% of{" "}
              {compactMoney(spend.limit)} · {spend.period}
            </p>
          </Segment>

          <Segment
            label="Cards"
            hint={anyFilter ? "Clear filters" : undefined}
            onClick={() => {
              setFilter("All");
              setOnlyNearLimit(false);
              setAssetFilter("All");
              setTypeFilter("All");
            }}
          >
            <div className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
              <Roll value={String(cards.length)} />
            </div>
            <Meter
              parts={[
                { value: activeCount / total, tone: "bg-brand" },
                {
                  value: frozenCount / total,
                  tone: "hatch bg-white/30",
                },
                { value: inactiveCount / total, tone: "bg-white/15" },
              ]}
            />
            <p className="text-xs text-neutral-500 tabular-nums">
              {activeCount} active · {frozenCount} frozen · {inactiveCount}{" "}
              inactive
            </p>
          </Segment>

          <Segment
            label="Near their limit"
            active={onlyNearLimit}
            onClick={() => setOnlyNearLimit((v) => !v)}
          >
            <div className="flex items-center gap-3">
              <span className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
                <Roll value={String(nearLimitCount)} />
              </span>
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
                      <Avatar name={c.holder} photo={c.photo} size={26} />
                    </span>
                  ))}
              </span>
            </div>
            <Meter
              parts={[{ value: nearLimitCount / total, tone: "bg-brand" }]}
            />
            <p className="text-xs text-neutral-500">
              At 85% or more of their limit
            </p>
          </Segment>

          <Segment
            label="Funded by USDC"
            active={assetFilter === "USDC"}
            onClick={() =>
              setAssetFilter((a) => (a === "USDC" ? "All" : "USDC"))
            }
          >
            <div className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
              <Roll value={`${Math.round((usdcCount / total) * 100)}%`} />
            </div>
            <Meter
              parts={[
                { value: usdcCount / total, tone: "bg-brand" },
                { value: 1 - usdcCount / total, tone: "bg-white/15" },
              ]}
            />
            <p className="text-xs text-neutral-500 tabular-nums">
              {usdcCount} on stablecoin wallets · {cards.length - usdcCount} on
              USD
            </p>
          </Segment>
        </div>

        <div className="mt-9 flex items-start gap-6">
          {/* Table block — one grey container for tabs, filters, table and footer */}
          <div className="min-w-0 flex-1">
            {/* Tabs + filters */}
            {/* One row at every width: wrapping would detach the active tab from the table block. */}
            <div className="flex items-end justify-between gap-3">
              <div
                key={revealKey}
                role="tablist"
                className="flex min-w-0 shrink overflow-x-auto pr-4 [scrollbar-width:none]"
              >
                {(["All", "Active", "Frozen", "Inactive"] as Filter[]).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      role="tab"
                      aria-selected={filter === f}
                      onClick={() => setFilter(f)}
                      className={`relative flex h-11 shrink-0 items-center gap-2 rounded-t-2xl px-4 text-[13px] whitespace-nowrap transition-colors ${
                        filter === f
                          ? "tab-attached font-medium text-white"
                          : "text-neutral-500 hover:text-neutral-200"
                      }`}
                    >
                      {/* Inverted corners so the tab flows into the table block */}
                      {filter === f && f !== "All" && (
                        <span className="tab-fillet-l" aria-hidden />
                      )}
                      {filter === f && (
                        <span className="tab-fillet-r" aria-hidden />
                      )}
                      {f === "All" ? "All cards" : f}
                      <span
                        className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${
                          filter === f
                            ? "bg-white/12 text-neutral-200"
                            : "bg-white/6 text-neutral-500"
                        }`}
                      >
                        <Roll value={String(count(f))} />
                      </span>
                    </button>
                  ),
                )}
              </div>
              <div className="mb-2 flex min-w-0 shrink-0 items-center gap-2">
                <FilterMenu
                  label="Type"
                  value={typeFilter}
                  options={["All", "Virtual", "Physical"]}
                  onChange={(v) => setTypeFilter(v as typeof typeFilter)}
                />
                <label className="flex h-8 w-36 items-center gap-2 rounded-full border border-white/10 bg-surface px-3 focus-within:border-brand xl:w-52">
                  <Search
                    size={13}
                    strokeWidth={1.75}
                    className="shrink-0 text-neutral-500"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search cards"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
                  />
                </label>
              </div>
            </div>

            {/* Table block — grey container around the table only */}
            <section
              className={`table-block rounded-2xl px-5 ${filter === "All" ? "rounded-tl-none" : ""}`}
            >
              {/* Bulk actions */}
              {checked.size > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-surface px-3 py-2 text-[13px]">
                  <span className="text-neutral-200 tabular-nums">
                    {checked.size} selected
                  </span>
                  <span className="h-4 w-px bg-white/10" />
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
                    className="flex items-center gap-1.5 text-neutral-300 hover:text-white"
                  >
                    <Snowflake size={13} strokeWidth={1.75} /> Freeze
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecked(new Set())}
                    className="ml-auto text-neutral-500 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              )}

              <table className="w-full table-fixed text-[13px]">
                <colgroup>
                  <col className="w-9" />
                  <col />
                  <col className="w-[132px]" />
                  <col className="w-[176px]" />
                  <col className="w-[196px]" />
                  <col className="w-[104px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
                    <th className="py-3 font-normal">
                      <Checkbox
                        checked={allChecked}
                        onChange={() =>
                          setChecked(
                            allChecked
                              ? new Set()
                              : new Set(rows.map((c) => c.id)),
                          )
                        }
                        label="Select all cards"
                      />
                    </th>
                    <th className="py-3 font-normal">Cardholder</th>
                    <th className="py-3 font-normal">Card</th>
                    <th className="py-3 pr-6 text-right font-normal">
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
                    <th className="py-3 font-normal">Funded from</th>
                    <th className="py-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const ratio = c.spentThisMonth / c.monthlyLimit;
                    const isSelected = c.id === selected?.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        aria-selected={isSelected}
                        className={`group cursor-pointer border-b border-white/6 transition-colors ${
                          isSelected ? "bg-white/5" : "hover:bg-white/3"
                        } ${c.id === arrivedId ? "card-arrived" : ""}`}
                      >
                        <td
                          className="py-3"
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
                              <div className="truncate font-medium text-white">
                                {c.holder}
                              </div>
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
                        <td className="py-3 pr-6">
                          <div
                            className={`text-right tabular-nums ${
                              c.status === "Frozen"
                                ? "text-neutral-500"
                                : ratio >= 0.85
                                  ? "font-medium text-white"
                                  : "text-neutral-100"
                            }`}
                            title={ratio >= 0.85 ? "Near limit" : undefined}
                          >
                            {wholeMoney(c.spentThisMonth)}
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-2.5">
                            <div className="h-[3px] w-14 rounded-full bg-white/8">
                              <div
                                className={`h-full rounded-full ${c.status === "Frozen" ? "bg-white/25" : usageTone(ratio)}`}
                                style={{
                                  width: `${Math.min(100, ratio * 100)}%`,
                                }}
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
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-16 text-center text-neutral-500"
                      >
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
                              Request it once, then issue cards to your
                              customers or team through the API.
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

              {/* Footer */}
              <div className="flex items-center justify-between py-4 text-xs text-neutral-500">
                <span className="tabular-nums">
                  {rows.length} {rows.length === 1 ? "card" : "cards"}
                </span>
                <div className="flex items-center gap-1">
                  <PagerButton label="Previous page">
                    <ChevronLeft size={14} strokeWidth={1.75} />
                  </PagerButton>
                  <PagerButton label="Next page">
                    <ChevronRight size={14} strokeWidth={1.75} />
                  </PagerButton>
                </div>
              </div>
            </section>
          </div>

          {/* Detail */}
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

function Segment({
  label,
  active = false,
  hint,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  /** Overrides the default "Filter" hover hint. */
  hint?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between text-[13px]">
        <span
          className={
            active
              ? "font-medium text-white underline decoration-white/60 decoration-2 underline-offset-[6px]"
              : "text-neutral-400"
          }
        >
          {label}
        </span>
        {onClick && hint !== undefined ? (
          <span className="text-[11px] text-neutral-400">{hint}</span>
        ) : onClick && label !== "Cards" ? (
          <span
            className={`text-[11px] ${
              active
                ? "text-neutral-300"
                : "text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100"
            }`}
          >
            {active ? "Filtering · clear" : "Filter"}
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </>
  );
  const base =
    "group relative border-white/8 px-6 py-1 text-left first:pl-0 sm:[&:nth-child(2n)]:border-l lg:[&:not(:first-child)]:border-l";
  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`${base} transition-opacity ${active ? "" : "hover:opacity-80"}`}
    >
      {body}
    </button>
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

function PagerButton({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled
      className="flex size-7 items-center justify-center rounded-md text-neutral-500 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = value !== "All";
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node))
            setOpen(false);
        }}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${
          active
            ? "border-white/30 bg-surface text-white"
            : "border-white/10 bg-surface text-neutral-300 hover:border-white/25"
        }`}
      >
        {active ? value : label}
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className="text-neutral-500"
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1.5 w-40 rounded-lg border border-white/10 bg-raised p-1 shadow-2xl"
        >
          {options.map((o) => (
            <button
              key={o}
              type="button"
              role="menuitemradio"
              aria-checked={value === o}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] text-neutral-200 hover:bg-white/6"
            >
              {o === "All" ? `All types` : o}
              {value === o && <Check size={13} strokeWidth={2} />}
            </button>
          ))}
        </div>
      )}
    </div>
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
