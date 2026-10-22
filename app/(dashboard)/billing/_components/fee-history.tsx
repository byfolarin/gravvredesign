"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { TablePager, usePager } from "@/app/_components/table-pager";
import {
  FEE_TYPES,
  typeOf,
  type Fee,
  type FeeStatus,
  type FeeTypeId,
} from "../_data";
import { Money, usd } from "./billing-overview";

type Tab = "All" | FeeStatus;
const TABS: Tab[] = ["All", "Taken", "To invoice", "Not charged"];
const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
const monthKey = (iso: string) => iso.slice(0, 7);
const short = (s: string) => `${s.slice(0, 8)}…`;

/** Every fee Gravv charged, a month at a time. "Not charged" is explained, not just flagged. */
export function FeeHistory({ fees }: { fees: Fee[] }) {
  const months = [...new Set(fees.map((f) => monthKey(f.createdAt)))]
    .sort()
    .reverse();
  const params = useSearchParams();
  const router = useRouter();
  const [month, setMonth] = useState(months[0]);
  const [tab, setTab] = useState<Tab>("All");
  const [type, setType] = useState<"All" | FeeTypeId>("All");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  // Arriving from Billing with ?type=… narrows to that fee.
  const fromLink = params.get("type") as FeeTypeId | null;
  useEffect(() => {
    if (!fromLink) return;
    const t = setTimeout(() => {
      setType(fromLink);
      router.replace("/billing/history", { scroll: false });
    }, 0);
    return () => clearTimeout(t);
  }, [fromLink, router]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const inMonth = fees.filter((f) => monthKey(f.createdAt) === month);
  const q = query.trim().toLowerCase();
  const scoped = inMonth
    .filter((f) => type === "All" || f.type === type)
    .filter((f) => !q || f.id.includes(q) || f.txnId.includes(q));
  const rows = scoped.filter((f) => tab === "All" || f.status === tab);
  const pager = usePager(rows, "fee-history");
  const sum = (s: FeeStatus) =>
    inMonth.filter((f) => f.status === s).reduce((t, f) => t + f.amount, 0);
  const notCharged = inMonth.filter((f) => f.status === "Not charged");
  const at = months.indexOf(month);
  const go = (i: number) => {
    setMonth(months[i]);
    pager.setPage(1);
  };

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max-narrow) px-8 pt-12 pb-24">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Fee history
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Every fee Gravv charged, and the transaction it came from.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              exportCsv(inMonth, month);
              setToast(
                `${monthFmt.format(new Date(`${month}-01T00:00:00Z`))} statement downloaded`,
              );
            }}
            className="flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            <Download size={14} strokeWidth={1.75} />
            Download statement
          </button>
        </div>

        {/* Month, then what it came to */}
        <div className="mt-10 flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            disabled={at >= months.length - 1}
            onClick={() => go(at + 1)}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/8 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <span className="min-w-[150px] text-center text-[15px] font-medium text-white">
            {monthFmt.format(new Date(`${month}-01T00:00:00Z`))}
          </span>
          <button
            type="button"
            aria-label="Next month"
            disabled={at <= 0}
            onClick={() => go(at - 1)}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/8 hover:text-white disabled:opacity-30"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
        <p className="mt-3 max-w-[720px] text-[14px] leading-relaxed text-neutral-400">
          <span className="text-[22px] font-medium tracking-[-0.02em] text-white">
            <Money value={sum("Taken") + sum("To invoice")} />
          </span>{" "}
          in fees across {inMonth.length - notCharged.length} transactions —{" "}
          <span className="amount text-neutral-200">${usd(sum("Taken"))}</span>{" "}
          taken as they happened
          {sum("To invoice") > 0 && (
            <>
              ,{" "}
              <span className="amount text-neutral-200">
                ${usd(sum("To invoice"))}
              </span>{" "}
              on the next invoice
            </>
          )}
          .{" "}
          {notCharged.length > 0 &&
            `${notCharged.length} more weren't charged because their transactions failed.`}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  pager.setPage(1);
                }}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${tab === t ? "bg-white/[0.08] font-medium text-white" : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"}`}
              >
                {t}
                <span
                  className={`text-xs tabular-nums ${tab === t ? "text-neutral-400" : "text-neutral-600"}`}
                >
                  {scoped.filter((f) => t === "All" || f.status === t).length}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Fee"
              value={type}
              active={type !== "All"}
              align="right"
              options={[
                { value: "All" as const, label: "All fees" },
                ...FEE_TYPES.map((t) => ({ value: t.id, label: t.label })),
              ]}
              onChange={(v) => {
                setType(v);
                pager.setPage(1);
              }}
            />
            <label className="flex h-9 w-[240px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 focus-within:border-white/35">
              <Search
                size={14}
                strokeWidth={1.75}
                className="text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  pager.setPage(1);
                }}
                placeholder="Fee or transaction ID…"
                aria-label="Search fees"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
          </div>
        </div>

        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-[110px]" />
            <col />
            <col className="w-[190px]" />
            <col className="w-[120px]" />
            <col className="w-[230px]" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 font-normal">Date</th>
              <th className="py-2.5 font-normal">Fee</th>
              <th className="py-2.5 font-normal">Transaction</th>
              <th className="py-2.5 pr-6 text-right font-normal">Fee</th>
              <th className="py-2.5 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {pager.visible.map((f) => {
              const t = typeOf(f.type);
              const off = f.status === "Not charged";
              return (
                <tr key={f.id} className="group border-t border-white/6">
                  <td className="py-3 tabular-nums">
                    <div className="text-neutral-200">
                      {dayFmt.format(new Date(f.createdAt))}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {timeFmt.format(new Date(f.createdAt))}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="truncate text-neutral-100">{t.label}</div>
                    <div className="truncate text-[11px] text-neutral-500">
                      {f.base ? (
                        <>
                          on <span className="amount">${usd(f.base)}</span>{" "}
                          ·{" "}
                        </>
                      ) : null}
                      <span className="font-mono">{short(f.id)}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <span className="flex items-center gap-0.5">
                      <span className="font-mono text-[12px] text-neutral-300">
                        {f.txnId}
                      </span>
                      <span className="opacity-0 transition-opacity group-hover:opacity-100">
                        <CopyButton
                          value={f.txnId}
                          label="Copy transaction ID"
                        />
                      </span>
                    </span>
                  </td>
                  <td
                    className={`py-3 pr-6 text-right ${off ? "text-neutral-600 line-through decoration-neutral-700" : "text-white"}`}
                  >
                    <Money value={f.amount} />
                  </td>
                  <td className="py-3 text-[12.5px]">
                    {f.status === "Taken" ? (
                      <span className="text-neutral-400">Taken instantly</span>
                    ) : f.status === "To invoice" ? (
                      <span className="text-neutral-200">
                        On the next invoice
                      </span>
                    ) : (
                      <span className="text-neutral-500">
                        Not charged — transaction failed
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  No fees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <TablePager pager={pager} noun="fees" className="" />
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function exportCsv(rows: Fee[], month: string) {
  const head = [
    "Date",
    "Fee ID",
    "Fee",
    "Gravv fee type",
    "Transaction",
    "Transaction amount (USD)",
    "Fee (USD)",
    "Status",
  ];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    head,
    ...rows.map((f) => [
      f.createdAt,
      f.id,
      typeOf(f.type).label,
      typeOf(f.type).system,
      f.txnId,
      f.base,
      f.amount,
      f.status,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `gravv-fees-${month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
