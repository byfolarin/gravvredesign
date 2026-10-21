"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Archive,
  ChevronDown,
  Download,
  Pencil,
  Search,
  Send,
  X,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { SEND_EVENT } from "@/app/_components/top-bar";
import { RowMenu } from "@/app/(dashboard)/trade-desk/_components/order-extras";
import { RecipientAvatar } from "./recipient-avatar";
import { SendMoneyFlow, arrival } from "./send-money";
import { AskForDetails, COUNTRIES, RecipientFlow } from "./recipient-flow";
import type { FundingSource } from "../../cards/_data";
import type { Recipient, RecipientPayment, VerificationStep } from "../_data";
import { dateFmt, fullDateFmt } from "../../cards/_lib/format";

type Tab = "All" | "Ready to pay" | "Needs attention";
const TABS: Tab[] = ["All", "Ready to pay", "Needs attention"];

const amount = (v: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(v);
/** How Gravv names the way money arrives: "Mobile money" for wallets, otherwise the rail. */
const railLabel = (r: Recipient) =>
  r.institutionType === "Mobile money"
    ? "Mobile money"
    : r.rail === "Local transfer"
      ? "Bank account"
      : r.rail;
const flagOf = (country: string) =>
  COUNTRIES.find((c) => c.name === country)?.flag ?? "";

const lastPayment = (r: Recipient) =>
  r.payments.reduce<RecipientPayment | undefined>(
    (a, p) => (!a || p.date > a.date ? p : a),
    undefined,
  );
const totalPaid = (r: Recipient) =>
  r.payments
    .filter((p) => p.status === "Completed")
    .reduce((sum, p) => sum + p.amount, 0);

type Problem = {
  label: string;
  detail: string;
  tone: "bad" | "warn" | "wait";
  fix?: "bank" | "archive" | "copy-link";
  fixLabel?: string;
};

/** The one thing stopping you paying someone, in words — or null if they're ready. */
function problemOf(r: Recipient, all: Recipient[]): Problem | null {
  const last = lastPayment(r);
  if (last?.failure)
    return {
      label: "Account closed",
      detail: last.failure,
      tone: "bad",
      fix: "bank",
      fixLabel: "Update bank details",
    };
  if (r.invite)
    return {
      label: "Waiting for their details",
      detail: `We emailed ${r.invite.email} a secure link on ${dateFmt.format(new Date(r.invite.sentAt))}. It expires in 7 days.`,
      tone: "wait",
      fix: "copy-link",
      fixLabel: "Copy link",
    };
  const twin =
    all.find((x) => x.id === r.duplicateOf) ??
    all.find((x) => x.duplicateOf === r.id);
  if (twin)
    return {
      label: "Duplicate",
      detail: `Same bank details as the ${twin.name} added on ${dateFmt.format(new Date(twin.createdAt))}. Keep one and archive the other.`,
      tone: "warn",
      fix: "archive",
      fixLabel: "Archive this one",
    };
  const step = r.verification?.find((v) => v.state === "current");
  if (r.status === "Pending" && step?.note?.includes("too short"))
    return {
      label: "Check account number",
      detail: step.note,
      tone: "warn",
      fix: "bank",
      fixLabel: "Update bank details",
    };
  if (r.status === "Pending")
    return {
      label: "Verifying bank",
      detail: step?.note ?? "Gravv is checking the account with the bank.",
      tone: "wait",
    };
  return null;
}

/** Status only when something's wrong: words, one chip size. */
function ProblemChip({ p }: { p: Problem }) {
  const tone =
    p.tone === "bad"
      ? "border-transparent bg-rose-400/10 text-rose-300"
      : p.tone === "warn"
        ? "border-transparent bg-amber-300/10 text-amber-200"
        : "border-dashed border-white/20 text-neutral-300";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium whitespace-nowrap ${tone}`}
    >
      {p.label}
    </span>
  );
}

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
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  // null = closed; "" = open on the recipient picker; an id = open on that recipient.
  const [sending, setSending] = useState<string | null>(null);
  const [flow, setFlow] = useState<
    | { mode: "add" }
    | { mode: "edit"; id: string; focus?: "bank" }
    | { mode: "ask" }
    | null
  >(null);
  const [addMenu, setAddMenu] = useState(false);

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
  useEffect(() => {
    if (!addMenu) return;
    const close = () => setAddMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [addMenu]);

  const problems = new Map(list.map((r) => [r.id, problemOf(r, list)]));
  const ready = (r: Recipient) => !problems.get(r.id);
  const nextId = `rcp_new${(list.length + 1).toString(36)}${list.length * 7919}`;

  const q = query.trim().toLowerCase();
  const scoped = list
    .filter((r) => currency === "All" || r.currency === currency)
    .filter(
      (r) =>
        !q ||
        [r.name, r.institution, r.account ?? "", r.id, r.email ?? ""].some(
          (v) => v.toLowerCase().includes(q),
        ),
    );
  const inTab = (r: Recipient, t: Tab) =>
    t === "All" ? true : t === "Ready to pay" ? ready(r) : !ready(r);
  // Most recently paid first; never-paid follow, newest first.
  const rows = scoped
    .filter((r) => inTab(r, tab))
    .sort((a, b) => {
      const la = lastPayment(a)?.date ?? "";
      const lb = lastPayment(b)?.date ?? "";
      return lb.localeCompare(la) || b.createdAt.localeCompare(a.createdAt);
    });
  const currencies = ["All", ...new Set(list.map((r) => r.currency))];
  const selected = list.find((r) => r.id === selectedId) ?? null;
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const picked = list.filter((r) => checked.has(r.id));

  const archive = (ids: string[]) => {
    const names = list.filter((r) => ids.includes(r.id)).map((r) => r.name);
    setList((l) =>
      l
        .filter((r) => !ids.includes(r.id))
        // The twin left behind is no longer a duplicate.
        .map((r) =>
          r.duplicateOf && ids.includes(r.duplicateOf)
            ? { ...r, duplicateOf: undefined }
            : r,
        ),
    );
    setChecked(new Set());
    if (selectedId && ids.includes(selectedId)) setSelectedId(null);
    setToast(
      names.length === 1
        ? `${names[0]} archived`
        : `${names.length} recipients archived`,
    );
  };
  const fix = (r: Recipient, p: Problem) => {
    if (p.fix === "bank") setFlow({ mode: "edit", id: r.id, focus: "bank" });
    if (p.fix === "archive") archive([r.id]);
    if (p.fix === "copy-link" && r.invite) {
      navigator.clipboard?.writeText(r.invite.link).catch(() => {});
      setToast(
        "Link copied — send it to them yourself if the email didn't land",
      );
    }
  };
  const editing =
    flow?.mode === "edit" ? list.find((r) => r.id === flow.id) : undefined;

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-[1180px] px-8 pt-12 pb-24">
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
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex">
              <button
                type="button"
                onClick={() => setFlow({ mode: "add" })}
                className="h-9 rounded-l-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
              >
                Add recipient
              </button>
              <button
                type="button"
                aria-label="More ways to add"
                aria-haspopup="menu"
                aria-expanded={addMenu}
                onClick={() => setAddMenu((v) => !v)}
                className="flex h-9 w-8 items-center justify-center rounded-r-full border-l border-black/10 bg-white text-black transition-colors hover:bg-neutral-200"
              >
                <ChevronDown size={14} strokeWidth={2} />
              </button>
            </div>
            {addMenu && (
              <div
                role="menu"
                className="orbit-pop absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-raised p-1.5 shadow-2xl"
              >
                {[
                  {
                    label: "Enter their details",
                    sub: "You have their bank account",
                    run: () => setFlow({ mode: "add" }),
                  },
                  {
                    label: "Ask them for their details",
                    sub: "They add it through a secure link",
                    run: () => setFlow({ mode: "ask" }),
                  },
                ].map((i) => (
                  <button
                    key={i.label}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAddMenu(false);
                      i.run();
                    }}
                    className="block w-full rounded-lg px-2.5 py-2 text-left hover:bg-white/[0.06]"
                  >
                    <span className="block text-[13px] text-neutral-100">
                      {i.label}
                    </span>
                    <span className="block text-[11px] text-neutral-500">
                      {i.sub}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabs + tools */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <div role="tablist" className="flex items-center gap-1">
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
                  className={`text-xs tabular-nums ${
                    t === "Needs attention" &&
                    scoped.some((r) => !ready(r)) &&
                    tab !== t
                      ? "text-neutral-300"
                      : tab === t
                        ? "text-neutral-400"
                        : "text-neutral-600"
                  }`}
                >
                  <Roll
                    value={String(scoped.filter((r) => inTab(r, t)).length)}
                  />
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {currencies.length > 2 && (
              <Dropdown
                label="Currency"
                value={currency}
                active={currency !== "All"}
                align="right"
                options={currencies.map((c) => ({
                  value: c,
                  label: c === "All" ? "All currencies" : c,
                }))}
                onChange={setCurrency}
              />
            )}
            <label className="flex h-9 w-[240px] shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 transition-colors focus-within:border-white/35 focus-within:bg-transparent hover:border-white/20">
              <Search
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, bank or account…"
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
              className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] text-neutral-300 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={14} strokeWidth={1.75} />
              Export
            </button>
          </div>
        </div>

        {/* List + docked recipient panel */}
        <div
          className={`mt-3 grid items-start gap-6 ${selected ? "grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}
        >
          <table className="w-full table-fixed border-t border-white/15 text-[13px]">
            <colgroup>
              <col className="w-10" />
              <col />
              {!selected && <col className="w-[250px]" />}
              <col className="w-[130px]" />
              <col className="w-[128px]" />
              <col className={selected ? "w-[150px]" : "w-[190px]"} />
              <col className="w-[76px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-2.5 pl-3 font-normal">
                  <Checkbox
                    checked={allChecked}
                    label={allChecked ? "Deselect all" : "Select all"}
                    onChange={() =>
                      setChecked(
                        allChecked ? new Set() : new Set(rows.map((r) => r.id)),
                      )
                    }
                  />
                </th>
                <th className="py-2.5 font-normal">Name</th>
                {!selected && <th className="py-2.5 font-normal">Pays to</th>}
                <th className="py-2.5 pr-6 text-right font-normal">
                  Total paid
                </th>
                <th className="py-2.5 font-normal">Last paid</th>
                <th className="py-2.5 font-normal">
                  <span className="sr-only">Status</span>
                </th>
                <th className="py-2.5 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = problems.get(r.id);
                const last = lastPayment(r);
                const total = totalPaid(r);
                const on = selectedId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr
                      onClick={() => setSelectedId(on ? null : r.id)}
                      aria-selected={on}
                      className={`group cursor-pointer border-t border-white/6 transition-colors ${on || checked.has(r.id) ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
                    >
                      <td
                        className="py-3 pl-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={checked.has(r.id)}
                          label={`Select ${r.name}`}
                          onChange={() =>
                            setChecked((s) => {
                              const n = new Set(s);
                              if (n.has(r.id)) n.delete(r.id);
                              else n.add(r.id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <RecipientAvatar recipient={r} size={28} />
                          <div className="min-w-0">
                            <div className="truncate text-white">{r.name}</div>
                            <div className="truncate text-[11px] text-neutral-500">
                              {flagOf(r.country)} {r.kind} · {r.country}
                            </div>
                          </div>
                        </div>
                      </td>
                      {!selected && (
                        <td className="py-3 pr-4">
                          {r.account ? (
                            <>
                              <div className="truncate text-neutral-200">
                                {r.institution}
                              </div>
                              <div className="truncate text-[11px] text-neutral-500 tabular-nums">
                                ••{r.account.slice(-4)} · {railLabel(r)}
                                {r.currency !== "USD" && ` · ${r.currency}`}
                              </div>
                            </>
                          ) : (
                            <span className="text-neutral-600">
                              Not added yet
                            </span>
                          )}
                        </td>
                      )}
                      <td className="amount py-3 pr-6 text-right tabular-nums">
                        {total ? (
                          <span className="text-white">
                            {amount(total, r.currency)}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="py-3 text-neutral-400 tabular-nums">
                        {last
                          ? last.status === "Processing"
                            ? "Sending"
                            : last.status === "Failed"
                              ? `Came back ${dateFmt.format(new Date(last.date))}`
                              : dateFmt.format(new Date(last.date))
                          : "Never"}
                      </td>
                      <td className="py-3 pr-2">
                        {p && <ProblemChip p={p} />}
                      </td>
                      <td
                        className="py-3 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          {!p && (
                            <button
                              type="button"
                              aria-label={`Pay ${r.name}`}
                              title="Pay"
                              onClick={() => setSending(r.id)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/8 hover:text-white focus-visible:opacity-100"
                            >
                              <Send size={14} strokeWidth={1.75} />
                            </button>
                          )}
                          <RowMenu
                            label={`${r.name} actions`}
                            items={[
                              ...(!p
                                ? [
                                    {
                                      label: "Pay",
                                      run: () => setSending(r.id),
                                    },
                                  ]
                                : []),
                              ...(p?.fix && p.fixLabel
                                ? [{ label: p.fixLabel, run: () => fix(r, p) }]
                                : []),
                              {
                                label: "Edit details",
                                run: () => setFlow({ mode: "edit", id: r.id }),
                              },
                              {
                                label: "Copy recipient ID",
                                run: () => {
                                  navigator.clipboard
                                    ?.writeText(r.id)
                                    .catch(() => {});
                                  setToast("Recipient ID copied");
                                },
                              },
                              {
                                label: "Archive",
                                run: () => archive([r.id]),
                                danger: true,
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="border-t border-white/6 py-16 text-center text-neutral-500"
                  >
                    {tab === "Needs attention"
                      ? "Everyone can be paid."
                      : "No recipients match."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {selected && (
            <RecipientPanel
              key={selected.id}
              r={selected}
              problem={problems.get(selected.id) ?? null}
              onClose={() => setSelectedId(null)}
              onPay={() => setSending(selected.id)}
              onEdit={() => setFlow({ mode: "edit", id: selected.id })}
              onFix={(p) => fix(selected, p)}
              onArchive={() => archive([selected.id])}
            />
          )}
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
          <button
            type="button"
            onClick={() => {
              exportCsv(picked);
              setToast(`${picked.length} recipients exported`);
            }}
            className="flex h-8 items-center gap-1.5 rounded-full px-3 text-neutral-200 hover:bg-white/8 hover:text-white"
          >
            <Download size={13} strokeWidth={1.75} /> Export
          </button>
          <button
            type="button"
            onClick={() => archive(picked.map((r) => r.id))}
            className="flex h-8 items-center gap-1.5 rounded-full px-3 text-neutral-200 hover:bg-white/8 hover:text-white"
          >
            <Archive size={13} strokeWidth={1.75} /> Archive
          </button>
          <span className="mx-1 h-5 w-px bg-white/10" aria-hidden />
          <button
            type="button"
            aria-label="Clear selection"
            onClick={() => setChecked(new Set())}
            className="flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white/8 hover:text-white"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>
      )}

      {(flow?.mode === "add" || (flow?.mode === "edit" && editing)) && (
        <RecipientFlow
          key={flow.mode === "edit" ? flow.id : "add"}
          editing={editing}
          focus={flow.mode === "edit" ? flow.focus : undefined}
          nextId={nextId}
          onClose={() => setFlow(null)}
          onSave={(r, bankChanged) => {
            // Prototype: the bank confirms the account name a few seconds later.
            if (bankChanged)
              setTimeout(() => {
                setList((l) =>
                  l.map((x) =>
                    x.id === r.id
                      ? {
                          ...x,
                          status: "Active",
                          verification: x.verification?.map((v) => ({
                            ...v,
                            state: "done" as const,
                            note: undefined,
                          })),
                        }
                      : x,
                  ),
                );
                setToast(
                  `${r.institution} confirmed ${r.name}'s account — ready to pay`,
                );
              }, 7000);
            if (editing) {
              setList((l) =>
                l.map((x) =>
                  x.id === r.id
                    ? {
                        ...r,
                        // New details: the old failure no longer applies.
                        payments: bankChanged
                          ? r.payments.map((p) =>
                              p.failure ? { ...p, failure: undefined } : p,
                            )
                          : r.payments,
                      }
                    : x,
                ),
              );
              setToast(
                bankChanged
                  ? `Saved — Gravv is checking ${r.name}'s new account`
                  : `${r.name} updated`,
              );
            } else {
              setList((l) => [r, ...l]);
              setSelectedId(r.id);
              setToast(`${r.name} added — Gravv is checking the account`);
            }
          }}
        />
      )}

      {flow?.mode === "ask" && (
        <AskForDetails
          nextId={nextId}
          onClose={() => setFlow(null)}
          onSend={(r) => {
            setList((l) => [r, ...l]);
            setFlow(null);
            setSelectedId(r.id);
            setToast(`Request sent to ${r.invite?.email}`);
          }}
        />
      )}

      {sending !== null && (
        <SendMoneyFlow
          recipients={list.filter(ready)}
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
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-2xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/** Mercury-style docked panel: who they are, what's wrong, where money goes, what you've sent. */
function RecipientPanel({
  r,
  problem: p,
  onClose,
  onPay,
  onEdit,
  onFix,
  onArchive,
}: {
  r: Recipient;
  problem: Problem | null;
  onClose: () => void;
  onPay: () => void;
  onEdit: () => void;
  onFix: (p: Problem) => void;
  onArchive: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector('[role="dialog"]'))
        return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const paid = r.payments.filter((x) => x.status === "Completed");
  const total = totalPaid(r);
  const showSteps =
    r.status === "Pending" && r.verification && p?.tone !== "bad";

  return (
    <aside className="orbit-pop sidebar-scroll sticky top-6 max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-white/8 bg-surface">
      <div className="flex items-start gap-3 px-5 pt-5">
        <RecipientAvatar recipient={r} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-white">
            {r.name}
          </div>
          <div className="truncate text-[12px] text-neutral-500">
            {flagOf(r.country)} {r.kind} · {r.country}
          </div>
          {r.email && (
            <div className="mt-0.5 flex items-center gap-0.5 text-[12px] text-neutral-400">
              <span className="truncate">{r.email}</span>
              <CopyButton value={r.email} label="Copy email" />
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 px-5">
        <button
          type="button"
          disabled={!!p}
          onClick={onPay}
          title={p ? `Can't pay yet: ${p.label.toLowerCase()}` : undefined}
          className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          <Send size={13} strokeWidth={1.75} />
          Pay
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 hover:border-white/30 hover:text-white"
        >
          <Pencil size={12} strokeWidth={1.75} />
          Edit
        </button>
        <span className="ml-auto">
          <RowMenu
            label="More"
            items={[
              {
                label: "Copy recipient ID",
                run: () => navigator.clipboard?.writeText(r.id).catch(() => {}),
              },
              { label: "Archive", run: onArchive, danger: true },
            ]}
          />
        </span>
      </div>

      {p && (
        <div className="mx-5 mt-5 border-t border-white/8 pt-4">
          <div
            className={`text-[13px] ${p.tone === "bad" ? "text-rose-300" : p.tone === "warn" ? "text-amber-200" : "text-neutral-200"}`}
          >
            {p.label}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-neutral-400">
            {p.detail}
          </p>
          {p.fix && p.fixLabel && (
            <button
              type="button"
              onClick={() => onFix(p)}
              className="mt-3 h-8 rounded-full border border-white/12 px-3.5 text-[12.5px] text-neutral-100 hover:border-white/30"
            >
              {p.fixLabel}
            </button>
          )}
          {showSteps && (
            <div className="mt-4">
              <Stepper steps={r.verification!} />
            </div>
          )}
        </div>
      )}

      <Section
        title="Pays to"
        action={r.account ? "Edit" : undefined}
        onAction={onEdit}
      >
        {r.account ? (
          <dl className="space-y-2">
            <Detail
              label={r.institutionType === "Mobile money" ? "Provider" : "Bank"}
              value={r.institution}
            />
            <Detail
              label={
                r.rail === "Swift" || r.rail === "SEPA"
                  ? "IBAN / account"
                  : r.institutionType === "Mobile money"
                    ? "Number"
                    : r.country === "Morocco"
                      ? "RIB"
                      : "Account"
              }
              value={r.account}
              mono
              copy
            />
            {r.routing && (
              <Detail
                label={r.routing.label}
                value={r.routing.value}
                mono
                copy
              />
            )}
            <Detail
              label="Send by"
              value={`${railLabel(r)} · ${r.currency}`}
              sub={`Arrives ${arrival[r.rail].toLowerCase()}`}
            />
          </dl>
        ) : (
          <p className="text-[12.5px] text-neutral-500">
            No bank account yet
            {r.invite ? " — they'll add it from the link." : "."}
          </p>
        )}
      </Section>

      <Section title="Payments">
        {r.payments.length ? (
          <>
            <div className="mb-1 flex items-baseline justify-between text-[12px] text-neutral-500 tabular-nums">
              <span>
                {paid.length} {paid.length === 1 ? "payment" : "payments"}
              </span>
              <span className="amount text-neutral-200">
                {amount(total, r.currency)} paid
              </span>
            </div>
            <div className="divide-y divide-white/6">
              {r.payments.slice(0, 6).map((x) => (
                <PaymentRow key={x.id} payment={x} />
              ))}
            </div>
          </>
        ) : (
          <p className="text-[12.5px] text-neutral-500">
            Nothing sent yet{!p ? "." : ` — you can pay once this is sorted.`}
          </p>
        )}
      </Section>

      <div className="mx-5 flex items-center justify-between gap-3 border-t border-white/8 py-3.5 text-[11px] text-neutral-500">
        <span className="flex min-w-0 items-center gap-0.5">
          <span className="truncate font-mono">{r.id}</span>
          <CopyButton value={r.id} label="Copy recipient ID" />
        </span>
        <span className="shrink-0">
          Added {fullDateFmt.format(new Date(r.createdAt))}
        </span>
      </div>
    </aside>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-5 mt-5 border-t border-white/8 pt-4 pb-1">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[12px] text-neutral-500">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={onAction}
            className="text-[12px] text-neutral-400 hover:text-white"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  sub,
  mono = false,
  copy = false,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 pt-px text-[12px] text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="flex min-w-0 items-center justify-end gap-0.5">
          <span
            title={value}
            className={`truncate ${mono ? "font-mono text-[12px] text-neutral-200" : "text-[13px] text-neutral-100"}`}
          >
            {value}
          </span>
          {copy && (
            <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
          )}
        </span>
        {sub && (
          <span className="block text-[11px] text-neutral-500">{sub}</span>
        )}
      </dd>
    </div>
  );
}

function Stepper({ steps }: { steps: VerificationStep[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={`absolute top-5 bottom-0 left-[8px] w-px ${s.state === "done" ? "bg-white/30" : "bg-white/8"}`}
            />
          )}
          <span
            aria-hidden
            className={`relative z-10 mt-px flex size-[17px] shrink-0 items-center justify-center rounded-full text-[10px] ${
              s.state === "done"
                ? "bg-white text-black"
                : s.state === "current"
                  ? "border border-white/60 bg-surface"
                  : "border border-white/12 bg-surface"
            }`}
          >
            {s.state === "done" ? "✓" : ""}
          </span>
          <span
            className={`text-[12.5px] ${s.state === "upcoming" ? "text-neutral-500" : "text-neutral-100"}`}
          >
            {s.label}
            {s.state === "current" && (
              <span className="ml-1.5 text-neutral-500">· in progress</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PaymentRow({ payment: p }: { payment: RecipientPayment }) {
  const failed = p.status === "Failed";
  return (
    <div className="py-2.5">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-100">
          {p.reference}
        </span>
        <span
          className={`amount shrink-0 text-[13px] tabular-nums ${failed ? "text-neutral-600 line-through" : "text-neutral-100"}`}
        >
          {amount(p.amount, p.currency)}
        </span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-neutral-500 tabular-nums">
        {dateFmt.format(new Date(p.date))} · {p.source}
        {p.status === "Processing" && (
          <span className="text-neutral-300"> · Sending</span>
        )}
        {failed && <span className="text-rose-300"> · Came back</span>}
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors ${
        checked
          ? "border-white bg-white text-black"
          : "border-white/25 hover:border-white/50"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
          <path
            d="M2.5 6.2 5 8.5l4.5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function exportCsv(rows: Recipient[]) {
  const head = [
    "Name",
    "Type",
    "Country",
    "Bank",
    "Account",
    "Routing / SWIFT",
    "Currency",
    "Rail",
    "Total paid",
    "Added",
  ];
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [
    head,
    ...rows.map((r) => [
      r.name,
      r.kind,
      r.country,
      r.institution,
      r.account ?? "",
      r.routing?.value ?? "",
      r.currency,
      r.rail,
      totalPaid(r),
      r.createdAt,
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "gravv-recipients.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
