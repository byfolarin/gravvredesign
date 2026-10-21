"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { Dropdown } from "@/app/_components/dropdown";
import { AvatarStack } from "@/app/_components/person-avatar";
import {
  ALL_ABILITIES,
  GROUPS,
  MEMBERS,
  ROLES,
  reachOf,
  type Area,
  type Role,
} from "../_data";

type Access = "none" | "view" | "full" | "custom";

/** How much of an area a set of grants covers, in the four words people scan for. */
function accessOf(
  area: Area,
  grants: Set<string>,
): { kind: Access; n: number } {
  const on = area.abilities.filter((a) => grants.has(a.id));
  const views = area.abilities.filter((a) => a.view);
  if (on.length === 0) return { kind: "none", n: 0 };
  if (on.length === area.abilities.length)
    return { kind: "full", n: on.length };
  if (on.every((a) => a.view) && views.every((a) => grants.has(a.id)))
    return { kind: "view", n: on.length };
  return { kind: "custom", n: on.length };
}

const ACCESS_LABEL: Record<Access, string> = {
  none: "No access",
  view: "View only",
  full: "Full access",
  custom: "Custom",
};

const usd = (v: number) => `$${v.toLocaleString("en-US")}`;

export function RolesWorkspace() {
  const [roles, setRoles] = useState<Role[]>(ROLES);
  const [selectedId, setSelectedId] = useState("finance");
  // Edits stay in a draft until saved, so one Discard undoes them all.
  const [draft, setDraft] = useState<Role | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Bumped on select and discard so typed fields (limits) reset to the saved values.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const saved = roles.find((r) => r.id === selectedId) ?? roles[0];
  const role = draft ?? saved;
  const grants = useMemo(() => new Set(role.grants), [role.grants]);
  const editable = !role.system;
  const members = MEMBERS.filter((m) => m.role === role.id);
  const dirty =
    !!draft &&
    (draft.grants.length !== saved.grants.length ||
      draft.grants.some((g) => !saved.grants.includes(g)) ||
      JSON.stringify(draft.limits) !== JSON.stringify(saved.limits));

  const select = (id: string) => {
    setSelectedId(id);
    setDraft(null);
    setVersion((v) => v + 1);
    setOpen(null);
    setQuery("");
  };
  const edit = (patch: Partial<Role>) => setDraft({ ...role, ...patch });
  const setGrant = (id: string, on: boolean) =>
    edit({
      grants: on
        ? [...new Set([...role.grants, id])]
        : role.grants.filter((g) => g !== id),
    });
  const setArea = (area: Area, kind: Exclude<Access, "custom">) => {
    const ids = area.abilities.map((a) => a.id);
    const keep = role.grants.filter((g) => !ids.includes(g));
    const add =
      kind === "full"
        ? ids
        : kind === "view"
          ? area.abilities.filter((a) => a.view).map((a) => a.id)
          : [];
    edit({ grants: [...keep, ...add] });
  };
  const save = () => {
    if (!draft) return;
    setRoles((all) => all.map((r) => (r.id === draft.id ? draft : r)));
    setDraft(null);
    setToast(
      `${draft.name} updated${members.length ? ` for ${members.length} ${members.length === 1 ? "person" : "people"}` : ""}`,
    );
  };
  const duplicate = (
    from: Role,
    name = `${from.name} (copy)`,
    description = from.description,
  ) => {
    const id = `role_${Date.now().toString(36)}`;
    const copy: Role = {
      ...from,
      id,
      name,
      description,
      tagline: from.grants.length ? `Based on ${from.name}` : "Custom",
      system: false,
      owner: false,
      grants: from.owner
        ? from.grants.filter((g) => g !== "billing.manage")
        : [...from.grants],
      limits: { ...from.limits },
    };
    setRoles((all) => [...all, copy]);
    select(id);
    setToast(`${name} created — change what it can do below`);
  };
  const remove = () => {
    setRoles((all) => all.filter((r) => r.id !== role.id));
    setToast(`${role.name} deleted`);
    select("finance");
  };

  // Search narrows to matching abilities and opens their areas.
  const needle = query.trim().toLowerCase();
  const match = (area: Area) =>
    !needle ||
    area.label.toLowerCase().includes(needle) ||
    area.abilities.some(
      (a) =>
        a.label.toLowerCase().includes(needle) ||
        a.hint?.toLowerCase().includes(needle),
    );

  // One-line summary of the role's reach, across every area.
  const areas = GROUPS.flatMap((g) => g.areas);
  const { manages, views } = reachOf(role);
  const sendCap = grants.has("send.saved")
    ? role.limits["send.saved"]
    : undefined;

  const defaults = roles.filter((r) => r.system);
  const custom = roles.filter((r) => !r.system);

  return (
    <div className="mx-auto max-w-[1180px] px-8 pt-12 pb-28">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            Roles & permissions
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Decide what each person on your team can see and do. A change to a
            role applies to everyone who has it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white pr-4 pl-3 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
        >
          <Plus size={15} strokeWidth={2} />
          Create role
        </button>
      </div>

      <div className="mt-10 grid grid-cols-[280px_minmax(0,1fr)] gap-10">
        {/* Roles */}
        <nav aria-label="Roles" className="sticky top-6 h-fit">
          <RoleList
            title="Default roles"
            roles={defaults}
            selectedId={selectedId}
            onSelect={select}
          />
          <div className="mt-6">
            <RoleList
              title="Custom roles"
              roles={custom}
              selectedId={selectedId}
              onSelect={select}
            />
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-neutral-500 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <Plus size={14} strokeWidth={1.75} />
              Create role
            </button>
          </div>
        </nav>

        {/* The selected role */}
        <section aria-label={role.name} className="min-w-0">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                {role.name}
              </h2>
              <p className="mt-1.5 max-w-[560px] text-[13px] leading-relaxed text-neutral-400">
                {role.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => duplicate(role)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/12 px-3 text-[13px] text-neutral-200 transition-colors hover:border-white/30 hover:text-white"
              >
                <Copy size={13} strokeWidth={1.75} />
                Duplicate
              </button>
              {editable && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={members.length > 0}
                  title={
                    members.length > 0
                      ? `Move the ${members.length} ${members.length === 1 ? "person" : "people"} with this role first`
                      : "Delete role"
                  }
                  aria-label="Delete role"
                  className="flex size-8 items-center justify-center rounded-full border border-white/12 text-neutral-400 transition-colors enabled:hover:border-white/30 enabled:hover:text-white disabled:opacity-40"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>

          {/* Who has it, and what it adds up to */}
          <div className="mt-6 grid grid-cols-2 divide-x divide-white/8 rounded-xl border border-white/8">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[12px] text-neutral-500">
                  People with this role
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {members.length ? (
                    <>
                      <AvatarStack
                        names={members.map((p) => p.name)}
                        size={30}
                      />
                      <span className="truncate text-[13px] text-neutral-200">
                        {members.length <= 2
                          ? members.map((p) => p.name).join(" and ")
                          : `${members[0].name.split(" ")[0]}, ${members[1].name.split(" ")[0]} and ${members.length - 2} more`}
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] text-neutral-500">
                      Nobody yet
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/manage/team"
                className="flex shrink-0 items-center gap-0.5 text-[12px] text-neutral-400 hover:text-white"
              >
                {members.length ? "Manage" : "Assign"}
                <ChevronRight size={13} strokeWidth={1.75} />
              </Link>
            </div>
            <div className="px-5 py-4">
              <div className="text-[12px] text-neutral-500">
                What it adds up to
              </div>
              <div className="mt-2 text-[13px] leading-relaxed text-neutral-200">
                Manages {manages} of {areas.length} areas
                {views ? `, views ${views} more` : ""}.{" "}
                <span className="text-neutral-400">
                  {sendCap === undefined
                    ? "Can't send money."
                    : sendCap === null
                      ? "Sends any amount."
                      : `Sends up to ${usd(sendCap)} per payment.`}
                </span>
              </div>
            </div>
          </div>

          {!editable && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-white/[0.04] px-4 py-3 text-[12px] text-neutral-400">
              <span>
                {role.owner
                  ? "The owner always has full access. To hand it over, transfer ownership from Team."
                  : "Default roles stay the same for every workspace. Duplicate this one to change what it can do."}
              </span>
              {!role.owner && (
                <button
                  type="button"
                  onClick={() => duplicate(role)}
                  className="shrink-0 text-neutral-200 hover:text-white"
                >
                  Duplicate to edit
                </button>
              )}
            </div>
          )}

          {/* Permissions */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <h3 className="text-[15px] text-white">Permissions</h3>
            <label className="flex h-8 w-[240px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35">
              <Search
                size={13}
                strokeWidth={1.75}
                className="text-neutral-500"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a permission…"
                aria-label="Find a permission"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear"
                  onClick={() => setQuery("")}
                  className="text-neutral-500 hover:text-white"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              )}
            </label>
          </div>

          <div key={version} className="mt-4 space-y-7">
            {GROUPS.map((g) => {
              const shown = g.areas.filter(match);
              if (!shown.length) return null;
              return (
                <div key={g.id}>
                  <div className="mb-2 text-[12px] text-neutral-500">
                    {g.label}
                  </div>
                  <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/8">
                    {shown.map((area) => (
                      <AreaRow
                        key={area.id}
                        area={area}
                        grants={grants}
                        limits={role.limits}
                        editable={editable}
                        open={open === area.id || !!needle}
                        needle={needle}
                        onToggle={() =>
                          setOpen(open === area.id ? null : area.id)
                        }
                        onGrant={setGrant}
                        onArea={(k) => setArea(area, k)}
                        onLimit={(id, v) =>
                          edit({ limits: { ...role.limits, [id]: v } })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {GROUPS.every((g) => !g.areas.some(match)) && (
              <p className="py-10 text-center text-[13px] text-neutral-500">
                No permission matches “{query}”.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* Save bar: what changes and for how many people */}
      {dirty && draft && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-6 rounded-full bg-neutral-950 py-2 pr-2 pl-5 text-[13px] text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.5)] ring-1 ring-white/10">
          <span>
            Unsaved changes to {draft.name}
            <span className="text-neutral-400">
              {" "}
              ·{" "}
              {members.length
                ? `applies to ${members.length} ${members.length === 1 ? "person" : "people"}`
                : "nobody has this role yet"}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setVersion((v) => v + 1);
              }}
              className="h-8 rounded-full px-3 text-neutral-300 hover:text-white"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={save}
              className="h-8 rounded-full bg-white px-4 font-medium text-black hover:bg-neutral-200"
            >
              Save changes
            </button>
          </span>
        </div>
      )}

      {creating && (
        <CreateRole
          roles={roles}
          onClose={() => setCreating(false)}
          onCreate={(from, name, description) => {
            setCreating(false);
            duplicate(from, name, description);
          }}
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

function RoleList({
  title,
  roles,
  selectedId,
  onSelect,
}: {
  title: string;
  roles: Role[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between px-3 text-[12px] text-neutral-500">
        <span>{title}</span>
        {roles.length > 0 && <span>People</span>}
      </div>
      {roles.length === 0 && (
        <p className="px-3 py-2 text-[12px] text-neutral-600">None yet</p>
      )}
      <ul className="space-y-0.5">
        {roles.map((r) => {
          const people = MEMBERS.filter((m) => m.role === r.id);
          const on = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-current={on || undefined}
                onClick={() => onSelect(r.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  on ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"
                }`}
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate text-[13px] ${on ? "font-medium text-white" : "text-neutral-200"}`}
                  >
                    {r.name}
                  </span>
                  <span className="block truncate text-[12px] text-neutral-500">
                    {r.tagline}
                  </span>
                </span>
                <span
                  className={`w-6 shrink-0 text-right text-[13px] tabular-nums ${people.length ? (on ? "text-white" : "text-neutral-300") : "text-neutral-600"}`}
                >
                  {people.length || "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const list = (xs: string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/** The row's second line: what they can do, what they can't, and any cap on money. */
function summarise(
  area: Area,
  grants: Set<string>,
  limits: Record<string, number | null>,
) {
  const on = area.abilities.filter((a) => grants.has(a.id));
  const off = area.abilities.filter((a) => !grants.has(a.id));
  if (!on.length) return `No access to ${lower(area.label)}`;
  const can = on.map((a, i) => (i === 0 ? a.label : lower(a.label)));
  const capped = on.find((a) => a.limit && limits[a.id] != null);
  const cap = capped
    ? ` · up to ${usd(limits[capped.id]!)} ${capped.limit!.unit}`
    : "";
  if (!off.length) return `${list(can)}${cap}`;
  const cant = `can't ${lower(off[0].label)}${off.length > 1 ? ` or ${off.length - 1} more` : ""}`;
  return `${list(can.slice(0, 2))}${can.length > 2 ? ` and ${can.length - 2} more` : ""}${cap} · ${cant}`;
}

/** One product area: the access level at a glance, the exact abilities when opened. */
function AreaRow({
  area,
  grants,
  limits,
  editable,
  open,
  needle,
  onToggle,
  onGrant,
  onArea,
  onLimit,
}: {
  area: Area;
  grants: Set<string>;
  limits: Record<string, number | null>;
  editable: boolean;
  open: boolean;
  needle: string;
  onToggle: () => void;
  onGrant: (id: string, on: boolean) => void;
  onArea: (k: Exclude<Access, "custom">) => void;
  onLimit: (id: string, v: number | null) => void;
}) {
  const access = accessOf(area, grants);
  const summary = summarise(area, grants, limits);
  const hasViews = area.abilities.some((a) => a.view);
  const abilities = needle
    ? area.abilities.filter(
        (a) =>
          area.label.toLowerCase().includes(needle) ||
          a.label.toLowerCase().includes(needle) ||
          a.hint?.toLowerCase().includes(needle),
      )
    : area.abilities;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-white">{area.label}</span>
          <span className="block truncate text-[12px] text-neutral-500">
            {summary}
          </span>
        </span>
        <span
          className={`shrink-0 text-[12px] tabular-nums ${
            access.kind === "full"
              ? "text-neutral-100"
              : access.kind === "none"
                ? "text-neutral-600"
                : "text-neutral-300"
          }`}
        >
          {access.kind === "custom"
            ? `${access.n} of ${area.abilities.length}`
            : ACCESS_LABEL[access.kind]}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 pt-3 pb-4">
          {editable && !needle && (
            <div
              role="radiogroup"
              aria-label={`${area.label} access`}
              className="mb-3 inline-flex rounded-full bg-white/[0.06] p-0.5"
            >
              {(
                ["none", ...(hasViews ? ["view"] : []), "full"] as Exclude<
                  Access,
                  "custom"
                >[]
              ).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={access.kind === k}
                  onClick={() => onArea(k)}
                  className={`h-7 rounded-full px-3 text-[12px] transition-colors ${
                    access.kind === k
                      ? "bg-surface font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.25)]"
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  {ACCESS_LABEL[k]}
                </button>
              ))}
            </div>
          )}
          <ul className="space-y-0.5">
            {abilities.map((a) => {
              const granted = grants.has(a.id);
              const cap = limits[a.id];
              return (
                <li key={a.id} className="rounded-lg">
                  <div className="flex items-center gap-4 py-2">
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-[13px] ${granted ? "text-neutral-100" : "text-neutral-500"}`}
                      >
                        {a.label}
                      </span>
                      {a.hint && (
                        <span className="block text-[12px] text-neutral-500">
                          {a.hint}
                        </span>
                      )}
                    </span>
                    <Switch
                      on={granted}
                      disabled={!editable}
                      label={a.label}
                      onChange={() => onGrant(a.id, !granted)}
                    />
                  </div>
                  {a.limit && granted && (
                    <LimitField
                      unit={a.limit.unit}
                      value={cap ?? null}
                      editable={editable}
                      onChange={(v) => onLimit(a.id, v)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A cap on money movement. Anything above it waits in Approvals instead of being refused. */
function LimitField({
  unit,
  value,
  editable,
  onChange,
}: {
  unit: string;
  value: number | null;
  editable: boolean;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  return (
    <div className="mb-2 ml-0 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-white/8 px-3 py-2.5 text-[12px]">
      <span className="text-neutral-400">Up to</span>
      {editable ? (
        <label className="flex h-7 w-[120px] items-center gap-1 rounded-md border border-white/12 px-2 focus-within:border-white/35">
          <span className="text-neutral-500">$</span>
          <input
            inputMode="numeric"
            value={text}
            placeholder="No limit"
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setText(raw ? Number(raw).toLocaleString("en-US") : "");
              onChange(raw ? Number(raw) : null);
            }}
            aria-label={`Limit ${unit}`}
            className="amount min-w-0 flex-1 bg-transparent text-white tabular-nums outline-none placeholder:text-neutral-500"
          />
        </label>
      ) : (
        <span className="amount text-neutral-100 tabular-nums">
          {value === null ? "No limit" : usd(value)}
        </span>
      )}
      <span className="text-neutral-400">{unit}</span>
      <span className="basis-full text-neutral-500">
        {value === null
          ? "No cap — only approval rules apply."
          : "Anything larger goes to Approvals instead of being refused."}
      </span>
    </div>
  );
}

function Switch({
  on,
  disabled,
  label,
  onChange,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{ width: 32, height: 18 }}
      className={`shrink-0 rounded-full p-0.5 transition-colors disabled:cursor-not-allowed ${
        on
          ? "bg-white disabled:bg-white/45"
          : "bg-white/15 disabled:bg-white/[0.07]"
      }`}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          transform: `translateX(${on ? 14 : 0}px)`,
        }}
        className={`block rounded-full transition-transform ${on ? "bg-black" : "bg-white"} ${disabled && !on ? "opacity-40" : ""}`}
      />
    </button>
  );
}

/** Name it, say what it's for, and start from the closest existing role. */
function CreateRole({
  roles,
  onClose,
  onCreate,
}: {
  roles: Role[];
  onClose: () => void;
  onCreate: (from: Role, name: string, description: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("viewer");
  const guard = useDiscardGuard(onClose);
  const { requestClose } = guard;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);
  const base = roles.find((r) => r.id === from)!;
  const blank: Role = { ...base, id: "blank", name: "Nothing", grants: [] };
  const start = from === "blank" ? blank : base;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        aria-hidden
        onClick={requestClose}
        className="scrim-in absolute inset-0 bg-black/45"
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-label="Create role"
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          guard.clear();
          onCreate(
            start,
            name.trim(),
            description.trim() || `Custom role based on ${start.name}.`,
          );
        }}
        className="orbit-pop relative w-[440px] rounded-2xl border border-white/10 bg-surface p-6 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.5)]"
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[17px] font-medium text-white">Create role</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-white/8 hover:text-white"
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-neutral-200">
              Name
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payouts team"
              className="h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-neutral-200">
              What it&apos;s for{" "}
              <span className="text-neutral-500">(Optional)</span>
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown to admins when they assign it"
              className="h-10 w-full rounded-lg border border-white/12 bg-transparent px-3 text-[13px] text-white outline-none placeholder:text-neutral-500 focus:border-white/35"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[13px] text-neutral-200">
              Start from
            </span>
            <Dropdown
              label="Start from"
              value={from}
              options={[
                ...roles
                  .filter((r) => !r.owner)
                  .map((r) => ({
                    value: r.id,
                    label: r.name,
                    hint: `${ALL_ABILITIES.filter((a) => r.grants.includes(a.id)).length} permissions`,
                  })),
                {
                  value: "blank",
                  label: "No permissions",
                  hint: "Build it up yourself",
                },
              ]}
              onChange={setFrom}
            />
            <p className="mt-1.5 text-[12px] text-neutral-500">
              You can change every permission after it&apos;s created.
            </p>
          </div>
        </div>
        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="h-9 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
          >
            Create role
          </button>
        </div>
      </form>
      {guard.asking && (
        <DiscardConfirm
          title="Discard this role?"
          onKeep={guard.keep}
          onDiscard={guard.discard}
        />
      )}
    </div>
  );
}
