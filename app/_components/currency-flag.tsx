import type { ReactNode } from "react";

/** Round flags drawn as SVG (emoji flags render differently per OS, crop badly and sit off the text line). */
const FLAG: Record<string, ReactNode> = {
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
  GBP: (
    <>
      <rect width="32" height="32" fill="#012169" />
      <path d="M0 0L32 32M32 0L0 32" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L32 32M32 0L0 32" stroke="#C8102E" strokeWidth="2" />
      <path d="M16 0v32M0 16h32" stroke="#fff" strokeWidth="10" />
      <path d="M16 0v32M0 16h32" stroke="#C8102E" strokeWidth="6" />
    </>
  ),
  JPY: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <circle cx="16" cy="16" r="7.5" fill="#BC002D" />
    </>
  ),
  CAD: (
    <>
      <rect width="32" height="32" fill="#fff" />
      <rect width="8" height="32" fill="#D52B1E" />
      <rect x="24" width="8" height="32" fill="#D52B1E" />
      <path
        d="M16 7l1.6 3 1.8-.9-.6 4.4 2.6-2.7.6 1.5 2.4-.5-.8 2.8 1.1.6-4.3 3.6.5 1.5-4.3-.5V24h-1.2v-4.2l-4.3.5.5-1.5-4.3-3.6 1.1-.6-.8-2.8 2.4.5.6-1.5 2.6 2.7-.6-4.4 1.8.9z"
        fill="#D52B1E"
      />
    </>
  ),
  AUD: (
    <>
      <rect width="32" height="32" fill="#012169" />
      <svg width="16" height="16" viewBox="0 0 32 32">
        
      <path d="M0 0L32 32M32 0L0 32" stroke="#fff" strokeWidth="6" />
      <path d="M0 0L32 32M32 0L0 32" stroke="#C8102E" strokeWidth="2" />
      <path d="M16 0v32M0 16h32" stroke="#fff" strokeWidth="10" />
      <path d="M16 0v32M0 16h32" stroke="#C8102E" strokeWidth="6" />
      </svg>
      <path d="M8.00,21.00 L8.79,22.91 L10.85,23.07 L9.28,24.42 L9.76,26.43 L8.00,25.35 L6.24,26.43 L6.72,24.42 L5.15,23.07 L7.21,22.91Z M24.00,6.40 L24.42,7.42 L25.52,7.51 L24.68,8.22 L24.94,9.29 L24.00,8.72 L23.06,9.29 L23.32,8.22 L22.48,7.51 L23.58,7.42Z M20.00,13.40 L20.42,14.42 L21.52,14.51 L20.68,15.22 L20.94,16.29 L20.00,15.72 L19.06,16.29 L19.32,15.22 L18.48,14.51 L19.58,14.42Z M27.00,12.40 L27.42,13.42 L28.52,13.51 L27.68,14.22 L27.94,15.29 L27.00,14.72 L26.06,15.29 L26.32,14.22 L25.48,13.51 L26.58,13.42Z M24.00,24.20 L24.48,25.34 L25.71,25.44 L24.77,26.25 L25.06,27.46 L24.00,26.81 L22.94,27.46 L23.23,26.25 L22.29,25.44 L23.52,25.34Z M26.50,18.50 L26.76,19.14 L27.45,19.19 L26.93,19.64 L27.09,20.31 L26.50,19.95 L25.91,20.31 L26.07,19.64 L25.55,19.19 L26.24,19.14Z" fill="#fff" />
    </>
  ),
  CHF: (
    <>
      <rect width="32" height="32" fill="#DA291C" />
      <path d="M13.5 7h5v6.5H25v5h-6.5V25h-5v-6.5H7v-5h6.5z" fill="#fff" />
    </>
  ),
  ZAR: (
    <>
      <rect width="32" height="16" fill="#E03C31" />
      <rect y="16" width="32" height="16" fill="#001489" />
      <path d="M0 0L14 16L0 32M14 16H32" fill="none" stroke="#fff" strokeWidth="10.6" />
      <path d="M0 0L14 16L0 32M14 16H32" fill="none" stroke="#007749" strokeWidth="6.4" />
      <path d="M0 5.5L10.5 16L0 26.5z" fill="#FFB81C" />
      <path d="M0 8.5L7.5 16L0 23.5z" fill="#000" />
    </>
  ),
  AED: (
    <>
      <rect width="32" height="10.67" fill="#00732F" />
      <rect y="10.67" width="32" height="10.67" fill="#fff" />
      <rect y="21.33" width="32" height="10.67" fill="#000" />
      <rect width="9" height="32" fill="#FF0000" />
    </>
  ),
};

export const HAS_FLAG = (code: string) => code in FLAG;

/** A currency's flag in a circle with a hairline, so white edges don't vanish. */
export function CurrencyFlag({
  code,
  size = 16,
}: {
  code: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className="shrink-0 overflow-hidden rounded-full"
    >
      <g clipPath="circle(16px at 16px 16px)">{FLAG[code]}</g>
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
