import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import {
  useAppStore,
  getInvestmentValue,
  getTangibleAssetValue,
  getAssetValueInBase,
  getNetWorth,
  getCashTotal,
  TANGIBLE_ASSET_KINDS,
  CASH_KINDS,
} from "@/lib/store";
import { fmtMoney, toBase } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Asset, AssetKind } from "@/lib/types";
import { Car, Home as HomeIcon, Gem, Laptop, Sofa, Package, Wallet, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Lucid" },
      { name: "description", content: "Your investments and tracked assets in one calm view." },
      { property: "og:title", content: "Portfolio — Lucid" },
      { property: "og:description", content: "Holdings, allocation, and tracked assets." },
    ],
  }),
  component: PortfolioPage,
});

const ASSET_ICON: Record<AssetKind, React.ComponentType<{ className?: string }>> = {
  vehicle: Car,
  property: HomeIcon,
  valuable: Gem,
  electronics: Laptop,
  furniture: Sofa,
  other: Package,
  cash: Package,
  savings: Package,
  crypto: Package,
  stock: Package,
};

const PALETTE = [
  "oklch(0.66 0.18 252)",
  "oklch(0.72 0.17 152)",
  "oklch(0.78 0.14 75)",
  "oklch(0.7 0.18 320)",
  "oklch(0.66 0.21 25)",
];

function PortfolioPage() {
  const [view, setView] = useState<"investments" | "assets" | "cash">("investments");
  const state = useAppStore();
  const base = state.baseCurrency;
  const investTotal = getInvestmentValue(state);
  const assetTotal = getTangibleAssetValue(state);
  const cashTotal = getCashTotal(state);
  const netWorth = getNetWorth(state);

  const cashOnly = state.assets
    .filter((a) => a.kind === "cash")
    .reduce((s, a) => s + getAssetValueInBase(a, base, state.cryptoPrices, state.stockPrices), 0);
  const savingsOnly = state.assets
    .filter((a) => a.kind === "savings")
    .reduce((s, a) => s + getAssetValueInBase(a, base, state.cryptoPrices, state.stockPrices), 0);

  return (
    <AppShell subtitle="Portfolio">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Portfolio</h1>
      </div>

      {/* Total — reconciles with Net Worth */}
      <section className="lucid-card relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.66 0.18 252 / 0.18) 0%, transparent 55%)",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Total
          </p>
          <p className="tabular mt-1.5 text-[34px] font-semibold leading-none tracking-tight">
            {fmtMoney(netWorth, base, { compact: true })}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
            {cashOnly > 0 && (
              <span>Cash <span className="tabular text-foreground/85">{fmtMoney(cashOnly, base, { compact: true })}</span></span>
            )}
            {savingsOnly > 0 && (
              <span>· Savings <span className="tabular text-foreground/85">{fmtMoney(savingsOnly, base, { compact: true })}</span></span>
            )}
            {investTotal > 0 && (
              <span>· Investments <span className="tabular text-foreground/85">{fmtMoney(investTotal, base, { compact: true })}</span></span>
            )}
            {assetTotal > 0 && (
              <span>· Assets <span className="tabular text-foreground/85">{fmtMoney(assetTotal, base, { compact: true })}</span></span>
            )}
          </div>
        </div>
      </section>

      {/* Segmented control */}
      <div className="my-4 grid grid-cols-3 rounded-xl border border-border bg-surface/60 p-0.5">
        {(["investments", "assets", "cash"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-lg px-3 py-2 text-[12.5px] font-medium capitalize transition-all",
              view === v
                ? "bg-surface-elevated text-foreground shadow-sm"
                : "text-muted-foreground"
            )}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "investments" ? (
        <InvestmentsView state={state} base={base} total={investTotal} />
      ) : view === "assets" ? (
        <AssetsView state={state} base={base} total={assetTotal} />
      ) : (
        <CashView state={state} base={base} total={cashTotal} />
      )}
    </AppShell>
  );
}

type GroupedHolding = {
  key: string;
  kind: "crypto" | "stock";
  symbol?: string;
  name: string;
  quantity: number;
  costBasis: number;
  value: number;
};

function groupHoldings(
  assets: Asset[],
  base: ReturnType<typeof useAppStore.getState>["baseCurrency"],
  cryptoPrices: Record<string, number>,
  stockPrices: Record<string, number>
): GroupedHolding[] {
  const map = new Map<string, GroupedHolding>();
  for (const a of assets) {
    if (a.kind !== "crypto" && a.kind !== "stock") continue;
    const sym = a.symbol?.toUpperCase();
    const key = sym ? `${a.kind}:${sym}` : `${a.kind}:${a.id}`;
    const value = getAssetValueInBase(a, base, cryptoPrices, stockPrices);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += a.quantity ?? 0;
      existing.costBasis += a.costBasis ?? 0;
      existing.value += value;
    } else {
      map.set(key, {
        key,
        kind: a.kind,
        symbol: sym,
        name: a.name,
        quantity: a.quantity ?? 0,
        costBasis: a.costBasis ?? 0,
        value,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.value - a.value);
}

function InvestmentsView({
  state,
  base,
  total,
}: {
  state: ReturnType<typeof useAppStore.getState>;
  base: ReturnType<typeof useAppStore.getState>["baseCurrency"];
  total: number;
}) {
  const holdings = groupHoldings(state.assets, base, state.cryptoPrices, state.stockPrices);
  const pricesLoaded =
    Object.keys(state.cryptoPrices).length > 0 ||
    Object.keys(state.stockPrices).length > 0;

  return (
    <>
      <MetricCard
        prominent
        label="Investments"
        value={fmtMoney(total, base, { compact: true })}
        delta={{ value: "+5.2%", positive: true }}
        hint={pricesLoaded ? "live prices · auto-refreshed" : "price pending"}
      />

      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Holdings
        </h2>
        <ul className="divide-y divide-border">
          {holdings.map((h) => {
            const share = total > 0 ? (h.value / total) * 100 : 0;
            const priceUsd = h.symbol
              ? h.kind === "crypto"
                ? state.cryptoPrices[h.symbol]
                : state.stockPrices[h.symbol]
              : undefined;
            const priceInBase = priceUsd ? toBase(priceUsd, "USD", base) : undefined;
            const change =
              h.costBasis > 0 && h.value > 0
                ? ((h.value - h.costBasis) / h.costBasis) * 100
                : null;
            const pl = h.costBasis > 0 ? h.value - h.costBasis : null;
            return (
              <li key={h.key} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-[12px] font-bold tracking-tight text-foreground"
                  >
                    {h.symbol?.slice(0, 3) ?? "AST"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">{h.name}</p>
                    <p className="tabular text-[11px] text-muted-foreground">
                      {h.quantity > 0 && h.symbol
                        ? `${h.quantity.toFixed(6).replace(/\.?0+$/, "")} ${h.symbol}`
                        : h.kind}
                      {priceInBase ? ` · ${fmtMoney(priceInBase, base)}` : h.symbol ? " · price pending" : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tabular text-[14px] font-semibold text-foreground">
                    {fmtMoney(h.value, base, { compact: true })}
                  </p>
                  <p className="tabular text-[11px] text-muted-foreground">
                    {share.toFixed(0)}%
                    {change !== null && (
                      <span className={cn("ml-1.5", change >= 0 ? "text-success" : "text-destructive")}>
                        {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                      </span>
                    )}
                    {pl !== null && (
                      <span className={cn("ml-1.5", pl >= 0 ? "text-success" : "text-destructive")}>
                        {pl >= 0 ? "+" : "−"}{fmtMoney(Math.abs(pl), base, { compact: true })}
                      </span>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
          {holdings.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              No holdings yet. Try “Add 0.2 ETH” or “Bought $500 of BTC”.
            </li>
          )}
        </ul>
      </section>

      {holdings.length > 0 && (
        <section className="lucid-card mt-4 p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Allocation
          </h2>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
            {holdings.map((h, i) => {
              const share = total > 0 ? (h.value / total) * 100 : 0;
              return (
                <div
                  key={h.key}
                  style={{ width: `${share}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                  title={`${h.symbol ?? h.name} ${share.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {holdings.slice(0, 5).map((h, i) => {
              const share = total > 0 ? (h.value / total) * 100 : 0;
              return (
                <span key={h.key} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  {h.symbol ?? h.name} {share.toFixed(0)}%
                </span>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function AssetsView({
  state,
  base,
  total,
}: {
  state: ReturnType<typeof useAppStore.getState>;
  base: ReturnType<typeof useAppStore.getState>["baseCurrency"];
  total: number;
}) {
  const tangibles: Asset[] = state.assets.filter((a) => TANGIBLE_ASSET_KINDS.has(a.kind));

  return (
    <>
      <MetricCard
        prominent
        label="Tracked assets"
        value={fmtMoney(total, base, { compact: true })}
        hint={`${tangibles.length} item${tangibles.length === 1 ? "" : "s"}`}
      />

      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Items
        </h2>
        <ul className="divide-y divide-border">
          {tangibles.map((a) => {
            const Icon = ASSET_ICON[a.kind] ?? Package;
            const value = getAssetValueInBase(a, base, state.cryptoPrices, state.stockPrices);
            const change = a.costBasis
              ? ((value - a.costBasis) / a.costBasis) * 100
              : null;
            return (
              <li key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">{a.name}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {a.kind}
                      {a.costBasis ? ` · cost ${fmtMoney(a.costBasis, base, { compact: true })}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tabular text-[14px] font-semibold text-foreground">
                    {fmtMoney(value, base, { compact: true })}
                  </p>
                  {change !== null && (
                    <p
                      className={cn(
                        "tabular text-[11px]",
                        change >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {change >= 0 ? "+" : ""}
                      {change.toFixed(1)}%
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {tangibles.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              No tracked assets yet. Try “Bought a car for 65k” or “Added a watch worth 8k”.
            </li>
          )}
        </ul>
      </section>

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground">
        Assets keep value over time. Use Lucid to track cars, property, watches, and other items
        that should count toward your net worth — separate from money you've spent.
      </p>
    </>
  );
}

function CashView({
  state,
  base,
  total,
}: {
  state: ReturnType<typeof useAppStore.getState>;
  base: ReturnType<typeof useAppStore.getState>["baseCurrency"];
  total: number;
}) {
  const cashAssets: Asset[] = state.assets.filter((a) => CASH_KINDS.has(a.kind));

  return (
    <>
      <MetricCard
        prominent
        label="Cash & savings"
        value={fmtMoney(total, base, { compact: true })}
        hint={`${cashAssets.length} account${cashAssets.length === 1 ? "" : "s"}`}
      />

      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Accounts
        </h2>
        <ul className="divide-y divide-border">
          {cashAssets.map((a) => {
            const Icon = a.kind === "savings" ? PiggyBank : Wallet;
            const value = getAssetValueInBase(a, base, state.cryptoPrices, state.stockPrices);
            return (
              <li key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-foreground"
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">{a.name}</p>
                    <p className="text-[11px] capitalize text-muted-foreground">{a.kind}</p>
                  </div>
                </div>
                <p className="tabular text-[14px] font-semibold text-foreground">
                  {fmtMoney(value, base, { compact: true })}
                </p>
              </li>
            );
          })}
          {cashAssets.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              No cash accounts yet. Try “I have $5,000 in checking” or “Added 10k to savings”.
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
