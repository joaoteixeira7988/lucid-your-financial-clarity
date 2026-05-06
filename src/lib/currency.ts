import type { Currency } from "./types";

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};

// Static FX rates relative to USD (demo). Real app would fetch live.
export const FX_TO_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  AED: 0.272,
};

export function toBase(amount: number, from: Currency, base: Currency): number {
  const usd = amount * FX_TO_USD[from];
  return usd / FX_TO_USD[base];
}

export function fmtMoney(value: number, currency: Currency, opts?: { compact?: boolean }): string {
  const sym = CURRENCY_SYMBOL[currency];
  const abs = Math.abs(value);
  if (opts?.compact && abs >= 10000) {
    if (abs >= 1_000_000) return `${value < 0 ? "-" : ""}${sym}${(abs / 1_000_000).toFixed(2)}M`;
    return `${value < 0 ? "-" : ""}${sym}${(abs / 1000).toFixed(1)}k`;
  }
  const formatted = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs < 100 ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : ""}${sym}${formatted}`;
}

export function fmtSigned(value: number, currency: Currency): string {
  const s = fmtMoney(Math.abs(value), currency);
  return `${value >= 0 ? "+" : "-"}${s}`;
}

export function fmtPct(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}
