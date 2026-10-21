import type { Currency } from "../_data";

export const FLAGS: Record<Currency, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  NGN: "🇳🇬",
  JPY: "🇯🇵",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  CHF: "🇨🇭",
  KES: "🇰🇪",
  GHS: "🇬🇭",
  ZAR: "🇿🇦",
  AED: "🇦🇪",
};

export const SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  NGN: "₦",
  JPY: "¥",
  CAD: "CA$",
  AUD: "A$",
  CHF: "CHF ",
  KES: "KSh ",
  GHS: "GH₵",
  ZAR: "R ",
  AED: "AED ",
};

export const NAMES: Record<Currency, string> = {
  USD: "US dollar",
  EUR: "Euro",
  GBP: "British pound",
  NGN: "Nigerian naira",
  JPY: "Japanese yen",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  CHF: "Swiss franc",
  KES: "Kenyan shilling",
  GHS: "Ghanaian cedi",
  ZAR: "South African rand",
  AED: "UAE dirham",
};

/** How money reaches an account in each currency. */
export const RAILS: Record<Currency, string> = {
  USD: "ACH, wire and RTP",
  EUR: "SEPA and SEPA Instant",
  GBP: "Faster Payments and BACS",
  NGN: "NIP bank transfers",
  JPY: "Zengin bank transfers",
  CAD: "EFT and wire",
  AUD: "NPP and BECS",
  CHF: "SIC and SEPA",
  KES: "PesaLink and RTGS",
  GHS: "GhIPSS and RTGS",
  ZAR: "EFT and RTC",
  AED: "UAEFTS and IPP",
};

/** Typical time from request to an active account. */
export const READY_IN: Record<Currency, string> = {
  USD: "1–2 business days",
  EUR: "1–3 business days",
  GBP: "1–3 business days",
  NGN: "2–4 business days",
  JPY: "3–5 business days",
  CAD: "2–4 business days",
  AUD: "2–4 business days",
  CHF: "3–5 business days",
  KES: "3–5 business days",
  GHS: "3–5 business days",
  ZAR: "3–5 business days",
  AED: "3–5 business days",
};
