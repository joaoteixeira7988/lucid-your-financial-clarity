import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { ChatInput } from "@/components/ChatInput";
import { ActivityFeed } from "@/components/ActivityFeed";
import { AIResponse } from "@/components/AIResponse";
import { Onboarding } from "@/components/Onboarding";
import { useAppStore, getNetWorth, getInvestmentValue, getSpendInRange } from "@/lib/store";
import { useDailyInsight } from "@/lib/insights";
import { fmtMoney } from "@/lib/currency";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lucid — Your financial autopilot" },
      {
        name: "description",
        content:
          "Lucid is a calm, intelligent personal finance app. Talk naturally — Lucid logs, organizes, and explains your money.",
      },
      { property: "og:title", content: "Lucid — Your financial autopilot" },
      {
        property: "og:description",
        content: "Stop tracking money manually. Just talk to Lucid.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const state = useAppStore();
  const base = state.baseCurrency;
  const insight = useDailyInsight();
  const hasEngaged = state.messages.length > 0;
  const onboardingComplete = state.onboardingComplete;

  const nw = getNetWorth(state);
  const today = getSpendInRange(state, 1);
  const week = getSpendInRange(state, 7);
  const prevWeek = Math.max(0, getSpendInRange(state, 14) - week);
  const invest = getInvestmentValue(state);

  const weekDelta = prevWeek > 0 ? ((week - prevWeek) / prevWeek) * 100 : 0;

  return (
    <AppShell subtitle="Good to see you">
      {!onboardingComplete && <Onboarding />}
      <h1 className="sr-only">Lucid — Home</h1>
      {/* Hero metric */}
      <div className="grid gap-3">
        <MetricCard
          prominent
          label="Net worth"
          value={fmtMoney(nw, base, { compact: true })}
          animatedValue={{ amount: nw, currency: base, compact: true }}
          delta={{ value: "+3.1%", positive: true }}
          hint="this month"
        />
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Today"
            value={fmtMoney(today, base)}
            animatedValue={{ amount: today, currency: base }}
            hint="spending"
          />
          <MetricCard
            label="This week"
            value={fmtMoney(week, base)}
            animatedValue={{ amount: week, currency: base }}
            delta={
              prevWeek > 0
                ? { value: `${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(0)}%`, positive: weekDelta < 0 }
                : undefined
            }
            hint={prevWeek > 0 ? "vs last" : undefined}
          />
        </div>
        <MetricCard
          label="Investments"
          value={fmtMoney(invest, base, { compact: true })}
          animatedValue={{ amount: invest, currency: base, compact: true }}
          hint={`${state.assets.filter((a) => a.kind === "crypto").length} crypto, ${state.assets.filter((a) => a.kind === "stock").length} stock`}
        />
      </div>

      {/* Insight strip */}
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/[0.06] px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
        <p className="text-[13.5px] leading-snug text-foreground/90">{insight}</p>
      </div>

      {/* Hero command bar — only before first interaction */}
      {!hasEngaged && (
        <div className="mt-5">
          <ChatInput variant="hero" />
        </div>
      )}

      {/* AI Response — primary feedback surface (after engagement) */}
      {hasEngaged && (
        <div className="mt-4">
          <AIResponse />
        </div>
      )}

      {/* Activity feed — secondary system log */}
      <div className="mt-4">
        <ActivityFeed />
      </div>

      {/* Docked chat — only after engagement */}
      {hasEngaged && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom))] left-0 right-0 z-30 border-t border-border/40 bg-gradient-to-t from-background via-background/95 to-background/70 px-5 pb-3 pt-3 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl">
            <ChatInput variant="docked" />
          </div>
        </div>
      )}

      {/* spacer so feed doesn't sit under sticky input */}
      {hasEngaged && <div className="h-44" />}
    </AppShell>
  );
}
