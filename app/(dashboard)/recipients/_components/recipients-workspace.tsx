"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Ellipsis,
  EllipsisVertical,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { SEND_EVENT } from "@/app/_components/top-bar";
import { RecipientAvatar } from "./recipient-avatar";
import { SendMoneyFlow } from "./send-money";
import type { FundingSource } from "../../cards/_data";
import type {
  Rail,
  Recipient,
  RecipientPayment,
  RecipientStatus,
  VerificationStep,
} from "../_data";
import { dateFmt, fullDateFmt, timeFmt } from "../../cards/_lib/format";

type Tab = "All" | RecipientStatus;
const TABS: Tab[] = ["All", "Active", "Pending"];
const RAILS: ("All" | Rail)[] = ["All", "ACH Wire", "Swift", "Bank account"];
const PAGE_SIZES = [10, 25, 50];

/** Data snapshot time, so "last 30 days" agrees on server and client. */
const AS_OF = Date.UTC(2026, 9, 20, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
// Indicative rates into USD for the prototype's totals.
const TO_USD: Record<string, number> = { USD: 1, MAD: 1 / 9.18 };

const amount = (v: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(v);
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

const compact = (v: number) =>
  v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));

const lastPayment = (r: Recipient) =>
  r.payments.reduce<RecipientPayment | undefined>(
    (a, p) => (!a || p.date > a.date ? p : a),
    undefined,
  );
const totalPaid = (r: Recipient) =>
  r.payments
    .filter((p) => p.status === "Completed")
    .reduce((sum, p) => sum + p.amount, 0);
const inWindow = (iso: string, from: number, to: number) => {
  const t = Date.parse(iso);
  return t > from && t <= to;
};

export function RecipientsWorkspace({
  initialRecipients,
  sources,
}: {
  initialRecipients: Recipient[];
  sources: (FundingSource & { balance: number })[];
}) {
  // Local state until the Recipients API is wired up.
  const [list, setList] = useState(initialRecipients);
  const [tab, setTab] = useState<Tab>("All");
  const [currency, setCurrency] = useState("All");
  const [rail, setRail] = useState<"All" | Rail>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // null = closed; "" = open on the recipient picker; an id = open on that recipient's amount step.
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const open = () => setSending("");
    window.addEventListener(SEND_EVENT, open);
    return () => window.removeEventListener(SEND_EVENT, open);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ——— Facts ———
  const payments = list.flatMap((r) => r.payments.map((p) => ({ ...p, r })));
  const paidIn = (from: number, to: number) =>
    payments
      .filter((p) => p.status === "Completed" && inWindow(p.date, from, to))
      .reduce((s, p) => s + p.amount * (TO_USD[p.currency] ?? 1), 0);
  const paidNow = paidIn(AS_OF - 30 * DAY, AS_OF);
  const paidBefore = paidIn(AS_OF - 60 * DAY, AS_OF - 30 * DAY);
  const recent = payments.filter((p) =>
    inWindow(p.date, AS_OF - 30 * DAY, AS_OF),
  );
  const usdOf = (p: RecipientPayment) => p.amount * (TO_USD[p.currency] ?? 1);
  // Who the money went to this month, ranked.
  const top = [
    ...recent
      .filter((p) => p.status === "Completed")
      .reduce(
        (m, p) => m.set(p.r, (m.get(p.r) ?? 0) + usdOf(p)),
        new Map<Recipient, number>(),
      ),
  ]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 4);
  // Where it goes: one corridor per country, currency and rail.
  const corridors = [
    ...list
      .reduce((m, r) => {
        const key = `${r.country}|${r.currency}|${r.rail}`;
        const c = m.get(key) ?? {
          country: r.country,
          currency: r.currency,
          rail: r.rail,
          count: 0,
          paid: 0,
        };
        c.count += 1;
        c.paid += r.payments
          .filter((p) => p.status === "Completed")
          .reduce((t, p) => t + usdOf(p), 0);
        return m.set(key, c);
      }, new Map<string, { country: string; currency: string; rail: Rail; count: number; paid: number }>())
      .values(),
  ].sort((x, y) => y.paid - x.paid || y.count - x.count);
  // Everyone who can't be paid cleanly right now, with the reason.
  const attention = [
    ...list
      .filter((r) => lastPayment(r)?.status === "Failed")
      .map((r) => ({
        r,
        reason: `Last payment failed · ${lastPayment(r)!.reference}`,
        action: "Retry" as const,
      })),
    ...list
      .filter((r) => r.status === "Pending")
      .map((r) => ({
        r,
        reason:
          r.verification?.find((v) => v.state === "current")?.note ??
          "Verifying bank details",
        action: "Review" as const,
      })),
  ];

  // ——— Rows ———
  const q = query.trim().toLowerCase();
  const scoped = list
    .filter((r) => currency === "All" || r.currency === currency)
    .filter((r) => rail === "All" || r.rail === rail)
    .filter(
      (r) =>
        !q ||
        [r.name, r.institution, r.account ?? "", r.id, r.email ?? ""].some(
          (v) => v.toLowerCase().includes(q),
        ),
    );
  // Most recently paid first; never-paid recipients follow, newest first.
  const rows = scoped
    .filter((r) => tab === "All" || r.status === tab)
    .sort((a, b) => {
      const la = lastPayment(a)?.date ?? "";
      const lb = lastPayment(b)?.date ?? "";
      return lb.localeCompare(la) || b.createdAt.localeCompare(a.createdAt);
    });
  const count = (t: Tab) =>
    scoped.filter((r) => t === "All" || r.status === t).length;
  const currencies = ["All", ...new Set(list.map((r) => r.currency))];
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * perPage, current * perPage);
  const reset = () => setPage(1);
  const sheet = list.find((r) => r.id === sheetId) ?? null;

  // ——— Selection ———
  const pageIds = visible.map((r) => r.id);
  const pageAll = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const pageSome = !pageAll && pageIds.some((id) => checked.has(id));
  const picked = list.filter((r) => checked.has(r.id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const archive = (ids: string[]) => {
    const names = list.filter((r) => ids.includes(r.id)).map((r) => r.name);
    setList((l) => l.filter((r) => !ids.includes(r.id)));
    setChecked(new Set());
    setOpenId(null);
    setToast(
      names.length === 1
        ? `${names[0]} archived`
        : `${names.length} recipients archived`,
    );
  };

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Recipients
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              The people and businesses you pay out to.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast("Add recipient flow is next")}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Add recipient
          </button>
        </div>

        {/* Who you pay, where it goes, and who's blocked */}
        <div className="mt-10 grid gap-3 lg:grid-cols-[1.25fr_1fr_1fr]">
          <Panel
            title="Paid out · 30 days"
            meta={
              paidBefore > 0 ? (
                <span
                  className={
                    paidNow >= paidBefore
                      ? "text-[var(--flow-in)]"
                      : "text-neutral-400"
                  }
                >
                  {paidNow >= paidBefore ? "↑" : "↓"}{" "}
                  {compact(Math.abs(paidNow - paidBefore))}
                  <span className="text-neutral-500"> vs prev</span>
                </span>
              ) : undefined
            }
          >
            <div className="amount text-[30px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
              <Roll value={usd(paidNow).split(".")[0]} />
              <sup className="ml-px align-[0.55em] text-[0.5em] font-normal tracking-normal text-neutral-500">
                <Roll value={`.${usd(paidNow).split(".")[1]}`} />
              </sup>
              <span className="ml-1.5 text-[12px] font-normal tracking-normal text-neutral-500">
                USD eq.
              </span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {top.map(([r, v], i) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSheetId(r.id)}
                    className="group flex w-full items-center gap-2.5 text-left"
                  >
                    <RecipientAvatar recipient={r} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate text-neutral-200 group-hover:text-white">
                          {r.name}
                        </span>
                        <span className="amount shrink-0 text-neutral-400 tabular-nums">
                          {compact(v)}
                        </span>
                      </span>
                      <span className="mt-1 block h-1 rounded-full bg-white/[0.06]">
                        <span
                          className={`block h-full rounded-full ${i === 0 ? "bg-[var(--flow-in)]" : "bg-white/30"}`}
                          style={{
                            width: `${Math.max(4, (v / (top[0]?.[1] || 1)) * 100)}%`,
                          }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {top.length === 0 && (
                <li className="text-[13px] text-neutral-500">
                  Nothing paid out this month.
                </li>
              )}
            </ul>
          </Panel>

          <Panel
            title="Corridors"
            meta={
              <span className="text-neutral-500 tabular-nums">
                {corridors.length}
              </span>
            }
          >
            <ul className="-mx-2">
              {corridors.slice(0, 5).map((c) => (
                <li key={`${c.country}${c.currency}${c.rail}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrency(c.currency);
                      setRail(c.rail);
                      reset();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <Flag country={c.country} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-neutral-100">
                        {c.country}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-500">
                        {c.currency} · {c.rail}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className="amount block text-[13px] text-neutral-200">
                        {c.paid ? compact(c.paid) : "—"}
                      </span>
                      <span className="block text-[11px] text-neutral-500">
                        {c.count} {c.count === 1 ? "recipient" : "recipients"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Needs attention"
            meta={
              attention.length ? (
                <span className="rounded-full bg-white/[0.08] px-1.5 py-px text-[11px] text-neutral-200 tabular-nums">
                  {attention.length}
                </span>
              ) : undefined
            }
          >
            <ul className="-mx-2">
              {attention.map(({ r, reason, action }) => (
                <li
                  key={`${r.id}${action}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2"
                >
                  <RecipientAvatar recipient={r} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-neutral-100">
                      {r.name}
                    </span>
                    <span
                      title={reason}
                      className={`block truncate text-[11px] ${action === "Retry" ? "text-rose-300" : "text-neutral-500"}`}
                    >
                      {reason}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      action === "Retry" ? setSending(r.id) : setSheetId(r.id)
                    }
                    className="h-7 shrink-0 rounded-full border border-white/12 px-2.5 text-xs text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
                  >
                    {action}
                  </button>
                </li>
              ))}
              {attention.length === 0 && (
                <li className="px-2 py-2 text-[13px] text-neutral-500">
                  Everyone can be paid.
                </li>
              )}
            </ul>
          </Panel>
        </div>

        {/* Tabs + tools */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  reset();
                }}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                  tab === t
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                }`}
              >
                {t}
                <span
                  className={`text-xs tabular-nums ${tab === t ? "text-neutral-400" : "text-neutral-600"}`}
                >
                  <Roll value={String(count(t))} />
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Currency"
              value={currency}
              active={currency !== "All"}
              align="right"
              options={currencies.map((c) => ({
                value: c,
                label: c === "All" ? "All currencies" : c,
              }))}
              onChange={(v) => {
                setCurrency(v);
                reset();
              }}
            />
            <Dropdown
              label="Rail"
              value={rail}
              active={rail !== "All"}
              align="right"
              options={RAILS.map((r) => ({
                value: r,
                label: r === "All" ? "All rails" : r,
              }))}
              onChange={(v) => {
                setRail(v);
                reset();
              }}
            />
            <label className="flex h-9 w-[240px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  reset();
                }}
                placeholder="Name, bank, account or ID…"
                aria-label="Search recipients"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                exportCsv(rows);
                setToast(`${rows.length} recipients exported`);
              }}
              className="ml-1 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={14} strokeWidth={1.75} />
              Export {rows.length}
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-[230px]" />
            <col className="w-[170px]" />
            <col className="w-[120px]" />
            <col className="w-[104px]" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-4 font-normal">
                <Checkbox
                  checked={pageAll}
                  mixed={pageSome}
                  label={
                    pageAll
                      ? "Deselect all on this page"
                      : "Select all on this page"
                  }
                  onChange={() =>
                    setChecked((prev) => {
                      const next = new Set(prev);
                      for (const id of pageIds) {
                        if (pageAll) next.delete(id);
                        else next.add(id);
                      }
                      return next;
                    })
                  }
                />
              </th>
              <th className="py-2.5 font-normal">Recipient</th>
              <th className="py-2.5 font-normal">Bank</th>
              <th className="py-2.5 pr-8 text-right font-normal">
                Paid to date
              </th>
              <th className="py-2.5 font-normal">Status</th>
              <th className="py-2.5 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const open = openId === r.id;
              const last = lastPayment(r);
              const total = totalPaid(r);
              const pending = r.status === "Pending";
              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : r.id)}
                    aria-expanded={open}
                    className={`group cursor-pointer border-t border-white/6 transition-colors ${
                      open || checked.has(r.id)
                        ? "bg-white/[0.04]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <td
                      className="py-3 pl-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={checked.has(r.id)}
                        onChange={() => toggle(r.id)}
                        label={`Select ${r.name}`}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <RecipientAvatar recipient={r} size={30} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">
                            {r.name}
                          </div>
                          <div className="flex items-center gap-1 truncate text-[11px] text-neutral-500">
                            <span aria-hidden>{FLAGS[r.country]}</span>
                            {r.kind} · {r.country}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="truncate text-neutral-200">
                        {r.institution}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500 tabular-nums">
                        {r.account
                          ? `••${r.account.slice(-4)}`
                          : "No account yet"}{" "}
                        · {r.currency} {r.rail}
                      </div>
                    </td>
                    <td className="amount py-3 pr-8 text-right tabular-nums">
                      <div
                        className={
                          total ? "font-medium text-white" : "text-neutral-600"
                        }
                      >
                        {total ? amount(total, r.currency) : "—"}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {last ? (
                          <>
                            {last.status === "Failed" && (
                              <span className="text-rose-300">Failed · </span>
                            )}
                            {last.status === "Processing" && (
                              <span className="text-neutral-300">
                                Sending ·{" "}
                              </span>
                            )}
                            {dateFmt.format(new Date(last.date))}
                          </>
                        ) : (
                          "Never paid"
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <Status status={r.status} />
                    </td>
                    <td
                      className="py-3 pr-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {!pending && (
                          <button
                            type="button"
                            onClick={() => setSending(r.id)}
                            className="h-7 rounded-full bg-white px-3 text-xs font-medium text-black opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            Pay
                          </button>
                        )}
                        <RowMenu
                          recipient={r}
                          onPay={() => setSending(r.id)}
                          onEdit={() => setToast("Edit recipient flow is next")}
                          onCopyId={() => {
                            navigator.clipboard
                              ?.writeText(r.id)
                              .catch(() => {});
                            setToast("Recipient ID copied");
                          }}
                          onArchive={() => archive([r.id])}
                        />
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-white/[0.04]">
                      <td colSpan={6} className="px-4 pb-4">
                        <Preview
                          recipient={r}
                          onClose={() => setOpenId(null)}
                          onPay={() => setSending(r.id)}
                          onViewAll={() => setSheetId(r.id)}
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
                  colSpan={6}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  No recipients match.
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

      {/* Bulk actions */}
      {checked.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="theme-lock-dark orbit-pop fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[#0b0b0c] py-1.5 pr-1.5 pl-4 text-[13px] text-white shadow-[0_20px_60px_-12px_rgb(0_0_0/0.6)]"
        >
          <span className="mr-2 tabular-nums">{checked.size} selected</span>
          <BulkButton
            icon={Download}
            label="Export"
            onClick={() => {
              exportCsv(picked);
              setToast(`${picked.length} recipients exported`);
            }}
          />
          <BulkButton
            icon={Archive}
            label="Archive"
            onClick={() => archive(picked.map((r) => r.id))}
          />
          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setChecked(new Set())}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {sheet && (
        <RecipientDrawer
          recipient={sheet}
          onClose={() => setSheetId(null)}
          onPay={() => {
            setSheetId(null);
            setSending(sheet.id);
          }}
          onArchive={() => {
            setSheetId(null);
            archive([sheet.id]);
          }}
        />
      )}

      {sending !== null && (
        <SendMoneyFlow
          recipients={list}
          sources={sources}
          initialRecipientId={sending || undefined}
          onClose={() => setSending(null)}
          onSent={({ recipientId, amount: value, source, reference }) => {
            const payment: RecipientPayment = {
              id: `pay_${Date.now().toString(36)}`,
              amount: value,
              currency:
                list.find((r) => r.id === recipientId)?.currency ?? "USD",
              date: new Date().toISOString(),
              status: "Processing",
              source,
              reference,
            };
            setList((l) =>
              l.map((r) =>
                r.id === recipientId
                  ? { ...r, payments: [payment, ...r.payments] }
                  : r,
              ),
            );
          }}
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

/** Same chip system as Transactions: soft green when good, dashed while waiting. */
function Status({ status }: { status: RecipientStatus }) {
  const tone =
    status === "Active"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : "border-dashed border-white/20 text-neutral-300";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium ${tone}`}
    >
      {status}
    </span>
  );
}

/** The few facts people open a row for; everything else is in the side sheet. */
function Preview({
  recipient: r,
  onClose,
  onPay,
  onViewAll,
}: {
  recipient: Recipient;
  onClose: () => void;
  onPay: () => void;
  onViewAll: () => void;
}) {
  const pending = r.status === "Pending";
  const sent = r.payments.filter((p) => p.status === "Completed");
  const last = lastPayment(r);
  const step = r.verification?.find((s) => s.state === "current");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="orbit-pop rounded-xl border border-white/8 bg-surface">
      <div className="grid gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_1fr_1.2fr]">
        <Fact2 label="Recipient ID" value={r.id} mono copy />
        <Fact2
          label={r.rail === "Swift" ? "IBAN / Account" : "Account number"}
          value={r.account ?? "Not provided"}
          mono={!!r.account}
          copy={!!r.account}
        />
        {r.routing ? (
          <Fact2 label={r.routing.label} value={r.routing.value} mono copy />
        ) : (
          <Fact2 label="Rail" value={r.rail} />
        )}
        <Fact2 label="Email" value={r.email ?? "—"} copy={!!r.email} />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-2.5">
        <span className="truncate text-[12px] text-neutral-500">
          {pending && step
            ? `${step.label} · ${step.note ?? "In progress"}`
            : last
              ? `${sent.length} ${sent.length === 1 ? "payment" : "payments"} · last “${last.reference}” on ${fullDateFmt.format(new Date(last.date))}`
              : "Nothing sent to this recipient yet"}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!pending && (
            <button
              type="button"
              onClick={onPay}
              className="flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Pay
              <ArrowUpRight size={13} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onViewAll}
            className="flex h-8 items-center gap-1 rounded-full border border-white/12 pr-2.5 pl-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            View all details
            <ChevronRight size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact2({
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
          title={value}
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

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between gap-3 text-[13px]">
        <h2 className="text-neutral-400">{title}</h2>
        {meta && <span className="text-xs tabular-nums">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

const FLAGS: Record<string, string> = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Nigeria: "🇳🇬",
  Morocco: "🇲🇦",
  Luxembourg: "🇱🇺",
};

/** Country flag in a small round frame; falls back to the country's initial. */
function Flag({ country, size = 26 }: { country: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
    >
      {FLAGS[country] ?? country[0]}
    </span>
  );
}

function Checkbox({
  checked,
  mixed = false,
  onChange,
  label,
}: {
  checked: boolean;
  mixed?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors ${
        checked || mixed
          ? "border-white bg-white text-black"
          : "border-white/25 hover:border-white/50"
      }`}
    >
      {checked ? (
        <Check size={11} strokeWidth={3} />
      ) : mixed ? (
        <span className="h-[2px] w-2 rounded-full bg-black" />
      ) : null}
    </button>
  );
}

function BulkButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-full px-3 text-neutral-200 transition-colors hover:bg-white/8 hover:text-white"
    >
      <Icon size={13} strokeWidth={1.75} />
      {label}
    </button>
  );
}

function RowMenu({
  recipient: r,
  onPay,
  onEdit,
  onCopyId,
  onArchive,
}: {
  recipient: Recipient;
  onPay: () => void;
  onEdit: () => void;
  onCopyId: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const items = [
    ...(r.status === "Active"
      ? [{ label: "Send payment", icon: ArrowUpRight, onClick: onPay }]
      : []),
    { label: "Edit details", icon: Pencil, onClick: onEdit },
    { label: "Copy recipient ID", icon: Copy, onClick: onCopyId },
  ];
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/8 hover:text-white ${
          open ? "bg-white/8 text-white" : "text-neutral-500"
        }`}
      >
        <EllipsisVertical size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-52 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={run(item.onClick)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-200 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <item.icon
                size={14}
                strokeWidth={1.75}
                className="text-neutral-400"
              />
              {item.label}
            </button>
          ))}
          <div className="mt-1 border-t border-white/8 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={run(onArchive)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Archive size={14} strokeWidth={1.75} />
              Archive
            </button>
          </div>
        </div>
      )}
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

function exportCsv(rows: Recipient[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "Recipient ID",
    "Name",
    "Kind",
    "Country",
    "Bank",
    "Account",
    "Currency",
    "Rail",
    "Status",
    "Paid to date",
  ];
  const lines = rows.map((r) =>
    [
      r.id,
      esc(r.name),
      r.kind,
      esc(r.country),
      esc(r.institution),
      r.account ?? "",
      r.currency,
      r.rail,
      r.status,
      totalPaid(r).toFixed(2),
    ].join(","),
  );
  const url = URL.createObjectURL(
    new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "recipients.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function RecipientDrawer({
  recipient: r,
  onClose,
  onPay,
  onArchive,
}: {
  recipient: Recipient;
  onClose: () => void;
  onPay: () => void;
  onArchive: () => void;
}) {
  const pending = r.status === "Pending";
  const sent = r.payments.filter((p) => p.status === "Completed");
  const totalSent = sent.reduce((sum, p) => sum + p.amount, 0);
  const lastPaid = r.payments[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
        aria-label={`${r.name} recipient details`}
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[400px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        {/* Header */}
        <div className="flex items-center justify-end gap-1 px-4 pt-4">
          <IconButton label="More actions">
            <Ellipsis size={16} strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </IconButton>
        </div>

        {/* Identity + primary action */}
        <div className="px-6 pt-1">
          <RecipientAvatar recipient={r} size={44} />
          <h2 className="mt-4 text-[20px] font-medium tracking-[-0.015em] text-white">
            {r.name}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-[13px] text-neutral-500">
            {r.kind} · {r.country}
            <Status status={r.status} />
          </p>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onPay}
              title={
                pending ? "Available once verification is complete" : undefined
              }
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
            >
              Send payment
              <ArrowUpRight size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-4 text-[13px] text-neutral-200 transition-colors hover:border-white/30"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Edit
            </button>
          </div>
        </div>

        {/* Pending: why it can't be paid yet. Active: how much has gone to them. */}
        {pending && r.verification ? (
          <Section title="Verification" className="mt-6">
            <Stepper steps={r.verification} />
          </Section>
        ) : (
          <Section title="Paid to date" className="mt-6">
            <div className="text-[26px] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
              <Roll value={amount(totalSent, r.currency)} />
            </div>
            <p className="mt-2 text-xs text-neutral-500 tabular-nums">
              {sent.length === 0
                ? "No payments yet"
                : `${sent.length} ${sent.length === 1 ? "payment" : "payments"} · last on ${fullDateFmt.format(new Date(lastPaid.date))}`}
            </p>
          </Section>
        )}

        {/* Bank details */}
        <Section title="Bank details" flush>
          <DetailRow label="Account name" value={r.name} />
          <DetailRow label="Bank" value={r.institution} />
          <DetailRow
            label={r.rail === "Swift" ? "IBAN / Account" : "Account number"}
            value={r.account ?? "Not provided"}
            copy={!!r.account}
            mono
          />
          {r.routing && (
            <DetailRow
              label={r.routing.label}
              value={r.routing.value}
              copy
              mono
            />
          )}
          <DetailRow
            label="Currency · Rail"
            value={`${r.currency} · ${r.rail}`}
          />
        </Section>

        {/* Payments */}
        {!pending && (
          <Section
            title="Payments"
            action={r.payments.length ? "View all" : undefined}
            flush
          >
            {r.payments.length === 0 && (
              <p className="py-2 text-[13px] text-neutral-500">
                Nothing sent to this recipient yet.
              </p>
            )}
            {r.payments.slice(0, 5).map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </Section>
        )}

        {/* Details */}
        <Section title="Details" flush>
          <DetailRow label="Recipient ID" value={r.id} copy mono />
          {r.email && <DetailRow label="Email" value={r.email} copy />}
          <DetailRow
            label="Added"
            value={`${fullDateFmt.format(new Date(r.createdAt))}, ${timeFmt.format(new Date(r.createdAt))} UTC`}
          />
        </Section>

        <div className="mx-6 border-t border-white/7 pt-4 pb-6">
          <button
            type="button"
            onClick={onArchive}
            className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-neutral-400 transition-colors hover:bg-white/4 hover:text-white"
          >
            <Archive size={14} strokeWidth={1.75} />
            Archive recipient
          </button>
        </div>
      </aside>
    </>
  );
}

function Stepper({ steps }: { steps: VerificationStep[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={`absolute top-5 bottom-0 left-[9px] w-px ${s.state === "done" ? "bg-white/30" : "bg-white/8"}`}
            />
          )}
          <span
            aria-hidden
            className={`relative z-10 mt-px flex size-[19px] shrink-0 items-center justify-center rounded-full ${
              s.state === "done"
                ? "bg-white text-black"
                : s.state === "current"
                  ? "border border-white/60 bg-surface-2"
                  : "border border-white/12 bg-surface-2"
            }`}
          >
            {s.state === "done" && <Check size={11} strokeWidth={3} />}
          </span>
          <div className="min-w-0">
            <div
              className={`text-[13px] ${s.state === "upcoming" ? "text-neutral-500" : "text-white"}`}
            >
              {s.label}
              {s.state === "current" && (
                <span className="ml-2 text-xs text-neutral-500">
                  In progress
                </span>
              )}
            </div>
            {s.note && (
              <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                {s.note}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function PaymentRow({ payment: p }: { payment: RecipientPayment }) {
  const d = new Date(p.date);
  const failed = p.status === "Failed";
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-neutral-100">
          {p.reference}
        </span>
        <span className="block truncate text-xs text-neutral-500 tabular-nums">
          {dateFmt.format(d)} · {p.source}
          {p.status === "Processing" && (
            <span className="text-neutral-300"> · Processing</span>
          )}
          {failed && (
            <span className="font-medium text-neutral-300"> · Failed</span>
          )}
        </span>
      </span>
      <span
        className={`text-[13px] tabular-nums ${failed ? "text-neutral-600 line-through" : "text-neutral-100"}`}
      >
        {amount(p.amount, p.currency)}
      </span>
    </div>
  );
}

function Section({
  title,
  action,
  flush = false,
  className = "",
  children,
}: {
  title: string;
  action?: string;
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mx-6 border-t border-white/7 pt-5 pb-5 ${className}`}>
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

function DetailRow({
  label,
  value,
  copy = false,
  mono = false,
}: {
  label: string;
  value: string;
  copy?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="w-28 shrink-0 text-xs text-neutral-500">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-neutral-200 ${mono ? "font-mono text-[12px]" : "text-[13px]"}`}
      >
        {value}
      </span>
      {copy && (
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      )}
    </div>
  );
}
