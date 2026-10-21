"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, Search, X } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { Roll } from "@/app/_components/roll";
import {
  ALLOWLIST,
  ENV,
  HEALTH,
  KEYS,
  REQUEST_LOG,
  requestDetail,
  type ApiRequest,
  type Env,
} from "../_data";

const PER_PAGE = 14;
const METHOD_TONE: Record<ApiRequest["method"], string> = {
  GET: "text-sky-300",
  POST: "text-emerald-300",
  PATCH: "text-amber-300",
  DELETE: "text-red-400",
};
const statusTone = (code: number) =>
  code < 300
    ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
    : code < 500
      ? "bg-amber-400/10 text-amber-300"
      : "bg-red-500/10 text-red-400";
const keyName = (id: string) =>
  id === "revoked"
    ? "Revoked key"
    : (KEYS.find((k) => k.id === id)?.name ?? "Deleted key");
const keyHint = (r: ApiRequest) =>
  r.keyId === "revoked"
    ? "gk_live_…19ce"
    : `${r.env === "live" ? "gk_live_" : "gk_test_"}…${KEYS.find((k) => k.id === r.keyId)?.last4 ?? "????"}`;
const allowedBy = (ip: string) =>
  ALLOWLIST.find(
    (a) =>
      a.cidr === ip ||
      (a.cidr.endsWith("/24") &&
        ip.startsWith(`${a.cidr.split(".").slice(0, 3).join(".")}.`)),
  );
const time = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});
const p95 = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};

/**
 * Every API request, with the data behind it. The top says how traffic looks today; pick a
 * request and the inspector shows what it did, in a sentence, and exactly what went back and forth.
 */
export function RequestsPage() {
  const [env, setEnv] = useState<Env>("live");
  const [status, setStatus] = useState<"all" | "errors">("all");
  const [path, setPath] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("env") === "sandbox")
        setEnv("sandbox");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const health = HEALTH[env];
  const all = useMemo(() => REQUEST_LOG.filter((r) => r.env === env), [env]);
  const q = query.trim().toLowerCase();
  const rows = all.filter(
    (r) =>
      (status === "all" || r.status >= 400) &&
      (!path || r.path === path) &&
      (keyFilter === "all" || r.keyId === keyFilter) &&
      (!q ||
        `${r.method} ${r.path} ${r.ip} ${r.status} ${r.id}`
          .toLowerCase()
          .includes(q)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const selected = rows.find((r) => r.id === selectedId) ?? visible[0];
  const reset = () => setPage(1);

  // Busiest endpoints. The log is a sample, so scale to the day: calls by each path's share
  // of traffic, failures by its share of the day's errors — the numbers agree with the header.
  const endpoints = useMemo(() => {
    const failedAll = all.filter((r) => r.status >= 400).length || 1;
    const by = new Map<string, ApiRequest[]>();
    for (const r of all) by.set(r.path, [...(by.get(r.path) ?? []), r]);
    return [...by.entries()]
      .map(([p, rs]) => {
        const calls = Math.round((rs.length / all.length) * health.requests);
        const failed = Math.round(
          (rs.filter((r) => r.status >= 400).length / failedAll) *
            health.errors,
        );
        return {
          path: p,
          method: rs[0].method,
          calls,
          errorRate: calls ? failed / calls : 0,
          p95: p95(rs.map((r) => r.ms)),
        };
      })
      .sort((a, b) => b.calls - a.calls);
  }, [all, health.requests, health.errors]);

  // How the day's requests ended: real totals, with failures split by the sample's mix.
  const failedSample = all.filter((r) => r.status >= 400);
  const share = (code: number) =>
    failedSample.length
      ? failedSample.filter((r) => r.status === code).length /
        failedSample.length
      : 0;
  const results = [
    {
      label: "Succeeded",
      n: health.requests - health.errors,
      tone: "bg-[var(--flow-in)]",
    },
    {
      label: "Revoked key (401)",
      n: Math.round(health.errors * share(401)),
      tone: "bg-red-500",
    },
    {
      label: "Invalid request (422)",
      n: Math.round(health.errors * share(422)),
      tone: "bg-red-500/60",
    },
    {
      label: "Rate limited (429)",
      n: Math.round(health.errors * share(429)),
      tone: "bg-red-500/35",
    },
  ].filter((x) => x.n);

  return (
    <div className="mx-auto max-w-(--page-max) px-8 pt-10 pb-28">
      <Link
        href="/manage/configure"
        className="inline-flex items-center gap-0.5 text-[13px] text-neutral-500 hover:text-white"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Configure
      </Link>
      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            API requests
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            What your systems asked Kredete to do in the last 24 hours, and what
            came back.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Environment"
          className="flex shrink-0 rounded-full bg-white/[0.07] p-0.5"
        >
          {(["sandbox", "live"] as Env[]).map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={env === e}
              onClick={() => {
                setEnv(e);
                setStatus("all");
                setPath(null);
                setKeyFilter("all");
                setSelectedId(null);
                reset();
              }}
              className={`h-8 rounded-full px-3.5 text-[13px] transition-colors ${
                env === e
                  ? e === "sandbox"
                    ? "bg-amber-400/15 font-medium text-amber-300"
                    : "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                  : "text-neutral-500 hover:text-white"
              }`}
            >
              {ENV[e].label}
            </button>
          ))}
        </div>
      </div>

      {/* Today at a glance */}
      <section
        aria-label="Traffic"
        className="mt-8 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4"
      >
        <div className="rounded-xl border border-white/8 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[12px] text-neutral-500">
                Requests per hour
              </div>
              <div className="mt-1.5 flex items-baseline gap-3">
                <span className="text-[24px] leading-none font-medium tracking-[-0.03em] text-white tabular-nums">
                  <Roll value={health.requests.toLocaleString("en-US")} />
                </span>
                <span className="text-[13px] text-neutral-500 tabular-nums">
                  {health.errors} failed · {health.p95} ms p95
                </span>
              </div>
            </div>
            <span className="flex items-center gap-3 text-[11.5px] text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-1 rounded-[1px] bg-[var(--flow-in)] opacity-50" />
                Succeeded
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-1 rounded-[1px] bg-red-500" />
                Failed
              </span>
            </span>
          </div>
          <HourChart hourly={health.hourly} errors={health.errors} />
        </div>
        <div className="rounded-xl border border-white/8 px-5 py-4">
          <div className="text-[12px] text-neutral-500">How they ended</div>
          <ul className="mt-3 space-y-2.5">
            {results.map((x) => (
              <li key={x.label}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="text-neutral-200">{x.label}</span>
                  <span className="text-neutral-500 tabular-nums">
                    <Roll
                      value={
                        x.label === "Succeeded"
                          ? `${((x.n / health.requests) * 100).toFixed(1)}%`
                          : x.n.toLocaleString("en-US")
                      }
                    />
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${x.tone}`}
                    style={{
                      width: `${Math.max(1.5, (x.n / health.requests) * 100)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {status === "all" && all.some((r) => r.status >= 400) && (
            <button
              type="button"
              onClick={() => {
                setStatus("errors");
                reset();
              }}
              className="mt-3 flex items-center gap-0.5 text-[12px] text-neutral-200 hover:text-white"
            >
              Show only failures
              <ArrowUpRight
                size={12}
                strokeWidth={1.75}
                className="rotate-90"
              />
            </button>
          )}
        </div>
      </section>

      <section
        aria-label="Busiest endpoints"
        className="mt-4 rounded-xl border border-white/8"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-3">
          <span className="text-[13px] text-white">Busiest endpoints</span>
          <span className="text-[12px] text-neutral-500">
            Pick one to see only its requests
          </span>
        </div>
        <ul className="grid grid-cols-2 divide-white/[0.06]">
          {endpoints.map((e, i) => {
            const on = path === e.path;
            return (
              <li
                key={e.path}
                className={`${i % 2 ? "border-l border-white/[0.06]" : ""} ${i > 1 ? "border-t border-white/[0.06]" : ""}`}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setPath(on ? null : e.path);
                    reset();
                  }}
                  className={`flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors ${on ? "bg-white/[0.05]" : "hover:bg-white/[0.02]"}`}
                >
                  <span
                    className={`w-[42px] shrink-0 font-mono text-[11px] font-medium ${METHOD_TONE[e.method]}`}
                  >
                    {e.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-neutral-100">
                    {e.path}
                  </span>
                  <span className="w-[70px] shrink-0 text-right text-[12px] text-neutral-300 tabular-nums">
                    {e.calls.toLocaleString("en-US")}
                  </span>
                  <span
                    className={`w-[64px] shrink-0 text-right text-[12px] tabular-nums ${e.errorRate > 0.1 ? "text-red-400" : "text-neutral-500"}`}
                  >
                    {(e.errorRate * 100).toFixed(
                      e.errorRate && e.errorRate < 0.1 ? 1 : 0,
                    )}
                    % err
                  </span>
                  <span className="w-[56px] shrink-0 text-right text-[12px] text-neutral-500 tabular-nums">
                    {e.p95} ms
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* List + inspector */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] text-white">Requests</h2>
          {path && (
            <button
              type="button"
              onClick={() => {
                setPath(null);
                reset();
              }}
              className="flex h-7 items-center gap-1 rounded-full bg-white/[0.08] pr-1.5 pl-2.5 font-mono text-[11.5px] text-white"
            >
              {path}
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex h-8 w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35">
            <Search size={13} strokeWidth={1.75} className="text-neutral-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
              placeholder="Path, IP, status or ID…"
              aria-label="Search requests"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
          <Dropdown
            label="Key"
            variant="chip"
            align="right"
            value={keyFilter}
            active={keyFilter !== "all"}
            options={[
              { value: "all", label: "All keys" },
              ...[...new Set(all.map((r) => r.keyId))].map((id) => ({
                value: id,
                label: keyName(id),
              })),
            ]}
            onChange={(v) => {
              setKeyFilter(v);
              reset();
            }}
          />
          {(["all", "errors"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setStatus(f);
                reset();
              }}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] capitalize transition-colors ${
                status === f
                  ? "bg-white/[0.08] font-medium text-white"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
              }`}
            >
              {f}
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {f === "all"
                  ? all.length
                  : all.filter((r) => r.status >= 400).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_440px] items-start gap-4">
        <div>
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/8">
            {visible.map((r) => {
              const on = selected?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelectedId(r.id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${on ? "bg-white/[0.06]" : "hover:bg-white/[0.02]"}`}
                  >
                    <span
                      className={`inline-flex h-6 w-[44px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${statusTone(r.status)}`}
                    >
                      {r.status}
                    </span>
                    <span
                      className={`w-[44px] shrink-0 font-mono text-[11px] font-medium ${METHOD_TONE[r.method]}`}
                    >
                      {r.method}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[12.5px] text-neutral-100">
                        {r.path}
                      </span>
                      <span
                        className={`block truncate text-[11.5px] ${r.keyId === "revoked" ? "text-amber-300" : "text-neutral-500"}`}
                      >
                        {keyName(r.keyId)}
                      </span>
                    </span>
                    <span className="w-[54px] shrink-0 text-right text-[12px] text-neutral-500 tabular-nums">
                      {r.ms} ms
                    </span>
                    <span className="w-[76px] shrink-0 text-right text-[12px] text-neutral-500 tabular-nums">
                      {time.format(new Date(r.at))}
                    </span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="py-14 text-center text-[13px] text-neutral-500">
                No requests match.
              </li>
            )}
          </ul>
          <div className="mt-3 flex items-center justify-between text-[13px] text-neutral-500">
            <span className="tabular-nums">
              {rows.length
                ? `Showing ${(current - 1) * PER_PAGE + 1}–${Math.min(current * PER_PAGE, rows.length)} of ${rows.length}`
                : "No results"}
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                disabled={current === 1}
                onClick={() => setPage(current - 1)}
                className="h-8 rounded-full px-3 text-neutral-300 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:text-neutral-600"
              >
                Previous
              </button>
              <span className="px-1 tabular-nums">
                {current} / {pages}
              </span>
              <button
                type="button"
                disabled={current === pages}
                onClick={() => setPage(current + 1)}
                className="h-8 rounded-full px-3 text-neutral-300 hover:bg-white/[0.06] hover:text-white disabled:pointer-events-none disabled:text-neutral-600"
              >
                Next
              </button>
            </span>
          </div>
        </div>

        {selected ? <Inspector key={selected.id} r={selected} /> : <div />}
      </div>
    </div>
  );
}

/** Hour by hour, oldest first: successes in brand green, failures stacked on top in red. */
function HourChart({ hourly, errors }: { hourly: number[]; errors: number }) {
  const total = hourly.reduce((s, v) => s + v, 0) || 1;
  // Spread the day's failures across the hours by traffic, nudged so they don't look uniform.
  const failed = hourly.map((v, i) =>
    Math.round((errors * v * (0.4 + ((i * 7) % 11) / 8)) / total),
  );
  const max = Math.max(1, ...hourly);
  return (
    <div className="mt-4">
      <div className="flex h-28 items-end gap-[3px]">
        {hourly.map((v, i) => {
          const f = Math.min(v, failed[i]);
          return (
            <div
              key={i}
              title={`${24 - i}h ago · ${v.toLocaleString("en-US")} requests · ${f} failed`}
              className="flex flex-1 flex-col justify-end"
              style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
            >
              {f > 0 && (
                <span
                  className="rounded-t-[2px] bg-red-500"
                  style={{
                    height: `${Math.min(100, Math.max(2, (f / v) * 100 * 6))}%`,
                  }}
                />
              )}
              <span
                className={`flex-1 bg-[var(--flow-in)] opacity-45 ${f > 0 ? "" : "rounded-t-[2px]"}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
        <span>24h ago</span>
        <span>12h ago</span>
        <span>Now</span>
      </div>
    </div>
  );
}

type Pane = "response" | "request" | "headers";

/** One request, understood: a sentence, the facts, then the raw data on tabs. */
function Inspector({ r }: { r: ApiRequest }) {
  const d = requestDetail(r);
  const [pane, setPane] = useState<Pane>("response");
  const allowed = allowedBy(r.ip);
  const headers = {
    request: [
      `${r.method} ${r.path.replace("{id}", "trf_8f2k1c9q")}`,
      `Host: ${ENV[r.env].base.replace("https://", "").replace("/v1", "")}`,
      `Authorization: Bearer ${keyHint(r)}`,
      "Content-Type: application/json",
      `Idempotency-Key: ${r.id.slice(4, 12)}`,
      `User-Agent: kredete-node/4.2.0`,
    ].join("\n"),
    response: [
      `HTTP/1.1 ${r.status}`,
      `Request-Id: ${r.id}`,
      "Content-Type: application/json",
      `X-RateLimit-Remaining: ${r.status === 429 ? 0 : 94}`,
      `Server-Timing: total;dur=${r.ms}`,
    ].join("\n"),
  };
  const body =
    pane === "response" ? d.response : pane === "request" ? d.request : null;
  const json = body === undefined ? null : JSON.stringify(body, null, 2);

  return (
    <aside
      aria-label="Request details"
      className="sticky top-6 rounded-xl border border-white/8"
    >
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 items-center rounded-full px-2 font-mono text-[11px] ${statusTone(r.status)}`}
          >
            {r.status}
          </span>
          <span
            className={`font-mono text-[11.5px] font-medium ${METHOD_TONE[r.method]}`}
          >
            {r.method}
          </span>
          <span className="truncate font-mono text-[12.5px] text-neutral-100">
            {r.path}
          </span>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-white">{d.summary}</p>
        {r.why && (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-neutral-400">
            {r.why}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
          {d.facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11.5px] text-neutral-500">{f.label}</dt>
              <dd
                className={`mt-0.5 truncate ${f.mono ? "font-mono text-[12px]" : "text-[13px]"} text-neutral-100`}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        {d.link && (
          <Link
            href={d.link.href}
            className="mt-4 inline-flex h-8 items-center gap-1 rounded-full border border-white/12 px-3 text-[12.5px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            {d.link.label}
            <ArrowUpRight size={12} strokeWidth={1.75} />
          </Link>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-b border-white/8 px-5 py-3.5 text-[12px]">
        <div className="min-w-0">
          <dt className="text-neutral-500">Key</dt>
          <dd
            className={`mt-0.5 truncate ${r.keyId === "revoked" ? "text-amber-300" : "text-neutral-200"}`}
          >
            {keyName(r.keyId)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-neutral-500">From</dt>
          <dd className="mt-0.5 truncate">
            <span className="font-mono text-neutral-200">{r.ip}</span>
            <span className={allowed ? "text-neutral-500" : "text-amber-300"}>
              {allowed
                ? ` · ${allowed.label.split(" (")[0]}`
                : " · not allowlisted"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Took</dt>
          <dd className="mt-0.5 text-neutral-200 tabular-nums">{r.ms} ms</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-neutral-500">Request ID</dt>
          <dd className="mt-0.5 flex min-w-0 items-center gap-0.5">
            <span className="truncate font-mono text-neutral-200">{r.id}</span>
            <CopyButton value={r.id} label="Copy request ID" />
          </dd>
        </div>
      </dl>

      <div className="px-5 pt-3 pb-5">
        <div role="tablist" className="flex gap-5 border-b border-white/8">
          {(["response", "request", "headers"] as Pane[]).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pane === p}
              onClick={() => setPane(p)}
              className={`-mb-px border-b pb-2 text-[12.5px] capitalize transition-colors ${
                pane === p
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {p === "request"
                ? "Request body"
                : p === "response"
                  ? "Response"
                  : "Headers"}
            </button>
          ))}
        </div>
        <div className="relative mt-3">
          {pane === "headers" ? (
            <div className="space-y-2">
              <Code text={headers.request} />
              <Code text={headers.response} />
            </div>
          ) : json === null ? (
            <p className="rounded-lg bg-black/20 px-3 py-6 text-center text-[12px] text-neutral-500">
              {r.method} requests don&apos;t send a body.
            </p>
          ) : (
            <Code text={json} />
          )}
        </div>
      </div>
    </aside>
  );
}

function Code({ text }: { text: string }) {
  return (
    <div className="group relative">
      <pre className="sidebar-scroll max-h-[300px] overflow-auto rounded-lg bg-black/30 p-3 font-mono text-[11.5px] leading-relaxed text-neutral-300">
        {text}
      </pre>
      <span className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <CopyButton value={text} label="Copy" />
      </span>
    </div>
  );
}
