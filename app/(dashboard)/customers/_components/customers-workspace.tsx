"use client";

import { toneClass, toneFor } from "@/app/_components/tone";
import { photoOf } from "@/app/_components/person-avatar";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { TablePager, usePager } from "@/app/_components/table-pager";
import { dateFmt, fullDateFmt } from "../../cards/_lib/format";
import { CreateFlow } from "../../payment-links/_components/links-workspace";
import {
  AS_OF,
  DAY,
  FEATURED,
  TOTAL,
  customerAt,
  liteAt,
  type Customer,
  type CustomerKind,
  type CustomerPayment,
  type Lite,
  type Verification,
} from "../_data";
import { UpdateNotice } from "@/app/_components/updates";

type Tab = "All" | "Paying" | "Owes you" | "Needs review";
const TABS: Tab[] = ["All", "Paying", "Owes you", "Needs review"];

/** One entry in the book: the light row used for search and counts, and how to build the full record. */
type Entry = Lite & { full: () => Customer };

let book: Entry[] | null = null;
/** Featured customers first, then the generated rest, 100,000 in all. Built once, on first use. */
function getBook(): Entry[] {
  if (book) return book;
  const featured: Entry[] = FEATURED.map((c, i) => ({
    i: -1 - i,
    id: c.id,
    name: c.name,
    email: c.email,
    kind: c.kind,
    verification: c.verification,
    paying: c.paid30d > 0,
    owes: c.openLinks.length > 0,
    hay: `${c.name} ${c.email} ${c.id}`.toLowerCase(),
    full: () => c,
  }));
  const rest: Entry[] = [];
  for (let i = 0; i < TOTAL - FEATURED.length; i++) {
    rest.push({ ...liteAt(i), full: () => customerAt(i) });
  }
  book = [...featured, ...rest];
  return book;
}

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
const compact = (v: number) =>
  v >= 1_000_000
    ? `${Number((v / 1_000_000).toFixed(1))}M`
    : v >= 1000
      ? `${Number((v / 1000).toFixed(1))}k`
      : String(Math.round(v));
const count = (n: number) => new Intl.NumberFormat("en-US").format(n);
const daysUntil = (iso: string) =>
  Math.max(0, Math.ceil((Date.parse(iso) - AS_OF) / DAY));

const matches = (e: Lite, tab: Tab) =>
  tab === "All" ||
  (tab === "Paying" && e.paying) ||
  (tab === "Owes you" && e.owes) ||
  (tab === "Needs review" && e.verification !== "Verified");

export function CustomersWorkspace() {
  const [tab, setTab] = useState<Tab>("All");
  const [kind, setKind] = useState<"All" | CustomerKind>("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Create link opens as a bottom sheet right here, with the customer already chosen.
  const [linkFor, setLinkFor] = useState<Customer | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Book-wide figures for the facts and tab counts (in production these come from the server).
  const stats = useMemo(() => {
    const all = getBook();
    let paying = 0,
      owes = 0,
      review = 0,
      blocked = 0,
      collected = 0,
      owed = 0,
      openLinks = 0;
    let top: Customer | null = null;
    let soonest: { c: Customer; at: string } | null = null;
    for (const e of all) {
      if (e.verification !== "Verified") review++;
      if (e.verification === "Action needed") blocked++;
      if (!e.paying && !e.owes) continue;
      const c = e.full();
      if (e.paying) {
        paying++;
        collected += c.paid30d;
        if (!top || c.paid30d > top.paid30d) top = c;
      }
      if (e.owes) {
        owes++;
        for (const l of c.openLinks) {
          owed += l.amount;
          openLinks++;
          if (!soonest || l.expiresAt < soonest.at)
            soonest = { c, at: l.expiresAt };
        }
      }
    }
    return {
      paying,
      owes,
      review,
      blocked,
      collected,
      owed,
      openLinks,
      top,
      soonest,
    };
  }, []);

  const tabCount = (t: Tab) =>
    t === "All"
      ? TOTAL
      : t === "Paying"
        ? stats.paying
        : t === "Owes you"
          ? stats.owes
          : stats.review;

  // Filter the whole book, then show one page. Search runs across all 100,000.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return getBook().filter(
      (e) =>
        matches(e, tab) &&
        (kind === "All" || e.kind === kind) &&
        (!needle || e.hay.includes(needle)),
    );
  }, [tab, kind, query]);
  const pager = usePager(filtered, "customers");
  const rows = pager.visible.map((e) => e.full());

  const go = (t: Tab) => {
    setTab(t);
    pager.setPage(1);
    setOpenId(null);
  };

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-16">
        {/* Heading */}
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Customers
            </h1>
            <p className="mt-1 text-[13px] text-neutral-500">
              The people and businesses who pay you.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setToast("Import takes a CSV of names and emails")}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              <Upload size={14} strokeWidth={1.75} />
              Import
            </button>
            <button
              type="button"
              onClick={() =>
                setToast(
                  "Add customer: name, email, and we send them the identity check",
                )
              }
              className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] pr-3.5 pl-3 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              <Plus size={14} strokeWidth={2} />
              Add customer
            </button>
          </div>
        </div>

        <UpdateNotice
          id="u-checkout"
          place="customers"
          cta="Open Payment links"
        />

        {/* Three facts, same shape as Payment links */}
        <div className="mt-8 grid gap-y-10 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Collected · 30 days"
            value={
              <span className="amount">
                <Roll value={usd(stats.collected).split(".")[0]} />
                <sub className="ml-px align-baseline text-[0.5em] font-normal tracking-normal text-neutral-500">
                  <Roll value={`.${usd(stats.collected).split(".")[1]}`} />
                </sub>
              </span>
            }
            aside={
              <span className="text-neutral-300">
                {count(stats.paying)} paying
              </span>
            }
            footer={
              <>
                <span>USD equivalent</span>
                {stats.top && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(stats.top!.name);
                      go("All");
                      setOpenId(stats.top!.id);
                    }}
                    className="truncate text-neutral-300 hover:text-white"
                  >
                    Top: {stats.top.name}
                  </button>
                )}
              </>
            }
          />
          <Fact
            label="Owed to you"
            value={
              <span className="amount">
                $<Roll value={compact(stats.owed)} />
              </span>
            }
            aside={
              <span className="text-neutral-300">
                {count(stats.openLinks)} open links
              </span>
            }
            footer={
              <>
                {stats.soonest ? (
                  <span className="truncate">
                    {stats.soonest.c.name} · link ends in{" "}
                    {daysUntil(stats.soonest.at)} days
                  </span>
                ) : (
                  <span>No open links</span>
                )}
                <button
                  type="button"
                  onClick={() => go("Owes you")}
                  className="flex shrink-0 items-center gap-0.5 text-neutral-200 transition-colors hover:text-white"
                >
                  Show
                  <ChevronRight size={13} strokeWidth={1.75} />
                </button>
              </>
            }
          />
          <Fact
            label="Identity checks"
            value={<Roll value={count(stats.review)} />}
            aside={
              stats.blocked > 0 ? (
                <span className="text-neutral-300">
                  {count(stats.blocked)} need you
                </span>
              ) : null
            }
            footer={
              <>
                <span className="truncate">
                  Unverified customers can pay up to $1,000
                </span>
                <button
                  type="button"
                  onClick={() => go("Needs review")}
                  className="flex shrink-0 items-center gap-0.5 text-neutral-200 transition-colors hover:text-white"
                >
                  Review
                  <ChevronRight size={13} strokeWidth={1.75} />
                </button>
              </>
            }
          />
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
                onClick={() => go(t)}
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
                  {compact(tabCount(t))}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Dropdown
              label="Type"
              value={kind}
              active={kind !== "All"}
              align="right"
              options={[
                { value: "All", label: "All types" },
                { value: "Individual", label: "Individuals" },
                { value: "Business", label: "Businesses" },
              ]}
              onChange={(v) => {
                setKind(v);
                pager.setPage(1);
              }}
            />
            <label className="flex h-9 w-[260px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 transition-colors hover:border-white/20 focus-within:border-white/35 focus-within:bg-transparent">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  pager.setPage(1);
                }}
                placeholder="Name, email or customer ID…"
                aria-label="Search customers"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setToast(
                  `Exporting ${count(filtered.length)} customers. We'll email the CSV.`,
                )
              }
              className="ml-1 flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={14} strokeWidth={1.75} />
              Export {compact(filtered.length)}
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col />
            <col className="w-[150px]" />
            <col className="w-[130px]" />
            <col className="w-[150px]" />
            <col className="w-[160px]" />
            <col className="w-[140px]" />
            <col className="w-[40px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-3 font-normal">Customer</th>
              <th className="py-2.5 font-normal">Type</th>
              <th className="py-2.5 font-normal">Identity</th>
              <th className="py-2.5 pr-6 text-right font-normal">Lifetime</th>
              <th className="py-2.5 font-normal">Last payment</th>
              <th className="py-2.5 pr-3 text-right font-normal">Owes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const open = openId === c.id;
              const owed = c.openLinks.reduce((s, l) => s + l.amount, 0);
              return (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : c.id)}
                    className={`cursor-pointer border-b border-white/6 transition-colors ${open ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}
                  >
                    <td className="py-3 pl-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={c.name} kind={c.kind} />
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-medium text-white">
                            {c.name}
                          </div>
                          <div className="truncate text-xs text-neutral-500">
                            {c.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="text-neutral-200">{c.kind}</div>
                      <div className="truncate text-xs text-neutral-500">
                        {c.country}
                      </div>
                    </td>
                    <td className="py-3">
                      <IdentityBadge v={c.verification} />
                    </td>
                    <td className="amount py-3 pr-6 text-right text-white tabular-nums">
                      {c.lifetime ? (
                        `$${usd(c.lifetime)}`
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {c.lastPayment ? (
                        <>
                          <div
                            className={
                              c.lastPayment.status === "Failed"
                                ? "text-red-300"
                                : "text-neutral-200"
                            }
                          >
                            {c.lastPayment.status === "Failed"
                              ? "Failed · "
                              : ""}
                            {dateFmt.format(new Date(c.lastPayment.at))}
                          </div>
                          <div className="truncate text-xs text-neutral-500">
                            {c.lastPayment.method}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-600">
                          No payments yet
                        </span>
                      )}
                    </td>
                    <td className="amount py-3 pr-3 text-right tabular-nums">
                      {owed ? (
                        <>
                          <div className="text-white">${usd(owed)}</div>
                          <div className="text-xs text-neutral-500">
                            {c.openLinks.length} link
                            {c.openLinks.length > 1 ? "s" : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
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
                        <Expanded
                          c={c}
                          onToast={setToast}
                          onCreateLink={() => setLinkFor(c)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="py-16 text-center text-[13px] text-neutral-500">
            No customers match
            {query.trim() ? ` "${query.trim()}"` : " these filters"}.
          </div>
        )}

        {rows.length > 0 && <TablePager pager={pager} noun="customers" />}
      </div>

      {linkFor && (
        <CreateFlow
          prefill={{ id: linkFor.id, name: linkFor.name, email: linkFor.email }}
          onClose={() => setLinkFor(null)}
          onCreated={(l) => setToast(`${l.name} created`)}
          onCopy={(l) => {
            navigator.clipboard
              ?.writeText(`https://pay.gravv.xyz/${l.slug}`)
              .catch(() => {});
            setToast("Link copied");
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[13px] font-medium text-black shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/** The opened row: who they are, what's stuck, what they've paid, and the next thing to do. */
function Expanded({
  c,
  onToast,
  onCreateLink,
}: {
  c: Customer;
  onToast: (t: string) => void;
  onCreateLink: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-[var(--surface)]">
      <div className="grid grid-cols-4 gap-6 px-5 py-4">
        <Detail label="Customer ID" value={c.id} mono copy />
        <Detail label="Email" value={c.email} copy />
        <Detail label="Country" value={c.country} />
        <Detail
          label="Customer since"
          value={fullDateFmt.format(new Date(c.createdAt))}
        />
      </div>

      {c.verification !== "Verified" && (
        <div className="mx-5 mb-4 flex items-center justify-between gap-4 rounded-lg bg-white/[0.04] px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] text-white">
              {c.verification === "Pending"
                ? "Identity check in progress"
                : "Identity check needs you"}
            </div>
            <div className="mt-0.5 text-xs text-neutral-400">
              {c.verificationNote}. Until it clears they can pay up to $1,000.
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onToast(
                `Sent ${c.name.split(" ")[0]} a new link to finish the check`,
              )
            }
            className="h-8 shrink-0 rounded-full bg-white/[0.08] px-3 text-[12.5px] text-white transition-colors hover:bg-white/[0.12]"
          >
            {c.verification === "Pending" ? "Send reminder" : "Ask again"}
          </button>
        </div>
      )}

      <div className="border-t border-white/8 px-5 py-3">
        <div className="text-xs text-neutral-500">Recent payments</div>
        {c.payments.length ? (
          <ul className="mt-1">
            {c.payments.slice(0, 3).map((p) => (
              <PaymentLine key={p.id} p={p} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-neutral-500">No payments yet.</p>
        )}
        {c.openLinks.length > 0 && (
          <>
            <div className="mt-3 text-xs text-neutral-500">Open links</div>
            <ul className="mt-1">
              {c.openLinks.map((l) => (
                <li
                  key={l.name}
                  className="flex items-center gap-4 py-1.5 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate text-neutral-200">
                    {l.name}
                  </span>
                  <span className="text-xs text-neutral-500">
                    ends in {daysUntil(l.expiresAt)} days
                  </span>
                  <span className="amount w-28 text-right text-white tabular-nums">
                    ${usd(l.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/8 px-5 py-3">
        <span className="text-xs text-neutral-500">
          {c.lifetime ? `$${usd(c.lifetime)} paid in total` : "Hasn't paid yet"}
          {c.paid30d ? ` · $${usd(c.paid30d)} in the last 30 days` : ""}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${c.id}`}
            className="flex h-8 items-center gap-0.5 rounded-full px-3 text-[12.5px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View all details
            <ChevronRight size={13} strokeWidth={1.75} />
          </Link>
          <button
            type="button"
            onClick={onCreateLink}
            className="flex h-8 items-center gap-1 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            <Plus size={13} strokeWidth={2} />
            Create link
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentLine({ p }: { p: CustomerPayment }) {
  return (
    <li className="flex items-center gap-4 py-1.5 text-[13px]">
      <span className="w-14 shrink-0 text-neutral-500">
        {dateFmt.format(new Date(p.at))}
      </span>
      <span className="min-w-0 flex-1 truncate text-neutral-200">{p.for}</span>
      <span className="text-xs text-neutral-500">{p.method}</span>
      <span
        className={`w-16 text-xs ${p.status === "Failed" ? "text-red-300" : p.status === "Refunded" ? "text-neutral-400" : "text-neutral-500"}`}
      >
        {p.status}
      </span>
      <span
        className={`amount w-28 text-right tabular-nums ${p.status === "Paid" ? "text-white" : "text-neutral-500 line-through decoration-neutral-600"}`}
      >
        ${usd(p.amount)}
      </span>
    </li>
  );
}

function Detail({
  label,
  value,
  mono,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 flex items-center gap-1">
        <span
          className={`truncate text-neutral-100 ${mono ? "font-mono text-[12.5px]" : "text-[13px]"}`}
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

/** Initials, round for people and squared for businesses, so the two read apart at a glance. */
export function Avatar({
  name,
  kind,
  size = 32,
}: {
  name: string;
  kind: CustomerKind;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  // People get a real face; businesses keep their initials on their own tint.
  if (kind !== "Business")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote placeholder portraits
      <img
        src={photoOf(name)}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className="shrink-0 rounded-full bg-white/[0.06] object-cover"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      className={`flex shrink-0 items-center justify-center font-medium ${toneClass(toneFor(name))} ${size > 36 ? "rounded-xl" : "rounded-lg"}`}
    >
      {initials}
    </span>
  );
}

export function IdentityBadge({ v }: { v: Verification }) {
  // Each state its own hue: done mint, waiting amber, on you rose.
  const tone =
    v === "Verified"
      ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : v === "Pending"
        ? "bg-amber-400/12 text-amber-300"
        : "bg-rose-400/12 text-rose-300";
  return (
    <span
      className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ${tone}`}
    >
      {v}
    </span>
  );
}

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
