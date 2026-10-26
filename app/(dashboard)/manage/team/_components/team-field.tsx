"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { photoOf } from "@/app/_components/person-avatar";
import { ROLES, reachOf, type Member } from "../../roles/_data";

const DEEP = "#0D1906";
const CREAM = "#FFFCCC";
const ORANGE = "#FF9F43";

const minutesAgo = (m: Member) => {
  if (m.lastActive === "Now") return 0;
  const n = /^(\d+) min ago$/.exec(m.lastActive);
  return n ? Number(n[1]) : Infinity;
};

/**
 * The brand's dot dissolve, loosened: dots on the 8px grid that thicken towards the
 * bottom-right and thin out to nothing, each a little brighter or dimmer — so it reads
 * like light falling on the band, not a printed pattern. Client-only (random floats).
 */
function Dissolve() {
  const [dots, setDots] = useState<{ x: number; y: number; o: number }[]>([]);
  useEffect(() => {
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const out: { x: number; y: number; o: number }[] = [];
    for (let c = 0; c < 150; c++)
      for (let r = 0; r < 30; r++) {
        // 0 at the far left/top, 1 at the bottom-right corner
        const d = Math.min(1, (c / 150) ** 1.6 * 0.8 + (r / 30) * 0.35);
        if (rnd() < d * 0.85)
          out.push({ x: c * 8, y: r * 8, o: 0.04 + d * 0.16 * rnd() });
      }
    const t = setTimeout(() => setDots(out), 0);
    return () => clearTimeout(t);
  }, []);
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 240"
      preserveAspectRatio="xMaxYMax slice"
      className="absolute inset-0 h-full w-full"
    >
      {dots.map((p) => (
        <rect
          key={`${p.x}-${p.y}`}
          x={p.x + 2.75}
          y={p.y + 2.75}
          width={2.5}
          height={2.5}
          fill={CREAM}
          opacity={p.o.toFixed(3)}
        />
      ))}
    </svg>
  );
}

const roleName = (id: string) => ROLES.find((r) => r.id === id)?.name ?? id;
const first = (m: Member) => m.name.split(" ")[0];

/** People in a fact, grouped by role: "Admin  (face) Oluwatobi  (face) Amara". */
function ByRole({
  people,
  detail,
  onOpen,
}: {
  people: Member[];
  detail?: (m: Member) => string;
  onOpen: (name: string) => void;
}) {
  const order = ROLES.map((r) => r.id);
  const roles = [...new Set(people.map((m) => m.role))].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  return (
    <div className="mt-5 grid gap-2.5">
      {roles.map((r) => {
        const here = people.filter((m) => m.role === r);
        return (
          <div key={r} className="flex items-center gap-3">
            <span
              className="w-[92px] shrink-0 truncate text-[12px] leading-5"
              style={{ color: "rgb(255 252 204 / 0.5)" }}
            >
              {here.length} {roleName(r)}
              {here.length > 1 && !roleName(r).endsWith("s") ? "s" : ""}
            </span>
            <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1.5">
              {here.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => onOpen(m.name)}
                  className="flex items-center gap-1.5 text-[12.5px] font-medium underline-offset-4 hover:underline"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote placeholder portraits */}
                  <img
                    src={photoOf(m.name)}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 rounded-full object-cover"
                  />
                  {first(m)}
                  {detail && (
                    <span
                      className="font-normal"
                      style={{ color: "rgb(255 252 204 / 0.5)" }}
                    >
                      {detail(m)}
                    </span>
                  )}
                </button>
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * What needs looking at on the team, over the Gravv green: deep ground, light rising from
 * the base, the dot dissolve. Three facts only — each a count, the people in it grouped by
 * role, and the way to fix it. A fact goes away when there's nothing in it.
 */
export function TeamField({
  members,
  onRemind,
  onOpen,
}: {
  members: Member[];
  onRemind: () => void;
  onOpen: (name: string) => void;
}) {
  const router = useRouter();
  const capOf = (m: Member) => {
    const role = ROLES.find((r) => r.id === m.role);
    return role ? reachOf(role).sendCap : undefined;
  };
  const noTwoStep = members.filter((m) => !m.twoFactor);
  const unlimited = members.filter((m) => capOf(m) === null);
  const quiet = members.filter(
    (m) => minutesAgo(m) === Infinity && /days ago|week/.test(m.lastActive),
  );

  const facts = [
    {
      label: "Signing in without two-step",
      people: noTwoStep,
      warn: true,
      action: "Send a reminder",
      run: onRemind,
    },
    {
      label: "Can send any amount",
      people: unlimited,
      action: "Review roles",
      run: () => router.push("/manage/roles"),
    },
    {
      label: "Not in for 3+ days",
      people: quiet,
      detail: (m: Member) => m.lastActive.replace(" ago", "").toLowerCase(),
      action: "Review access",
      run: () => onOpen(quiet.at(-1)!.name),
    },
  ].filter((f) => f.people.length);

  if (!facts.length) return null;
  return (
    <section
      className="relative isolate mt-8 overflow-hidden rounded-2xl"
      style={{ background: DEEP, color: CREAM }}
    >
      {/* Light rising from the base */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 90% at 75% 125%, rgb(143 255 75 / 0.26), rgb(52 109 17 / 0.26) 45%, transparent 75%)",
        }}
      />
      <Dissolve />

      <div
        className="relative grid px-8 py-7"
        style={{
          gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))`,
        }}
      >
        {facts.map((f, i) => (
          <div
            key={f.label}
            className={`flex min-w-0 flex-col pr-6 ${i ? "border-l pl-6" : ""}`}
            style={{ borderColor: "rgb(255 252 204 / 0.1)" }}
          >
            <div
              className="text-[12.5px]"
              style={{ color: "rgb(255 252 204 / 0.55)" }}
            >
              {f.label}
            </div>
            <div
              className="mt-1.5 text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums"
              style={f.warn ? { color: ORANGE } : undefined}
            >
              {f.people.length}
            </div>
            <ByRole people={f.people} detail={f.detail} onOpen={onOpen} />
            <button
              type="button"
              onClick={f.run}
              className="mt-auto self-start pt-5 text-[12.5px] font-medium underline-offset-4 hover:underline"
            >
              {f.action} →
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
