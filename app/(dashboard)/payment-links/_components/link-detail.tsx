"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ChevronDown, ChevronLeft, Copy, ExternalLink } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import type { LinkPayment, PaymentLink } from "../_data";
import { linkStore, useLinks } from "../_store";
import {
  Badge,
  CreateFlow,
  Money,
  collected,
  dateFmt,
  daysLeft,
  longDate,
  paidOf,
  url,
} from "./links-workspace";

/** Looks the link up in the session store, so links made or edited here open too. */
export function LinkDetail({ id }: { id: string }) {
  const l = useLinks().find((x) => x.id === id);
  if (!l)
    return (
      <div className="mx-auto max-w-(--page-max) px-8 pt-8">
        <Link
          href="/payment-links"
          className="inline-flex items-center gap-0.5 text-[13px] text-neutral-500 transition-colors hover:text-white"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Payment links
        </Link>
        <h1 className="mt-5 text-[22px] font-medium tracking-[-0.02em] text-white">
          This link isn&apos;t here
        </h1>
        <p className="mt-2 text-[13px] text-neutral-400">
          It may have been archived, or it was made in another session. Go back
          to your links to find it.
        </p>
      </div>
    );
  return <LinkPage key={l.id} link={l} />;
}

/** The full link page: everything the row breakdown shows, plus every payment, the funnel, sharing and notes. */
function LinkPage({ link: l }: { link: PaymentLink }) {
  const status = l.status;
  const setStatus = (s: PaymentLink["status"]) =>
    linkStore.update(l.id, { status: s });
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | LinkPayment["status"]>("All");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const paid = paidOf(l);
  const shown = l.payments.filter(
    (p) => filter === "All" || p.status === filter,
  );
  const has = (s: LinkPayment["status"]) =>
    l.payments.some((p) => p.status === s);
  const left = l.expiresAt ? daysLeft(l.expiresAt) : null;
  const copy = () => {
    navigator.clipboard?.writeText(url(l)).catch(() => {});
    setToast("Link copied");
  };

  const edited = (l.edits ?? []).map((ed) => ({
    label: `Edited by ${ed.by}`,
    at: ed.at,
    note: `changed ${ed.changed.join(", ")}`,
    done: true,
  }));
  const events: { label: string; at?: string; note?: string; done: boolean }[] =
    [
      { label: "Link created", at: l.createdAt, done: true },
      ...(paid.length
        ? [
            {
              label: "First payment",
              at: paid[paid.length - 1].date,
              note: paid[paid.length - 1].payer,
              done: true,
            },
            ...(paid.length > 1
              ? [
                  {
                    label: "Latest payment",
                    at: paid[0].date,
                    note: paid[0].payer,
                    done: true,
                  },
                ]
              : []),
            ...edited,
          ]
        : [...edited, { label: "Waiting for the first payment", done: false }]),
      ...(l.expiresAt
        ? [
            {
              label: status === "Expired" ? "Expired" : "Expires",
              at: l.expiresAt,
              done: status === "Expired",
            },
          ]
        : []),
    ];

  // Of everyone who opened the link, how many started paying and how many finished.
  const funnel = [
    { label: "Opened", n: l.views },
    { label: "Started paying", n: l.started },
    { label: "Paid", n: paid.length },
  ];

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-8 pb-16">
        <Link
          href="/payment-links"
          className="inline-flex items-center gap-0.5 text-[13px] text-neutral-500 transition-colors hover:text-white"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Payment links
        </Link>

        {/* Heading */}
        <div className="mt-5 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[26px] font-medium tracking-[-0.025em] text-white">
                {l.name}
              </h1>
              <Badge status={status} />
            </div>
            <div className="mt-1 flex items-center gap-1 text-[13px] text-neutral-500">
              <span className="truncate">{url(l)}</span>
              <CopyButton value={url(l)} label="Copy link" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
                className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
              >
                More
                <ChevronDown
                  size={13}
                  strokeWidth={1.75}
                  className={`transition-transform ${menu ? "rotate-180" : ""}`}
                />
              </button>
              {menu && (
                <div
                  role="menu"
                  className="orbit-pop absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
                >
                  {[
                    {
                      label: "Edit",
                      run: () => setEditing(true),
                    },
                    ...(status === "Expired"
                      ? []
                      : [
                          {
                            label:
                              status === "Paused"
                                ? "Resume link"
                                : "Pause link",
                            run: () => {
                              setStatus(
                                status === "Paused" ? "Active" : "Paused",
                              );
                              setToast(
                                status === "Paused"
                                  ? "Link resumed"
                                  : "Link paused — it won't take payments",
                              );
                            },
                          },
                        ]),
                    {
                      label: "Duplicate",
                      run: () => setToast("Link duplicated"),
                    },
                    { label: "Archive", run: () => setToast("Link archived") },
                  ].map((i) => (
                    <button
                      key={i.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenu(false);
                        i.run();
                      }}
                      className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-[13px] text-neutral-200 hover:bg-white/[0.06] hover:text-white"
                    >
                      {i.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={copy}
              className="flex h-9 items-center gap-1.5 rounded-full bg-white/[0.08] pr-3.5 pl-3 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.12]"
            >
              <Copy size={14} strokeWidth={1.75} />
              Copy link
            </button>
            <a
              href={`/pay/${l.id}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-full border border-white/10 pr-3.5 pl-3 text-[13px] text-neutral-200 transition-colors hover:border-white/25 hover:text-white"
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              Open checkout
            </a>
          </div>
        </div>

        {/* Three facts */}
        <div className="mt-8 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Collected"
            value={<Money value={collected(l)} currency={l.currency} />}
            foot={`${paid.length} ${paid.length === 1 ? "payment" : "payments"}${l.limit ? ` · ${l.limit - paid.length} of ${l.limit} left` : ""}`}
          />
          <Fact
            label="Paid after opening"
            value={
              l.views ? `${((paid.length / l.views) * 100).toFixed(1)}%` : "—"
            }
            foot={`${l.views.toLocaleString("en-US")} opened · ${l.started.toLocaleString("en-US")} started paying`}
          />
          <Fact
            label={status === "Expired" ? "Expired" : "Expires"}
            value={
              l.expiresAt ? dateFmt.format(new Date(l.expiresAt)) : "Never"
            }
            foot={
              left === null
                ? "Takes payments until you pause it"
                : left > 0
                  ? `In ${left} days`
                  : `${Math.abs(left)} days ago`
            }
          />
        </div>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Payments */}
          <section className="min-w-0">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[15px] font-medium text-white">Payments</h2>
              <div role="tablist" className="flex items-center gap-1">
                {(
                  [
                    "All",
                    "Paid",
                    ...(has("Failed") ? (["Failed"] as const) : []),
                    ...(has("Refunded") ? (["Refunded"] as const) : []),
                  ] as const
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={filter === t}
                    onClick={() => setFilter(t)}
                    className={`h-7 rounded-full px-2.5 text-[12.5px] transition-colors ${filter === t ? "bg-white/[0.08] text-white" : "text-neutral-500 hover:text-neutral-200"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {shown.length ? (
              <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
                <colgroup>
                  <col className="w-[96px]" />
                  <col />
                  <col className="w-[130px]" />
                  <col className="w-[100px]" />
                  <col className="w-[130px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
                    <th className="py-2.5 pl-1 font-normal">Date</th>
                    <th className="py-2.5 font-normal">Payer</th>
                    <th className="py-2.5 font-normal">Method</th>
                    <th className="py-2.5 font-normal">Status</th>
                    <th className="py-2.5 pr-1 text-right font-normal">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className="border-b border-white/6">
                      <td className="py-3 pl-1 text-neutral-400">
                        {dateFmt.format(new Date(p.date))}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="truncate text-neutral-100">
                          {p.payer}
                        </div>
                        <div className="truncate text-xs text-neutral-500">
                          {p.email}
                        </div>
                      </td>
                      <td className="py-3 text-neutral-400">{p.method}</td>
                      <td
                        className={`py-3 ${p.status === "Failed" ? "text-red-300" : "text-neutral-400"}`}
                      >
                        {p.status}
                      </td>
                      <td
                        className={`amount py-3 pr-1 text-right tabular-nums ${p.status === "Paid" ? "text-white" : "text-neutral-500 line-through decoration-neutral-600"}`}
                      >
                        <Money value={p.amount} currency={l.currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 border-t border-white/15 py-10 text-center text-[13px] text-neutral-500">
                {l.payments.length
                  ? "No payments with this status."
                  : "No one has paid through this link yet."}
              </p>
            )}
          </section>

          {/* Side column */}
          <aside className="space-y-8 lg:sticky lg:top-6 lg:max-h-[calc(100dvh/var(--app-zoom)-7rem)] lg:overflow-y-auto sidebar-scroll lg:-mr-2 lg:pr-2">
            <section>
              <h2 className="text-[13px] text-neutral-500">Share</h2>
              <div className="mt-3 flex items-center gap-4">
                <div className="rounded-lg bg-[#fafafa] p-1.5">
                  <QRCodeSVG
                    value={url(l)}
                    size={84}
                    bgColor="#fafafa"
                    fgColor="#0a0a0a"
                  />
                </div>
                <p className="text-[12.5px] leading-relaxed text-neutral-500">
                  Scan to open the checkout. Right-click the code to save it for
                  print.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-[13px] text-neutral-500">Details</h2>
              <dl className="mt-3 space-y-3">
                <Detail
                  label="Price"
                  value={
                    l.amount === null ? (
                      `Any amount · ${l.currency}`
                    ) : (
                      <Money value={l.amount} currency={l.currency} />
                    )
                  }
                />
                <Detail label="Accepts" value={l.methods.join(", ")} />
                {l.customer && <Detail label="For" value={l.customer.name} />}
                <Detail
                  label="Limit"
                  value={
                    l.limit
                      ? `${l.limit} ${l.limit === 1 ? "payment" : "payments"}`
                      : "No limit"
                  }
                />
                {l.settlesTo && (
                  <Detail label="Settles to" value={l.settlesTo} />
                )}
                <Detail
                  label="After paying"
                  value={l.redirectUrl || "Stays on the Gravv page"}
                />
                <Detail
                  label="Created"
                  value={longDate.format(new Date(l.createdAt))}
                />
                <div className="flex items-center justify-between gap-4">
                  <dt className="shrink-0 text-[13px] text-neutral-500">
                    Link ID
                  </dt>
                  <dd className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-mono text-[12.5px] text-neutral-100">
                      {l.id}
                    </span>
                    <CopyButton value={l.id} label="Copy link ID" />
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="text-[13px] text-neutral-500">
                From opening to paying
              </h2>
              <ul className="mt-3 space-y-2.5">
                {funnel.map((f) => (
                  <li key={f.label}>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-neutral-300">{f.label}</span>
                      <span className="text-neutral-100 tabular-nums">
                        {f.n.toLocaleString("en-US")}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full bg-white/70"
                        style={{
                          width: `${l.views ? Math.max(2, (f.n / l.views) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-[13px] text-neutral-500">Timeline</h2>
              <ol className="mt-3">
                {events.map((e, i) => (
                  <li
                    key={`${e.label}-${i}`}
                    className="relative flex gap-3 pb-3.5 last:pb-0"
                  >
                    {i < events.length - 1 && (
                      <span
                        aria-hidden
                        className={`absolute top-3 bottom-0 left-[3.5px] w-px ${e.done ? "bg-white/25" : "bg-white/8"}`}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`relative mt-[5px] size-2 shrink-0 rounded-full ${e.done ? "bg-white" : "border border-white/30 bg-surface"}`}
                    />
                    <div className="min-w-0">
                      <div
                        className={`text-[13px] ${e.done ? "text-neutral-100" : "text-neutral-400"}`}
                      >
                        {e.label}
                      </div>
                      {(e.at || e.note) && (
                        <div className="text-xs text-neutral-500">
                          {e.at && longDate.format(new Date(e.at))}
                          {e.note && ` · ${e.note}`}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <label
                htmlFor="link-note"
                className="text-[13px] text-neutral-500"
              >
                Internal note
              </label>
              <textarea
                id="link-note"
                rows={3}
                placeholder="Only your team sees this"
                className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
              />
            </section>
          </aside>
        </div>
      </div>

      {editing && (
        <CreateFlow
          editing={l}
          onClose={() => setEditing(false)}
          onCreated={() => {}}
          onSaved={(next) => {
            linkStore.update(l.id, next);
            setToast("Link updated");
          }}
          onCopy={copy}
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

function Fact({
  label,
  value,
  foot,
}: {
  label: string;
  value: React.ReactNode;
  foot: string;
}) {
  return (
    <div className="flex min-w-0 flex-col border-white/8 lg:px-8 lg:first:pl-0 lg:last:pr-0 lg:[&:not(:first-child)]:border-l">
      <div className="text-[13px] text-neutral-500">{label}</div>
      <div className="amount mt-2 text-[30px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
        {value}
      </div>
      <div className="mt-3 truncate text-xs text-neutral-500">{foot}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-[13px] text-neutral-500">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[13px] text-neutral-100">
        {value}
      </dd>
    </div>
  );
}
