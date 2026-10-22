import { Roll } from "@/app/_components/roll";

/** Currency with de-emphasised superscript cents: $1,240.⁰⁰ */
/** `roll` animates the digits (headline figures only, not table rows). */
export function Money({
  value,
  className = "",
  roll = false,
}: {
  value: number;
  className?: string;
  roll?: boolean;
}) {
  const [whole, cents] = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  })
    .format(value)
    .split(".");
  return (
    <span className={`tabular-nums ${className}`}>
      {roll ? <Roll value={whole} /> : whole}
      <sub className="ml-px align-baseline text-[0.55em] font-normal opacity-60">
        {roll ? <Roll value={cents} /> : cents}
      </sub>
    </span>
  );
}
