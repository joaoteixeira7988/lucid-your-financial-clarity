import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { LucidMark } from "@/components/LucidMark";
import {
  useAppStore,
  getCategorySpend,
  getInvestmentValue,
  getNetWorth,
  getSpendInRange,
} from "@/lib/store";
import { parseMessageAI } from "@/lib/aiParser";
import { fetchQuote } from "@/lib/market";
import type { ParsedResult } from "@/lib/types";
import { answerQuestion } from "@/lib/insights";
import type { TxCategory } from "@/lib/types";
import { toBase, fmtMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";

const QUICK_ACTIONS: { label: string; prefill: string }[] = [
  { label: "Food", prefill: "Spent  on lunch" },
  { label: "Transport", prefill: "Spent  on Uber" },
  { label: "Shopping", prefill: "Spent  on shopping" },
  { label: "Add asset", prefill: "Bought a watch for " },
  { label: "Add investment", prefill: "Bought  of BTC" },
  { label: "Set goal", prefill: "I want to save 5000 in 6 months" },
];

/**
 * Lucid Command Bar.
 *
 * Variants:
 *   - "hero"   → tall, centered, dominant. Used when the user hasn't engaged yet.
 *   - "docked" → sticky, compact at bottom. Used after first interaction.
 *   - compact  → legacy small variant for embedded contexts.
 */
export function ChatInput({
  variant = "docked",
  compact = false,
}: {
  variant?: "hero" | "docked";
  compact?: boolean;
}) {
  const [text, setText] = useState("");
  const [pulsing, setPulsing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const baseCurrency = useAppStore((s) => s.baseCurrency);
  const addMessage = useAppStore((s) => s.addMessage);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addAsset = useAppStore((s) => s.addAsset);
  const adjustCash = useAppStore((s) => s.adjustCash);
  const addGoal = useAppStore((s) => s.addGoal);
  const addActivity = useAppStore((s) => s.addActivity);
  const setLastAction = useAppStore((s) => s.setLastAction);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
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

  async function handleSend() {
    const value = text.trim();
    if (!value) return;
    playSound("send");
    setPulsing(true);
    setTimeout(() => setPulsing(false), 160);
    addMessage({ role: "user", content: value });
    setText("");

    const result = await parseMessageAI(value, baseCurrency);

    if (result.intent === "expense_log") {
      let firstTxId: string | undefined;
      let firstCat: TxCategory | undefined;
      let inferred = false;
      result.entries.forEach((e, i) => {
        if (e.amount == null) return;
        const tx = addTransaction({
          amount: e.amount,
          currency: e.currency ?? baseCurrency,
          category: (e.category ?? "Other") as TxCategory,
          merchant: e.merchant,
          date: e.date ?? new Date().toISOString(),
          type: "expense",
          source: "text",
          confidence: result.confidence,
        });
        if (i === 0) {
          firstTxId = tx.id;
          firstCat = (e.category ?? "Other") as TxCategory;
          inferred = !!e.categoryInferred;
        }
        const baseAmt = toBase(e.amount, e.currency ?? baseCurrency, baseCurrency);
        adjustCash(-baseAmt);
        addActivity(
          "expense",
          `Logged expense: ${e.category ?? "Other"} (${formatBase(baseAmt, baseCurrency)}).`
        );
      });
      setLastAction({
        kind: "expense",
        transactionId: firstTxId,
        category: firstCat,
        inferred,
        confidence: result.confidence,
        at: new Date().toISOString(),
      });
    } else if (result.intent === "income_log") {
      setLastAction({ kind: "income", at: new Date().toISOString() });
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
      setLastAction({ kind: "investment", at: new Date().toISOString() });
      for (const e of result.entries) {
        console.log("INVESTMENT ENTRY:", JSON.stringify(e))
        console.log("[investment_log] parsed entry:", {
          quantity: e.quantity,
          amount: e.amount,
          symbol: e.symbol,
          currency: e.currency,
          assetKind: e.assetKind,
        });
        const kind: "crypto" | "stock" =
          e.assetKind === "stock" ? "stock" : "crypto";
        const symbol = e.symbol?.toUpperCase();

        let livePriceUsd: number | undefined;
        let resolvedName: string | undefined;
        if (symbol) {
          const quote = await fetchQuote(symbol, kind);
          livePriceUsd = quote?.price;
          resolvedName = quote?.name;
        }

        let quantity = e.quantity;
        // If parser gave us both quantity and symbol (e.g. "0.5 ETH"),
        // ignore any amount field — it's a duplicate of the quantity, not
        // a currency-denominated purchase value.
        const hasUnitQuantity = quantity != null && !!symbol;
        let purchaseValueBase: number | undefined =
          !hasUnitQuantity && e.amount != null
            ? toBase(e.amount, e.currency ?? baseCurrency, baseCurrency)
            : undefined;

        if (livePriceUsd && quantity == null && purchaseValueBase != null) {
          const usdValue = toBase(purchaseValueBase, baseCurrency, "USD");
          quantity = usdValue / livePriceUsd;
        }
        if (livePriceUsd && quantity != null && purchaseValueBase == null) {
          const usdValue = quantity * livePriceUsd;
          purchaseValueBase = toBase(usdValue, "USD", baseCurrency);
        }


        addAsset({
          kind,
          symbol,
          name: e.assetName ?? resolvedName ?? symbol ?? "Investment",
          quantity,
          value: purchaseValueBase ?? 0,
          costBasis: purchaseValueBase,
        });
        if (purchaseValueBase != null) adjustCash(-purchaseValueBase);

        const valLabel =
          purchaseValueBase != null
            ? formatBase(purchaseValueBase, baseCurrency)
            : null;
        const qtyLabel = quantity != null
          ? quantity.toFixed(6).replace(/\.?0+$/, "")
          : null;
        const label =
          qtyLabel && symbol
            ? `Added ${qtyLabel} ${symbol}${valLabel ? ` (${valLabel})` : ""}.`
            : `Added ${symbol ?? e.assetName ?? "investment"}${valLabel ? ` (${valLabel})` : ""}.`;
        addActivity("investment", label);
      }

    } else if (result.intent === "asset_log") {
      setLastAction({ kind: "asset", at: new Date().toISOString() });
      result.entries.forEach((e) => {
        const baseAmt = toBase(e.amount ?? 0, e.currency ?? baseCurrency, baseCurrency);
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
      setLastAction({ kind: "goal", at: new Date().toISOString() });
    } else {
      setLastAction({ kind: "other", at: new Date().toISOString() });
    }

    // Soft confirm tone for any committed action (skip pure questions/clarify)
    if (
      result.intent !== "question" &&
      result.intent !== "clarify" &&
      result.intent !== "unknown"
    ) {
      setTimeout(() => playSound("confirm"), 180);
    }

    const reply = composeReply(result, value, baseCurrency);
    setTimeout(() => {
      addMessage({ role: "assistant", content: reply });
    }, 220);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isHero = variant === "hero" && !compact;

  return (
    <div className={cn("space-y-3", isHero && "space-y-4")}>
      {!compact && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                playSound("tap");
                handleQuick(q.prefill);
              }}
              className="lucid-chip lucid-press flex-shrink-0 whitespace-nowrap"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <div
        className={cn(
          "lucid-card relative flex items-end gap-2 transition-all duration-200",
          isHero
            ? "rounded-[28px] p-2.5 pl-5 shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.22),0_18px_50px_-18px_oklch(0.66_0.18_252/0.55)]"
            : "rounded-3xl p-2 pl-4",
          "focus-within:shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.5),0_12px_36px_-12px_oklch(0.66_0.18_252/0.55)]",
          pulsing && "scale-[0.992] opacity-90"
        )}
      >
        <LucidMark
          size={18}
          className={cn(isHero ? "mb-3.5" : "mb-2.5")}
        />
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Tell Lucid what happened or ask anything about your money…"
          className={cn(
            "tabular flex-1 resize-none bg-transparent leading-snug text-foreground placeholder:text-muted-foreground/65 focus:outline-none",
            isHero ? "py-3.5 text-[15px]" : "py-2.5 text-[14px]"
          )}
          style={{ maxHeight: 160 }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim()}
          className={cn(
            "lucid-press flex flex-shrink-0 items-center justify-center rounded-2xl transition-[background,box-shadow,transform] duration-200",
            isHero ? "mb-1 h-11 w-11" : "mb-1 h-9 w-9",
            text.trim()
              ? "bg-primary text-primary-foreground shadow-[0_4px_18px_-4px_oklch(0.66_0.18_252/0.7)]"
              : "bg-surface-elevated text-muted-foreground"
          )}
          aria-label="Send"
        >
          <ArrowUp className={cn(isHero ? "h-[18px] w-[18px]" : "h-4 w-4")} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function formatBase(value: number, c: string): string {
  return fmtMoney(value, c as "USD" | "EUR" | "GBP" | "AED");
}

/**
 * Compose a premium, 1–2 sentence assistant reply tailored to the action.
 * Reads fresh store state so the second line reflects updated totals.
 */
function composeReply(
  result: ParsedResult,
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
    const head = e.categoryInferred
      ? `Logged ${fmtMoney(amt, base)} to ${cat} (based on your usual pattern).`
      : `Logged ${fmtMoney(amt, base)} to ${cat}.`;
    return `${head} ${second}`;
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
