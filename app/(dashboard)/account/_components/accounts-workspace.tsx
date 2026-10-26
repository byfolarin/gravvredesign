"use client";

import { CurrencyFlag } from "@/app/_components/currency-flag";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  Pencil,
  Plus,
  Search,
  Snowflake,
  X,
  XCircle,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { TablePager, usePager } from "@/app/_components/table-pager";
import {
  LoadingState,
  type LoaderVariant,
} from "@/app/_components/loading-state";
import {
  ALL_CURRENCIES,
  AS_OF,
  PROVISION_STEPS,
  accounts as ALL,
  freezeOf,
  applications as APPLICATIONS,
  type Account,
  type AccountStatus,
  type Application,
  type Category,
  type Currency,
} from "../_data";
import { NAMES, SYMBOL } from "./currency";
import { OpenAccountFlow } from "./open-account-flow";
import { AccountSheet } from "./account-sheet";
import { TransferFlow } from "./transfer-flow";
import {
  FreezeDialog,
  FreezeNotice,
  UnfreezeDialog,
  freezeShort,
} from "./freeze";
import { UpdateNotice } from "@/app/_components/updates";
import { PixelField, wash, type WashTone } from "@/app/_components/pixel-field";

type Section = "accounts" | "applications";
type Tab = "All" | AccountStatus | "Needs action";
const TABS: Tab[] = ["All", "Active", "Pending", "Frozen", "Closed"];
type View = "filled" | "empty" | "errors" | "loading";
const blocked = (a: Account) => !!a.problem && a.problem.kind !== "stale";

/** Prototype "Errors" state: the failures this page actually has to explain. */
function withProblems(all: Account[]): Account[] {
  let info = 0;
  let declined = 0;
  let stale = 0;
  const staleSince = new Date(AS_OF - 2 * 60 * 60_000).toISOString();
  return all.map((a) => {
    if (a.status === "Pending" && info < 3) {
      info++;
      return {
        ...a,
        problem: {
          kind: "needs-info",
          text:
            a.category === "Business"
              ? `${a.bank} needs ${a.customer.name}'s certificate of incorporation and proof of address before it can open the account.`
              : `${a.bank} needs a clearer photo of ${a.customer.name.split(" ")[0]}'s ID — the last one was blurred.`,
          since: a.stepSince ?? a.createdAt,
        },
      };
    }
    if (a.status === "Pending" && declined < 1) {
      declined++;
      return {
        ...a,
        problem: {
          kind: "rejected",
          text: `${a.bank} declined this application — they don't onboard ${a.category === "Business" ? "businesses in this sector" : "residents of this country"}. Nothing was charged. You can open the same account with another bank.`,
          since: a.stepSince ?? a.createdAt,
        },
      };
    }
    if (a.status === "Active" && a.bank === "Stearns Bank" && stale < 6) {
      stale++;
      return {
        ...a,
        problem: {
          kind: "stale",
          text: "Stearns Bank hasn't sent a balance since 7:02 AM.",
          since: staleSince,
        },
      };
    }
    return a;
  });
}
const CURRENCIES: ("All" | Currency)[] = ["All", ...ALL_CURRENCIES];
/** The balance can be shown in up to this many currencies at once. */
export const MAX_SHOWN = 4;
export const SHOWN_KEY = "gravv-accounts-currencies";
const DEFAULT_SHOWN: Currency[] = ["USD", "EUR", "GBP", "NGN"];
const CATEGORIES: ("All" | Category)[] = ["All", "Individual", "Business"];

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const shortRef = (id: string) => `${id.slice(0, 8)}…${id.slice(-6)}`;
const ago = (iso: string) => {
  const h = Math.round((AS_OF - Date.parse(iso)) / (60 * 60 * 1000));
  return h < 24 ? `${Math.max(1, h)}h` : `${Math.round(h / 24)}d`;
};

/** Currencies without a minor unit — shown in whole amounts. */
const WHOLE_ONLY: Currency[] = ["JPY"];
const split = (v: number, c: Currency) =>
  WHOLE_ONLY.includes(c)
    ? [fmt(Math.round(v)).split(".")[0], ""]
    : fmt(v).split(".");

/** Money with superscript cents, in the account's currency. */
function Money({
  value,
  currency,
  className = "",
}: {
  value: number;
  currency: Currency;
  className?: string;
}) {
  const [whole, cents] = split(value, currency);
  return (
    <span className={`tabular-nums ${className}`}>
      {SYMBOL[currency]}
      {whole}
      {cents && (
        <sub className="ml-px align-baseline text-[0.62em] text-neutral-500">
          {cents}
        </sub>
      )}
    </span>
  );
}

export function AccountsWorkspace() {
  const [list, setList] = useState(ALL);
  // Prototype: show the page as a new account, with problems, or loading.
  const [view, setView] = useState<View>("filled");
  // One loader everywhere: Drive.
  const loader: LoaderVariant = "Drive";
  const [section, setSection] = useState<Section>("accounts");
  const [tab, setTab] = useState<Tab>("All");
  const [currency, setCurrency] = useState<"All" | Currency>("All");
  const [shown, setShown] = useState<Currency[]>(DEFAULT_SHOWN);
  // The open-account sheet; `currency` is set when it starts from the currency editor.
  const [opening, setOpening] = useState<{ currency?: Currency } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "null");
        if (Array.isArray(saved)) {
          const valid = saved
            .filter((c): c is Currency => ALL_CURRENCIES.includes(c))
            .slice(0, MAX_SHOWN);
          if (valid.length) setShown(valid);
        }
      } catch {
        // Storage unavailable; keep the default four.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const saveShown = (next: Currency[]) => {
    setShown(next);
    // Removing the currency you're looking at drops its filter too.
    if (currency !== "All" && !next.includes(currency)) setCurrency("All");
    try {
      localStorage.setItem(SHOWN_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable; the choice applies for this visit.
    }
  };
  const [category, setCategory] = useState<"All" | Category>("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // "View all details" opens the full record in a side sheet.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const sheet = sheetId ? list.find((a) => a.id === sheetId) : undefined;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // The account being closed (confirm step), if any.
  const [closing, setClosing] = useState<string | null>(null);
  // Move money: open with the account it starts from (or the default).
  const [transfer, setTransfer] = useState<{ from?: string } | null>(null);
  // Freezing (or editing a freeze) and unfreezing, each a confirm step.
  const [freezing, setFreezing] = useState<string | null>(null);
  const [unfreezing, setUnfreezing] = useState<string | null>(null);
  // The row whose label is being edited in place.
  const [renaming, setRenaming] = useState<string | null>(null);
  const update = (id: string, patch: Partial<Account>) =>
    setList((all) => all.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // ——— Filters: currency, category and search scope everything; the tab narrows the table ———
  const q = query.trim().toLowerCase();
  const scoped = list
    .filter((a) => currency === "All" || a.currency === currency)
    .filter((a) => category === "All" || a.category === category)
    .filter(
      (a) =>
        !q ||
        [
          a.label,
          a.customer.name,
          a.customer.email,
          a.id,
          a.bank,
          a.accountNumber,
        ].some((v) => v.toLowerCase().includes(q)),
    );
  const inTab = (a: Account, t: Tab) =>
    t === "All" ? true : t === "Needs action" ? blocked(a) : a.status === t;
  const rows = scoped.filter((a) => inTab(a, tab));
  const count = (t: Tab) => scoped.filter((a) => inTab(a, t)).length;
  const tabs: Tab[] = count("Needs action")
    ? ["All", "Needs action", ...TABS.slice(1)]
    : TABS;
  const staleOnes = list.filter((a) => a.problem?.kind === "stale");
  const switchView = (v: View) => {
    setView(v);
    setList(v === "empty" ? [] : v === "errors" ? withProblems(ALL) : ALL);
    setTab(v === "errors" ? "Needs action" : "All");
    setCurrency("All");
    setQuery("");
    reset();
  };
  const fix = (a: Account) => {
    const p = a.problem;
    if (!p) return;
    if (p.kind === "needs-info") {
      update(a.id, { problem: undefined });
      setToast(
        `Documents sent to ${a.bank} — they usually review them within a day`,
      );
    } else if (p.kind === "rejected") {
      setOpening({ currency: a.currency });
    }
  };
  const retrySync = () => {
    setToast("Asked Stearns Bank again…");
    setTimeout(() => {
      setList((all) =>
        all.map((a) =>
          a.problem?.kind === "stale" ? { ...a, problem: undefined } : a,
        ),
      );
      setToast("Stearns Bank is back — balances are current");
    }, 2500);
  };
  const pager = usePager(rows, "accounts");
  const visible = pager.visible;
  const reset = () => {
    pager.setPage(1);
    setOpenId(null);
  };

  // ——— Facts ———
  // Balance in the selected currency (USD when "All"), across the accounts in scope.
  const balanceCurrency: Currency = currency === "All" ? shown[0] : currency;
  const funded = scoped.filter(
    (a) =>
      a.currency === balanceCurrency &&
      (a.status === "Active" || a.status === "Frozen"),
  );
  const total = funded.reduce((s, a) => s + a.balance, 0);
  const active = scoped.filter((a) => a.status === "Active").length;
  const pending = scoped.filter((a) => a.status === "Pending");
  const oldest = pending.reduce<Account | null>(
    (o, a) => (!o || a.createdAt < o.createdAt ? a : o),
    null,
  );

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Accounts
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Open an account for a customer, and follow it while the bank
              provisions it.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="State"
              variant="compact"
              align="right"
              value={view}
              options={[
                { value: "filled", label: "Filled", hint: "Today's accounts" },
                { value: "empty", label: "Empty", hint: "A new business" },
                {
                  value: "errors",
                  label: "Errors",
                  hint: "Needs info, declined, stale",
                },
                { value: "loading", label: "Loading", hint: "Drive loader" },
              ]}
              onChange={(v) => switchView(v as View)}
            />
            <button
              type="button"
              onClick={() => setTransfer({})}
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-[13px] text-neutral-200 transition-colors hover:border-white/30"
            >
              <ArrowLeftRight size={14} strokeWidth={1.75} />
              Transfer
            </button>
            <button
              type="button"
              onClick={() => setOpening({})}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white pr-4 pl-3 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              <Plus size={14} strokeWidth={2} />
              Open an account
            </button>
          </div>
        </div>

        <UpdateNotice id="u-plans" place="accounts" />

        {/* Section tabs */}
        <div role="tablist" className="mt-8 flex gap-6 border-b border-white/8">
          {(
            [
              ["accounts", "Accounts", list.length],
              [
                "applications",
                "Applications",
                view === "empty"
                  ? 0
                  : APPLICATIONS.filter(
                      (a) =>
                        a.status === "In review" || a.status === "Needs info",
                    ).length,
              ],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => setSection(id)}
              className={`relative -mb-px flex items-center gap-1.5 border-b-2 pb-3 text-[14px] transition-colors ${
                section === id
                  ? "border-white font-medium text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {label}
              {view !== "loading" && (
                <span className="text-xs text-neutral-500 tabular-nums">
                  {n.toLocaleString("en-US")}
                </span>
              )}
            </button>
          ))}
        </div>

        {view === "loading" ? (
          // Loading is the Drive loader alone — no skeletons (owner's call).
          <div className="flex min-h-[420px] items-center justify-center">
            <LoadingState
              variant={loader}
              label={
                section === "applications"
                  ? "Loading applications"
                  : "Loading accounts"
              }
            />
          </div>
        ) : section === "applications" ? (
          view === "empty" ? (
            <p className="mt-16 text-center text-[13px] text-neutral-500">
              No applications yet. When you open an account, its application
              shows here until the bank approves it.
            </p>
          ) : (
            <Applications />
          )
        ) : list.length === 0 ? (
          <EmptyAccounts onOpen={(c) => setOpening({ currency: c })} />
        ) : (
          <>
            {staleOnes.length > 0 && (
              <div className="mt-8 flex items-center gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-[13px]">
                <AlertTriangle
                  size={15}
                  strokeWidth={1.75}
                  className="shrink-0 text-amber-300"
                />
                <span className="min-w-0 flex-1 text-neutral-200">
                  Stearns Bank hasn&apos;t sent balances since 7:02 AM, so{" "}
                  {staleOnes.length} balances may be out of date.
                  <span className="text-neutral-500">
                    {" "}
                    Gravv retries every 5 minutes; money still moves.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={retrySync}
                  className="h-8 shrink-0 rounded-full border border-white/15 px-3 text-[12.5px] text-neutral-100 hover:border-white/35"
                >
                  Retry now
                </button>
              </div>
            )}
            {/* Balance with its trend, and the two numbers that need attention */}
            <div className="mt-8 grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <BalancePanel
                total={total}
                currency={balanceCurrency}
                currencies={shown}
                onCurrencies={saveShown}
                counts={
                  Object.fromEntries(
                    ALL_CURRENCIES.map((c) => [
                      c,
                      list.filter((a) => a.currency === c).length,
                    ]),
                  ) as Record<Currency, number>
                }
                onCurrency={(c) => {
                  setCurrency(c);
                  reset();
                }}
                onOpenAccount={(c) => setOpening({ currency: c })}
                funded={funded.length}
                waiting={(() => {
                  const w = scoped.filter(
                    (a) =>
                      a.currency === balanceCurrency && a.status === "Pending",
                  );
                  return w.length
                    ? { count: w.length, bank: w[0].bank }
                    : undefined;
                })()}
                accountsNote={`Across ${funded.length.toLocaleString("en-US")} of ${scoped.length.toLocaleString("en-US")} accounts`}
              />
              <div className="grid gap-3">
                <SideFact
                  label="Active accounts"
                  value={
                    <>
                      <Roll value={active.toLocaleString("en-US")} />
                      <span className="ml-1.5 text-[14px] font-normal tracking-normal text-neutral-500">
                        of {scoped.length.toLocaleString("en-US")}
                      </span>
                    </>
                  }
                  share={scoped.length ? active / scoped.length : 0}
                  note={`${count("Frozen")} frozen · ${count("Closed")} closed`}
                  action={
                    count("Frozen") > 0
                      ? {
                          label: "Show frozen",
                          onClick: () => {
                            setTab("Frozen");
                            reset();
                          },
                        }
                      : undefined
                  }
                />
                <SideFact
                  label="Being provisioned"
                  value={<Roll value={String(pending.length)} />}
                  note={
                    count("Needs action")
                      ? `${count("Needs action")} need you · ${list.filter((x) => x.problem?.kind === "needs-info").length} docs, ${list.filter((x) => x.problem?.kind === "rejected").length} declined`
                      : oldest
                        ? `Oldest waiting ${ago(oldest.createdAt)} · ${oldest.bank}`
                        : "Nothing waiting on a bank"
                  }
                  action={
                    count("Needs action")
                      ? {
                          label: "Review",
                          onClick: () => {
                            setTab("Needs action");
                            reset();
                          },
                        }
                      : oldest
                        ? {
                            label: "Review",
                            onClick: () => {
                              setTab("Pending");
                              reset();
                            },
                          }
                        : undefined
                  }
                />
              </div>
            </div>

            {/* Tabs + tools */}
            <div className="mt-10 flex items-center justify-between gap-4">
              <div
                role="tablist"
                className="flex shrink-0 items-center gap-0.5"
              >
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => {
                      setTab(t);
                      reset();
                    }}
                    className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors ${
                      tab === t
                        ? "bg-white/[0.08] font-medium text-white"
                        : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                    }`}
                  >
                    {t}
                    <span
                      className={`text-xs tabular-nums ${tab === t ? "text-neutral-400" : "text-neutral-600"}`}
                    >
                      {count(t).toLocaleString("en-US")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <label className="flex h-8 w-[210px] min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
                  <Search
                    size={13}
                    strokeWidth={1.75}
                    className="shrink-0 text-neutral-500"
                  />
                  <input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      reset();
                    }}
                    placeholder="Search accounts…"
                    aria-label="Search accounts"
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
                  />
                </label>
                <Dropdown
                  label="Currency"
                  variant="chip"
                  value={currency}
                  active={currency !== "All"}
                  align="right"
                  placeholder="Currency"
                  options={CURRENCIES.map((c) => ({
                    value: c,
                    label: c === "All" ? "All currencies" : c,
                    icon: c === "All" ? undefined : <CurrencyFlag code={c} />,
                  }))}
                  onChange={(v) => {
                    setCurrency(v);
                    reset();
                  }}
                />
                <Dropdown
                  label="Category"
                  variant="chip"
                  value={category}
                  active={category !== "All"}
                  align="right"
                  placeholder="Category"
                  options={CATEGORIES.map((c) => ({
                    value: c,
                    label: c === "All" ? "All categories" : c,
                  }))}
                  onChange={(v) => {
                    setCategory(v);
                    reset();
                  }}
                />
                <button
                  type="button"
                  aria-label="Export"
                  title={`Export ${rows.length.toLocaleString("en-US")} accounts`}
                  onClick={() => {
                    exportCsv(rows);
                    setToast(
                      `${rows.length.toLocaleString("en-US")} accounts exported`,
                    );
                  }}
                  className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <Download size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <table className="mt-6 w-full table-fixed border-t border-white/15 text-[13px]">
              <colgroup>
                <col className="w-[180px]" />
                <col />
                <col className="w-[190px]" />
                <col className="w-[100px]" />
                <col className="w-[150px]" />
                <col className="w-[120px]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="py-2.5 pl-4 font-normal">Account reference</th>
                  <th className="py-2.5 font-normal">Label</th>
                  <th className="py-2.5 font-normal">Bank</th>
                  <th className="py-2.5 font-normal">Currency</th>
                  <th className="py-2.5 pr-8 text-right font-normal">
                    Balance
                  </th>
                  <th className="py-2.5 font-normal">Status</th>
                  <th className="py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const open = openId === a.id;
                  return (
                    <Fragment key={a.id}>
                      <tr
                        onClick={() => setOpenId(open ? null : a.id)}
                        aria-expanded={open}
                        className={`group cursor-pointer border-t border-white/6 transition-colors ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
                      >
                        <td
                          className="py-3 pl-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex items-center gap-0.5">
                            <span
                              title={a.id}
                              className="font-mono text-[12px] text-neutral-200"
                            >
                              {shortRef(a.id)}
                            </span>
                            <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <CopyButton
                                value={a.id}
                                label="Copy account reference"
                              />
                            </span>
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {renaming === a.id ? (
                            <RenameField
                              value={a.label}
                              onSave={(label) => {
                                setRenaming(null);
                                if (label && label !== a.label) {
                                  update(a.id, { label });
                                  setToast(`Renamed to “${label}”`);
                                }
                              }}
                              onCancel={() => setRenaming(null)}
                            />
                          ) : (
                            <div className="truncate text-[13.5px] font-medium text-white">
                              {a.label}
                            </div>
                          )}
                          {/* Who holds it, and whether it's yours or a customer's */}
                          <div className="truncate text-[11px] text-neutral-500">
                            {a.customer.name} ·{" "}
                            {a.tier === "Main account"
                              ? "Main account"
                              : a.category}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="truncate text-neutral-200">
                            {a.bank}
                          </div>
                          <div className="text-[11px] text-neutral-500 tabular-nums">
                            ••{a.accountNumber.slice(-4)}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="flex items-center gap-2 text-neutral-200">
                            <Flag currency={a.currency} />
                            {a.currency}
                          </span>
                        </td>
                        <td className="amount py-3 pr-8 text-right">
                          {a.status === "Pending" ? (
                            <span className="text-neutral-600">—</span>
                          ) : (
                            <>
                              <Money
                                value={a.balance}
                                currency={a.currency}
                                className={
                                  a.balance ? "text-white" : "text-neutral-500"
                                }
                              />
                              {a.problem?.kind === "stale" && (
                                <div className="text-[11px] text-amber-200">
                                  As of 2h ago
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="py-3">
                          <Status account={a} withNote />
                        </td>
                        <td
                          className="py-3 pr-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RowMenu
                            account={a}
                            onCopy={() => {
                              navigator.clipboard
                                ?.writeText(
                                  `${a.bank}\n${a.routing.label}: ${a.routing.value}\nAccount: ${a.accountNumber}\nName: ${a.customer.name}`,
                                )
                                .catch(() => {});
                              setToast("Account details copied");
                            }}
                            onTransfer={() => setTransfer({ from: a.id })}
                            onRename={() => setRenaming(a.id)}
                            onFreeze={() =>
                              a.status === "Frozen"
                                ? setUnfreezing(a.id)
                                : setFreezing(a.id)
                            }
                            onEditFreeze={() => setFreezing(a.id)}
                            onClose={() => setClosing(a.id)}
                          />
                        </td>
                      </tr>
                      {open && (
                        <tr className="bg-white/[0.04]">
                          <td colSpan={7} className="px-4 pb-4">
                            <Preview
                              account={a}
                              onViewAll={() => setSheetId(a.id)}
                              onClose={() => setOpenId(null)}
                              onFix={() => fix(a)}
                              onRetry={retrySync}
                              onEditFreeze={() => setFreezing(a.id)}
                              onUnfreeze={() => setUnfreezing(a.id)}
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
                      colSpan={7}
                      className="border-t border-white/6 py-16 text-center text-neutral-500"
                    >
                      {tab === "Needs action"
                        ? "Nothing needs you — every application is moving."
                        : "No accounts match."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <TablePager pager={pager} noun="accounts" />
          </>
        )}
      </div>

      {sheet && (
        <AccountSheet
          account={sheet}
          chip={<Status account={sheet} />}
          balance={<Money value={sheet.balance} currency={sheet.currency} />}
          onClose={() => setSheetId(null)}
          notice={
            freezeOf(sheet) && (
              <FreezeNotice
                account={sheet}
                freeze={freezeOf(sheet)!}
                onEdit={() => setFreezing(sheet.id)}
                onUnfreeze={() => setUnfreezing(sheet.id)}
                stacked
                className="mt-5 rounded-xl border border-white/8 px-4 py-3.5"
              />
            )
          }
        />
      )}

      {opening && (
        <OpenAccountFlow
          accounts={list}
          initialCurrency={opening.currency}
          onClose={() => setOpening(null)}
          onCreated={(a, view) => {
            setList((all) => [a, ...all]);
            // A new currency joins the balance switch when there's room for it.
            if (!shown.includes(a.currency) && shown.length < MAX_SHOWN)
              saveShown([...shown, a.currency]);
            setSection("accounts");
            setCurrency(a.currency);
            setCategory("All");
            setQuery("");
            setTab("All");
            reset();
            setOpenId(view ? a.id : null);
            setOpening(null);
            setToast(
              `${a.currency} account requested — ${a.bank} is setting it up`,
            );
          }}
        />
      )}

      {transfer && (
        <TransferFlow
          accounts={list}
          initialFrom={
            transfer.from ? list.find((x) => x.id === transfer.from) : undefined
          }
          onClose={() => setTransfer(null)}
          onDone={(r) => {
            // Waiting on approval or a date: nothing moves yet.
            if (r.approval || r.when !== "now") return;
            setList((all) =>
              all.map((x) =>
                x.id === r.from.id
                  ? { ...x, balance: x.balance - r.amount }
                  : x.id === r.to.id
                    ? { ...x, balance: x.balance + r.gets }
                    : x,
              ),
            );
          }}
        />
      )}

      {freezing &&
        (() => {
          const acct = list.find((x) => x.id === freezing);
          if (!acct) return null;
          const editing = freezeOf(acct);
          return (
            <FreezeDialog
              account={acct}
              editing={editing}
              onCancel={() => setFreezing(null)}
              onConfirm={(f) => {
                update(acct.id, { status: "Frozen", freeze: f });
                setFreezing(null);
                setToast(
                  editing
                    ? `Freeze on ${acct.label} updated`
                    : `${acct.label} frozen · ${f.scope === "all" ? "nothing moves in or out" : "money out stopped"}${f.told ? ` · ${acct.customer.name} emailed` : ""}`,
                );
              }}
            />
          );
        })()}

      {unfreezing &&
        (() => {
          const acct = list.find((x) => x.id === unfreezing);
          const f = acct && freezeOf(acct);
          if (!acct || !f) return null;
          return (
            <UnfreezeDialog
              account={acct}
              freeze={f}
              onCancel={() => setUnfreezing(null)}
              onConfirm={(send) => {
                update(acct.id, {
                  status: "Active",
                  freeze: undefined,
                  balance:
                    acct.balance +
                    f.held -
                    (send && f.waiting.count ? f.waiting.amount : 0),
                });
                setUnfreezing(null);
                const fmt = (v: number) =>
                  `${SYMBOL[acct.currency]}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                setToast(
                  [
                    `${acct.label} unfrozen`,
                    f.held > 0 && `${fmt(f.held)} added`,
                    f.waiting.count > 0 &&
                      (send
                        ? `${f.waiting.count} payment${f.waiting.count === 1 ? "" : "s"} sending`
                        : `${f.waiting.count} payment${f.waiting.count === 1 ? "" : "s"} cancelled`),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                );
              }}
            />
          );
        })()}

      {closing &&
        (() => {
          const acct = list.find((x) => x.id === closing);
          if (!acct) return null;
          return (
            <CloseDialog
              account={acct}
              destinations={list.filter(
                (x) =>
                  x.id !== acct.id &&
                  x.status === "Active" &&
                  x.currency === acct.currency &&
                  x.customer.name === acct.customer.name,
              )}
              onCancel={() => setClosing(null)}
              onConfirm={(to) => {
                if (to && to.kind === "account")
                  update(to.id, {
                    balance:
                      (list.find((x) => x.id === to.id)?.balance ?? 0) +
                      acct.balance,
                  });
                update(acct.id, { status: "Closed", balance: 0 });
                setClosing(null);
                setToast(
                  acct.balance > 0 && to
                    ? `${acct.label} closed · ${SYMBOL[acct.currency]}${acct.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} moved to ${to.label}`
                    : `${acct.label} closed`,
                );
              }}
            />
          );
        })()}

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

/** Same chip system as the rest of the platform. Pending reads as "Provisioning" — that's what's happening. */
function Status({
  account: a,
  withNote = false,
}: {
  account: Account;
  /** Table rows say what a freeze is doing under the chip. */
  withNote?: boolean;
}) {
  if (a.problem?.kind === "needs-info" || a.problem?.kind === "rejected")
    return (
      <span
        className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium ${
          a.problem.kind === "rejected"
            ? "border-transparent bg-rose-400/10 text-rose-300"
            : "border-transparent bg-amber-300/10 text-amber-200"
        }`}
      >
        {a.problem.kind === "rejected" ? "Declined" : "Needs info"}
      </span>
    );
  const label = a.status === "Pending" ? "Provisioning" : a.status;
  const tone =
    a.status === "Active"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : a.status === "Pending"
        ? "border-transparent bg-blue-400/12 text-blue-300"
        : a.status === "Frozen"
          ? "border-sky-300/25 bg-sky-400/10 text-sky-200"
          : "border-transparent bg-white/[0.05] text-neutral-500";
  const f = freezeOf(a);
  return (
    <>
      <span
        className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium ${tone}`}
      >
        {label}
      </span>
      {f && withNote && (
        <div className="mt-1 text-[11px] whitespace-nowrap text-neutral-500">
          {freezeShort(f)}
        </div>
      )}
    </>
  );
}

function Flag({ currency }: { currency: Currency }) {
  return <CurrencyFlag code={currency} />;
}

/** Bank details with copy, and — while it's being set up — where provisioning is. */
function Preview({
  account: a,
  onViewAll,
  onClose,
  onFix,
  onRetry,
  onEditFreeze,
  onUnfreeze,
}: {
  account: Account;
  onViewAll: () => void;
  onClose: () => void;
  onFix: () => void;
  onRetry: () => void;
  onEditFreeze: () => void;
  onUnfreeze: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const pending = a.status === "Pending";
  const p = a.problem;
  const f = freezeOf(a);
  return (
    <div className="orbit-pop rounded-xl border border-white/8 bg-surface">
      {f && (
        <FreezeNotice
          account={a}
          freeze={f}
          onEdit={onEditFreeze}
          onUnfreeze={onUnfreeze}
          className="border-b border-white/6 px-5 py-3.5"
        />
      )}
      {p && (
        <div className="flex items-start gap-3 border-b border-white/6 px-5 py-3.5">
          <AlertTriangle
            size={15}
            strokeWidth={1.75}
            className={`mt-[2px] shrink-0 ${p.kind === "rejected" ? "text-rose-300" : "text-amber-300"}`}
          />
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed whitespace-normal text-neutral-200">
            {p.text}
            {p.since && (
              <span className="text-neutral-500">
                {" "}
                · since {dateFmt.format(new Date(p.since))}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={p.kind === "stale" ? onRetry : onFix}
            className="h-8 shrink-0 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200"
          >
            {p.kind === "needs-info"
              ? "Upload documents"
              : p.kind === "rejected"
                ? "Open with another bank"
                : "Retry now"}
          </button>
        </div>
      )}
      <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Account holder" value={a.customer.name} copy />
        <Detail
          label={a.currency === "EUR" ? "IBAN" : "Account number"}
          value={pending ? "Issued when active" : a.accountNumber}
          mono={!pending}
          copy={!pending}
        />
        <Detail label={a.routing.label} value={a.routing.value} mono copy />
        <Detail label="Bank" value={a.bank} />
      </div>
      {pending && a.step !== undefined ? (
        <div className="border-t border-white/6 px-5 py-4">
          <ol className="grid grid-cols-4 gap-3">
            {PROVISION_STEPS.map((s, i) => {
              const done = i <= a.step!;
              const now = i === a.step! + 1;
              return (
                <li key={s}>
                  <div
                    className={`h-1 rounded-full ${done ? "bg-white/70" : now ? "bg-white/30" : "bg-white/[0.08]"}`}
                  />
                  <div
                    className={`mt-2 flex items-center gap-1 text-[12px] ${done ? "text-neutral-300" : now ? "text-white" : "text-neutral-600"}`}
                  >
                    {done && <Check size={12} strokeWidth={2.5} />}
                    {s}
                  </div>
                  {now && a.stepSince && (
                    <div className="text-[11px] text-neutral-500">
                      Since {dateFmt.format(new Date(a.stepSince))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center justify-between gap-4 text-[12px] text-neutral-500">
            <span>Opened {longDate.format(new Date(a.createdAt))}</span>
            <ViewAll onClick={onViewAll} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-2.5 text-[12px] text-neutral-500">
          <span>
            Opened {longDate.format(new Date(a.createdAt))} · {a.category}{" "}
            account
          </span>
          <ViewAll onClick={onViewAll} />
        </div>
      )}
    </div>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/12 pr-2 pl-3 text-[12px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
    >
      View all details
      <ChevronRight size={13} strokeWidth={1.75} />
    </button>
  );
}

function Detail({
  label,
  value,
  mono = false,
  copy = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-0.5">
        <span
          className={`truncate ${mono ? "font-mono text-[12px] text-neutral-200" : "text-[13px] text-neutral-100"}`}
        >
          {value}
        </span>
        {copy && (
          <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
        )}
      </div>
    </div>
  );
}

const OFFER: {
  currency: Currency;
  bank: string;
  rails: string;
  time: string;
}[] = [
  {
    currency: "USD",
    bank: "Lead Bank",
    rails: "ACH and wire, with a routing number",
    time: "Usually same day",
  },
  {
    currency: "EUR",
    bank: "Banking Circle",
    rails: "SEPA, with an IBAN in their name",
    time: "1–2 business days",
  },
  {
    currency: "GBP",
    bank: "Clear Junction",
    rails: "Faster Payments, with a sort code",
    time: "1–2 business days",
  },
  {
    currency: "NGN",
    bank: "Access Bank",
    rails: "NIP transfers, with a NUBAN",
    time: "In minutes",
  },
];

/** A new business: what an account is, what they can open, and the one button to do it. */
/**
 * A new business, shown honestly: the page's real layout with real zeros — an empty chart
 * waiting at today, an outline where the status column will fill — then the way in.
 */
function EmptyAccounts({ onOpen }: { onOpen: (c?: Currency) => void }) {
  const steps = [
    {
      title: "Open an account",
      line: "Pick a currency and a bank. Ready in minutes to two days.",
    },
    {
      title: "Share the details",
      line: "Send the routing number or IBAN to whoever pays the holder.",
    },
    {
      title: "First money lands",
      line: "Balances, trend and daily change start filling this page.",
    },
  ];
  return (
    <>
      {/* The way in: what this is on the left, the three steps stacked on the right */}
      <section className="mt-12 grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div>
          <h2 className="text-[26px] leading-tight font-medium tracking-[-0.025em] text-white">
            Get your first account open
          </h2>
          <p className="mt-2.5 max-w-[440px] text-[14px] leading-relaxed text-neutral-500">
            Each customer gets a bank account in their own name and currency.
            Money that lands in it shows here, with its balance and trend.
          </p>
          <p className="mt-8 flex flex-wrap items-center gap-1 text-[12px] text-neutral-500">
            Opening accounts from your own product? Use{" "}
            <span className="font-mono text-neutral-300">
              POST /v1/accounts
            </span>
            <CopyButton value="POST /v1/accounts" label="Copy endpoint" />
          </p>
        </div>

        {/* Steps as rows; only the one to do now is lit */}
        <ol className="divide-y divide-white/[0.07]">
          {steps.map((st, i) => {
            const now = i === 0;
            return (
              <li key={st.title} className="flex gap-4 py-4">
                <span
                  className={`mt-px flex size-6 shrink-0 items-center justify-center rounded-full text-[11.5px] font-medium tabular-nums ${
                    now
                      ? "bg-white text-black"
                      : "text-neutral-500 ring-1 ring-white/15"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[14.5px] font-medium tracking-[-0.01em] ${now ? "text-white" : "text-neutral-400"}`}
                  >
                    {st.title}
                  </span>
                  <span
                    className={`mt-0.5 block text-[13px] leading-relaxed ${now ? "text-neutral-400" : "text-neutral-500"}`}
                  >
                    {st.line}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* What you can open, in the page's table style: a row starts the flow */}
      <section className="mt-14 border-t border-white/8 pt-8">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-white">
            What you can open
          </h3>
          <span className="text-[13px] text-neutral-500 tabular-nums">
            {OFFER.length} currencies today
          </span>
        </div>
        <table className="mt-3 w-full table-fixed text-[13px]">
          <colgroup>
            <col className="w-[120px]" />
            <col />
            <col />
            <col className="w-[180px]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-3 font-normal">Currency</th>
              <th className="py-2.5 font-normal">Bank</th>
              <th className="py-2.5 font-normal">Receives by</th>
              <th className="py-2.5 font-normal">Ready in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {OFFER.map((o) => (
              <tr
                key={o.currency}
                onClick={() => onOpen(o.currency)}
                className="group cursor-pointer border-b border-white/6 transition-colors hover:bg-white/[0.02]"
              >
                <td className="py-3.5 pl-3">
                  <span className="flex items-center gap-2.5">
                    <Flag currency={o.currency} />
                    <span className="font-medium text-white">{o.currency}</span>
                  </span>
                </td>
                <td className="py-3.5 text-neutral-200">{o.bank}</td>
                <td className="py-3.5 text-neutral-500">{o.rails}</td>
                <td className="py-3.5 text-neutral-500">{o.time}</td>
                <td className="py-3.5 pr-3 text-right">
                  <ChevronRight
                    size={14}
                    strokeWidth={1.75}
                    className="ml-auto text-neutral-600 transition-colors group-hover:text-white"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 pl-3 text-[12px] text-neutral-500">
          Plus JPY, CAD, AUD and more when you open one.
        </p>
      </section>
    </>
  );
}

/** Applications that become accounts: who applied, where it is, and what's blocking it. */
function Applications() {
  const tone: Record<Application["status"], string> = {
    "In review": "border-dashed border-white/20 text-neutral-300",
    "Needs info": "border-amber-300/25 bg-amber-300/10 text-amber-200",
    Approved: "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]",
    Rejected: "border-transparent bg-rose-400/10 text-rose-300",
  };
  const pager = usePager(APPLICATIONS, "account-applications");
  return (
    <>
      <table className="mt-8 w-full table-fixed border-t border-white/15 text-[13px]">
        <colgroup>
          <col />
          <col className="w-[200px]" />
          <col className="w-[120px]" />
          <col className="w-[120px]" />
          <col className="w-[130px]" />
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="py-2.5 pl-4 font-normal">Applicant</th>
            <th className="py-2.5 font-normal">Bank</th>
            <th className="py-2.5 font-normal">Currency</th>
            <th className="py-2.5 font-normal">Submitted</th>
            <th className="py-2.5 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {pager.visible.map((a) => (
            <tr
              key={a.id}
              className="border-t border-white/6 hover:bg-white/[0.03]"
            >
              <td className="py-3 pr-4 pl-4">
                <div className="truncate text-neutral-100">{a.applicant}</div>
                <div
                  className={`truncate text-[11px] ${a.note ? (a.status === "Rejected" ? "text-rose-300" : "text-amber-200") : "text-neutral-500"}`}
                >
                  {a.note ?? `${a.category} · ${a.email}`}
                </div>
              </td>
              <td className="py-3 text-neutral-200">{a.bank}</td>
              <td className="py-3">
                <span className="flex items-center gap-2 text-neutral-200">
                  <Flag currency={a.currency} />
                  {a.currency}
                </span>
              </td>
              <td className="py-3 text-neutral-300 tabular-nums">
                {dateFmt.format(new Date(a.submittedAt))}
              </td>
              <td className="py-3">
                <span
                  className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium ${tone[a.status]}`}
                >
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TablePager pager={pager} noun="applications" />
    </>
  );
}

const PERIODS = [7, 30, 90] as const;
type Period = (typeof PERIODS)[number];
const DAY_MS = 86_400_000;
const PERIOD_KEY = "gravv-accounts-period";

/**
 * Daily closing balances and daily net change, for this period and the one before.
 * Built from flows that look like a real treasury — busy weekdays, quiet weekends,
 * month-end payouts and the odd large deposit — then anchored so today = the headline.
 */
function balanceHistory(total: number, currency: Currency, days: number) {
  let seed = currency.charCodeAt(0) * 7919 + currency.charCodeAt(1) * 31;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32;
    return seed / 2 ** 32;
  };
  const today = Math.floor(AS_OF / DAY_MS) * DAY_MS;
  const span = days * 2;
  const net: number[] = [];
  for (let k = 0; k < span; k++) {
    const day = new Date(today - (span - 1 - k) * DAY_MS);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    const date = day.getUTCDate();
    const base = total * 0.011;
    // A slow tide (weeks of growth, then a softer stretch) under the day-to-day noise.
    const tide = Math.sin(k / 9) * 0.35 + 0.12;
    let inflow = base * (weekend ? 0.2 : 0.55 + rand() * 1.1 + tide);
    let outflow = base * (weekend ? 0.15 : 0.45 + rand() * 1.0);
    if (date === 1 || date === 15) outflow += total * (0.012 + rand() * 0.01); // payout runs
    if (rand() < 0.07) inflow += total * (0.012 + rand() * 0.02); // a large deposit
    if (rand() < 0.05) outflow += total * (0.01 + rand() * 0.015); // a large withdrawal
    net.push(inflow - outflow);
  }
  const closes: number[] = new Array(span);
  closes[span - 1] = total;
  for (let k = span - 2; k >= 0; k--)
    closes[k] = Math.max(0, closes[k + 1] - net[k + 1]);
  return {
    current: closes.slice(days).map((v, k) => ({
      day: today - (days - 1 - k) * DAY_MS,
      v,
      net: net[days + k],
    })),
    previous: closes.slice(0, days),
  };
}

/** Smooth path that never overshoots the data (monotone cubic). */
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

const compactMoney = (v: number) =>
  v >= 1_000_000
    ? `${Number((v / 1_000_000).toFixed(2))}M`
    : v >= 1_000
      ? `${Number((v / 1_000).toFixed(1))}k`
      : String(Math.round(v));

/**
 * One balance, one place: the headline number with its trend underneath. Hovering the chart
 * moves the headline to that day (Stripe-style), the previous period sits behind as a dashed
 * line, and a strip of daily net change gives the shape its reasons.
 */
export function BalancePanel({
  total,
  currency,
  currencies,
  onCurrency,
  onCurrencies,
  counts,
  onOpenAccount,
  funded,
  waiting,
  accountsNote,
  label = "Balance",
}: {
  /** The word before the currency switch; "" when a frame already titles it (Overview). */
  label?: string;
  total: number;
  currency: Currency;
  currencies: Currency[];
  onCurrency: (c: Currency) => void;
  onCurrencies: (next: Currency[]) => void;
  counts: Record<Currency, number>;
  onOpenAccount: (c: Currency) => void;
  /** Accounts holding a balance in this currency; 0 shows the empty state. */
  funded: number;
  waiting?: { count: number; bank: string };
  accountsNote: string;
}) {
  const [period, setPeriod] = useState<Period>(30);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem(PERIOD_KEY));
        if (PERIODS.includes(saved as Period)) setPeriod(saved as Period);
      } catch {
        // Storage unavailable; keep 30 days.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const { current, previous } = balanceHistory(total, currency, period);
  const n = current.length;
  const i = hover ?? n - 1;
  const shown = current[i];
  const vsPrev = previous[n - 1]
    ? (total - previous[n - 1]) / previous[n - 1]
    : 0;
  const [whole, cents] = split(shown.v, currency);

  const W = 1000;
  const H = 150;
  const values = [...current.map((p) => p.v), ...previous];
  const hi = Math.max(...values);
  const lo = Math.min(...values);
  const pad = (hi - lo) * 0.15 || hi * 0.05 || 1;
  const top = hi + pad;
  const bottom = Math.max(0, lo - pad);
  const X = (k: number) => (n < 2 ? 0 : (k / (n - 1)) * W);
  const Y = (v: number) => ((top - v) / (top - bottom)) * H;
  const cur = smooth(current.map((p, k) => [X(k), Y(p.v)]));
  const prev = smooth(previous.map((v, k) => [X(k), Y(v)]));
  const area = `${cur}L${W},${H}L0,${H}Z`;
  const maxNet = Math.max(...current.map((p) => Math.abs(p.net)), 1);
  const pct = (k: number) => `${(X(k) / W) * 100}%`;

  return (
    <section className="min-w-0 pt-1 pr-4">
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-neutral-500">
            {label && <span>{label}</span>}
            {/* Currency switch lives with the number it changes */}
            <span className="flex rounded-full bg-white/[0.06] p-0.5">
              {currencies.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onCurrency(c)}
                  aria-pressed={c === currency}
                  className={`h-6 rounded-full px-2 text-[11px] transition-colors ${
                    c === currency
                      ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  {c}
                </button>
              ))}
            </span>
            <CurrencyEditor
              value={currencies}
              counts={counts}
              onChange={onCurrencies}
              onOpenAccount={onOpenAccount}
            />
          </div>
          <div className="amount mt-3 text-[34px] leading-none font-medium tracking-[-0.035em] text-white tabular-nums">
            {SYMBOL[currency]}
            {whole}
            {cents && (
              <sub className="ml-px align-baseline text-[0.5em] font-normal tracking-normal text-neutral-500">
                .{cents}
              </sub>
            )}
          </div>
          <div className="mt-2.5 flex h-5 items-center gap-2 text-[12px] text-neutral-500 tabular-nums">
            {funded === 0 ? (
              <span>
                {waiting
                  ? `${waiting.count} ${currency} account${waiting.count > 1 ? "s" : ""} being set up`
                  : `No ${currency} accounts yet`}
              </span>
            ) : hover === null ? (
              <>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-medium ${
                    vsPrev >= 0
                      ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
                      : "bg-white/[0.06] text-neutral-300"
                  }`}
                >
                  {vsPrev >= 0 ? "+" : "−"}
                  {Math.abs(vsPrev * 100).toFixed(1)}%
                </span>
                <span>
                  vs previous {period} days · {accountsNote}
                </span>
              </>
            ) : (
              <>
                <span className="text-neutral-300">
                  {longDate.format(new Date(shown.day))}
                </span>
                <span>·</span>
                <span
                  className={
                    shown.net >= 0
                      ? "text-[var(--flow-in)]"
                      : "text-neutral-300"
                  }
                >
                  {shown.net >= 0 ? "+" : "−"}
                  {SYMBOL[currency]}
                  {compactMoney(Math.abs(shown.net))} that day
                </span>
                <span>
                  · previous period {SYMBOL[currency]}
                  {compactMoney(previous[i])}
                </span>
              </>
            )}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label="Period"
          hidden={funded === 0}
          className="flex shrink-0 rounded-full bg-white/[0.07] p-0.5"
        >
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => {
                setPeriod(p);
                setHover(null);
                try {
                  localStorage.setItem(PERIOD_KEY, String(p));
                } catch {
                  // Storage unavailable; the choice applies for this visit.
                }
              }}
              className={`h-7 rounded-full px-2.5 text-xs tabular-nums transition-colors ${
                period === p
                  ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                  : "text-neutral-500 hover:text-white"
              }`}
            >
              {p}D
            </button>
          ))}
        </div>
      </div>

      {funded === 0 ? (
        // Nothing to chart yet — say why, and what happens next.
        <div
          className="relative isolate mt-6 flex h-[214px] flex-col items-center justify-center overflow-hidden rounded-xl px-6 text-center"
          style={
            waiting
              ? wash("blue", "50% 100%", 12)
              : wash("mint", "50% 100%", 12)
          }
        >
          {!waiting && (
            <PixelField
              seed={`empty-${currency}`}
              className="inset-x-0 bottom-0 h-1/3 w-full"
              solid={0.1}
              strength={0.7}
              cols={90}
              rows={9}
            />
          )}
          <div className="text-[14px] text-white">
            {waiting
              ? `Your ${currency} account is being set up`
              : `You don't have a ${currency} account`}
          </div>
          <p className="mt-1.5 max-w-[360px] text-[12px] leading-relaxed text-neutral-500">
            {waiting
              ? `${waiting.bank} is provisioning it. The balance and its trend show here once the account is active and money comes in.`
              : `Open one to get local ${currency} bank details. Its balance and trend will show here.`}
          </p>
          {!waiting && (
            <button
              type="button"
              onClick={() => onOpenAccount(currency)}
              className="mt-4 flex h-8 items-center gap-1 rounded-full bg-white pr-2.5 pl-3.5 text-[12px] font-medium text-black hover:bg-neutral-200"
            >
              Open a {currency} account
              <ChevronRight size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      ) : (
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
                    id="acct-balance-fill"
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
                <path d={area} fill="url(#acct-balance-fill)" />
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
                  style={{ left: pct(i), top: `${(Y(shown.v) / H) * 100}%` }}
                />
              )}
            </div>

            {/* Daily net change: up in mint, down in grey, from a shared baseline */}
            <div
              className="relative mt-3 flex h-9 items-center gap-px"
              aria-hidden
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.08]" />
              {current.map((p, k) => {
                const h = Math.max(1.5, (Math.abs(p.net) / maxNet) * 18);
                return (
                  <span
                    key={p.day}
                    className="relative flex h-full flex-1 flex-col justify-center"
                  >
                    <span
                      className={`mx-auto w-[60%] max-w-[6px] rounded-[1px] transition-opacity ${p.net >= 0 ? "bg-[var(--flow-in)]" : "bg-[var(--flow-out)]"} ${
                        hover !== null && hover !== k ? "opacity-35" : ""
                      }`}
                      style={{
                        height: h,
                        transform: `translateY(${p.net >= 0 ? -h / 2 : h / 2}px)`,
                      }}
                    />
                  </span>
                );
              })}
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
              {current.map((p, k) => (
                <span
                  key={p.day}
                  className="h-full flex-1 cursor-crosshair"
                  onMouseEnter={() => setHover(k)}
                />
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
            <span>{dateFmt.format(new Date(current[0].day))}</span>
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-3 rounded-full bg-[var(--flow-in)]" />
                Balance
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-neutral-500" />
                Previous {period} days
              </span>
              <span className="flex items-center gap-1.5">
                <span className="flex gap-px">
                  <span className="h-2 w-1 rounded-[1px] bg-[var(--flow-in)]" />
                  <span className="h-2 w-1 rounded-[1px] bg-[var(--flow-out)]" />
                </span>
                Daily change
              </span>
            </span>
            <span>Today</span>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Choose which currencies the balance can switch between — up to four, in the order
 * picked. Opens from a quiet button beside the switch; at the limit, the rest wait
 * until one is removed.
 */
function CurrencyEditor({
  value,
  counts,
  onChange,
  onOpenAccount,
}: {
  value: Currency[];
  counts: Record<Currency, number>;
  onChange: (next: Currency[]) => void;
  /** Currencies with no account go through opening one first. */
  onOpenAccount: (c: Currency) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  const full = value.length >= MAX_SHOWN;
  const needle = q.trim().toLowerCase();
  const match = (c: Currency) =>
    !needle ||
    c.toLowerCase().includes(needle) ||
    NAMES[c].toLowerCase().includes(needle);
  const rest = ALL_CURRENCIES.filter((c) => !value.includes(c) && match(c));
  const toggle = (c: Currency) => {
    if (value.includes(c)) {
      if (value.length > 1) onChange(value.filter((x) => x !== c));
    } else if (!full) {
      if (counts[c] === 0) {
        setOpen(false);
        onOpenAccount(c);
      } else onChange([...value, c]);
    }
  };

  const row = (c: Currency, on: boolean) => {
    const locked = on ? value.length === 1 : full;
    return (
      <button
        key={c}
        type="button"
        role="menuitemcheckbox"
        aria-checked={on}
        aria-disabled={locked}
        onClick={() => toggle(c)}
        title={
          on && locked
            ? "Keep at least one currency"
            : !on && locked
              ? `Remove one to add ${c}`
              : !on && counts[c] === 0
                ? `Open a ${c} account to add it`
                : undefined
        }
        className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors ${
          locked && !on ? "cursor-default opacity-40" : "hover:bg-white/[0.06]"
        }`}
      >
        <CurrencyFlag code={c} />
        <span className="w-9 font-medium text-white">{c}</span>
        <span className="min-w-0 flex-1 truncate text-neutral-500">
          {NAMES[c]}
        </span>
        <span className="text-[11px] text-neutral-500 tabular-nums">
          {counts[c] ? counts[c].toLocaleString("en-US") : "No account"}
        </span>
        <span className="flex size-4 items-center justify-center">
          {on ? (
            <Check size={14} strokeWidth={2} className="text-white" />
          ) : counts[c] === 0 ? (
            <ChevronRight
              size={13}
              strokeWidth={1.75}
              className="text-neutral-500 opacity-0 group-hover:opacity-100"
            />
          ) : (
            <Plus
              size={13}
              strokeWidth={1.75}
              className="text-neutral-500 opacity-0 group-hover:opacity-100"
            />
          )}
        </span>
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Edit currencies"
        aria-expanded={open}
        title="Edit currencies"
        onClick={() => {
          setOpen((o) => !o);
          setQ("");
        }}
        className={`flex size-6 items-center justify-center rounded-full transition-colors ${
          open
            ? "bg-white/[0.08] text-white"
            : "text-neutral-500 hover:bg-white/[0.06] hover:text-white"
        }`}
      >
        <Pencil size={11} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-2 w-[300px] rounded-xl border border-white/10 bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]"
        >
          <div className="flex items-baseline justify-between px-2 pt-1.5 pb-2">
            <span className="text-[13px] font-medium text-white">
              Currencies on balance
            </span>
            <span className="text-[11px] text-neutral-500 tabular-nums">
              {value.length} of {MAX_SHOWN}
            </span>
          </div>
          {value.map((c) => row(c, true))}
          <div className="mx-2 my-1.5 h-px bg-white/[0.07]" />
          <label className="mx-1 mb-1 flex h-8 items-center gap-2 rounded-lg px-2 text-neutral-500 focus-within:bg-white/[0.04]">
            <Search size={13} strokeWidth={1.75} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Add a currency…"
              aria-label="Find a currency"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
          {full && (
            <p className="px-2 pb-1.5 text-[11px] text-neutral-500">
              Four is the limit — remove one to add another.
            </p>
          )}
          <div className="max-h-[188px] overflow-y-auto">
            {rest.length ? (
              rest.map((c) => row(c, false))
            ) : (
              <p className="px-2 py-2 text-[12px] text-neutral-500">
                No currency matches “{q}”.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A compact fact card for the right column. */
function SideFact({
  label,
  value,
  note,
  share,
  action,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  share?: number;
  action?: { label: string; onClick: () => void };
  /** What the number means: mint good, blue in progress, amber needs you. */
  tone?: WashTone;
}) {
  return (
    <div
      className="flex min-w-0 flex-col rounded-2xl border border-white/8 p-5"
      style={tone ? wash(tone, "100% 100%", 20) : undefined}
    >
      <div className="text-[13px] text-neutral-500">{label}</div>
      <div className="mt-2 text-[28px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
        {value}
      </div>
      {share !== undefined && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-[var(--flow-in)]"
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-[12px] text-neutral-500">
        <span className="min-w-0 truncate" title={note}>
          {note}
        </span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex shrink-0 items-center gap-0.5 text-neutral-200 hover:text-white"
          >
            {action.label}
            <ChevronRight size={13} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}

function RowMenu({
  account: a,
  onCopy,
  onTransfer,
  onRename,
  onFreeze,
  onEditFreeze,
  onClose,
}: {
  account: Account;
  onCopy: () => void;
  onTransfer: () => void;
  onRename: () => void;
  onFreeze: () => void;
  onEditFreeze: () => void;
  onClose: () => void;
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
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const live = a.status === "Active" || a.status === "Frozen";
  const items = [
    ...(a.status !== "Pending"
      ? [{ label: "Copy account details", icon: Copy, onClick: onCopy }]
      : []),
    ...(a.status === "Active"
      ? [{ label: "Transfer", icon: ArrowLeftRight, onClick: onTransfer }]
      : []),
    { label: "Rename", icon: Pencil, onClick: onRename },
    ...(live
      ? [
          {
            label: a.status === "Frozen" ? "Unfreeze…" : "Freeze…",
            icon: Snowflake,
            onClick: onFreeze,
          },
        ]
      : []),
    ...(a.status === "Frozen"
      ? [{ label: "Edit freeze", icon: Pencil, onClick: onEditFreeze }]
      : []),
  ];
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/8 hover:text-white ${open ? "bg-white/8 text-white" : "text-neutral-500"}`}
      >
        <EllipsisVertical size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-52 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={run(it.onClick)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <it.icon
                size={14}
                strokeWidth={1.75}
                className="text-neutral-400"
              />
              {it.label}
            </button>
          ))}
          {a.status !== "Closed" && (
            <div className="mt-1 border-t border-white/8 pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={run(onClose)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <XCircle size={14} strokeWidth={1.75} />
                Close account
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function exportCsv(rows: Account[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "Account reference",
    "Label",
    "Customer",
    "Category",
    "Bank",
    "Currency",
    "Balance",
    "Status",
    "Opened",
  ];
  const lines = rows.map((a) =>
    [
      a.id,
      esc(a.label),
      esc(a.customer.name),
      a.category,
      esc(a.bank),
      a.currency,
      a.balance.toFixed(2),
      a.status,
      a.createdAt,
    ].join(","),
  );
  const href = URL.createObjectURL(
    new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }),
  );
  const el = document.createElement("a");
  el.href = href;
  el.download = "accounts.csv";
  el.click();
  URL.revokeObjectURL(href);
}

/** The label, editable in the row: Enter or leaving saves, Esc puts it back. */
function RenameField({
  value,
  onSave,
  onCancel,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      maxLength={60}
      aria-label="Account name"
      onChange={(e) => setV(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") onSave(v.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => onSave(v.trim())}
      className="-my-1 h-7 w-full rounded-md border border-white/25 bg-transparent px-2 text-[13.5px] font-medium text-white outline-none focus:border-white/45"
    />
  );
}

const CLOSE_REASONS = [
  "No longer needed",
  "Customer offboarded",
  "Duplicate account",
  "Moving to another bank",
  "Other",
] as const;

type CloseTo = { kind: "account" | "wallet"; id: string; label: string };

/**
 * Closing without surprises: say what's in it and where it goes, what stops working, and
 * why — then one red button. An account with money in it can't close until the money has a home.
 */
function CloseDialog({
  account: a,
  destinations,
  onCancel,
  onConfirm,
}: {
  account: Account;
  /** The holder's other active accounts in the same currency. */
  destinations: Account[];
  onCancel: () => void;
  onConfirm: (to: CloseTo | null) => void;
}) {
  const options: CloseTo[] = [
    ...destinations.map((d) => ({
      kind: "account" as const,
      id: d.id,
      label: d.label,
    })),
    { kind: "wallet", id: "wallet", label: "Linked wallet (as USDC)" },
  ];
  const [to, setTo] = useState(options[0].id);
  const [reason, setReason] = useState<(typeof CLOSE_REASONS)[number]>(
    CLOSE_REASONS[0],
  );
  const has = a.balance > 0;
  const fmt = (v: number) =>
    `${SYMBOL[a.currency]}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={onCancel}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-title"
        className="orbit-pop relative w-[460px] max-w-full rounded-2xl border border-white/10 bg-raised p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="close-title" className="text-[17px] font-medium text-white">
              Close {a.label}?
            </h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              {a.customer.name} · {a.bank} ••{a.accountNumber.slice(-4)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={onCancel}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* What's in it, and where it goes */}
        <div className="mt-6 flex items-baseline justify-between border-y border-white/8 py-3">
          <span className="text-[13px] text-neutral-400">Balance</span>
          <span className="amount text-[15px] font-medium text-white tabular-nums">
            {fmt(a.balance)}
          </span>
        </div>
        {has && (
          <div className="mt-4">
            <div className="text-[12px] text-neutral-400">
              Move the balance to
            </div>
            <div className="mt-1.5">
              <Dropdown
                label="Move the balance to"
                value={to}
                options={options.map((o) => ({ value: o.id, label: o.label }))}
                onChange={setTo}
                className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
              />
            </div>
            <p className="mt-1.5 text-[12px] text-neutral-500">
              {to === "wallet"
                ? "Converted to USDC and sent to the account's linked wallet."
                : "Moved in full before the account closes."}
            </p>
          </div>
        )}

        {/* What stops */}
        <ul className="mt-5 space-y-1.5 text-[12.5px] leading-relaxed text-neutral-400">
          <li>
            ••{a.accountNumber.slice(-4)} stops accepting money. Anything sent
            to it later goes back to the sender.
          </li>
          <li>Statements and history stay available under Closed.</li>
          <li>
            This can&apos;t be undone — open a new account to use it again.
          </li>
        </ul>

        <div className="mt-5 text-[12px] text-neutral-400">Reason</div>
        <div className="mt-1.5">
          <Dropdown
            label="Reason"
            value={reason}
            options={CLOSE_REASONS.map((r) => ({ value: r, label: r }))}
            onChange={setReason}
            className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
          />
        </div>

        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full px-4 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
          >
            Keep account
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(has ? (options.find((o) => o.id === to) ?? null) : null)
            }
            className="h-9 rounded-full bg-rose-600 px-4 text-[13px] font-medium text-white hover:bg-rose-500"
          >
            {has ? `Move ${fmt(a.balance)} and close` : "Close account"}
          </button>
        </div>
      </div>
    </div>
  );
}
