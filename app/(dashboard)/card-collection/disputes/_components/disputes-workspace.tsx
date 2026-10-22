"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check as CheckIcon, Paperclip, Search, X } from "lucide-react";
import { Roll } from "@/app/_components/roll";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { RowMenu } from "@/app/(dashboard)/trade-desk/_components/order-extras";
import { AS_OF } from "../../collections/_data";
import {
  Usdc,
  dayFmt,
  flag,
  short,
  usdc,
} from "../../collections/_components/collections-workspace";
import {
  REASONS,
  daysUntil,
  isOpen,
  type Dispute,
  type DisputeStatus,
} from "../_data";

type Tab = "All" | "Needs response" | "Under review" | "Won" | "Lost";
const inTab = (d: Dispute, t: Tab) =>
  t === "All"
    ? true
    : t === "Lost"
      ? d.status === "Lost" || d.status === "Accepted" || d.status === "Expired"
      : d.status === t;
const TABS: Tab[] = ["All", "Needs response", "Under review", "Won", "Lost"];

const dueWords = (d: Dispute) => {
  const n = daysUntil(d.dueAt);
  return n <= 0 ? "Due today" : n === 1 ? "Due tomorrow" : `In ${n} days`;
};

export function DisputesWorkspace({ initial }: { initial: Dispute[] }) {
  const [list, setList] = useState(initial);
  const [tab, setTab] = useState<Tab>("All");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [respondId, setRespondId] = useState<string | null>(null);
  const [acceptId, setAcceptId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (id: string, patch: Partial<Dispute>) =>
    setList((all) => all.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // ——— Facts ———
  const waiting = list
    .filter((d) => d.status === "Needs response")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const soonest = waiting[0];
  const atStake = waiting.reduce((s, d) => s + d.amount, 0);
  const held = list.filter(isOpen).reduce((s, d) => s + d.amount + d.fee, 0);
  const decided = list.filter((d) => !isOpen(d));
  const won = decided.filter((d) => d.status === "Won").length;
  const winRate = decided.length ? Math.round((won / decided.length) * 100) : 0;

  const q = query.trim().toLowerCase();
  const scoped = list.filter(
    (d) =>
      !q ||
      [
        d.id,
        d.payment.id,
        d.payment.customer.name,
        d.payment.customer.email,
        REASONS[d.reason].title,
      ].some((v) => v.toLowerCase().includes(q)),
  );
  const rows = scoped
    .filter((d) => inTab(d, tab))
    .sort((a, b) =>
      // Anything waiting on you first, soonest deadline on top; then newest.
      a.status === "Needs response" && b.status === "Needs response"
        ? a.dueAt.localeCompare(b.dueAt)
        : a.status === "Needs response"
          ? -1
          : b.status === "Needs response"
            ? 1
            : b.openedAt.localeCompare(a.openedAt),
    );

  const responding = list.find((d) => d.id === respondId) ?? null;
  const accepting = list.find((d) => d.id === acceptId) ?? null;
  const copy = (v: string, what: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    setToast(`${what} copied`);
  };

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-20">
        <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
          Disputes
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          When a customer asks their bank for a card payment back. Answer before
          the deadline, or the customer keeps the money.
        </p>

        <div className="mt-10 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Fact
            label="Needs your response"
            value={<Roll value={String(waiting.length)} />}
            aside={
              soonest ? (
                <span
                  className={
                    daysUntil(soonest.dueAt) <= 3
                      ? "text-rose-300"
                      : "text-neutral-400"
                  }
                >
                  Next {dueWords(soonest).toLowerCase()}
                </span>
              ) : null
            }
            footer={
              soonest ? (
                <>
                  <span className="truncate">
                    <span className="amount">{usdc(atStake)}</span> USDC at
                    stake
                  </span>
                  <button
                    type="button"
                    onClick={() => setRespondId(soonest.id)}
                    className="shrink-0 text-neutral-200 transition-colors hover:text-white"
                  >
                    Respond to the next one
                  </button>
                </>
              ) : (
                <span>Nothing waiting on you</span>
              )
            }
          />
          <Fact
            label="Held for open disputes"
            value={<Usdc value={held} big />}
            footer={
              <span>Amounts plus network fees · released if you win</span>
            }
          />
          <Fact
            label="Win rate"
            value={
              <span>
                <Roll value={String(winRate)} />
                <span className="text-[0.6em] text-neutral-500">%</span>
              </span>
            }
            aside={
              <span className="text-neutral-400 tabular-nums">
                {won} of {decided.length}
              </span>
            }
            footer={
              <span>Missed deadlines and accepted disputes count as lost</span>
            }
          />
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
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
                  {scoped.filter((d) => inTab(d, t)).length}
                </span>
              </button>
            ))}
          </div>
          <div className="flex h-9 w-[280px] items-center rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35 hover:border-white/20">
            <Search size={14} strokeWidth={1.75} className="text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Customer, payment ID or reason…"
              aria-label="Search disputes"
              className="min-w-0 flex-1 bg-transparent px-2 text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </div>
        </div>

        <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
          <colgroup>
            <col className="w-[120px]" />
            <col />
            <col className="w-[210px]" />
            <col className="w-[150px]" />
            <col className="w-[150px]" />
            <col className="w-[140px]" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className="py-2.5 pl-3 font-normal">Opened</th>
              <th className="py-2.5 font-normal">Reason</th>
              <th className="py-2.5 font-normal">Customer</th>
              <th className="py-2.5 pr-6 text-right font-normal">Amount</th>
              <th className="py-2.5 font-normal">Status</th>
              <th className="py-2.5 font-normal">Respond by</th>
              <th className="py-2.5 font-normal">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const open = openId === d.id;
              const r = REASONS[d.reason];
              const days = daysUntil(d.dueAt);
              return (
                <Fragment key={d.id}>
                  <tr
                    onClick={() => setOpenId(open ? null : d.id)}
                    className={`group cursor-pointer border-t border-white/6 transition-colors ${open ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
                  >
                    <td className="py-3 pl-3 text-neutral-200 tabular-nums">
                      {dayFmt.format(new Date(d.openedAt))}
                      <div className="text-[11px] text-neutral-500">
                        Updated{" "}
                        {dayFmt
                          .format(new Date(d.updatedAt))
                          .replace(/, \d{4}$/, "")}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="truncate text-white">{r.title}</div>
                      <div className="truncate text-[11px] text-neutral-500">
                        {r.network === "Gravv"
                          ? "Manual · Gravv risk"
                          : `${r.network} ${r.code}`}{" "}
                        ·{" "}
                        <span className="font-mono">
                          {short(d.payment.id, 13, 0)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="truncate text-neutral-100">
                        {d.payment.customer.name}
                      </div>
                      <div className="truncate text-[11px] text-neutral-500">
                        {d.payment.card.brand} ••{d.payment.card.last4}{" "}
                        {flag(d.payment.card.country)}
                      </div>
                    </td>
                    <td className="py-3 pr-6 text-right">
                      <div
                        className={
                          d.status === "Won"
                            ? "text-neutral-300"
                            : "font-medium text-white"
                        }
                      >
                        <Usdc value={d.amount} />
                      </div>
                      <div className="amount text-[11px] text-neutral-500 tabular-nums">
                        + {usdc(d.fee)} fee
                      </div>
                    </td>
                    <td className="py-3">
                      <Status status={d.status} />
                    </td>
                    <td className="py-3 tabular-nums">
                      {d.status === "Needs response" ? (
                        <>
                          <div
                            className={
                              days <= 3 ? "text-rose-300" : "text-neutral-200"
                            }
                          >
                            {dueWords(d)}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {dayFmt.format(new Date(d.dueAt))}
                          </div>
                        </>
                      ) : d.status === "Under review" ? (
                        <>
                          <div className="text-neutral-300">Answered</div>
                          <div className="text-[11px] text-neutral-500">
                            {d.response
                              ? dayFmt.format(new Date(d.response.at))
                              : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-neutral-600">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <RowMenu
                        label="Dispute actions"
                        items={[
                          ...(d.status === "Needs response"
                            ? [
                                {
                                  label: "Respond with evidence",
                                  run: () => setRespondId(d.id),
                                },
                                {
                                  label: "Accept dispute…",
                                  run: () => setAcceptId(d.id),
                                  danger: true,
                                },
                              ]
                            : []),
                          {
                            label: "Copy payment ID",
                            run: () => copy(d.payment.id, "Payment ID"),
                          },
                          {
                            label: "Copy dispute ID",
                            run: () => copy(d.id, "Dispute ID"),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-white/[0.04]">
                      <td colSpan={7} className="px-3 pb-4">
                        <Preview
                          d={d}
                          onClose={() => setOpenId(null)}
                          onRespond={() => setRespondId(d.id)}
                          onAccept={() => setAcceptId(d.id)}
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
                  colSpan={7}
                  className="border-t border-white/6 py-16 text-center text-neutral-500"
                >
                  {tab === "Needs response"
                    ? "Nothing waiting on you."
                    : "No disputes match."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {responding && (
        <RespondSheet
          d={responding}
          onClose={() => setRespondId(null)}
          onSend={(note, files) => {
            update(responding.id, {
              status: "Under review",
              updatedAt: new Date(AS_OF).toISOString(),
              response: {
                note,
                files,
                at: new Date(AS_OF).toISOString(),
              },
            });
            setRespondId(null);
            setToast(
              `Evidence sent to ${REASONS[responding.reason].network === "Gravv" ? "Gravv risk" : REASONS[responding.reason].network} — decisions usually take 30–75 days`,
            );
          }}
        />
      )}

      {accepting && (
        <AcceptDialog
          d={accepting}
          onClose={() => setAcceptId(null)}
          onAccept={() => {
            update(accepting.id, {
              status: "Accepted",
              updatedAt: new Date(AS_OF).toISOString(),
              outcomeNote: "You accepted it. The customer kept the money.",
            });
            setAcceptId(null);
            setToast("Dispute accepted");
          }}
        />
      )}

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
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className="text-[34px] leading-none font-medium tracking-[-0.035em] text-white tabular-nums">
          {value}
        </span>
        {aside && (
          <span className="text-[13px] whitespace-nowrap">{aside}</span>
        )}
      </div>
      <div className="mt-4 flex min-w-0 items-center justify-between gap-3 text-xs text-neutral-500">
        {footer}
      </div>
    </div>
  );
}

/** Words, one chip size. Amber only where you have to act; rose where the money went. */
function Status({ status }: { status: DisputeStatus }) {
  const tone =
    status === "Needs response"
      ? "border-transparent bg-amber-300/10 text-amber-200"
      : status === "Under review"
        ? "border-transparent bg-blue-400/12 text-blue-300"
        : status === "Won"
          ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
          : status === "Accepted"
            ? "border-transparent bg-white/[0.06] text-neutral-300"
            : "border-transparent bg-rose-400/10 text-rose-300";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap ${tone}`}
    >
      {status}
    </span>
  );
}

/** What the payment's own checks say about this claim, so the merchant knows if they can win. */
function signalFor(d: Dispute) {
  const p = d.payment;
  if (d.reason === "fraud" || d.reason === "manual") {
    if (p.threeDS === "Challenge" || p.threeDS === "Frictionless")
      return {
        good: true,
        text: `3-D Secure passed on this payment — the cardholder's bank confirmed it was them. That's your strongest evidence, and Gravv attaches it.`,
      };
    return {
      good: false,
      text: "No 3-D Secure on this payment, so you'll need other proof it was the cardholder — past orders, matching email or device.",
    };
  }
  return {
    good: true,
    text: `Protection approved this payment (risk ${p.riskScore} of 100). The bank will want proof about the purchase itself.`,
  };
}

function Preview({
  d,
  onClose,
  onRespond,
  onAccept,
}: {
  d: Dispute;
  onClose: () => void;
  onRespond: () => void;
  onAccept: () => void;
}) {
  const r = REASONS[d.reason];
  const signal = signalFor(d);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="orbit-pop cursor-default rounded-xl border border-white/8 bg-surface"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid gap-8 px-5 py-4 whitespace-normal lg:grid-cols-2">
        <div>
          <div className="text-[11px] text-neutral-500">
            What they&apos;re saying
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-100">
            {r.claim}
          </p>
          <p
            className={`mt-3 text-[13px] leading-relaxed ${signal.good ? "text-neutral-300" : "text-amber-200"}`}
          >
            {signal.text}
          </p>
        </div>
        <div>
          {d.status === "Needs response" ? (
            <>
              <div className="text-[11px] text-neutral-500">What wins this</div>
              <ul className="mt-1 space-y-1.5 text-[13px] leading-relaxed text-neutral-300">
                {r.evidence.map((e) => (
                  <li key={e} className="flex gap-2">
                    <span className="text-neutral-600">—</span>
                    {e}
                  </li>
                ))}
              </ul>
            </>
          ) : d.response && d.status === "Under review" ? (
            <>
              <div className="text-[11px] text-neutral-500">You sent</div>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-300">
                “{d.response.note}”
              </p>
              <div className="mt-2 text-[12px] text-neutral-500">
                {d.response.files.length
                  ? d.response.files.join(" · ")
                  : "No files"}{" "}
                · plus the payment record Gravv attached
              </div>
            </>
          ) : (
            <>
              <div className="text-[11px] text-neutral-500">Outcome</div>
              <p
                className={`mt-1 text-[13px] leading-relaxed ${d.status === "Won" ? "text-[var(--ok-fg)]" : "text-neutral-300"}`}
              >
                {d.outcomeNote}
              </p>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-white/6 px-5 py-2.5">
        <span className="truncate text-[12px] text-neutral-500">
          {d.status === "Needs response" ? (
            <>
              Respond by {dayFmt.format(new Date(d.dueAt))} · if you lose,{" "}
              <span className="amount text-neutral-300">
                {usdc(d.amount + d.fee)} USDC
              </span>{" "}
              goes (amount + fee)
            </>
          ) : d.status === "Under review" ? (
            <>
              <span className="amount">{usdc(d.amount + d.fee)}</span> USDC held
              until the bank decides
            </>
          ) : d.status === "Won" ? (
            <>
              <span className="amount">{usdc(d.amount + d.fee)}</span> USDC
              released back to your wallet
            </>
          ) : (
            <>
              <span className="amount">{usdc(d.amount + d.fee)}</span> USDC lost
              (amount + fee)
            </>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/card-collection/collections"
            className="h-8 rounded-full px-3 text-[13px] leading-8 text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            View payment
          </Link>
          {d.status === "Needs response" && (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="h-8 rounded-full px-3 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={onRespond}
                className="h-8 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                Respond
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Build the reply: Gravv's own record goes in automatically; you add the story and files. */
function RespondSheet({
  d,
  onClose,
  onSend,
}: {
  d: Dispute;
  onClose: () => void;
  onSend: (note: string, files: string[]) => void;
}) {
  const r = REASONS[d.reason];
  const p = d.payment;
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const guard = useDiscardGuard(onClose);
  const ready = note.trim().length >= 20;
  const days = daysUntil(d.dueAt);
  const to = r.network === "Gravv" ? "Gravv risk" : r.network;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || guard.asking) return;
      e.stopImmediatePropagation();
      guard.requestClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [guard]);

  const auto = [
    `Payment record · ${short(p.id, 13, 0)} · ${dayFmt.format(new Date(p.createdAt))}`,
    `Protection · ${p.protection === "Review" ? "reviewed, approved" : p.protection.toLowerCase()} · risk ${p.riskScore} of 100`,
    p.threeDS === "Not required"
      ? "3-D Secure · not used on this payment"
      : `3-D Secure · ${p.threeDS.toLowerCase()} passed`,
    `CVC check · ${p.cvc.toLowerCase()}`,
    `Customer · ${p.customer.name}, ${p.customer.email}`,
    p.source.kind === "Payment link"
      ? `Checkout · payment link “${p.source.name}”`
      : "Checkout · your integration (API)",
  ];

  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.35)]"
        onClick={guard.requestClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Respond to dispute"
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[520px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        {guard.asking && (
          <DiscardConfirm
            title="Discard your response?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
            className="fixed inset-0"
          />
        )}
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">
              {r.network === "Gravv" ? "Manual" : `${r.network} ${r.code}`} ·{" "}
              {p.customer.name}
            </div>
            <h2 className="mt-1 text-[20px] font-medium tracking-[-0.02em] text-white">
              {r.title}
            </h2>
            <div className="mt-1 text-[13px] text-neutral-400">
              <span className="amount">{usdc(d.amount)}</span> USDC ·{" "}
              <span className={days <= 3 ? "text-rose-300" : ""}>
                respond by {dayFmt.format(new Date(d.dueAt))} (
                {dueWords(d).toLowerCase()})
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={guard.requestClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-7 px-6 py-6">
          <section>
            <h3 className="text-[13px] font-medium text-white">
              Gravv attaches this for you
            </h3>
            <ul className="mt-2.5 space-y-1.5">
              {auto.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-2 text-[13px] text-neutral-300"
                >
                  <CheckIcon
                    size={14}
                    strokeWidth={2}
                    className="mt-[3px] shrink-0 text-[var(--flow-in)]"
                  />
                  {a}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <label
              htmlFor="dispute-note"
              className="text-[13px] font-medium text-white"
            >
              What happened
            </label>
            <p className="mt-1 text-[12px] leading-relaxed text-neutral-500">
              Write it for the bank: what the customer bought, when they got it,
              and why the claim doesn&apos;t hold.
            </p>
            <textarea
              id="dispute-note"
              rows={6}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`e.g. ${p.customer.name.split(" ")[0]} bought “${p.source.kind === "Payment link" ? p.source.name : "an order"}” on ${dayFmt.format(new Date(p.createdAt))} and…`}
              className="mt-2.5 w-full resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-neutral-600 focus:border-white/35"
            />
            {note.length > 0 && !ready && (
              <div className="mt-1 text-[12px] text-neutral-500">
                A little more — banks rarely side with a one-line answer.
              </div>
            )}
          </section>

          <section>
            <h3 className="text-[13px] font-medium text-white">
              Your evidence
            </h3>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-neutral-500">
              {r.evidence.map((e) => (
                <li key={e}>— {e}</li>
              ))}
            </ul>
            {files.length > 0 && (
              <ul className="mt-3 divide-y divide-white/6 rounded-lg border border-white/8">
                {files.map((f) => (
                  <li
                    key={f}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-[13px] text-neutral-200"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Paperclip
                        size={13}
                        strokeWidth={1.75}
                        className="shrink-0 text-neutral-500"
                      />
                      <span className="truncate">{f}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${f}`}
                      onClick={() =>
                        setFiles((xs) => xs.filter((x) => x !== f))
                      }
                      className="flex size-6 items-center justify-center rounded-md text-neutral-500 hover:bg-white/8 hover:text-white"
                    >
                      <X size={13} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const names = [...(e.target.files ?? [])].map((f) => f.name);
                setFiles((xs) => [...new Set([...xs, ...names])]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-3 flex h-9 items-center gap-1.5 rounded-full border border-white/12 px-3.5 text-[13px] text-neutral-200 transition-colors hover:border-white/30"
            >
              <Paperclip size={13} strokeWidth={1.75} />
              Add files
              <span className="text-neutral-500">PDF or image</span>
            </button>
          </section>
        </div>

        <div className="mt-auto flex items-center justify-between gap-4 border-t border-white/8 px-6 py-4">
          <span className="text-[12px] text-neutral-500">
            You can only send once — check it first.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={guard.requestClose}
              className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => {
                guard.clear();
                onSend(note.trim(), files);
              }}
              className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
            >
              Send to {to}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function AcceptDialog({
  d,
  onClose,
  onAccept,
}: {
  d: Dispute;
  onClose: () => void;
  onAccept: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-[20vh]">
      <div aria-hidden className="absolute inset-0" onClick={onClose} />
      <div
        role="alertdialog"
        aria-labelledby="accept-title"
        className="orbit-pop relative w-[400px] rounded-2xl border border-white/10 bg-raised p-5 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <h2 id="accept-title" className="text-[15px] font-medium text-white">
          Accept this dispute?
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
          {d.payment.customer.name} keeps{" "}
          <span className="amount text-neutral-200">{usdc(d.amount)} USDC</span>
          , and the{" "}
          <span className="amount text-neutral-200">{usdc(d.fee)} USDC</span>{" "}
          network fee isn&apos;t returned. You can&apos;t undo this.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
          >
            Keep it open
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="h-9 rounded-full px-4 text-[13px] text-rose-400 hover:bg-rose-500/10"
          >
            Accept dispute
          </button>
        </div>
      </div>
    </div>
  );
}
