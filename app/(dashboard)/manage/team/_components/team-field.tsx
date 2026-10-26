"use client";

import { useEffect, useState } from "react";
import { photoOf } from "@/app/_components/person-avatar";
import { ROLES, reachOf, type Invite, type Member } from "../../roles/_data";

const DEEP = "#0D1906";
const CREAM = "#FFFCCC";
const LIME = "#8FFF4B";
const ORANGE = "#FF9F43";

const WORDS = [
  "No one",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];
const word = (n: number) => WORDS[n] ?? String(n);
const list = (names: string[]) =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

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

function Face({
  m,
  size,
  live,
  z,
}: {
  m: Member;
  size: number;
  live?: boolean;
  z: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote placeholder portraits
    <img
      src={photoOf(m.name)}
      alt={m.name}
      title={`${m.name} · ${m.lastActive === "Now" ? "here now" : m.lastActive}`}
      width={size}
      height={size}
      className="relative shrink-0 rounded-full object-cover transition-transform duration-300 hover:z-20 hover:-translate-y-1"
      style={{
        width: size,
        height: size,
        zIndex: z,
        boxShadow: live
          ? `0 0 0 2px ${DEEP}, 0 0 0 3.5px ${LIME}, 0 8px 28px rgb(143 255 75 / 0.25)`
          : `0 0 0 2px ${DEEP}`,
        filter: live ? undefined : "grayscale(1) brightness(0.8)",
        opacity: live ? 1 : 0.55,
      }}
    />
  );
}

/**
 * Who's in, told as a sentence over the Gravv green: the brand's deep ground, light rising
 * from where the people are, the dot dissolve, and the faces themselves — lime-ringed if
 * they're here in the last half hour, the rest of the team quieter behind them.
 */
export function TeamField({
  members,
  invites,
  onInvites,
}: {
  members: Member[];
  invites: Invite[];
  onInvites: () => void;
}) {
  const sorted = [...members].sort((a, b) => minutesAgo(a) - minutesAgo(b));
  const live = sorted.filter((m) => minutesAgo(m) <= 30);
  const rest = sorted.filter((m) => minutesAgo(m) > 30);
  const first = (m: Member) => m.name.split(" ")[0];
  const now = live.filter((m) => minutesAgo(m) === 0).map(first);
  const recent = live.filter((m) => minutesAgo(m) > 0).map(first);

  const capOf = (m: Member) => {
    const role = ROLES.find((r) => r.id === m.role);
    return role ? reachOf(role).sendCap : undefined;
  };
  const senders = members.filter((m) => capOf(m) !== undefined);
  const unlimited = senders.filter((m) => capOf(m) === null).length;
  const admins = members.filter(
    (m) => m.role === "owner" || m.role === "admin",
  ).length;
  const noTwoStep = members.filter((m) => !m.twoFactor).map(first);
  const soonest = invites.find((i) => i.expires === "tomorrow") ?? invites[0];
  const inviteeOf = (i: Invite) => {
    const n = i.email.split("@")[0].split(".")[0];
    return n[0].toUpperCase() + n.slice(1);
  };

  return (
    <section
      className="relative isolate mt-8 overflow-hidden rounded-2xl"
      style={{ background: DEEP, color: CREAM }}
    >
      {/* Light rising from under the faces, brighter at the base */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 90% at 78% 120%, rgb(143 255 75 / 0.30), rgb(52 109 17 / 0.28) 45%, transparent 75%)",
        }}
      />
      <Dissolve />

      {/* The team in numbers, split by faint cream hairlines */}
      <div className="relative grid grid-cols-4 px-8 pt-7">
        {(
          [
            [
              "Members",
              members.length,
              `${new Set(members.map((m) => m.role)).size} roles · ${admins} admins`,
            ],
            ["Can send money", senders.length, `${unlimited} with no limit`],
            [
              "Two-step login",
              <>
                {members.length - noTwoStep.length}
                <span
                  className="text-[14px]"
                  style={{ color: "rgb(255 252 204 / 0.45)" }}
                >
                  {" "}
                  of {members.length}
                </span>
              </>,
              noTwoStep.length ? (
                <span style={{ color: ORANGE }}>Off for {list(noTwoStep)}</span>
              ) : (
                "On for everyone"
              ),
            ],
            [
              "Invites waiting",
              invites.length,
              soonest
                ? `${inviteeOf(soonest)}'s expires ${soonest.expires}`
                : "None out",
            ],
          ] as const
        ).map(([label, figure, note], i) => {
          const Tag = i === 3 && invites.length ? "button" : "div";
          return (
            <Tag
              key={label}
              {...(Tag === "button"
                ? { type: "button" as const, onClick: onInvites }
                : {})}
              className={`group min-w-0 text-left ${i ? "border-l pl-6" : ""} pr-6`}
              style={{ borderColor: "rgb(255 252 204 / 0.1)" }}
            >
              <div
                className="text-[12.5px]"
                style={{ color: "rgb(255 252 204 / 0.55)" }}
              >
                {label}
              </div>
              <div className="mt-1.5 text-[24px] leading-none font-medium tracking-[-0.02em] tabular-nums">
                {figure}
              </div>
              <div
                className={`mt-2 truncate text-[12px] ${Tag === "button" ? "group-hover:underline" : ""}`}
                style={{ color: "rgb(255 252 204 / 0.55)" }}
              >
                {note}
              </div>
            </Tag>
          );
        })}
      </div>

      <div className="relative flex items-end justify-between gap-10 px-8 pt-10 pb-8">
        <div className="max-w-[420px]">
          <h2 className="text-[26px] leading-[1.15] font-medium tracking-[-0.02em]">
            {word(live.length)} of you are in right now.
          </h2>
          <p
            className="mt-3 text-[13.5px] leading-relaxed"
            style={{ color: "rgb(255 252 204 / 0.68)" }}
          >
            {now.length > 0 && (
              <>
                {list(now)} {now.length > 1 ? "are" : "is"} here now
              </>
            )}
            {now.length > 0 && recent.length > 0 && ", and "}
            {recent.length > 0 && (
              <>
                {list(recent)} {now.length ? "" : "were "}in the last half hour
              </>
            )}
            . The other {word(rest.length).toLowerCase()} are away.
          </p>
        </div>

        <div className="flex shrink-0 items-end gap-6">
          <div className="flex items-center">
            {live.map((m, i) => (
              <span key={m.name} className={i ? "-ml-2.5" : ""}>
                <Face m={m} size={52} live z={live.length - i} />
              </span>
            ))}
          </div>
          <div className="pb-1">
            <div className="flex items-center">
              {rest.slice(0, 6).map((m, i) => (
                <span key={m.name} className={i ? "-ml-2" : ""}>
                  <Face m={m} size={26} z={6 - i} />
                </span>
              ))}
            </div>
            <div
              className="mt-2 text-[12px]"
              style={{ color: "rgb(255 252 204 / 0.5)" }}
            >
              Away
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
