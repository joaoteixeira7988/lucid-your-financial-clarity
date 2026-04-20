import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import {
  useAppStore,
  getInvestmentValue,
  getTangibleAssetValue,
  getAssetValueInBase,
  TANGIBLE_ASSET_KINDS,
} from "@/lib/store";
import { fmtMoney, toBase } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Asset, AssetKind } from "@/lib/types";
import { Car, Home as HomeIcon, Gem, Laptop, Sofa, Package } from "lucide-react";

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
  const [view, setView] = useState<"investments" | "assets">("investments");
  const state = useAppStore();
  const base = state.baseCurrency;
  const investTotal = getInvestmentValue(state);
  const assetTotal = getTangibleAssetValue(state);

  return (
    <AppShell subtitle="Portfolio">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Portfolio</h1>
      </div>

      {/* Segmented control */}
      <div className="mb-4 grid grid-cols-2 rounded-xl border border-border bg-surface/60 p-0.5">
        {(["investments", "assets"] as const).map((v) => (
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
      ) : (
        <AssetsView state={state} base={base} total={assetTotal} />
      )}
    </AppShell>
  );
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
  const investAssets = state.assets.filter((a) => a.kind === "crypto" || a.kind === "stock");
  const pricesLoaded = Object.keys(state.cryptoPrices).length > 0;

  return (
    <>
      <MetricCard
        prominent
        label="Portfolio value"
        value={fmtMoney(total, base, { compact: true })}
        delta={{ value: "+5.2%", positive: true }}
        hint={pricesLoaded ? "live prices · 30d est." : "cached prices"}
      />

      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Holdings
        </h2>
        <ul className="divide-y divide-border">
          {investAssets.map((a) => {
            const value = getAssetValueInBase(a, base, state.cryptoPrices);
            const share = total > 0 ? (value / total) * 100 : 0;
            const price = a.symbol ? state.cryptoPrices[a.symbol] : undefined;
            const priceInBase = price ? toBase(price, "USD", base) : undefined;
            return (
              <li key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-[12px] font-bold tracking-tight text-foreground"
                  >
                    {a.symbol?.slice(0, 3) ?? "AST"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">{a.name}</p>
                    <p className="tabular text-[11px] text-muted-foreground">
                      {a.quantity != null && a.symbol ? `${a.quantity} ${a.symbol}` : a.kind}
                      {priceInBase ? ` · ${fmtMoney(priceInBase, base)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tabular text-[14px] font-semibold text-foreground">
                    {fmtMoney(value, base, { compact: true })}
                  </p>
                  <p className="tabular text-[11px] text-muted-foreground">{share.toFixed(0)}%</p>
                </div>
              </li>
            );
          })}
          {investAssets.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted-foreground">
              No holdings yet. Try “Add 0.2 ETH” or “Bought $500 of BTC”.
            </li>
          )}
        </ul>
      </section>

      {investAssets.length > 0 && (
        <section className="lucid-card mt-4 p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Allocation
          </h2>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
            {investAssets.map((a, i) => {
              const value = getAssetValueInBase(a, base, state.cryptoPrices);
              const share = total > 0 ? (value / total) * 100 : 0;
              return (
                <div
                  key={a.id}
                  style={{ width: `${share}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
                  title={`${a.symbol ?? a.name} ${share.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {investAssets.slice(0, 5).map((a, i) => {
              const value = getAssetValueInBase(a, base, state.cryptoPrices);
              const share = total > 0 ? (value / total) * 100 : 0;
              return (
                <span key={a.id} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                  />
                  {a.symbol ?? a.name} {share.toFixed(0)}%
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
            const value = getAssetValueInBase(a, base, state.cryptoPrices);
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
