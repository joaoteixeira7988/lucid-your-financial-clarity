import type { ParsedResult, Currency, ParsedEntry, Intent, TxCategory, AssetKind } from "./types";
import { parseMessage as parseMessageLocal } from "./parser";
import { useAppStore, inferCategoryFromHistory } from "./store";

const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "SUI", "ADA", "XRP", "DOGE", "MATIC", "DOT", "LINK",
  "AVAX", "BNB", "TRX", "LTC", "ATOM", "NEAR", "APT", "ARB", "OP", "INJ",
  "TON", "SHIB", "PEPE", "UNI", "AAVE", "FIL",
]);

const STOCK_SYMBOLS = new Set([
  "AAPL", "TSLA", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "NFLX",
  "BABA", "AMD", "INTC", "ORCL", "CRM", "ADBE", "PYPL", "DIS", "BA", "JPM",
  "V", "MA", "WMT", "KO", "PEP", "MCD", "NKE", "SBUX", "UBER", "LYFT",
  "SHOP", "SQ", "PLTR", "SNOW", "COIN", "RBLX", "SPOT", "ABNB", "F", "GM",
  "T", "VZ", "XOM", "CVX", "BRK.B",
]);

function classifySymbol(sym: string | undefined): "crypto" | "stock" | null {
  if (!sym) return null;
  const u = sym.toUpperCase();
  if (CRYPTO_SYMBOLS.has(u)) return "crypto";
  if (STOCK_SYMBOLS.has(u)) return "stock";
  // Heuristic: 1-5 uppercase letters not in crypto list → likely stock ticker.
  if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(u)) return "stock";
  return null;
}


type RawResponse = {
  intent: Intent;
  confidence: number;
  entries: ParsedEntry[];
  goal?: {
    title?: string;
    type?: "save" | "spend_less" | "net_worth";
    targetAmount?: number;
    timeframe?: "week" | "month" | "year";
    months?: number;
    category?: TxCategory;
  };
  reply?: string;
};

export async function parseMessageAI(
  text: string,
  baseCurrency: Currency
): Promise<ParsedResult> {
  try {
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, baseCurrency }),
    });

    if (res.status === 429 || res.status === 402) {
      return parseMessageLocal(text, baseCurrency);
    }
    if (!res.ok) {
      console.warn("AI parser failed, falling back:", res.status);
      return parseMessageLocal(text, baseCurrency);
    }

    const raw = (await res.json()) as RawResponse;
    console.log("RAW API RESPONSE:", JSON.stringify(raw));
    return normalize(raw, text, baseCurrency);
  } catch (e) {
    console.warn("AI parser error, falling back:", e);
    return parseMessageLocal(text, baseCurrency);
  }
}

function normalize(raw: RawResponse, text: string, baseCurrency: Currency): ParsedResult {
  let intent = raw.intent;
  const entries: ParsedEntry[] = (raw.entries ?? []).map((e) => {
    const entry = { ...e };
    // Fix: parser sometimes puts a unit quantity (e.g. "0.5" in "0.5 ETH")
    // into the `amount` field. Detect this by looking at the original text
    // for a number adjacent to the symbol with no nearby currency marker.
    if (entry.symbol && CRYPTO_SYMBOLS.has(entry.symbol.toUpperCase())) {
      const hasQuantity = entry.quantity != null;
      const hasAmount = entry.amount != null;
      if (!hasQuantity && hasAmount) {
        const sym = entry.symbol.toUpperCase();
        // Match a number directly adjacent to the symbol in either order:
        //   "0.5 ETH", "0,5 ETH", "1,234.56 ETH", "ETH 0.5"
        // The number can use "." or "," as decimal/thousand separators.
        const adjacent = new RegExp(
          `(?:(\\d[\\d,.]*)\\s*${sym}\\b)|(?:\\b${sym}\\s*(\\d[\\d,.]*))`,
          "i"
        );
        const match = text.match(adjacent);
        if (match) {
          const rawNum = match[1] ?? match[2] ?? "";
          // Normalize: strip thousands separators, keep decimal point.
          // Heuristic: if there's both "," and ".", treat "," as thousands.
          // If only "," exists, treat the last one as decimal.
          let normalized = rawNum;
          if (rawNum.includes(",") && rawNum.includes(".")) {
            normalized = rawNum.replace(/,/g, "");
          } else if (rawNum.includes(",") && !rawNum.includes(".")) {
            const parts = rawNum.split(",");
            normalized =
              parts.length === 2 && parts[1].length <= 2
                ? parts.join(".")
                : parts.join("");
          }
          const adjacentNum = parseFloat(normalized);

          // Look at a small window around the matched number for currency cues.
          const matchStart = match.index ?? 0;
          const windowStart = Math.max(0, matchStart - 16);
          const windowEnd = Math.min(text.length, matchStart + match[0].length + 16);
          const window = text.slice(windowStart, windowEnd);
          const currencyCue =
            /\$|€|£|د\.إ|\b(usd|eur|gbp|aed|dollars?|euros?|pounds?|dirhams?|worth\s+of)\b/i;

          const looksLikeQuantity =
            Number.isFinite(adjacentNum) && !currencyCue.test(window);

          // Only rewrite when the number we found in the text matches the
          // amount the parser returned (within a small tolerance) — this
          // avoids touching cases like "$500 of ETH" where amount=500.
          const matchesAmount =
            Number.isFinite(adjacentNum) &&
            entry.amount != null &&
            Math.abs(adjacentNum - entry.amount) < 1e-6;

          if (looksLikeQuantity && matchesAmount) {
            console.log(
              `Correcting: moving amount ${entry.amount} to quantity for ${sym}`
            );
            entry.quantity = adjacentNum;
            entry.amount = undefined;
          }
        }
      }
    }
    return entry;
  });

  // Classify any symbol as crypto or stock and promote to investment_log.
  const hasInvestment = entries.some((e) => classifySymbol(e.symbol) !== null);
  if (hasInvestment && intent !== "investment_log") {
    intent = "investment_log";
  }
  if (intent === "investment_log") {
    entries.forEach((e) => {
      const kind = classifySymbol(e.symbol);
      if (kind && e.symbol) {
        // Respect AI-provided assetKind if it's crypto/stock; otherwise infer.
        if (e.assetKind !== "crypto" && e.assetKind !== "stock") {
          e.assetKind = kind;
        }
        e.symbol = e.symbol.toUpperCase();
        if (!e.assetName) e.assetName = e.symbol;
      }
    });
  }


  entries.forEach((e) => {
    if (!e.currency) e.currency = baseCurrency;
    e.source = "text";
  });

  if (intent === "expense_log") {
    entries.forEach((e) => {
      if (!e.category || e.category === "Other") {
        const inferred = inferCategoryFromHistory(useAppStore.getState(), text);
        if (inferred) {
          e.category = inferred.category;
          e.categoryInferred = true;
        } else {
          e.category = e.category ?? "Other";
        }
      }
    });
  } else if (intent === "income_log") {
    entries.forEach((e) => {
      e.category = "Income";
    });
  }

  entries.forEach((e) => {
    if (!e.date) e.date = new Date().toISOString();
  });

  let goal: ParsedResult["goal"];
  if (intent === "goal_create" && raw.goal) {
    const months = raw.goal.months ?? (raw.goal.timeframe === "year" ? 12 : raw.goal.timeframe === "week" ? 0.25 : 1);
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + Math.ceil(months));
    goal = {
      title: raw.goal.title || "New goal",
      type: raw.goal.type ?? "save",
      targetAmount: raw.goal.targetAmount ?? 0,
      timeframe: raw.goal.timeframe ?? "month",
      deadline: deadline.toISOString(),
      category: raw.goal.category as TxCategory | undefined,
    };
  }

  if (
    (intent === "expense_log" || intent === "income_log") &&
    !entries.some((e) => e.amount != null && e.amount > 0)
  ) {
    return {
      intent: "unknown",
      entries: [],
      confidence: 0.3,
      reply: "I couldn't catch the amount — could you include a number?",
    };
  }

  if (intent === "asset_log" && !entries.some((e) => e.amount != null)) {
    return {
      intent: "unknown",
      entries: [],
      confidence: 0.4,
      reply: `What's the value?`,
    };
  }

  if (intent === "asset_log") {
    entries.forEach((e) => {
      if (!e.assetKind) e.assetKind = "other" as AssetKind;
      if (!e.assetName) e.assetName = "Asset";
    });
  }

  return {
    intent,
    entries,
    goal,
    question: intent === "question" ? text : undefined,
    confidence: raw.confidence ?? 0.7,
    reply: raw.reply ?? "",
  };
}
