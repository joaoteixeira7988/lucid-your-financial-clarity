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

async function refreshAllHoldings() {
  const state = useAppStore.getState();
  const symbols = state.assets
    .filter((a) => INVESTMENT_KINDS.has(a.kind) && a.symbol)
    .map((a) => ({ symbol: a.symbol!.toUpperCase(), kind: a.kind as "crypto" | "stock" }));

  // Dedupe.
  const seen = new Set<string>();
  const work = symbols.filter((s) => {
    const k = `${s.kind}:${s.symbol}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Run sequentially-ish (don't blast CoinGecko rate limit).
  for (const s of work) {
    await fetchQuote(s.symbol, s.kind);
  }
}

export function useMarketPrices() {
  useEffect(() => {
    refreshAllHoldings();
    const id = setInterval(refreshAllHoldings, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);
}
