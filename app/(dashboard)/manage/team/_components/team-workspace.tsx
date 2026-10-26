"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  EllipsisVertical,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  DiscardConfirm,
  useDiscardGuard,
} from "@/app/_components/discard-guard";
import { Dropdown } from "@/app/_components/dropdown";
import { TablePager, usePager } from "@/app/_components/table-pager";
import { PersonAvatar } from "@/app/_components/person-avatar";
import {
  INVITES,
  ME,
  MEMBERS,
  ROLES,
  reachOf,
  type Invite,
  type Member,
  type Role,
} from "../../roles/_data";
import { RULES } from "../../approvals/_data";
import { UpdateNotice } from "@/app/_components/updates";
import { TeamStories } from "./team-stories";

type Tab = "members" | "invites";

const roleOf = (id: string) => ROLES.find((r) => r.id === id)!;
const usd = (v: number) => `$${v.toLocaleString("en-US")}`;
const sendText = (role: Role) => {
  const cap = reachOf(role).sendCap;
  return cap === undefined
    ? "Can't send"
    : cap === null
      ? "No limit"
      : `${usd(cap)} per payment`;
};

function Avatar({ name, size = 8 }: { name: string; size?: 8 | 10 | 12 }) {
  return <PersonAvatar name={name} size={size * 4} />;
}

export function TeamWorkspace() {
  const [members, setMembers] = useState<Member[]>(MEMBERS);
  const [invites, setInvites] = useState<Invite[]>(INVITES);
  const [tab, setTab] = useState<Tab>("members");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sheet, setSheet] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const q = query.trim().toLowerCase();
  const rows = members.filter(
    (m) =>
      (roleFilter === "all" || m.role === roleFilter) &&
      (!q || `${m.name} ${m.email}`.toLowerCase().includes(q)),
  );
  const inviteRows = invites.filter(
    (i) =>
      (roleFilter === "all" || i.role === roleFilter) &&
      (!q || i.email.includes(q)),
  );
  const pager = usePager(rows, "team-members");
  const invitePager = usePager(inviteRows, "team-invites");
  const resetPages = () => {
    pager.setPage(1);
    invitePager.setPage(1);
  };
  const noTwoStep = members.filter((m) => !m.twoFactor);

  const changeRole = (name: string, role: string) => {
    setMembers((all) => all.map((m) => (m.name === name ? { ...m, role } : m)));
    setToast(`${name.split(" ")[0]} is now ${roleOf(role).name}`);
  };
  const remove = (name: string) => {
    setMembers((all) => all.filter((m) => m.name !== name));
    setSheet(null);
    setToast(`${name} removed — they've been signed out`);
  };
  const open = sheet ? members.find((m) => m.name === sheet) : undefined;

  return (
    <div className="mx-auto max-w-(--page-max) px-8 pt-12 pb-28">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[26px] font-medium tracking-[-0.025em] text-white">
            Team
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Everyone who can sign in to Kredete. Their role decides what they
            can see and do.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviting(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white pr-4 pl-3 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
        >
          <Plus size={15} strokeWidth={2} />
          Invite people
        </button>
      </div>

      <UpdateNotice id="u-approval" place="team" />

      <TeamStories />

      <div className="mt-8 flex items-end justify-between gap-6 border-b border-white/8">
        <div role="tablist" className="flex gap-6">
          {(
            [
              ["members", "Members", members.length],
              ["invites", "Invites", invites.length],
            ] as const
          ).map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                resetPages();
              }}
              className={`-mb-px flex items-center gap-1.5 border-b pb-3 text-[14px] transition-colors ${
                tab === id
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {label}
              <span className="text-[12px] text-neutral-500 tabular-nums">
                {n}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pb-2.5">
          <label className="flex h-8 w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 transition-colors focus-within:border-white/35">
            <Search size={13} strokeWidth={1.75} className="text-neutral-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPages();
              }}
              placeholder="Search people…"
              aria-label="Search people"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-neutral-500"
            />
          </label>
          <Dropdown
            label="Role"
            variant="chip"
            align="right"
            value={roleFilter}
            active={roleFilter !== "all"}
            options={[
              { value: "all", label: "All roles" },
              ...ROLES.map((r) => ({ value: r.id, label: r.name })),
            ]}
            onChange={(v) => {
              setRoleFilter(v);
              resetPages();
            }}
          />
        </div>
      </div>

      {tab === "members" && noTwoStep.length > 0 && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-white/[0.04] px-4 py-3 text-[13px]">
          <span className="text-neutral-300">
            {noTwoStep.length}{" "}
            {noTwoStep.length === 1 ? "person hasn't" : "people haven't"} turned
            on two-step login
            <span className="text-neutral-500">
              {" "}
              — {noTwoStep.map((m) => m.name.split(" ")[0]).join(", ")}
            </span>
          </span>
          <button
            type="button"
            onClick={() =>
              setToast(
                `Reminder sent to ${noTwoStep.length} ${noTwoStep.length === 1 ? "person" : "people"}`,
              )
            }
            className="shrink-0 text-neutral-200 hover:text-white"
          >
            Send a reminder
          </button>
        </div>
      )}

      {tab === "members" ? (
        <>
          <table className="mt-3 w-full table-fixed text-[13px]">
            <colgroup>
              <col />
              <col className="w-[170px]" />
              <col className="w-[170px]" />
              <col className="w-[130px]" />
              <col className="w-[120px]" />
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-2.5 font-normal">Person</th>
                <th className="py-2.5 font-normal">Role</th>
                <th className="py-2.5 font-normal">Can send</th>
                <th className="py-2.5 font-normal">Two-step login</th>
                <th className="py-2.5 font-normal">Last active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pager.visible.map((m) => {
                const role = roleOf(m.role);
                const fixed = role.owner || m.name === ME;
                return (
                  <tr
                    key={m.name}
                    onClick={() => setSheet(m.name)}
                    className="cursor-pointer border-t border-white/6 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-3">
                        <Avatar name={m.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-white">
                            {m.name}
                            {m.name === ME && (
                              <span className="text-neutral-500"> (you)</span>
                            )}
                          </span>
                          <span className="block truncate text-[12px] text-neutral-500">
                            {m.email}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td
                      className="py-3 pr-4"
                      onClick={(e) => !fixed && e.stopPropagation()}
                    >
                      {fixed ? (
                        <span className="text-neutral-200">{role.name}</span>
                      ) : (
                        <Dropdown
                          label={`${m.name}'s role`}
                          variant="bare"
                          className="-ml-3.5"
                          value={m.role}
                          options={ROLES.filter((r) => !r.owner).map((r) => ({
                            value: r.id,
                            label: r.name,
                          }))}
                          onChange={(v) => changeRole(m.name, v)}
                        />
                      )}
                    </td>
                    <td className="py-3 pr-4 text-neutral-300 tabular-nums">
                      {sendText(role)}
                    </td>
                    <td
                      className={`py-3 pr-4 ${m.twoFactor ? "text-neutral-300" : "text-rose-300"}`}
                    >
                      {m.twoFactor ? "On" : "Off"}
                    </td>
                    <td className="py-3 pr-4 text-neutral-500">
                      {m.lastActive}
                    </td>
                    <td
                      className="py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <RowMenu
                        items={[
                          {
                            label: "View details",
                            onClick: () => setSheet(m.name),
                          },
                          ...(!m.twoFactor
                            ? [
                                {
                                  label: "Remind about two-step login",
                                  onClick: () =>
                                    setToast(
                                      `Reminder sent to ${m.name.split(" ")[0]}`,
                                    ),
                                },
                              ]
                            : []),
                          ...(!fixed
                            ? [
                                {
                                  label: "Remove from team",
                                  danger: true,
                                  onClick: () => remove(m.name),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="border-t border-white/6 py-16 text-center text-neutral-500"
                  >
                    Nobody matches.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePager pager={pager} noun="people" />
        </>
      ) : (
        <>
          <table className="mt-3 w-full table-fixed text-[13px]">
            <colgroup>
              <col />
              <col className="w-[160px]" />
              <col className="w-[190px]" />
              <col className="w-[130px]" />
              <col className="w-[180px]" />
            </colgroup>
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-2.5 font-normal">Email</th>
                <th className="py-2.5 font-normal">Role</th>
                <th className="py-2.5 font-normal">Invited by</th>
                <th className="py-2.5 font-normal">Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invitePager.visible.map((i) => (
                <tr key={i.email} className="border-t border-white/6">
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-3">
                      <Avatar name={i.email} />
                      <span className="min-w-0">
                        <span className="block truncate text-neutral-100">
                          {i.email}
                        </span>
                        <span className="block text-[12px] text-neutral-500">
                          Sent {i.sent}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-neutral-200">
                    {roleOf(i.role).name}
                  </td>
                  <td className="py-3 pr-4 text-neutral-300">
                    {i.invitedBy === ME ? "You" : i.invitedBy}
                  </td>
                  <td className="py-3 pr-4 text-neutral-500">{i.expires}</td>
                  <td className="py-3 text-right">
                    <span className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setInvites((all) =>
                            all.map((x) =>
                              x.email === i.email
                                ? {
                                    ...x,
                                    sent: "just now",
                                    expires: "in 7 days",
                                  }
                                : x,
                            ),
                          );
                          setToast(`Invite sent again to ${i.email}`);
                        }}
                        className="h-8 rounded-full px-3 text-[13px] text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                      >
                        Resend
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInvites((all) =>
                            all.filter((x) => x.email !== i.email),
                          );
                          setToast(`Invite to ${i.email} cancelled`);
                        }}
                        className="h-8 rounded-full px-3 text-[13px] text-neutral-500 hover:bg-white/[0.06] hover:text-white"
                      >
                        Cancel invite
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {inviteRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t border-white/6 py-16 text-center text-neutral-500"
                  >
                    No invites waiting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <TablePager pager={invitePager} noun="invites" />
        </>
      )}

      {open && (
        <MemberSheet
          m={open}
          onClose={() => setSheet(null)}
          onRole={(r) => changeRole(open.name, r)}
          onRemove={() => remove(open.name)}
        />
      )}

      {inviting && (
        <InviteFlow
          existing={[
            ...members.map((m) => m.email),
            ...invites.map((i) => i.email),
          ]}
          onClose={() => setInviting(false)}
          onSend={(emails, role) => {
            setInvites((all) => [
              ...emails.map((email) => ({
                email,
                role,
                invitedBy: ME,
                sent: "just now",
                expires: "in 7 days",
              })),
              ...all,
            ]);
            setInviting(false);
            setTab("invites");
            setToast(
              `${emails.length} ${emails.length === 1 ? "invite" : "invites"} sent as ${roleOf(role).name}`,
            );
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

function RowMenu({
  items,
}: {
  items: { label: string; danger?: boolean; onClick: () => void }[];
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
          className="absolute top-full right-0 z-20 mt-1 w-[230px] rounded-xl border border-white/10 bg-surface p-1 text-left shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]"
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
              className={`block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-white/[0.06] ${it.danger ? "text-rose-300" : "text-neutral-200"}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One person: what their role lets them do, where they sign off, and how secure their login is. */
function MemberSheet({
  m,
  onClose,
  onRole,
  onRemove,
}: {
  m: Member;
  onClose: () => void;
  onRole: (r: string) => void;
  onRemove: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const role = roleOf(m.role);
  const reach = reachOf(role);
  const fixed = role.owner || m.name === ME;
  const approves = role.owner || role.grants.includes("approvals.approve");
  const rules = RULES.filter((r) => r.from.includes(m.role));

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
        aria-label={m.name}
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[440px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar name={m.name} size={12} />
            <div className="min-w-0">
              <div className="truncate text-[16px] text-white">
                {m.name}
                {m.name === ME && (
                  <span className="text-neutral-500"> (you)</span>
                )}
              </div>
              <div className="truncate text-[12px] text-neutral-500">
                {m.email}
              </div>
              <div className="mt-0.5 text-[12px] text-neutral-500">
                Joined {m.joined} · active {m.lastActive.toLowerCase()}
              </div>
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

        <div className="flex-1 space-y-7 px-6 py-5">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs text-neutral-500">Role</h3>
              <Link
                href="/manage/roles"
                className="flex items-center gap-0.5 text-[12px] text-neutral-400 hover:text-white"
              >
                See permissions
                <ChevronRight size={12} strokeWidth={1.75} />
              </Link>
            </div>
            {fixed ? (
              <div className="text-[15px] text-white">{role.name}</div>
            ) : (
              <Dropdown
                label="Role"
                value={m.role}
                options={ROLES.filter((r) => !r.owner).map((r) => ({
                  value: r.id,
                  label: r.name,
                  hint: sendText(r),
                }))}
                onChange={onRole}
              />
            )}
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
              {role.description}
            </p>
            <div className="mt-3 grid grid-cols-2 divide-x divide-white/8 rounded-lg border border-white/8 text-[12px]">
              <div className="px-3.5 py-2.5">
                <div className="text-neutral-500">Can send</div>
                <div className="mt-0.5 text-[13px] text-neutral-100">
                  {sendText(role)}
                </div>
              </div>
              <div className="px-3.5 py-2.5">
                <div className="text-neutral-500">Reach</div>
                <div className="mt-0.5 text-[13px] text-neutral-100">
                  Manages {reach.manages} of {reach.total} areas
                </div>
              </div>
            </div>
            {role.owner && (
              <p className="mt-2 text-[12px] text-neutral-500">
                The owner&apos;s role can only change by transferring ownership.
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-xs text-neutral-500">Approvals</h3>
            {approves ? (
              <>
                <p className="text-[13px] leading-relaxed text-neutral-200">
                  Can approve payments
                  {rules.length ? " under these rules:" : "."}
                </p>
                {rules.length > 0 && (
                  <ul className="mt-2 space-y-1.5 text-[13px] text-neutral-400">
                    {rules.map((r) => (
                      <li key={r.id} className="flex gap-2">
                        <span aria-hidden className="text-neutral-600">
                          —
                        </span>
                        {r.when.kind === "newRecipient"
                          ? `First payments to a new recipient`
                          : `Payments of ${usd(r.when.min)} or more`}
                        {r.approvals > 1
                          ? ` (one of ${r.approvals} sign-offs)`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-[13px] text-neutral-400">
                Can&apos;t approve payments.{" "}
                {reach.sendCap !== undefined &&
                  "Their payments above their limit wait for someone who can."}
              </p>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-xs text-neutral-500">Security</h3>
            <div className="flex items-center justify-between gap-4 border-b border-white/6 py-2.5">
              <span className="text-[12px] text-neutral-500">
                Two-step login
              </span>
              <span
                className={`text-[13px] ${m.twoFactor ? "text-neutral-100" : "text-rose-300"}`}
              >
                {m.twoFactor ? "On · authenticator app" : "Off"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/6 py-2.5">
              <span className="text-[12px] text-neutral-500">Last sign-in</span>
              <span className="text-[13px] text-neutral-100">
                {m.lastActive} · Chrome on macOS
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-[12px] text-neutral-500">Email</span>
              <span className="text-[13px] text-neutral-100">Verified</span>
            </div>
          </section>
        </div>

        {!fixed && (
          <div className="flex items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
            <span className="text-[12px] text-neutral-500">
              Removing signs them out everywhere.
            </span>
            <button
              type="button"
              onClick={onRemove}
              className="h-9 rounded-full px-4 text-[13px] text-rose-300 hover:bg-rose-400/10"
            >
              Remove from team
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

type Step = "people" | "role" | "review";
const STEPS: { id: Step; label: string }[] = [
  { id: "people", label: "People" },
  { id: "role", label: "Role" },
  { id: "review", label: "Review & send" },
];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite: who, as what, and a last look at what that role can do. */
function InviteFlow({
  existing,
  onClose,
  onSend,
}: {
  existing: string[];
  onClose: () => void;
  onSend: (emails: string[], role: string) => void;
}) {
  const [step, setStep] = useState<Step>("people");
  const [emails, setEmails] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [role, setRole] = useState("operations");
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      return onClose();
    setLeaving(true);
    setTimeout(onClose, 260);
  }, [onClose]);
  const guard = useDiscardGuard(close);
  const { requestClose } = guard;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  const add = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    setEmails((all) => [...new Set([...all, ...parts])]);
    setText("");
  };
  const bad = emails.filter((e) => !EMAIL.test(e));
  const dupes = emails.filter((e) => existing.includes(e));
  const ok = emails.length > 0 && !bad.length && !dupes.length;
  const at = STEPS.findIndex((s) => s.id === step);
  const chosen = roleOf(role);
  const reach = reachOf(chosen);

  return (
    <div className="fixed inset-0 z-50" data-leaving={leaving || undefined}>
      <div
        aria-hidden
        onClick={requestClose}
        className="sheet-scrim absolute inset-0 bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite people"
        onInputCapture={guard.markDirty}
        onChangeCapture={guard.markDirty}
        onClickCapture={guard.markDirty}
        className="sheet-panel absolute inset-x-0 top-[7vh] bottom-0 overflow-y-auto rounded-t-[22px] bg-takeover shadow-[0_-24px_80px_-20px_rgb(0_0_0/0.6)] ring-1 ring-white/8"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-[13px] text-neutral-300">Invite people</div>
          <button
            type="button"
            aria-label="Close"
            onClick={requestClose}
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="mx-auto grid max-w-[900px] grid-cols-[160px_minmax(0,520px)] gap-12 px-6 pb-20">
          <ol className="sticky top-6 mt-10 h-fit border-l border-white/8">
            {STEPS.map((st, i) => (
              <li key={st.id}>
                <button
                  type="button"
                  disabled={at <= i}
                  onClick={() => setStep(st.id)}
                  className={`-ml-px block w-full border-l py-1.5 pl-4 text-left text-[13px] ${
                    st.id === step
                      ? "border-white text-white"
                      : at > i
                        ? "border-transparent text-neutral-300 enabled:hover:text-white"
                        : "border-transparent text-neutral-600"
                  }`}
                >
                  {st.label}
                </button>
              </li>
            ))}
          </ol>

          <form
            className="mt-10"
            onSubmit={(e) => {
              e.preventDefault();
              if (step === "people") {
                if (text.trim()) add(text);
                else if (ok) setStep("role");
              } else if (step === "role") setStep("review");
              else {
                guard.clear();
                onSend(emails, role);
              }
            }}
          >
            {step === "people" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  Who are you inviting?
                </h2>
                <p className="mt-2 text-[13px] text-neutral-400">
                  Add work emails. Paste a list to add several at once — they
                  all get the same role.
                </p>
                <div className="mt-8 flex min-h-[84px] flex-wrap content-start gap-1.5 rounded-lg border border-white/12 p-2 focus-within:border-white/35">
                  {emails.map((e) => {
                    const problem = !EMAIL.test(e)
                      ? "Not an email"
                      : existing.includes(e)
                        ? "Already on the team"
                        : null;
                    return (
                      <span
                        key={e}
                        title={problem ?? undefined}
                        className={`flex h-7 items-center gap-1 rounded-full pr-1 pl-2.5 text-[12px] ${
                          problem
                            ? "bg-rose-400/10 text-rose-300"
                            : "bg-white/[0.07] text-neutral-100"
                        }`}
                      >
                        {e}
                        {problem && (
                          <span className="text-rose-300/70">· {problem}</span>
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${e}`}
                          onClick={() =>
                            setEmails((all) => all.filter((x) => x !== e))
                          }
                          className="flex size-5 items-center justify-center rounded-full text-neutral-500 hover:text-white"
                        >
                          <X size={11} strokeWidth={2} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    autoFocus
                    value={text}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/[\s,;]$/.test(v)) add(v);
                      else setText(v);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      add(e.clipboardData.getData("text"));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !text && emails.length)
                        setEmails((all) => all.slice(0, -1));
                    }}
                    onBlur={() => text.trim() && add(text)}
                    placeholder={emails.length ? "" : "name@company.com"}
                    aria-label="Email addresses"
                    className="h-7 min-w-[180px] flex-1 bg-transparent px-1.5 text-[13px] text-white outline-none placeholder:text-neutral-500"
                  />
                </div>
                {(bad.length > 0 || dupes.length > 0) && (
                  <p className="mt-2 text-[12px] text-rose-300">
                    {bad.length
                      ? `${bad.length} ${bad.length === 1 ? "address doesn't" : "addresses don't"} look right. `
                      : ""}
                    {dupes.length
                      ? `${dupes.length} already on the team or invited.`
                      : ""}
                  </p>
                )}
                <Footer
                  onBack={requestClose}
                  backLabel="Cancel"
                  canContinue={ok}
                  label={`Continue${emails.length ? ` with ${emails.length}` : ""}`}
                />
              </>
            )}

            {step === "role" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  What can they do?
                </h2>
                <p className="mt-2 text-[13px] text-neutral-400">
                  Pick the closest role. You can change it any time, or make a
                  custom one in Roles & permissions.
                </p>
                <div
                  role="radiogroup"
                  className="mt-8 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10"
                >
                  {ROLES.filter((r) => !r.owner).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={role === r.id}
                      onClick={() => setRole(r.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors ${role === r.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                    >
                      <span
                        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                          role === r.id
                            ? "border-white bg-white text-black"
                            : "border-white/25"
                        }`}
                      >
                        {role === r.id && <Check size={10} strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="text-[13px] text-white">
                            {r.name}
                          </span>
                          <span className="text-[12px] text-neutral-500">
                            {sendText(r)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                          {r.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <Footer
                  onBack={() => setStep("people")}
                  canContinue
                  label="Continue"
                />
              </>
            )}

            {step === "review" && (
              <>
                <h2 className="text-[22px] font-medium tracking-[-0.02em] text-white">
                  Review & send
                </h2>
                <p className="mt-2 text-[13px] text-neutral-400">
                  Invites last 7 days. They&apos;ll set up two-step login when
                  they first sign in.
                </p>
                <div className="mt-8 divide-y divide-white/[0.06] rounded-xl border border-white/10">
                  <div className="flex items-start gap-4 px-4 py-3 text-[13px]">
                    <span className="w-20 shrink-0 text-neutral-500">
                      Inviting
                    </span>
                    <span className="min-w-0 flex-1 text-neutral-100">
                      {emails.join(", ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep("people")}
                      className="shrink-0 text-[12px] text-neutral-500 hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-start gap-4 px-4 py-3 text-[13px]">
                    <span className="w-20 shrink-0 text-neutral-500">As</span>
                    <span className="min-w-0 flex-1">
                      <span className="text-neutral-100">{chosen.name}</span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-neutral-500">
                        Manages {reach.manages} of {reach.total} areas
                        {reach.views
                          ? `, views ${reach.views} more`
                          : ""} ·{" "}
                        {reach.sendCap === undefined
                          ? "can't send money"
                          : reach.sendCap === null
                            ? "sends any amount"
                            : `sends up to ${usd(reach.sendCap)} per payment`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStep("role")}
                      className="shrink-0 text-[12px] text-neutral-500 hover:text-white"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <Footer
                  onBack={() => setStep("role")}
                  canContinue
                  label={`Send ${emails.length} ${emails.length === 1 ? "invite" : "invites"}`}
                />
              </>
            )}
          </form>
        </div>
      </div>
      {guard.asking && (
        <DiscardConfirm
          title="Discard this invite?"
          onKeep={guard.keep}
          onDiscard={guard.discard}
          className="absolute inset-x-0 top-[7vh] bottom-0 rounded-t-[22px]"
        />
      )}
    </div>
  );
}

function Footer({
  onBack,
  backLabel = "Back",
  canContinue,
  label,
}: {
  onBack: () => void;
  backLabel?: string;
  canContinue: boolean;
  label: string;
}) {
  return (
    <div className="mt-10 flex justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 items-center gap-1 rounded-full bg-white/[0.06] px-4 text-[13px] text-neutral-200 hover:bg-white/[0.1]"
      >
        {backLabel === "Back" && <ArrowLeft size={14} strokeWidth={1.75} />}
        {backLabel}
      </button>
      <button
        type="submit"
        disabled={!canContinue}
        className="flex h-9 items-center gap-1 rounded-full bg-white pr-3 pl-4 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-neutral-500"
      >
        {label}
        <ChevronRight size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
