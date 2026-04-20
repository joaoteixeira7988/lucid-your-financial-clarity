import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { parseMessage } from "@/lib/parser";
import { answerQuestion } from "@/lib/insights";
import type { TxCategory } from "@/lib/types";
import { toBase } from "@/lib/currency";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS: { label: string; prefill: string }[] = [
  { label: "Food", prefill: "Spent  on food" },
  { label: "Transport", prefill: "Spent  on Uber" },
  { label: "Shopping", prefill: "Spent  on shopping" },
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
  const addGoal = useAppStore((s) => s.addGoal);
  const addActivity = useAppStore((s) => s.addActivity);

  // auto-grow textarea
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
      // place caret at the gap
      const idx = prefill.indexOf("  ");
      if (idx >= 0) el.setSelectionRange(idx + 1, idx + 1);
    });
  }

  function handleSend() {
    const value = text.trim();
    if (!value) return;
    addMessage({ role: "user", content: value });

    const result = parseMessage(value, baseCurrency);

    if (result.intent === "expense_log" || result.intent === "income_log") {
      result.entries.forEach((e) => {
        if (e.amount == null) return;
        addTransaction({
          amount: e.amount,
          currency: e.currency ?? baseCurrency,
          category: (e.category ?? "Other") as TxCategory,
          merchant: e.merchant,
          date: e.date ?? new Date().toISOString(),
          type: result.intent === "income_log" ? "income" : "expense",
        });
        const baseAmt = toBase(e.amount, e.currency ?? baseCurrency, baseCurrency);
        addActivity(
          "log",
          `Logged ${formatBase(baseAmt, baseCurrency)} to ${e.category ?? "Other"}.`
        );
      });
    } else if (result.intent === "investment_log" || result.intent === "asset_log") {
      result.entries.forEach((e) => {
        addAsset({
          kind: e.assetKind ?? "other",
          symbol: e.symbol,
          name: e.assetName ?? "Asset",
          quantity: e.quantity,
          value: e.amount ?? 0,
        });
        addActivity(
          "asset",
          e.quantity != null && e.symbol
            ? `Added ${e.quantity} ${e.symbol}.`
            : `Added ${formatBase(toBase(e.amount ?? 0, e.currency ?? baseCurrency, baseCurrency), baseCurrency)} ${e.assetName ?? "asset"}.`
        );
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

    let reply = result.reply;
    if (result.intent === "question") reply = answerQuestion(value);

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
  const sym = c === "USD" ? "$" : c === "EUR" ? "€" : c === "GBP" ? "£" : "د.إ";
  return `${sym}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
