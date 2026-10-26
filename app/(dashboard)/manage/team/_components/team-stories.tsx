"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Pause, Play, X } from "lucide-react";
import { PersonAvatar } from "@/app/_components/person-avatar";

type Kind =
  | "approved"
  | "sent"
  | "received"
  | "opened"
  | "invited"
  | "role"
  | "key"
  | "dispute"
  | "card";

export type Story = {
  kind: Kind;
  /** What they did, as a sentence. */
  line: string;
  /** The figure the story is about, if any. */
  figure?: string;
  detail: string;
  /** Minutes ago. */
  mins: number;
  href: string;
};

const KIND: Record<Kind, string> = {
  approved: "APPROVED",
  sent: "SENT",
  received: "MONEY IN",
  opened: "NEW ACCOUNT",
  invited: "INVITED",
  role: "ACCESS",
  key: "API KEY",
  dispute: "DISPUTE",
  card: "CARDS",
};

/** The last 24 hours of the team, one reel per person — newest first. */
export const STORIES: { name: string; role: string; stories: Story[] }[] = [
  {
    name: "Tolu Adeyemi",
    role: "Finance",
    stories: [
      {
        kind: "sent",
        line: "Sent the October supplier run",
        figure: "$72,500",
        detail: "Meridian Trade Co · wire · lands today before 4pm ET",
        mins: 38,
        href: "/transactions",
      },
      {
        kind: "approved",
        line: "Approved 3 payouts",
        figure: "$18,240",
        detail: "Atlas Relief Foundation, Brightpath Studio, Oakridge Supply",
        mins: 95,
        href: "/manage/approvals",
      },
    ],
  },
  {
    name: "Chioma Eze",
    role: "Finance",
    stories: [
      {
        kind: "approved",
        line: "Signed off the OTC order",
        figure: "$620,000",
        detail: "USDC → NGN at ₦1,611.87 · OTC-2292",
        mins: 52,
        href: "/trade-desk",
      },
      {
        kind: "dispute",
        line: "Answered a Visa dispute",
        figure: "$12.35",
        detail: "Fraud — card not present · 3-D Secure evidence attached",
        mins: 180,
        href: "/card-collection/disputes",
      },
      {
        kind: "card",
        line: "Raised Liam Wilson's card limit",
        figure: "$10k → $15k",
        detail: "Monthly · ad spend for the November launch",
        mins: 260,
        href: "/cards",
      },
    ],
  },
  {
    name: "Musa Bello",
    role: "Operations",
    stories: [
      {
        kind: "opened",
        line: "Opened a EUR account",
        figure: "EUR",
        detail: "Banking Circle · for Lumen Labs Inc · ready in 1–2 days",
        mins: 20,
        href: "/account",
      },
      {
        kind: "received",
        line: "Matched a deposit from Kora Foods",
        figure: "₦9,400,000",
        detail: "Access Bank → Lagos collections",
        mins: 140,
        href: "/transactions",
      },
    ],
  },
  {
    name: "Kwame Asante",
    role: "Developer",
    stories: [
      {
        kind: "key",
        line: "Rolled the Payouts service key",
        figure: "••3c07",
        detail: "Old secret keeps working until tomorrow 10:00",
        mins: 60,
        href: "/manage/configure",
      },
    ],
  },
  {
    name: "Amara Nwosu",
    role: "Admin",
    stories: [
      {
        kind: "invited",
        line: "Invited two people to Finance",
        figure: "2",
        detail: "ada@kredete.com and seun@kredete.com · waiting to accept",
        mins: 75,
        href: "/manage/team",
      },
      {
        kind: "role",
        line: "Turned on two-step for Grace Mensah",
        figure: "On",
        detail: "Required at the next sign-in",
        mins: 300,
        href: "/manage/team",
      },
    ],
  },
  {
    name: "Femi Okonkwo",
    role: "Support",
    stories: [
      {
        kind: "received",
        line: "Resent a payment link to Sofia Alvarez",
        figure: "$150",
        detail: "Lagos Fintech Week · Early bird · paid 4 min later",
        mins: 5,
        href: "/payment-links",
      },
    ],
  },
  {
    name: "Priya Nair",
    role: "Operations",
    stories: [
      {
        kind: "sent",
        line: "Paid Brightpath Studio",
        figure: "$6,800",
        detail: "Over her $5,000 limit — sent after approval",
        mins: 210,
        href: "/transactions",
      },
    ],
  },
];

const SEEN_KEY = "gravv-team-stories-seen";
const DURATION = 5000;

const ago = (m: number) =>
  m < 60
    ? `${m}m`
    : m < 1440
      ? `${Math.round(m / 60)}h`
      : `${Math.round(m / 1440)}d`;

function useSeen() {
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
        if (Array.isArray(v)) setSeen(new Set(v));
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const mark = (name: string) =>
    setSeen((s) => {
      const next = new Set([...s, name]);
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  return { seen, mark };
}

/**
 * Team stories, the Instagram pattern for a finance team: a row of faces, a lime ring on
 * anyone with something new in the last 24 hours. Tap one and their day plays as short
 * cards — what they did, the figure, where it happened — then rolls on to the next person.
 */
export function TeamStories() {
  const { seen, mark } = useSeen();
  const [open, setOpen] = useState<number | null>(null);
  // Unseen first, newest first — like the real thing.
  const order = [...STORIES].sort(
    (a, b) =>
      Number(seen.has(a.name)) - Number(seen.has(b.name)) ||
      a.stories[0].mins - b.stories[0].mins,
  );
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] text-neutral-500">Today on the team</h2>
        <span className="text-[12px] text-neutral-500">Last 24 hours</span>
      </div>
      <div className="sidebar-scroll mt-3 flex gap-5 overflow-x-auto pb-1">
        {order.map((p, i) => {
          const fresh = !seen.has(p.name);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => setOpen(i)}
              className="group flex w-[72px] shrink-0 flex-col items-center gap-2"
            >
              <span
                className={`rounded-full p-[2.5px] transition-transform group-hover:scale-[1.04] ${fresh ? "bg-[conic-gradient(from_200deg,#8FFF4B,#0fb468,#A3FF6E,#8FFF4B)]" : "bg-white/15"}`}
              >
                <span className="block rounded-full bg-surface p-[2.5px]">
                  <PersonAvatar name={p.name} size={54} />
                </span>
              </span>
              <span
                className={`w-full truncate text-center text-[12px] ${fresh ? "text-white" : "text-neutral-500"}`}
              >
                {p.name.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
      {open !== null && (
        <StoryViewer
          people={order}
          start={open}
          onSeen={mark}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function StoryViewer({
  people,
  start,
  onSeen,
  onClose,
}: {
  people: typeof STORIES;
  start: number;
  onSeen: (name: string) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(start);
  const [s, setS] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const last = useRef(0);
  const person = people[p];
  const story = person.stories[s];

  const next = useCallback(() => {
    setProgress(0);
    if (s < person.stories.length - 1) setS(s + 1);
    else if (p < people.length - 1) {
      setP(p + 1);
      setS(0);
    } else onClose();
  }, [s, p, person.stories.length, people.length, onClose]);
  const prev = () => {
    setProgress(0);
    if (s > 0) setS(s - 1);
    else if (p > 0) {
      setP(p - 1);
      setS(people[p - 1].stories.length - 1);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => onSeen(person.name), 0);
    return () => clearTimeout(t);
  }, [person.name, onSeen]);

  // The clock: fills the current bar, then moves on.
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = now - last.current;
      last.current = now;
      setProgress((x) => {
        const v = x + dt / DURATION;
        return v >= 1 ? 1 : v;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, p, s]);
  useEffect(() => {
    if (progress < 1) return;
    const t = setTimeout(next, 0);
    return () => clearTimeout(t);
  }, [progress, next]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((x) => !x);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(0_0_0/0.88)]">
      <button
        type="button"
        aria-label="Close stories"
        onClick={onClose}
        className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full text-[#FFFCCC]/70 hover:bg-[#FFFCCC]/10 hover:text-[#FFFCCC]"
      >
        <X size={20} strokeWidth={1.75} />
      </button>

      <div
        className="orbit-pop relative flex aspect-[9/16] h-[min(720px,88vh)] flex-col overflow-hidden rounded-2xl bg-[#0D1906] text-[#FFFCCC] select-none"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
      >
        {/* Soft lime light from the base, the brand's gradient direction */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 60% at 50% 115%, rgb(143 255 75 / 0.32), transparent 60%), radial-gradient(80% 40% at 100% 0%, rgb(163 255 110 / 0.08), transparent 70%)",
          }}
        />

        {/* Progress — one bar per story */}
        <div className="relative z-10 flex gap-1 px-3 pt-3">
          {person.stories.map((_, i) => (
            <span
              key={i}
              className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-[#FFFCCC]/25"
            >
              <span
                className="block h-full rounded-full bg-[#FFFCCC]"
                style={{
                  width: `${i < s ? 100 : i === s ? progress * 100 : 0}%`,
                }}
              />
            </span>
          ))}
        </div>

        {/* Who */}
        <div className="relative z-10 flex items-center gap-2.5 px-4 pt-3">
          <PersonAvatar name={person.name} size={32} />
          <div className="min-w-0 flex-1 text-[13px] leading-tight">
            <div className="font-medium">{person.name}</div>
            <div className="text-[#FFFCCC]/55">
              {person.role} · {ago(story.mins)}
            </div>
          </div>
          <button
            type="button"
            aria-label={paused ? "Play" : "Pause"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setPaused((x) => !x)}
            className="flex size-8 items-center justify-center rounded-full text-[#FFFCCC]/70 hover:bg-[#FFFCCC]/10"
          >
            {paused ? (
              <Play size={15} strokeWidth={1.75} />
            ) : (
              <Pause size={15} strokeWidth={1.75} />
            )}
          </button>
        </div>

        {/* What */}
        <div
          key={`${p}-${s}`}
          className="pointer-events-none relative z-10 flex flex-1 flex-col justify-end px-6 pb-6"
        >
          <div className="story-in font-mono text-[11px] tracking-[0.12em] text-[#8FFF4B]">
            {KIND[story.kind]}
          </div>
          {story.figure && (
            <div className="story-in amount mt-3 text-[52px] leading-[0.95] font-medium tracking-[-0.04em] [animation-delay:60ms]">
              {story.figure}
            </div>
          )}
          <div className="story-in mt-4 text-[20px] leading-snug font-medium [animation-delay:120ms]">
            {story.line}
          </div>
          <p className="story-in mt-2 text-[13.5px] leading-relaxed text-[#FFFCCC]/65 [animation-delay:180ms]">
            {story.detail}
          </p>
          <Link
            href={story.href}
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            className="story-in pointer-events-auto mt-6 inline-flex h-10 items-center justify-center gap-1.5 self-start rounded-full bg-[#8FFF4B] px-5 text-[13px] font-medium text-[#0B1605] hover:bg-[#A3FF6E] [animation-delay:240ms]"
          >
            Open it
            <ArrowUpRight size={14} strokeWidth={2} />
          </Link>
        </div>

        {/* Tap zones: left goes back, right goes on */}
        <button
          type="button"
          aria-label="Previous"
          onClick={prev}
          className="absolute top-20 bottom-0 left-0 z-[5] w-1/3"
        />
        <button
          type="button"
          aria-label="Next"
          onClick={next}
          className="absolute top-20 right-0 bottom-0 z-[5] w-2/3"
        />
      </div>

      <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[12px] text-[#FFFCCC]/40">
        Tap the sides or use ← → · hold to pause · Esc to close
      </p>
    </div>
  );
}
