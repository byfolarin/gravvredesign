import type { Recipient } from "../_data";

const initials = (name: string) =>
  name
    .split(" ")
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/** Businesses get a rounded square, people a circle — tells them apart without another column. */
export function RecipientAvatar({ recipient, size = 32 }: { recipient: Recipient; size?: number }) {
  const business = recipient.kind === "Business";
  const shape = business ? (size >= 44 ? "rounded-xl" : "rounded-lg") : "rounded-full";
  if (recipient.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote placeholder images
      <img
        src={recipient.image}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        // Placeholder logos are greyscale so they don't fight the monochrome UI.
        className={`shrink-0 border border-white/10 object-cover ${shape} ${business ? "bg-white/6 grayscale" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center border border-white/10 bg-white/6 font-semibold text-neutral-200 ${shape}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials(recipient.name)}
    </span>
  );
}
