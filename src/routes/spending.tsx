import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { SwipeRow } from "@/components/SwipeRow";
import { useAppStore, getCategorySpend, getSpendInRange } from "@/lib/store";
import { fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toBase } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/spending")({
  head: () => ({
    meta: [
      { title: "Spending — Lucid" },
      { name: "description", content: "See where your money is going. Categorized, simple, calm." },
      { property: "og:title", content: "Spending — Lucid" },
      { property: "og:description", content: "Categorized spending, weekly and monthly." },
    ],
  }),
  component: SpendingPage,
});

const CATEGORY_COLORS: Record<string, string> = {
  Food: "oklch(0.66 0.18 252)",
  Groceries: "oklch(0.72 0.17 152)",
  Transport: "oklch(0.78 0.14 75)",
  Shopping: "oklch(0.7 0.18 320)",
  Bills: "oklch(0.66 0.21 25)",
  Entertainment: "oklch(0.7 0.15 200)",
  Health: "oklch(0.75 0.13 130)",
  Travel: "oklch(0.7 0.14 50)",
  Other: "oklch(0.55 0.02 268)",
};

function SpendingPage() {
  const [range, setRange] = useState<"week" | "month">("week");
  const days = range === "week" ? 7 : 30;
  const state = useAppStore();
  const base = state.baseCurrency;

  const total = getSpendInRange(state, days);
  const cats = getCategorySpend(state, days).filter((c) => c.category !== "Income");
  const max = cats[0]?.amount ?? 0;

  const recent = state.transactions
    .filter((t) => t.type === "expense")
    .slice(0, 10);

  return (
    <AppShell subtitle="Spending">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-semibold tracking-tight">Spending</h1>
        <div className="flex rounded-xl border border-border bg-surface/60 p-0.5">
          {(["week", "month"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all",
                range === r ? "bg-surface-elevated text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <MetricCard
        prominent
        label={`Total this ${range}`}
        value={fmtMoney(total, base, { compact: true })}
        hint={`${cats.length} categories`}
      />

      {/* Category bars */}
      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          By category
        </h2>
        {cats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spending logged yet.</p>
        ) : (
          <ul className="space-y-3.5">
            {cats.map((c) => {
              const pct = max > 0 ? (c.amount / max) * 100 : 0;
              const share = total > 0 ? (c.amount / total) * 100 : 0;
              return (
                <li key={c.category}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[c.category] ?? "var(--color-muted-foreground)" }}
                      />
                      <span className="text-[13px] font-medium text-foreground">{c.category}</span>
                      <span className="tabular text-[11px] text-muted-foreground">{share.toFixed(0)}%</span>
                    </div>
                    <span className="tabular text-[13px] font-semibold text-foreground">
                      {fmtMoney(c.amount, base)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CATEGORY_COLORS[c.category] ?? "var(--color-muted-foreground)",
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recent transactions */}
      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Recent
        </h2>
        <ul className="divide-y divide-border">
          {recent.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-foreground">
                  {t.merchant ?? t.category}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.category} · {format(new Date(t.date), "MMM d")}
                </p>
              </div>
              <span className="tabular text-[14px] font-semibold text-foreground">
                −{fmtMoney(toBase(t.amount, t.currency, base), base)}
              </span>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">
              Nothing here yet — try “Spent $24 on lunch”.
            </li>
          )}
        </ul>
      </section>
    </AppShell>
  );
}
