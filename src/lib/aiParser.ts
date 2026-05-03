import type { ParsedResult, Currency, ParsedEntry, Intent, TxCategory, AssetKind } from "./types";
import { parseMessage as parseMessageLocal } from "./parser";
import { useAppStore, inferCategoryFromHistory } from "./store";

/**
 * GPT-powered parser client. Calls /api/parse and normalizes the result
 * into the existing ParsedResult shape. Falls back to the rule-based
 * parser on network/credit errors so the app stays functional.
 */

const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "SUI", "ADA", "XRP", "DOGE", "MATIC", "DOT", "LINK",
  "AVAX", "BNB", "TRX", "LTC", "ATOM", "NEAR", "APT", "ARB", "OP", "INJ",
  "TON", "SHIB", "PEPE", "UNI", "AAVE", "FIL",
]);

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
      // Rate limit / credits — fallback silently.
      return parseMessageLocal(text, baseCurrency);
    }
    if (!res.ok) {
      console.warn("AI parser failed, falling back:", res.status);
      return parseMessageLocal(text, baseCurrency);
    }

    const raw = (await res.json()) as RawResponse;
    return normalize(raw, text, baseCurrency);
  } catch (e) {
    console.warn("AI parser error, falling back:", e);
    return parseMessageLocal(text, baseCurrency);
  }
}

function normalize(raw: RawResponse, text: string, baseCurrency: Currency): ParsedResult {
  let intent = raw.intent;
  const entries: ParsedEntry[] = (raw.entries ?? []).map((e) => ({ ...e }));

  // Safety guard: if any entry has a known crypto symbol, force investment_log
  // and fix common parser mistake where unit quantity ends up in `amount`.
  const hasCrypto = entries.some(
    (e) => e.symbol && CRYPTO_SYMBOLS.has(e.symbol.toUpperCase())
  );
  if (hasCrypto) {
    if (intent !== "investment_log") intent = "investment_log";
    entries.forEach((e) => {
      if (e.symbol && CRYPTO_SYMBOLS.has(e.symbol.toUpperCase())) {
        e.assetKind = "crypto";
        e.symbol = e.symbol.toUpperCase();
        if (!e.assetName) e.assetName = e.symbol;
        // "bought 0.5 ETH" sometimes comes back as amount=0.5 with no quantity.
        // If amount is small (< 1000) and quantity is missing, treat it as a unit quantity.
        if (
          (e.quantity == null) &&
          e.amount != null &&
          e.amount < 1000
        ) {
          e.quantity = e.amount;
          e.amount = undefined;
        }
      }
    });
  }


  // Default currency on entries
  entries.forEach((e) => {
    if (!e.currency) e.currency = baseCurrency;
    e.source = "text";
  });

  // Category inference fallback for vague expenses
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

  // Date default
  entries.forEach((e) => {
    if (!e.date) e.date = new Date().toISOString();
  });

  // Goal normalization
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

  // Validation: amount required for log intents
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

  // Asset kind defaulting
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
