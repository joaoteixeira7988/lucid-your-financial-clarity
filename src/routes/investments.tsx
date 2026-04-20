import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { useAppStore, getInvestmentValue, getAssetValueInBase } from "@/lib/store";
import { fmtMoney, toBase } from "@/lib/currency";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investments — Lucid" },
      { name: "description", content: "Live crypto pricing, holdings, allocation, and performance." },
      { property: "og:title", content: "Investments — Lucid" },
      { property: "og:description", content: "Holdings and live pricing in one calm view." },
    ],
  }),
  component: InvestmentsPage,
});

function InvestmentsPage() {
  const state = useAppStore();
  const base = state.baseCurrency;
  const total = getInvestmentValue(state);
  const investAssets = state.assets.filter((a) => a.kind === "crypto" || a.kind === "stock");
  const pricesLoaded = Object.keys(state.cryptoPrices).length > 0;

  return (
    <AppShell subtitle="Investments">
      <div className="mb-4 flex items-end justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Investments</h1>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            className={`relative flex h-1.5 w-1.5 ${pricesLoaded ? "" : "opacity-50"}`}
          >
            {pricesLoaded && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${pricesLoaded ? "bg-success" : "bg-muted-foreground"}`}
            />
          </span>
          {pricesLoaded ? "Live prices" : "Cached"}
        </span>
      </div>

      <MetricCard
        prominent
        label="Portfolio value"
        value={fmtMoney(total, base, { compact: true })}
        delta={{ value: "+5.2%", positive: true }}
        hint="last 30d (est.)"
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
                    {a.symbol?.slice(0, 3) ?? "ASSET"}
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
              No holdings yet. Try “Add 0.2 ETH”.
            </li>
          )}
        </ul>
      </section>

      {/* Allocation bar */}
      {investAssets.length > 0 && (
        <section className="lucid-card mt-4 p-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Allocation
          </h2>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
            {investAssets.map((a, i) => {
              const value = getAssetValueInBase(a, base, state.cryptoPrices);
              const share = total > 0 ? (value / total) * 100 : 0;
              const palette = [
                "oklch(0.66 0.18 252)",
                "oklch(0.72 0.17 152)",
                "oklch(0.78 0.14 75)",
                "oklch(0.7 0.18 320)",
                "oklch(0.66 0.21 25)",
              ];
              return (
                <div
                  key={a.id}
                  style={{ width: `${share}%`, backgroundColor: palette[i % palette.length] }}
                  title={`${a.symbol ?? a.name} ${share.toFixed(0)}%`}
                />
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
            {investAssets.slice(0, 5).map((a, i) => {
              const palette = [
                "oklch(0.66 0.18 252)",
                "oklch(0.72 0.17 152)",
                "oklch(0.78 0.14 75)",
                "oklch(0.7 0.18 320)",
                "oklch(0.66 0.21 25)",
              ];
              const value = getAssetValueInBase(a, base, state.cryptoPrices);
              const share = total > 0 ? (value / total) * 100 : 0;
              return (
                <span key={a.id} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: palette[i % palette.length] }}
                  />
                  {a.symbol ?? a.name} {share.toFixed(0)}%
                </span>
              );
            })}
          </div>
        </section>
      )}
    </AppShell>
  );
}
// silence unused import warning by referencing them once if needed
void TrendingUp;
void TrendingDown;
