import { createFileRoute } from "@tanstack/react-router";

/**
 * Live price proxy.
 *  - crypto → CoinGecko (no key)
 *  - stock  → Finnhub (FINNHUB_API_KEY)
 *
 * Always normalizes price to USD. The client converts to base currency
 * using the FX table in `src/lib/currency.ts`.
 */

type Kind = "crypto" | "stock";

// Server-process memory cache (60s) to throttle outbound calls.
const QUOTE_TTL_MS = 60_000;
const quoteCache = new Map<string, { price: number; name?: string; at: number }>();

// Symbol → CoinGecko id cache. Persistent for the worker lifetime.
const cgIdCache = new Map<string, string | null>();
const COINGECKO_STATIC_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", SUI: "sui",
  ADA: "cardano", XRP: "ripple", DOGE: "dogecoin", MATIC: "matic-network",
  DOT: "polkadot", LINK: "chainlink", AVAX: "avalanche-2", BNB: "binancecoin",
  TRX: "tron", LTC: "litecoin", ATOM: "cosmos", NEAR: "near",
  APT: "aptos", ARB: "arbitrum", OP: "optimism", INJ: "injective-protocol",
  TON: "the-open-network", SHIB: "shiba-inu", PEPE: "pepe", UNI: "uniswap",
  AAVE: "aave", FIL: "filecoin",
};

async function resolveCoinGeckoId(symbol: string): Promise<string | null> {
  const sym = symbol.toUpperCase();
  if (COINGECKO_STATIC_IDS[sym]) return COINGECKO_STATIC_IDS[sym];
  if (cgIdCache.has(sym)) return cgIdCache.get(sym) ?? null;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(sym)}`);
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { coins?: Array<{ id: string; symbol: string; market_cap_rank: number | null }> };
    const match = (data.coins ?? [])
      .filter((c) => c.symbol?.toUpperCase() === sym)
      .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))[0];
    const id = match?.id ?? null;
    cgIdCache.set(sym, id);
    return id;
  } catch {
    cgIdCache.set(sym, null);
    return null;
  }
}

async function fetchCryptoPrice(symbol: string): Promise<{ price: number; name?: string } | null> {
  const id = await resolveCoinGeckoId(symbol);
  if (!id) return null;
  const r = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
  );
  if (!r.ok) return null;
  const data = (await r.json()) as Record<string, { usd?: number }>;
  const price = data[id]?.usd;
  if (typeof price !== "number") return null;
  return { price, name: id.replace(/-/g, " ") };
}

async function fetchStockPrice(symbol: string): Promise<{ price: number; name?: string } | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const r = await fetch(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol.toUpperCase())}&token=${key}`
  );
  if (!r.ok) return null;
  const data = (await r.json()) as { c?: number };
  if (!data.c || data.c <= 0) return null;
  return { price: data.c };
}

export const Route = createFileRoute("/api/quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { symbol, kind } = (await request.json()) as { symbol: string; kind: Kind };
          if (!symbol || (kind !== "crypto" && kind !== "stock")) {
            return Response.json({ error: "bad_input" }, { status: 400 });
          }
          const cacheKey = `${kind}:${symbol.toUpperCase()}`;
          const cached = quoteCache.get(cacheKey);
          if (cached && Date.now() - cached.at < QUOTE_TTL_MS) {
            return Response.json({ symbol: symbol.toUpperCase(), kind, price: cached.price, name: cached.name, currency: "USD", cached: true });
          }
          const result =
            kind === "crypto"
              ? await fetchCryptoPrice(symbol)
              : await fetchStockPrice(symbol);
          if (!result) {
            return Response.json({ error: "not_found", symbol: symbol.toUpperCase() }, { status: 404 });
          }
          quoteCache.set(cacheKey, { price: result.price, name: result.name, at: Date.now() });
          return Response.json({
            symbol: symbol.toUpperCase(),
            kind,
            price: result.price,
            name: result.name,
            currency: "USD",
            cached: false,
          });
        } catch (e) {
          console.error("quote handler error:", e);
          return Response.json({ error: "internal" }, { status: 500 });
        }
      },
    },
  },
});
