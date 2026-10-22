import type { ReactNode } from "react";
import type { Asset } from "../_data";

/** Round flags drawn as SVG (emoji flags render differently per OS and crop badly). */
const FLAG: Partial<Record<Asset, ReactNode>> = {
  USD: (
    <>
      <rect width="32" height="32" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((i) => (
        <rect key={i} y={i * 2.46} width="32" height="2.46" fill="#B22234" />
      ))}
      <rect width="15" height="17.2" fill="#3C3B6E" />
      {[3, 7.5, 12].flatMap((x, r) =>
        [3.5, 8.5, 13.5].map((y) => (
          <circle key={`${r}-${y}`} cx={x} cy={y} r="0.9" fill="#fff" />
        )),
      )}
    </>
  ),
  EUR: (
    <>
      <rect width="32" height="32" fill="#003399" />
      <path
        d="M16.00,4.90 L16.38,5.98 L17.52,6.01 L16.61,6.70 L16.94,7.79 L16.00,7.14 L15.06,7.79 L15.39,6.70 L14.48,6.01 L15.62,5.98Z M20.75,6.17 L21.13,7.25 L22.27,7.28 L21.36,7.97 L21.69,9.07 L20.75,8.41 L19.81,9.07 L20.14,7.97 L19.23,7.28 L20.37,7.25Z M24.23,9.65 L24.60,10.73 L25.75,10.76 L24.84,11.45 L25.17,12.54 L24.23,11.89 L23.29,12.54 L23.62,11.45 L22.71,10.76 L23.85,10.73Z M25.50,14.40 L25.88,15.48 L27.02,15.51 L26.11,16.20 L26.44,17.29 L25.50,16.64 L24.56,17.29 L24.89,16.20 L23.98,15.51 L25.12,15.48Z M24.23,19.15 L24.60,20.23 L25.75,20.26 L24.84,20.95 L25.17,22.04 L24.23,21.39 L23.29,22.04 L23.62,20.95 L22.71,20.26 L23.85,20.23Z M20.75,22.63 L21.13,23.71 L22.27,23.73 L21.36,24.43 L21.69,25.52 L20.75,24.87 L19.81,25.52 L20.14,24.43 L19.23,23.73 L20.37,23.71Z M16.00,23.90 L16.38,24.98 L17.52,25.01 L16.61,25.70 L16.94,26.79 L16.00,26.14 L15.06,26.79 L15.39,25.70 L14.48,25.01 L15.62,24.98Z M11.25,22.63 L11.63,23.71 L12.77,23.73 L11.86,24.43 L12.19,25.52 L11.25,24.87 L10.31,25.52 L10.64,24.43 L9.73,23.73 L10.87,23.71Z M7.77,19.15 L8.15,20.23 L9.29,20.26 L8.38,20.95 L8.71,22.04 L7.77,21.39 L6.83,22.04 L7.16,20.95 L6.25,20.26 L7.40,20.23Z M6.50,14.40 L6.88,15.48 L8.02,15.51 L7.11,16.20 L7.44,17.29 L6.50,16.64 L5.56,17.29 L5.89,16.20 L4.98,15.51 L6.12,15.48Z M7.77,9.65 L8.15,10.73 L9.29,10.76 L8.38,11.45 L8.71,12.54 L7.77,11.89 L6.83,12.54 L7.16,11.45 L6.25,10.76 L7.40,10.73Z M11.25,6.17 L11.63,7.25 L12.77,7.28 L11.86,7.97 L12.19,9.07 L11.25,8.41 L10.31,9.07 L10.64,7.97 L9.73,7.28 L10.87,7.25Z"
        fill="#FFCC00"
      />
    </>
  ),
  NGN: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <rect width="10.67" height="32" fill="#008751" />
      <rect x="21.33" width="10.67" height="32" fill="#008751" />
    </>
  ),
  KES: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <rect width="32" height="10" fill="#000" />
      <rect y="12" width="32" height="8" fill="#BB0000" />
      <rect y="22" width="32" height="10" fill="#006600" />
      <ellipse
        cx="16"
        cy="16"
        rx="4"
        ry="8.5"
        fill="#BB0000"
        stroke="#000"
        strokeWidth="1"
      />
      <path d="M16 8.5v15" stroke="#fff" strokeWidth="1" />
    </>
  ),
  GHS: (
    <>
      <rect width="32" height="10.67" fill="#CE1126" />
      <rect y="10.67" width="32" height="10.67" fill="#FCD116" />
      <rect y="21.33" width="32" height="10.67" fill="#006B3F" />
      <path
        d="M16.00,11.80 L17.08,14.91 L20.37,14.98 L17.75,16.97 L18.70,20.12 L16.00,18.24 L13.30,20.12 L14.25,16.97 L11.63,14.98 L14.92,14.91Z"
        fill="#000"
      />
    </>
  ),
};

/**
 * Round flag for fiat, brand mark for stablecoins:
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
  // Flags sit in the same circle as the coin marks, with a hairline so white edges don't vanish.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className="shrink-0 overflow-hidden rounded-full"
    >
      <g clipPath="circle(16px at 16px 16px)">{FLAG[asset]}</g>
      <circle
        cx="16"
        cy="16"
        r="15.5"
        fill="none"
        stroke="rgb(0 0 0 / 0.12)"
        strokeWidth="1"
      />
    </svg>
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
