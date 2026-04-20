import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActivityItem,
  Asset,
  ChatMessage,
  Currency,
  Goal,
  Transaction,
  TxCategory,
} from "./types";
import { toBase } from "./currency";

const uid = () => Math.random().toString(36).slice(2, 10);

type State = {
  baseCurrency: Currency;
  transactions: Transaction[];
  assets: Asset[];
  goals: Goal[];
  activity: ActivityItem[];
  messages: ChatMessage[];
  cryptoPrices: Record<string, number>; // symbol -> USD price
  pricesLoadedAt?: string;

  // setters
  setBaseCurrency: (c: Currency) => void;
  addTransaction: (t: Omit<Transaction, "id">) => Transaction;
  addAsset: (a: Omit<Asset, "id" | "createdAt">) => Asset;
  addGoal: (g: Omit<Goal, "id" | "createdAt">) => Goal;
  addActivity: (kind: ActivityItem["kind"], text: string) => void;
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
  { id: uid(), kind: "cash", name: "Checking", value: 3200, createdAt: new Date().toISOString() },
  {
    id: uid(),
    kind: "savings",
    name: "High-yield savings",
    value: 12400,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    kind: "crypto",
    symbol: "BTC",
    name: "Bitcoin",
    quantity: 0.12,
    value: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    kind: "crypto",
    symbol: "ETH",
    name: "Ethereum",
    quantity: 1.4,
    value: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(),
    kind: "stock",
    symbol: "VOO",
    name: "S&P 500 ETF",
    quantity: 12,
    value: 6240,
    createdAt: new Date().toISOString(),
  },
];

const seedActivity = (): ActivityItem[] => {
  const now = Date.now();
  return [
    { id: uid(), kind: "system", text: "Lucid initialized — your financial system is ready.", date: new Date(now - 1000 * 60 * 60 * 26).toISOString() },
    { id: uid(), kind: "asset", text: "Detected 0.12 BTC and 1.4 ETH in portfolio.", date: new Date(now - 1000 * 60 * 60 * 25).toISOString() },
    { id: uid(), kind: "log", text: "Logged $62 to Groceries.", date: new Date(now - 1000 * 60 * 60 * 22).toISOString() },
    { id: uid(), kind: "insight", text: "You're on track this month.", date: new Date(now - 1000 * 60 * 60 * 4).toISOString() },
    { id: uid(), kind: "log", text: "Logged $28 to Food.", date: new Date(now - 1000 * 60 * 30).toISOString() },
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
      goals: [],
      activity: [],
      messages: [],
      cryptoPrices: {},

      setBaseCurrency: (c) => set({ baseCurrency: c }),

      addTransaction: (t) => {
        const tx: Transaction = { ...t, id: uid() };
        set((s) => ({ transactions: [tx, ...s.transactions] }));
        return tx;
      },
      addAsset: (a) => {
        const asset: Asset = { ...a, id: uid(), createdAt: new Date().toISOString() };
        set((s) => ({ assets: [asset, ...s.assets] }));
        return asset;
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
          goals: [],
          activity: [],
          messages: [],
        }),

      seedDemo: () => {
        const base = get().baseCurrency;
        set({
          transactions: seedTransactions(base),
          assets: seedAssets(),
          goals: seedGoals(),
          activity: seedActivity(),
          messages: [],
        });
      },
    }),
    {
      name: "lucid-store-v1",
      onRehydrateStorage: () => (state) => {
        // Seed on first run
        if (state && state.transactions.length === 0 && state.assets.length === 0) {
          state.seedDemo();
        }
      },
    }
  )
);

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
  return state.assets.reduce((s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices), 0);
}

export function getInvestmentValue(state: State): number {
  return state.assets
    .filter((a) => a.kind === "crypto" || a.kind === "stock")
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
