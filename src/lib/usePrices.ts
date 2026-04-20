import { useEffect } from "react";
import { useAppStore } from "./store";

const SYMBOLS = ["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "DOT", "LINK", "AVAX"];
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  MATIC: "matic-network",
  DOT: "polkadot",
  LINK: "chainlink",
  AVAX: "avalanche-2",
};

const FALLBACK_PRICES: Record<string, number> = {
  BTC: 67000,
  ETH: 3500,
  SOL: 145,
  ADA: 0.45,
  XRP: 0.55,
  DOGE: 0.16,
  MATIC: 0.7,
  DOT: 6.8,
  LINK: 14,
  AVAX: 32,
};

export function useCryptoPrices() {
  const setCryptoPrices = useAppStore((s) => s.setCryptoPrices);
  const prices = useAppStore((s) => s.cryptoPrices);

  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        const ids = SYMBOLS.map((s) => COINGECKO_IDS[s]).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
          { headers: { accept: "application/json" } }
        );
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Record<string, { usd: number }>;
        if (cancelled) return;
        const next: Record<string, number> = {};
        for (const sym of SYMBOLS) {
          const v = data[COINGECKO_IDS[sym]]?.usd;
          if (typeof v === "number") next[sym] = v;
        }
        // Merge with fallback for any missing
        const merged = { ...FALLBACK_PRICES, ...next };
        setCryptoPrices(merged);
      } catch {
        if (cancelled) return;
        // graceful fallback
        if (Object.keys(prices).length === 0) setCryptoPrices(FALLBACK_PRICES);
      }
    }
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return prices;
}
