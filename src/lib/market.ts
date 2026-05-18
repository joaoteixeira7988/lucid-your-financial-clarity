import { useEffect } from "react";
import { useAppStore, INVESTMENT_KINDS } from "./store";

/**
 * Live market data layer.
 *
 * - Caches USD prices in Zustand under `cryptoPrices` (crypto) and
 *   `stockPrices` (stocks). Both keyed by uppercase symbol.
 * - Refreshes on app load and every 2 minutes while the app is open.
 * - Exposes `fetchQuote(symbol, kind)` for one-off lookups (used when the
 *   parser logs a new investment).
 */

const REFRESH_INTERVAL = 2 * 60 * 1000;
const inflight = new Map<string, Promise<QuoteResult | null>>();

export type QuoteResult = {
  symbol: string;
  kind: "crypto" | "stock";
  /** Always USD. */
  price: number;
  name?: string;
  cached?: boolean;
};

export async function fetchQuote(
  symbol: string,
  kind: "crypto" | "stock"
): Promise<QuoteResult | null> {
  if (!symbol) return null;
  const key = `${kind}:${symbol.toUpperCase()}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, kind }),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as QuoteResult;
      // Mirror into the relevant store cache.
      const state = useAppStore.getState();
      if (kind === "crypto") {
        state.setCryptoPrices({ ...state.cryptoPrices, [data.symbol]: data.price });
      } else {
        state.setStockPrices({ ...state.stockPrices, [data.symbol]: data.price });
      }
      return data;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}

const KNOWN_CRYPTO = new Set([
  "BTC","ETH","SOL","SUI","ADA","XRP","DOGE","MATIC","DOT","LINK","AVAX","BNB",
  "TRX","LTC","ATOM","NEAR","APT","ARB","OP","INJ","TON","SHIB","PEPE","UNI",
  "AAVE","FIL",
]);

async function refreshAllHoldings() {
  const state = useAppStore.getState();
  const work: { symbol: string; kind: "crypto" | "stock" }[] = [];
  for (const a of state.assets) {
    if (!INVESTMENT_KINDS.has(a.kind)) continue;
    // Prefer explicit symbol; otherwise infer from the asset name when it's
    // a known ticker (covers cases where the parser stored only `name: "BTC"`).
    let sym = a.symbol?.toUpperCase();
    if (!sym && a.name) {
      const candidate = a.name.trim().toUpperCase();
      if (KNOWN_CRYPTO.has(candidate) || /^[A-Z]{1,5}$/.test(candidate)) {
        sym = candidate;
      }
    }
    if (!sym) continue;
    const kind: "crypto" | "stock" =
      a.kind === "stock" ? "stock" : KNOWN_CRYPTO.has(sym) ? "crypto" : (a.kind as "crypto" | "stock");
    work.push({ symbol: sym, kind });
  }

  // Dedupe.
  const seen = new Set<string>();
  const deduped = work.filter((s) => {
    const k = `${s.kind}:${s.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Run sequentially-ish (don't blast CoinGecko rate limit).
  for (const s of deduped) {
    await fetchQuote(s.symbol, s.kind);
  }
}

export function useMarketPrices() {
  // Track a fingerprint of investment symbols so a freshly-logged holding
  // triggers an immediate refresh instead of waiting up to 2 minutes.
  const symbolKey = useAppStore((s) =>
    s.assets
      .filter((a) => INVESTMENT_KINDS.has(a.kind))
      .map((a) => `${a.kind}:${(a.symbol ?? a.name ?? "").toUpperCase()}`)
      .sort()
      .join("|")
  );

  useEffect(() => {
    refreshAllHoldings();
    const id = setInterval(refreshAllHoldings, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [symbolKey]);
}
