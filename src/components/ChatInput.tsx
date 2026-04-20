import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import {
  useAppStore,
  getCategorySpend,
  getInvestmentValue,
  getNetWorth,
  getSpendInRange,
} from "@/lib/store";
import { parseMessage } from "@/lib/parser";
import { answerQuestion } from "@/lib/insights";
import type { TxCategory } from "@/lib/types";
import { toBase, fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS: { label: string; prefill: string }[] = [
  { label: "Food", prefill: "Spent  on food" },
  { label: "Transport", prefill: "Spent  on Uber" },
  { label: "Shopping", prefill: "Spent  on shopping" },
  { label: "Add asset", prefill: "Bought a watch for " },
  { label: "Add investment", prefill: "Add 0.1 ETH" },
  { label: "Set goal", prefill: "I want to save 5000 in 3 months" },
];

export function ChatInput({ compact = false }: { compact?: boolean }) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messages = useAppStore((s) => s.messages);
  const baseCurrency = useAppStore((s) => s.baseCurrency);
  const addMessage = useAppStore((s) => s.addMessage);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addAsset = useAppStore((s) => s.addAsset);
  const adjustCash = useAppStore((s) => s.adjustCash);
  const addGoal = useAppStore((s) => s.addGoal);
  const addActivity = useAppStore((s) => s.addActivity);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  function handleQuick(prefill: string) {
    setText(prefill);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const idx = prefill.indexOf("  ");
      if (idx >= 0) el.setSelectionRange(idx + 1, idx + 1);
    });
  }

  function handleSend() {
    const value = text.trim();
    if (!value) return;
    addMessage({ role: "user", content: value });

    const result = parseMessage(value, baseCurrency);

    if (result.intent === "expense_log") {
      result.entries.forEach((e) => {
        if (e.amount == null) return;
        addTransaction({
          amount: e.amount,
          currency: e.currency ?? baseCurrency,
          category: (e.category ?? "Other") as TxCategory,
          merchant: e.merchant,
          date: e.date ?? new Date().toISOString(),
          type: "expense",
        });
        const baseAmt = toBase(e.amount, e.currency ?? baseCurrency, baseCurrency);
        adjustCash(-baseAmt);
        addActivity(
          "expense",
          `Logged expense: ${e.category ?? "Other"} (${formatBase(baseAmt, baseCurrency)}).`
        );
      });
    } else if (result.intent === "income_log") {
      result.entries.forEach((e) => {
        if (e.amount == null) return;
        addTransaction({
          amount: e.amount,
          currency: e.currency ?? baseCurrency,
          category: "Income",
          merchant: e.merchant,
          date: e.date ?? new Date().toISOString(),
          type: "income",
        });
        const baseAmt = toBase(e.amount, e.currency ?? baseCurrency, baseCurrency);
        adjustCash(baseAmt);
        addActivity("income", `Income: ${formatBase(baseAmt, baseCurrency)}.`);
      });
    } else if (result.intent === "investment_log") {
      result.entries.forEach((e) => {
        addAsset({
          kind: e.assetKind ?? "stock",
          symbol: e.symbol,
          name: e.assetName ?? "Investment",
          quantity: e.quantity,
          value: e.amount ?? 0,
          costBasis: e.amount,
        });
        const label =
          e.quantity != null && e.symbol
            ? `Added investment: ${e.quantity} ${e.symbol}.`
            : `Added investment: ${e.symbol ?? e.assetName ?? "Investment"} (${formatBase(toBase(e.amount ?? 0, e.currency ?? baseCurrency, baseCurrency), baseCurrency)}).`;
        // Investments funded with cash → debit cash if amount given.
        if (e.amount != null) {
          const baseAmt = toBase(e.amount, e.currency ?? baseCurrency, baseCurrency);
          adjustCash(-baseAmt);
        }
        addActivity("investment", label);
      });
    } else if (result.intent === "asset_log") {
      result.entries.forEach((e) => {
        const baseAmt = toBase(e.amount ?? 0, e.currency ?? baseCurrency, baseCurrency);
        // Cash/savings adjustments don't create a new asset row.
        if (e.assetKind === "cash" || e.assetKind === "savings") {
          adjustCash(baseAmt);
          addActivity(
            "cash",
            `Cash balance updated (+${formatBase(baseAmt, baseCurrency)}).`
          );
        } else {
          addAsset({
            kind: e.assetKind ?? "other",
            name: e.assetName ?? "Asset",
            value: baseAmt,
            costBasis: baseAmt,
          });
          // Tangible asset purchase: cash leaves, asset value enters → net worth ~neutral
          adjustCash(-baseAmt);
          addActivity(
            "asset",
            `Added asset: ${e.assetName ?? "Asset"} (${formatBase(baseAmt, baseCurrency)}).`
          );
        }
      });
    } else if (result.intent === "goal_create" && result.goal && result.goal.title) {
      addGoal({
        title: result.goal.title,
        type: result.goal.type ?? "save",
        targetAmount: result.goal.targetAmount ?? 0,
        category: result.goal.category,
        timeframe: result.goal.timeframe ?? "month",
        deadline: result.goal.deadline ?? new Date().toISOString(),
      });
      addActivity("goal", `Goal created: ${result.goal.title}.`);
    }
    // intent === "clarify" → just shows the question reply, no save.

    // Build a premium, scenario-aware reply (1–2 short sentences).
    const reply = composeReply(result, value, baseCurrency);

    setTimeout(() => {
      addMessage({ role: "assistant", content: reply });
    }, 220);

    setText("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const showHint = !compact && messages.length === 0;

  return (
    <div className="space-y-2.5">
      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => handleQuick(q.prefill)}
              className="lucid-chip"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          "lucid-card relative flex items-end gap-2 p-2 pl-3.5 transition-shadow",
          "focus-within:shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.4),0_8px_28px_-12px_oklch(0.66_0.18_252/0.45)]"
        )}
      >
        <Sparkles className="mb-2.5 h-4 w-4 flex-shrink-0 text-primary" />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={
            showHint
              ? "Tell me what you spent or ask anything about your money…"
              : "Type to Lucid…"
          }
          className="tabular flex-1 resize-none bg-transparent py-2.5 text-[14px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          style={{ maxHeight: 140 }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className={cn(
            "mb-1 flex h-9 w-9 items-center justify-center rounded-xl transition-all",
            text.trim()
              ? "bg-primary text-primary-foreground shadow-[0_4px_16px_-4px_oklch(0.66_0.18_252/0.6)] hover:scale-[1.04]"
              : "bg-surface-elevated text-muted-foreground"
          )}
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function formatBase(value: number, c: string): string {
  return fmtMoney(value, c as "USD" | "EUR" | "GBP" | "AED");
}

/**
 * Compose a premium, 1–2 sentence assistant reply tailored to the action
 * the user just performed. Reads fresh store state so the second line can
 * reflect the new totals (e.g. "Food spend is now $84 today.").
 */
function composeReply(
  result: ReturnType<typeof parseMessage>,
  rawText: string,
  base: "USD" | "EUR" | "GBP" | "AED"
): string {
  const state = useAppStore.getState();

  if (result.intent === "question") return answerQuestion(rawText);

  if (result.intent === "clarify" || result.intent === "unknown") {
    return result.reply;
  }

  if (result.intent === "expense_log" && result.entries[0]?.amount != null) {
    const e = result.entries[0];
    const amt = toBase(e.amount!, e.currency ?? base, base);
    const cat = (e.category ?? "Other") as TxCategory;
    const todayCat = getCategorySpend(state, 1).find((c) => c.category === cat)?.amount ?? 0;
    const today = getSpendInRange(state, 1);
    const second =
      todayCat > 0
        ? `${cat} spend is now ${fmtMoney(todayCat, base)} today.`
        : `Today's spend: ${fmtMoney(today, base)}.`;
    return `Logged ${fmtMoney(amt, base)} to ${cat}. ${second}`;
  }

  if (result.intent === "income_log" && result.entries[0]?.amount != null) {
    const e = result.entries[0];
    const amt = toBase(e.amount!, e.currency ?? base, base);
    return `Income recorded: ${fmtMoney(amt, base)}. Cash balance updated.`;
  }

  if (result.intent === "asset_log" && result.entries[0]) {
    const e = result.entries[0];
    const amt = toBase(e.amount ?? 0, e.currency ?? base, base);
    const name = e.assetName ?? "Asset";
    if (e.assetKind === "cash" || e.assetKind === "savings") {
      return `Added ${fmtMoney(amt, base)} to ${name.toLowerCase()}. Cash balance updated.`;
    }
    return `Added asset: ${name} (${fmtMoney(amt, base)}). Cash adjusted — net worth remains stable.`;
  }

  if (result.intent === "investment_log" && result.entries[0]) {
    const e = result.entries[0];
    const sym = e.symbol ?? e.assetName ?? "investment";
    const nw = getNetWorth(state);
    const inv = getInvestmentValue(state);
    const share = nw > 0 ? Math.round((inv / nw) * 100) : 0;
    const first =
      e.quantity != null && e.symbol
        ? `Added ${e.quantity} ${e.symbol} to your portfolio.`
        : `Added ${fmtMoney(toBase(e.amount ?? 0, e.currency ?? base, base), base)} to ${sym}.`;
    const second =
      share > 0
        ? `Investments now represent ${share}% of your net worth.`
        : `Portfolio updated.`;
    return `${first} ${second}`;
  }

  if (result.intent === "goal_create" && result.goal) {
    const g = result.goal;
    const target = g.targetAmount ?? 0;
    if (g.type === "save" && target > 0 && g.deadline) {
      const months = Math.max(
        1,
        Math.round(
          (new Date(g.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)
        )
      );
      const monthly = target / months;
      return `Goal set: ${fmtMoney(target, base)} in ${months} month${months > 1 ? "s" : ""}. About ${fmtMoney(monthly, base)}/month to stay on track.`;
    }
    return `Goal set: ${g.title}. Lucid will track your progress.`;
  }

  return result.reply;
}
