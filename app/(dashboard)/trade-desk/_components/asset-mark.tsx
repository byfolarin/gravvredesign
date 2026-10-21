import type { Asset } from "../_data";

const FLAG: Partial<Record<Asset, string>> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  NGN: "🇳🇬",
  KES: "🇰🇪",
  GHS: "🇬🇭",
};

/**
 * Flag for fiat (emoji, no background — same as Accounts), brand mark for stablecoins:
 * USDC's blue coin and Tether's green coin.
 */
export function AssetMark({
  asset,
  size = 16,
}: {
  asset: Asset;
  size?: number;
}) {
  if (asset === "USDC")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="16" cy="16" r="16" fill="#2775CA" />
        <path
          d="M12.2 25.6A10.2 10.2 0 0 1 12.2 6.4"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M19.8 6.4a10.2 10.2 0 0 1 0 19.2"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M19.4 18.4c0-1.9-1.1-2.5-3.4-2.8-1.6-.2-1.9-.7-1.9-1.4s.6-1.3 1.7-1.3c1 0 1.6.4 1.9 1.2.1.2.2.2.4.2h.9c.2 0 .4-.2.4-.4-.3-1.2-1.2-2.1-2.5-2.3V10.4c0-.2-.2-.4-.5-.4h-.8c-.2 0-.4.2-.4.5v1.1c-1.7.3-2.8 1.4-2.8 2.8 0 1.8 1.1 2.5 3.4 2.8 1.5.3 2 .6 2 1.5s-.8 1.5-1.9 1.5c-1.5 0-2-.6-2.2-1.4-.1-.2-.2-.3-.4-.3h-1c-.2 0-.4.2-.4.4.2 1.4 1.1 2.3 2.9 2.6v1.2c0 .2.2.4.5.4h.8c.2 0 .4-.2.4-.5v-1.2c1.8-.3 2.9-1.4 2.9-3z"
          fill="#fff"
        />
      </svg>
    );
  if (asset === "USDT")
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="16" cy="16" r="16" fill="#26A17B" />
        <path
          d="M17.9 17.2v0c-.1 0-.7.1-1.9.1-1 0-1.7 0-1.9-.1v0c-3.7-.2-6.4-.8-6.4-1.6s2.7-1.4 6.4-1.6v2.5c.2 0 .9.1 1.9.1 1.2 0 1.8-.1 1.9-.1V14c3.7.2 6.4.8 6.4 1.6s-2.7 1.4-6.4 1.6m0-3.4v-2.2h5.2V8.1H8.9v3.5h5.2v2.2c-4.2.2-7.4 1-7.4 2s3.2 1.8 7.4 2v7.2h3.8v-7.2c4.2-.2 7.3-1 7.3-2s-3.1-1.8-7.3-2"
          fill="#fff"
        />
      </svg>
    );
  // Flags are cropped to a circle so they sit with the round coin marks.
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none"
      style={{ width: size, height: size }}
    >
      <span style={{ fontSize: size * 1.42, lineHeight: 1 }}>
        {FLAG[asset]}
      </span>
    </span>
  );
}

/** Two marks overlapped: what you sell, then what you get. */
export function PairMark({
  sell,
  get,
  size = 18,
}: {
  sell: Asset;
  get: Asset;
  size?: number;
}) {
  return (
    <span
      className="relative flex shrink-0 items-center"
      style={{ width: size * 1.6, height: size }}
      aria-hidden
    >
      <span className="absolute left-0">
        <AssetMark asset={sell} size={size} />
      </span>
      <span
        className="absolute rounded-full ring-2 ring-[var(--surface)]"
        style={{ left: size * 0.6 }}
      >
        <AssetMark asset={get} size={size} />
      </span>
    </span>
  );
}
