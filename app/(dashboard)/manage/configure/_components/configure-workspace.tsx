"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  EllipsisVertical,
  Eye,
  EyeOff,
  Plus,
  RotateCw,
  Trash2,
  X,
  Search,
} from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { Dropdown } from "@/app/_components/dropdown";
import { PersonAvatar } from "@/app/_components/person-avatar";
import { ME } from "../../roles/_data";
import { Roll } from "@/app/_components/roll";
import {
  ALLOWLIST,
  APPS,
  AS_OF,
  ENDPOINTS,
  ENV,
  EVENT_GROUPS,
  GO_LIVE,
  HEALTH,
  KEYS,
  KEY_USAGE,
  REQUEST_LOG,
  SCOPES,
  ago,
  type AllowedIp,
  type ApiRequest,
  type App,
  type ApiKey,
  type Delivery,
  type Endpoint,
  type Env,
  type ScopeId,
} from "../_data";

const prefix = (env: Env) => (env === "live" ? "gk_live_" : "gk_test_");
const randomSecret = (n: number) =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(n)),
    (b) => "abcdefghijkmnopqrstuvwxyz0123456789"[b % 35],
  ).join("");
const ok = (d: Delivery) => d.status === 200;

const healthOf = (e: Endpoint): "healthy" | "failing" | "off" => {
  if (e.outage) return "failing";
  if (!e.enabled) return e.autoDisabled ? "failing" : "off";
  const recent = e.deliveries.slice(0, 10);
  return recent.filter((d) => !ok(d)).length >= 3 ? "failing" : "healthy";
};
const host = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};
const lasted = (iso: string) => {
  const m = Math.max(1, Math.round((AS_OF - Date.parse(iso)) / 60_000));
  const [n, unit] =
    m < 60
      ? [m, "minute"]
      : m < 1440
        ? [Math.round(m / 60), "hour"]
        : [Math.round(m / 1440), "day"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
};
/** Colour carries meaning here: area of the product, HTTP verb, status class, or the app's own brand. */
const AREA_TONE: Record<string, string> = {
  Money: "bg-emerald-400/10 text-emerald-300",
  "Getting paid": "bg-sky-400/10 text-sky-300",
  Cards: "bg-violet-400/10 text-violet-300",
};
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
const APP_COLOR: Record<string, string> = {
  xero: "#13B5EA",
  qbo: "#2CA01C",
  netsuite: "#125580",
  slack: "#4A154B",
  zapier: "#FF4F00",
};

const scopeText = (k: ApiKey) =>
  k.access === "full"
    ? "Full access — everything the API can do"
    : `Can ${k.access
        .map((s) => SCOPES.find((x) => x.id === s)!.label.toLowerCase())
        .join(", ")
        .replace(/, ([^,]*)$/, " and $1")}`;
/** Which allowlist entry an address falls in (exact, or the same /24). */
const allowedBy = (ip: string, list: AllowedIp[]) =>
  list.find(
    (a) =>
      a.cidr === ip ||
      (a.cidr.endsWith("/24") &&
        ip.startsWith(a.cidr.split(".").slice(0, 3).join(".") + ".")),
  );

export function ConfigureWorkspace() {
  const [env, setEnv] = useState<Env>("live");
  const [keys, setKeys] = useState<ApiKey[]>(KEYS);
  const [endpoints, setEndpoints] = useState<Endpoint[]>(ENDPOINTS);
  const [allowlist, setAllowlist] = useState<AllowedIp[]>(ALLOWLIST);
  const [enforce, setEnforce] = useState(true);
  const [apps, setApps] = useState<App[]>(APPS);
  const [creatingKey, setCreatingKey] = useState(false);
  const [revealed, setRevealed] = useState<{
    name: string;
    secret: string;
    rolled?: boolean;
  } | null>(null);
  const [addingEndpoint, setAddingEndpoint] = useState(false);
  const [endpointId, setEndpointId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<"all" | "errors">("all");
  const [toast, setToast] = useState<string | null>(null);
  const logRef = useRef<HTMLElement>(null);
  const endpointsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const health = HEALTH[env];
  const envKeys = keys.filter((k) => k.env === env);
  const envEndpoints = endpoints.filter((e) => e.env === env);
  const failing = envEndpoints.filter((e) => healthOf(e) === "failing");
  const deliveries = envEndpoints.flatMap((e) => e.deliveries);
  const deliveredRate = deliveries.length
    ? Math.round((deliveries.filter(ok).length / deliveries.length) * 1000) / 10
    : 100;
  const queued = envEndpoints.reduce((s, e) => s + (e.outage?.queued ?? 0), 0);
  const requests = REQUEST_LOG.filter((r) => r.env === env);
  const openEndpoint = endpointId
    ? endpoints.find((e) => e.id === endpointId)
    : undefined;
  const checks = GO_LIVE;
  const left = checks.filter((c) => !c.done);

  const rollKey = (k: ApiKey) => {
    const secret = `${prefix(k.env)}${randomSecret(32)}`;
    setKeys((all) => [
      {
        ...k,
        id: `key_${Date.now()}`,
        last4: secret.slice(-4),
        createdBy: ME,
        createdAt: "Today",
        lastUsed: null,
      },
      ...all.map((x) =>
        x.id === k.id
          ? { ...x, name: `${x.name} (old)`, expiresSoon: "In 24 hours" }
          : x,
      ),
    ]);
    setRevealed({ name: k.name, secret, rolled: true });
  };

  return (
    <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-28">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            Configure
          </h1>
          <p className="mt-1 max-w-[620px] text-[14px] text-neutral-500">
            How your systems talk to Kredete — and whether they&apos;re doing it
            well.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://docs.gravv.xyz"
            target="_blank"
            rel="noreferrer"
            className="flex h-9 items-center gap-1 rounded-full border border-white/12 px-3.5 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
          >
            API docs
            <ArrowUpRight size={13} strokeWidth={1.75} />
          </a>
          <div
            role="radiogroup"
            aria-label="Environment"
            className="flex rounded-full bg-white/[0.07] p-0.5"
          >
            {(["sandbox", "live"] as Env[]).map((e) => (
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={env === e}
                onClick={() => {
                  setEnv(e);
                  setEndpointId(null);
                  setLogFilter("all");
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
      </div>

      {/* Health: the four things that tell you if the integration is OK */}
      <section aria-label="Integration health" className="mt-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[13px] text-neutral-500">
            <span
              className={
                env === "sandbox" ? "text-amber-300" : "text-[var(--flow-in)]"
              }
            >
              {ENV[env].label}
            </span>{" "}
            · last 24 hours
          </h2>
          <span className="text-[12px] text-neutral-500">{ENV[env].note}</span>
        </div>
        <div
          className={`grid grid-cols-4 grid-rows-[auto_auto_auto_auto_auto] divide-x divide-white/8 rounded-xl border ${
            env === "sandbox" ? "border-amber-400/25" : "border-white/8"
          }`}
        >
          <HealthFact
            label="API requests"
            value={<Roll value={health.requests.toLocaleString("en-US")} />}
            note={`Busiest hour: ${Math.max(...health.hourly).toLocaleString("en-US")} requests`}
            action={{
              label: "See requests",
              onClick: () => {
                setLogFilter("all");
                logRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              },
            }}
          />
          <HealthFact
            label="Errors"
            value={
              <Roll
                value={`${((health.errors / health.requests) * 100).toFixed(1)}%`}
              />
            }
            note={`${health.errors} failed${health.topError ? ` · ${health.topError}` : ""}`}
            action={{
              label: "See errors",
              onClick: () => {
                setLogFilter("errors");
                logRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              },
            }}
          >
            <ErrorMix requests={requests} />
          </HealthFact>
          <HealthFact
            label="Webhooks"
            value={
              <Roll
                value={
                  failing.length
                    ? `${failing.length} failing`
                    : `${deliveredRate}%`
                }
              />
            }
            tone={failing.length ? "bad" : undefined}
            note={
              failing.length
                ? queued
                  ? `${queued.toLocaleString("en-US")} events waiting to retry`
                  : `${host(failing[0].url)} stopped receiving`
                : "delivered on the first or a later try"
            }
            action={
              failing.length
                ? {
                    label: "See endpoint",
                    onClick: () =>
                      endpointsRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      }),
                  }
                : undefined
            }
          >
            <DeliveryMix deliveries={deliveries} />
          </HealthFact>
          <HealthFact
            label="Response time"
            value={<Roll value={`${health.p95} ms`} />}
            note="95% of requests answered faster than this"
          >
            <Budget ms={health.p95} />
          </HealthFact>
        </div>
      </section>

      {/* Go-live: a checklist in sandbox, one quiet line once you're live */}
      {env === "sandbox" ? (
        <section
          aria-label="Ready for live"
          className="mt-6 rounded-xl border border-white/8 px-5 py-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] text-white">Ready for live</div>
              <div className="text-[12px] text-neutral-500">
                {checks.length - left.length} of {checks.length} done
                {left.length
                  ? ` · next: ${left[0].label.toLowerCase()}`
                  : " · you can switch to Live"}
              </div>
            </div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full bg-[var(--flow-in)]"
                style={{
                  width: `${((checks.length - left.length) / checks.length) * 100}%`,
                }}
              />
            </div>
          </div>
          <ol className="mt-4 grid grid-cols-6 gap-3">
            {checks.map((c, i) => (
              <li key={c.id} className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      c.done
                        ? "border-[var(--flow-in)] bg-[var(--flow-in)] text-black"
                        : "border-dashed border-amber-400/70 text-amber-300"
                    }`}
                  >
                    {c.done ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={`truncate text-[12.5px] ${c.done ? "text-neutral-300" : "text-white"}`}
                  >
                    {c.label}
                  </span>
                </div>
                <div className="mt-1 pl-7 text-[11.5px] leading-snug text-neutral-500">
                  {c.hint}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        left.length > 0 && (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-white/[0.04] px-4 py-2.5 text-[13px]">
            <span className="text-neutral-300">
              Live since Mar 4, 2026 ·{" "}
              <span className="text-white">{left.length} check left:</span>{" "}
              {left.map((c) => c.label.toLowerCase()).join(", ")}
            </span>
            <a
              href="https://docs.gravv.xyz/webhooks/signatures"
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-0.5 text-neutral-200 hover:text-white"
            >
              How to
              <ArrowUpRight size={12} strokeWidth={1.75} />
            </a>
          </div>
        )
      )}

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)_360px] gap-8">
        <div className="min-w-0 space-y-10">
          {/* Keys */}
          <section aria-label="API keys">
            <SectionHead
              title="API keys"
              lead="Secrets are shown once, when they're made. Keep them on your servers."
              action={
                <PrimarySmall onClick={() => setCreatingKey(true)}>
                  <Plus size={14} strokeWidth={2} />
                  Create key
                </PrimarySmall>
              }
            />
            <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/8">
              {envKeys.map((k) => {
                const usage = KEY_USAGE[k.id];
                const stale =
                  k.lastUsed &&
                  AS_OF - Date.parse(k.lastUsed) > 30 * 86_400_000;
                const from = usage
                  ? allowedBy(usage.lastIp, allowlist)
                  : undefined;
                const outside =
                  env === "live" &&
                  enforce &&
                  allowlist.length > 0 &&
                  usage &&
                  !from &&
                  !stale;
                return (
                  <li key={k.id} className="flex items-start gap-5 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] text-white">
                          {k.name}
                        </span>
                        <span className="font-mono text-[11.5px] text-neutral-500">
                          {prefix(k.env)}…{k.last4}
                        </span>
                      </div>
                      {k.access === "full" ? (
                        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-neutral-400">
                          <span className="rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[11.5px] font-medium text-amber-300">
                            Full access
                          </span>
                          everything the API can do
                          {k.env === "live" ? ", including moving money" : ""}
                        </div>
                      ) : (
                        <div
                          className="mt-1.5 flex flex-wrap gap-1"
                          title={scopeText(k)}
                        >
                          {k.access.map((id) => {
                            const sc = SCOPES.find((x) => x.id === id)!;
                            return (
                              <span
                                key={id}
                                className={`rounded-md px-1.5 py-0.5 text-[11.5px] ${AREA_TONE[sc.group]}`}
                              >
                                {sc.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
                        <span className="flex items-center gap-1.5">
                          <PersonAvatar name={k.createdBy} size={16} />
                          {k.createdBy === ME
                            ? "You"
                            : k.createdBy.split(" ")[0]}{" "}
                          · {k.createdAt}
                        </span>
                        {k.expiresSoon ? (
                          <span className="text-red-400">
                            Stops working {k.expiresSoon.toLowerCase()}
                          </span>
                        ) : (
                          k.expires && <span>Expires {k.expires}</span>
                        )}
                      </div>
                    </div>
                    <div className="w-[230px] shrink-0 text-right text-[12px]">
                      {stale ? (
                        <>
                          <div className="text-neutral-300">
                            Unused for {lasted(k.lastUsed!)}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setKeys((all) =>
                                all.filter((x) => x.id !== k.id),
                              );
                              setToast(`${k.name} revoked`);
                            }}
                            className="mt-0.5 text-neutral-500 underline-offset-2 hover:text-white hover:underline"
                          >
                            Revoke it?
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="text-neutral-200 tabular-nums">
                            {usage
                              ? `${usage.requests.toLocaleString("en-US")} requests today`
                              : "Not used yet"}
                          </div>
                          {usage && (
                            <div
                              className={`mt-0.5 truncate ${outside ? "text-red-400" : "text-neutral-500"}`}
                            >
                              {ago(k.lastUsed)} from{" "}
                              <span className="font-mono">{usage.lastIp}</span>
                              {from
                                ? ` · ${from.label.split(" (")[0]}`
                                : outside
                                  ? " · not on allowlist"
                                  : ""}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <RowMenu
                      items={[
                        {
                          label: "Roll key",
                          hint: "New secret; old one works 24h",
                          onClick: () => rollKey(k),
                        },
                        {
                          label: "Revoke key",
                          danger: true,
                          onClick: () => {
                            setKeys((all) => all.filter((x) => x.id !== k.id));
                            setToast(
                              `${k.name} revoked — requests using it now fail`,
                            );
                          },
                        },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Endpoints */}
          <section
            aria-label="Webhook endpoints"
            ref={endpointsRef}
            className="scroll-mt-6"
          >
            <SectionHead
              title="Webhook endpoints"
              lead="Kredete posts a signed event to each URL when money moves, and retries for 3 days if it doesn't answer."
              action={
                <PrimarySmall onClick={() => setAddingEndpoint(true)}>
                  <Plus size={14} strokeWidth={2} />
                  Add endpoint
                </PrimarySmall>
              }
            />
            <div className="mt-4 space-y-3">
              {envEndpoints.map((e) => (
                <EndpointCard
                  key={e.id}
                  e={e}
                  health={healthOf(e)}
                  onOpen={() => setEndpointId(e.id)}
                  onRetry={() =>
                    setToast(
                      `Retrying ${e.outage?.queued.toLocaleString("en-US")} events now`,
                    )
                  }
                  onTest={() => setToast(`Test event sent to ${host(e.url)}`)}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <AllowlistCard
            env={env}
            items={allowlist}
            enforce={enforce}
            onEnforce={() => {
              setEnforce(!enforce);
              setToast(
                enforce
                  ? "Allowlist off — live keys work from any address"
                  : "Allowlist on — only these addresses can call the API",
              );
            }}
            onAdd={(ip) => {
              setAllowlist((all) => [...all, ip]);
              setToast(`${ip.cidr} added`);
            }}
            onRemove={(cidr) => {
              setAllowlist((all) => all.filter((x) => x.cidr !== cidr));
              setToast(`${cidr} removed`);
            }}
          />
          <AppsCard
            apps={apps}
            onConnect={(id) => {
              setApps((all) =>
                all.map((a) =>
                  a.id === id
                    ? {
                        ...a,
                        connected: {
                          since: "Today",
                          detail: "Connecting — first sync in a few minutes",
                        },
                      }
                    : a,
                ),
              );
              setToast(`${apps.find((a) => a.id === id)?.name} connected`);
            }}
          />
          <div className="rounded-xl border border-white/8">
            <div className="border-b border-white/8 px-4 py-3 text-[13px] text-white">
              Connection details
            </div>
            <CopyRow label="Base URL" value={ENV[env].base} />
            <CopyRow label="Account ID" value={ENV[env].accountId} />
          </div>
        </aside>
      </div>

      <RequestLog
        refEl={logRef}
        requests={requests}
        keys={keys}
        allowlist={allowlist}
        filter={logFilter}
        onFilter={setLogFilter}
        env={env}
      />

      {creatingKey && (
        <CreateKey
          env={env}
          onClose={() => setCreatingKey(false)}
          onCreate={(name, access, expires) => {
            const secret = `${prefix(env)}${randomSecret(32)}`;
            setKeys((all) => [
              {
                id: `key_${Date.now()}`,
                env,
                name,
                last4: secret.slice(-4),
                access,
                createdBy: ME,
                createdAt: "Today",
                lastUsed: null,
                expires,
              },
              ...all,
            ]);
            setCreatingKey(false);
            setRevealed({ name, secret });
          }}
        />
      )}

      {revealed && (
        <SecretOnce {...revealed} onClose={() => setRevealed(null)} />
      )}

      {addingEndpoint && (
        <AddEndpoint
          env={env}
          onClose={() => setAddingEndpoint(false)}
          onAdd={(url, description, events) => {
            const e: Endpoint = {
              id: `we_${Date.now()}`,
              env,
              url,
              description: description || "No description",
              events,
              enabled: true,
              secretLast4: randomSecret(4),
              createdAt: "Today",
              deliveries: [],
            };
            setEndpoints((all) => [e, ...all]);
            setAddingEndpoint(false);
            setEndpointId(e.id);
            setToast("Endpoint added — send a test event to check it");
          }}
        />
      )}

      {openEndpoint && (
        <EndpointSheet
          e={openEndpoint}
          onClose={() => setEndpointId(null)}
          onChange={(patch) =>
            setEndpoints((all) =>
              all.map((x) =>
                x.id === openEndpoint.id ? { ...x, ...patch } : x,
              ),
            )
          }
          onRemove={() => {
            setEndpoints((all) => all.filter((x) => x.id !== openEndpoint.id));
            setEndpointId(null);
            setToast("Endpoint deleted");
          }}
          toast={setToast}
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

function HealthFact({
  label,
  value,
  note,
  action,
  tone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  action?: { label: string; onClick: () => void };
  tone?: "bad";
  children?: React.ReactNode;
}) {
  // Label, number, note, visual and link each sit on a row shared by all four cells,
  // so they line up across the panel even when a cell has no visual.
  return (
    <div className="row-span-5 grid min-w-0 grid-rows-subgrid px-5 py-4">
      <div className="text-[12px] text-neutral-500">{label}</div>
      <div
        className={`mt-2 text-[26px] leading-none font-medium tracking-[-0.03em] tabular-nums ${
          tone === "bad" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 line-clamp-2 text-[12px] leading-snug text-neutral-500">
        {note}
      </div>
      <div className="self-end">{children}</div>
      <div>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-3 flex items-center gap-0.5 text-[12px] text-neutral-200 hover:text-white"
          >
            {action.label}
            <ArrowUpRight size={12} strokeWidth={1.75} className="rotate-90" />
          </button>
        )}
      </div>
    </div>
  );
}

/** What the errors were, by kind — so the share of each is visible, not just the total. */
function ErrorMix({ requests }: { requests: ApiRequest[] }) {
  const errs = requests.filter((r) => r.status >= 400);
  const kinds = [
    {
      label: "Auth",
      n: errs.filter((r) => r.status === 401 || r.status === 403).length,
      cls: "bg-white/70",
    },
    {
      label: "Invalid",
      n: errs.filter((r) => r.status === 422).length,
      cls: "bg-white/40",
    },
    {
      label: "Rate limit",
      n: errs.filter((r) => r.status === 429).length,
      cls: "bg-white/20",
    },
    {
      label: "Server",
      n: errs.filter((r) => r.status >= 500).length,
      cls: "bg-red-500",
    },
  ].filter((k) => k.n);
  if (!errs.length) return null;
  return (
    <div className="mt-3">
      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full">
        {kinds.map((k) => (
          <span key={k.label} className={k.cls} style={{ flex: k.n }} />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-neutral-500">
        {kinds.map((k) => (
          <span key={k.label} className="flex items-center gap-1">
            <span className={`h-2 w-1 rounded-[1px] ${k.cls}`} />
            {k.label} {Math.round((k.n / errs.length) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Latest deliveries across endpoints, oldest to newest: green delivered, red failed. */
function DeliveryMix({ deliveries }: { deliveries: Delivery[] }) {
  const last = [...deliveries]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-28);
  return (
    <div className="mt-3 flex h-8 items-end gap-[2px]" aria-hidden>
      {last.map((d) => (
        <span
          key={d.id + d.at}
          className={`h-full flex-1 rounded-[1px] ${ok(d) ? "bg-[var(--flow-in)] opacity-35" : "bg-red-500"}`}
        />
      ))}
    </div>
  );
}

/** Where the slowest 5% sit against a 500 ms budget. */
function Budget({ ms }: { ms: number }) {
  const pct = Math.min(100, (ms / 500) * 100);
  return (
    <div className="mt-3">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--flow-in)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500 tabular-nums">
        <span>0</span>
        <span>500 ms budget</span>
      </div>
    </div>
  );
}

/** An endpoint at a glance: where, what it's for, and its last 30 deliveries as a strip. */
function EndpointCard({
  e,
  health,
  onOpen,
  onRetry,
  onTest,
}: {
  e: Endpoint;
  health: "healthy" | "failing" | "off";
  onOpen: () => void;
  onRetry: () => void;
  onTest: () => void;
}) {
  const strip = e.deliveries.slice(0, 30).reverse();
  const recent = e.deliveries.slice(0, 20);
  const rate = recent.length
    ? Math.round((recent.filter(ok).length / recent.length) * 1000) / 10
    : null;
  return (
    <div
      className={`rounded-xl border ${health === "failing" ? "border-red-500/30" : "border-white/8"}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-5 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[13px] text-white">
            {e.url}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] text-neutral-400">
            {e.description} · listening for {e.events.length}{" "}
            {e.events.length === 1 ? "event" : "events"}
          </div>
        </div>
        <div className="w-[180px] shrink-0 text-right text-[12px]">
          {health === "off" ? (
            <span className="text-neutral-500">Turned off</span>
          ) : health === "failing" ? (
            <>
              <div className="text-red-400">
                {e.outage
                  ? `${e.outage.error} for ${lasted(e.outage.since)}`
                  : e.autoDisabled
                    ? "Turned off by Kredete"
                    : "Failing often"}
              </div>
              <div className="mt-0.5 text-neutral-500">
                {e.outage
                  ? `${e.outage.queued.toLocaleString("en-US")} events waiting`
                  : "After 3 days of failures"}
              </div>
            </>
          ) : (
            <>
              <div className="text-neutral-200 tabular-nums">
                {rate === null ? "Nothing sent yet" : `${rate}% delivered`}
              </div>
              <div className="mt-0.5 text-neutral-500">
                Last sent {ago(e.deliveries[0]?.at ?? null)}
              </div>
            </>
          )}
        </div>
      </button>
      {strip.length > 0 && (
        <div className="flex items-center gap-3 px-5 pb-4">
          <div
            className="flex h-5 flex-1 items-end gap-[3px]"
            aria-label={`Last ${strip.length} deliveries`}
          >
            {strip.map((d) => (
              <span
                key={d.id}
                title={`${d.event} · ${d.status === "timeout" ? "Timeout" : d.status}`}
                className={`h-full w-[5px] shrink-0 rounded-[1.5px] ${ok(d) ? "bg-[var(--flow-in)] opacity-60" : "bg-red-500"}`}
              />
            ))}
          </div>
          <span className="shrink-0 text-[11px] text-neutral-500">
            Last {strip.length}, oldest first
          </span>
        </div>
      )}
      {health === "failing" && e.outage && (
        <div className="flex items-center justify-between gap-4 border-t border-red-500/15 px-5 py-3 text-[12.5px]">
          <span className="text-neutral-400">
            Next retry in {e.outage.nextRetryMins} min. A 404 usually means the
            URL changed.
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onTest}
              className="h-8 rounded-full px-3 text-neutral-300 hover:bg-white/[0.06] hover:text-white"
            >
              Send test
            </button>
            <button
              type="button"
              onClick={onOpen}
              className="h-8 rounded-full border border-white/12 px-3 text-neutral-200 hover:border-white/30 hover:text-white"
            >
              Fix URL
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 font-medium text-black hover:bg-neutral-200"
            >
              <RotateCw size={12} strokeWidth={2} />
              Retry all
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

const CIDR =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/(3[0-2]|[12]?\d))?$/;

/** Where this browser is signing in from (placeholder for the prototype). */
const CURRENT_IP = "102.89.41.203";

function AllowlistCard({
  env,
  items,
  enforce,
  onEnforce,
  onAdd,
  onRemove,
}: {
  env: Env;
  items: AllowedIp[];
  enforce: boolean;
  onEnforce: () => void;
  onAdd: (ip: AllowedIp) => void;
  onRemove: (cidr: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const valid =
    CIDR.test(cidr.trim()) && !items.some((i) => i.cidr === cidr.trim());
  const empty = items.length === 0;
  // Enforcing an empty list would refuse every live request, so it's off until there's an address.
  const on = enforce && !empty;
  return (
    <div className="rounded-xl border border-white/8">
      <div className="flex items-center justify-between gap-4 border-b border-white/8 px-4 py-3">
        <div>
          <div className="text-[13px] text-white">IP allowlist</div>
          <div className="text-[12px] text-neutral-500">
            {env === "sandbox"
              ? "Sandbox accepts any address"
              : empty
                ? "Not set up — live keys work from anywhere"
                : on
                  ? "Live keys only work from these"
                  : "Off — live keys work anywhere"}
          </div>
        </div>
        {env === "live" && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Enforce allowlist"
            disabled={empty}
            title={empty ? "Add an address first" : undefined}
            onClick={onEnforce}
            style={{ width: 32, height: 18 }}
            className={`shrink-0 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-white" : "bg-white/15"}`}
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
        )}
      </div>
      {env === "live" && (
        <>
          {empty && !adding && (
            <div className="px-4 py-4">
              <p className="text-[12.5px] leading-relaxed text-neutral-400">
                List the servers that call the API. Once it&apos;s on, a leaked
                live key can&apos;t be used from anywhere else.
              </p>
              <button
                type="button"
                onClick={() =>
                  onAdd({
                    cidr: CURRENT_IP,
                    label: "Where you're signed in now",
                    addedBy: ME,
                    addedAt: "Today",
                  })
                }
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2.5 text-left transition-colors hover:border-white/25"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] text-neutral-100">
                    Add your current address
                  </span>
                  <span className="block font-mono text-[11.5px] text-neutral-500">
                    {CURRENT_IP}
                  </span>
                </span>
                <Plus
                  size={14}
                  strokeWidth={1.75}
                  className="shrink-0 text-neutral-400"
                />
              </button>
            </div>
          )}
          <ul className="divide-y divide-white/[0.06]">
            {items.map((i) => (
              <li
                key={i.cidr}
                className="group flex items-center gap-3 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12.5px] text-neutral-100">
                    {i.cidr}
                  </div>
                  <div className="truncate text-[11.5px] text-neutral-500">
                    {i.label}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${i.cidr}`}
                  onClick={() => onRemove(i.cidr)}
                  className="flex size-7 items-center justify-center rounded-full text-neutral-500 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/[0.06] hover:text-white focus-visible:opacity-100"
                >
                  <X size={13} strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/8 px-4 py-3">
            {adding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!valid) return;
                  onAdd({
                    cidr: cidr.trim(),
                    label: label.trim() || "No label",
                    addedBy: ME,
                    addedAt: "Today",
                  });
                  setCidr("");
                  setLabel("");
                  setAdding(false);
                }}
                className="space-y-2"
              >
                <input
                  autoFocus
                  value={cidr}
                  onChange={(e) => setCidr(e.target.value)}
                  placeholder="203.0.113.0/24"
                  aria-label="IP address or range"
                  className="h-9 w-full rounded-lg border border-white/12 bg-transparent px-3 font-mono text-[12.5px] text-white outline-none placeholder:text-neutral-600 focus:border-white/35"
                />
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="What it is, e.g. Payouts worker"
                  aria-label="Label"
                  className="h-9 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-600 focus:border-white/35"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] text-red-400">
                    {cidr.trim() && !CIDR.test(cidr.trim())
                      ? "Use an IPv4 address or range"
                      : ""}
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="h-8 rounded-full px-3 text-[12.5px] text-neutral-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!valid}
                      className="h-8 rounded-full bg-white px-3.5 text-[12.5px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
                    >
                      Add
                    </button>
                  </span>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-[12.5px] text-neutral-300 hover:text-white"
              >
                <Plus size={13} strokeWidth={1.75} />
                Add an address
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** The company's own logo, from its site; the brand-colour letter tile if it can't load. */
function AppLogo({ app }: { app: App }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold"
        style={{ background: APP_COLOR[app.id] ?? "#555", color: "#fff" }}
      >
        {app.name[0]}
      </span>
    );
  // The logo is the tile: it fills the whole rounded square, no frame around it.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote brand logos
    <img
      src={`https://www.google.com/s2/favicons?domain=${app.domain}&sz=128`}
      alt={`${app.name} logo`}
      width={32}
      height={32}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-8 shrink-0 rounded-lg object-cover"
    />
  );
}

/** Mercury-style: the apps that already read and write your money, and the ones you could connect. */
function AppsCard({
  apps,
  onConnect,
}: {
  apps: App[];
  onConnect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/8">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="text-[13px] text-white">Connected apps</div>
        <div className="text-[12px] text-neutral-500">
          No code needed — sign in and choose what syncs
        </div>
      </div>
      <ul className="divide-y divide-white/[0.06]">
        {apps.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-4 py-3">
            <AppLogo app={a} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] text-neutral-100">{a.name}</div>
              <div className="truncate text-[11.5px] text-neutral-500">
                {a.connected ? a.connected.detail : a.what}
              </div>
            </div>
            {a.connected ? (
              <span className="shrink-0 text-[12px] text-neutral-400">
                Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onConnect(a.id)}
                className="h-7 shrink-0 rounded-full border border-white/12 px-2.5 text-[12px] text-neutral-200 hover:border-white/30 hover:text-white"
              >
                Connect
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5 last:border-0">
      <span className="shrink-0 text-[12px] text-neutral-500">{label}</span>
      <span className="flex min-w-0 items-center gap-0.5">
        <span className="truncate font-mono text-[12px] text-neutral-200">
          {value}
        </span>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </span>
    </div>
  );
}

/** Every call your systems made, newest first. Errors open to say why, in plain words. */
const PREVIEW = 8;
const PER_PAGE = 20;

/**
 * The request log. On Configure it's a short preview that links to the full log;
 * on its own page (`full`) it adds search, a key filter and pages, so neither page grows forever.
 */
export function RequestLog({
  refEl,
  requests,
  keys,
  allowlist,
  filter,
  onFilter,
  full = false,
  env,
}: {
  refEl?: React.RefObject<HTMLElement | null>;
  requests: ApiRequest[];
  keys: ApiKey[];
  allowlist: AllowedIp[];
  filter: "all" | "errors";
  onFilter: (f: "all" | "errors") => void;
  full?: boolean;
  env?: Env;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [keyFilter, setKeyFilter] = useState("all");
  const q = query.trim().toLowerCase();
  const rows = requests.filter(
    (r) =>
      (filter === "all" || r.status >= 400) &&
      (!full || keyFilter === "all" || r.keyId === keyFilter) &&
      (!full ||
        !q ||
        `${r.method} ${r.path} ${r.ip} ${r.status} ${r.id}`
          .toLowerCase()
          .includes(q)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const current = Math.min(page, pages);
  const visible = full
    ? rows.slice((current - 1) * PER_PAGE, current * PER_PAGE)
    : rows.slice(0, PREVIEW);
  const usedKeys = [...new Set(requests.map((r) => r.keyId))];
  const keyName = (id: string) =>
    id === "revoked"
      ? "Revoked key"
      : (keys.find((k) => k.id === id)?.name ?? "Deleted key");
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return (
    <section
      ref={refEl}
      aria-label="Recent API requests"
      className={full ? "mt-8" : "mt-12 scroll-mt-6"}
    >
      <div className="flex items-end justify-between gap-4">
        {full ? (
          <div />
        ) : (
          <div>
            <h2 className="text-[15px] text-white">Recent API requests</h2>
            <p className="mt-1 text-[13px] text-neutral-500">
              What your systems asked Kredete to do, and what it answered.
            </p>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {full && (
            <>
              <label className="flex h-8 w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35">
                <Search
                  size={13}
                  strokeWidth={1.75}
                  className="text-neutral-500"
                />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
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
                  ...usedKeys.map((id) => ({ value: id, label: keyName(id) })),
                ]}
                onChange={(v) => {
                  setKeyFilter(v);
                  setPage(1);
                }}
              />
            </>
          )}
          {(["all", "errors"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                onFilter(f);
                setPage(1);
              }}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] capitalize transition-colors ${
                filter === f
                  ? "bg-white/[0.08] font-medium text-white"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-200"
              }`}
            >
              {f}
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {f === "all"
                  ? requests.length
                  : requests.filter((r) => r.status >= 400).length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/8">
        {visible.map((r) => {
          const err = r.status >= 400;
          const allowed = allowedBy(r.ip, allowlist);
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-expanded={open === r.id}
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full items-center gap-4 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span
                  className={`inline-flex h-6 w-[46px] shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${statusTone(r.status)}`}
                >
                  {r.status}
                </span>
                <span
                  className={`w-[52px] shrink-0 font-mono text-[11.5px] font-medium ${METHOD_TONE[r.method]}`}
                >
                  {r.method}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-neutral-100">
                  {r.path}
                </span>
                <span
                  className={`w-[170px] shrink-0 truncate text-[12px] ${r.keyId === "revoked" ? "text-amber-300" : "text-neutral-400"}`}
                >
                  {keyName(r.keyId)}
                </span>
                <span className="w-[110px] shrink-0 truncate font-mono text-[11.5px] text-neutral-500">
                  {r.ip}
                </span>
                <span className="w-[56px] shrink-0 text-right text-[12px] text-neutral-500 tabular-nums">
                  {r.ms} ms
                </span>
                <span className="w-[64px] shrink-0 text-right text-[12px] text-neutral-500 tabular-nums">
                  {time.format(new Date(r.at))}
                </span>
              </button>
              {open === r.id && (
                <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-4">
                  {r.why && (
                    <p className="mb-3 text-[13px] leading-relaxed text-neutral-200">
                      {r.why}
                    </p>
                  )}
                  <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      Request{" "}
                      <span className="font-mono text-neutral-300">{r.id}</span>
                      <CopyButton value={r.id} label="Copy request ID" />
                    </span>
                    <span>
                      From{" "}
                      <span className="font-mono text-neutral-300">{r.ip}</span>
                      {allowed
                        ? ` · ${allowed.label}`
                        : " · not on your allowlist"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                      {`${r.method} ${r.path}\nAuthorization: Bearer ${r.keyId === "revoked" ? "gk_live_…19ce" : `${prefix(r.env)}…${keys.find((k) => k.id === r.keyId)?.last4 ?? "????"}`}\nIdempotency-Key: ${r.id.slice(4, 12)}`}
                    </pre>
                    <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                      {JSON.stringify(
                        err
                          ? {
                              error: {
                                status: r.status,
                                code:
                                  r.status === 401
                                    ? "key_revoked"
                                    : r.status === 429
                                      ? "rate_limited"
                                      : "amount_too_small",
                                message: r.why,
                              },
                            }
                          : {
                              id: `${r.path.split("/")[2]?.slice(0, 3) ?? "obj"}_${r.id.slice(4, 10)}`,
                              status: r.method === "POST" ? "created" : "ok",
                            },
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-white/10 py-12 text-center text-[13px] text-neutral-500">
          No requests match.
        </p>
      )}
      {full ? (
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
      ) : (
        rows.length > PREVIEW && (
          <Link
            href={`/manage/configure/requests${env === "sandbox" ? "?env=sandbox" : ""}`}
            className="mt-3 flex items-center justify-center gap-1 rounded-xl border border-white/8 py-2.5 text-[13px] text-neutral-300 transition-colors hover:border-white/20 hover:text-white"
          >
            View all {rows.length} {filter === "errors" ? "errors" : "requests"}
            <ArrowUpRight size={13} strokeWidth={1.75} />
          </Link>
        )
      )}
    </section>
  );
}

const MIN_MS = 60_000;

function SectionHead({
  title,
  lead,
  action,
}: {
  title: string;
  lead: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div>
        <h2 className="text-[15px] text-white">{title}</h2>
        <p className="mt-1 max-w-[620px] text-[13px] text-neutral-500">
          {lead}
        </p>
      </div>
      {action}
    </div>
  );
}

function PrimarySmall({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
    >
      {children}
    </button>
  );
}

function RowMenu({
  items,
}: {
  items: {
    label: string;
    hint?: string;
    danger?: boolean;
    onClick: () => void;
  }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <EllipsisVertical size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-[240px] rounded-xl border border-white/10 bg-surface p-1 text-left shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]"
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
              className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-white/[0.06] ${it.danger ? "text-red-400" : "text-neutral-200"}`}
            >
              {it.label}
              {it.hint && (
                <span className="block text-[11px] text-neutral-500">
                  {it.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dialog({
  title,
  onClose,
  children,
  width = 460,
  over,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  /** Laid over the whole dialog, e.g. the discard check. */
  over?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        aria-hidden
        onClick={onClose}
        className="scrim-in absolute inset-0 bg-black/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className="orbit-pop sidebar-scroll relative max-h-[86vh] max-w-full overflow-y-auto rounded-2xl border border-white/10 bg-surface p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.5)]"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[17px] font-medium text-white">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
      {over}
    </div>
  );
}

const input =
  "h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35";

function CreateKey({
  env,
  onClose,
  onCreate,
}: {
  env: Env;
  onClose: () => void;
  onCreate: (
    name: string,
    access: ApiKey["access"],
    expires: string | null,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"full" | "restricted">("restricted");
  const [scopes, setScopes] = useState<ScopeId[]>([
    "balances.read",
    "transactions.read",
  ]);
  const [expiry, setExpiry] = useState<"never" | "90" | "365">("365");
  const expires = () => {
    if (expiry === "never") return null;
    const d = new Date(AS_OF + Number(expiry) * 24 * 60 * MIN_MS);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  const valid = name.trim() && (kind === "full" || scopes.length > 0);
  const guard = useDiscardGuard(onClose);
  return (
    <Dialog
      title={`Create ${ENV[env].label.toLowerCase()} key`}
      onClose={guard.requestClose}
      width={500}
      over={
        guard.asking && (
          <DiscardConfirm
            title="Discard this key?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
          />
        )
      }
    >
      <form
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          guard.clear();
          onCreate(name.trim(), kind === "full" ? "full" : scopes, expires());
        }}
        className="mt-5 space-y-5"
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-neutral-200">
            Name
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Payouts service"
            className={input}
          />
          <span className="mt-1.5 block text-[12px] text-neutral-500">
            So your team knows which system uses it.
          </span>
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] text-neutral-200">
            Access
          </span>
          <div className="inline-flex rounded-full bg-white/[0.07] p-0.5">
            {(
              [
                ["restricted", "Only what it needs"],
                ["full", "Full access"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={kind === v}
                onClick={() => setKind(v)}
                className={`h-8 rounded-full px-3.5 text-[12px] transition-colors ${kind === v ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" : "text-neutral-500 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
          {kind === "full" ? (
            <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
              Can do anything the API allows
              {env === "live" ? ", including sending money" : ""}. Use a
              restricted key unless a system really needs everything.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-white/[0.06] rounded-lg border border-white/8">
              {SCOPES.map((s) => {
                const on = scopes.includes(s.id);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setScopes(
                          on
                            ? scopes.filter((x) => x !== s.id)
                            : [...scopes, s.id],
                        )
                      }
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] hover:bg-white/[0.025]"
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded-[4px] border ${on ? "border-white bg-white text-black" : "border-white/25"}`}
                      >
                        {on && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span
                        className={`flex-1 ${on ? "text-neutral-100" : "text-neutral-400"}`}
                      >
                        {s.label}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {s.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <span className="mb-1.5 block text-[13px] text-neutral-200">
            Expires
          </span>
          <div className="inline-flex rounded-full bg-white/[0.07] p-0.5">
            {(
              [
                ["90", "In 90 days"],
                ["365", "In a year"],
                ["never", "Never"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={expiry === v}
                onClick={() => setExpiry(v)}
                className={`h-8 rounded-full px-3.5 text-[12px] transition-colors ${expiry === v ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]" : "text-neutral-500 hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={guard.requestClose}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
          >
            Create key
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** The one time a secret is visible. Closing needs a deliberate "I've saved it". */
function SecretOnce({
  name,
  secret,
  rolled,
  onClose,
}: {
  name: string;
  secret: string;
  rolled?: boolean;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      title={rolled ? `New secret for ${name}` : `${name} is ready`}
      onClose={() => copied && onClose()}
      width={520}
    >
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
        Copy it now and store it somewhere safe — like your secrets manager. You
        won&apos;t be able to see it again.
        {rolled &&
          " The old secret keeps working for 24 hours, so you can swap it without downtime."}
      </p>
      <div className="mt-5 flex items-center gap-2 rounded-lg border border-white/12 bg-white/[0.03] py-1.5 pr-1.5 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-white">
          {shown ? secret : `${secret.slice(0, 8)}${"•".repeat(24)}`}
        </span>
        <button
          type="button"
          aria-label={shown ? "Hide" : "Show"}
          onClick={() => setShown(!shown)}
          className="flex size-8 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-white"
        >
          {shown ? (
            <EyeOff size={14} strokeWidth={1.75} />
          ) : (
            <Eye size={14} strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(secret).catch(() => {});
            setCopied(true);
          }}
          className="flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[12px] font-medium text-black hover:bg-neutral-200"
        >
          {copied ? <Check size={13} strokeWidth={2.5} /> : null}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="text-[12px] text-neutral-500">
          {copied
            ? "Saved it? You can close this now."
            : "Copy the key to continue."}
        </span>
        <button
          type="button"
          disabled={!copied}
          onClick={onClose}
          className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
        >
          I&apos;ve saved it
        </button>
      </div>
    </Dialog>
  );
}

function EventPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-3">
      {EVENT_GROUPS.map((g) => {
        const all = g.events.every((e) => value.includes(e));
        return (
          <div key={g.label}>
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="text-neutral-400">{g.label}</span>
              <button
                type="button"
                onClick={() =>
                  onChange(
                    all
                      ? value.filter((e) => !g.events.includes(e))
                      : [...new Set([...value, ...g.events])],
                  )
                }
                className="text-neutral-500 hover:text-white"
              >
                {all ? "Clear" : "All"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.events.map((e) => {
                const on = value.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      onChange(
                        on ? value.filter((x) => x !== e) : [...value, e],
                      )
                    }
                    className={`h-7 rounded-md border px-2.5 font-mono text-[11.5px] transition-colors ${
                      on
                        ? "border-white/40 bg-white/[0.08] text-white"
                        : "border-white/10 text-neutral-500 hover:text-white"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddEndpoint({
  env,
  onClose,
  onAdd,
}: {
  env: Env;
  onClose: () => void;
  onAdd: (url: string, description: string, events: string[]) => void;
}) {
  const [url, setUrl] = useState("https://");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState<string[]>([
    "transaction.completed",
    "payout.failed",
  ]);
  const https = /^https:\/\/[^\s/]+\.[^\s]+/.test(url);
  const valid = https && events.length > 0;
  const guard = useDiscardGuard(onClose);
  return (
    <Dialog
      title={`Add ${ENV[env].label.toLowerCase()} endpoint`}
      onClose={guard.requestClose}
      width={560}
      over={
        guard.asking && (
          <DiscardConfirm
            title="Discard this endpoint?"
            onKeep={guard.keep}
            onDiscard={guard.discard}
          />
        )
      }
    >
      <form
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          guard.clear();
          onAdd(url.trim(), description.trim(), events);
        }}
        className="mt-5 space-y-5"
      >
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-neutral-200">URL</span>
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${input} font-mono text-[12.5px]`}
          />
          {url.length > 8 && !https && (
            <span className="mt-1.5 block text-[12px] text-red-400">
              Use a full https:// address.
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-neutral-200">
            Description <span className="text-neutral-500">(Optional)</span>
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's listening, e.g. ledger sync"
            className={input}
          />
        </label>
        <div>
          <span className="mb-2 flex items-baseline justify-between text-[13px] text-neutral-200">
            Events to send
            <span className="text-[12px] text-neutral-500 tabular-nums">
              {events.length} selected
            </span>
          </span>
          <EventPicker value={events} onChange={setEvents} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={guard.requestClose}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
          >
            Add endpoint
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function StatusCode({ d }: { d: Delivery }) {
  return (
    <span
      className={`inline-flex h-6 w-[68px] items-center justify-center rounded-full font-mono text-[11px] ${
        ok(d)
          ? "bg-[var(--ok-bg)] text-[var(--ok-fg)]"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {d.status === "timeout" ? "Timeout" : d.status}
    </span>
  );
}

/** One endpoint: its secret, what it listens to, and every recent delivery with the payload. */
function EndpointSheet({
  e,
  onClose,
  onChange,
  onRemove,
  toast,
}: {
  e: Endpoint;
  onClose: () => void;
  onChange: (p: Partial<Endpoint>) => void;
  onRemove: () => void;
  toast: (t: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "failed">("all");
  const [open, setOpen] = useState<string | null>(e.deliveries[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState(e.events);
  const [secretShown, setSecretShown] = useState(false);
  useEffect(() => {
    const onKey = (k: KeyboardEvent) => k.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const list = e.deliveries.filter((d) => filter === "all" || !ok(d));
  const secret = `whsec_${"x".repeat(20)}${e.secretLast4}`;

  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Webhook endpoint"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[560px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="border-b border-white/8 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[12px] text-neutral-500">
                {e.description}
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-1">
                <span className="truncate font-mono text-[13px] text-white">
                  {e.url}
                </span>
                <CopyButton value={e.url} label="Copy URL" />
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X size={15} strokeWidth={1.75} />
            </button>
          </div>
          {e.autoDisabled && (
            <div className="mt-4 rounded-lg bg-red-500/[0.07] px-4 py-3 text-[12px] leading-relaxed text-red-300">
              Kredete turned this endpoint off after every attempt failed for 3
              days. Events since then weren&apos;t sent. Fix the URL, then turn
              it back on.
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onChange({ enabled: !e.enabled, autoDisabled: false });
                toast(
                  e.enabled
                    ? "Endpoint turned off"
                    : "Endpoint on — new events will be sent",
                );
              }}
              className="h-8 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              {e.enabled ? "Turn off" : "Turn on"}
            </button>
            <button
              type="button"
              onClick={() =>
                toast(`Test event sent to ${new URL(e.url).hostname}`)
              }
              className="h-8 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
            >
              Send test event
            </button>
            <button
              type="button"
              aria-label="Delete endpoint"
              onClick={onRemove}
              className="ml-auto flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-red-400"
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="space-y-7 px-6 py-5">
          <section>
            <h3 className="mb-1.5 text-xs text-neutral-500">Signing secret</h3>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 py-1.5 pr-1.5 pl-3">
              <span className="truncate font-mono text-[12px] text-neutral-200">
                {secretShown
                  ? secret
                  : `whsec_${"•".repeat(16)}${e.secretLast4}`}
              </span>
              <span className="flex items-center">
                <button
                  type="button"
                  aria-label={secretShown ? "Hide" : "Reveal"}
                  onClick={() => setSecretShown(!secretShown)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                >
                  {secretShown ? (
                    <EyeOff size={13} strokeWidth={1.75} />
                  ) : (
                    <Eye size={13} strokeWidth={1.75} />
                  )}
                </button>
                <CopyButton value={secret} label="Copy signing secret" />
                <button
                  type="button"
                  aria-label="Roll secret"
                  title="Roll secret"
                  onClick={() => {
                    onChange({
                      secretLast4: Math.random().toString(36).slice(-4),
                    });
                    toast(
                      "New signing secret — the old one works for 24 hours",
                    );
                  }}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-white"
                >
                  <RotateCw size={13} strokeWidth={1.75} />
                </button>
              </span>
            </div>
            <p className="mt-1.5 text-[12px] text-neutral-500">
              Check it on every request to know the event really came from
              Kredete.
            </p>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs text-neutral-500">
                Listening for {e.events.length} events
              </h3>
              {editing ? (
                <span className="flex gap-3 text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setEvents(e.events);
                      setEditing(false);
                    }}
                    className="text-neutral-500 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!events.length}
                    onClick={() => {
                      onChange({ events });
                      setEditing(false);
                      toast("Events updated");
                    }}
                    className="text-neutral-100 hover:text-white disabled:text-neutral-600"
                  >
                    Save
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-[12px] text-neutral-400 hover:text-white"
                >
                  Edit
                </button>
              )}
            </div>
            {editing ? (
              <EventPicker value={events} onChange={setEvents} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {e.events.map((ev) => (
                  <span
                    key={ev}
                    className="h-6 rounded-md bg-white/[0.06] px-2 font-mono text-[11px] leading-6 text-neutral-300"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs text-neutral-500">Recent deliveries</h3>
              <div className="flex items-center gap-1">
                {(["all", "failed"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`h-7 rounded-full px-2.5 text-[12px] capitalize transition-colors ${filter === f ? "bg-white/[0.08] text-white" : "text-neutral-500 hover:text-neutral-200"}`}
                  >
                    {f}{" "}
                    {f === "failed" && (
                      <span className="tabular-nums">
                        {e.deliveries.filter((d) => !ok(d)).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            {list.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-center text-[12px] text-neutral-500">
                {e.deliveries.length
                  ? "No failed deliveries."
                  : "Nothing sent yet. Send a test event to check the endpoint."}
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.06] rounded-lg border border-white/8">
                {list.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-expanded={open === d.id}
                      onClick={() => setOpen(open === d.id ? null : d.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.02]"
                    >
                      <StatusCode d={d} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-neutral-200">
                        {d.event}
                      </span>
                      <span className="text-[12px] text-neutral-500">
                        {ago(d.at)}
                      </span>
                    </button>
                    {open === d.id && (
                      <div className="border-t border-white/[0.06] bg-white/[0.015] px-3.5 py-3">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-500">
                          <span>
                            Event{" "}
                            <span className="font-mono text-neutral-300">
                              {d.id}
                            </span>
                          </span>
                          <span>
                            {d.attempts}{" "}
                            {d.attempts === 1 ? "attempt" : "attempts"}
                          </span>
                          <span>
                            {d.status === "timeout"
                              ? "No response in 10s"
                              : `${d.ms} ms`}
                          </span>
                          {!ok(d) && (
                            <button
                              type="button"
                              onClick={() => toast(`${d.event} sent again`)}
                              className="ml-auto text-neutral-200 hover:text-white"
                            >
                              Resend
                            </button>
                          )}
                        </div>
                        <pre className="mt-2.5 overflow-x-auto rounded-md bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-neutral-300">
                          {JSON.stringify(
                            {
                              id: d.id,
                              type: d.event,
                              created: d.at,
                              data: {
                                object: d.event.split(".")[0],
                                amount: 72500,
                                currency: "USD",
                              },
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
