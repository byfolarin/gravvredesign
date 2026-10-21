/**
 * Teammates, wherever their name appears. Most have a photo (randomuser.me placeholder set,
 * same source as Cards and Recipients); a few stay as initials, the way real teams look.
 */
const PHOTOS: Record<string, string> = {
  "Oluwatobi Bello": "men/75",
  "Amara Nwosu": "women/68",
  "Tolu Adeyemi": "men/86",
  "Grace Mensah": "women/90",
  "Ikenna Obi": "men/22",
  "Musa Bello": "men/41",
  "Priya Nair": "women/26",
  "Daniel Okafor": "men/62",
  "Kwame Asante": "men/94",
  "Sarah Chen": "women/17",
  "Lena Fischer": "women/33",
  "Femi Okonkwo": "men/18",
  "Hannah Kim": "women/57",
};

export const photoOf = (name: string) =>
  PHOTOS[name]
    ? `https://randomuser.me/api/portraits/${PHOTOS[name]}.jpg`
    : undefined;

const initials = (name: string) =>
  name
    .split(/[\s.@]/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join("");

/**
 * Overlapping faces, left to right: each circle sits on top of the one before it, so the
 * "+n" at the end is always on top. Fills are solid so nothing shows through the overlap.
 */
export function AvatarStack({
  names,
  size = 28,
  max = 3,
}: {
  names: string[];
  size?: number;
  max?: number;
}) {
  const extra = names.length - max;
  return (
    <span className="isolate flex shrink-0 items-center">
      {names.slice(0, max).map((n, i) => (
        <span
          key={n}
          className={`relative flex ${i ? "-ml-2" : ""}`}
          style={{ zIndex: i + 1 }}
        >
          <PersonAvatar name={n} size={size} ring />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="relative -ml-2 flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-medium text-neutral-300 ring-2 ring-[var(--surface)] tabular-nums"
          style={{
            zIndex: max + 1,
            width: size,
            height: size,
            fontSize: Math.max(9, size * 0.34),
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

export function PersonAvatar({
  name,
  size = 32,
  ring,
  className = "",
}: {
  name: string;
  size?: number;
  /** A surface-coloured ring, for avatars that overlap in a stack. */
  ring?: boolean;
  className?: string;
}) {
  const photo = photoOf(name);
  const edge = ring ? "ring-2 ring-[var(--surface)]" : "";
  if (photo)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote placeholder portraits
      <img
        src={photo}
        alt=""
        title={name}
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 rounded-full bg-neutral-800 object-cover ${edge} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      aria-hidden
      title={name}
      // A quiet fill and lighter letters, so initials carry the same visual weight as a photo.
      className={`flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-medium tracking-[0.04em] text-neutral-300 ${edge} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(8.5, size * 0.3) }}
    >
      {initials(name)}
    </span>
  );
}
