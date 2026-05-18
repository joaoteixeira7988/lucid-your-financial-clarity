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

/**
 * Coinbase spot price for one symbol.
 *   GET https://api.coinbase.com/v2/prices/{SYMBOL}-USD/spot
 *   → { data: { amount: "2118.95", base: "ETH", currency: "USD" } }
 * Uses ticker symbols directly — no ID mapping needed.
 */
async function fetchCoinbaseOne(symbol: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://api.coinbase.com/v2/prices/${encodeURIComponent(symbol)}-USD/spot`,
      { headers: { accept: "application/json", "user-agent": "lucid-app/1.0" } },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as { data?: { amount?: string } };
    const amt = data?.data?.amount;
    const n = amt != null ? Number(amt) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function fetchCoinbase(symbols: string[]): Promise<Record<string, number>> {
  if (!symbols.length) return {};
  const results = await Promise.all(symbols.map((s) => fetchCoinbaseOne(s)));
  const out: Record<string, number> = {};
  symbols.forEach((sym, i) => {
    const p = results[i];
    if (typeof p === "number") out[sym] = p;
  });
  return out;
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

          console.log("[/api/prices] requested:", upper, "missing:", missing);

          if (missing.length) {
            const cg = await fetchCoinGecko(missing);
            console.log("[/api/prices] coingecko returned:", cg);
            const stillMissing = missing.filter((s) => !(s in cg));
            const cc = stillMissing.length ? await fetchCryptoCompare(stillMissing) : {};
            if (stillMissing.length) console.log("[/api/prices] cryptocompare returned:", cc);
            for (const sym of missing) {
              const price = cg[sym] ?? cc[sym];
              if (typeof price === "number") {
                result[sym] = price;
                cache.set(sym, { price, at: now });
              }
            }
          }

          console.log("[/api/prices] final result:", result);
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
