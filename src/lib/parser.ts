import type {
  ParsedResult,
  Intent,
  Currency,
  TxCategory,
  ParsedEntry,
  AssetKind,
} from "./types";
import { useAppStore, inferCategoryFromHistory } from "./store";

/**
 * Lucid intent parser.
 *
 * Pure interpreter — no side effects. Classifies user text into a financial
 * action: expense, income, asset purchase, investment, goal, question, or a
 * clarification request when ambiguity is high. Keep this swappable with a
 * GPT-powered parser returning the same ParsedResult shape.
 */

const CATEGORY_KEYWORDS: Record<TxCategory, string[]> = {
  Food: ["lunch", "dinner", "breakfast", "food", "restaurant", "cafe", "coffee", "meal", "pizza", "burger", "sushi", "ate", "eat", "brunch"],
  Groceries: ["grocery", "groceries", "supermarket", "market", "whole foods", "trader joe"],
  Transport: ["uber", "lyft", "taxi", "cab", "bus", "metro", "train", "transport", "gas", "fuel", "parking"],
  Shopping: ["amazon", "shopping", "clothes", "shoes", "store", "shirt", "jeans", "dress"],
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

/** Items that store value beyond consumption — a likely asset, not an expense. */
const ASSET_KEYWORDS: { regex: RegExp; kind: AssetKind; name: string }[] = [
  { regex: /\b(car|vehicle|truck|suv|motorbike|motorcycle|scooter|bike|bicycle)\b/i, kind: "vehicle", name: "Vehicle" },
  { regex: /\b(house|apartment|flat|condo|property|real estate|land|plot)\b/i, kind: "property", name: "Property" },
  { regex: /\b(watch|rolex|jewelry|jewellery|necklace|ring|diamond|gold|silver|art|painting|collectible)\b/i, kind: "valuable", name: "Valuable" },
  { regex: /\b(laptop|macbook|iphone|ipad|computer|pc|camera|console|playstation|xbox)\b/i, kind: "electronics", name: "Electronics" },
  { regex: /\b(furniture|sofa|couch|bed|mattress|table|desk|chair)\b/i, kind: "furniture", name: "Furniture" },
  { regex: /\bcash\b/i, kind: "cash", name: "Cash" },
  { regex: /\b(saving|savings|deposit|account|hysa)\b/i, kind: "savings", name: "Savings" },
];

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

function extractAmounts(text: string): number[] {
  const amounts: number[] = [];
  const rangeRe = /(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  const consumed: [number, number][] = [];
  while ((m = rangeRe.exec(text))) {
    const a = parseFloat(m[1]);
    const b = parseFloat(m[2]);
    if (a < 10_000_000 && b < 10_000_000 && Math.abs(b - a) < Math.max(a, b)) {
      amounts.push((a + b) / 2);
      consumed.push([m.index, m.index + m[0].length]);
    }
  }
  const numRe = /(?<![\w.])(\d+(?:\.\d+)?)(k|m)?(?![\w.])/gi;
  while ((m = numRe.exec(text))) {
    const start = m.index;
    if (consumed.some(([s, e]) => start >= s && start < e)) continue;
    let n = parseFloat(m[1]);
    if (m[2]?.toLowerCase() === "k") n *= 1000;
    if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
    if (n > 0 && n < 100_000_000) amounts.push(n);
  }
  return amounts;
}

function detectAsset(text: string): { kind: AssetKind; name: string } | null {
  for (const a of ASSET_KEYWORDS) {
    if (a.regex.test(text)) return { kind: a.kind, name: a.name };
  }
  return null;
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

function detectIntent(text: string): { intent: Intent; assetMatch: { kind: AssetKind; name: string } | null; cryptoMatch: { symbol: string; name: string } | null } {
  const t = text.toLowerCase().trim();
  const assetMatch = detectAsset(text);
  const cryptoMatch = detectCrypto(text);

  if (!t) return { intent: "unknown", assetMatch, cryptoMatch };

  if (/^(how|what|where|when|why|am i|do i|is my|are my|can you|tell me|show)/.test(t) || t.endsWith("?")) {
    return { intent: "question", assetMatch, cryptoMatch };
  }
  if (/^(i want to|my goal|goal:|set goal|i'd like to save)\b/.test(t) || /\bgoal\b/.test(t)) {
    return { intent: "goal_create", assetMatch, cryptoMatch };
  }
  if (/(actually|correction|fix that|change that|wrong)/.test(t)) {
    return { intent: "correction", assetMatch, cryptoMatch };
  }
  if (/(received|got paid|salary|paycheck|earned|client paid|income)/.test(t)) {
    return { intent: "income_log", assetMatch, cryptoMatch };
  }

  // Investments first — crypto/stock keywords are unambiguous.
  if (cryptoMatch) return { intent: "investment_log", assetMatch, cryptoMatch };
  if (/\b(stock|share|shares|etf|bond|brokerage|invest|investment|portfolio)\b/.test(t)) {
    return { intent: "investment_log", assetMatch, cryptoMatch };
  }

  // Asset detection — items that retain value.
  if (assetMatch) {
    // "added cash", "put 5k in savings" — pure asset moves
    if (assetMatch.kind === "cash" || assetMatch.kind === "savings") {
      return { intent: "asset_log", assetMatch, cryptoMatch };
    }
    // "bought a car for 65k" / "purchased a watch"
    if (/\b(bought|purchased|got|acquired|added|own|have)\b/.test(t)) {
      return { intent: "asset_log", assetMatch, cryptoMatch };
    }
  }

  // Expense — money spent on consumption.
  if (/(spent|paid|cost|charged|tipped)/.test(t)) {
    return { intent: "expense_log", assetMatch, cryptoMatch };
  }
  // "Bought lunch" without asset keyword — expense.
  if (/\b(bought|got)\b/.test(t)) {
    return { intent: "expense_log", assetMatch, cryptoMatch };
  }
  if (extractAmounts(text).length > 0) {
    return { intent: "expense_log", assetMatch, cryptoMatch };
  }
  return { intent: "unknown", assetMatch, cryptoMatch };
}

export function parseMessage(text: string, baseCurrency: Currency): ParsedResult {
  const { intent, assetMatch, cryptoMatch } = detectIntent(text);
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

    // Ambiguity check: a big-ticket purchase with no asset keyword and no
    // strong consumption keyword — ask before classifying.
    const big = amounts[0] >= 1500;
    const hasConsumption = /(food|lunch|dinner|coffee|uber|taxi|hotel|flight|rent|bill|spotify|netflix|movie|drinks)/i.test(text);
    if (big && intent === "expense_log" && !assetMatch && !hasConsumption && /\bbought\b/i.test(text)) {
      return {
        intent: "clarify",
        suggestedIntent: "asset_log",
        entries: [{ amount: amounts[0], currency, date, assetKind: "other", assetName: "Item" }],
        confidence: 0.55,
        reply: "Should I track this as an asset (keeps value) or log it as an expense?",
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
      intent === "income_log"
        ? `Income recorded: ${currencySymbol(currency)}${formatNum(total)}.`
        : entries.length === 1
          ? `Logged expense: ${currencySymbol(currency)}${formatNum(total)} · ${category}.`
          : `Logged ${entries.length} expenses totaling ${currencySymbol(currency)}${formatNum(total)}.`;
    return { intent, entries, confidence: 0.9, reply };
  }

  if (intent === "investment_log") {
    const amounts = extractAmounts(text);
    if (cryptoMatch) {
      const isQty = /\b(add|have|own|hold)\b/i.test(text) && !/\bworth\b/i.test(text);
      const value = amounts[0] ?? 0;
      const entry: ParsedEntry = isQty
        ? { quantity: value, symbol: cryptoMatch.symbol, assetKind: "crypto", assetName: cryptoMatch.name, currency }
        : { amount: value, currency, symbol: cryptoMatch.symbol, assetKind: "crypto", assetName: cryptoMatch.name };
      return {
        intent,
        entries: [entry],
        confidence: 0.9,
        reply: isQty
          ? `Added ${value} ${cryptoMatch.symbol} to investments.`
          : `Invested ${currencySymbol(currency)}${formatNum(value)} in ${cryptoMatch.symbol}.`,
      };
    }
    if (amounts.length) {
      return {
        intent,
        entries: [{ amount: amounts[0], currency, assetKind: "stock", assetName: "Investment" }],
        confidence: 0.65,
        reply: `Invested ${currencySymbol(currency)}${formatNum(amounts[0])}.`,
      };
    }
    return {
      intent: "unknown",
      entries: [],
      confidence: 0.3,
      reply: "How much did you invest, and in what?",
    };
  }

  if (intent === "asset_log") {
    const amounts = extractAmounts(text);
    const kind: AssetKind = assetMatch?.kind ?? "other";
    const name = niceAssetName(text, assetMatch);

    if (amounts.length === 0) {
      return {
        intent: "unknown",
        entries: [],
        confidence: 0.4,
        reply: `What's the value of the ${name.toLowerCase()}?`,
      };
    }
    return {
      intent,
      entries: [{ amount: amounts[0], currency, assetKind: kind, assetName: name }],
      confidence: 0.88,
      reply:
        kind === "cash" || kind === "savings"
          ? `Added ${currencySymbol(currency)}${formatNum(amounts[0])} to ${name.toLowerCase()}.`
          : `Tracked new asset: ${name} · ${currencySymbol(currency)}${formatNum(amounts[0])}.`,
    };
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
      reply: "",
    };
  }

  return {
    intent: "unknown",
    entries: [],
    confidence: 0.2,
    reply: "That's outside your financial system. Try logging spending, an asset, or asking about your money.",
  };
}

function niceAssetName(text: string, match: { kind: AssetKind; name: string } | null): string {
  if (!match) return "Asset";
  // pull the actual matched word for nicer naming
  const m = text.match(/\b(car|truck|suv|motorcycle|bike|house|apartment|condo|property|land|watch|rolex|jewelry|necklace|ring|gold|art|laptop|macbook|iphone|ipad|computer|camera|console|sofa|couch|bed|table|desk|chair|cash|savings)\b/i);
  if (m) {
    const word = m[1].toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return match.name;
}

function extractMerchant(text: string, category: TxCategory): string | undefined {
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
