import { createFileRoute } from "@tanstack/react-router";

/**
 * Server-side proxy for live crypto prices.
 *
 * POST { symbols: string[] }  →  { prices: { [SYMBOL]: number } }   (USD)
 *
 * Browsers (especially mobile Safari/Chrome) can fail to call CoinGecko
 * directly due to CORS, rate limits, or restrictive network policies. By
 * proxying through this server route, the outbound request happens from
 * the Worker — no CORS, consistent behavior across desktop and mobile.
 *
 * Strategy: CoinGecko first (best coverage), CryptoCompare as fallback,
 * with a 60s in-process cache to throttle outbound calls.
 */

const TTL_MS = 60_000;
type Entry = { price: number; at: number };
const cache = new Map<string, Entry>();

const STATIC_IDS: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", SUI: "sui",
  XLM: "stellar", ADA: "cardano", XRP: "ripple", DOGE: "dogecoin",
  MATIC: "matic-network", DOT: "polkadot", LINK: "chainlink",
  AVAX: "avalanche-2", BNB: "binancecoin", TRX: "tron", LTC: "litecoin",
  ATOM: "cosmos", NEAR: "near", APT: "aptos", ARB: "arbitrum",
  OP: "optimism", INJ: "injective-protocol", TON: "the-open-network",
  SHIB: "shiba-inu", PEPE: "pepe", UNI: "uniswap", AAVE: "aave",
  FIL: "filecoin", HBAR: "hedera-hashgraph", ALGO: "algorand",
  XMR: "monero", ETC: "ethereum-classic", FTM: "fantom", VET: "vechain",
  SAND: "the-sandbox", MANA: "decentraland", AXS: "axie-infinity",
  CRO: "crypto-com-chain", TIA: "celestia",
};

async function fetchCoinGecko(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols.map((s) => STATIC_IDS[s]).filter(Boolean);
  if (!ids.length) return {};
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd`,
      { headers: { accept: "application/json", "user-agent": "lucid-app/1.0" } },
    );
    if (!r.ok) return {};
    const data = (await r.json()) as Record<string, { usd?: number }>;
    const out: Record<string, number> = {};
    for (const sym of symbols) {
      const id = STATIC_IDS[sym];
      const p = id ? data[id]?.usd : undefined;
      if (typeof p === "number") out[sym] = p;
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchCryptoCompare(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {};
  try {
    const r = await fetch(
      `https://min-api.cryptocompare.com/data/pricemulti?fsyms=${symbols.join(",")}&tsyms=USD`,
      { headers: { accept: "application/json" } },
    );
    if (!r.ok) return {};
    const data = (await r.json()) as Record<string, { USD?: number }>;
    const out: Record<string, number> = {};
    for (const sym of symbols) {
      const p = data[sym]?.USD;
      if (typeof p === "number") out[sym] = p;
    }
    return out;
  } catch {
    return {};
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

export const Route = createFileRoute("/api/prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { symbols } = (await request.json()) as { symbols?: string[] };
          if (!Array.isArray(symbols) || symbols.length === 0) {
            return new Response(JSON.stringify({ prices: {} }), { headers: JSON_HEADERS });
          }
          const upper = Array.from(
            new Set(
              symbols
                .filter((s) => typeof s === "string")
                .map((s) => s.trim().toUpperCase())
                .filter(Boolean)
                .slice(0, 50),
            ),
          );

          const now = Date.now();
          const result: Record<string, number> = {};
          const missing: string[] = [];
          for (const sym of upper) {
            const c = cache.get(sym);
            if (c && now - c.at < TTL_MS) result[sym] = c.price;
            else missing.push(sym);
          }

          if (missing.length) {
            const cg = await fetchCoinGecko(missing);
            const stillMissing = missing.filter((s) => !(s in cg));
            const cc = await fetchCryptoCompare(stillMissing);
            for (const sym of missing) {
              const price = cg[sym] ?? cc[sym];
              if (typeof price === "number") {
                result[sym] = price;
                cache.set(sym, { price, at: now });
              }
            }
          }

          return new Response(JSON.stringify({ prices: result }), { headers: JSON_HEADERS });
        } catch (e) {
          console.error("prices handler error:", e);
          return new Response(JSON.stringify({ prices: {}, error: "internal" }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }
      },
    },
  },
});
