"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A pre-formatted number whose digits roll like an odometer — up from zero when it
 * first appears, and to the new value whenever it changes (filters, periods, tabs).
 * Non-digits (signs, commas, dots) stay put. Keyed from the right, so a value that
 * gains a digit slides the existing ones along instead of re-rolling everything.
 */
export function Roll({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const [shown, setShown] = useState<string | null>(null);

  // Pages stay alive in the background between navigations (Next.js Activity), so
  // drop back to zeros whenever this one is hidden — it rolls up again on every visit.
  useLayoutEffect(() => () => setShown(null), []);

  // Start from zeros, then roll to the value on the next tick (and on every change).
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 30);
    return () => clearTimeout(t);
  }, [value]);

  const chars = [...(shown ?? value.replace(/\d/g, "0"))];
  return (
    // Plain inline (not flex), so columns sit on the text baseline and are never stretched.
    <span
      className={`relative inline-block whitespace-nowrap tabular-nums ${className}`}
    >
      <span className="sr-only">{value}</span>
      {chars.map((c, i) => {
        const pos = chars.length - 1 - i;
        return /\d/.test(c) ? (
          <Digit key={`d${pos}`} d={Number(c)} delay={pos * 35} />
        ) : (
          <span key={`c${pos}${c}`} aria-hidden>
            {c}
          </span>
        );
      })}
    </span>
  );
}

function Digit({ d, delay }: { d: number; delay: number }) {
  return (
    // clip-path (not overflow) keeps the column on the text baseline.
    <span
      aria-hidden
      className="relative inline-block"
      // Own line height: <sub> sets line-height 0, which would collapse the column.
      style={{ clipPath: "inset(0 -0.15em)", lineHeight: 1.1 }}
    >
      {/* Invisible digit sizes the column to one character */}
      <span className="invisible">0</span>
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={{
          transform: `translateY(${-d * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {DIGITS.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </span>
    </span>
  );
}
