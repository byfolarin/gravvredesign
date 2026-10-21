"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Ellipsis, Plus, X } from "lucide-react";
import { CopyButton } from "@/app/_components/copy-button";
import { Dropdown } from "@/app/_components/dropdown";
import { AssetMark } from "./asset-mark";
import {
  ASSET_NAME,
  COUNTRY,
  NETWORKS,
  addressProblem,
  makeSsi,
  mask,
  type Asset,
  type Destination,
} from "../_data";

const ORDER: Asset[] = ["NGN", "KES", "GHS", "USDC", "USDT", "USD", "EUR"];
const isWallet = (a: Asset) => a === "USDC" || a === "USDT";

type Draft = {
  id?: string;
  asset: Asset;
  provider: string;
  accountName: string;
  number: string;
  makeDefault: boolean;
};

/**
 * Settlement instructions (Gravv's "Configure" on the desk): where the desk pays out.
 * Grouped by currency; one default per currency, which new orders pick automatically.
 */
export function SettlementSheet({
  ssis,
  onChange,
  onClose,
  addFor,
}: {
  ssis: Destination[];
  onChange: (next: Destination[]) => void;
  onClose: () => void;
  /** Open straight into "add" for this currency (from the ticket). */
  addFor?: Asset | null;
}) {
  const [draft, setDraft] = useState<Draft | null>(() =>
    addFor
      ? blank(addFor, !ssis.some((s) => s.asset === addFor && !s.removed))
      : null,
  );
  const [menu, setMenu] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  // A half-filled form is never thrown away by a stray click or Esc: ask first.
  const [touched, setTouched] = useState(false);
  const [asking, setAsking] = useState<null | "back" | "close">(null);
  const leaveForm = () => {
    setDraft(null);
    setTouched(false);
  };
  const guard = (to: "back" | "close") => {
    if (draft && touched) return setAsking(to);
    if (to === "back") leaveForm();
    else onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (asking) setAsking(null);
      else guard(draft ? "back" : "close");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const live = ssis.filter((s) => !s.removed);
  const makeDefault = (id: string) => {
    const t = ssis.find((s) => s.id === id)!;
    onChange(
      ssis.map((s) =>
        s.asset === t.asset ? { ...s, isDefault: s.id === id } : s,
      ),
    );
  };
  const remove = (id: string) => {
    const t = ssis.find((s) => s.id === id)!;
    // Archive rather than delete (past orders still point at it); hand the default on.
    const heir = t.isDefault
      ? live.find((s) => s.asset === t.asset && s.id !== id)?.id
      : undefined;
    onChange(
      ssis.map((s) =>
        s.id === id
          ? { ...s, removed: true, isDefault: false }
          : s.id === heir
            ? { ...s, isDefault: true }
            : s,
      ),
    );
    setRemoving(null);
  };
  const save = (d: Draft) => {
    const id = d.id ?? `ssi-${ssis.length + 1}`;
    const firstForAsset = !live.some(
      (s) => s.asset === d.asset && s.id !== d.id,
    );
    const isDefault = d.makeDefault || firstForAsset;
    const next = makeSsi({
      id,
      asset: d.asset,
      kind: isWallet(d.asset) ? "wallet" : "bank",
      provider: d.provider.trim(),
      accountName: d.accountName.trim(),
      number: d.number.trim(),
      country: isWallet(d.asset) ? undefined : COUNTRY[d.asset],
      isDefault,
    });
    let list = d.id
      ? ssis.map((s) => (s.id === d.id ? next : s))
      : [...ssis, next];
    if (isDefault)
      list = list.map((s) =>
        s.asset === d.asset && s.id !== id ? { ...s, isDefault: false } : s,
      );
    onChange(list);
    setDraft(null);
  };

  const groups = ORDER.map((a) => ({
    asset: a,
    rows: live.filter((s) => s.asset === a),
  })).filter((g) => g.rows.length);

  return (
    <>
      <div
        className="scrim-in fixed inset-0 z-40 bg-[rgb(0_0_0/0.25)]"
        onClick={() => guard("close")}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Settlement accounts"
        className="drawer-in sidebar-scroll fixed top-2 right-2 bottom-2 z-40 flex w-[480px] max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-xl border border-white/8 bg-surface-2 shadow-[0_24px_80px_-12px_rgb(0_0_0/0.45)]"
      >
        <header className="flex items-center justify-between px-5 pt-4">
          {draft ? (
            <button
              type="button"
              onClick={() => guard("back")}
              className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={14} strokeWidth={1.75} /> Settlement accounts
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={() => guard("close")}
            className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </header>

        {asking && (
          <div className="mx-5 mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/12 bg-raised px-3 py-2.5 text-[13px]">
            <span className="text-neutral-200">
              Discard this account? What you&apos;ve entered won&apos;t be
              saved.
            </span>
            <span className="flex shrink-0 gap-1">
              <button
                type="button"
                autoFocus
                onClick={() => setAsking(null)}
                className="h-7 rounded-full bg-white px-3 text-xs font-medium text-black hover:bg-neutral-200"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  const to = asking;
                  setAsking(null);
                  leaveForm();
                  if (to === "close") onClose();
                }}
                className="h-7 rounded-full px-3 text-xs text-rose-400 hover:bg-rose-500/10"
              >
                Discard
              </button>
            </span>
          </div>
        )}
        {draft ? (
          <div
            onInputCapture={() => setTouched(true)}
            onChangeCapture={() => setTouched(true)}
          >
            <SsiForm
              draft={draft}
              onSave={(d) => {
                setTouched(false);
                save(d);
              }}
              onCancel={() => guard("back")}
            />
          </div>
        ) : (
          <div className="px-5 pt-2 pb-8">
            <h2 className="text-[19px] font-medium tracking-[-0.015em] text-white">
              Settlement accounts
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
              Where the desk pays out. Each currency&apos;s default is picked
              for new orders — you can switch it in the ticket.
            </p>
            <button
              type="button"
              onClick={() => setDraft(blank("NGN", false))}
              className="mt-5 flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-black hover:bg-neutral-200"
            >
              <Plus size={14} strokeWidth={2} /> Add account
            </button>

            {groups.map((g) => (
              // Each currency is its own bordered block, so groups read apart at a glance.
              <section
                key={g.asset}
                className="mt-4 overflow-hidden rounded-xl border border-white/10 first-of-type:mt-6"
              >
                <h3 className="flex items-center gap-2.5 border-b border-white/8 bg-white/[0.035] px-4 py-2.5">
                  <AssetMark asset={g.asset} size={18} />
                  <span className="text-[13px] font-medium text-white">
                    {g.asset}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {ASSET_NAME[g.asset]}
                  </span>
                  <span className="ml-auto text-xs text-neutral-500 tabular-nums">
                    {g.rows.length}{" "}
                    {g.rows.length === 1 ? "account" : "accounts"}
                  </span>
                </h3>
                <ul className="divide-y divide-white/6">
                  {g.rows.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      {removing === s.id ? (
                        <div className="flex items-center justify-between gap-3 text-[13px]">
                          <span className="text-neutral-300">
                            Remove {s.label}? Orders already placed keep it.
                          </span>
                          <span className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              onClick={() => setRemoving(null)}
                              className="h-7 rounded-full px-2.5 text-xs text-neutral-400 hover:text-white"
                            >
                              Keep
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(s.id)}
                              className="h-7 rounded-full bg-white px-2.5 text-xs font-medium text-black hover:bg-neutral-200"
                            >
                              Remove
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-[13px] text-white">
                              <span className="truncate">
                                {s.kind === "bank" ? s.provider : s.accountName}
                              </span>
                              {s.isDefault && (
                                <span className="rounded-full border border-white/15 px-1.5 py-px text-[11px] text-neutral-300">
                                  Default
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500">
                              <span className="font-mono">
                                {s.kind === "bank" ? s.number : mask(s.number)}
                              </span>
                              <CopyButton value={s.number} />
                              <span>·</span>
                              <span className="truncate">
                                {s.kind === "bank"
                                  ? `${s.accountName} · ${s.country}`
                                  : s.provider}
                              </span>
                            </div>
                          </div>
                          <RowMenu
                            open={menu === s.id}
                            onOpen={(o) => setMenu(o ? s.id : null)}
                            items={[
                              ...(s.isDefault
                                ? []
                                : [
                                    {
                                      label: "Make default",
                                      run: () => makeDefault(s.id),
                                    },
                                  ]),
                              {
                                label: "Edit",
                                run: () =>
                                  setDraft({
                                    id: s.id,
                                    asset: s.asset,
                                    provider: s.provider,
                                    accountName: s.accountName,
                                    number: s.number,
                                    makeDefault: s.isDefault,
                                  }),
                              },
                              { label: "Remove", run: () => setRemoving(s.id) },
                            ]}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </aside>
    </>
  );
}

function blank(asset: Asset, makeDefault: boolean): Draft {
  return {
    asset,
    provider: isWallet(asset) ? (NETWORKS[asset]?.[0] ?? "") : "",
    accountName: "",
    number: "",
    makeDefault,
  };
}

function SsiForm({
  draft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  onSave: (d: Draft) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState(draft);
  const [touched, setTouched] = useState(false);
  const wallet = isWallet(d.asset);
  const problem = wallet
    ? (addressProblem(d.provider, d.number) ??
      (!d.accountName.trim() ? "Give the wallet a name" : null))
    : !d.provider.trim()
      ? "Add the bank"
      : !/^\d{6,18}$/.test(d.number.trim())
        ? "Account numbers are 6–18 digits"
        : !d.accountName.trim()
          ? "Add the account name"
          : null;

  return (
    <form
      className="px-5 pt-2 pb-8"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!problem) onSave(d);
      }}
    >
      <h2 className="text-[19px] font-medium tracking-[-0.015em] text-white">
        {draft.id ? "Edit settlement account" : "Add a settlement account"}
      </h2>
      <p className="mt-1 text-[13px] text-neutral-500">
        {wallet
          ? "A wallet the desk can send stablecoins to."
          : "A bank account the desk can pay out to."}
      </p>

      <div className="mt-6 space-y-4">
        <Field label="Currency">
          <Dropdown
            label="Currency"
            variant="pill"
            value={d.asset}
            options={ORDER.map((a) => ({
              value: a,
              label: a,
              hint: ASSET_NAME[a],
              icon: <AssetMark asset={a} size={16} />,
            }))}
            onChange={(a: Asset) =>
              setD({
                ...d,
                asset: a,
                provider: isWallet(a) ? (NETWORKS[a]?.[0] ?? "") : "",
                number: "",
              })
            }
          />
        </Field>
        {wallet ? (
          <>
            <Field label="Network">
              <Dropdown
                label="Network"
                variant="pill"
                value={d.provider}
                options={(NETWORKS[d.asset] ?? []).map((n) => ({
                  value: n,
                  label: n,
                }))}
                onChange={(n: string) => setD({ ...d, provider: n })}
              />
            </Field>
            <Field label="Wallet address">
              <Input
                value={d.number}
                onChange={(v) => setD({ ...d, number: v })}
                placeholder="0x… / T…"
                mono
              />
            </Field>
            <Field
              label="Name"
              hint="How it shows in the ticket, e.g. Treasury wallet"
            >
              <Input
                value={d.accountName}
                onChange={(v) => setD({ ...d, accountName: v })}
                placeholder="Payouts wallet"
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Bank">
              <Input
                value={d.provider}
                onChange={(v) => setD({ ...d, provider: v })}
                placeholder="e.g. Providus Bank"
              />
            </Field>
            <Field label="Account number">
              <Input
                value={d.number}
                onChange={(v) => setD({ ...d, number: v.replace(/\D/g, "") })}
                placeholder="0123456789"
                mono
              />
            </Field>
            <Field label="Account name" hint="As the bank has it">
              <Input
                value={d.accountName}
                onChange={(v) => setD({ ...d, accountName: v })}
                placeholder="Kredete Technologies Ltd"
              />
            </Field>
          </>
        )}
        <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-[13px] text-neutral-300">
          <input
            type="checkbox"
            checked={d.makeDefault}
            onChange={(e) => setD({ ...d, makeDefault: e.target.checked })}
            className="size-4 accent-white"
          />
          Use as the default for {d.asset}
        </label>
      </div>

      {touched && problem && (
        <p className="mt-4 text-xs text-rose-400">{problem}</p>
      )}
      <div className="mt-6 flex gap-2">
        <button
          type="submit"
          className="h-9 rounded-full bg-white px-4 text-[13px] font-medium text-black hover:bg-neutral-200"
        >
          {draft.id ? "Save changes" : "Add account"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-full px-3 text-[13px] text-neutral-400 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-neutral-400">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-xs text-neutral-600">{hint}</div>}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-white/35 ${
        mono ? "font-mono text-[13px]" : ""
      }`}
    />
  );
}

function RowMenu({
  open,
  onOpen,
  items,
}: {
  open: boolean;
  onOpen: (o: boolean) => void;
  items: { label: string; run: () => void }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) =>
      !ref.current?.contains(e.target as Node) && onOpen(false);
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [open, onOpen]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="More"
        aria-expanded={open}
        onClick={() => onOpen(!open)}
        className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-white/6 hover:text-white"
      >
        <Ellipsis size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="orbit-pop absolute top-full right-0 z-50 mt-1 min-w-[150px] rounded-xl border border-white/10 bg-raised p-1.5 shadow-[0_20px_50px_-12px_rgb(0_0_0/0.5)]">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              onClick={() => {
                onOpen(false);
                it.run();
              }}
              className={`block w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-white/[0.06] ${
                it.label === "Remove" ? "text-rose-400" : "text-neutral-200"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
