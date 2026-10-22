"use client";

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CopyPlus,
  Download,
  Pause,
  Pencil,
  Play,
  QrCode,
  Plus,
  Search,
  SlidersHorizontal,
  X,
  ExternalLink,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { UpdateNotice } from "@/app/_components/updates";
import {
  BucketBars,
  bucketStarts,
  readOpen,
  writeOpen,
} from "@/app/_components/bucket-bars";
import { CheckoutCustomizer } from "./checkout-customizer";
import {
  AS_OF,
  LINK_HOST,
  type LinkStatus,
  type Method,
  type PaymentLink,
} from "../_data";
import { linkStore, useLinks } from "../_store";

type StatusFilter = "All" | LinkStatus;
const DAY = 24 * 60 * 60 * 1000;
// Indicative rates into USD for the prototype's totals.
const TO_USD: Record<PaymentLink["currency"], number> = {
  USD: 1,
  USDC: 1,
  NGN: 1 / 1600,
};

export const fmt = (v: number, currency: PaymentLink["currency"]) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: currency === "NGN" ? 0 : 2,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
  }).format(v);
export const symbol = (c: PaymentLink["currency"]) =>
  c === "USD" ? "$" : c === "NGN" ? "₦" : "";
export const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const longDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export const url = (l: Pick<PaymentLink, "slug">) =>
  `https://${LINK_HOST}/${l.slug}`;
export const paidOf = (l: PaymentLink) =>
  l.payments.filter((p) => p.status === "Paid");
export const collected = (l: PaymentLink) =>
  paidOf(l).reduce((s, p) => s + p.amount, 0);
const ago = (iso: string) => {
  const d = Math.round((AS_OF - Date.parse(iso)) / DAY);
  return d <= 0
    ? "Today"
    : d === 1
      ? "Yesterday"
      : d < 30
        ? `${d} days ago`
        : `${Math.round(d / 30)} mo ago`;
};
const compact = (v: number) =>
  v >= 1000 ? `${Number((v / 1000).toFixed(1))}k` : String(Math.round(v));
const usd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
export const daysLeft = (iso: string) =>
  Math.ceil((Date.parse(iso) - AS_OF) / DAY);

/** Money with Mercury-style superscript cents. */
export function Money({
  value,
  currency,
  className = "",
}: {
  value: number;
  currency: PaymentLink["currency"];
  className?: string;
}) {
  const [whole, cents] = fmt(value, currency).split(".");
  return (
    <span className={`tabular-nums ${className}`}>
      {symbol(currency)}
      {whole}
      {cents && (
        <sub className="ml-px align-baseline text-[0.62em]">{cents}</sub>
      )}
      {currency === "USDC" && (
        <span className="ml-1 text-[0.75em] text-neutral-500">USDC</span>
      )}
    </span>
  );
}

export function LinksWorkspace() {
  // Session store until the Payment Links API is wired up (shared with the link page).
  const list = useLinks();
  const setList = linkStore.set;
  const [status, setStatus] = useState<StatusFilter>("All");
  const [currency, setCurrency] = useState("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PaymentLink | null>(null);
  // Arriving from Customers → "Create link": open the flow with that customer already chosen.
  const [prefill, setPrefill] = useState<Customer | undefined>();
  const openFor = useCallback((c: Customer) => {
    setPrefill(c);
    setCreating(true);
  }, []);
  const [customizing, setCustomizing] = useState(false);
  // A feature notice on the page it belongs to: once, dismissible.

  const [toast, setToast] = useState<string | null>(null);
  // Set alongside a toast when the change can be taken back.
  const [undo, setUndo] = useState<(() => void) | null>(null);
  const [extending, setExtending] = useState(false);
  const [period, setPeriod] = useState<30 | 90>(90);
  // A day or week picked on the chart narrows the table to links paid in it.
  const [bucket, setBucket] = useState<{ start: number; size: number } | null>(
    null,
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(
      () => {
        setToast(null);
        setUndo(null);
      },
      undo ? 6000 : 3200,
    );
    return () => clearTimeout(t);
  }, [toast, undo]);

  const update = linkStore.update;
  const copy = (text: string, what = "Link copied") => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setToast(what);
  };

  // ——— Three facts ———
  const paidUsd = (from: number, to: number) =>
    list.flatMap((l) =>
      paidOf(l)
        .filter((p) => {
          const t = Date.parse(p.date);
          return t > from && t <= to;
        })
        .map((p) => ({
          l,
          usd: p.amount * TO_USD[l.currency],
          t: Date.parse(p.date),
        })),
    );
  const recent = paidUsd(AS_OF - 30 * DAY, AS_OF);
  const collectedNow = recent.reduce((s, p) => s + p.usd, 0);
  const collectedBefore = paidUsd(AS_OF - 60 * DAY, AS_OF - 30 * DAY).reduce(
    (s, p) => s + p.usd,
    0,
  );
  const largest = [
    ...recent.reduce(
      (m, p) => m.set(p.l, (m.get(p.l) ?? 0) + p.usd),
      new Map<PaymentLink, number>(),
    ),
  ].sort((x, y) => y[1] - x[1])[0]?.[0];
  const live = list.filter((l) => l.status === "Active");
  const pausedCount = list.filter((l) => l.status === "Paused").length;
  const expiredCount = list.filter((l) => l.status === "Expired").length;
  const ending = live
    .filter((l) => l.expiresAt && daysLeft(l.expiresAt) <= 14)
    .sort((x, y) => Date.parse(x.expiresAt!) - Date.parse(y.expiresAt!));
  const next = ending[0];

  const q = query.trim().toLowerCase();
  // Search and currency scope everything; the status tab narrows the table (and counts follow the scope).
  const scoped = list
    .filter((l) => currency === "All" || l.currency === currency)
    .filter(
      (l) =>
        !q ||
        [l.name, l.slug, l.id, l.description ?? ""].some((v) =>
          v.toLowerCase().includes(q),
        ),
    );
  const paidIn = (l: PaymentLink) =>
    !bucket ||
    paidOf(l).some((p) => {
      const t = Date.parse(p.date);
      return t >= bucket.start && t < bucket.start + bucket.size;
    });
  const rows = scoped
    .filter((l) => status === "All" || l.status === status)
    .filter(paidIn)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const count = (t: StatusFilter) =>
    scoped.filter((l) => t === "All" || l.status === t).length;

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-center justify-between gap-6">
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            Payment links
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <SlidersHorizontal size={14} strokeWidth={1.75} />
              Customize checkout
            </button>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] pr-3.5 pl-3 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              <Plus size={14} strokeWidth={2} />
              Create link
            </button>
          </div>
        </div>

        <UpdateNotice
          id="u-checkout"
          place="inline"
          onAction={() => setCustomizing(true)}
        />

        {/* Three facts: label · number + one more figure · one line of context */}
        <div className="mt-8 grid gap-y-10 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Collected · 30 days"
            value={
              <span className="amount">
                <Roll value={usd(collectedNow).split(".")[0]} />
                <sub className="ml-px align-baseline text-[0.5em] font-normal tracking-normal text-neutral-500">
                  <Roll value={`.${usd(collectedNow).split(".")[1]}`} />
                </sub>
              </span>
            }
            aside={
              collectedBefore > 0 ? (
                <span
                  className={
                    collectedNow >= collectedBefore
                      ? "text-[var(--flow-in)]"
                      : "text-neutral-400"
                  }
                >
                  {collectedNow >= collectedBefore ? "+" : "−"}
                  {compact(Math.abs(collectedNow - collectedBefore))}
                  <span className="text-neutral-500"> 30d</span>
                </span>
              ) : null
            }
            footer={
              <>
                <span className="tabular-nums">
                  {recent.length} payments · USD equivalent
                </span>
                {largest && (
                  <button
                    type="button"
                    onClick={() => setOpenId(largest.id)}
                    className="truncate text-neutral-300 hover:text-white"
                  >
                    Top: {largest.name}
                  </button>
                )}
              </>
            }
          />
          <Fact
            label="Active links"
            value={
              <>
                <Roll value={String(live.length)} />
                <span className="ml-2 text-[15px] font-normal tracking-normal text-neutral-500">
                  of {list.length}
                </span>
              </>
            }
            aside={
              <span className="text-neutral-300">
                {Math.round((live.length / Math.max(1, list.length)) * 100)}%
              </span>
            }
            footer={
              <>
                <span className="tabular-nums">
                  {pausedCount} paused · {expiredCount} expired
                </span>
                {pausedCount + expiredCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setStatus(pausedCount ? "Paused" : "Expired")
                    }
                    className="flex items-center gap-0.5 text-neutral-200 transition-colors hover:text-white"
                  >
                    Show
                    <ChevronRight size={13} strokeWidth={1.75} />
                  </button>
                )}
              </>
            }
          />
          <Fact
            label="Ending soon · 14 days"
            value={<Roll value={String(ending.length)} />}
            aside={
              next ? (
                <span className="text-amber-300">
                  Next {dateFmt.format(new Date(next.expiresAt!))}
                </span>
              ) : null
            }
            footer={
              next ? (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenId(next.id)}
                    className="truncate text-left hover:text-white"
                  >
                    {next.name} · ends in {daysLeft(next.expiresAt!)} days
                  </button>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={extending}
                      onClick={() => setExtending((v) => !v)}
                      className="flex items-center gap-0.5 text-neutral-200 transition-colors hover:text-white"
                    >
                      Extend
                      <ChevronDown
                        size={13}
                        strokeWidth={1.75}
                        className={`transition-transform ${extending ? "rotate-180" : ""}`}
                      />
                    </button>
                    {extending && (
                      <ExtendPopover
                        links={ending}
                        onClose={() => setExtending(false)}
                        onExtend={(l, expiresAt) => {
                          const before = l;
                          update(l.id, {
                            expiresAt,
                            status: "Active",
                            edits: [
                              ...(l.edits ?? []),
                              {
                                at: new Date(AS_OF).toISOString(),
                                by: "Folarin Folarin",
                                changed: ["pay-by date"],
                              },
                            ],
                          });
                          setExtending(false);
                          setToast(
                            expiresAt
                              ? `${l.name} now ends ${longDate.format(new Date(expiresAt))}`
                              : `${l.name} no longer expires`,
                          );
                          setUndo(() => () => {
                            update(before.id, before);
                            setToast("Extension undone");
                            setUndo(null);
                          });
                        }}
                      />
                    )}
                  </div>
                </>
              ) : (
                <span>Nothing expires in the next two weeks</span>
              )
            }
          />
        </div>

        <CollectedChart
          list={list}
          period={period}
          onPeriod={(p) => {
            setPeriod(p);
            setBucket(null);
          }}
          selected={bucket?.start ?? null}
          onSelect={(start, size) =>
            setBucket(start === null ? null : { start, size })
          }
        />

        {bucket && (
          <div className="mt-6 flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-2.5 text-[13px]">
            <span className="text-neutral-300">
              Links paid {bucket.size > DAY ? "in the week of " : "on "}
              <span className="font-medium text-white">
                {dateFmt.format(new Date(bucket.start))}
              </span>
              <span className="text-neutral-500">
                {" "}
                · {rows.length} {rows.length === 1 ? "link" : "links"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setBucket(null)}
              className="flex items-center gap-1 text-neutral-400 hover:text-white"
            >
              <X size={13} strokeWidth={1.75} />
              Clear
            </button>
          </div>
        )}

        {/* Tabs + tools, same as Transactions and Wallets */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
            {(["All", "Active", "Paused", "Expired"] as StatusFilter[]).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={status === t}
                  onClick={() => setStatus(t)}
                  className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors ${
                    status === t
                      ? "bg-white/[0.08] font-medium text-white"
                      : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
                  }`}
                >
                  {t}
                  <span
                    className={`text-xs tabular-nums ${status === t ? "text-neutral-400" : "text-neutral-600"}`}
                  >
                    <Roll value={String(count(t))} />
                  </span>
                </button>
              ),
            )}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Currency"
              value={currency}
              active={currency !== "All"}
              align="right"
              options={["All", "USD", "USDC", "NGN"].map((c) => ({
                value: c,
                label: c === "All" ? "All currencies" : c,
              }))}
              onChange={setCurrency}
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
                placeholder="Name, link or ID…"
                aria-label="Search payment links"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                exportCsv(rows);
                setToast(`${rows.length} links exported`);
              }}
              className="ml-1 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={14} strokeWidth={1.75} />
              Export {rows.length}
            </button>
          </div>
        </div>

        {/* Table: a row opens in place; the full link page is behind "View all details" */}
        <div className="mt-3">
          <table className="w-full table-fixed border-t border-white/15 text-[13px]">
            <colgroup>
              <col className="w-[120px]" />
              <col className="w-[104px]" />
              <col />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[40px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
                <th className="py-2.5 pl-3 font-normal">Created</th>
                <th className="py-2.5 font-normal">Status</th>
                <th className="py-2.5 font-normal">Link</th>
                <th className="py-2.5 pr-6 text-right font-normal">Price</th>
                <th className="py-2.5 pr-3 text-right font-normal">
                  Collected
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const selected = l.id === openId;
                const ends =
                  l.status === "Active" && l.expiresAt
                    ? daysLeft(l.expiresAt)
                    : null;
                const n = paidOf(l).length;
                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => setOpenId(selected ? null : l.id)}
                      className={`cursor-pointer border-b border-white/6 transition-colors ${
                        selected ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <td className="py-3 pl-3">
                        <div className="text-neutral-100">
                          {dateFmt.format(new Date(l.createdAt))}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {ends !== null && ends <= 14
                            ? `Ends in ${ends} days`
                            : ago(l.createdAt)}
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge status={l.status} />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="truncate text-[13.5px] font-medium text-white">
                          {l.name}
                        </div>
                        <div className="truncate text-[11px] text-neutral-500">
                          {LINK_HOST}/{l.slug}
                        </div>
                      </td>
                      <td className="amount py-3 pr-6 text-right text-neutral-300">
                        {l.amount === null ? (
                          <span className="text-neutral-500">Any amount</span>
                        ) : (
                          <Money value={l.amount} currency={l.currency} />
                        )}
                      </td>
                      <td className="amount py-3 pr-3 text-right">
                        {n ? (
                          <Money
                            value={collected(l)}
                            currency={l.currency}
                            className="text-white"
                          />
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                        <div className="text-[11px] text-neutral-500 tabular-nums">
                          {n} {n === 1 ? "payment" : "payments"}
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <ChevronDown
                          size={15}
                          strokeWidth={1.75}
                          className={`ml-auto text-neutral-500 transition-transform ${selected ? "rotate-180" : ""}`}
                        />
                      </td>
                    </tr>
                    {selected && (
                      <tr className="border-b border-white/6 bg-white/[0.03]">
                        <td colSpan={6} className="px-3 pb-4">
                          <LinkPreview
                            link={l}
                            onCopy={() => copy(url(l))}
                            onEdit={() => setEditing(l)}
                            onToggle={() => {
                              const next =
                                l.status === "Paused" ? "Active" : "Paused";
                              update(l.id, { status: next });
                              setToast(
                                next === "Paused"
                                  ? "Link paused — it won't take payments"
                                  : "Link resumed",
                              );
                            }}
                            onDuplicate={() => {
                              const d: PaymentLink = {
                                ...l,
                                id: `plink_${Date.now().toString(36)}`,
                                name: `${l.name} (copy)`,
                                slug: `${l.slug}-copy`,
                                status: "Active",
                                createdAt: new Date(AS_OF).toISOString(),
                                expiresAt: undefined,
                                views: 0,
                                started: 0,
                                payments: [],
                              };
                              setList((all) => [d, ...all]);
                              setOpenId(d.id);
                              setToast("Link duplicated");
                            }}
                            onArchive={() => {
                              setList((all) =>
                                all.filter((x) => x.id !== l.id),
                              );
                              setOpenId(null);
                              setToast("Link archived");
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="py-16 text-center text-neutral-500"
                  >
                    No links match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {customizing && (
        <CheckoutCustomizer
          onClose={() => setCustomizing(false)}
          onSaved={() => setToast("Checkout updated — every link uses it now")}
        />
      )}

      <Suspense fallback={null}>
        <CreateFromUrl onOpen={openFor} />
      </Suspense>

      {creating && (
        <CreateFlow
          prefill={prefill}
          onClose={() => {
            setCreating(false);
            setPrefill(undefined);
          }}
          onCreated={(l) => {
            setList((all) => [l, ...all]);
            setOpenId(l.id);
          }}
          onCopy={(l) => copy(url(l))}
        />
      )}

      {editing && (
        <CreateFlow
          editing={editing}
          onClose={() => setEditing(null)}
          onCreated={() => {}}
          onSaved={(l) => {
            update(l.id, l);
            setToast("Link updated — the live link has the changes");
          }}
          onCopy={(l) => copy(url(l))}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-4 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
          {undo && (
            <button
              type="button"
              onClick={undo}
              className="font-medium text-[var(--flow-in)] hover:underline"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const CHART_KEY = "gravv-links-chart";
const utcDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Money collected through links per day or week (USD equivalent), one series. */
function CollectedChart({
  list,
  period,
  onPeriod,
  selected,
  onSelect,
}: {
  list: PaymentLink[];
  period: 30 | 90;
  onPeriod: (p: 30 | 90) => void;
  selected: number | null;
  onSelect: (start: number | null, size: number) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setOpen(readOpen(CHART_KEY)), 0);
    return () => clearTimeout(t);
  }, []);
  const { size, starts } = bucketStarts(AS_OF, period);
  const end = starts[starts.length - 1] + size;
  const paid = list.flatMap((l) =>
    paidOf(l).map((p) => ({
      link: l,
      t: Date.parse(p.date),
      usd: p.amount * TO_USD[l.currency],
    })),
  );
  const between = (a: number, b: number) =>
    paid.filter((p) => p.t >= a && p.t < b);
  const groups = starts.map((s) => between(s, s + size));
  const total = groups.flat().reduce((s, p) => s + p.usd, 0);
  const before = between(starts[0] - (end - starts[0]), starts[0]).reduce(
    (s, p) => s + p.usd,
    0,
  );
  const change = before ? ((total - before) / before) * 100 : 0;
  const count = groups.flat().length;
  const top = (ps: typeof paid) =>
    [
      ...ps.reduce(
        (m, p) => m.set(p.link, (m.get(p.link) ?? 0) + p.usd),
        new Map<PaymentLink, number>(),
      ),
    ]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  const leader = top(groups.flat())[0];
  const buckets = starts.map((start, i) => ({
    start,
    segments: [
      {
        value: groups[i].reduce((s, p) => s + p.usd, 0),
        className: "bg-[var(--flow-in)]",
      },
    ],
    label: `${utcDay.format(start)}: $${usd(groups[i].reduce((s, p) => s + p.usd, 0))} collected`,
  }));

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
          Collected
        </h2>
        <span className="amount text-[17px] font-medium tracking-[-0.01em] text-white tabular-nums">
          ${usd(total)}
        </span>
        {before > 0 && (
          <span
            className={`text-xs tabular-nums ${change >= 0 ? "text-[var(--flow-in)]" : "text-neutral-400"}`}
          >
            {change >= 0 ? "+" : "−"}
            {Math.abs(change).toFixed(0)}% vs previous {period} days
          </span>
        )}
        <span className="text-xs text-neutral-500 tabular-nums">
          {count} payments
          {leader ? ` · most from ${leader[0].name}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-2 self-center">
          {open && (
            <div
              role="radiogroup"
              aria-label="Period"
              className="flex rounded-full bg-white/[0.07] p-0.5"
            >
              {([30, 90] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={period === p}
                  onClick={() => onPeriod(p)}
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
          )}
          <button
            type="button"
            onClick={() => {
              writeOpen(CHART_KEY, !open);
              setOpen(!open);
            }}
            aria-expanded={open}
            className="flex h-8 items-center gap-1.5 rounded-full border border-white/10 px-3 text-[13px] text-neutral-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {open ? "Hide chart" : "Show chart"}
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>
      {open && (
        <div className="orbit-pop mt-6 rounded-2xl border border-white/5 bg-white/[0.015] px-6 pt-6 pb-5">
          <BucketBars
            buckets={buckets}
            format={(v) => (v ? `$${compact(v)}` : "0")}
            selected={selected}
            onSelect={(start) => onSelect(start, size)}
            average={{
              value: total / starts.length,
              label: `avg $${compact(total / starts.length)}/${size > DAY ? "week" : "day"}`,
            }}
            axis={[
              utcDay.format(starts[0]),
              utcDay.format(starts[Math.floor(starts.length / 2)]),
              size > DAY ? "This week" : "Today",
            ]}
            tooltip={(b, i) => (
              <>
                <div className="text-neutral-400">
                  {size > DAY
                    ? `Week of ${utcDay.format(b.start)}`
                    : utcDay.format(b.start)}
                </div>
                <div className="mt-1.5 flex justify-between font-medium text-white tabular-nums">
                  <span>Collected</span>
                  <span className="amount">${usd(b.segments[0].value)}</span>
                </div>
                {top(groups[i]).map(([l, v]) => (
                  <div
                    key={l.id}
                    className="mt-1 flex justify-between gap-3 text-neutral-400 tabular-nums"
                  >
                    <span className="truncate">{l.name}</span>
                    <span className="amount shrink-0">${compact(v)}</span>
                  </div>
                ))}
                {!groups[i].length && (
                  <div className="mt-1 text-neutral-500">No payments</div>
                )}
              </>
            )}
          />
        </div>
      )}
    </section>
  );
}

const EXTEND_BY = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "date", label: "Pick a date" },
  { value: "never", label: "No end date" },
] as const;
type ExtendBy = (typeof EXTEND_BY)[number]["value"];
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * Push back when a link stops taking payments. Extends from its current end (not today),
 * shows the new date before you commit, and covers every link ending soon, not just the next.
 */
function ExtendPopover({
  links,
  onExtend,
  onClose,
}: {
  links: PaymentLink[];
  onExtend: (l: PaymentLink, expiresAt: string | undefined) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [id, setId] = useState(links[0].id);
  const [by, setBy] = useState<ExtendBy>("30");
  const l = links.find((x) => x.id === id) ?? links[0];
  const end = Math.max(Date.parse(l.expiresAt!), AS_OF);
  const [date, setDate] = useState(() => isoDay(end + 30 * DAY));
  const picked = Date.parse(`${date}T23:59:00Z`);
  const expiresAt =
    by === "never"
      ? undefined
      : by === "date"
        ? Number.isNaN(picked)
          ? null
          : new Date(picked).toISOString()
        : new Date(end + Number(by) * DAY).toISOString();
  const valid =
    expiresAt === undefined ||
    (expiresAt !== null && Date.parse(expiresAt) > end);

  useEffect(() => {
    const down = (e: PointerEvent) =>
      !ref.current?.parentElement?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Extend a link"
      className="orbit-pop absolute top-full right-0 z-50 mt-2 w-[320px] rounded-xl border border-white/10 bg-raised p-4 text-left shadow-[0_20px_50px_-12px_rgb(0_0_0/0.6)]"
    >
      {links.length > 1 ? (
        <>
          <div className="text-[12px] text-neutral-500">Link</div>
          <div role="radiogroup" className="mt-1.5 space-y-1">
            {links.map((x) => (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={x.id === id}
                onClick={() => setId(x.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  x.id === id
                    ? "bg-white/[0.07] text-white"
                    : "text-neutral-300 hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">{x.name}</span>
                <span className="shrink-0 text-[12px] text-neutral-500 tabular-nums">
                  ends {dateFmt.format(new Date(x.expiresAt!))}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-white">
          {l.name}
          <div className="text-[12px] text-neutral-500">
            Ends {longDate.format(new Date(l.expiresAt!))}
          </div>
        </div>
      )}

      <div className="mt-4 text-[12px] text-neutral-500">Extend by</div>
      <div role="radiogroup" className="mt-1.5 flex flex-wrap gap-1.5">
        {EXTEND_BY.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={by === o.value}
            onClick={() => setBy(o.value)}
            className={`h-7 rounded-full px-2.5 text-[12px] transition-colors ${
              by === o.value
                ? "bg-white text-black"
                : "border border-white/10 text-neutral-300 hover:border-white/25"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {by === "date" && (
        <input
          type="date"
          value={date}
          min={isoDay(end + DAY)}
          onChange={(e) => setDate(e.target.value)}
          className="mt-3 h-9 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white [color-scheme:dark] outline-none focus:border-white/35"
        />
      )}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
        <span className="text-[12px] text-neutral-400">
          {!valid
            ? "Pick a date after the current end"
            : expiresAt
              ? `New end: ${longDate.format(new Date(expiresAt))}`
              : "Takes payments until you pause it"}
        </span>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onExtend(l, expiresAt ?? undefined)}
          className="h-8 shrink-0 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          Extend
        </button>
      </div>
    </div>
  );
}

/** Small square badge, Mercury-style: quiet grey unless the link is live. */
export function Badge({ status }: { status: LinkStatus }) {
  const tone =
    status === "Active"
      ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : status === "Paused"
        ? "bg-white/[0.07] text-neutral-300"
        : "bg-white/[0.04] text-neutral-500";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ${tone}`}
    >
      {status}
    </span>
  );
}

/** Wallets-style fact without the chart: label · number + aside · one line of context. */
function Fact({
  label,
  value,
  aside,
  footer,
}: {
  label: string;
  value: React.ReactNode;
  aside?: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col border-white/8 lg:px-8 lg:first:pl-0 lg:last:pr-0 lg:[&:not(:first-child)]:border-l">
      <div className="text-[13px] text-neutral-500">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[34px] leading-none font-medium tracking-[-0.035em] text-white tabular-nums">
          {value}
        </span>
        {aside && (
          <span className="text-[13px] whitespace-nowrap tabular-nums">
            {aside}
          </span>
        )}
      </div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 text-xs text-neutral-500">
        {footer}
      </div>
    </div>
  );
}

/** The opened row: the link, its terms, recent payments, and the next thing to do. */
function LinkPreview({
  link: l,
  onCopy,
  onEdit,
  onToggle,
  onDuplicate,
  onArchive,
}: {
  link: PaymentLink;
  onCopy: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}) {
  const [qr, setQr] = useState(false);
  const paid = paidOf(l);
  return (
    <div className="rounded-xl border border-white/8 bg-[var(--surface)]">
      <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-6 px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs text-neutral-500">Payment link</div>
          <div className="mt-1 flex items-center gap-1">
            <span className="truncate text-[13px] text-neutral-100">
              {url(l)}
            </span>
            <CopyButton value={url(l)} label="Copy link" />
            {/* Prototype: pay.gravv.xyz isn't real, so open the checkout here */}
            <a
              href={`/pay/${l.id}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Open checkout"
              title="Open checkout"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
            >
              <ExternalLink size={13} strokeWidth={1.75} />
            </a>
            <button
              type="button"
              aria-label="QR code"
              aria-pressed={qr}
              onClick={() => setQr((v) => !v)}
              className={`flex size-6 shrink-0 items-center justify-center rounded-md transition-colors ${qr ? "bg-white/10 text-white" : "text-neutral-500 hover:bg-white/8 hover:text-white"}`}
            >
              <QrCode size={13} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <Detail label="Accepts" value={l.methods.join(", ")} />
        <Detail
          label={l.status === "Expired" ? "Expired" : "Expires"}
          value={l.expiresAt ? longDate.format(new Date(l.expiresAt)) : "Never"}
        />
        <Detail
          label="Limit"
          value={
            l.limit ? `${l.limit - paid.length} of ${l.limit} left` : "No limit"
          }
        />
      </div>

      {qr && (
        <div className="mx-5 mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-[#fafafa] p-1.5">
            <QRCodeSVG
              value={url(l)}
              size={72}
              bgColor="#fafafa"
              fgColor="#0a0a0a"
            />
          </div>
          <p className="text-[12px] text-neutral-500">
            Scan to open the checkout. Right-click to save.
          </p>
        </div>
      )}

      <div className="border-t border-white/8 px-5 py-3">
        <div className="text-xs text-neutral-500">Recent payments</div>
        {paid.length ? (
          <ul className="mt-1">
            {l.payments.slice(0, 3).map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-4 py-1.5 text-[13px]"
              >
                <span className="w-14 shrink-0 text-neutral-500">
                  {dateFmt.format(new Date(p.date))}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-200">
                  {p.payer}
                </span>
                <span
                  className={`w-16 text-xs ${p.status === "Paid" ? "text-neutral-500" : "text-red-300"}`}
                >
                  {p.status}
                </span>
                <span
                  className={`amount w-28 text-right tabular-nums ${p.status === "Paid" ? "text-white" : "text-neutral-500 line-through decoration-neutral-600"}`}
                >
                  <Money value={p.amount} currency={l.currency} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-neutral-500">
            No payments yet
            {l.views ? ` · ${l.views.toLocaleString("en-US")} views` : ""}.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3">
        <span className="text-xs text-neutral-500 tabular-nums">
          {paid.length
            ? `Collected from ${paid.length} ${paid.length === 1 ? "payment" : "payments"}`
            : "Nothing collected yet"}
          {l.views && paid.length
            ? ` · ${l.views.toLocaleString("en-US")} views, ${((paid.length / l.views) * 100).toFixed(1)}% paid`
            : ""}
        </span>
        <div className="flex items-center gap-2">
          <More
            items={[
              { label: "Edit", icon: Pencil, onClick: onEdit },
              ...(l.status === "Expired"
                ? []
                : [
                    {
                      label:
                        l.status === "Paused" ? "Resume link" : "Pause link",
                      icon: l.status === "Paused" ? Play : Pause,
                      onClick: onToggle,
                    },
                  ]),
              { label: "Duplicate", icon: CopyPlus, onClick: onDuplicate },
              { label: "Archive", icon: Archive, onClick: onArchive },
            ]}
          />
          <Link
            href={`/payment-links/${l.id}`}
            className="flex h-8 items-center gap-0.5 rounded-full px-3 text-[12.5px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View all details
            <ChevronRight size={13} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={onCopy}
            className="flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            <Copy size={13} strokeWidth={1.75} />
            Copy link
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 truncate text-[13px] text-neutral-100">{value}</div>
    </div>
  );
}

function More({
  items,
}: {
  items: { label: string; icon: typeof Copy; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center justify-center gap-1 rounded-full bg-white/[0.06] px-3 text-[12.5px] text-neutral-100 transition-colors hover:bg-white/[0.1]"
      >
        More
        <ChevronDown
          size={13}
          strokeWidth={1.75}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="orbit-pop absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
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
        </div>
      )}
    </div>
  );
}

// ——— Create ———

/**
 * Opens Create link when the URL asks for it (Customers → "Create link" sends
 * ?create=<id>&name=&email=), then clears the query so a refresh doesn't reopen it.
 * Kept in its own Suspense boundary so only this reads the URL.
 */
function CreateFromUrl({ onOpen }: { onOpen: (c: Customer) => void }) {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("create");
  const name = params.get("name");
  const email = params.get("email");
  useEffect(() => {
    if (!id) return;
    onOpen({ id, name: name ?? id, email: email ?? "" });
    router.replace("/payment-links", { scroll: false });
  }, [id, name, email, onOpen, router]);
  return null;
}

export function CreateFlow({
  prefill,
  editing,
  onClose,
  onSaved,
  ...rest
}: {
  onClose: () => void;
  onCreated: (l: PaymentLink) => void;
  onCopy: (l: PaymentLink) => void;
  prefill?: Customer;
  /** Open on an existing link: same sheet, pre-filled, lands on the review. */
  editing?: PaymentLink;
  onSaved?: (l: PaymentLink) => void;
}) {
  // Bottom sheet: slides up over the page you're on, and back down before it unmounts.
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return onClose();
    setLeaving(true);
    setTimeout(onClose, 260);
  }, [onClose]);
  // Don't lose work to a stray click: once anything is entered, closing (scrim, Esc, ×) asks
  // first. Creating the link clears it, so finishing closes normally.
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(
    () => (dirty ? setAsking(true) : close()),
    [dirty, close],
  );
  useEffect(() => {
    if (!asking) return;
    // Esc while asking = keep editing (and stop the flow's own Esc from closing).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setAsking(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [asking]);
  const markDirty = (e: React.SyntheticEvent) => {
    const t = e.target as HTMLElement;
    if (
      e.type === "input" ||
      e.type === "change" ||
      t.closest(
        '[role="radio"],[role="switch"],[role="checkbox"],[role="option"]',
      )
    )
      // After the keystroke lands, or the first character typed is dropped.
      setTimeout(() => setDirty(true), 0);
  };
  const props = {
    ...rest,
    onCreated: (l: PaymentLink) => {
      setDirty(false);
      rest.onCreated(l);
    },
    onSaved: (l: PaymentLink) => {
      setDirty(false);
      onSaved?.(l);
      close();
    },
    onClose: requestClose,
  };
  return (
    <div className="fixed inset-0 z-50" data-leaving={leaving || undefined}>
      <div
        aria-hidden
        onClick={requestClose}
        className="sheet-scrim absolute inset-0 bg-black/55"
      />
      <div
        onInputCapture={markDirty}
        onChangeCapture={markDirty}
        onClickCapture={markDirty}
        className="sheet-panel absolute inset-x-0 top-[7vh] bottom-0 overflow-hidden rounded-t-[22px] bg-takeover shadow-[0_-24px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/8"
      >
        {asking && (
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 pt-[18vh]">
            <div
              role="alertdialog"
              aria-labelledby="discard-title"
              className="orbit-pop w-[360px] rounded-2xl border border-white/10 bg-raised p-5 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
            >
              <h2
                id="discard-title"
                className="text-[15px] font-medium text-white"
              >
                {editing ? "Discard your changes?" : "Discard this link?"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">
                {editing
                  ? "The link stays as it was."
                  : "What you've entered won't be saved."}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setAsking(false)}
                  className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAsking(false);
                    close();
                  }}
                  className="h-9 rounded-full px-4 text-[13px] text-rose-400 hover:bg-rose-500/10"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
        <CreateFlowUpdated {...props} prefill={prefill} editing={editing} />
      </div>
    </div>
  );
}

// ——— Create: a full-screen, step-by-step flow ———

type Step = "customer" | "destination" | "details" | "review" | "done";
const STEPS: { id: Exclude<Step, "done">; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "destination", label: "Destination" },
  { id: "details", label: "Payment details" },
  { id: "review", label: "Review & create" },
];

// Placeholder customers until the Customers API is wired up.
type Customer = { id: string; name: string; email: string };

/**
 * Shown when the field opens empty: the five customers you last charged or made a link
 * for, newest first, so repeat billing is one click. (In production: from payment activity.)
 */
type RecentCustomer = Customer & {
  last: { label: "Paid" | "Link created"; at: string };
};
const RECENT: RecentCustomer[] = (
  [
    {
      id: "cus_8f2a01",
      name: "James Bond",
      email: "jamesbond@email.com",
      last: { label: "Paid", at: "2026-10-19T14:20:00Z" },
    },
    {
      id: "cus_31d9ae",
      name: "Jacinta Olukoya",
      email: "jacinta@olukoya.co",
      last: { label: "Link created", at: "2026-10-18T09:05:00Z" },
    },
    {
      id: "cus_c47b10",
      name: "Jasper Smith",
      email: "jasper@creativityhub.com",
      last: { label: "Paid", at: "2026-10-16T17:40:00Z" },
    },
    {
      id: "cus_92ee5f",
      name: "John Doe",
      email: "johndoe@kredete.com",
      last: { label: "Paid", at: "2026-10-12T11:15:00Z" },
    },
    {
      id: "cus_0ab7d3",
      name: "Lumen Labs Inc",
      email: "ap@lumenlabs.io",
      last: { label: "Link created", at: "2026-10-09T08:30:00Z" },
    },
  ] satisfies RecentCustomer[]
).sort((x, y) => y.last.at.localeCompare(x.last.at));

/**
 * 100,000 placeholder customers, generated on first search so the page doesn't pay for
 * them up front. In production this is a server-side search; the UI only ever shows a page.
 */
let directory: (Customer & { hay: string })[] | null = null;
function customerDirectory() {
  if (directory) return directory;
  const first = [
    "Ada",
    "Tolu",
    "Grace",
    "Ikenna",
    "Sarah",
    "Kwame",
    "Lena",
    "Musa",
    "Priya",
    "Jordan",
    "Chioma",
    "Daniel",
    "Amara",
    "Marcus",
    "Sofia",
    "Hannah",
    "Femi",
    "Zainab",
    "Yusuf",
    "Mei",
    "Lucas",
    "Nia",
    "Omar",
    "Ivy",
    "Kofi",
  ];
  const last = [
    "Adeyemi",
    "Mensah",
    "Obi",
    "Chen",
    "Asante",
    "Fischer",
    "Bello",
    "Nair",
    "Blake",
    "Eze",
    "Okafor",
    "Nwosu",
    "Reid",
    "Alvarez",
    "Kim",
    "Okonkwo",
    "Diallo",
    "Ibrahim",
    "Tanaka",
    "Silva",
    "Mwangi",
    "Haddad",
    "Novak",
    "Osei",
    "Kariuki",
    "Mbeki",
    "Petrov",
    "Rossi",
    "Sato",
    "Ward",
  ];
  const domains = [
    "gmail.com",
    "outlook.com",
    "yahoo.com",
    "proton.me",
    "icloud.com",
  ];
  const out: (Customer & { hay: string })[] = RECENT.map((c) => ({
    ...c,
    hay: `${c.name} ${c.email} ${c.id}`.toLowerCase(),
  }));
  for (let i = 0; out.length < 100_000; i++) {
    const f = first[i % first.length];
    const l = last[Math.floor(i / first.length) % last.length];
    const n = Math.floor(i / (first.length * last.length));
    const id = `cus_${(0x100000 + i * 7919).toString(16).slice(-6)}`;
    const email =
      `${f}.${l}${n || ""}@${domains[i % domains.length]}`.toLowerCase();
    const c = { id, name: `${f} ${l}`, email };
    out.push({ ...c, hay: `${c.name} ${c.email} ${c.id}`.toLowerCase() });
  }
  directory = out;
  return out;
}

/** Top matches only, plus how many there are in total. */
function searchCustomers(
  q: string,
  limit = 8,
): { results: Customer[]; total: number } {
  const needle = q.trim().toLowerCase();
  if (!needle) return { results: RECENT, total: RECENT.length };
  const results: Customer[] = [];
  let total = 0;
  for (const c of customerDirectory()) {
    if (!c.hay.includes(needle)) continue;
    total++;
    if (results.length < limit)
      results.push({ id: c.id, name: c.name, email: c.email });
  }
  return { results, total };
}

/** The matching part of a label, emphasised. */
function Highlight({ text, q }: { text: string; q: string }) {
  const needle = q.trim().toLowerCase();
  const i = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-white">{text.slice(i, i + needle.length)}</span>
      {text.slice(i + needle.length)}
    </>
  );
}

const WALLETS = [
  {
    id: "treasury",
    name: "Treasury wallet",
    detail: "USDC · Polygon",
    balance: "48,210.00",
  },
  {
    id: "payouts",
    name: "Payouts float",
    detail: "USDC · Ethereum",
    balance: "12,904.55",
  },
];
// Gravv fiat accounts a link can credit.
const ACCOUNTS = [
  {
    id: "lead",
    name: "Lead Bank USD master account",
    detail: "USD · ••4410",
    balance: "184,320.15",
  },
  {
    id: "crb",
    name: "CRB USD Sub-Account",
    detail: "USD · ••7781",
    balance: "22,904.00",
  },
];
type DestKind = "wallet" | "account" | "external";
const DEST_KINDS: { value: DestKind; label: string; sub: string }[] = [
  {
    value: "wallet",
    label: "Internal wallet",
    sub: "Settle on-chain to one of your own crypto wallets.",
  },
  {
    value: "account",
    label: "Internal account",
    sub: "Credit the balance of one of your Gravv accounts.",
  },
  {
    value: "external",
    label: "External wallet",
    sub: "Send to any wallet address outside Gravv.",
  },
];

/** Where an existing link settles, as the flow's own choices. Seeded links default to Treasury. */
function destinationOf(settlesTo?: string): {
  kind: DestKind;
  wallet: string | null;
  kept: string | null;
} {
  if (!settlesTo) return { kind: "wallet", wallet: "treasury", kept: null };
  const w = WALLETS.find((x) => `${x.name} · ${x.detail}` === settlesTo);
  if (w) return { kind: "wallet", wallet: w.id, kept: null };
  const a = ACCOUNTS.find((x) => `${x.name} · ${x.detail}` === settlesTo);
  if (a) return { kind: "account", wallet: a.id, kept: null };
  return { kind: "external", wallet: null, kept: settlesTo };
}

const listOf = (xs: string[]) =>
  xs.length < 2
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

function CreateFlowUpdated({
  onClose,
  onCreated,
  onSaved,
  onCopy,
  prefill,
  editing: e,
}: {
  onClose: () => void;
  onCreated: (l: PaymentLink) => void;
  onSaved: (l: PaymentLink) => void;
  onCopy: (l: PaymentLink) => void;
  /** A customer chosen before the flow opened (from the Customers page). */
  prefill?: Customer;
  /** Editing an existing link: everything pre-filled, opens on the review. */
  editing?: PaymentLink;
  /** The combined flow: one customer or anyone, a name, any amount, several methods, a limit. */
}) {
  // Once someone has paid, the price and who it's for are fixed — duplicate to change them.
  const paidCount = e ? paidOf(e).length : 0;
  const locked = paidCount > 0;
  const [startDest] = useState(() => destinationOf(e?.settlesTo));
  const [step, setStep] = useState<Step>(
    e ? "review" : prefill ? "destination" : "customer",
  );
  // Optimal only: who pays, what it's called, flexible amount, which methods, how many payments.
  const [audience, setAudience] = useState<"customer" | "anyone">(
    e && !e.customer ? "anyone" : "customer",
  );
  const [linkName, setLinkName] = useState(e?.name ?? "");
  const [anyAmount, setAnyAmount] = useState(e ? e.amount === null : false);
  const [cards, setCards] = useState(e ? e.methods.includes("Card") : false);
  const [limitText, setLimitText] = useState(
    e?.limit && !e.customer ? String(e.limit) : "",
  );
  // Step 1 — customer
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(
    e?.customer
      ? { id: e.customer.email, ...e.customer }
      : e
        ? null
        : (prefill ?? null),
  );
  const [cursor, setCursor] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState(e?.redirectUrl ?? "");
  // Step 2 — destination
  const [kind, setKind] = useState<DestKind>(startDest.kind);
  // The chosen internal wallet or account (by id), reset when the kind changes.
  const [wallet, setWallet] = useState<string | null>(startDest.wallet);
  const [address, setAddress] = useState("");
  // An external address we only know in short form; kept until a new one is entered.
  const [keptDest, setKeptDest] = useState<string | null>(startDest.kept);
  const [network, setNetwork] = useState<"Polygon" | "Ethereum" | "Stellar">(
    "Polygon",
  );
  // Step 3 — payment details
  const [amount, setAmount] = useState(
    e?.amount != null ? String(e.amount) : "",
  );
  const [currency, setCurrency] = useState<PaymentLink["currency"]>(
    e?.currency ?? "USD",
  );
  const [description, setDescription] = useState(e?.description ?? "");
  const [expiry, setExpiry] = useState<"keep" | "never" | "7" | "30">(
    e ? (e.expiresAt ? "keep" : "never") : "30",
  );
  const [reference] = useState(
    () => e?.reference ?? e?.id ?? crypto.randomUUID(),
  );
  const [created, setCreated] = useState<PaymentLink | null>(null);
  const reviewing = step === "review";
  // FLIP: remember where the summary panel sat, and when it changes place (right column ↔
  // centre) animate it from the old box to the new one so it reads as one object moving.
  const summaryRef = useRef<HTMLElement>(null);
  const lastBox = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    const el = summaryRef.current;
    if (!el) return;
    const now = el.getBoundingClientRect();
    const prev = lastBox.current;
    lastBox.current = now;
    if (!prev || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dx = prev.left - now.left,
      dy = prev.top - now.top;
    const sx = prev.width / now.width,
      sy = prev.height / now.height;
    el.animate(
      [
        {
          transformOrigin: "top left",
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [reviewing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const value = Number(amount.replace(/,/g, "")) || 0;
  const expiresAt =
    expiry === "keep"
      ? e?.expiresAt
      : expiry === "never"
        ? undefined
        : new Date(AS_OF + Number(expiry) * DAY).toISOString();
  const pool = kind === "account" ? ACCOUNTS : WALLETS;
  const w = pool.find((x) => x.id === wallet) ?? null;
  const validAddress =
    /^0x[0-9a-fA-F]{40}$/.test(address.trim()) ||
    (network === "Stellar" && /^G[A-Z2-7]{55}$/.test(address.trim()));
  const destination =
    keptDest ??
    (kind !== "external"
      ? w
        ? `${w.name} · ${w.detail}`
        : null
      : validAddress
        ? `${address.slice(0, 6)}…${address.slice(-4)} · ${network}`
        : null);
  const urlOk =
    !redirectUrl.trim() || /^https?:\/\/\S+\.\S+/.test(redirectUrl.trim());
  const forAnyone = audience === "anyone";
  const amountOk = anyAmount ? true : value > 0;
  // New links always take bank and USDC; an edited link keeps the free methods it had.
  const freeMethods: Method[] = e
    ? e.methods.filter((m) => m !== "Card")
    : ["Bank transfer", "USDC"];
  const methods: Method[] = [
    ...freeMethods,
    ...(cards ? (["Card"] as Method[]) : []),
  ];
  const limitNum = Math.max(0, Math.floor(Number(limitText) || 0));
  const fundingNote = `Accepts ${methods
    .map((m) => (m === "USDC" ? "USDC" : m.toLowerCase()))
    .join(", ")
    .replace(/, ([^,]*)$/, " and $1")}. The payer picks at checkout.`;
  const ready: Record<Exclude<Step, "done">, boolean> = {
    customer: (forAnyone || !!customer) && urlOk,
    destination: !!destination,
    details: linkName.trim().length > 0 && amountOk && methods.length > 0,
    review:
      (forAnyone || !!customer) &&
      !!destination &&
      linkName.trim().length > 0 &&
      amountOk &&
      methods.length > 0,
  };
  const order = STEPS.map((s) => s.id);
  const at = step === "done" ? order.length : order.indexOf(step);
  const next = () => setStep(order[at + 1] ?? "review");
  const back = () => setStep(order[at - 1] ?? "customer");
  const { results: matches, total: matchCount } = searchCustomers(query);
  const typed = query.trim().length > 0;
  const input =
    "h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white outline-none transition-colors placeholder:text-neutral-500 focus:border-white/35";

  const create = () => {
    const name = linkName.trim();
    const l: PaymentLink = {
      id: `plink_${reference.slice(0, 8)}`,
      name,
      description: description.trim() || undefined,
      slug: `kredete/${reference.slice(0, 8)}`,
      amount: anyAmount ? null : value,
      currency,
      methods,
      status: "Active",
      createdAt: new Date(AS_OF).toISOString(),
      expiresAt,
      // One customer → one payment. A public link takes as many as you allow.
      limit: forAnyone ? limitNum || undefined : 1,
      views: 0,
      started: 0,
      payments: [],
      customer: forAnyone ? undefined : customer!,
      settlesTo: destination!,
      redirectUrl: redirectUrl.trim() || undefined,
      reference,
    };
    setCreated(l);
    onCreated(l);
    setStep("done");
  };

  // Editing: what differs from the live link, in the words the timeline uses.
  const nextLimit = forAnyone ? limitNum || undefined : 1;
  const nextCustomer = forAnyone
    ? undefined
    : customer
      ? { name: customer.name, email: customer.email }
      : undefined;
  const nextAmount = anyAmount ? null : value;
  const changes = !e
    ? []
    : [
        linkName.trim() !== e.name && "name",
        (description.trim() || undefined) !== e.description && "description",
        nextAmount !== e.amount && "amount",
        currency !== e.currency && "currency",
        [...methods].sort().join() !== [...e.methods].sort().join() &&
          "payment methods",
        expiresAt !== e.expiresAt && "pay-by date",
        nextLimit !== (e.customer ? 1 : e.limit) && "limit",
        nextCustomer?.email !== e.customer?.email && "customer",
        destination !==
          (e.settlesTo ?? `${WALLETS[0].name} · ${WALLETS[0].detail}`) &&
          "destination",
        (redirectUrl.trim() || undefined) !== e.redirectUrl && "redirect",
      ].filter((c): c is string => !!c);
  const save = () => {
    if (!e || !changes.length) return;
    // A new pay-by date (or none) brings an expired link back to life.
    const revived =
      e.status === "Expired" && (!expiresAt || Date.parse(expiresAt) > AS_OF);
    onSaved({
      ...e,
      name: linkName.trim(),
      description: description.trim() || undefined,
      amount: nextAmount,
      currency,
      methods,
      expiresAt,
      limit: e.customer && !forAnyone ? e.limit : nextLimit,
      customer: nextCustomer,
      settlesTo: destination!,
      redirectUrl: redirectUrl.trim() || undefined,
      status: revived ? "Active" : e.status,
      edits: [
        ...(e.edits ?? []),
        {
          at: new Date(AS_OF).toISOString(),
          by: "Folarin Folarin",
          changed: changes,
        },
      ],
    });
  };

  return (
    <div
      className="absolute inset-0 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={e ? "Edit payment link" : "Create a payment link"}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 text-[13px] text-neutral-300">
          <span className="flex size-7 items-center justify-center rounded-md bg-white text-xs font-semibold text-black">
            K
          </span>
          Kredete
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mx-auto grid max-w-[1100px] grid-cols-[160px_minmax(0,440px)_300px] gap-12 px-6 pb-20">
        {/* Step rail — completed steps can be revisited */}
        <ol className="sticky top-6 mt-10 h-fit border-l border-white/8">
          {STEPS.map((st, i) => {
            const current = st.id === step;
            const done = at > i;
            return (
              <li key={st.id}>
                <button
                  type="button"
                  disabled={!done || step === "done"}
                  onClick={() => setStep(st.id)}
                  className={`-ml-px block w-full border-l py-1.5 pl-4 text-left text-[13px] ${
                    current
                      ? "border-white text-white"
                      : done
                        ? "border-transparent text-neutral-300 enabled:hover:text-white"
                        : "border-transparent text-neutral-600"
                  }`}
                >
                  {e && st.id === "review" ? "Review & save" : st.label}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="min-w-0">
          {step === "customer" && (
            <StepForm
              title="Customer"
              lead="Who is this payment link for?"
              canContinue={ready.customer}
              onContinue={next}
              onCancel={onClose}
            >
              {locked ? (
                <Hint>
                  {paidCount} {paidCount === 1 ? "person has" : "people have"}{" "}
                  paid this link, so who it&apos;s for can&apos;t change.
                  Duplicate it to make one for someone else.
                </Hint>
              ) : (
                <div>
                  <Segmented
                    value={audience}
                    options={[
                      { value: "customer", label: "A specific customer" },
                      { value: "anyone", label: "Anyone with the link" },
                    ]}
                    onChange={setAudience}
                  />
                  {forAnyone && (
                    <Hint>
                      A reusable link anyone can pay — memberships, donations,
                      tickets, top-ups. You can cap how many payments it takes
                      on the next steps.
                    </Hint>
                  )}
                </div>
              )}
              {!forAnyone && (
                <Label text="Customer" required>
                  {customer ? (
                    <div className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/[0.04] px-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-white/[0.08] text-[11px] text-neutral-200">
                        {customer.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-neutral-100">
                          {customer.name}
                        </span>
                        <span className="block truncate text-[11px] text-neutral-500">
                          {customer.email}
                        </span>
                      </span>
                      {!locked && (
                        <button
                          type="button"
                          onClick={() => setCustomer(null)}
                          className="text-[12px] text-neutral-400 hover:text-white"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={query}
                        onFocus={() => setPickerOpen(true)}
                        onClick={() => setPickerOpen(true)}
                        onBlur={() => setPickerOpen(false)}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setCursor(0);
                          setPickerOpen(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" && pickerOpen) {
                            e.preventDefault();
                            e.stopPropagation();
                            setPickerOpen(false);
                          } else if (e.key === "ArrowDown") {
                            setPickerOpen(true);
                            e.preventDefault();
                            setCursor((c) =>
                              Math.min(matches.length - 1, c + 1),
                            );
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setCursor((c) => Math.max(0, c - 1));
                          } else if (
                            e.key === "Enter" &&
                            pickerOpen &&
                            matches[cursor]
                          ) {
                            e.preventDefault();
                            setCustomer(matches[cursor]);
                          }
                        }}
                        role="combobox"
                        aria-expanded={pickerOpen}
                        aria-controls="customer-results"
                        aria-activedescendant={
                          matches[cursor]
                            ? `cus-${matches[cursor].id}`
                            : undefined
                        }
                        placeholder="Search by name, email or customer ID…"
                        className={input}
                      />
                      {pickerOpen && (
                        <div
                          // Keep focus in the input while clicking a result.
                          onMouseDown={(e) => e.preventDefault()}
                          className="orbit-pop absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-raised shadow-[0_20px_50px_-12px_rgb(0_0_0/0.6)]"
                        >
                          <div className="flex items-center justify-between border-b border-white/6 px-3 py-1.5 text-[11px] text-neutral-500 tabular-nums">
                            <span>
                              {typed
                                ? matchCount
                                  ? "Best matches"
                                  : "No results"
                                : "Recently charged"}
                            </span>
                            {typed && matchCount > matches.length && (
                              <span>
                                {matches.length} of{" "}
                                {matchCount.toLocaleString("en-US")} · keep
                                typing to narrow
                              </span>
                            )}
                            {!typed && (
                              <span>Search all 100,000 customers</span>
                            )}
                          </div>
                          <ul
                            id="customer-results"
                            role="listbox"
                            className="p-1"
                          >
                            {matches.map((c, i) => (
                              <li
                                key={c.id}
                                id={`cus-${c.id}`}
                                role="option"
                                aria-selected={i === cursor}
                              >
                                <button
                                  type="button"
                                  onMouseEnter={() => setCursor(i)}
                                  onClick={() => setCustomer(c)}
                                  className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors ${i === cursor ? "bg-white/[0.06]" : ""}`}
                                >
                                  <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">
                                    <Highlight text={c.name} q={query} />
                                    <span className="ml-2 text-[12px] text-neutral-500">
                                      <Highlight text={c.email} q={query} />
                                    </span>
                                  </span>
                                  {!typed && "last" in c ? (
                                    <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">
                                      {(c as RecentCustomer).last.label}{" "}
                                      {dateFmt.format(
                                        new Date((c as RecentCustomer).last.at),
                                      )}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 font-mono text-[11px] text-neutral-600">
                                      {c.id}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                            {typed && matchCount === 0 && (
                              <li className="px-2.5 py-2.5 text-[13px] text-neutral-500">
                                No customer matches “{query.trim()}”. Check the
                                spelling, or search by email.
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  <Hint>
                    The customer being charged. Search by name, email or ID to
                    find them.
                  </Hint>
                </Label>
              )}
              <Label text="Redirect URL" optional>
                <input
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://yoursite.com/payment-complete"
                  className={`${input} font-mono text-[12.5px] ${urlOk ? "" : "border-rose-400/50"}`}
                />
                <Hint>
                  Where the payer is sent after completing the payment. Leave
                  blank to keep them on the Gravv page.
                </Hint>
              </Label>
            </StepForm>
          )}

          {step === "destination" && (
            <StepForm
              title="Destination"
              lead="Where should the funds settle?"
              canContinue={ready.destination}
              onContinue={next}
              onBack={back}
            >
              <Label text="Where should the money go?">
                <Segmented
                  value={kind}
                  options={DEST_KINDS.map((d) => ({
                    value: d.value,
                    label: d.label,
                  }))}
                  onChange={(v) => {
                    setKind(v);
                    setWallet(null);
                    setKeptDest(null);
                  }}
                />
                <Hint>{DEST_KINDS.find((d) => d.value === kind)!.sub}</Hint>
              </Label>
              {kind !== "external" ? (
                <Label
                  text={
                    kind === "wallet"
                      ? "Destination wallet"
                      : "Destination account"
                  }
                  required
                >
                  <div role="radiogroup" className="space-y-2">
                    {pool.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        role="radio"
                        aria-checked={wallet === x.id}
                        onClick={() => {
                          setWallet(x.id);
                          setKeptDest(null);
                        }}
                        className={`flex w-full items-center justify-between gap-4 rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                          wallet === x.id
                            ? "border-white/30 bg-white/[0.04]"
                            : "border-white/8 hover:border-white/20"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-neutral-100">
                            {x.name}
                          </span>
                          <span className="block text-[11px] text-neutral-500">
                            {x.detail}
                          </span>
                        </span>
                        <span className="amount shrink-0 text-[13px] text-neutral-300 tabular-nums">
                          {x.balance}
                        </span>
                      </button>
                    ))}
                  </div>
                  <Hint>
                    {kind === "wallet"
                      ? "Payments settle on-chain into this wallet. Payers never see its address."
                      : "Payments are converted and credited to this account's balance."}
                  </Hint>
                </Label>
              ) : (
                <>
                  <Label text="Network">
                    <Dropdown
                      label="Network"
                      value={network}
                      options={(
                        ["Polygon", "Ethereum", "Stellar"] as const
                      ).map((n) => ({ value: n, label: n }))}
                      onChange={setNetwork}
                    />
                  </Label>
                  <Label text="Wallet address" required>
                    <input
                      value={address}
                      onChange={(ev) => {
                        setAddress(ev.target.value.trim());
                        setKeptDest(null);
                      }}
                      placeholder={
                        keptDest
                          ? `Now ${keptDest}`
                          : network === "Stellar"
                            ? "G…"
                            : "0x…"
                      }
                      className={`${input} font-mono text-[12.5px] ${address && !validAddress ? "border-rose-400/50" : ""}`}
                    />
                    <Hint>
                      {address && !validAddress
                        ? `That doesn't look like a ${network} address.`
                        : "Funds are sent here when the payment completes. Double-check it — on-chain transfers can't be reversed."}
                    </Hint>
                  </Label>
                </>
              )}
            </StepForm>
          )}

          {step === "details" && (
            <StepForm
              title="Payment details"
              lead="What it's for, the price, and how people can pay."
              canContinue={ready.details}
              onContinue={next}
              onBack={back}
            >
              {
                <Label text="What it's for" required>
                  <input
                    autoFocus
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    placeholder={
                      forAnyone
                        ? "Annual membership"
                        : `Invoice for ${customer?.name ?? "the customer"}`
                    }
                    className={input}
                  />
                  <Hint>
                    The name the payer sees at the top of the checkout.
                  </Hint>
                </Label>
              }
              {locked ? (
                <Label text="Amount">
                  <div className="amount flex h-10 items-center rounded-lg border border-white/8 bg-white/[0.02] px-3 text-[13px] text-neutral-300 tabular-nums">
                    {anyAmount ? (
                      `Payer chooses · ${currency}`
                    ) : (
                      <Money value={value} currency={currency} />
                    )}
                    <span className="ml-auto text-[12px] text-neutral-500">
                      Locked
                    </span>
                  </div>
                  <Hint>
                    {paidCount} {paidCount === 1 ? "person has" : "people have"}{" "}
                    paid this amount. Duplicate the link to charge a different
                    one.
                  </Hint>
                </Label>
              ) : (
                <>
                  <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-3">
                    <Label text="Amount" required={!anyAmount}>
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-neutral-500">
                          {symbol(currency) || "₮"}
                        </span>
                        <input
                          inputMode="decimal"
                          disabled={anyAmount}
                          value={anyAmount ? "" : amount}
                          onChange={(e) =>
                            setAmount(e.target.value.replace(/[^\d.,]/g, ""))
                          }
                          placeholder={anyAmount ? "Payer enters it" : "0.00"}
                          className={`${input} pl-7 tabular-nums disabled:opacity-60`}
                        />
                      </div>
                    </Label>
                    <Label text="Currency">
                      <Dropdown
                        label="Currency"
                        value={currency}
                        options={(["USD", "USDC", "NGN"] as const).map((c) => ({
                          value: c,
                          label: c,
                        }))}
                        onChange={setCurrency}
                        className="[&>button]:h-10 [&>button]:w-full [&>button]:justify-between [&>button]:rounded-lg"
                      />
                    </Label>
                  </div>
                  {
                    <OptToggle
                      on={anyAmount}
                      onChange={() => setAnyAmount((v) => !v)}
                      label="Let the payer choose the amount"
                      hint="For donations, tips and top-ups"
                    />
                  }
                </>
              )}
              <Label text="Description" optional>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What the payment is for"
                  className={input}
                />
                <Hint>Shown to the payer on the checkout and receipt.</Hint>
              </Label>
              {
                <Label text="Accept">
                  {freeMethods.length > 0 && (
                    <ul className="mb-3 space-y-2 text-[13px] text-neutral-200">
                      {freeMethods.map((m) => (
                        <li key={m} className="flex items-center gap-2.5">
                          <Check
                            size={14}
                            strokeWidth={2.25}
                            className="text-[var(--flow-in)]"
                          />
                          {m} <span className="text-neutral-500">· free</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div>
                    <OptToggle
                      on={cards}
                      onChange={() => setCards((v) => !v)}
                      label="Card"
                      hint="2.9% + 30¢ per payment"
                    />
                  </div>
                  <Hint>
                    {methods.length
                      ? "The payer picks one of these at checkout."
                      : "Turn on at least one way to pay."}
                  </Hint>
                </Label>
              }
              <Label text="Expiry">
                <Dropdown
                  label="Expiry"
                  value={expiry}
                  options={[
                    ...(e?.expiresAt
                      ? [
                          {
                            value: "keep" as const,
                            label: `${e.status === "Expired" ? "Expired" : "Expires"} ${longDate.format(new Date(e.expiresAt))}`,
                          },
                        ]
                      : []),
                    { value: "never", label: "Never expires" },
                    { value: "7", label: "Expires in 7 days" },
                    { value: "30", label: "Expires in 30 days" },
                  ]}
                  onChange={setExpiry}
                />
                {e?.status === "Expired" && expiry === "keep" && (
                  <Hint>Pick a new date to start taking payments again.</Hint>
                )}
              </Label>
              {forAnyone && (
                <Label text="Limit" optional>
                  <input
                    inputMode="numeric"
                    value={limitText}
                    onChange={(e) =>
                      setLimitText(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="No limit"
                    className={`${input} w-40 tabular-nums`}
                  />
                  <Hint>
                    Stop taking payments after this many — e.g. seats at an
                    event.
                  </Hint>
                </Label>
              )}
            </StepForm>
          )}

          {step === "done" && created && (
            <div className="mt-10">
              <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                Payment link created
              </h2>
              <p className="mt-2 text-[13px] text-neutral-400">
                {created.customer
                  ? `Send it to ${created.customer.name}. It works once and expires on its own.`
                  : "Share it anywhere — it takes payments until it expires or hits its limit."}
              </p>
              <div className="mt-6 flex gap-4 rounded-xl border border-white/8 p-4">
                <div className="rounded-lg bg-[#fafafa] p-2">
                  <QRCodeSVG
                    value={url(created)}
                    size={96}
                    bgColor="#fafafa"
                    fgColor="#0a0a0a"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] text-neutral-500">
                    Payment link
                  </div>
                  <button
                    type="button"
                    onClick={() => onCopy(created)}
                    className="mt-1.5 flex h-9 w-full items-center gap-2 rounded-lg border border-white/10 px-3 text-left transition-colors hover:border-white/25"
                  >
                    <span className="truncate text-[12.5px] text-neutral-200">
                      {url(created)}
                    </span>
                    <Copy
                      size={13}
                      strokeWidth={1.75}
                      className="ml-auto shrink-0 text-neutral-500"
                    />
                  </button>
                </div>
              </div>
              <div className="mt-10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                >
                  Back to links
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCopy(created);
                    onClose();
                  }}
                  className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
                >
                  Copy link and finish
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live summary. At "Review & create" the same panel glides from the right into the
            centre and opens up into the review itself, so the summary you watched fill in
            becomes the thing you confirm. */}
        <aside
          ref={summaryRef}
          className={
            reviewing
              ? "col-span-2 col-start-2 row-start-1 mt-10 h-fit w-full max-w-[600px] justify-self-center rounded-2xl bg-white/[0.04] p-7 ring-1 ring-white/8"
              : "sticky top-6 mt-10 h-fit rounded-2xl bg-white/[0.03] p-5"
          }
        >
          {reviewing ? (
            <form
              key="review"
              className="morph-in"
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!ready.review) return;
                if (e) save();
                else create();
              }}
            >
              <SummaryLabel>{e ? "Edit link" : "Review & create"}</SummaryLabel>
              <div className="mt-2 flex items-end justify-between gap-6">
                <div className="min-w-0">
                  <h2 className="truncate text-[22px] font-medium tracking-[-0.02em] text-white">
                    {linkName.trim() ||
                      description.trim() ||
                      (customer
                        ? `Payment from ${customer.name}`
                        : "Payment link")}
                  </h2>
                  <p className="mt-1 text-[13px] text-neutral-400">
                    {!e
                      ? "Check everything before the link goes out."
                      : changes.length
                        ? `You're changing the ${listOf(changes)}.`
                        : "Edit any row below. Nothing has changed yet."}
                  </p>
                </div>
                <div className="amount shrink-0 text-[30px] leading-none font-medium tracking-[-0.02em] text-white">
                  {anyAmount ? (
                    <span className="text-[20px]">Any amount · {currency}</span>
                  ) : (
                    <Money value={value} currency={currency} />
                  )}
                </div>
              </div>
              <div className="mt-6">
                <div className="divide-y divide-white/6 rounded-xl border border-white/8">
                  {
                    <ReviewRow
                      label="For"
                      value={linkName.trim() || "—"}
                      onEdit={() => setStep("details")}
                    />
                  }
                  <ReviewRow
                    label="Customer"
                    value={
                      forAnyone
                        ? "Anyone with the link"
                        : customer
                          ? `${customer.name} · ${customer.email}`
                          : "—"
                    }
                    onEdit={locked ? undefined : () => setStep("customer")}
                  />
                  <ReviewRow
                    label="Settles to"
                    value={destination ?? "—"}
                    onEdit={() => setStep("destination")}
                  />
                  <ReviewRow
                    label="Amount"
                    value={
                      anyAmount ? (
                        `Payer chooses · ${currency}`
                      ) : (
                        <Money value={value} currency={currency} />
                      )
                    }
                    onEdit={locked ? undefined : () => setStep("details")}
                  />
                  <ReviewRow
                    label="Accepts"
                    value={methods.join(", ")}
                    onEdit={() => setStep("details")}
                  />
                  {forAnyone && (
                    <ReviewRow
                      label="Limit"
                      value={
                        limitNum
                          ? `${limitNum} ${limitNum === 1 ? "payment" : "payments"}`
                          : "No limit"
                      }
                      onEdit={() => setStep("details")}
                    />
                  )}
                  {description && (
                    <ReviewRow
                      label="Description"
                      value={description}
                      onEdit={() => setStep("details")}
                    />
                  )}
                  <ReviewRow
                    label="Expires"
                    value={
                      expiresAt ? longDate.format(new Date(expiresAt)) : "Never"
                    }
                    onEdit={() => setStep("details")}
                  />
                  <ReviewRow
                    label="Redirect"
                    value={redirectUrl.trim() || "Stays on the Gravv page"}
                    onEdit={() => setStep("customer")}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-[12px] text-neutral-500">
                <span>Reference</span>
                <span className="truncate font-mono text-[11.5px] text-neutral-300">
                  {reference}
                </span>
                <CopyButton value={reference} label="Copy reference" />
              </div>
              {e && (
                <p className="mt-6 text-[12px] text-neutral-500">
                  Changes apply to the live link right away. The URL stays the
                  same.
                </p>
              )}
              <div className={`${e ? "mt-4" : "mt-8"} flex justify-between`}>
                <button
                  type="button"
                  onClick={e ? onClose : back}
                  className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] pr-4 pl-3 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                >
                  {e ? (
                    "Cancel"
                  ) : (
                    <>
                      <ArrowLeft size={14} strokeWidth={1.75} />
                      Back
                    </>
                  )}
                </button>
                <button
                  type="submit"
                  disabled={!ready.review || (!!e && !changes.length)}
                  className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
                >
                  {e ? "Save changes" : "Create payment link"}
                  <ChevronRight size={14} strokeWidth={2} />
                </button>
              </div>
            </form>
          ) : (
            <div key="summary" className="morph-in">
              <SummaryLabel>Payment link</SummaryLabel>
              {linkName.trim() && (
                <div className="mt-1 truncate text-[13px] text-neutral-300">
                  {linkName.trim()}
                </div>
              )}
              <div className="amount mt-1 text-[26px] leading-none font-medium tracking-[-0.02em] text-white">
                {anyAmount ? (
                  <span className="text-[20px]">Any amount · {currency}</span>
                ) : (
                  <Money value={value} currency={currency} />
                )}
              </div>
              <SummaryLabel className="mt-5">Customer</SummaryLabel>
              {forAnyone ? (
                <div className="mt-1 text-[13px] text-neutral-100">
                  Anyone with the link
                </div>
              ) : customer ? (
                <>
                  <div className="mt-1 text-[13px] text-neutral-100">
                    {customer.name}
                  </div>
                  <div className="text-[12px] text-neutral-500">
                    {customer.email}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[13px] text-neutral-500">
                  Not selected yet
                </div>
              )}
              <SummaryLabel className="mt-5">Settles to</SummaryLabel>
              <div className="mt-1 text-[13px] text-neutral-100">
                {kind === "external"
                  ? `External wallet · ${network}`
                  : DEST_KINDS.find((d) => d.value === kind)!.label}
              </div>
              <div className="text-[12px] text-neutral-500">
                {destination ?? "No destination selected"}
              </div>
              <SummaryLabel className="mt-5">Reference</SummaryLabel>
              <div className="mt-1 flex items-center gap-1">
                <span className="truncate font-mono text-[11.5px] text-neutral-300">
                  {reference}
                </span>
                <CopyButton value={reference} label="Copy reference" />
              </div>
              <p className="mt-5 border-t border-white/8 pt-4 text-[12px] leading-relaxed text-neutral-500">
                {fundingNote}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function StepForm({
  title,
  lead,
  children,
  canContinue,
  continueLabel = "Continue",
  onContinue,
  onBack,
  onCancel,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
  canContinue: boolean;
  continueLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="mt-10"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) onContinue();
      }}
    >
      <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
        {title}
      </h2>
      <p className="mt-2 text-[13px] text-neutral-400">{lead}</p>
      <div className="mt-8 space-y-6">{children}</div>
      <div className="mt-10 flex justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] pr-4 pl-3 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back
          </button>
        ) : (
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!canContinue}
          className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          {continueLabel}
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>
    </form>
  );
}

function ReviewRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: React.ReactNode;
  /** Left out when the row can't change (someone has already paid). */
  onEdit?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 text-[13px]">
      <span className="w-24 shrink-0 text-neutral-500">{label}</span>
      <span className="min-w-0 flex-1 truncate text-neutral-100">{value}</span>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[12px] text-neutral-500 transition-colors hover:text-white"
        >
          Edit
        </button>
      ) : (
        <span className="shrink-0 text-[12px] text-neutral-600">Locked</span>
      )}
    </div>
  );
}

function SummaryLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[10.5px] tracking-[0.08em] text-neutral-500 uppercase ${className}`}
    >
      {children}
    </div>
  );
}

function OptToggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="flex items-center gap-3 text-left"
    >
      <span
        aria-hidden
        style={{ width: 32, height: 18 }}
        className={`shrink-0 rounded-full p-0.5 transition-colors ${on ? "bg-white" : "bg-white/15"}`}
      >
        <span
          style={{
            width: 14,
            height: 14,
            transform: `translateX(${on ? 14 : 0}px)`,
          }}
          className={`block rounded-full transition-transform ${on ? "bg-black" : "bg-white"}`}
        />
      </span>
      <span className="text-[13px] text-neutral-200">
        {label}
        {hint && (
          <span className="ml-1.5 text-[12px] text-neutral-500">{hint}</span>
        )}
      </span>
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
      {children}
    </p>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex rounded-full bg-white/[0.07] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-3.5 text-[12px] transition-colors ${
            value === o.value
              ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Label({
  text,
  required = false,
  optional = false,
  children,
}: {
  text: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[13px] text-neutral-200">
        {text}
        {required && <span className="ml-0.5 text-rose-300">*</span>}
        {optional && <span className="ml-1 text-neutral-500">(Optional)</span>}
      </span>
      {children}
    </div>
  );
}

function exportCsv(rows: PaymentLink[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "Link ID",
    "Name",
    "URL",
    "Price",
    "Currency",
    "Status",
    "Payments",
    "Collected",
    "Created",
    "Expires",
  ];
  const lines = rows.map((l) =>
    [
      l.id,
      esc(l.name),
      url(l),
      l.amount === null ? "Any amount" : l.amount.toFixed(2),
      l.currency,
      l.status,
      paidOf(l).length,
      collected(l).toFixed(2),
      l.createdAt,
      l.expiresAt ?? "",
    ].join(","),
  );
  const href = URL.createObjectURL(
    new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" }),
  );
  const a = document.createElement("a");
  a.href = href;
  a.download = "payment-links.csv";
  a.click();
  URL.revokeObjectURL(href);
}
