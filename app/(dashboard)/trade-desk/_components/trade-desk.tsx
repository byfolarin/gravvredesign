"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Download, Search, X } from "lucide-react";
import Link from "next/link";
import { Dropdown } from "@/app/_components/dropdown";
import { CopyButton } from "@/app/_components/copy-button";
import { Roll } from "@/app/_components/roll";
import { TablePager, usePager } from "@/app/_components/table-pager";
import { QuoteTicket } from "./quote-ticket";
import { TwoFactorGate } from "./two-factor-gate";
import { PairMark } from "./asset-mark";
import { RateChart } from "./rate-chart";
import { SettlementSheet } from "./settlement-sheet";
import {
  ProblemPanel,
  RowMenu,
  downloadConfirmation,
  payoutText,
  type MenuItem,
} from "./order-extras";
import {
  ASSET_NAME,
  AS_OF,
  DESTINATIONS,
  type Asset,
  type Destination,
  LIMITS,
  MONTH,
  ORDERS,
  ERROR_ORDERS,
  requestsFor,
  DEPOSIT,
  DEPOSIT_WINDOW_MS,
  RATE_HOLD_MS,
  REQUESTS,
  shortId,
  type QuoteRequest,
  PAIRS,
  SOURCES,
  ago,
  compact,
  dateFmt,
  fmt,
  timeFmt,
  usdValue,
  type Order,
  type OrderStatus,
  type Pair,
} from "../_data";
import { UpdateNotice } from "@/app/_components/updates";
import { LoadingState } from "@/app/_components/loading-state";

const TWO_STEP_KEY = "gravv-trade-2fa";

const rateLabel = (p: Pair, rate = p.rate) =>
  fmt(p.get, rate, rate >= 10 ? 2 : 4);

export function TradeDesk() {
  const [ready, setReady] = useState(false);
  const [twoStep, setTwoStep] = useState(false);
  const [pairs, setPairs] = useState(PAIRS);
  const [pairId, setPairId] = useState("USDC-NGN");
  const [orders, setOrders] = useState(ORDERS);
  const [requests, setRequests] = useState(REQUESTS);
  // Settlement accounts (SSIs) — edited in the sheet, picked in the ticket.
  const [ssis, setSsis] = useState<Destination[]>(DESTINATIONS);
  const [settleOpen, setSettleOpen] = useState(false);
  const [addFor, setAddFor] = useState<Asset | null>(null);
  const openSettlement = (asset: Asset | null = null) => {
    setAddFor(asset);
    setSettleOpen(true);
  };
  const [tab, setTab] = useState<Tab>("requests");
  const [activityKey, setActivityKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  // Prototype: switch what the desk shows — real data, a brand-new account, problems, loading.
  const [view, setView] = useState<View>("filled");
  const [ticketKey, setTicketKey] = useState(0);
  const [prefill, setPrefill] = useState<{ amount: number; n: number } | null>(
    null,
  );
  const [cancelAsk, setCancelAsk] = useState<string | null>(null);
  const [limitRequested, setLimitRequested] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const switchView = (v: View) => {
    setView(v);
    setOrders(
      v === "empty"
        ? []
        : v === "errors"
          ? [...ERROR_ORDERS, ...ORDERS]
          : ORDERS,
    );
    setRequests(
      v === "empty"
        ? []
        : v === "errors"
          ? [...requestsFor(ERROR_ORDERS, 700), ...REQUESTS]
          : REQUESTS,
    );
    setTab(v === "errors" ? "open" : "requests");
    setOpenId(v === "errors" ? ERROR_ORDERS[0].id : null);
    setActivityKey((k) => k + 1);
    setTicketKey((k) => k + 1);
    setPrefill(null);
  };
  // The rate chart opens inline under the picked rate. It opens by itself once you start a
  // quote (type an amount, change a currency) and stays open until you hide it; after that,
  // typing leaves it hidden — picking a rate opens it again.
  const [rowOpen, setRowOpen] = useState(false);
  const [userHid, setUserHid] = useState(false);
  const openChart = () => {
    if (!userHid) setRowOpen(true);
  };
  const hideChart = () => {
    setRowOpen(false);
    setUserHid(true);
  };

  // Read saved choices on the client (prototype state lives in localStorage).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setTwoStep(localStorage.getItem(TWO_STEP_KEY) === "1");
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  // Pages stay alive in the background; replay the number roll on every visit.
  useLayoutEffect(() => () => setRevealKey((k) => k + 1), []);

  // Indicative rates drift a little every few seconds, like a live desk.
  useEffect(() => {
    if (!twoStep) return;
    const id = setInterval(() => {
      setPairs((list) =>
        list.map((p) => {
          if (p.sell === "USD" && p.get === "USDC") return p;
          const next = Number(
            (p.rate * (1 + (Math.random() - 0.5) * 0.0007)).toFixed(
              p.rate >= 10 ? 2 : 4,
            ),
          );
          return { ...p, rate: next, history: [...p.history.slice(1), next] };
        }),
      );
    }, 3200);
    return () => clearInterval(id);
  }, [twoStep]);
  const enableTwoStep = () => {
    setTwoStep(true);
    setRevealKey((k) => k + 1);
    try {
      localStorage.setItem(TWO_STEP_KEY, "1");
    } catch {}
  };
  const lockAgain = () => {
    setTwoStep(false);
    try {
      localStorage.removeItem(TWO_STEP_KEY);
    } catch {}
  };

  const usedToday =
    LIMITS.usedToday +
    orders
      .filter((o) => o.createdAt > AS_OF && o.status !== "Cancelled")
      .reduce((s, o) => s + usdValue(o.sell, o.sellAmount), 0);
  const traded =
    MONTH.traded +
    orders
      .filter((o) => o.createdAt > AS_OF)
      .reduce((s, o) => s + usdValue(o.sell, o.sellAmount), 0);
  const open = orders.filter(isOpen);
  const nextId = `OTC-${Math.max(...orders.map((o) => Number(o.id.slice(4)))) + 1}`;

  const onQuoted = (r: QuoteRequest) => setRequests((list) => [r, ...list]);
  const onQuoteEnded = (id: string, outcome: "Expired" | "Declined") =>
    setRequests((list) =>
      list.map((r) =>
        r.id === id && r.outcome === "Live" ? { ...r, outcome } : r,
      ),
    );
  const onPlaced = (o: Order, requestId: string) => {
    setRequests((list) =>
      list.map((r) =>
        r.id === requestId ? { ...r, outcome: "Accepted", orderId: o.id } : r,
      ),
    );
    setOrders((list) => [o, ...list]);
    run(o);
  };

  // Moves an order along: approval (if needed) → funds (auto from Gravv, or your deposit) →
  // paid out → settled. Prototype timings.
  const patch = (id: string, p: (x: Order) => Partial<Order>) =>
    setOrders((list) => list.map((x) => (x.id === id ? { ...x, ...p(x) } : x)));
  const settle = (id: string) =>
    setTimeout(() => {
      const t = Date.now();
      patch(id, (x) => ({
        status: "Settled",
        steps: { ...x.steps, paidOut: t - 400, settled: t },
      }));
    }, 6000);
  const fund = (id: string) => {
    patch(id, (x) => ({
      status: "Settling",
      steps: { ...x.steps, funded: Date.now() },
    }));
    settle(id);
  };
  const run = (o: Order) => {
    const external = SOURCES.find((s) => s.id === o.sourceId)?.external;
    const afterApproval = () => {
      if (external) patch(o.id, () => ({ status: "Awaiting funds" }));
      else fund(o.id);
    };
    if (o.status === "Awaiting approval") {
      setTimeout(() => {
        patch(o.id, (x) => ({
          approval: { ...x.approval!, by: "Chioma Eze", at: Date.now() },
        }));
        afterApproval();
      }, 9000);
    } else if (o.status === "Settling") settle(o.id);
  };
  const markSent = (id: string) => fund(id);

  // Row actions and the next steps on problem orders.
  const requestAgain = (pairId: string, amount: number) => {
    setPairId(pairId);
    setPrefill((p) => ({ amount, n: (p?.n ?? 0) + 1 }));
    openChart();
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const acts: Acts = {
    view: (id) => setSheetId(id),
    cancel: (id) => {
      patch(id, () => ({
        status: "Cancelled",
        problem: { kind: "cancelled", by: "Oluwatobi Bello" },
      }));
      setCancelAsk(null);
    },
    askCancel: (id) => {
      setCancelAsk(id);
      setOpenId(id);
    },
    keep: () => setCancelAsk(null),
    cancelAsk,
    retry: (id, destinationId) => {
      patch(id, (x) => ({
        status: "Settling",
        destinationId,
        problem: undefined,
        steps: { ...x.steps, paidOut: undefined },
      }));
      settle(id);
    },
    sentRest: (id) => {
      patch(id, () => ({ problem: undefined }));
      fund(id);
    },
    settleReceived: (id) => {
      patch(id, (x) => {
        const got =
          x.problem?.kind === "short" ? x.problem.received : x.sellAmount;
        return { sellAmount: got, getAmount: got * x.rate, problem: undefined };
      });
      fund(id);
    },
    requestAgain,
    copyPayout: (o) => navigator.clipboard?.writeText(payoutText(o, ssis)),
    download: (o) => downloadConfirmation(o, ssis),
  };
  const viewOrder = (id: string) => {
    const o = orders.find((x) => x.id === id);
    // Any in-flight status (approval, funds, settling) lives under Open orders.
    setTab(!o || isOpen(o) ? "open" : "history");
    setActivityKey((k) => k + 1); // clear search / filters so the row can't be hidden
    setOpenId(id);
    setTimeout(
      () =>
        document
          .getElementById(`order-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
  };

  const ticketProps = {
    onQuoted,
    onQuoteEnded,
    pairs,
    pairId,
    onPairChange: (id: string) => {
      setPairId(id);
      openChart();
    },
    onEdit: openChart,
    usedToday: view === "empty" ? 0 : usedToday,
    nextId,
    onPlaced,
    onViewOrder: viewOrder,
    destinations: ssis,
    onAddSettlement: (a: Asset) => openSettlement(a),
    prefill,
    demoErrors: view === "errors",
    limitRequested,
    onLimitRequested: setLimitRequested,
    onDeskQuoted: (id: string, rate: number, expiresAt: number) =>
      setRequests((list) =>
        list.map((r) =>
          r.id === id ? { ...r, rate, expiresAt, outcome: "Live" } : r,
        ),
      ),
  };
  const sheetOrder = orders.find((o) => o.id === sheetId) ?? null;

  return (
    <div ref={scroller} className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[1240px] px-8 pt-12 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Trade desk
            </h1>
            <p className="mt-1 text-[13px] text-neutral-500">
              Large conversions at a firm price, settled straight to your
              wallets and accounts.
            </p>
          </div>
          {twoStep && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={lockAgain}
                className="h-8 rounded-full px-3 text-[13px] text-neutral-500 transition-colors hover:text-white"
              >
                Show two-step gate
              </button>
              <Dropdown
                label="State"
                variant="compact"
                align="right"
                value={view}
                options={[
                  { value: "filled", label: "Filled", hint: "Today's desk" },
                  { value: "empty", label: "Empty", hint: "A new account" },
                  {
                    value: "errors",
                    label: "Errors",
                    hint: "Returned, short, rejected…",
                  },
                  { value: "loading", label: "Loading", hint: "Drive loader" },
                ]}
                onChange={switchView}
              />
              <button
                type="button"
                onClick={() => openSettlement()}
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
              >
                Settlement accounts
              </button>
            </div>
          )}
        </div>

        {!ready ? null : !twoStep ? (
          <TwoFactorGate onEnabled={enableTwoStep} />
        ) : view === "loading" ? (
          // Loading is the Drive loader alone — no skeletons (owner's call).
          <div className="flex min-h-[520px] items-center justify-center">
            <LoadingState variant="Drive" label="Loading the desk" />
          </div>
        ) : (
          // Ticket first (Binance OTC): the quote ticket leads, rates beside it, history below.
          <div key={`ticket-${revealKey}`} className="intro-status mt-8">
            <UpdateNotice
              id="u-candles"
              place="trade-desk"
              cta="Open a chart"
              className="mb-8"
              onAction={() => {
                setUserHid(false);
                setRowOpen(true);
              }}
            />
            <Facts
              traded={view === "empty" ? 0 : traded}
              open={open.length}
              usedToday={view === "empty" ? 0 : usedToday}
              empty={view === "empty"}
              limitRequested={limitRequested}
            />
            <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
              <section>
                <h2 className="text-[19px] font-medium tracking-[-0.015em] text-white">
                  Get a quote
                </h2>
                <p className="mt-1 mb-5 text-[13px] text-neutral-500">
                  Tell the desk what you&apos;re selling. You&apos;ll get a firm
                  price to accept or let go.
                </p>
                <QuoteTicket key={ticketKey} {...ticketProps} size="hero" />
              </section>
              <section className="min-w-0">
                <SectionHead
                  title="Rates"
                  note="Indicative · pick one to quote it"
                />
                <RatesBoard
                  pairs={pairs}
                  activeId={pairId}
                  onPick={(id) => {
                    // Picking the open rate again closes its chart; any other rate opens it.
                    if (id === pairId && rowOpen) hideChart();
                    else {
                      setPairId(id);
                      setRowOpen(true);
                      setUserHid(false);
                    }
                  }}
                  columns={1}
                  rowChart={rowOpen}
                  onHideChart={hideChart}
                />
              </section>
            </div>
            <Activity
              key={activityKey}
              acts={acts}
              view={view}
              ssis={ssis}
              onMarkSent={markSent}
              tab={tab}
              onTab={setTab}
              requests={requests}
              orders={orders}
              pairs={pairs}
              openId={openId}
              onToggle={(id) => setOpenId((v) => (v === id ? null : id))}
              onDetails={setSheetId}
              onViewOrder={viewOrder}
            />
          </div>
        )}
      </div>

      {settleOpen && (
        <SettlementSheet
          key={addFor ?? "list"}
          ssis={ssis}
          onChange={setSsis}
          addFor={addFor}
          onClose={() => setSettleOpen(false)}
        />
      )}
      {sheetOrder && (
        <OrderSheet
          order={sheetOrder}
          ssis={ssis}
          onClose={() => setSheetId(null)}
        />
      )}
    </div>
  );
}

type Tab = "requests" | "open" | "history";
const isOpen = (o: Order) =>
  o.status === "Awaiting approval" ||
  o.status === "Awaiting funds" ||
  o.status === "Settling" ||
  // Problems that still need you stay open until they're resolved.
  o.status === "Payout returned" ||
  o.status === "Short deposit";

type View = "filled" | "empty" | "errors" | "loading";

type Acts = {
  view: (id: string) => void;
  cancel: (id: string) => void;
  askCancel: (id: string) => void;
  keep: () => void;
  cancelAsk: string | null;
  retry: (id: string, destinationId: string) => void;
  sentRest: (id: string) => void;
  settleReceived: (id: string) => void;
  requestAgain: (pairId: string, amount: number) => void;
  copyPayout: (o: Order) => void;
  download: (o: Order) => void;
};

/** CSV of exactly what the tab shows (filters applied). */
function exportCsv(
  tab: Tab,
  rows: QuoteRequest[] | Order[],
  statusOf: (r: QuoteRequest) => string,
  ssis: Destination[],
) {
  const esc = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const iso = (t?: number) => (t ? new Date(t).toISOString() : "");
  const lines =
    tab === "requests"
      ? [
          [
            "Request ID",
            "Pair",
            "Amount",
            "Asset",
            "Quoted rate",
            "Status",
            "Order",
            "Requested at",
            "Requested by",
          ],
          ...(rows as QuoteRequest[]).map((r) => [
            r.id,
            `${r.sell}/${r.get}`,
            r.amount,
            r.sell,
            r.rate,
            statusOf(r),
            r.orderId ?? "",
            iso(r.createdAt),
            r.requestedBy,
          ]),
        ]
      : [
          [
            "Order",
            "Pair",
            "Sold",
            "Sold asset",
            "Got",
            "Got asset",
            "Rate",
            "Status",
            "From",
            "Paid out to",
            "Placed by",
            "Accepted at",
            "Settled at",
          ],
          ...(rows as Order[]).map((o) => [
            o.id,
            `${o.sell}/${o.get}`,
            o.sellAmount,
            o.sell,
            o.getAmount.toFixed(2),
            o.get,
            o.rate,
            o.status,
            SOURCES.find((x) => x.id === o.sourceId)?.label ?? "",
            ssis.find((d) => d.id === o.destinationId)?.label ?? "",
            o.placedBy,
            iso(o.steps.accepted),
            iso(o.steps.settled),
          ]),
        ];
  const csv = lines.map((l) => l.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `trade-desk-${tab === "requests" ? "requests" : tab === "open" ? "open-orders" : "order-history"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The ⋮ menu on an order row: what you can do from where it is. */
function orderMenu(o: Order, a: Acts): MenuItem[] {
  return [
    { label: "View details", run: () => a.view(o.id) },
    { label: "Copy payout details", run: () => a.copyPayout(o) },
    ...(o.status === "Settled"
      ? [{ label: "Download confirmation", run: () => a.download(o) }]
      : []),
    ...(o.status === "Cancelled" || o.status === "Rejected"
      ? [
          {
            label: "Request again",
            run: () => a.requestAgain(o.pairId, o.sellAmount),
          },
        ]
      : []),
    ...(o.status === "Awaiting approval" || o.status === "Awaiting funds"
      ? [{ label: "Cancel order…", run: () => a.askCancel(o.id), danger: true }]
      : []),
  ];
}

function Bar({
  w,
  h = "h-3",
  className = "",
}: {
  w: string;
  h?: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded bg-white/[0.07] ${w} ${h} ${className}`}
    />
  );
}

function TableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-6 border-b border-white/6 py-4"
        >
          <Bar w="w-24" />
          <Bar w="w-28" />
          <Bar w="w-32" className="ml-auto" />
          <Bar w="w-20" />
          <Bar w="w-16" h="h-5" />
        </div>
      ))}
    </div>
  );
}

/** Empty tables: say why, and what fills them. */
function EmptyRows({
  filtered,
  tab,
  neverTraded,
}: {
  filtered: boolean;
  tab: Tab;
  neverTraded: boolean;
}) {
  if (filtered)
    return (
      <p className="py-12 text-center text-[13px] text-neutral-500">
        Nothing matches these filters.
      </p>
    );
  const copy =
    tab === "requests"
      ? neverTraded
        ? {
            title: "No quotes yet",
            body: "Ask for one above. A quote holds its price for 30 seconds and becomes an order when you accept it.",
          }
        : {
            title: "No quotes",
            body: "Quotes you ask for show here, live ones with their countdown.",
          }
      : tab === "open"
        ? {
            title: "Nothing in flight",
            body: "Accepted quotes show here until they settle — or need something from you.",
          }
        : {
            title: "No finished orders",
            body: "Settled and cancelled orders land here with their confirmations.",
          };
  return (
    <div className="py-14 text-center">
      <div className="text-[14px] text-white">{copy.title}</div>
      <p className="mx-auto mt-1 max-w-[380px] text-[13px] leading-relaxed text-neutral-500">
        {copy.body}
      </p>
    </div>
  );
}

/**
 * Everything the desk has done, split the way Gravv's desk splits it: every quote you asked
 * for (Requests), accepted ones still settling (Open orders), and finished ones (Order history).
 */
function Activity({
  acts,
  view,
  ssis,
  onMarkSent,
  tab,
  onTab,
  requests,
  orders,
  pairs,
  openId,
  onToggle,
  onDetails,
  onViewOrder,
}: {
  acts: Acts;
  view: View;
  ssis: Destination[];
  onMarkSent: (id: string) => void;
  tab: Tab;
  onTab: (t: Tab) => void;
  requests: QuoteRequest[];
  orders: Order[];
  pairs: Pair[];
  openId: string | null;
  onToggle: (id: string) => void;
  onDetails: (id: string) => void;
  onViewOrder: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [pairFilter, setPairFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [now, setNow] = useState(0);
  const anyLive = requests.some((r) => r.outcome === "Live");
  useEffect(() => {
    if (!anyLive) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [anyLive]);

  const orderOf = (r: QuoteRequest) => orders.find((o) => o.id === r.orderId);
  const requestStatus = (r: QuoteRequest) =>
    r.outcome === "Accepted" ? (orderOf(r)?.status ?? "Accepted") : r.outcome;
  const open = orders.filter(isOpen);
  const history = orders.filter((o) => !isOpen(o));

  const q = query.trim().toLowerCase();
  const matchPair = (pairId: string) =>
    pairFilter === "all" || pairId === pairFilter;
  const matchQ = (...vals: string[]) =>
    !q || vals.some((v) => v.toLowerCase().includes(q));
  const reqRows = requests.filter(
    (r) =>
      matchPair(r.pairId) &&
      (status === "all" || requestStatus(r) === status) &&
      matchQ(r.id, `${r.sell}/${r.get}`, `${r.sell} ${r.get}`, r.orderId ?? ""),
  );
  const matchOrder = (o: Order) =>
    matchPair(o.pairId) &&
    (status === "all" || o.status === status) &&
    matchQ(o.id, `${o.sell}/${o.get}`, `${o.sell} ${o.get}`);
  const openRows = open.filter(matchOrder);
  const historyRows = history.filter(matchOrder);
  const orderRows = tab === "open" ? openRows : historyRows;
  const reqPager = usePager(reqRows, "trade-requests");
  const openPager = usePager(openRows, "trade-open-orders");
  const historyPager = usePager(historyRows, "trade-order-history");
  const pager =
    tab === "requests" ? reqPager : tab === "open" ? openPager : historyPager;

  const statusOptions =
    tab === "requests"
      ? [
          "Live",
          "With the desk",
          "Awaiting approval",
          "Awaiting funds",
          "Settling",
          "Settled",
          "Cancelled",
          "Expired",
          "Declined",
        ]
      : tab === "open"
        ? [
            "Awaiting approval",
            "Awaiting funds",
            "Settling",
            "Payout returned",
            "Short deposit",
          ]
        : ["Settled", "Cancelled", "Rejected"];

  const tabs: [Tab, string, number][] = [
    ["requests", "Requests", requests.length],
    ["open", "Open orders", open.length],
    ["history", "Order history", history.length],
  ];

  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/8">
        <div role="tablist" className="flex gap-6">
          {tabs.map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                onTab(id);
                setStatus("all");
                pager.setPage(1);
              }}
              className={`-mb-px flex items-center gap-1.5 border-b pb-3 text-[14px] transition-colors ${
                tab === id
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {label}
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {n}
              </span>
            </button>
          ))}
        </div>
        <div className="mb-2.5 flex items-center gap-1.5">
          <label className="flex h-8 w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35">
            <Search size={13} strokeWidth={1.75} className="text-neutral-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                pager.setPage(1);
              }}
              placeholder={
                tab === "requests"
                  ? "Request ID, pair or order"
                  : "Order ID or pair"
              }
              aria-label="Search"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
          <Dropdown
            label="Pair"
            variant="chip"
            align="right"
            value={pairFilter}
            active={pairFilter !== "all"}
            options={[
              { value: "all", label: "All pairs" },
              ...pairs.map((p) => ({
                value: p.id,
                label: `${p.sell} → ${p.get}`,
                icon: <PairMark sell={p.sell} get={p.get} size={14} />,
              })),
            ]}
            onChange={(v) => {
              setPairFilter(v);
              pager.setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() =>
              exportCsv(
                tab,
                tab === "requests" ? reqRows : orderRows,
                requestStatus,
                ssis,
              )
            }
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Download size={13} strokeWidth={1.75} /> Export
          </button>
          <Dropdown
            label="Status"
            variant="chip"
            align="right"
            value={status}
            active={status !== "all"}
            options={[
              { value: "all", label: "All statuses" },
              ...statusOptions.map((s) => ({ value: s, label: s })),
            ]}
            onChange={(v) => {
              setStatus(v);
              pager.setPage(1);
            }}
          />
        </div>
      </div>

      <div className="mt-1">
        {view === "loading" ? (
          <TableSkeleton />
        ) : tab === "requests" ? (
          <RequestsTable
            acts={acts}
            rows={reqPager.visible}
            pairs={pairs}
            now={now}
            statusOf={requestStatus}
            onViewOrder={onViewOrder}
          />
        ) : (
          <OrdersTable
            acts={acts}
            orders={(tab === "open" ? openPager : historyPager).visible}
            pairs={pairs}
            ssis={ssis}
            onMarkSent={onMarkSent}
            openId={openId}
            onToggle={onToggle}
            onDetails={onDetails}
          />
        )}
        {view !== "loading" &&
          (tab === "requests" ? reqRows.length : orderRows.length) === 0 && (
            <EmptyRows
              filtered={!!q || pairFilter !== "all" || status !== "all"}
              tab={tab}
              neverTraded={requests.length === 0}
            />
          )}
        {view !== "loading" && pager.total > 0 && (
          <TablePager
            pager={pager}
            noun={tab === "requests" ? "requests" : "orders"}
          />
        )}
      </div>
    </section>
  );
}

function RequestsTable({
  acts,
  rows,
  pairs,
  now,
  statusOf,
  onViewOrder,
}: {
  acts: Acts;
  rows: QuoteRequest[];
  pairs: Pair[];
  now: number;
  statusOf: (r: QuoteRequest) => string;
  onViewOrder: (id: string) => void;
}) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] whitespace-nowrap [&_td]:pr-5 [&_th]:pr-5 [&_tr>*:last-child]:pr-0">
        <thead>
          <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
            <th className="py-2.5 font-normal">Request</th>
            <th className="py-2.5 font-normal">Pair</th>
            <th className="py-2.5 text-right font-normal">Amount</th>
            <th className="py-2.5 font-normal">Quoted rate</th>
            <th className="py-2.5 font-normal">Time left</th>
            <th className="py-2.5 font-normal">Status</th>
            <th className="py-2.5 font-normal">Requested</th>
            <th className="w-8 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = pairs.find((x) => x.id === r.pairId)!;
            const st = statusOf(r);
            const left =
              r.outcome === "Live"
                ? Math.max(
                    0,
                    Math.ceil((r.expiresAt - (now || r.createdAt)) / 1000),
                  )
                : null;
            return (
              <tr
                key={r.id}
                onClick={r.orderId ? () => onViewOrder(r.orderId!) : undefined}
                className={`border-b border-white/6 transition-colors ${r.orderId ? "cursor-pointer hover:bg-white/[0.025]" : ""} ${
                  r.createdAt > AS_OF ? "card-arrived" : ""
                }`}
              >
                <td className="py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[12px] text-white">
                      {shortId(r.id)}
                    </span>
                    <CopyButton value={r.id} />
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2.5 text-neutral-200">
                    <PairMark sell={r.sell} get={r.get} size={16} />
                    {r.sell} <span className="-mx-1 text-neutral-500">→</span>{" "}
                    {r.get}
                  </div>
                </td>
                <td className="amount py-3 text-right text-neutral-200 tabular-nums">
                  {fmt(r.sell, r.amount)}
                </td>
                <td className="py-3 text-neutral-400 tabular-nums">
                  {rateLabel(p, r.rate)}
                </td>
                <td className="py-3 tabular-nums">
                  {left !== null ? (
                    <span className="text-white">
                      {Math.floor(left / 60)}:
                      {String(left % 60).padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </td>
                <td className="py-3">
                  <span className="flex items-center gap-2">
                    <RequestChip status={st} />
                    {r.orderId && (
                      <span className="font-mono text-[11px] text-neutral-500">
                        {r.orderId}
                      </span>
                    )}
                    {r.desk && !r.orderId && (
                      <span className="text-[11px] text-neutral-500">
                        {r.desk.trader}
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-3 text-neutral-400 tabular-nums">
                  {r.createdAt > AS_OF
                    ? "Just now"
                    : `${dateFmt.format(r.createdAt)}, ${timeFmt.format(r.createdAt)}`}
                </td>
                <td className="py-3 text-right">
                  <RowMenu
                    items={[
                      ...(r.orderId
                        ? [
                            {
                              label: "View order",
                              run: () => onViewOrder(r.orderId!),
                            },
                          ]
                        : []),
                      ...(r.outcome === "Expired" || r.outcome === "Declined"
                        ? [
                            {
                              label: "Request again",
                              run: () => acts.requestAgain(r.pairId, r.amount),
                            },
                          ]
                        : []),
                      {
                        label: "Copy request ID",
                        run: () => navigator.clipboard?.writeText(r.id),
                      },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestChip({ status }: { status: string }) {
  if (
    status === "Settled" ||
    status === "Awaiting approval" ||
    status === "Settling" ||
    status === "Awaiting funds" ||
    status === "Cancelled" ||
    status === "Payout returned" ||
    status === "Short deposit" ||
    status === "Rejected"
  )
    return <StatusChip status={status as OrderStatus} />;
  const cls =
    status === "Live"
      ? "border-white/40 text-white"
      : status === "With the desk"
        ? "border-dashed border-white/30 text-neutral-200"
        : "border-transparent bg-white/[0.05] text-neutral-500"; // Expired / Declined
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs ${cls}`}
    >
      {status}
    </span>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[15px] font-medium text-white">{title}</h2>
      {note && <span className="text-xs text-neutral-500">{note}</span>}
    </div>
  );
}

function Facts({
  traded,
  open,
  usedToday,
  stacked = false,
  empty = false,
  loading = false,
  limitRequested = null,
}: {
  traded: number;
  open: number;
  usedToday: number;
  stacked?: boolean;
  empty?: boolean;
  loading?: boolean;
  limitRequested?: number | null;
}) {
  if (loading)
    return (
      <div className="grid gap-y-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`${i ? "sm:border-l sm:border-white/8 sm:pl-6" : ""} pr-6`}
          >
            <Bar w="w-28" />
            <Bar w="w-36" h="h-7" className="mt-3" />
            <Bar w="w-40" className="mt-3" />
          </div>
        ))}
      </div>
    );
  const left = LIMITS.daily - usedToday;
  const cells = [
    {
      label: "Traded this month",
      value: <Roll value={compact("USD", traded)} />,
      note: empty
        ? "Your first trade shows here"
        : `${MONTH.orders} orders · avg spread ${MONTH.avgSpreadBps} bps`,
    },
    {
      label: "Open orders",
      value: <Roll value={String(open)} />,
      note: open ? "Waiting on approval, funds or payout" : "Nothing in flight",
    },
    {
      label: "Left today",
      value: <Roll value={compact("USD", left)} />,
      note: limitRequested
        ? `of ${compact("USD", LIMITS.daily)} · increase to ${compact("USD", limitRequested)} requested`
        : `of ${compact("USD", LIMITS.daily)} daily limit`,
      meter: usedToday / LIMITS.daily,
    },
  ];
  return (
    <div
      className={
        stacked
          ? "divide-y divide-white/8 border-y border-white/8"
          : "grid gap-y-6 sm:grid-cols-3"
      }
    >
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={
            stacked
              ? "flex items-baseline justify-between gap-4 py-3"
              : `${i ? "sm:border-l sm:border-white/8 sm:pl-6" : ""} pr-6`
          }
        >
          <div
            className={
              stacked
                ? "text-[13px] text-neutral-400"
                : "text-[13px] text-neutral-400"
            }
          >
            {c.label}
          </div>
          <div className={stacked ? "text-right" : ""}>
            <div
              className={`amount font-medium tracking-[-0.02em] text-white tabular-nums ${
                stacked ? "text-[15px]" : "mt-2 text-[26px] leading-none"
              }`}
            >
              {c.value}
            </div>
            {!stacked && c.meter !== undefined && (
              <div className="mt-3 h-[3px] rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-white/40"
                  style={{ width: `${c.meter * 100}%` }}
                />
              </div>
            )}
            <div
              className={`text-xs text-neutral-500 ${stacked ? "mt-0.5" : "mt-2"}`}
            >
              {c.note}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const trendTone = (change: number) =>
  change > 0
    ? "text-[var(--flow-in)]"
    : change < 0
      ? "text-red-400"
      : "text-neutral-500";

function Spark({ points }: { points: number[] }) {
  const min = Math.min(...points),
    max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map(
      (v, i) =>
        `${(i / (points.length - 1)) * 64},${18 - ((v - min) / span) * 16}`,
    )
    .join(" ");
  return (
    <svg
      width="64"
      height="20"
      viewBox="0 0 64 20"
      aria-hidden
      className="shrink-0"
    >
      <polyline
        points={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RatesBoard({
  loading = false,
  pairs,
  activeId,
  onPick,
  columns,
  rowChart = false,
  onHideChart,
}: {
  loading?: boolean;
  pairs: Pair[];
  activeId: string;
  onPick: (id: string) => void;
  columns: 1 | 2;
  /** Open the chart inline under the picked rate (like a table row's inline preview). */
  rowChart?: boolean;
  onHideChart?: () => void;
}) {
  if (loading)
    return (
      <div className="border-t border-white/8">
        {pairs.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 border-b border-white/6 py-3.5"
          >
            <Bar w="w-7" h="h-5" />
            <Bar w="w-32" />
            <Bar w="w-16" className="ml-auto" />
            <Bar w="w-20" />
          </div>
        ))}
      </div>
    );
  return (
    <div
      className={`grid border-t border-white/8 ${columns === 2 ? "md:grid-cols-2 md:gap-x-8" : ""}`}
    >
      {pairs.map((p) => {
        const on = p.id === activeId;
        return (
          <Fragment key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={on}
              className={`-mx-2 flex items-center gap-4 rounded-lg border-b border-white/6 px-2 py-3 text-left transition-colors ${
                on ? "bg-white/[0.05]" : "hover:bg-white/[0.025]"
              }`}
            >
              <PairMark sell={p.sell} get={p.get} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-white">
                  {p.sell} <span className="text-neutral-500">→</span> {p.get}
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {ASSET_NAME[p.sell]} to {ASSET_NAME[p.get]}
                </div>
              </div>
              {/* Colour carries direction: up green, down red, flat grey */}
              <span className={trendTone(p.change24h)}>
                <Spark points={p.history} />
              </span>
              <div className="w-[104px] text-right">
                <div className="text-[13px] text-white tabular-nums">
                  <Roll value={rateLabel(p)} />
                </div>
                <div
                  className={`text-xs tabular-nums ${trendTone(p.change24h)}`}
                >
                  {p.change24h === 0
                    ? "flat"
                    : `${p.change24h > 0 ? "+" : ""}${p.change24h.toFixed(2)}%`}{" "}
                  24h
                </div>
              </div>
            </button>
            {rowChart && on && (
              <div className="border-b border-white/6 px-0 pt-2 pb-4">
                <RateChart pair={p} place="row" onHide={onHideChart} />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function StatusChip({ status }: { status: OrderStatus }) {
  const cls =
    status === "Settled"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : status === "Cancelled"
        ? "border-transparent text-neutral-500"
        : status === "Payout returned" ||
            status === "Short deposit" ||
            status === "Rejected"
          ? "border-transparent bg-rose-500/10 text-rose-400"
          : "border-dashed border-white/25 text-neutral-200";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-xs whitespace-nowrap ${cls}`}
    >
      {status}
    </span>
  );
}

const when = (o: Order) => {
  const now = Math.max(AS_OF, o.createdAt);
  return o.createdAt > AS_OF ? "just now" : ago(o.createdAt, now);
};

function OrdersTable({
  acts,
  orders,
  pairs,
  ssis,
  onMarkSent,
  openId,
  onToggle,
  onDetails,
}: {
  acts: Acts;
  orders: Order[];
  ssis: Destination[];
  onMarkSent: (id: string) => void;
  pairs: Pair[];
  openId: string | null;
  onToggle: (id: string) => void;
  onDetails: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] whitespace-nowrap [&_td]:pr-5 [&_th]:pr-5 [&_tr>*:last-child]:pr-0">
        <thead>
          <tr className="border-y border-white/8 text-left text-xs text-neutral-500">
            <th className="py-2.5 font-normal">Order</th>
            <th className="py-2.5 pr-6 text-right font-normal">Sold</th>
            <th className="py-2.5 pr-6 text-right font-normal">Got</th>
            <th className="py-2.5 font-normal">Rate</th>
            <th className="py-2.5 font-normal">Status</th>
            <th className="w-8 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const p = pairs.find((x) => x.id === o.pairId)!;
            const open = openId === o.id;
            return (
              <Fragment key={o.id}>
                <tr
                  id={`order-${o.id}`}
                  onClick={() => onToggle(o.id)}
                  className={`cursor-pointer border-b border-white/6 transition-colors ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.025]"} ${
                    o.createdAt > AS_OF ? "card-arrived" : ""
                  }`}
                >
                  <td className="py-3">
                    <div className="font-mono text-[12px] text-white">
                      {o.id}
                    </div>
                    <div className="text-xs text-neutral-500">{when(o)}</div>
                  </td>
                  <td
                    className={`amount py-3 pr-6 text-right tabular-nums ${o.status === "Cancelled" || o.status === "Rejected" ? "text-neutral-500 line-through" : "text-neutral-200"}`}
                  >
                    {fmt(o.sell, o.sellAmount)}
                  </td>
                  <td
                    className={`amount py-3 pr-6 text-right tabular-nums ${o.status === "Cancelled" || o.status === "Rejected" ? "text-neutral-500 line-through" : "text-white"}`}
                  >
                    {fmt(o.get, o.getAmount)}
                  </td>
                  <td className="py-3 text-neutral-400 tabular-nums">
                    {rateLabel(p, o.rate)}
                  </td>
                  <td className="py-3">
                    <StatusChip status={o.status} />
                  </td>
                  <td className="py-3 text-right">
                    <RowMenu items={orderMenu(o, acts)} />
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-white/6 bg-white/[0.04]">
                    <td
                      colSpan={6}
                      className="px-4 pt-1 pb-5 whitespace-normal"
                    >
                      <OrderPreview
                        acts={acts}
                        order={o}
                        ssis={ssis}
                        onMarkSent={onMarkSent}
                        onDetails={() => onDetails(o.id)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function stepsOf(o: Order, ssis: Destination[]) {
  const src = SOURCES.find((s) => s.id === o.sourceId)!;
  const dst = ssis.find((d) => d.id === o.destinationId)!;
  const cancelled = o.status === "Cancelled";
  const steps: { label: string; detail: string; at?: number }[] = [
    {
      label: "Quote accepted",
      detail: `by ${o.placedBy}`,
      at: o.steps.accepted,
    },
  ];
  if (o.status === "Rejected" && o.problem?.kind === "rejected") {
    steps.push({
      label: `Rejected by ${o.problem.by}`,
      detail: "Quote released",
      at: o.approval?.at,
    });
    return steps;
  }
  if (o.approval)
    steps.push({
      label: o.approval.by ? `Approved by ${o.approval.by}` : "Approval",
      detail: o.approval.by
        ? "Over the $500k line"
        : `${o.approval.approvers.join(" or ")} · rate held 15 min`,
      at: o.approval.at,
    });
  if (cancelled) {
    steps.push({
      label:
        o.problem?.kind === "expired"
          ? "Cancelled — no deposit in 2h"
          : "Cancelled — funds never sent",
      detail:
        o.problem?.kind === "cancelled"
          ? `by ${o.problem.by}`
          : "Quote released",
      at:
        o.steps.accepted + (o.problem?.kind === "expired" ? 120 : 30) * 60_000,
    });
    return steps;
  }
  steps.push(
    {
      label:
        o.problem?.kind === "short"
          ? "Part of your deposit arrived"
          : "Funds received",
      detail:
        o.problem?.kind === "short"
          ? `${fmt(o.sell, o.problem.received)} of ${fmt(o.sell, o.sellAmount)}`
          : src.external
            ? `Your deposit · ref ${o.id}`
            : `Taken from ${src.label}`,
      at: o.steps.funded,
    },
    o.problem?.kind === "returned"
      ? {
          label: "Payout returned",
          detail: `by ${dst.label.split(" ••")[0]}`,
          at: o.steps.paidOut,
        }
      : { label: "Paid out", detail: `to ${dst.label}`, at: o.steps.paidOut },
    {
      label: "Settled",
      detail: "Confirmation sent",
      at: o.problem ? undefined : o.steps.settled,
    },
  );
  return steps;
}

const stamp = (at?: number) =>
  at ? `${dateFmt.format(at)}, ${timeFmt.format(at)}` : "Waiting";

function OrderPreview({
  acts,
  order: o,
  ssis,
  onDetails,
  onMarkSent,
}: {
  acts: Acts;
  order: Order;
  ssis: Destination[];
  onDetails: () => void;
  onMarkSent: (id: string) => void;
}) {
  const steps = stepsOf(o, ssis);
  // Problem orders are stuck on the step that went wrong, not "now" on the next one.
  const current = o.problem ? -1 : steps.findIndex((s) => !s.at);
  const src = SOURCES.find((s) => s.id === o.sourceId);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <ol className="flex min-w-0 flex-1 flex-wrap gap-x-10 gap-y-4">
          {steps.map((s, i) => (
            <li key={s.label} className="min-w-[150px]">
              <div
                className={`flex items-center gap-2 text-[13px] ${s.at ? "text-white" : i === current ? "text-neutral-200" : "text-neutral-500"}`}
              >
                {s.label}
                {i === current && (
                  <span className="text-xs text-neutral-500">· now</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">{s.detail}</div>
              <div className="mt-0.5 text-xs text-neutral-600 tabular-nums">
                {stamp(s.at)}
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDetails();
          }}
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-xs text-neutral-200 hover:border-white/30"
        >
          View all details <ArrowRight size={12} strokeWidth={1.75} />
        </button>
      </div>
      {o.status === "Awaiting approval" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4 text-[13px]">
          <span className="text-neutral-300">
            Waiting on {o.approval?.approvers.join(" or ")}. The rate is held
            until{" "}
            <span className="text-white tabular-nums">
              {timeFmt.format(o.steps.accepted + RATE_HOLD_MS)}
            </span>
            .
          </span>
          <Link
            href="/manage/approvals"
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-neutral-300 underline decoration-white/25 underline-offset-4 hover:text-white"
          >
            Open in Approvals
          </Link>
        </div>
      )}
      {acts.cancelAsk === o.id &&
      (o.status === "Awaiting approval" || o.status === "Awaiting funds") ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4 text-[13px]"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-neutral-300">
            Cancel {o.id}? Nothing has been taken yet — the quote is released
            and the rate lost.
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={acts.keep}
              className="h-8 rounded-full px-3 text-xs text-neutral-400 hover:text-white"
            >
              Keep order
            </button>
            <button
              type="button"
              onClick={() => acts.cancel(o.id)}
              className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black hover:bg-neutral-200"
            >
              Cancel order
            </button>
          </span>
        </div>
      ) : (
        o.status === "Awaiting funds" &&
        src?.external && (
          <DepositInstructions order={o} onSent={() => onMarkSent(o.id)} />
        )
      )}
      <ProblemPanel
        order={o}
        ssis={ssis}
        onRetry={(d) => acts.retry(o.id, d)}
        onSentRest={() => acts.sentRest(o.id)}
        onSettleReceived={() => acts.settleReceived(o.id)}
        onRequestAgain={() => acts.requestAgain(o.pairId, o.sellAmount)}
      />
    </div>
  );
}

/** What to send, where, with which reference — for orders funded from outside Gravv. */
function DepositInstructions({
  order: o,
  onSent,
}: {
  order: Order;
  onSent: () => void;
}) {
  const d = DEPOSIT[o.sell];
  if (!d) return null;
  const amount = fmt(o.sell, o.sellAmount);
  const rows: [string, string, boolean][] = [
    ["Amount", amount, true],
    [
      o.sell === "USDC" || o.sell === "USDT" ? "Network" : "Method",
      d.via,
      false,
    ],
    [
      o.sell === "USDC" || o.sell === "USDT" ? "Address" : "Account",
      d.to,
      true,
    ],
    ...(d.extra
      ? [[d.extra[0], d.extra[1], true] as [string, string, boolean]]
      : []),
    ["Reference", o.id, true],
  ];
  return (
    <div
      className="mt-4 border-t border-white/8 pt-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] text-white">Send {amount} to the desk</div>
        <div className="text-xs text-neutral-500">
          By{" "}
          <span className="text-neutral-200 tabular-nums">
            {timeFmt.format(o.steps.accepted + DEPOSIT_WINDOW_MS)}
          </span>{" "}
          — after that the order is cancelled and the quote released
        </div>
      </div>
      <dl className="mt-3 grid gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
        {rows.map(([k, v, copy]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-3 border-b border-white/6 pb-2"
          >
            <dt className="text-neutral-500">{k}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-neutral-100">
              <span
                className={`truncate ${k === "Address" || k === "Account" || k === "Reference" ? "font-mono text-[12px]" : ""}`}
              >
                {v}
              </span>
              {copy && (
                <CopyButton value={k === "Amount" ? String(o.sellAmount) : v} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onSent}
          className="h-8 rounded-full bg-white px-3.5 text-xs font-medium text-black hover:bg-neutral-200"
        >
          I&apos;ve sent it
        </button>
        <span className="text-xs text-neutral-500">
          Include the reference so we can match it. Send only {o.sell}
          {o.sell === "USDC" || o.sell === "USDT" ? ` on ${d.via}` : ""}.
        </span>
      </div>
    </div>
  );
}

function OrderSheet({
  order: o,
  ssis,
  onClose,
}: {
  order: Order;
  ssis: Destination[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const p = PAIRS.find((x) => x.id === o.pairId)!;
  const src = SOURCES.find((s) => s.id === o.sourceId)!;
  const dst = ssis.find((d) => d.id === o.destinationId)!;
  const steps = stepsOf(o, ssis);
  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${o.id}`}
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <header className="flex items-center justify-between px-5 pt-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-neutral-400">
              {o.id}
            </span>
            <CopyButton value={o.id} />
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>
        <div className="px-5 pt-4 pb-6">
          <div className="text-xs text-neutral-500">
            {fmt(o.sell, o.sellAmount)} sold for
          </div>
          <div className="amount mt-1 text-[28px] font-medium tracking-[-0.02em] text-white tabular-nums">
            {fmt(o.get, o.getAmount)}
          </div>
          <div className="mt-3">
            <StatusChip status={o.status} />
          </div>

          <h3 className="mt-8 text-xs text-neutral-500">Progress</h3>
          <ol className="mt-3 space-y-0">
            {steps.map((s, i) => (
              <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
                {i < steps.length - 1 && (
                  <span
                    className="absolute top-4 left-[5px] h-full w-px bg-white/10"
                    aria-hidden
                  />
                )}
                <span
                  className={`relative mt-1 size-[11px] shrink-0 rounded-full border ${s.at ? "border-white bg-white" : "border-white/30 bg-transparent"}`}
                  aria-hidden
                />
                <div>
                  <div
                    className={`text-[13px] ${s.at ? "text-white" : "text-neutral-500"}`}
                  >
                    {s.label}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {s.detail} · {stamp(s.at)}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <h3 className="mt-8 text-xs text-neutral-500">Details</h3>
          <dl className="mt-2 text-[13px]">
            {[
              ["Rate", `1 ${o.sell} = ${rateLabel(p, o.rate)}`],
              ["From", `${src.label} · ${src.detail}`],
              ["To", `${dst.label} · ${dst.detail}`],
              ["Fees", "None — spread included"],
              ["Placed by", o.placedBy],
              ["Confirmed with", "Two-step code"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between gap-6 border-b border-white/6 py-2.5"
              >
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right text-neutral-100">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </>
  );
}
