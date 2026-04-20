import type {
  ParsedResult,
  Intent,
  Currency,
  TxCategory,
  ParsedEntry,
  AssetKind,
} from "./types";

/**
 * Lucid intent parser.
 *
 * Designed as a structured interpreter — not a chatbot. Detects intent,
 * extracts amounts/currencies/categories/dates/assets, supports multiple
 * entries per sentence, and returns short elegant replies.
 *
 * This module is intentionally pure and side-effect-free so it can later
 * be swapped for a GPT API call returning the same ParsedResult shape.
 */

const CATEGORY_KEYWORDS: Record<TxCategory, string[]> = {
  Food: ["lunch", "dinner", "breakfast", "food", "restaurant", "cafe", "coffee", "meal", "pizza", "burger", "sushi", "ate", "eat"],
  Groceries: ["grocery", "groceries", "supermarket", "market", "whole foods", "trader joe"],
  Transport: ["uber", "lyft", "taxi", "cab", "bus", "metro", "train", "transport", "gas", "fuel", "parking"],
  Shopping: ["amazon", "shopping", "clothes", "shoes", "store", "bought", "purchase"],
  Bills: ["rent", "bill", "electricity", "water", "internet", "phone", "utility", "subscription", "netflix", "spotify"],
  Entertainment: ["movie", "cinema", "concert", "game", "bar", "drinks", "club"],
  Health: ["pharmacy", "doctor", "gym", "medicine", "health", "dentist"],
  Travel: ["flight", "hotel", "airbnb", "trip", "travel", "vacation"],
  Income: ["salary", "paycheck", "earned", "received", "income", "freelance", "client"],
  Other: [],
};

const CRYPTO_SYMBOLS = ["btc", "eth", "sol", "ada", "xrp", "doge", "matic", "dot", "link", "avax"];
const CRYPTO_NAMES: Record<string, string> = {
  btc: "Bitcoin",
  eth: "Ethereum",
  sol: "Solana",
  ada: "Cardano",
  xrp: "XRP",
  doge: "Dogecoin",
  matic: "Polygon",
  dot: "Polkadot",
  link: "Chainlink",
  avax: "Avalanche",
};

const CURRENCY_PATTERNS: { regex: RegExp; currency: Currency }[] = [
  { regex: /\$|usd|dollar/i, currency: "USD" },
  { regex: /€|eur|euro/i, currency: "EUR" },
  { regex: /£|gbp|pound/i, currency: "GBP" },
  { regex: /aed|dirham|د\.إ/i, currency: "AED" },
];

function detectCurrency(text: string, fallback: Currency): Currency {
  for (const { regex, currency } of CURRENCY_PATTERNS) {
    if (regex.test(text)) return currency;
  }
  return fallback;
}

function detectCategory(text: string): TxCategory {
  const lower = text.toLowerCase();
  let best: { cat: TxCategory; score: number } = { cat: "Other", score: 0 };
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS) as [TxCategory, string[]][]) {
    for (const kw of kws) {
      if (lower.includes(kw)) {
        const score = kw.length;
        if (score > best.score) best = { cat, score };
      }
    }
  }
  return best.cat;
}

function detectDate(text: string): string {
  const lower = text.toLowerCase();
  const now = new Date();
  if (/yesterday/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  if (/last week/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  return now.toISOString();
}

// Extract all monetary amounts. Handles "25", "$25", "25.50", "around 40", "50-60" -> 55, "1.2k"
function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  // range like 50-60 -> midpoint
  const rangeRe = /(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  const consumed: [number, number][] = [];
  while ((m = rangeRe.exec(text))) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    // ignore if it's clearly a date like 12-2024
    if (a < 10000 && b < 10000 && Math.abs(b - a) < Math.max(a, b)) {
      amounts.push((a + b) / 2);
      consumed.push([m.index, m.index + m[0].length]);
    }
  }
  // standalone numbers (with optional k suffix), avoid those inside ranges
  const numRe = /(?<![\w.])(\d+(?:\.\d+)?)(k)?(?![\w.])/gi;
  while ((m = numRe.exec(text))) {
    const start = m.index;
    if (consumed.some(([s, e]) => start >= s && start < e)) continue;
    let n = parseFloat(m[1]);
    if (m[2]) n *= 1000;
    if (n > 0 && n < 10_000_000) amounts.push(n);
  }
  return amounts;
}

function detectIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (!t) return "unknown";

  // Question
  if (/^(how|what|where|when|why|am i|do i|is my|are my|can you|tell me|show)/.test(t) || t.endsWith("?")) {
    return "question";
  }
  // Goal
  if (/^(i want to|my goal|goal:|set goal|i'd like to save|save \$?\d|reach \d)/.test(t) || /\bgoal\b/.test(t)) {
    return "goal_create";
  }
  // Asset / investment
  if (/\b(add|bought|have|own|hold)\b/.test(t)) {
    if (CRYPTO_SYMBOLS.some((s) => new RegExp(`\\b${s}\\b`, "i").test(t))) return "investment_log";
    if (/\b(cash|savings|stock|share|etf|bond|account)\b/.test(t)) return "asset_log";
    if (/\binvest/.test(t)) return "investment_log";
  }
  // Income
  if (/(received|got paid|salary|paycheck|earned|client paid|income)/.test(t)) {
    return "income_log";
  }
  // Correction
  if (/(actually|correction|fix that|change that|wrong)/.test(t)) return "correction";
  // Expense (default if amount present)
  if (/(spent|paid|bought|cost|charged|tipped)/.test(t) || extractAmounts(text).length > 0) {
    return "expense_log";
  }
  return "unknown";
}

function detectCrypto(text: string): { symbol: string; name: string } | null {
  const lower = text.toLowerCase();
  for (const sym of CRYPTO_SYMBOLS) {
    if (new RegExp(`\\b${sym}\\b`, "i").test(lower)) {
      return { symbol: sym.toUpperCase(), name: CRYPTO_NAMES[sym] };
    }
  }
  return null;
}

export function parseMessage(text: string, baseCurrency: Currency): ParsedResult {
  const intent = detectIntent(text);
  const date = detectDate(text);
  const currency = detectCurrency(text, baseCurrency);

  if (intent === "expense_log" || intent === "income_log") {
    const amounts = extractAmounts(text);
    if (amounts.length === 0) {
      return {
        intent: "unknown",
        entries: [],
        confidence: 0.3,
        reply: "I couldn't catch the amount — could you include a number?",
      };
    }
    const category = intent === "income_log" ? "Income" : detectCategory(text);
    const entries: ParsedEntry[] = amounts.map((amount) => ({
      amount,
      currency,
      category,
      date,
      merchant: extractMerchant(text, category),
    }));
    const total = amounts.reduce((s, n) => s + n, 0);
    const reply =
      entries.length === 1
        ? `Logged ${currencySymbol(currency)}${formatNum(total)} to ${category}.`
        : `Logged ${entries.length} entries totaling ${currencySymbol(currency)}${formatNum(total)}.`;
    return { intent, entries, confidence: 0.9, reply };
  }

  if (intent === "investment_log") {
    const crypto = detectCrypto(text);
    const amounts = extractAmounts(text);
    if (crypto) {
      // "Add 0.4 ETH" or "Bought 300 worth of BTC"
      const isQty = /\b(add|have|own|hold)\b/i.test(text) && !/\bworth\b/i.test(text);
      const value = amounts[0] ?? 0;
      const entry: ParsedEntry = isQty
        ? { quantity: value, symbol: crypto.symbol, assetKind: "crypto", assetName: crypto.name }
        : { amount: value, currency, symbol: crypto.symbol, assetKind: "crypto", assetName: crypto.name };
      return {
        intent,
        entries: [entry],
        confidence: 0.88,
        reply: isQty
          ? `Added ${value} ${crypto.symbol} to your portfolio.`
          : `Added ${currencySymbol(currency)}${formatNum(value)} of ${crypto.symbol}.`,
      };
    }
    if (amounts.length) {
      return {
        intent,
        entries: [{ amount: amounts[0], currency, assetKind: "stock", assetName: "Investment" }],
        confidence: 0.6,
        reply: `Added ${currencySymbol(currency)}${formatNum(amounts[0])} investment.`,
      };
    }
  }

  if (intent === "asset_log") {
    const amounts = extractAmounts(text);
    const lower = text.toLowerCase();
    let kind: AssetKind = "other";
    let name = "Asset";
    if (/cash/.test(lower)) {
      kind = "cash";
      name = "Cash";
    } else if (/saving/.test(lower)) {
      kind = "savings";
      name = "Savings";
    } else if (/account/.test(lower)) {
      kind = "savings";
      name = "Bank account";
    }
    if (amounts.length) {
      return {
        intent,
        entries: [{ amount: amounts[0], currency, assetKind: kind, assetName: name }],
        confidence: 0.85,
        reply: `Added ${currencySymbol(currency)}${formatNum(amounts[0])} in ${name.toLowerCase()}.`,
      };
    }
  }

  if (intent === "goal_create") {
    const amounts = extractAmounts(text);
    const lower = text.toLowerCase();
    let timeframe: "week" | "month" | "year" = "month";
    if (/year|annual|by december|by jan/.test(lower)) timeframe = "year";
    else if (/week/.test(lower)) timeframe = "week";
    let type: "save" | "spend_less" | "net_worth" = "save";
    if (/spend less|reduce|cut/.test(lower)) type = "spend_less";
    else if (/net worth|reach \d/.test(lower)) type = "net_worth";
    const target = amounts[0] ?? 0;
    const months = lower.match(/(\d+)\s*month/);
    const monthsN = months ? parseInt(months[1], 10) : timeframe === "year" ? 12 : timeframe === "week" ? 0.25 : 1;
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + Math.ceil(monthsN));
    const goalCategory = detectCategory(text);
    return {
      intent,
      entries: [],
      goal: {
        title:
          type === "save"
            ? `Save ${currencySymbol(currency)}${formatNum(target)}`
            : type === "spend_less"
              ? `Spend less on ${goalCategory}`
              : `Reach ${currencySymbol(currency)}${formatNum(target)} net worth`,
        type,
        targetAmount: target,
        timeframe,
        deadline: deadline.toISOString(),
        category: type === "spend_less" ? goalCategory : undefined,
      },
      confidence: 0.85,
      reply:
        type === "save" && target
          ? `Goal created: save ${currencySymbol(currency)}${formatNum(target)} in ${Math.ceil(monthsN)} month${monthsN > 1 ? "s" : ""}.`
          : `Goal created.`,
    };
  }

  if (intent === "question") {
    return {
      intent,
      entries: [],
      question: text,
      confidence: 0.95,
      reply: "", // filled in by caller with data
    };
  }

  return {
    intent: "unknown",
    entries: [],
    confidence: 0.2,
    reply: "I'm not sure what to do with that. Try logging an expense, asset, or asking about your money.",
  };
}

function extractMerchant(text: string, category: TxCategory): string | undefined {
  // best-effort: capture a short noun after "at" or "on"
  const m = text.match(/\b(?:at|on|from)\s+([A-Za-z][\w&'\- ]{1,24})/i);
  if (m) return m[1].trim().replace(/\.$/, "");
  if (category === "Food") return /lunch/i.test(text) ? "Lunch" : /dinner/i.test(text) ? "Dinner" : /coffee/i.test(text) ? "Coffee" : undefined;
  return undefined;
}

function currencySymbol(c: Currency): string {
  return c === "USD" ? "$" : c === "EUR" ? "€" : c === "GBP" ? "£" : "د.إ";
}
function formatNum(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n < 100 && n % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
