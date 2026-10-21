"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Landmark,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { ChartExplorer } from "./charts";
import { CategoryPicker, DEFAULT_CATEGORIES } from "./category-picker";
import { NetworkLogo } from "../../wallets/_components/network-logo";
import {
  AS_OF,
  type Party,
  type Transaction,
  type TxnStatus,
  type TxnType,
} from "../_data";
import { Roll } from "@/app/_components/roll";

type Tab = "All" | TxnStatus;
const TABS: Tab[] = ["All", "Completed", "Pending", "Failed"];
const TYPES: ("All" | TxnType)[] = [
  "All",
  "Account Funding",
  "Crypto Transfer",
  "Offramp",
  "Payout",
];
/** What the search box looks in — defaults to Customer ID, like the live dashboard. */
const SCOPES = [
  "Customer ID",
  "Transaction ID",
  "Destination",
  "Hash",
] as const;
type Scope = (typeof SCOPES)[number];
const PAGE_SIZES = [25, 50, 100];

const money = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const fullFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const short = (v: string, head = 6, tail = 4) =>
  v.length > head + tail + 1 ? `${v.slice(0, head)}…${v.slice(-tail)}` : v;

const explorer: Partial<Record<Transaction["channel"], string>> = {
  Polygon: "https://polygonscan.com/tx/",
  Ethereum: "https://etherscan.io/tx/",
  Stellar: "https://stellar.expert/explorer/public/tx/",
};

export function TransactionsTable({ initial }: { initial: Transaction[] }) {
  const [tab, setTab] = useState<Tab>("All");
  const [type, setType] = useState<"All" | TxnType>("All");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("Customer ID");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [openId, setOpenId] = useState<string | null>(null);
  // "View all details" opens the full record in a side sheet.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheetTxn = initial.find((t) => t.id === sheetId) ?? null;
  // Table view settings (Mercury-style toolbar).
  const [sort, setSort] = useState<Sort>("Newest");
  const [density, setDensity] = useState<"Comfortable" | "Compact">(
    "Comfortable",
  );
  const [cols, setCols] = useState({
    time: true,
    category: true,
    status: true,
  });
  // Categories people assign per transaction; the list grows as they create new ones.
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [assigned, setAssigned] = useState<Record<string, string>>(() =>
    seedCategories(initial),
  );
  const cats: Cats = {
    list: categories,
    of: (id) => assigned[id] ?? null,
    set: (id, v) =>
      setAssigned((a) => {
        const next = { ...a };
        if (v) next[id] = v;
        else delete next[id];
        return next;
      }),
    create: (name) =>
      setCategories((list) => (list.includes(name) ? list : [...list, name])),
  };
  // Day picked on the chart (UTC midnight); filters the table to that day.
  const [day, setDay] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const q = query.trim().toLowerCase();
  const rows = initial
    .filter((t) => tab === "All" || t.status === tab)
    .filter((t) => type === "All" || t.type === type)
    .filter(
      (t) =>
        day === null || Math.floor(Date.parse(t.createdAt) / DAY) * DAY === day,
    )
    .filter((t) => {
      if (!q) return true;
      const fields =
        scope === "Customer ID"
          ? [t.customer.id, t.customer.name, t.customer.email]
          : scope === "Transaction ID"
            ? [t.id]
            : scope === "Destination"
              ? [t.destination.name, t.destination.detail]
              : [t.hash ?? ""];
      return fields.some((v) => v.toLowerCase().includes(q));
    })
    .sort((a, b) =>
      sort === "Newest"
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === "Oldest"
          ? a.createdAt.localeCompare(b.createdAt)
          : sort === "Largest"
            ? b.amount - a.amount
            : a.amount - b.amount,
    );
  const count = (s: Tab) =>
    initial.filter((t) => s === "All" || t.status === s).length;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * perPage, current * perPage);
  const reset = () => setPage(1);
  // Summary follows the filters, like Mercury's "Net change / Money in / Money out".
  const settled = rows.filter((t) => t.status !== "Failed");
  const moneyIn = settled
    .filter((t) => t.direction === "Credit")
    .reduce((s, t) => s + t.amount, 0);
  const moneyOut = settled
    .filter((t) => t.direction === "Debit")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Transactions
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Manage and monitor your customer transactions.
            </p>
          </div>
        </div>

        {/* Summary for whatever is filtered */}
        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4">
          <Summary
            label="Net change"
            value={moneyIn - moneyOut}
            signed
            tone={moneyIn - moneyOut >= 0 ? "in" : undefined}
          />
          <Summary label="Money in" value={moneyIn} tone="in" />
          <Summary label="Money out" value={-moneyOut} signed />
        </dl>

        {/* Money movement chart */}
        <ChartExplorer
          txns={initial.filter(
            (t) =>
              (tab === "All" || t.status === tab) &&
              (type === "All" || t.type === type),
          )}
          onSelectDay={(d) => {
            setDay(d);
            reset();
          }}
          onSelectType={(t) => {
            setType(t);
            reset();
          }}
        />

        {day !== null && (
          <div className="mt-6 flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5 text-[13px]">
            <span className="text-neutral-300">
              Showing transactions on{" "}
              <span className="font-medium text-white">
                {longDay.format(day)}
              </span>
              <span className="text-neutral-500">
                {" "}
                · {rows.length}{" "}
                {rows.length === 1 ? "transaction" : "transactions"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setDay(null)}
              className="flex items-center gap-1 text-neutral-400 hover:text-white"
            >
              <X size={13} strokeWidth={1.75} />
              Clear
            </button>
          </div>
        )}

        {/* Tabs + filter chips */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
            {TABS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={tab === s}
                onClick={() => {
                  setTab(s);
                  reset();
                }}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                  tab === s
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                }`}
              >
                {s}
                <span
                  className={`text-xs tabular-nums ${tab === s ? "text-neutral-400" : "text-neutral-600"}`}
                >
                  <Roll value={String(count(s))} />
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Type"
              value={type}
              active={type !== "All"}
              align="right"
              options={TYPES.map((t) => ({
                value: t,
                label: t === "All" ? "All types" : t,
              }))}
              onChange={(v) => {
                setType(v);
                reset();
              }}
            />
            {/* One field: pick what to search by, then type */}
            <div className="flex h-9 w-[280px] shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
              <Dropdown
                label="Search by"
                variant="bare"
                value={scope}
                options={SCOPES.map((s) => ({ value: s, label: s }))}
                onChange={(v) => {
                  setScope(v);
                  reset();
                }}
                className="shrink-0 border-r border-white/10"
              />
              <Search
                size={14}
                strokeWidth={1.75}
                className="ml-3 shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  reset();
                }}
                placeholder={`Enter ${scope.toLowerCase()}…`}
                aria-label={`Search by ${scope}`}
                className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </div>
            {/* View tools */}
            <div className="ml-1 flex items-center gap-0.5">
              <IconMenu
                icon={Table2}
                label="Columns"
                items={[
                  {
                    label: "Time under date",
                    checked: cols.time,
                    onClick: () => setCols((c) => ({ ...c, time: !c.time })),
                  },
                  {
                    label: "Category",
                    checked: cols.category,
                    onClick: () =>
                      setCols((c) => ({ ...c, category: !c.category })),
                  },
                  {
                    label: "Status",
                    checked: cols.status,
                    onClick: () =>
                      setCols((c) => ({ ...c, status: !c.status })),
                  },
                ]}
                keepOpen
              />
              <IconMenu
                icon={ArrowUpDown}
                label="Sort"
                active={sort !== "Newest"}
                items={SORTS.map((o) => ({
                  label: SORT_LABEL[o],
                  checked: sort === o,
                  onClick: () => setSort(o),
                }))}
              />
              <IconMenu
                icon={SlidersHorizontal}
                label="Display"
                active={density !== "Comfortable"}
                items={(["Comfortable", "Compact"] as const).map((d) => ({
                  label: `${d} rows`,
                  checked: density === d,
                  onClick: () => setDensity(d),
                }))}
              />
              <button
                type="button"
                onClick={() => {
                  exportCsv(rows, cats.of);
                  setToast(`${rows.length} transactions exported`);
                }}
                className="ml-1 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <Download size={14} strokeWidth={1.75} />
                Export all
              </button>
            </div>
          </div>
        </div>

        {/* Minimal table: ID first, then when, what, amount, status. Everything else lives in the details. */}
        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-[132px]" />
            <col className="w-[112px]" />
            <col />
            {cols.category && <col className="w-[170px]" />}
            <col className="w-[170px]" />
            {cols.status && <col className="w-[120px]" />}
            <col className="w-14" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-4 font-normal">ID</th>
              <th className="py-2.5 font-normal">Date</th>
              <th className="py-2.5 font-normal">Transaction</th>
              {cols.category && (
                <th className="py-2.5 font-normal">Category</th>
              )}
              <th className="py-2.5 pr-8 text-right font-normal">Amount</th>
              {cols.status && <th className="py-2.5 font-normal">Status</th>}
              <th className="py-2.5 font-normal">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const open = openId === t.id;
              const credit = t.direction === "Credit";
              const cell = density === "Compact" ? "py-1.5" : "py-3";
              return (
                <Fragment key={t.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : t.id)}
                    className={`group cursor-pointer border-t border-white/6 transition-colors ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
                  >
                    <td className={`${cell} pl-4`}>
                      <span className="flex items-center gap-0.5">
                        <span
                          title={t.id}
                          className="font-mono text-[12px] text-neutral-200"
                        >
                          {t.id.slice(0, 8)}
                        </span>
                        <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <CopyButton
                            value={t.id}
                            label="Copy transaction ID"
                          />
                        </span>
                      </span>
                    </td>
                    <td className={`${cell} tabular-nums`}>
                      <div className="text-neutral-200">
                        {dayFmt.format(new Date(t.createdAt))}
                      </div>
                      {cols.time && density === "Comfortable" && (
                        <div className="text-[11px] text-neutral-500">
                          {timeFmt.format(new Date(t.createdAt))} UTC
                        </div>
                      )}
                    </td>
                    <td className={`${cell} pr-4`}>
                      <div className="truncate text-white">{t.type}</div>
                      {/* Channel rides along with where the money went */}
                      <div
                        className={`flex min-w-0 items-center gap-1.5 text-[11px] text-neutral-500 ${density === "Compact" ? "hidden" : ""}`}
                      >
                        <ChannelMark channel={t.channel} />
                        <span className="truncate">
                          {t.channel} · To {t.destination.name}
                          {t.destination.detail !== "External wallet" &&
                            ` ${t.destination.detail}`}
                        </span>
                      </div>
                    </td>
                    {cols.category && (
                      <td className={`${cell} pr-4`}>
                        <CategoryPicker
                          value={cats.of(t.id)}
                          categories={cats.list}
                          onChange={(v) => cats.set(t.id, v)}
                          onCreate={cats.create}
                        />
                      </td>
                    )}
                    <td className={`${cell} amount pr-8 text-right tabular-nums`}>
                      <div>
                        <span
                          className={`font-medium ${t.status === "Failed" ? "text-neutral-600 line-through" : credit ? "text-white" : "text-neutral-200"}`}
                        >
                          {credit ? "+" : "−"}
                          {money(t.amount)}
                        </span>
                        <span className="ml-1 text-[11px] text-neutral-500">
                          {credit ? t.to : t.from}
                        </span>
                      </div>
                      {density === "Comfortable" && (
                        <div className="text-[11px] text-neutral-500">
                          {t.direction}
                        </div>
                      )}
                    </td>
                    {cols.status && (
                      <td className={cell}>
                        <Status status={t.status} />
                      </td>
                    )}
                    <td className={`${cell} pr-3 text-right`}>
                      <button
                        type="button"
                        aria-label={open ? "Hide details" : "Show details"}
                        aria-expanded={open}
                        title={open ? "Hide details" : "Show details"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(open ? null : t.id);
                        }}
                        className={`flex size-8 items-center justify-center rounded-full transition-colors ${
                          open
                            ? "text-white"
                            : "text-neutral-500 group-hover:text-neutral-200 hover:bg-white/8"
                        }`}
                      >
                        <ChevronDown
                          size={15}
                          strokeWidth={1.75}
                          className={`transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-white/[0.04]">
                      <td
                        colSpan={
                          5 + (cols.category ? 1 : 0) + (cols.status ? 1 : 0)
                        }
                        className="px-4 pb-4"
                      >
                        <Preview
                          txn={t}
                          onClose={() => setOpenId(null)}
                          onViewAll={() => setSheetId(t.id)}
                          cats={cats}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={5 + (cols.category ? 1 : 0) + (cols.status ? 1 : 0)}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  No transactions match.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-4 text-[13px] text-neutral-500">
          <span className="tabular-nums">
            {rows.length === 0
              ? "No results"
              : `Showing ${(current - 1) * perPage + 1} to ${Math.min(current * perPage, rows.length)} of ${rows.length}`}
          </span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <PageButton
                label="Previous page"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
              >
                <ChevronLeft size={14} strokeWidth={1.75} />
              </PageButton>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <PageButton
                  key={p}
                  label={`Page ${p}`}
                  active={p === current}
                  onClick={() => setPage(p)}
                >
                  {p}
                </PageButton>
              ))}
              <PageButton
                label="Next page"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
              >
                <ChevronRight size={14} strokeWidth={1.75} />
              </PageButton>
            </div>
            <Dropdown
              label="Rows per page"
              variant="compact"
              placement="top"
              align="right"
              value={perPage}
              options={PAGE_SIZES.map((n) => ({
                value: n,
                label: `${n} per page`,
              }))}
              onChange={(v) => {
                setPerPage(v);
                reset();
              }}
            />
          </div>
        </div>
      </div>

      {sheetTxn && (
        <DetailsSheet
          txn={sheetTxn}
          cats={cats}
          onClose={() => setSheetId(null)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

type Sort = "Newest" | "Oldest" | "Largest" | "Smallest";
const SORTS: Sort[] = ["Newest", "Oldest", "Largest", "Smallest"];
const SORT_LABEL: Record<Sort, string> = {
  Newest: "Newest first",
  Oldest: "Oldest first",
  Largest: "Largest amount",
  Smallest: "Smallest amount",
};

/** Icon-only toolbar button with a small menu of checkable options. */
function IconMenu({
  icon: Icon,
  label,
  items,
  active = false,
  keepOpen = false,
}: {
  icon: typeof Search;
  label: string;
  items: { label: string; checked: boolean; onClick: () => void }[];
  active?: boolean;
  /** Keep the menu open after a pick (for toggles). */
  keepOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-8 items-center justify-center rounded-full transition-colors ${
          open || active
            ? "bg-white/[0.08] text-white"
            : "text-neutral-400 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <Icon size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-52 rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]"
        >
          <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-neutral-500">
            {label}
          </div>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitemcheckbox"
              aria-checked={it.checked}
              onClick={() => {
                it.onClick();
                if (!keepOpen) setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 hover:bg-white/[0.06] hover:text-white"
            >
              {it.label}
              <Check
                size={13}
                strokeWidth={2.25}
                className={it.checked ? "text-white" : "invisible"}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({
  label,
  value,
  signed = false,
  tone,
}: {
  label: string;
  value: number;
  signed?: boolean;
  tone?: "in";
}) {
  const [whole, cents] = money(Math.abs(value)).split(".");
  return (
    <div>
      <dt className="text-[13px] text-neutral-500 first-letter:uppercase">
        {label}
      </dt>
      <dd
        className={`amount mt-1 text-[22px] font-medium tracking-[-0.02em] tabular-nums ${tone === "in" ? "text-[var(--ok-fg)]" : "text-white"}`}
      >
        <Roll
          value={`${signed ? (value < 0 ? "−" : value > 0 ? "+" : "") : ""}${whole}`}
        />
        <sup className="ml-px align-[0.55em] text-[0.5em] font-normal">
          <Roll value={`.${cents}`} />
        </sup>
        <span className="ml-1.5 text-[12px] font-normal tracking-normal text-neutral-500">
          USDC
        </span>
      </dd>
    </div>
  );
}

/** Small circular mark for how money moved: the network logo for on-chain, a bank mark for ACH/Wire. */
function ChannelMark({ channel }: { channel: Transaction["channel"] }) {
  if (channel === "Polygon" || channel === "Ethereum" || channel === "Stellar")
    return <NetworkLogo network={channel} size={14} />;
  return (
    <span
      aria-hidden
      className="flex size-[14px] shrink-0 items-center justify-center rounded-full bg-white/10 text-neutral-300 ring-1 ring-white/12"
    >
      <Landmark size={8} strokeWidth={2.25} />
    </span>
  );
}

/** Status as words: no dots. Failed is the only state that asks for attention. */
function Status({ status }: { status: TxnStatus }) {
  // Same 1px border box for every state — only colours differ — so all chips are exactly the same size.
  const tone =
    status === "Completed"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : status === "Pending"
        ? "border-dashed border-white/20 text-neutral-300"
        : "border-transparent bg-rose-400/10 text-rose-300";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium ${tone}`}
    >
      {status}
    </span>
  );
}

/** The few facts people open a row for; the full record is one click away in the sheet. */
function Preview({
  txn: t,
  onClose,
  onViewAll,
  cats,
}: {
  txn: Transaction;
  onClose: () => void;
  onViewAll: () => void;
  cats: Cats;
}) {
  const credit = t.direction === "Credit";
  const net = credit ? t.amount - t.fee : t.amount + t.fee;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="orbit-pop rounded-xl border border-white/8 bg-surface">
      <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr_1fr]">
        <Fact label="Transaction ID">
          <span className="flex min-w-0 items-center gap-0.5">
            <span className="truncate font-mono text-[12px] text-neutral-200">
              {t.id}
            </span>
            <CopyButton value={t.id} label="Copy transaction ID" />
          </span>
        </Fact>
        <PartyFact label="From" party={t.source} />
        <PartyFact label="To" party={t.destination} />
        <Fact label="Customer">
          <span className="truncate">{t.customer.name}</span>
        </Fact>
        <Fact label={credit ? "Net received" : "Total debited"}>
          <span className="amount tabular-nums">
            {money(net)}{" "}
            <span className="text-neutral-500">{credit ? t.to : t.from}</span>
          </span>
          <span className="ml-1.5 text-[11px] text-neutral-500 tabular-nums">
            fee {money(t.fee)}
          </span>
        </Fact>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-2.5">
        <span
          className={`truncate text-[12px] ${t.failureReason ? "text-rose-300" : "text-neutral-500"}`}
        >
          {t.failureReason
            ? `Failed — ${t.failureReason}`
            : t.status === "Pending"
              ? `Expected ${t.channel === "ACH" ? "in 1–3 business days" : t.channel === "Wire" ? "today" : "in minutes"}`
              : `${t.type} via ${t.channel}`}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <CategoryPicker
            variant="field"
            align="right"
            value={cats.of(t.id)}
            categories={cats.list}
            onChange={(v) => cats.set(t.id, v)}
            onCreate={cats.create}
          />
          <button
            type="button"
            onClick={onViewAll}
            className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/12 pr-2.5 pl-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            View all details
            <ChevronRight size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** A source or destination with copy: the full address for wallets, name and account for banks. */
function PartyFact({ label, party }: { label: string; party: Party }) {
  return (
    <Fact label={label}>
      <span className="flex min-w-0 items-center gap-0.5">
        <span
          title={party.address}
          className={`truncate ${party.address ? "font-mono text-[12px] text-neutral-200" : ""}`}
        >
          {party.name}
        </span>
        <CopyButton
          value={partyCopy(party)}
          label={`Copy ${label.toLowerCase()} ${party.address ? "address" : "account"}`}
        />
      </span>
    </Fact>
  );
}

const partyCopy = (p: Party) => p.address ?? `${p.name} ${p.detail}`;

function Fact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-1 flex min-w-0 items-center text-[13px] text-neutral-100">
        {children}
      </div>
    </div>
  );
}

/** Every detail of a transaction, in a sheet from the right. */
function DetailsSheet({
  txn: t,
  cats,
  onClose,
}: {
  txn: Transaction;
  cats: Cats;
  onClose: () => void;
}) {
  const credit = t.direction === "Credit";
  const net = credit ? t.amount - t.fee : t.amount + t.fee;
  const link =
    t.hash && explorer[t.channel] ? `${explorer[t.channel]}${t.hash}` : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Esc inside the category picker closes the picker, not the sheet.
      if ((e.target as HTMLElement).closest?.("[data-category-picker]")) return;
      // Close the sheet only, not the row preview underneath.
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

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
        aria-label="Transaction details"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        {/* Summary */}
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <div className="text-xs text-neutral-500">
              {t.type} · {t.direction}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="amount text-[28px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
                {credit ? "+" : "−"}
                {money(t.amount).split(".")[0]}
                <sup className="ml-px align-[0.55em] text-[0.5em] font-normal tracking-normal text-neutral-500">
                  .{money(t.amount).split(".")[1]}
                </sup>
              </span>
              <span className="text-[13px] text-neutral-500">
                {credit ? t.to : t.from}
              </span>
              <span className="ml-1">
                <Status status={t.status} />
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-neutral-300">
              <span>
                {t.source.name}{" "}
                <span className="text-neutral-500">{t.source.detail}</span>
              </span>
              <ChevronRight
                size={13}
                strokeWidth={2}
                className="text-neutral-600"
              />
              <span>
                {t.destination.name}{" "}
                <span className="text-neutral-500">{t.destination.detail}</span>
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30"
              >
                Explorer
                <ExternalLink size={12} strokeWidth={1.75} />
              </a>
            )}
            <button
              type="button"
              aria-label="Close details"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-6 py-3">
          <span className="text-[12px] text-neutral-500">Category</span>
          <CategoryPicker
            variant="field"
            align="right"
            value={cats.of(t.id)}
            categories={cats.list}
            onChange={(v) => cats.set(t.id, v)}
            onCreate={cats.create}
          />
        </div>

        {t.failureReason && (
          <div className="border-b border-white/8 bg-rose-400/[0.06] px-6 py-3 text-[13px] text-rose-200">
            Failed — {t.failureReason}
          </div>
        )}

        {/* All fields, grouped */}
        <div className="grid gap-y-6 px-6 py-5">
          <Group title="Money">
            <Field label="Amount" value={`${money(t.amount)} ${t.from}`} />
            <Field
              label="Currency"
              value={t.from === t.to ? t.from : `${t.from} → ${t.to}`}
            />
            {t.from !== t.to && (
              <Field
                label="Rate"
                value={`1 ${t.from} = ${t.rate.toFixed(4)} ${t.to}`}
              />
            )}
            <Field
              label="Fee"
              value={t.fee ? `${money(t.fee)} ${t.from}` : "None"}
            />
            <Field
              label={credit ? "Net received" : "Total debited"}
              value={`${money(net)} ${credit ? t.to : t.from}`}
              strong
            />
          </Group>

          <Group title="Parties">
            <Field
              label="Source"
              value={partyCopy(t.source)}
              display={`${t.source.name} ${t.source.detail}`}
              copy
            />
            <Field
              label="Destination"
              value={partyCopy(t.destination)}
              display={`${t.destination.name} ${t.destination.detail === "External wallet" ? "" : t.destination.detail}`.trim()}
              copy
            />
            <Field label="Channel" value={t.channel} />
          </Group>

          <Group title="Customer">
            <Field label="Name" value={t.customer.name} />
            <Field label="Email" value={t.customer.email} copy />
            <Field
              label="Customer ID"
              value={t.customer.id}
              display={short(t.customer.id, 8, 4)}
              mono
              copy
            />
          </Group>

          <Group title="Timeline">
            {/* Steps as words and times — no dots */}
            {t.events.map((e) => (
              <Field
                key={e.label}
                label={e.label}
                value={`${dayFmt.format(new Date(e.at))}, ${timeFmt.format(new Date(e.at))}`}
                tone={e.label === "Failed" ? "danger" : undefined}
              />
            ))}
            {t.status === "Pending" && (
              <Field
                label="Expected"
                value={
                  t.channel === "ACH"
                    ? "1–3 business days"
                    : t.channel === "Wire"
                      ? "Today"
                      : "In minutes"
                }
                tone="muted"
              />
            )}
          </Group>
        </div>

        {/* References */}
        <div className="grid border-t border-white/8 px-6 py-4">
          <Field label="Transaction ID" value={t.id} mono copy />
          {t.hash ? (
            <Field
              label="Transaction hash"
              value={t.hash}
              display={short(t.hash, 10, 8)}
              mono
              copy
            />
          ) : (
            <Field label="Transaction hash" value="Off-chain" />
          )}
          <Field
            label="Created"
            value={`${fullFmt.format(new Date(t.createdAt))} UTC`}
          />
          <Field
            label="Age"
            value={(() => {
              const h = Math.round(
                (AS_OF - Date.parse(t.createdAt)) / (60 * 60 * 1000),
              );
              return h < 1
                ? "Just now"
                : h < 24
                  ? `${h}h ago`
                  : `${Math.round(h / 24)}d ago`;
            })()}
          />
        </div>
      </aside>
    </>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs text-neutral-500">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  display,
  mono = false,
  copy = false,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  display?: string;
  mono?: boolean;
  copy?: boolean;
  strong?: boolean;
  tone?: "danger" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/6 py-2 last:border-0">
      <span className="shrink-0 text-[12px] text-neutral-500">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span
          title={value}
          className={`truncate ${
            mono
              ? "font-mono text-[12px] text-neutral-300"
              : tone === "danger"
                ? "text-[13px] text-rose-300"
                : tone === "muted"
                  ? "text-[13px] text-neutral-500"
                  : strong
                    ? "text-[13px] font-medium text-white"
                    : "text-[13px] text-neutral-100"
          } tabular-nums`}
        >
          {display ?? value}
        </span>
        {copy && (
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        )}
      </span>
    </div>
  );
}

function PageButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors disabled:opacity-30 ${
        active
          ? "bg-white/10 text-white"
          : "text-neutral-400 enabled:hover:bg-white/6 enabled:hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

type Cats = {
  list: string[];
  of: (id: string) => string | null;
  set: (id: string, v: string | null) => void;
  create: (name: string) => void;
};

/** Placeholder: fundings and offramps arrive pre-categorised; the rest wait for someone to sort them. */
function seedCategories(txns: Transaction[]) {
  const out: Record<string, string> = {};
  for (const t of txns) {
    if (t.type === "Account Funding") out[t.id] = "Customer funding";
    else if (t.type === "Offramp") out[t.id] = "Treasury";
  }
  return out;
}

function exportCsv(
  rows: Transaction[],
  categoryOf: (id: string) => string | null,
) {
  const header = [
    "Transaction ID",
    "Created (UTC)",
    "Type",
    "Direction",
    "Status",
    "Channel",
    "Amount",
    "Currency",
    "Fee",
    "Source",
    "Destination",
    "Customer",
    "Category",
    "Hash",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((t) => [
    t.id,
    t.createdAt,
    t.type,
    t.direction,
    t.status,
    t.channel,
    t.amount.toFixed(2),
    t.from === t.to ? t.from : `${t.from}->${t.to}`,
    t.fee.toFixed(2),
    esc(`${t.source.name} ${t.source.detail}`),
    esc(`${t.destination.name} ${t.destination.detail}`),
    esc(t.customer.name),
    esc(categoryOf(t.id) ?? ""),
    t.hash ?? "",
  ]);
  const csv = [header.join(","), ...lines.map((l) => l.join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}
