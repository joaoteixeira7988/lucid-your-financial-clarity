import { useEffect } from "react";
import { useAppStore, INVESTMENT_KINDS } from "./store";

/**
 * Live market data layer.
 *
 * - Crypto prices are fetched in a single batch via /api/quotes (CoinGecko
 *   with CryptoCompare fallback) to avoid per-symbol rate limits.
 * - Stock prices are fetched one-by-one via /api/quote (Finnhub).
 * - Refreshes on app load, when the asset set changes, and every 2 minutes.
 */

const REFRESH_INTERVAL = 2 * 60 * 1000;
const MISSING_RETRY_INTERVAL = 30 * 1000;

export type QuoteResult = {
  symbol: string;
  kind: "crypto" | "stock";
  price: number; // USD
  name?: string;
  cached?: boolean;
};

const KNOWN_CRYPTO = new Set([
  "BTC","ETH","SOL","SUI","XLM","ADA","XRP","DOGE","MATIC","DOT","LINK","AVAX",
  "BNB","TRX","LTC","ATOM","NEAR","APT","ARB","OP","INJ","TON","SHIB","PEPE",
  "UNI","AAVE","FIL","HBAR","ALGO","XMR","ETC","FTM","VET","SAND","MANA",
  "AXS","CRO","TIA",
]);

// Maps a full coin name to its ticker so holdings logged as "Ethereum" still
// resolve to a CoinGecko-friendly symbol when batched.
const NAME_TO_SYMBOL: Record<string, string> = {
  BITCOIN: "BTC", ETHEREUM: "ETH", SOLANA: "SOL", STELLAR: "XLM",
  CARDANO: "ADA", RIPPLE: "XRP", DOGECOIN: "DOGE", POLYGON: "MATIC",
  POLKADOT: "DOT", CHAINLINK: "LINK", AVALANCHE: "AVAX", BINANCE: "BNB",
  "BINANCE COIN": "BNB", TRON: "TRX", LITECOIN: "LTC", COSMOS: "ATOM",
  APTOS: "APT", ARBITRUM: "ARB", OPTIMISM: "OP", INJECTIVE: "INJ",
  TONCOIN: "TON", "THE OPEN NETWORK": "TON", "SHIBA INU": "SHIB",
  PEPE: "PEPE", UNISWAP: "UNI", AAVE: "AAVE", FILECOIN: "FIL",
  HEDERA: "HBAR", ALGORAND: "ALGO", MONERO: "XMR",
  "ETHEREUM CLASSIC": "ETC", FANTOM: "FTM", VECHAIN: "VET",
  "THE SANDBOX": "SAND", DECENTRALAND: "MANA", "AXIE INFINITY": "AXS",
  CRONOS: "CRO", CELESTIA: "TIA", SUI: "SUI", NEAR: "NEAR",
};

const stockInflight = new Map<string, Promise<QuoteResult | null>>();

/** One-off lookup. Used when logging a new investment from chat. */
export async function fetchQuote(
  symbol: string,
  kind: "crypto" | "stock",
): Promise<QuoteResult | null> {
  if (!symbol) return null;
  const sym = symbol.toUpperCase();

  if (kind === "crypto") {
    const map = await fetchCryptoBatch([sym]);
    const price = map[sym];
    if (typeof price !== "number") return null;
    return { symbol: sym, kind, price };
  }

  // Stock — single-shot.
  const key = `stock:${sym}`;
  const existing = stockInflight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      const r = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym, kind }),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as QuoteResult;
      const s = useAppStore.getState();
      s.setStockPrices({ ...s.stockPrices, [data.symbol]: data.price });
      return data;
    } catch {
      return null;
    } finally {
      stockInflight.delete(key);
    }
  })();
  stockInflight.set(key, p);
  return p;
}

async function fetchCryptoBatch(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {};
  try {
    const r = await fetch("/api/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
    });
    if (!r.ok) return {};
    const data = (await r.json()) as { prices?: Record<string, number> };
    const prices = data.prices ?? {};
    if (Object.keys(prices).length) {
      const s = useAppStore.getState();
      s.setCryptoPrices({ ...s.cryptoPrices, ...prices });
    }
    return prices;
  } catch {
    return {};
  }
}

function collectSymbols(): { crypto: string[]; stock: string[] } {
  const state = useAppStore.getState();
  const crypto = new Set<string>();
  const stock = new Set<string>();
  for (const a of state.assets) {
    if (!INVESTMENT_KINDS.has(a.kind)) continue;
    let sym = a.symbol?.toUpperCase();
    if (!sym && a.name) {
      const candidate = a.name.trim().toUpperCase();
      if (NAME_TO_SYMBOL[candidate]) sym = NAME_TO_SYMBOL[candidate];
      else if (KNOWN_CRYPTO.has(candidate) || /^[A-Z]{1,5}$/.test(candidate)) {
        sym = candidate;
      }
    }
    if (!sym) continue;
    const kind = a.kind === "stock" ? "stock" : KNOWN_CRYPTO.has(sym) ? "crypto" : a.kind;
    if (kind === "stock") stock.add(sym);
    else if (kind === "crypto") crypto.add(sym);
  }
  return { crypto: [...crypto], stock: [...stock] };
}

async function refreshAllHoldings() {
  const { crypto, stock } = collectSymbols();
  await fetchCryptoBatch(crypto);
  for (const sym of stock) {
    await fetchQuote(sym, "stock");
  }
}

/** Crypto symbols on file that don't have a price yet (or price is 0). */
function collectMissingCrypto(): string[] {
  const { crypto } = collectSymbols();
  const prices = useAppStore.getState().cryptoPrices;
  return crypto.filter((sym) => {
    const p = prices[sym];
    return typeof p !== "number" || p <= 0;
  });
}

export function useMarketPrices() {
  // Track a fingerprint of investment symbols so a freshly-logged holding
  // triggers an immediate refresh instead of waiting up to 2 minutes.
  const symbolKey = useAppStore((s) =>
    s.assets
      .filter((a) => INVESTMENT_KINDS.has(a.kind))
      .map((a) => `${a.kind}:${(a.symbol ?? a.name ?? "").toUpperCase()}`)
      .sort()
      .join("|"),
  );

  useEffect(() => {
    refreshAllHoldings();
    const id = setInterval(refreshAllHoldings, REFRESH_INTERVAL);

    // Aggressive retry: while any crypto holding still lacks a price (e.g.
    // first fetch at log-time failed on mobile), re-poll every 30s until
    // every symbol has a real value. Stops itself once nothing is missing.
    const retryId = setInterval(() => {
      const missing = collectMissingCrypto();
      if (!missing.length) return;
      console.log("[market] retrying missing crypto prices:", missing);
      fetchCryptoBatch(missing);
    }, MISSING_RETRY_INTERVAL);

    return () => {
      clearInterval(id);
      clearInterval(retryId);
    };
  }, [symbolKey]);
}
