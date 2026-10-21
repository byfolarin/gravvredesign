"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Plus } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { dateFmt, fullDateFmt } from "../../cards/_lib/format";
import { AS_OF, DAY, type Customer, type CustomerPayment } from "../_data";
import { Avatar, IdentityBadge } from "./customers-workspace";
import { CreateFlow } from "../../payment-links/_components/links-workspace";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const daysUntil = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - AS_OF) / DAY));

/** The full customer page: everything the row breakdown shows, plus history, identity steps and notes. */
export function CustomerDetail({ c }: { c: Customer }) {
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | CustomerPayment["status"]>("All");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const owed = c.openLinks.reduce((s, l) => s + l.amount, 0);
  const shown = c.payments.filter((p) => filter === "All" || p.status === filter);
  const failed = c.payments.filter((p) => p.status === "Failed").length;
  const [creating, setCreating] = useState(false);

  // Identity check, step by step, in the order the customer goes through it.
  const steps: { label: string; state: "done" | "now" | "todo"; note?: string }[] =
    c.verification === "Verified"
      ? [
          { label: "Email confirmed", state: "done" },
          { label: "ID document", state: "done" },
          { label: "Selfie match", state: "done" },
        ]
      : c.verification === "Pending"
        ? [
            { label: "Email confirmed", state: "done" },
            { label: "ID document", state: /uploaded/i.test(c.verificationNote ?? "") ? "done" : "now" },
            { label: "Selfie match", state: /uploaded/i.test(c.verificationNote ?? "") ? "now" : "todo", note: c.verificationNote },
          ]
        : [
            { label: "Email confirmed", state: "done" },
            { label: "ID document", state: "now", note: c.verificationNote },
            { label: "Selfie match", state: "todo" },
          ];

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 pt-8 pb-16">
        <Link
          href="/customers"
          className="inline-flex items-center gap-0.5 text-[13px] text-neutral-500 transition-colors hover:text-white"
        >
          <ChevronLeft size={14} strokeWidth={1.75} />
          Customers
        </Link>

        {/* Heading */}
        <div className="mt-5 flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={c.name} kind={c.kind} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="truncate text-[26px] font-medium tracking-[-0.025em] text-white">{c.name}</h1>
                <IdentityBadge v={c.verification} />
              </div>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                {c.kind} · {c.country} · customer since {fullDateFmt.format(new Date(c.createdAt))}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setToast("Editing a customer is next")}
              className="flex h-9 items-center rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Edit
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

        {/* Three facts */}
        <div className="mt-8 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Paid in total"
            value={c.lifetime ? `$${usd(c.lifetime)}` : "—"}
            foot={`Since ${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(c.createdAt))}`}
          />
          <Fact
            label="Last 30 days"
            value={c.paid30d ? `$${usd(c.paid30d)}` : "—"}
            foot={
              c.lastPayment
                ? `${c.lastPayment.status === "Failed" ? "Last attempt failed" : c.lastPayment.status === "Refunded" ? "Last payment refunded" : "Last paid"} ${dateFmt.format(new Date(c.lastPayment.at))} · ${c.lastPayment.method}`
                : "No payments yet"
            }
          />
          <Fact
            label="Owes you"
            value={owed ? `$${usd(owed)}` : "—"}
            foot={
              c.openLinks.length
                ? `${c.openLinks.length} open link${c.openLinks.length > 1 ? "s" : ""} · next ends in ${Math.min(...c.openLinks.map((l) => daysUntil(l.expiresAt)))} days`
                : "Nothing outstanding"
            }
          />
        </div>

        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column */}
          <div className="min-w-0">
            {c.verification !== "Verified" && (
              <div className="mb-8 flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] px-5 py-4">
                <div className="min-w-0">
                  <div className="text-[14px] text-white">
                    {c.verification === "Pending" ? "Identity check in progress" : "Identity check needs you"}
                  </div>
                  <div className="mt-0.5 text-[13px] text-neutral-400">
                    {c.verificationNote}. Until it clears they can pay up to $1,000.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToast(`Sent ${c.name.split(" ")[0]} a new link to finish the check`)}
                  className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
                >
                  {c.verification === "Pending" ? "Send reminder" : "Ask again"}
                </button>
              </div>
            )}

            <MonthlyBars payments={c.payments} />

            <section>
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[15px] font-medium text-white">Payments</h2>
                <div role="tablist" className="flex items-center gap-1">
                  {(["All", "Paid", ...(failed ? (["Failed"] as const) : []), "Refunded"] as const).map((t) => (
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
                      <th className="py-2.5 font-normal">For</th>
                      <th className="py-2.5 font-normal">Method</th>
                      <th className="py-2.5 font-normal">Status</th>
                      <th className="py-2.5 pr-1 text-right font-normal">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => (
                      <tr key={p.id} className="border-b border-white/6">
                        <td className="py-3 pl-1 text-neutral-400">{dateFmt.format(new Date(p.at))}</td>
                        <td className="truncate py-3 pr-4 text-neutral-100">{p.for}</td>
                        <td className="py-3 text-neutral-400">{p.method}</td>
                        <td className={`py-3 ${p.status === "Failed" ? "text-red-300" : "text-neutral-400"}`}>{p.status}</td>
                        <td
                          className={`amount py-3 pr-1 text-right tabular-nums ${p.status === "Paid" ? "text-white" : "text-neutral-500 line-through decoration-neutral-600"}`}
                        >
                          ${usd(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 border-t border-white/15 py-10 text-center text-[13px] text-neutral-500">
                  {c.payments.length ? "No payments with this status." : `${c.name.split(" ")[0]} hasn't paid you yet.`}
                </p>
              )}
            </section>

            <section className="mt-10">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[15px] font-medium text-white">Open links</h2>
                <button type="button" onClick={() => setCreating(true)} className="text-[12.5px] text-neutral-400 transition-colors hover:text-white">
                  New link
                </button>
              </div>
              {c.openLinks.length ? (
                <ul className="mt-3 border-t border-white/15">
                  {c.openLinks.map((l) => (
                    <li key={l.name} className="flex items-center gap-4 border-b border-white/6 py-3 text-[13px]">
                      <span className="min-w-0 flex-1 truncate text-neutral-100">{l.name}</span>
                      <span className="text-xs text-neutral-500">ends in {daysUntil(l.expiresAt)} days</span>
                      <span className="amount w-32 text-right text-white tabular-nums">${usd(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 border-t border-white/15 py-8 text-center text-[13px] text-neutral-500">
                  No open links. Create one to request a payment.
                </p>
              )}
            </section>
          </div>

          {/* Side column */}
          <aside className="space-y-8 lg:sticky lg:top-6 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto sidebar-scroll lg:-mr-2 lg:pr-2">
            <section>
              <h2 className="text-[13px] text-neutral-500">Details</h2>
              <dl className="mt-3 space-y-3">
                <Detail label="Customer ID" value={c.id} mono copy />
                <Detail label="Email" value={c.email} copy />
                <Detail label="Type" value={c.kind} />
                <Detail label="Country" value={c.country} />
                <Detail label="Customer since" value={fullDateFmt.format(new Date(c.createdAt))} />
              </dl>
            </section>

            <section>
              <h2 className="text-[13px] text-neutral-500">Identity check</h2>
              <ol className="mt-3">
                {steps.map((s, i) => (
                  <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && (
                      <span
                        aria-hidden
                        className={`absolute top-5 bottom-0 left-[9px] w-px ${s.state === "done" ? "bg-white/25" : "bg-white/8"}`}
                      />
                    )}
                    <span
                      aria-hidden
                      className={`relative flex size-[19px] shrink-0 items-center justify-center rounded-full ${
                        s.state === "done"
                          ? "bg-white text-black"
                          : s.state === "now"
                            ? "border border-white text-white"
                            : "border border-white/20"
                      }`}
                    >
                      {s.state === "done" && <Check size={11} strokeWidth={3} />}
                      {s.state === "now" && <span className="size-1.5 rounded-full bg-current" />}
                    </span>
                    <div className="min-w-0 pt-px">
                      <div className={`text-[13px] ${s.state === "todo" ? "text-neutral-500" : "text-neutral-100"}`}>
                        {s.label}
                      </div>
                      {s.note && <div className="mt-0.5 text-xs text-neutral-500">{s.note}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <label htmlFor="cus-note" className="text-[13px] text-neutral-500">
                Internal note
              </label>
              <textarea
                id="cus-note"
                rows={3}
                placeholder="Only your team sees this"
                className="mt-3 w-full resize-none rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/30"
              />
            </section>
          </aside>
        </div>
      </div>

      {creating && (
        <CreateFlow
          prefill={{ id: c.id, name: c.name, email: c.email }}
          onClose={() => setCreating(false)}
          onCreated={(l) => setToast(`${l.name} created`)}
          onCopy={(l) => {
            navigator.clipboard?.writeText(`https://pay.gravv.xyz/${l.slug}`).catch(() => {});
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

/**
 * Paid per month over the last 12 months. Only drawn when there's a pattern to see (4+ payments
 * across 3+ months); for everyone else the payments table says it better.
 */
function MonthlyBars({ payments }: { payments: CustomerPayment[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const end = new Date(AS_OF);
  const months = Array.from({ length: 12 }, (_, k) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + k, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), total: 0, n: 0 };
  });
  for (const p of payments) {
    if (p.status !== "Paid") continue;
    const d = new Date(p.at);
    const b = months.find((x) => x.y === d.getUTCFullYear() && x.m === d.getUTCMonth());
    if (b) {
      b.total += p.amount;
      b.n++;
    }
  }
  const active = months.filter((b) => b.n > 0).length;
  const count = months.reduce((s, b) => s + b.n, 0);
  if (count < 4 || active < 3) return null;

  const max = Math.max(...months.map((b) => b.total));
  const sum = months.reduce((s, b) => s + b.total, 0);
  // Average over the months they've been paying, not months before they were a customer.
  const first = months.findIndex((b) => b.n > 0);
  const span = 12 - first;
  const short = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const label = (b: (typeof months)[number]) => new Date(Date.UTC(b.y, b.m, 1));

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-[15px] font-medium text-white">Paid per month</h2>
        <span className="text-xs text-neutral-500 tabular-nums">
          Avg ${usd(sum / span)} a month · {first === 0 ? "last 12 months" : `since ${short.format(label(months[first]))}`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`Paid per month, last 12 months: ${months.map((b) => `${short.format(label(b))} $${usd(b.total)}`).join(", ")}`}
        className="relative mt-4"
      >
        <div className="flex h-24 items-end gap-1.5 border-b border-white/10">
          {months.map((b, i) => {
            const h = b.total ? Math.max(4, (b.total / max) * 100) : 0;
            const on = hover === i;
            return (
              <button
                key={i}
                type="button"
                aria-label={`${long.format(label(b))}: $${usd(b.total)}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="relative flex h-full flex-1 items-end outline-none"
              >
                {b.total ? (
                  <span
                    className={`w-full rounded-t-[4px] transition-colors ${on ? "bg-white" : hover === null ? "bg-white/60" : "bg-white/25"}`}
                    style={{ height: `${h}%` }}
                  />
                ) : (
                  <span className={`w-full border-t border-dashed ${on ? "border-white/40" : "border-white/15"}`} />
                )}
                {on && (
                  <span
                    className={`pointer-events-none absolute bottom-[calc(100%+6px)] z-10 rounded-lg bg-raised px-2.5 py-1.5 text-left whitespace-nowrap shadow-xl ring-1 ring-white/10 ${i > 8 ? "right-0" : i < 3 ? "left-0" : "left-1/2 -translate-x-1/2"}`}
                  >
                    <span className="block text-[11px] text-neutral-500">{long.format(label(b))}</span>
                    <span className="amount block text-[13px] text-white tabular-nums">
                      {b.n ? `$${usd(b.total)} · ${b.n} payment${b.n > 1 ? "s" : ""}` : "No payments"}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          {months.map((b, i) => (
            <span
              key={i}
              className={`flex-1 text-center text-[11px] ${hover === i ? "text-neutral-200" : "text-neutral-500"}`}
            >
              {short.format(label(b))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value, foot }: { label: string; value: string; foot: string }) {
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

function Detail({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-[13px] text-neutral-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <span className={`truncate text-neutral-100 ${mono ? "font-mono text-[12.5px]" : "text-[13px]"}`}>{value}</span>
        {copy && <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />}
      </dd>
    </div>
  );
}
