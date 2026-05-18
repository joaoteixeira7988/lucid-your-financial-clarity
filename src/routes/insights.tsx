import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAppStore, getSpendInRange, getNetWorth, getCategorySpend, getAssetValueInBase } from "@/lib/store";
import { fmtMoney } from "@/lib/currency";
import { Sparkles, Target, TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Lucid" },
      { name: "description", content: "AI-generated summaries, goal progress, and short strategic suggestions." },
      { property: "og:title", content: "Insights — Lucid" },
      { property: "og:description", content: "Weekly, monthly, and yearly progress in one calm view." },
    ],
  }),
  component: InsightsPage,
});

function pct(n: number, d: number): number {
  if (d <= 0) return 0;
  return Math.min(100, Math.max(0, (n / d) * 100));
}

function InsightsPage() {
  const state = useAppStore();
  const base = state.baseCurrency;
  const week = getSpendInRange(state, 7);
  const prevWeek = Math.max(0, getSpendInRange(state, 14) - week);
  const month = getSpendInRange(state, 30);
  const year = getSpendInRange(state, 365);
  const cats = getCategorySpend(state, 30).filter((c) => c.category !== "Income");
  const top = cats[0];
  const nw = getNetWorth(state);

  const weekChange = prevWeek > 0 ? ((week - prevWeek) / prevWeek) * 100 : 0;

  const summaries = [
    {
      label: "This week",
      value: fmtMoney(week, base),
      hint: prevWeek > 0
        ? `${weekChange >= 0 ? "+" : ""}${weekChange.toFixed(0)}% vs last week`
        : "first week of data",
      positive: weekChange < 0,
      icon: weekChange < 0 ? TrendingDown : TrendingUp,
    },
    { label: "This month", value: fmtMoney(month, base), hint: "spending so far", positive: true, icon: TrendingUp },
    { label: "This year", value: fmtMoney(year, base), hint: "trailing 12 months", positive: true, icon: TrendingUp },
  ];

  return (
    <AppShell subtitle="Insights">
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight">Insights</h1>

      {/* Hero insight */}
      <section className="lucid-card relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(120% 100% at 100% 0%, oklch(0.66 0.18 252 / 0.18) 0%, transparent 55%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Weekly summary
          </div>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground">
            {prevWeek > 0
              ? `You spent ${fmtMoney(week, base)} this week — ${weekChange >= 0 ? "up" : "down"} ${Math.abs(weekChange).toFixed(0)}% vs last week.`
              : `You spent ${fmtMoney(week, base)} this week.`}
            {top ? ` ${top.category} was your largest category.` : ""}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Net worth is {fmtMoney(nw, base, { compact: true })}.{" "}
            {weekChange < 0 ? "Nice work — keep the momentum." : "Small adjustments will compound."}
          </p>
        </div>
      </section>

      {/* Period summaries */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        {summaries.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="lucid-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{s.label}</p>
              <p className="tabular mt-1.5 text-[18px] font-semibold tracking-tight">{s.value}</p>
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <Icon className={`h-3 w-3 ${s.positive ? "text-success" : "text-destructive"}`} />
                {s.hint}
              </p>
            </div>
          );
        })}
      </section>

      {/* Goals */}
      <section className="lucid-card mt-4 overflow-hidden">
        <h2 className="border-b border-border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Goals
        </h2>
        <ul className="divide-y divide-border">
          {state.goals.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-muted-foreground">
              No active goals. Try: “I want to save $5,000 in 3 months”.
            </li>
          ) : (
            state.goals.map((g) => {
              // estimate: assume saved = current cash + savings - target offset
              const saved = state.assets
                .filter((a) => a.kind === "cash" || a.kind === "savings")
                .reduce((s, a) => s + getAssetValueInBase(a, state.baseCurrency, state.cryptoPrices, state.stockPrices), 0);
              const progress = g.type === "save" ? pct(saved, g.targetAmount) : 50;
              return (
                <li key={g.id} className="px-5 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Target className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[13.5px] font-medium text-foreground">{g.title}</p>
                        <p className="text-[11px] capitalize text-muted-foreground">{g.timeframe} goal</p>
                      </div>
                    </div>
                    <span className="tabular text-[12px] font-semibold text-foreground">
                      {progress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${progress}%`, background: "var(--gradient-primary)" }}
                    />
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    {progress >= 100
                      ? "Goal reached. Set a new target to keep momentum."
                      : progress >= 70
                        ? "Ahead of pace — well done."
                        : progress >= 40
                          ? "On track. Keep going."
                          : "Slightly behind pace."}
                  </p>
                </li>
              );
            })
          )}
        </ul>
      </section>

      {/* Suggestions */}
      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Suggestions
        </h2>
        <ul className="space-y-2.5 text-[13px] text-foreground/90">
          {top && (
            <li className="flex gap-2.5">
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
              <span>
                {top.category} is your top category at {fmtMoney(top.amount, base)} this month — a 10% trim would save{" "}
                {fmtMoney(top.amount * 0.1, base)}.
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
            <span>Consider auto-investing 15% of monthly income into your portfolio.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
            <span>Tell Lucid about a goal — “Reach $50k net worth by December” — and it'll track pace automatically.</span>
          </li>
        </ul>
      </section>
    </AppShell>
  );
}
