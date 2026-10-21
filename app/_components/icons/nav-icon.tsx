import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { navIconDefs, type NavIconName } from "./nav-icon-data";

export type NavIconSource = NavIconName | IconSvgElement;

/**
 * Two-tone nav icon. Figma-sourced icons (by name) render as filled shapes
 * with "base" and "accent" tones; colours come from `.nav-icon` in globals.css.
 * Anything else falls back to a Hugeicons stroke icon.
 */
export function NavIcon({
  icon,
  size = 18,
  className = "",
}: {
  icon: NavIconSource;
  size?: number;
  className?: string;
}) {
  if (typeof icon !== "string") {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        strokeWidth={1.6}
        className={`nav-icon is-stroke ${className}`}
      />
    );
  }

  const def = navIconDefs[icon];
  const [v, h] = def.inset;
  const x = (28 * h) / 100;
  const y = (28 * v) / 100;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      className={`nav-icon ${className}`}
      aria-hidden
    >
      <svg
        x={x}
        y={y}
        width={28 - 2 * x}
        height={28 - 2 * y}
        viewBox={def.viewBox}
      >
        {def.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            className={p.tone === "base" ? "tone-base" : "tone-accent"}
            fillRule={"evenodd" in p && p.evenodd ? "evenodd" : undefined}
            clipRule={"evenodd" in p && p.evenodd ? "evenodd" : undefined}
          />
        ))}
      </svg>
    </svg>
  );
}
