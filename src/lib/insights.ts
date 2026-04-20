import {
  useAppStore,
  getSpendInRange,
  getNetWorth,
  getCategorySpend,
  getInvestmentValue,
  getCashTotal,
  getTangibleAssetValue,
  getRecentActivityKinds,
} from "./store";
import { fmtMoney } from "./currency";
import type { ActivityKind } from "./types";

/**
 * Lucid insight engine.
 *
 * Generates short, varied, context-aware insights. Multiple categories rotate
 * (spending, net worth, portfolio, behavior, goals, interpretation) — and
 * each category has multiple phrasings so the home screen feels fresh.
 *
 * Selection is driven by recent activity: a recent asset purchase favors
 * interpretation insights, a flurry of expenses favors spending insights, etc.
 */

type InsightKind =
  | "spending"
  | "net_worth"
  | "portfolio"
  | "goal"
  | "behavior"
  | "interpretation";

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
}

// --- Phrasing banks ---

function spendingInsight(seed: number, week: number, prev: number, topCat: string | null, base: string): string {
  if (prev <= 0) {
    return pick(
      [
        topCat
          ? `This week's spend is concentrated in ${topCat}.`
          : `You're just getting started — log a few entries to see trends.`,
        topCat
          ? `Most of your week so far has gone to ${topCat}.`
          : `Tell Lucid what you spent today to start the picture.`,
      ],
      seed
    );
  }
  const diff = ((week - prev) / prev) * 100;
  const abs = Math.abs(diff).toFixed(0);
  if (Math.abs(diff) < 8) {
    return pick(
      [
        `Your spending pace is steady this week.`,
        `This week mirrors last week — no surprises.`,
        topCat ? `Calm week. ${topCat} is still your largest category.` : `Calm week so far.`,
      ],
      seed
    );
  }
  if (diff > 0) {
    return pick(
      [
        topCat
          ? `You're running ${abs}% above your usual pace this week, mostly on ${topCat}.`
          : `You're running ${abs}% above your usual pace this week.`,
        topCat
          ? `This week is hotter than normal — ${topCat} is driving most of it.`
          : `This week is hotter than normal.`,
        `Spend is up ${abs}% versus last week.`,
      ],
      seed
    );
  }
  return pick(
    [
      `Spend is down ${abs}% versus last week — nice control.`,
      `You're below your usual pace this week.`,
      `This week is calmer — ${abs}% lower than last.`,
    ],
    seed
  );
}

function netWorthInsight(seed: number, nw: number, invest: number, cash: number, recent: ActivityKind[], baseStr: string): string {
  const investedAsset = recent.includes("asset");
  const investedInvest = recent.includes("investment");
  if (investedAsset) {
    return pick(
      [
        `A recent asset purchase shifted your mix more than your spending did.`,
        `Your money moved into value, not consumption — net worth held up.`,
        `Cash dipped, but your asset side grew to match.`,
      ],
      seed
    );
  }
  if (investedInvest) {
    return pick(
      [
        `Most of your recent change came from investments.`,
        `Your portfolio is doing more lifting than your spending lately.`,
        `Investment activity is shaping your net worth this period.`,
      ],
      seed
    );
  }
  return pick(
    [
      `Net worth: ${baseStr}. Cash and investments are your main pillars.`,
      `You're holding ${baseStr} across all accounts.`,
      `Your financial picture is stable at ${baseStr}.`,
    ],
    seed
  );
}

function portfolioInsight(seed: number, invest: number, nw: number): string {
  if (nw <= 0) return `Add an asset to start building your picture.`;
  const share = (invest / nw) * 100;
  if (share < 5) {
    return pick(
      [
        `Investments are a small slice of your net worth right now.`,
        `Most of your wealth sits outside the market.`,
      ],
      seed
    );
  }
  if (share > 60) {
    return pick(
      [
        `Investments make up ${share.toFixed(0)}% of your net worth — heavily allocated.`,
        `You're meaningfully exposed to market moves at ${share.toFixed(0)}% in investments.`,
      ],
      seed
    );
  }
  return pick(
    [
      `Investments are ${share.toFixed(0)}% of your net worth.`,
      `Your portfolio represents about ${share.toFixed(0)}% of your wealth.`,
      `Roughly ${share.toFixed(0)}% of your net worth is invested.`,
    ],
    seed
  );
}

function behaviorInsight(seed: number, txCount: number): string {
  if (txCount >= 8) {
    return pick(
      [
        `You've been logging consistently this week — that's how trust builds.`,
        `Steady tracking. Lucid's view of your money is sharpening.`,
      ],
      seed
    );
  }
  return pick(
    [
      `Add a few more entries this week and the picture will sharpen.`,
      `Try logging quick entries as they happen — Lucid handles the rest.`,
    ],
    seed
  );
}

function goalInsight(seed: number, baseStr: string, progress: number, title: string): string {
  if (progress >= 100) return `Goal "${title}" is complete. Set a new target to keep momentum.`;
  if (progress >= 70) {
    return pick(
      [
        `You're ahead of pace on "${title}" — ${progress.toFixed(0)}% there.`,
        `"${title}" is in reach: ${progress.toFixed(0)}% complete.`,
      ],
      seed
    );
  }
  if (progress >= 40) {
    return pick(
      [
        `Halfway through "${title}" — keep the rhythm.`,
        `On track for "${title}" at ${progress.toFixed(0)}%.`,
      ],
      seed
    );
  }
  return pick(
    [
      `"${title}" is a bit behind pace — small weekly adjustments will close the gap.`,
      `Slightly behind on "${title}". A modest weekly cut keeps it alive.`,
    ],
    seed
  );
}

function interpretationInsight(seed: number): string {
  return pick(
    [
      `This week's larger outflow was mostly a transfer into value, not pure spending.`,
      `Your money is moving — not disappearing. Most of it landed in assets.`,
      `Outflow doesn't always mean loss. A chunk became something you still own.`,
    ],
    seed
  );
}

// --- Selection logic ---

function chooseInsightKind(state: ReturnType<typeof useAppStore.getState>): InsightKind {
  const recent = getRecentActivityKinds(state, 6);
  const hasAsset = recent.includes("asset");
  const hasInvest = recent.includes("investment");
  const expenses = recent.filter((k) => k === "expense").length;
  const hasGoals = state.goals.length > 0;

  // Bias toward what just changed.
  const candidates: InsightKind[] = [];
  if (expenses >= 2) candidates.push("spending", "spending");
  if (hasAsset) candidates.push("interpretation", "net_worth");
  if (hasInvest) candidates.push("portfolio", "net_worth");
  if (hasGoals) candidates.push("goal");
  // baseline rotation
  candidates.push("spending", "net_worth", "portfolio", "behavior");

  const seed = dailySeed() + (state.activity[0] ? new Date(state.activity[0].date).getMinutes() : 0);
  return candidates[seed % candidates.length];
}

export function useDailyInsight(): string {
  const state = useAppStore();
  const base = state.baseCurrency;
  const seed = dailySeed() + state.transactions.length + state.assets.length;

  const week = getSpendInRange(state, 7);
  const prev = Math.max(0, getSpendInRange(state, 14) - week);
  const cats = getCategorySpend(state, 7).filter((c) => c.category !== "Income");
  const top = cats[0]?.category ?? null;
  const nw = getNetWorth(state);
  const invest = getInvestmentValue(state);
  const cash = getCashTotal(state);
  const tangible = getTangibleAssetValue(state);

  if (week === 0 && nw === 0) {
    return "Tell Lucid what you spent today, or add an asset to get started.";
  }

  const kind = chooseInsightKind(state);
  const baseStr = fmtMoney(nw, base, { compact: true });

  switch (kind) {
    case "spending":
      return spendingInsight(seed, week, prev, top, baseStr);
    case "net_worth":
      return netWorthInsight(seed, nw, invest, cash, getRecentActivityKinds(state, 6), baseStr);
    case "portfolio":
      return portfolioInsight(seed, invest, nw);
    case "behavior":
      return behaviorInsight(seed, state.transactions.length);
    case "interpretation":
      return interpretationInsight(seed);
    case "goal": {
      const g = state.goals[0];
      if (!g) return spendingInsight(seed, week, prev, top, baseStr);
      const saved = cash;
      const progress = g.targetAmount > 0 ? Math.min(100, (saved / g.targetAmount) * 100) : 0;
      return goalInsight(seed, baseStr, progress, g.title);
    }
    default:
      return spendingInsight(seed, week, prev, top, baseStr);
  }
  // unreachable
  void tangible;
}

export function answerQuestion(question: string): string {
  const q = question.toLowerCase();
  const state = useAppStore.getState();
  const base = state.baseCurrency;

  if (/today/.test(q) && /(spent|spend|spending)/.test(q)) {
    const v = getSpendInRange(state, 1);
    return `You've spent ${fmtMoney(v, base)} today.`;
  }
  if (/(week|weekly)/.test(q) && /(spent|spend|spending)/.test(q)) {
    const v = getSpendInRange(state, 7);
    const prev = getSpendInRange(state, 14) - v;
    if (prev > 0) {
      const diff = ((v - prev) / prev) * 100;
      return `You've spent ${fmtMoney(v, base)} this week — ${Math.abs(diff).toFixed(0)}% ${diff >= 0 ? "more" : "less"} than last week.`;
    }
    return `You've spent ${fmtMoney(v, base)} this week.`;
  }
  if (/(month|monthly)/.test(q) && /(spent|spend|spending)/.test(q)) {
    const v = getSpendInRange(state, 30);
    return `You've spent ${fmtMoney(v, base)} this month.`;
  }
  if (/cash/.test(q)) {
    return `Your cash and savings total ${fmtMoney(getCashTotal(state), base)}.`;
  }
  if (/(invest|portfolio|crypto|stock)/.test(q)) {
    return `Your investments are worth ${fmtMoney(getInvestmentValue(state), base, { compact: true })}.`;
  }
  if (/(asset)/.test(q)) {
    return `Your tracked assets total ${fmtMoney(getTangibleAssetValue(state), base, { compact: true })}.`;
  }
  if (/(net worth|networth|total)/.test(q)) {
    return `Your net worth is ${fmtMoney(getNetWorth(state), base, { compact: true })}.`;
  }
  if (/(biggest|top|largest).*(category|expense)/.test(q) || /where.*spending/.test(q)) {
    const cats = getCategorySpend(state, 30);
    if (cats[0]) return `Your biggest expense category this month is ${cats[0].category} at ${fmtMoney(cats[0].amount, base)}.`;
  }
  if (/(doing okay|doing well|on track|how am i)/.test(q)) {
    const week = getSpendInRange(state, 7);
    const prev = getSpendInRange(state, 14) - week;
    if (prev > 0 && week < prev) return `You're doing well — spending is down ${(((prev - week) / prev) * 100).toFixed(0)}% versus last week.`;
    if (prev > 0 && week > prev * 1.1) return `Slightly above pace — spending is up ${(((week - prev) / prev) * 100).toFixed(0)}% versus last week.`;
    return `You're on track. Net worth: ${fmtMoney(getNetWorth(state), base, { compact: true })}.`;
  }
  if (/goal/.test(q)) {
    const g = state.goals[0];
    if (!g) return "You don't have any active goals yet. Try: \"I want to save $5,000 in 6 months\".";
    return `Goal: ${g.title}. Keep going — small steps compound.`;
  }
  return `I have your data ready. Try asking about today, this week, your net worth, cash, investments, or your top category.`;
}
