"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import { ME, MEMBERS } from "../manage/roles/_data";
import { REQUESTS, ago } from "../manage/approvals/_data";
import { disputes, daysUntil } from "../card-collection/disputes/_data";
import { collections, isStuck } from "../card-collection/collections/_data";
import { recipients } from "../recipients/_data";
import { AS_OF as ACCOUNTS_AS_OF, accounts } from "../account/_data";
import { wallets } from "../wallets/_data";
import { TOTAL as CUSTOMERS, liteAt } from "../customers/_data";
import { transactions } from "../transactions/_data";
import { GO_LIVE } from "../manage/configure/_data";
import { DAY, days, sum } from "./data";

type Env = "live" | "sandbox";
const FX: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  NGN: 1 / 1550,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0067,
};
const usd = (v: number) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const compact = (v: number) => {
  const a = Math.abs(v);
  return `$${a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a)}`;
};
const n = (v: number) => v.toLocaleString("en-US");
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function Overview() {
  const [env, setEnv] = useState<Env>("live");
  const [done, setDone] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // ——— Where you stand ———
  const held =
    accounts
      .filter((a) => a.status === "Active" || a.status === "Frozen")
      .reduce((s, a) => s + a.balance * (FX[a.currency] ?? 1), 0) +
    wallets.reduce((s, w) => s + w.balance, 0);
  const customers = useMemo(() => {
    let verified = 0,
      waiting = 0,
      onYou = 0;
    for (let i = 0; i < CUSTOMERS; i++) {
      const v = liteAt(i).verification;
      if (v === "Verified") verified++;
      else if (v === "Pending") waiting++;
      else onYou++;
    }
    return { verified, waiting, onYou };
  }, []);
  const funded = wallets.filter((w) => w.balance > 0).length;
  const active = accounts.filter((a) => a.status === "Active").length;
  const provisioning = accounts.filter((a) => a.status === "Pending");
  const oldest = provisioning.reduce<string | null>(
    (o, a) => (!o || a.createdAt < o ? a.createdAt : o),
    null,
  );

  // Balance over the last 30 days: today's total, walked back by each day's net movement.
  const history = useMemo(() => {
    const last = days.slice(-30);
    let b = held;
    const pts: { t: number; v: number }[] = [];
    for (let i = last.length - 1; i >= 0; i--) {
      pts.unshift({ t: last[i].t, v: b });
      b -= sum(last[i].in) - sum(last[i].out);
    }
    return pts;
  }, [held]);
  const dayChange =
    history[history.length - 1].v - history[history.length - 2].v;
  const monthChange = history[history.length - 1].v - history[0].v;

  // ——— Needs you: decisions, with the money attached ———
  const myRole = MEMBERS.find((m) => m.name === ME)?.role;
  const approvals = REQUESTS.filter(
    (q) =>
      q.state === "pending" &&
      !!myRole &&
      q.approvers.includes(myRole) &&
      q.requestedBy !== ME &&
      !q.decisions.some((d) => d.by === ME),
  ).sort((a, b) => b.amount - a.amount);
  const respond = disputes
    .filter((d) => d.status === "Needs response")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const stuck = collections.filter(isStuck);
  const closed = recipients.find((r) => r.payments.some((p) => p.failure));
  const sym: Record<string, string> = {
    USD: "$",
    USDC: "",
    EUR: "€",
    GBP: "£",
    NGN: "₦",
  };
  const amt = (v: number, c: string) =>
    `${sym[c] ?? ""}${n(v)}${c === "USDC" ? " USDC" : ""}`;

  type Item = {
    id: string;
    title: string;
    why: string;
    warn?: string;
    action: string;
    href?: string;
    run?: () => void;
  };
  const items: Item[] = [];
  if (approvals[0]) {
    const q = approvals[0];
    const c = q.context;
    items.push({
      id: "approval",
      title: `Approve ${amt(q.amount, q.currency)} to ${q.recipient.name}`,
      why: `${q.requestedBy.split(" ")[0]} asked ${ago(q.requestedAt)}${q.note ? ` · ${q.note}` : ""}${approvals.length > 1 ? ` · ${approvals.length - 1} more waiting` : ""}`,
      warn: c?.detailsChangedAt
        ? `Bank details changed ${ago(c.detailsChangedAt)}`
        : c?.history.usual && q.amount >= c.history.usual * 2
          ? `${(q.amount / c.history.usual).toFixed(1)}× what you usually send`
          : undefined,
      action: "Review",
      href: "/manage/approvals",
    });
  }
  if (respond[0]) {
    const d = respond[0];
    items.push({
      id: "dispute",
      title: `Answer ${respond.length} dispute${respond.length === 1 ? "" : "s"}`,
      why: `Next: ${d.payment.customer.name} · ${usd(d.amount)} USDC · due in ${daysUntil(d.dueAt)} days`,
      warn:
        daysUntil(d.dueAt) <= 3
          ? "Miss the deadline and the customer keeps the money"
          : undefined,
      action: "Respond",
      href: "/card-collection/disputes",
    });
  }
  if (stuck[0]) {
    const c = stuck[0];
    items.push({
      id: "settle",
      title: `Retry settlement for ${c.customer.name}`,
      why: `They paid ${usd(c.subtotal)} USDC; it hasn't reached your wallet yet`,
      action: "Retry",
      run: () => {
        setDone((s) => new Set(s).add("settle"));
        setToast(
          `Settled — ${usd(c.subtotal)} USDC is in your Treasury wallet`,
        );
      },
    });
  }
  if (closed) {
    const p = closed.payments.find((x) => x.failure)!;
    items.push({
      id: "recipient",
      title: `Update ${closed.name}'s bank details`,
      why: `Their account is closed — ${amt(p.amount, p.currency)} came back to you`,
      action: "Update",
      href: "/recipients",
    });
  }
  const open = items.filter((i) => !done.has(i.id));
  const checks = GO_LIVE;
  const left = checks.filter((c) => !c.done);
  const recent = [...transactions]
    .filter((t) => t.amount > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  return (
    <div className="sidebar-scroll h-full overflow-y-auto">
      <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-20">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
              Good morning, {ME.split(" ")[0]}
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              {open.length
                ? `${open.length} thing${open.length === 1 ? "" : "s"} need${open.length === 1 ? "s" : ""} you today.`
                : "Nothing needs you today."}
            </p>
          </div>
          <Dropdown
            label="Environment"
            variant="compact"
            align="right"
            value={env}
            options={[
              { value: "live", label: "Live", hint: "Real money" },
              { value: "sandbox", label: "Sandbox", hint: "Before go-live" },
            ]}
            onChange={setEnv}
          />
        </div>

        {/* Where you stand */}
        {env === "sandbox" ? (
          <section className="mt-10 rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[13px] text-amber-300">Sandbox</div>
                <h2 className="mt-1 text-[22px] font-medium tracking-[-0.02em] text-white">
                  {left.length} step{left.length === 1 ? "" : "s"} left before
                  you can move real money
                </h2>
                <p className="mt-1 text-[13px] text-neutral-400">
                  Everything below is test data. Next:{" "}
                  {left[0]?.label.toLowerCase() ?? "switch to Live"}.
                </p>
              </div>
              <Link
                href="/manage/configure"
                className="flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
              >
                Continue in Configure
                <ArrowRight size={14} strokeWidth={1.75} />
              </Link>
            </div>
            <ol className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-3">
              {checks.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full ${c.done ? "bg-[var(--flow-in)] text-black" : "border border-dashed border-amber-300/70"}`}
                  >
                    {c.done && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span
                    className={
                      c.done
                        ? "text-neutral-500 line-through decoration-neutral-600"
                        : "text-neutral-100"
                    }
                  >
                    {c.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <section className="mt-10 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="text-[13px] text-neutral-500">
                Held for your customers · USD equivalent
              </div>
              <div className="mt-3 text-[44px] leading-none font-medium tracking-[-0.035em] text-white">
                <span className="amount tabular-nums">
                  <Roll value={`$${usd(held).split(".")[0]}`} />
                  <sup className="ml-0.5 align-[0.85em] text-[0.4em] font-normal tracking-normal text-neutral-500">
                    .{usd(held).split(".")[1]}
                  </sup>
                </span>
              </div>
              <p className="mt-3 text-[13px] text-neutral-400">
                <span
                  className={
                    dayChange >= 0 ? "text-[var(--ok-fg)]" : "text-neutral-300"
                  }
                >
                  {dayChange >= 0 ? "+" : "−"}
                  <span className="amount">{compact(dayChange)}</span> today
                </span>{" "}
                · {monthChange >= 0 ? "+" : "−"}
                <span className="amount">{compact(monthChange)}</span> in 30
                days · across {n(wallets.length)} wallets and{" "}
                {n(accounts.length)} accounts
              </p>
            </div>
            <BalanceLine points={history} />
          </section>
        )}

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Needs you — the reason to open this page */}
          <section>
            <h2 className="text-[15px] font-medium text-white">Needs you</h2>
            <ul className="mt-3 divide-y divide-white/6 border-y border-white/8">
              {open.map((x) => (
                <li key={x.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-white">
                      {x.title}
                    </div>
                    <div className="mt-1 truncate text-[12.5px] text-neutral-500">
                      {x.why}
                    </div>
                    {x.warn && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-amber-300">
                        <AlertTriangle
                          size={13}
                          strokeWidth={1.75}
                          className="shrink-0"
                        />
                        {x.warn}
                      </div>
                    )}
                  </div>
                  {x.href ? (
                    <Link
                      href={x.href}
                      className="h-8 shrink-0 rounded-full border border-white/12 px-3.5 text-[13px] leading-8 text-neutral-100 transition-colors hover:border-white/30"
                    >
                      {x.action}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={x.run}
                      className="h-8 shrink-0 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
                    >
                      {x.action}
                    </button>
                  )}
                </li>
              ))}
              {open.length === 0 && (
                <li className="flex items-center gap-2 py-5 text-[13px] text-neutral-400">
                  <Check
                    size={14}
                    strokeWidth={2}
                    className="text-[var(--ok-fg)]"
                  />
                  You&apos;re all caught up.
                </li>
              )}
            </ul>
          </section>

          {/* Recent activity, in words */}
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-medium text-white">
                Recent activity
              </h2>
              <Link
                href="/transactions"
                className="text-[12.5px] text-neutral-400 hover:text-white"
              >
                All transactions
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-white/6 border-y border-white/8">
              {recent.map((t) => {
                const credit = t.direction === "Credit";
                return (
                  <li key={t.id} className="flex items-baseline gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-neutral-100">
                        {t.type === "Account Funding"
                          ? `Deposit from ${t.source.name}`
                          : t.type === "Payout"
                            ? `Payout to ${t.destination.name}`
                            : t.type === "Offramp"
                              ? `Offramp to ${t.destination.name}`
                              : `Sent on ${t.channel}`}
                      </div>
                      <div className="mt-0.5 text-[12px] text-neutral-500 tabular-nums">
                        {day.format(new Date(t.createdAt))} · {t.channel}
                        {t.status !== "Completed" && (
                          <span
                            className={
                              t.status === "Failed"
                                ? "text-rose-300"
                                : "text-amber-300"
                            }
                          >
                            {" "}
                            · {t.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`amount shrink-0 text-[13px] font-medium tabular-nums ${t.status === "Failed" ? "text-neutral-600 line-through" : credit ? "text-[var(--ok-fg)]" : "text-white"}`}
                    >
                      {credit ? "+" : "−"}
                      {usd(t.amount)}
                      <span className="ml-1 text-[11px] font-normal text-neutral-500">
                        {credit ? t.to : t.from}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Your customers' side of it, with the reason behind each number */}
        <section className="mt-12 grid gap-y-8 border-t border-white/8 pt-7 lg:grid-cols-3">
          <Health
            label="Customers"
            value={n(CUSTOMERS)}
            lines={[
              `${n(customers.verified)} verified`,
              `${n(customers.waiting)} waiting on identity checks · ${n(customers.onYou)} need you`,
            ]}
            href="/customers"
          />
          <Health
            label="Wallets"
            value={n(wallets.length)}
            lines={[
              `${n(funded)} funded`,
              `${n(wallets.length - funded)} never received money`,
            ]}
            href="/wallets"
          />
          <Health
            label="Accounts"
            value={n(accounts.length)}
            lines={[
              `${n(active)} active`,
              `${n(provisioning.length)} waiting on banks${oldest ? ` · oldest ${Math.round((ACCOUNTS_AS_OF - Date.parse(oldest)) / DAY)} days` : ""}`,
            ]}
            href="/account"
          />
        </section>
      </div>

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

function Health({
  label,
  value,
  lines,
  href,
}: {
  label: string;
  value: string;
  lines: string[];
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col border-white/8 lg:px-8 lg:first:pl-0 lg:last:pr-0 lg:[&:not(:first-child)]:border-l"
    >
      <div className="flex items-center justify-between text-[13px] text-neutral-500">
        {label}
        <ArrowRight
          size={13}
          strokeWidth={1.75}
          className="text-neutral-600 transition-colors group-hover:text-white"
        />
      </div>
      <div className="mt-2 text-[28px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
        {value}
      </div>
      <div className="mt-3 text-[12.5px] text-neutral-300">{lines[0]}</div>
      <div className="mt-0.5 truncate text-[12.5px] text-neutral-500">
        {lines[1]}
      </div>
    </Link>
  );
}

/** One quiet line: the total held, day by day, for 30 days. Hover for the day. */
function BalanceLine({ points }: { points: { t: number; v: number }[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(240, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 110;
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const pad = (max - min) * 0.12 || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) =>
    6 + (1 - (v - min + pad) / (max - min + pad * 2)) * (H - 12);
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join("");
  const h = hover === null ? null : points[hover];
  return (
    <div ref={wrap} className="relative" onMouseLeave={() => setHover(null)}>
      <svg
        width={w}
        height={H}
        className="block touch-none"
        role="img"
        aria-label="Total held over the last 30 days"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(
            ((e.clientX - r.left) / r.width) * (points.length - 1),
          );
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        <defs>
          <linearGradient id="held-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--flow-in)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--flow-in)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line}L${w},${H}L0,${H}Z`} fill="url(#held-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--flow-in)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {h && hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={H}
            stroke="currentColor"
            className="text-white/20"
          />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
        <span>{h ? day.format(h.t) : day.format(points[0].t)}</span>
        <span className="amount tabular-nums">
          {h ? `$${usd(h.v)}` : "Today"}
        </span>
      </div>
    </div>
  );
}
