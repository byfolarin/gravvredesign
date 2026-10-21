"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { Roll } from "@/app/_components/roll";
import {
  API_MODE,
  AS_OF,
  CYCLE_END,
  CYCLE_START,
  FEE_TYPES,
  PLANS,
  feeOn,
  type Fee,
  type FeeType,
  type PlanId,
} from "../_data";

const DAY = 24 * 60 * 60 * 1000;
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
export const usd = (v: number) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Dollars with superscript cents, hideable. */
export function Money({
  value,
  big = false,
}: {
  value: number;
  big?: boolean;
}) {
  const [w, c] = usd(value).split(".");
  return (
    <span className="amount tabular-nums">
      ${big ? <Roll value={w} /> : w}
      <sup className="ml-px align-[0.5em] text-[0.58em]">.{c}</sup>
    </span>
  );
}

export const rateText = (r: FeeType["rates"][PlanId]) => {
  if (r === "custom") return "Custom";
  if (!r.pct && !r.flat) return "Free";
  const pct = r.pct ? `${r.pct}%` : "";
  const flat = r.flat ? `$${r.flat % 1 ? r.flat.toFixed(2) : r.flat}` : "";
  return pct && flat ? `${pct} + ${flat}` : pct || flat;
};

export function BillingOverview({
  fees,
  plan: initialPlan,
}: {
  fees: Fee[];
  plan: PlanId;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [changing, setChanging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3400);
    return () => clearTimeout(t);
  }, [toast]);

  const current = PLANS.find((p) => p.id === plan)!;
  const cycle = fees.filter(
    (f) => Date.parse(f.createdAt) >= CYCLE_START && f.status !== "Not charged",
  );
  const total = cycle.reduce((s, f) => s + f.amount, 0);
  const taken = cycle
    .filter((f) => f.status === "Taken")
    .reduce((s, f) => s + f.amount, 0);
  const toInvoice = total - taken;
  const elapsed = Math.max(1, (AS_OF - CYCLE_START) / DAY);
  const length = (CYCLE_END - CYCLE_START) / DAY;
  const pace = length / elapsed;
  const daysLeft = Math.ceil((CYCLE_END - AS_OF) / DAY);

  // What fees cost, by type, biggest first.
  const byType = FEE_TYPES.map((t) => {
    const xs = cycle.filter((f) => f.type === t.id);
    return { t, n: xs.length, sum: xs.reduce((s, f) => s + f.amount, 0) };
  })
    .filter((x) => x.n)
    .sort((a, b) => b.sum - a.sum);
  const top = byType[0]?.sum || 1;

  // The same activity priced on each plan, for a full cycle at this pace.
  const priced = PLANS.map((p) => {
    let custom = false;
    const sum = cycle.reduce((s, f) => {
      const v = feeOn(
        FEE_TYPES.find((t) => t.id === f.type)!.rates[p.id],
        f.base,
      );
      if (v === null) custom = true;
      return s + (v ?? 0);
    }, 0);
    return { p, fees: sum * pace, all: sum * pace + p.price, custom };
  });
  const mine = priced.find((x) => x.p.id === plan)!;
  const growth = priced.find((x) => x.p.id === "growth")!;
  const starter = priced.find((x) => x.p.id === "starter")!;
  const saving = starter.fees ? 1 - growth.fees / starter.fees : 0;
  const breakEven = saving > 0 ? 250 / saving : null;
  const cheapest = priced
    .filter((x) => !x.custom)
    .sort((a, b) => a.all - b.all)[0];

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max-narrow) px-8 pt-12 pb-24">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-[640px]">
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Billing
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-neutral-400">
              You&apos;re on <span className="text-white">{current.name}</span>
              {current.price ? (
                <>
                  {" "}
                  · <span className="amount">${current.price}</span> a cycle
                </>
              ) : (
                " · free"
              )}
              . Your cycle renews on {day.format(CYCLE_END)} ({daysLeft} days).
              Most fees come off each transaction as it happens; card issuing is
              added to the cycle&apos;s invoice.
              {API_MODE === "Sandbox" && (
                <>
                  {" "}
                  The API is still in sandbox —{" "}
                  <Link
                    href="/manage/configure"
                    className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
                  >
                    go live in Configure
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Change plan
            </button>
          </div>
        </div>

        {/* This cycle */}
        <section className="mt-12 border-t border-white/8 pt-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[13px] text-neutral-500">
                Fees this cycle · {day.format(CYCLE_START)} –{" "}
                {day.format(CYCLE_END)}
              </div>
              <div className="mt-2 text-[34px] leading-none font-medium tracking-[-0.035em] text-white">
                <Money value={total} big />
              </div>
              <div className="mt-2 text-[12px] text-neutral-500 tabular-nums">
                {cycle.length} fees ·{" "}
                <span className="amount">${usd(taken)}</span> already taken
                {toInvoice > 0 && (
                  <>
                    {" "}
                    · <span className="amount">${usd(toInvoice)}</span> on the{" "}
                    {day.format(CYCLE_END)} invoice
                  </>
                )}
              </div>
            </div>
            <div className="text-right text-[12px] text-neutral-500 tabular-nums">
              At this pace the cycle ends near{" "}
              <span className="amount text-neutral-200">
                ${usd(total * pace)}
              </span>
            </div>
          </div>

          <div className="mt-7 divide-y divide-white/6 border-y border-white/8">
            {byType.map(({ t, n, sum }) => (
              <Link
                key={t.id}
                href={`/billing/history?type=${t.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_120px_150px_110px] items-center gap-4 py-3 text-[13px] transition-colors hover:bg-white/[0.02]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-neutral-100">
                    {t.label}
                  </span>
                  <span className="mt-1.5 block h-[3px] max-w-[320px] rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-white/40"
                      style={{ width: `${Math.max(2, (sum / top) * 100)}%` }}
                    />
                  </span>
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {n} × {rateText(t.rates[plan])}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {t.how === "Invoiced" ? "On the invoice" : "Taken instantly"}
                </span>
                <span className="text-right text-neutral-100">
                  <Money value={sum} />
                </span>
              </Link>
            ))}
          </div>

          {/* The upgrade answer, worked out from this cycle's own activity */}
          <h3 className="mt-8 text-[13px] text-neutral-500">
            This cycle on each plan · the full 30 days at today&apos;s pace
          </h3>
          <div className="mt-3 grid gap-6 lg:grid-cols-3">
            {priced.map((x) => (
              <div key={x.p.id} className="min-w-0">
                <div className="flex items-baseline gap-2 text-[13px]">
                  <span
                    className={
                      x.p.id === plan ? "text-white" : "text-neutral-300"
                    }
                  >
                    {x.p.name}
                  </span>
                  {x.p.id === plan && (
                    <span className="text-[11px] text-neutral-500">
                      your plan
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[20px] font-medium tracking-[-0.02em] text-white">
                  {x.custom && x.p.id === "enterprise" ? (
                    <span className="text-neutral-400">Quoted for you</span>
                  ) : (
                    <Money value={x.all} />
                  )}
                </div>
                <div className="mt-1 text-[12px] text-neutral-500 tabular-nums">
                  {x.custom && x.p.id === "enterprise" ? (
                    `From $${x.p.price.toLocaleString("en-US")} a cycle, rates agreed with you`
                  ) : (
                    <>
                      <span className="amount">${usd(x.fees)}</span> fees +{" "}
                      <span className="amount">${x.p.price}</span> plan
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[13px] leading-relaxed text-neutral-400">
            {cheapest.p.id === plan
              ? `For the way you use Gravv now, ${current.name} is the cheapest plan.`
              : `${cheapest.p.name} would cost about $${usd(mine.all - cheapest.all)} less this cycle.`}{" "}
            {plan === "starter" && breakEven
              ? `Growth starts paying for itself once Starter fees pass about $${Math.round(breakEven).toLocaleString("en-US")} a cycle.`
              : ""}
          </p>
        </section>

        {/* Rates */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[15px] font-medium text-white">Rates</h2>
            <span className="text-[12px] text-neutral-500">
              Changing plan applies new rates straight away
            </span>
          </div>
          <table className="mt-3 w-full table-fixed border-t border-white/15 text-[13px]">
            <colgroup>
              <col />
              <col className="w-[150px]" />
              {PLANS.map((p) => (
                <col key={p.id} className="w-[150px]" />
              ))}
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-2.5 font-normal">Fee</th>
                <th className="py-2.5 font-normal">Charged</th>
                {PLANS.map((p) => (
                  <th
                    key={p.id}
                    className={`py-2.5 font-normal ${p.id === plan ? "text-neutral-200" : ""}`}
                  >
                    {p.name}
                    {p.id === plan && " (you)"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["Money in", "Money out", "Cards", "Conversion"] as const).map(
                (g) => (
                  <Fragment key={g}>
                    <tr>
                      <td
                        colSpan={5}
                        className="pt-5 pb-1.5 text-[11px] tracking-[0.06em] text-neutral-500 uppercase"
                      >
                        {g}
                      </td>
                    </tr>
                    {FEE_TYPES.filter((t) => t.group === g).map((t) => (
                      <tr key={t.id} className="border-t border-white/6">
                        <td className="py-2.5 pr-4">
                          <div className="text-neutral-100">{t.label}</div>
                          <div className="text-[11px] text-neutral-600">
                            {t.system}
                          </div>
                        </td>
                        <td className="py-2.5 text-neutral-500">
                          {t.how === "Invoiced"
                            ? "On the invoice"
                            : "Instantly"}
                        </td>
                        {PLANS.map((p) => (
                          <td
                            key={p.id}
                            className={`py-2.5 tabular-nums ${p.id === plan ? "text-white" : "text-neutral-400"}`}
                          >
                            {rateText(t.rates[p.id])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </section>
      </div>

      {changing && (
        <ChangePlan
          plan={plan}
          priced={priced}
          onClose={() => setChanging(false)}
          onPick={(id) => {
            // Enterprise is a conversation with Gravv, not an instant switch.
            if (id !== "enterprise") setPlan(id);
            setChanging(false);
            const p = PLANS.find((x) => x.id === id)!;
            setToast(
              id === "enterprise"
                ? "Request sent — the Gravv team will send your Enterprise terms"
                : `You're on ${p.name} — new rates apply from now`,
            );
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

function ChangePlan({
  plan,
  priced,
  onClose,
  onPick,
}: {
  plan: PlanId;
  priced: { p: (typeof PLANS)[number]; all: number; custom: boolean }[];
  onClose: () => void;
  onPick: (id: PlanId) => void;
}) {
  const [pick, setPick] = useState<PlanId>(plan);
  const daysLeft = Math.ceil((CYCLE_END - AS_OF) / DAY);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const chosen = PLANS.find((p) => p.id === pick)!;
  const enterprise = pick === "enterprise";
  return (
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        className="scrim-in absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        className="orbit-pop absolute top-[12vh] left-1/2 w-[520px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-raised p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="plan-title" className="text-[17px] font-medium text-white">
              Change plan
            </h2>
            <p className="mt-1 text-[13px] text-neutral-400">
              Priced on this cycle&apos;s activity, so you can compare like for
              like.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        <div
          role="radiogroup"
          className="mt-5 divide-y divide-white/6 rounded-xl border border-white/8"
        >
          {priced.map(({ p, all, custom }) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pick === p.id}
              onClick={() => setPick(p.id)}
              className={`flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl ${pick === p.id ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}
            >
              <span
                aria-hidden
                className={`mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border ${pick === p.id ? "border-white" : "border-white/25"}`}
              >
                {pick === p.id && (
                  <span className="size-2 rounded-full bg-white" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2 text-[13px]">
                  <span className="text-white">{p.name}</span>
                  {p.id === plan && (
                    <span className="text-[11px] text-neutral-500">
                      current
                    </span>
                  )}
                  <span className="ml-auto text-neutral-300 tabular-nums">
                    {p.price
                      ? `$${p.price.toLocaleString("en-US")} a cycle`
                      : "Free"}
                  </span>
                </span>
                <span className="mt-0.5 block text-[12px] text-neutral-500">
                  {p.perks.join(" · ")}
                </span>
                <span className="mt-1 block text-[12px] text-neutral-400 tabular-nums">
                  {custom && p.id === "enterprise" ? (
                    "Rates agreed with you"
                  ) : (
                    <>
                      This cycle all-in:{" "}
                      <span className="amount">${usd(all)}</span>
                    </>
                  )}
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">
          {enterprise
            ? "Enterprise is set up with the Gravv team. We'll send terms; nothing changes until you sign."
            : pick === plan
              ? "This is your plan."
              : `${chosen.name} starts now. ${chosen.price ? `$${usd((chosen.price * daysLeft) / 30)} today for the ${daysLeft} days left in this cycle, then $${chosen.price} a cycle.` : "No charge — any unused paid time is credited to your next invoice."}`}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pick === plan}
            onClick={() => onPick(pick)}
            className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
          >
            {enterprise ? "Talk to Gravv" : `Switch to ${chosen.name}`}
            <ArrowRight size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
