"use client";

import { useEffect, useState } from "react";
import type { Member } from "../../roles/_data";

const DEEP = "#0D1906";
const CREAM = "#FFFCCC";
const LIME = "#8FFF4B";
const ORANGE = "#FF9F43";

const ROLE_ORDER: [string, string][] = [
  ["owner", "OWNER"],
  ["admin", "ADMIN"],
  ["finance", "FINANCE"],
  ["operations", "OPS"],
  ["developer", "DEV"],
  ["support", "SUPPORT"],
  ["viewer", "VIEWER"],
];

/** Signed in within the last half hour. */
const activeNow = (m: Member) => {
  if (m.lastActive === "Now") return true;
  const n = /^(\d+) min ago$/.exec(m.lastActive);
  return !!n && Number(n[1]) <= 30;
};

/** The faint dot field behind everything (brand 06): square dots on the grid, flat cream. */
function DotGrid() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ready) return null;
  const cells = [];
  for (let c = 0; c < 140; c++)
    for (let r = 0; r < 28; r++)
      cells.push(
        <rect
          key={`${c}-${r}`}
          x={c * 8 + 2.7}
          y={r * 8 + 2.7}
          width={2.6}
          height={2.6}
          fill={CREAM}
        />,
      );
  return (
    <svg
      aria-hidden
      viewBox="0 0 1120 224"
      preserveAspectRatio="xMinYMid slice"
      className="absolute inset-0 h-full w-full opacity-[0.07]"
    >
      {cells}
    </svg>
  );
}

/**
 * The team as a dot formation, in the Gravv brand: forest green, horizon light from the
 * base, the faint dot field, one dot per person stacked by role — lime if they're signed
 * in right now, orange if two-step is off — and one glass data card saying what's live.
 */
export function TeamField({ members }: { members: Member[] }) {
  const live = members.filter(activeNow);
  const noTwoStep = members.filter((m) => !m.twoFactor);
  const names = live.map((m) => m.name.split(" ")[0]);
  return (
    <section
      className="relative isolate mt-8 overflow-hidden rounded-2xl"
      style={{ background: DEEP, color: CREAM }}
    >
      {/* Horizon: darker at the top, brighter at the base (brand 04.10) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 70% at 70% 125%, rgb(143 255 75 / 0.38), rgb(52 109 17 / 0.35) 40%, transparent 70%)",
        }}
      />
      {/* Edge light along the top */}
      <div
        aria-hidden
        className="absolute inset-x-[10%] top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${LIME}, transparent)`,
        }}
      />
      <DotGrid />

      <div className="relative flex min-h-[224px] items-stretch gap-10 px-7 py-6">
        {/* What's live */}
        <div className="flex w-[300px] shrink-0 flex-col justify-between">
          <div
            className="font-mono text-[10.5px] tracking-[0.12em]"
            style={{ opacity: 0.6 }}
          >
            GRAVV · TEAM
          </div>
          <div
            className="mt-6 border px-4 py-3.5 backdrop-blur-sm"
            style={{
              background: "rgb(255 252 204 / 0.07)",
              borderColor: "rgb(255 252 204 / 0.2)",
            }}
          >
            <span
              className="inline-block px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.08em]"
              style={{ background: LIME, color: DEEP }}
            >
              LIVE
            </span>
            <div className="mt-2 text-[17px] leading-tight font-medium">
              {live.length} signed in right now
            </div>
            <div className="mt-1 truncate text-[12px]" style={{ opacity: 0.6 }}>
              {names.slice(0, 3).join(", ")}
              {names.length > 3 && ` and ${names.length - 3} more`}
            </div>
          </div>
        </div>

        {/* The formation: one dot per person, stacked by role */}
        <div className="flex min-w-0 flex-1 items-end justify-end gap-7 pb-1">
          {ROLE_ORDER.map(([id, label]) => {
            const people = members.filter((m) => m.role === id);
            if (!people.length) return null;
            return (
              <div key={id} className="flex flex-col items-center gap-3">
                <div className="flex flex-col-reverse gap-[5px]">
                  {people.map((m) => {
                    const on = activeNow(m);
                    return (
                      <span
                        key={m.name}
                        title={`${m.name} · ${m.lastActive}${m.twoFactor ? "" : " · two-step off"}`}
                        className="block size-[14px]"
                        style={{
                          background: on
                            ? LIME
                            : m.twoFactor
                              ? "rgb(255 252 204 / 0.5)"
                              : "transparent",
                          outline: m.twoFactor
                            ? undefined
                            : `1.5px solid ${ORANGE}`,
                          outlineOffset: -1.5,
                          boxShadow: on ? `0 0 14px ${LIME}aa` : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                <span
                  className="font-mono text-[9.5px] tracking-[0.1em]"
                  style={{ opacity: 0.55 }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Key */}
        <div
          className="flex w-[150px] shrink-0 flex-col justify-end gap-2 font-mono text-[10px] tracking-[0.06em]"
          style={{ opacity: 0.75 }}
        >
          <span className="flex items-center gap-2">
            <span className="size-[9px]" style={{ background: LIME }} /> SIGNED
            IN NOW
          </span>
          <span className="flex items-center gap-2">
            <span
              className="size-[9px]"
              style={{ background: "rgb(255 252 204 / 0.5)" }}
            />{" "}
            {members.length} PEOPLE
          </span>
          <span className="flex items-center gap-2">
            <span
              className="size-[9px]"
              style={{ outline: `1.5px solid ${ORANGE}`, outlineOffset: -1.5 }}
            />{" "}
            {noTwoStep.length} WITHOUT TWO-STEP
          </span>
        </div>
      </div>
    </section>
  );
}
