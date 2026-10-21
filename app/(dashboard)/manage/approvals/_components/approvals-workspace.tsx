"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import { PersonAvatar } from "@/app/_components/person-avatar";
import { ME, MEMBERS, ROLES } from "../../roles/_data";
import {
  AS_OF,
  REQUESTS,
  RULES,
  SETTINGS,
  ago,
  type Request,
  type Rule,
  type Settings,
} from "../_data";

type Tab = "mine" | "others" | "history" | "rules";

const MY_ROLE = MEMBERS.find((m) => m.name === ME)!.role;
const roleName = (id: string) => ROLES.find((r) => r.id === id)?.name ?? id;
const SYMBOL: Record<Request["currency"], string> = {
  USD: "$",
  USDC: "",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
};
const usd = (v: number) => `$${v.toLocaleString("en-US")}`;
const or = (xs: string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`;

function Money({
  r,
  size = "",
}: {
  r: Pick<Request, "amount" | "currency">;
  size?: string;
}) {
  const [whole, cents] = r.amount
    .toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  return (
    <span className={`amount tabular-nums ${size}`}>
      {SYMBOL[r.currency]}
      {whole}
      <sup className="ml-px align-[0.45em] text-[0.62em] font-normal text-neutral-500">
        {cents}
      </sup>
      {r.currency === "USDC" && (
        <span className="ml-1 text-[0.8em] text-neutral-500">USDC</span>
      )}
    </span>
  );
}

/** Why a payment is waiting, as a sentence. */
function why(r: Request, rules: Rule[]) {
  if (r.reason.kind === "cap")
    return `Over ${r.requestedBy.split(" ")[0]}'s ${usd(r.reason.cap)} limit`;
  const ruleId = r.reason.ruleId;
  const rule = rules.find((x) => x.id === ruleId);
  if (!rule) return "Matched an approval rule";
  return rule.when.kind === "newRecipient"
    ? "New recipient"
    : `${usd(rule.when.min)} or more`;
}

const approvedCount = (r: Request) =>
  r.decisions.filter((d) => d.kind === "approved").length;
const canApprove = (r: Request, s: Settings) =>
  r.state === "pending" &&
  r.approvers.includes(MY_ROLE) &&
  !r.decisions.some((d) => d.by === ME) &&
  !(s.noSelfApproval && r.requestedBy === ME);

export function ApprovalsWorkspace() {
  const [requests, setRequests] = useState<Request[]>(REQUESTS);
  const [rules, setRules] = useState<Rule[]>(RULES);
  const [settings, setSettings] = useState<Settings>(SETTINGS);
  const [tab, setTab] = useState<Tab>("mine");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sheet, setSheet] = useState<{
    id: string;
    rejecting?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  const mine = requests.filter((r) => canApprove(r, settings));
  const others = requests.filter(
    (r) => r.state === "pending" && !canApprove(r, settings),
  );
  const history = requests.filter((r) => r.state !== "pending");
  const rows = tab === "mine" ? mine : tab === "others" ? others : history;
  const totalMine = mine.reduce(
    (s, r) => s + (r.currency === "NGN" ? r.amount / 900 : r.amount),
    0,
  );

  const decide = (
    ids: string[],
    kind: "approved" | "rejected",
    note?: string,
  ) => {
    const now = new Date(AS_OF).toISOString();
    setRequests((all) =>
      all.map((r) => {
        if (!ids.includes(r.id)) return r;
        const decisions = [...r.decisions, { by: ME, at: now, kind, note }];
        const approvals = decisions.filter((d) => d.kind === "approved").length;
        const state =
          kind === "rejected"
            ? "rejected"
            : approvals >= r.needed
              ? "approved"
              : "pending";
        return { ...r, decisions, state };
      }),
    );
    setSelected(new Set());
    setSheet(null);
    const one = requests.find((r) => r.id === ids[0])!;
    setToast(
      kind === "rejected"
        ? `Rejected — ${one.requestedBy.split(" ")[0]} will see your reason`
        : ids.length > 1
          ? `${ids.length} payments approved`
          : approvedCount(one) + 1 >= one.needed
            ? `Approved — the payment to ${one.recipient.name} is on its way`
            : `Approved — waiting on ${one.needed - approvedCount(one) - 1} more`,
    );
  };

  const open = sheet ? requests.find((r) => r.id === sheet.id) : undefined;
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="mx-auto max-w-[1180px] px-8 pt-12 pb-28">
      <div>
        <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
          Approvals
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          {mine.length
            ? `${mine.length} ${mine.length === 1 ? "payment is" : "payments are"} waiting on you, about ${usd(Math.round(totalMine))} in total.`
            : "Nothing is waiting on you."}{" "}
          Payments that match a rule, or go past someone&apos;s limit, stop here
          until they&apos;re approved.
        </p>
      </div>

      <div role="tablist" className="mt-8 flex gap-6 border-b border-white/8">
        {(
          [
            ["mine", "Needs your approval", mine.length],
            ["others", "Waiting on others", others.length],
            ["history", "History", undefined],
            ["rules", "Rules", rules.length],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setSelected(new Set());
            }}
            className={`-mb-px flex items-center gap-1.5 border-b pb-3 text-[14px] transition-colors ${
              tab === id
                ? "border-white text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {label}
            {n !== undefined && (
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {n}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "rules" ? (
        <RulesEditor
          rules={rules}
          settings={settings}
          onSave={(r, s) => {
            setRules(r);
            setSettings(s);
            setToast("Approval rules saved — they apply to new payments");
          }}
        />
      ) : rows.length === 0 ? (
        <div className="py-24 text-center">
          <div className="text-[15px] text-white">
            {tab === "mine"
              ? "You're all caught up"
              : tab === "others"
                ? "Nothing waiting on anyone else"
                : "No decisions yet"}
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-500">
            {tab === "mine"
              ? "New payments that need you will show up here."
              : "Payments move here once someone has approved or rejected them."}
          </p>
        </div>
      ) : (
        <table className="mt-3 w-full table-fixed text-[13px]">
          <colgroup>
            {tab === "mine" && <col className="w-10" />}
            <col className="w-[30%]" />
            <col className="w-[18%]" />
            <col />
            <col className="w-[17%]" />
            <col className={tab === "mine" ? "w-[180px]" : "w-[120px]"} />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              {tab === "mine" && (
                <th className="py-2.5 font-normal">
                  <Checkbox
                    on={allOn}
                    label="Select all"
                    onChange={() =>
                      setSelected(
                        allOn ? new Set() : new Set(rows.map((r) => r.id)),
                      )
                    }
                  />
                </th>
              )}
              <th className="py-2.5 font-normal">Payment</th>
              <th className="py-2.5 font-normal">Requested by</th>
              <th className="py-2.5 font-normal">Why it&apos;s here</th>
              <th className="py-2.5 font-normal">
                {tab === "history" ? "Decision" : "Approvals"}
              </th>
              <th className="py-2.5 font-normal" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const n = approvedCount(r);
              const last = r.decisions[r.decisions.length - 1];
              return (
                <tr
                  key={r.id}
                  onClick={() => setSheet({ id: r.id })}
                  className={`cursor-pointer border-t border-white/6 transition-colors hover:bg-white/[0.02] ${selected.has(r.id) ? "bg-white/[0.03]" : ""}`}
                >
                  {tab === "mine" && (
                    <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        on={selected.has(r.id)}
                        label={`Select payment to ${r.recipient.name}`}
                        onChange={() => {
                          const next = new Set(selected);
                          if (next.has(r.id)) next.delete(r.id);
                          else next.add(r.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                  )}
                  <td className="py-3.5 pr-4">
                    <div className="text-[14px] text-white">
                      <Money r={r} />
                    </div>
                    <div className="truncate text-[12px] text-neutral-500">
                      to {r.recipient.name}
                      {r.recipient.isNew && (
                        <span className="text-neutral-300"> · new</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="flex items-center gap-2.5">
                      <PersonAvatar name={r.requestedBy} size={28} />
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-100">
                          {r.requestedBy === ME ? "You" : r.requestedBy}
                        </span>
                        <span className="block text-[12px] text-neutral-500">
                          {ago(r.requestedAt)}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="truncate py-3.5 pr-4 text-neutral-300">
                    {why(r, rules)}
                  </td>
                  <td className="py-3.5 pr-4">
                    {r.state === "pending" ? (
                      <>
                        <div className="text-neutral-100 tabular-nums">
                          {n} of {r.needed}
                        </div>
                        <div className="truncate text-[12px] text-neutral-500">
                          {r.requestedBy === ME && settings.noSelfApproval
                            ? "You can't approve your own"
                            : r.decisions.some((d) => d.by === ME)
                              ? "You approved"
                              : `From ${or(r.approvers.map(roleName))}`}
                        </div>
                      </>
                    ) : (
                      <>
                        <StateChip state={r.state} />
                        <div className="mt-1 truncate text-[12px] text-neutral-500">
                          {last.by === ME ? "You" : last.by.split(" ")[0]} ·{" "}
                          {ago(last.at)}
                        </div>
                      </>
                    )}
                  </td>
                  <td
                    className="py-3.5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tab === "mine" ? (
                      <span className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSheet({ id: r.id, rejecting: true })
                          }
                          className="h-8 rounded-full px-3 text-[13px] text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => decide([r.id], "approved")}
                          className="h-8 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
                        >
                          Approve
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSheet({ id: r.id })}
                        className="inline-flex items-center gap-0.5 text-[12px] text-neutral-400 hover:text-white"
                      >
                        Details
                        <ChevronRight size={13} strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Bulk: approve several at once */}
      {selected.size > 0 && tab === "mine" && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-6 rounded-full bg-neutral-950 py-2 pr-2 pl-5 text-[13px] text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10">
          <span>
            {selected.size} selected
            <span className="text-neutral-400">
              {" "}
              · about{" "}
              {usd(
                Math.round(
                  mine
                    .filter((r) => selected.has(r.id))
                    .reduce(
                      (s, r) =>
                        s + (r.currency === "NGN" ? r.amount / 900 : r.amount),
                      0,
                    ),
                ),
              )}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-8 rounded-full px-3 text-neutral-300 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => decide([...selected], "approved")}
              className="h-8 rounded-full bg-white px-4 font-medium text-black hover:bg-neutral-200"
            >
              Approve {selected.size}
            </button>
          </span>
        </div>
      )}

      {open && (
        <RequestSheet
          key={`${open.id}-${sheet?.rejecting ? "r" : ""}`}
          r={open}
          rules={rules}
          settings={settings}
          startRejecting={!!sheet?.rejecting}
          onClose={() => setSheet(null)}
          onDecide={(kind, note) => decide([open.id], kind, note)}
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

function StateChip({ state }: { state: Request["state"] }) {
  const tone =
    state === "approved"
      ? "border-transparent bg-[var(--ok-bg)] text-[var(--ok-fg)]"
      : state === "pending"
        ? "border-dashed border-white/20 text-neutral-300"
        : "border-transparent bg-rose-400/10 text-rose-300";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs leading-none font-medium capitalize ${tone}`}
    >
      {state === "pending" ? "Waiting" : state}
    </span>
  );
}

function Checkbox({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`flex size-4 items-center justify-center rounded-[4px] border transition-colors ${
        on
          ? "border-white bg-white text-black"
          : "border-white/25 hover:border-white/50"
      }`}
    >
      {on && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

/** One request in full: what, to whom, why it stopped, who has signed off, and the decision. */
function RequestSheet({
  r,
  rules,
  settings,
  startRejecting,
  onClose,
  onDecide,
}: {
  r: Request;
  rules: Rule[];
  settings: Settings;
  startRejecting: boolean;
  onClose: () => void;
  onDecide: (kind: "approved" | "rejected", note?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(startRejecting);
  const [reason, setReason] = useState("");
  // A typed reason is never thrown away by a stray click or Esc: ask first.
  const [asking, setAsking] = useState(false);
  const guard = () =>
    rejecting && reason.trim() ? setAsking(true) : onClose();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (asking) setAsking(false);
      else guard();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const mineToDecide = canApprove(r, settings);
  const left = r.needed - approvedCount(r);
  const rule =
    r.reason.kind === "rule"
      ? rules.find((x) => x.id === (r.reason as { ruleId: string }).ruleId)
      : undefined;

  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={guard}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Approval request"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-neutral-500">
              <PersonAvatar name={r.requestedBy} size={20} />
              {r.requestedBy === ME ? "You" : r.requestedBy} asked{" "}
              {ago(r.requestedAt)}
            </div>
            <div className="mt-1.5 text-[28px] leading-none font-medium tracking-[-0.03em] text-white">
              <Money r={r} />
            </div>
            <div className="mt-2 text-[13px] text-neutral-300">
              to {r.recipient.name}
              {r.recipient.isNew && (
                <span className="text-neutral-500">
                  {" "}
                  · first payment to them
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StateChip state={r.state} />
            <button
              type="button"
              aria-label="Close"
              onClick={guard}
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          {r.note && (
            <p className="rounded-lg bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-neutral-200">
              “{r.note}”
            </p>
          )}

          <section>
            <h3 className="mb-1.5 text-xs text-neutral-500">Payment</h3>
            <Field label="From" value={r.from} />
            <Field label="To" value={`${r.recipient.name}`} />
            <Field label="Destination" value={r.recipient.detail} mono />
            <Field label="Reference" value={r.id} mono />
          </section>

          <section>
            <h3 className="mb-1.5 text-xs text-neutral-500">
              Why it needs approval
            </h3>
            <p className="text-[13px] leading-relaxed text-neutral-200">
              {r.reason.kind === "cap"
                ? `${r.requestedBy.split(" ")[0]} can send up to ${usd(r.reason.cap)} per payment on their role. Anything larger needs ${r.needed} approval from ${or(r.approvers.map(roleName))}.`
                : rule?.when.kind === "newRecipient"
                  ? `It's the first payment to this recipient. Your rule asks for ${r.needed} approval from ${or(r.approvers.map(roleName))}.`
                  : `It's ${usd(rule && rule.when.kind === "amount" ? rule.when.min : 0)} or more. Your rule asks for ${r.needed} approval${r.needed > 1 ? "s" : ""} from ${or(r.approvers.map(roleName))}.`}
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-xs text-neutral-500">Sign-off</h3>
            <ol>
              <Step
                done
                label={`Requested by ${r.requestedBy === ME ? "you" : r.requestedBy}`}
                sub={ago(r.requestedAt)}
              />
              {r.decisions.map((d) => (
                <Step
                  key={d.by + d.at}
                  done={d.kind === "approved"}
                  rejected={d.kind === "rejected"}
                  label={`${d.kind === "approved" ? "Approved" : "Rejected"} by ${d.by === ME ? "you" : d.by}`}
                  sub={d.note ? `${ago(d.at)} · “${d.note}”` : ago(d.at)}
                />
              ))}
              {r.state === "pending" &&
                Array.from({ length: left }, (_, i) => (
                  <Step
                    key={i}
                    waiting
                    label={
                      i === 0 && mineToDecide
                        ? "Waiting on you"
                        : `Waiting on ${or(r.approvers.map(roleName))}`
                    }
                    sub={
                      i === 0 && mineToDecide
                        ? `Or anyone else in ${or(r.approvers.map(roleName))}`
                        : undefined
                    }
                  />
                ))}
              {r.state === "approved" && (
                <Step done label="Sent" sub="Released once fully approved" />
              )}
            </ol>
          </section>

          {r.state === "pending" && !mineToDecide && (
            <p className="text-[12px] leading-relaxed text-neutral-500">
              {r.requestedBy === ME && settings.noSelfApproval
                ? "You asked for this payment, so someone else has to approve it."
                : r.decisions.some((d) => d.by === ME)
                  ? "You've approved this. It goes out when the rest sign off."
                  : `Only ${or(r.approvers.map(roleName))} can approve this payment.`}
            </p>
          )}
        </div>

        {mineToDecide && (
          <div className="border-t border-white/8 px-6 py-4">
            {rejecting ? (
              <div>
                {asking && (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-raised px-3 py-2.5 text-[13px]">
                    <span className="text-neutral-200">
                      Discard your note? What you&apos;ve entered won&apos;t be
                      saved.
                    </span>
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        autoFocus
                        onClick={() => setAsking(false)}
                        className="h-7 rounded-full bg-white px-3 text-xs font-medium text-black hover:bg-neutral-200"
                      >
                        Keep editing
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAsking(false);
                          onClose();
                        }}
                        className="h-7 rounded-full px-3 text-xs text-rose-400 hover:bg-rose-500/10"
                      >
                        Discard
                      </button>
                    </span>
                  </div>
                )}
                <label className="mb-1.5 block text-[13px] text-neutral-200">
                  Why are you rejecting it?{" "}
                  <span className="text-neutral-500">
                    {r.requestedBy.split(" ")[0]} will see this
                  </span>
                </label>
                <textarea
                  autoFocus
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. The amount doesn't match the invoice"
                  className="w-full resize-none rounded-lg border border-white/12 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-white outline-none placeholder:text-neutral-500 focus:border-white/35"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRejecting(false);
                      setAsking(false);
                    }}
                    className="h-9 rounded-full px-4 text-[13px] text-neutral-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => onDecide("rejected", reason.trim())}
                    className="h-9 rounded-full bg-rose-500 px-4 text-[13px] font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
                  >
                    Reject payment
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] text-neutral-500">
                  {left > 1
                    ? `${left - 1} more after you`
                    : "Yours is the last approval — it sends right away"}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(true)}
                    className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => onDecide("approved")}
                    className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
                  >
                    Approve
                  </button>
                </span>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function Step({
  label,
  sub,
  done = false,
  rejected = false,
  waiting = false,
}: {
  label: string;
  sub?: string;
  done?: boolean;
  rejected?: boolean;
  waiting?: boolean;
}) {
  return (
    <li className="group/step relative flex gap-3 pb-4 last:pb-0">
      <span
        aria-hidden
        className="absolute top-5 bottom-0 left-[9px] w-px bg-white/10 group-last/step:hidden"
      />
      <span
        className={`relative flex size-[19px] shrink-0 items-center justify-center rounded-full border ${
          rejected
            ? "border-rose-400/50 bg-rose-400/10 text-rose-300"
            : done
              ? "border-[var(--flow-in)] bg-[var(--flow-in)] text-black"
              : "border-dashed border-white/40"
        }`}
      >
        {rejected ? (
          <X size={11} strokeWidth={3} />
        ) : done ? (
          <Check size={11} strokeWidth={3} />
        ) : null}
      </span>
      <span className="min-w-0 pt-px">
        <span
          className={`block text-[13px] ${waiting ? "text-neutral-300" : "text-white"}`}
        >
          {label}
        </span>
        {sub && (
          <span className="block text-[12px] leading-relaxed text-neutral-500">
            {sub}
          </span>
        )}
      </span>
    </li>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 py-2.5 last:border-0">
      <span className="shrink-0 text-[12px] text-neutral-500">{label}</span>
      <span
        className={`truncate ${mono ? "font-mono text-[12px] text-neutral-300" : "text-[13px] text-neutral-100"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ——— Rules ———

const APPROVER_ROLES = ROLES.filter(
  (r) => !r.owner && r.grants.includes("approvals.approve"),
);

/** Rules written as sentences, edited in place; nothing applies until it's saved. */
function RulesEditor({
  rules,
  settings,
  onSave,
}: {
  rules: Rule[];
  settings: Settings;
  onSave: (r: Rule[], s: Settings) => void;
}) {
  const [draft, setDraft] = useState(rules);
  const [s, setS] = useState(settings);
  const [maxText, setMaxText] = useState(
    settings.dailyMax === null ? "" : settings.dailyMax.toLocaleString("en-US"),
  );
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(rules) ||
    JSON.stringify(s) !== JSON.stringify(settings);
  const sorted = useMemo(
    () =>
      [...draft].sort((a, b) =>
        a.when.kind === "newRecipient"
          ? 1
          : b.when.kind === "newRecipient"
            ? -1
            : a.when.min - b.when.min,
      ),
    [draft],
  );
  const patch = (id: string, p: Partial<Rule>) =>
    setDraft((all) => all.map((r) => (r.id === id ? { ...r, ...p } : r)));

  return (
    <div className="mt-8 grid grid-cols-[minmax(0,1fr)_240px] gap-10">
      <div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[15px] text-white">
              When a payment needs approval
            </h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              If more than one rule matches, the strictest one applies.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft((all) => [
                ...all,
                {
                  id: `r_${all.length + 1}_${draft.length}`,
                  when: { kind: "amount", min: 25_000 },
                  approvals: 1,
                  from: ["admin"],
                },
              ])
            }
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            <Plus size={13} strokeWidth={1.75} />
            Add rule
          </button>
        </div>

        <ul className="mt-5 divide-y divide-white/[0.06] rounded-xl border border-white/8">
          {sorted.map((r) => (
            <RuleRow
              key={r.id}
              rule={r}
              onChange={(p) => patch(r.id, p)}
              onRemove={() =>
                setDraft((all) => all.filter((x) => x.id !== r.id))
              }
            />
          ))}
          {sorted.length === 0 && (
            <li className="px-5 py-8 text-center text-[13px] text-neutral-500">
              No rules — payments only stop when they pass someone&apos;s limit.
            </li>
          )}
        </ul>

        <h2 className="mt-10 text-[15px] text-white">Always</h2>
        <div className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/8">
          <div className="flex items-center justify-between gap-6 px-5 py-4">
            <div>
              <div className="text-[13px] text-white">
                People can&apos;t approve their own payments
              </div>
              <div className="mt-0.5 text-[12px] text-neutral-500">
                Someone else on an approving role has to sign off.
              </div>
            </div>
            <Switch
              on={s.noSelfApproval}
              label="People can't approve their own payments"
              onChange={() => setS({ ...s, noSelfApproval: !s.noSelfApproval })}
            />
          </div>
          <div className="flex items-center justify-between gap-6 px-5 py-4">
            <div>
              <div className="text-[13px] text-white">
                Daily maximum per person
              </div>
              <div className="mt-0.5 text-[12px] text-neutral-500">
                Once someone has sent this much in a day, every further payment
                needs approval.
              </div>
            </div>
            <label className="flex h-8 w-[140px] shrink-0 items-center gap-1 rounded-lg border border-white/12 px-2.5 text-[13px] focus-within:border-white/35">
              <span className="text-neutral-500">$</span>
              <input
                inputMode="numeric"
                value={maxText}
                placeholder="No maximum"
                aria-label="Daily maximum per person"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setMaxText(raw ? Number(raw).toLocaleString("en-US") : "");
                  setS({ ...s, dailyMax: raw ? Number(raw) : null });
                }}
                className="amount min-w-0 flex-1 bg-transparent text-white tabular-nums outline-none placeholder:text-neutral-500"
              />
            </label>
          </div>
        </div>
      </div>

      {/* How the pieces fit */}
      <aside className="h-fit space-y-5 pt-1 text-[13px] leading-relaxed">
        <div>
          <div className="text-white">Limits on roles</div>
          <p className="mt-1 text-neutral-500">
            Each role also has its own cap per payment — Operations can send up
            to $5,000. Anything above a person&apos;s cap comes here, even
            without a rule.
          </p>
          <Link
            href="/manage/roles"
            className="mt-2 inline-flex items-center gap-0.5 text-neutral-200 hover:text-white"
          >
            Edit role limits
            <ChevronRight size={13} strokeWidth={1.75} />
          </Link>
        </div>
        <div>
          <div className="text-white">Who can approve</div>
          <p className="mt-1 text-neutral-500">
            Anyone whose role includes “Approve payments”:{" "}
            {or(APPROVER_ROLES.map((r) => r.name))}. Owners can always approve.
          </p>
        </div>
      </aside>

      {dirty && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-6 rounded-full bg-neutral-950 py-2 pr-2 pl-5 text-[13px] text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10">
          <span>
            Unsaved changes to approval rules
            <span className="text-neutral-400">
              {" "}
              · payments already waiting keep their rules
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(rules);
                setS(settings);
                setMaxText(
                  settings.dailyMax === null
                    ? ""
                    : settings.dailyMax.toLocaleString("en-US"),
                );
              }}
              className="h-8 rounded-full px-3 text-neutral-300 hover:text-white"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => onSave(draft, s)}
              className="h-8 rounded-full bg-white px-4 font-medium text-black hover:bg-neutral-200"
            >
              Save rules
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function RuleRow({
  rule,
  onChange,
  onRemove,
}: {
  rule: Rule;
  onChange: (p: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  const [minText, setMinText] = useState(
    rule.when.kind === "amount" ? rule.when.min.toLocaleString("en-US") : "",
  );
  return (
    <li className="group flex items-start gap-4 px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2.5 text-[13px] leading-8 text-neutral-400">
        <span>When</span>
        <Dropdown
          label="Condition"
          variant="compact"
          value={rule.when.kind}
          options={[
            { value: "amount", label: "a payment is" },
            { value: "newRecipient", label: "it's a new recipient" },
          ]}
          onChange={(v) =>
            onChange({
              when:
                v === "amount"
                  ? {
                      kind: "amount",
                      min: Number(minText.replace(/,/g, "")) || 10_000,
                    }
                  : { kind: "newRecipient" },
            })
          }
        />
        {rule.when.kind === "amount" && (
          <>
            <label className="flex h-8 w-[104px] items-center gap-1 rounded-lg border border-white/12 px-2.5 focus-within:border-white/35">
              <span className="text-neutral-500">$</span>
              <input
                inputMode="numeric"
                value={minText}
                aria-label="Amount"
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setMinText(raw ? Number(raw).toLocaleString("en-US") : "");
                  onChange({ when: { kind: "amount", min: Number(raw) || 0 } });
                }}
                className="amount min-w-0 flex-1 bg-transparent text-white tabular-nums outline-none"
              />
            </label>
            <span>or more,</span>
          </>
        )}
        <span>require</span>
        <Dropdown
          label="Approvals"
          variant="compact"
          value={rule.approvals}
          options={[1, 2, 3].map((n) => ({
            value: n,
            label: `${n} approval${n > 1 ? "s" : ""}`,
          }))}
          onChange={(v) => onChange({ approvals: v })}
        />
        <span>from</span>
        <span className="flex flex-wrap gap-1.5">
          {APPROVER_ROLES.map((r) => {
            const on = rule.from.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    from: on
                      ? rule.from.length > 1
                        ? rule.from.filter((x) => x !== r.id)
                        : rule.from
                      : [...rule.from, r.id],
                  })
                }
                className={`h-8 rounded-full border px-3 text-[12px] leading-none transition-colors ${
                  on
                    ? "border-white/40 bg-white/[0.08] text-white"
                    : "border-white/10 text-neutral-500 hover:text-white"
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </span>
      </div>
      <button
        type="button"
        aria-label="Delete rule"
        onClick={onRemove}
        className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white focus-visible:opacity-100"
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    </li>
  );
}

function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      style={{ width: 32, height: 18 }}
      className={`shrink-0 rounded-full p-0.5 transition-colors ${on ? "bg-white" : "bg-white/15"}`}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          transform: `translateX(${on ? 14 : 0}px)`,
        }}
        className={`block rounded-full transition-transform ${on ? "bg-black" : "bg-white"}`}
      />
    </button>
  );
}
