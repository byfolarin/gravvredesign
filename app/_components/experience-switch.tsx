"use client";

/**
 * Two builds of the prototype side by side: Current (branch `main`) and Review (branch
 * `review`, where new changes go). This switch jumps to the same page in the other one.
 * Each branch sets HERE to itself; the other build's address comes from where we're running.
 */
export const HERE: Experience = "current";

type Experience = "current" | "review";

const ORIGINS: Record<"local" | "live", Record<Experience, string>> = {
  local: {
    current: "http://localhost:4000",
    review: "http://localhost:4001",
  },
  live: {
    current: "https://gravv-web-redesign.vercel.app",
    review: "https://gravv-web-redesign-review.vercel.app",
  },
};

export function ExperienceSwitch() {
  const go = (to: Experience) => {
    if (to === HERE) return;
    const where = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      ? "local"
      : "live";
    window.location.assign(
      ORIGINS[where][to] + location.pathname + location.search + location.hash,
    );
  };
  return (
    <div
      role="tablist"
      aria-label="Experience"
      className="flex items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5"
    >
      {(
        [
          ["current", "Current"],
          ["review", "Review"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={HERE === id}
          onClick={() => go(id)}
          // Ink pill (rounded-[999px] keeps it out of the mint tab rule).
          className={`h-7 rounded-[999px] px-3 text-[12px] transition-colors ${
            HERE === id
              ? "bg-white font-medium text-black"
              : "text-neutral-500 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
