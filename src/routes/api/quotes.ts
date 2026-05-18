import { createFileRoute } from "@tanstack/react-router";

/**
 * Batch live price proxy for crypto.
 *
 * POST { symbols: string[] }  →  { prices: { [SYMBOL]: number } }   (USD)
 *
 * Calls CoinGecko once with comma-separated ids, then falls back to
 * CryptoCompare's `pricemulti` endpoint for anything missing. Both are
 * free, keyless, and tolerate Worker egress better than per-symbol
 * fan-out (which was hitting CoinGecko rate limits).
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

export const Route = createFileRoute("/api/quotes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { symbols } = (await request.json()) as { symbols?: string[] };
          if (!Array.isArray(symbols) || symbols.length === 0) {
            return Response.json({ prices: {} });
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

          return Response.json({ prices: result });
        } catch (e) {
          console.error("quotes handler error:", e);
          return Response.json({ prices: {}, error: "internal" }, { status: 500 });
        }
      },
    },
  },
});
