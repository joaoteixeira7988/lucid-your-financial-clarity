export type Currency = "USD" | "EUR" | "GBP" | "AED";

export type TxCategory =
  | "Food"
  | "Groceries"
  | "Transport"
  | "Shopping"
  | "Bills"
  | "Entertainment"
  | "Health"
  | "Travel"
  | "Income"
  | "Other";

/** Where the entry came from. Future: receipts, bank sync, CSV import. */
export type EntrySource = "text" | "quick" | "receipt" | "bank" | "import";

export type Transaction = {
  id: string;
  amount: number; // in base currency
  currency: Currency;
  category: TxCategory;
  merchant?: string;
  note?: string;
  date: string; // ISO
  type: "expense" | "income";
  source?: EntrySource;
  /** Confidence the parser had when classifying. 0–1. */
  confidence?: number;
};

export type AssetKind =
  | "cash"
  | "savings"
  | "crypto"
  | "stock"
  | "vehicle"
  | "property"
  | "valuable" // watch, jewelry, art
  | "electronics"
  | "furniture"
  | "other";

export type Asset = {
  id: string;
  kind: AssetKind;
  symbol?: string; // e.g. ETH, BTC
  name: string;
  quantity?: number; // for crypto/stock
  /** Stored amount, denominated in `currency`. For crypto/stock this is the
   *  fallback used only when live prices are unavailable. */
  value: number;
  /** Original currency the value/costBasis are stored in. Defaults to USD. */
  currency?: Currency;
  costBasis?: number; // optional purchase price (in `currency`)
  note?: string;
  createdAt: string;
};

export type Liability = {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  createdAt: string;
};

export type Goal = {
  id: string;
  title: string;
  type: "save" | "spend_less" | "net_worth";
  targetAmount: number;
  category?: TxCategory;
  timeframe: "week" | "month" | "year";
  deadline: string; // ISO
  createdAt: string;
};

export type ActivityKind =
  | "expense"
  | "income"
  | "asset"
  | "investment"
  | "cash"
  | "goal"
  | "insight"
  | "system";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  text: string;
  date: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  date: string;
};

export type Intent =
  | "expense_log"
  | "income_log"
  | "asset_log"
  | "investment_log"
  | "question"
  | "goal_create"
  | "correction"
  | "clarify"
  | "unknown";

export type ParsedEntry = {
  amount?: number;
  currency?: Currency;
  category?: TxCategory;
  merchant?: string;
  date?: string;
  symbol?: string;
  quantity?: number;
  assetKind?: AssetKind;
  assetName?: string;
  /** True when category was inferred from past behavior, not text. */
  categoryInferred?: boolean;
  source?: EntrySource;
  /** True only when the user explicitly says they just bought/purchased the asset now. */
  isNewPurchase?: boolean;
};

export type ParsedResult = {
  intent: Intent;
  entries: ParsedEntry[];
  goal?: Partial<Goal>;
  question?: string;
  confidence: number;
  reply: string;
  /** When intent is `clarify`, this is the candidate intent we'd otherwise use. */
  suggestedIntent?: Intent;
};
