import { useAppStore, getSpendInRange, getNetWorth, getCategorySpend } from "./store";
import { fmtMoney } from "./currency";

/**
 * Generates a one-line dynamic insight for the home screen.
 * Pure function of state — calm, useful, no fluff.
 */
export function useDailyInsight(): string {
  const state = useAppStore();
  const base = state.baseCurrency;
  const week = getSpendInRange(state, 7);
  const prevWeek = getSpendInRange(state, 14) - week;
  const cats = getCategorySpend(state, 7);
  const top = cats[0];
  const nw = getNetWorth(state);

  if (week === 0 && nw === 0) {
    return "Tell Lucid what you spent today, or add an asset to get started.";
  }
  if (prevWeek > 0) {
    const diff = ((week - prevWeek) / prevWeek) * 100;
    if (Math.abs(diff) >= 8) {
      const dir = diff > 0 ? "more" : "less";
      const rest = top ? `, mainly on ${top.category}` : "";
      return `You're spending ${Math.abs(diff).toFixed(0)}% ${dir} than usual this week${rest}.`;
    }
  }
  if (top && week > 0) {
    return `Your biggest category this week is ${top.category} at ${fmtMoney(top.amount, base)}.`;
  }
  return `Net worth: ${fmtMoney(nw, base)}. You're on track this week.`;
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
  if (/(net worth|networth|total)/.test(q)) {
    return `Your net worth is ${fmtMoney(getNetWorth(state), base)}.`;
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
    return `You're on track. Net worth: ${fmtMoney(getNetWorth(state), base)}.`;
  }
  if (/goal/.test(q)) {
    const g = state.goals[0];
    if (!g) return "You don't have any active goals yet. Try: \"I want to save $5,000 in 6 months\".";
    return `Goal: ${g.title}. Keep going — small steps compound.`;
  }
  return `I have your data ready. Try asking about today, this week, your net worth, or your top category.`;
}
