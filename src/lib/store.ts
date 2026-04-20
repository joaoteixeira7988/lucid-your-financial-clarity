import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActivityItem,
  ActivityKind,
  Asset,
  ChatMessage,
  Currency,
  Goal,
  Liability,
  Transaction,
  TxCategory,
} from "./types";
import { toBase } from "./currency";

const uid = () => Math.random().toString(36).slice(2, 10);

type State = {
  baseCurrency: Currency;
  transactions: Transaction[];
  assets: Asset[];
  liabilities: Liability[];
  goals: Goal[];
  activity: ActivityItem[];
  messages: ChatMessage[];
  cryptoPrices: Record<string, number>; // symbol -> USD price
  pricesLoadedAt?: string;
  onboardingComplete: boolean;

  // setters
  setBaseCurrency: (c: Currency) => void;
  completeOnboarding: () => void;
  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  addAsset: (a: Omit<Asset, "id" | "createdAt">) => Asset;
  /** Adjust the value of the first cash asset, or create one. Returns new cash total in base. */
  adjustCash: (deltaInBase: number) => number;
  addLiability: (l: Omit<Liability, "id" | "createdAt">) => Liability;
  addGoal: (g: Omit<Goal, "id" | "createdAt">) => Goal;
  addActivity: (kind: ActivityKind, text: string) => void;
  addMessage: (m: Omit<ChatMessage, "id" | "date">) => ChatMessage;
  setCryptoPrices: (p: Record<string, number>) => void;
  resetAll: () => void;
  seedDemo: () => void;
};

const seedTransactions = (base: Currency): Transaction[] => {
  const now = Date.now();
  const day = 86400000;
  const mk = (d: number, amount: number, category: TxCategory, merchant?: string): Transaction => ({
    id: uid(),
    amount,
    currency: base,
    category,
    merchant,
    date: new Date(now - d * day).toISOString(),
    type: "expense",
  });
  return [
    mk(0, 14.5, "Food", "Coffee & croissant"),
    mk(0, 28, "Food", "Lunch"),
    mk(1, 62, "Groceries", "Whole Foods"),
    mk(1, 18, "Transport", "Uber"),
    mk(2, 42, "Food", "Dinner"),
    mk(2, 9.99, "Bills", "Spotify"),
    mk(3, 120, "Shopping", "Amazon"),
    mk(4, 24, "Transport", "Uber"),
    mk(5, 75, "Entertainment", "Cinema night"),
    mk(6, 35, "Food", "Brunch"),
    mk(8, 1450, "Bills", "Rent"),
    mk(10, 88, "Groceries"),
    mk(12, 16, "Transport"),
    mk(15, 230, "Travel", "Hotel"),
    mk(20, 4500, "Income", "Salary"),
  ].map((t) => ({ ...t, type: t.category === "Income" ? "income" : "expense" }));
};

const seedAssets = (): Asset[] => [
  { id: uid(), kind: "cash", name: "Cash", value: 3200, createdAt: new Date().toISOString() },
  { id: uid(), kind: "savings", name: "High-yield savings", value: 12400, createdAt: new Date().toISOString() },
  { id: uid(), kind: "vehicle", name: "Car", value: 28000, costBasis: 32000, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 200).toISOString() },
  { id: uid(), kind: "valuable", name: "Watch", value: 6500, costBasis: 6800, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString() },
  { id: uid(), kind: "crypto", symbol: "BTC", name: "Bitcoin", quantity: 0.12, value: 0, createdAt: new Date().toISOString() },
  { id: uid(), kind: "crypto", symbol: "ETH", name: "Ethereum", quantity: 1.4, value: 0, createdAt: new Date().toISOString() },
  { id: uid(), kind: "stock", symbol: "VOO", name: "S&P 500 ETF", quantity: 12, value: 6240, createdAt: new Date().toISOString() },
];

const seedActivity = (): ActivityItem[] => {
  const now = Date.now();
  return [
    { id: uid(), kind: "system", text: "Lucid initialized — your financial system is ready.", date: new Date(now - 1000 * 60 * 60 * 26).toISOString() },
    { id: uid(), kind: "asset", text: "Tracked asset: Car ($28,000).", date: new Date(now - 1000 * 60 * 60 * 25).toISOString() },
    { id: uid(), kind: "investment", text: "Detected 0.12 BTC and 1.4 ETH in portfolio.", date: new Date(now - 1000 * 60 * 60 * 24).toISOString() },
    { id: uid(), kind: "expense", text: "Logged expense: Groceries ($62).", date: new Date(now - 1000 * 60 * 60 * 22).toISOString() },
    { id: uid(), kind: "insight", text: "Net worth recalculated.", date: new Date(now - 1000 * 60 * 60 * 4).toISOString() },
    { id: uid(), kind: "expense", text: "Logged expense: Food ($28).", date: new Date(now - 1000 * 60 * 30).toISOString() },
  ];
};

const seedGoals = (): Goal[] => [
  {
    id: uid(),
    title: "Save $5,000",
    type: "save",
    targetAmount: 5000,
    timeframe: "month",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
];

export const useAppStore = create<State>()(
  persist(
    (set, get) => ({
      baseCurrency: "USD",
      transactions: [],
      assets: [],
      liabilities: [],
      goals: [],
      activity: [],
      messages: [],
      cryptoPrices: {},
      onboardingComplete: false,

      setBaseCurrency: (c) => set({ baseCurrency: c }),
      completeOnboarding: () => set({ onboardingComplete: true }),

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid() };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        return tx;
      },
      updateTransaction: (id, patch) => {
        set((s) => ({
          transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
      },
      addAsset: (a) => {
        const asset: Asset = { ...a, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ assets: [asset, ...s.assets] }));
        return asset;
      },
      adjustCash: (deltaInBase) => {
        const s = get();
        const cash = s.assets.find((a) => a.kind === "cash");
        if (!cash) {
          // Auto-create a cash asset so net worth stays coherent.
          const created: Asset = {
            id: uid(),
            kind: "cash",
            name: "Cash",
            value: Math.max(0, deltaInBase),
            createdAt: new Date().toISOString(),
          };
          set({ assets: [created, ...s.assets] });
          return created.value;
        }
        const next = cash.value + deltaInBase;
        set({
          assets: s.assets.map((a) => (a.id === cash.id ? { ...a, value: next } : a)),
        });
        return next;
      },
      addLiability: (l) => {
        const liab: Liability = { ...l, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ liabilities: [liab, ...s.liabilities] }));
        return liab;
      },
      addGoal: (g) => {
        const goal: Goal = { ...g, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ goals: [goal, ...s.goals] }));
        return goal;
      },
      addActivity: (kind, text) =>
        set((s) => ({
          activity: [{ id: uid(), kind, text, date: new Date().toISOString() }, ...s.activity].slice(0, 80),
        })),
      addMessage: (m) => {
        const msg: ChatMessage = { ...m, id: uid(), date: new Date().toISOString() };
        set((s) => ({ messages: [...s.messages, msg].slice(-200) }));
        return msg;
      },
      setCryptoPrices: (p) => set({ cryptoPrices: p, pricesLoadedAt: new Date().toISOString() }),

      resetAll: () =>
        set({
          transactions: [],
          assets: [],
          liabilities: [],
          goals: [],
          activity: [],
          messages: [],
        }),

      seedDemo: () => {
        const base = get().baseCurrency;
        set({
          transactions: seedTransactions(base),
          assets: seedAssets(),
          liabilities: [],
          goals: seedGoals(),
          activity: seedActivity(),
          messages: [],
        });
      },
    }),
    {
      name: "lucid-store-v2",
      onRehydrateStorage: () => (state) => {
        if (state && state.transactions.length === 0 && state.assets.length === 0) {
          state.seedDemo();
        }
      },
    }
  )
);

// --- Asset classification helpers ---

export const INVESTMENT_KINDS = new Set<Asset["kind"]>(["crypto", "stock"]);
export const CASH_KINDS = new Set<Asset["kind"]>(["cash", "savings"]);
export const TANGIBLE_ASSET_KINDS = new Set<Asset["kind"]>([
  "vehicle",
  "property",
  "valuable",
  "electronics",
  "furniture",
  "other",
]);

// --- Derived selectors ---

export function getAssetValueInBase(asset: Asset, base: Currency, prices: Record<string, number>): number {
  if (asset.kind === "crypto" && asset.symbol && asset.quantity != null) {
    const usd = (prices[asset.symbol] ?? 0) * asset.quantity;
    if (usd > 0) return toBase(usd, "USD", base);
    return asset.value || 0;
  }
  return asset.value || 0;
}

export function getNetWorth(state: State): number {
  const assetTotal = state.assets.reduce(
    (s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices),
    0
  );
  const liabilityTotal = state.liabilities.reduce(
    (s, l) => s + toBase(l.amount, l.currency, state.baseCurrency),
    0
  );
  return assetTotal - liabilityTotal;
}

export function getInvestmentValue(state: State): number {
  return state.assets
    .filter((a) => INVESTMENT_KINDS.has(a.kind))
    .reduce((s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices), 0);
}

export function getTangibleAssetValue(state: State): number {
  return state.assets
    .filter((a) => TANGIBLE_ASSET_KINDS.has(a.kind))
    .reduce((s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices), 0);
}

export function getCashTotal(state: State): number {
  return state.assets
    .filter((a) => CASH_KINDS.has(a.kind))
    .reduce((s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices), 0);
}

export function getSpendInRange(state: State, days: number): number {
  const cutoff = Date.now() - days * 86400000;
  return state.transactions
    .filter((t) => t.type === "expense" && new Date(t.date).getTime() >= cutoff)
    .reduce((s, t) => s + toBase(t.amount, t.currency, state.baseCurrency), 0);
}

export function getCategorySpend(state: State, days: number): { category: TxCategory; amount: number }[] {
  const cutoff = Date.now() - days * 86400000;
  const map = new Map<TxCategory, number>();
  state.transactions
    .filter((t) => t.type === "expense" && new Date(t.date).getTime() >= cutoff)
    .forEach((t) => {
      const v = toBase(t.amount, t.currency, state.baseCurrency);
      map.set(t.category, (map.get(t.category) ?? 0) + v);
    });
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function getRecentActivityKinds(state: State, count = 5): ActivityKind[] {
  return state.activity.slice(0, count).map((a) => a.kind);
}
