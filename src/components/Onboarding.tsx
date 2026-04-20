import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, Target } from "lucide-react";
import { useAppStore, getNetWorth, getSpendInRange } from "@/lib/store";
import { parseMessage } from "@/lib/parser";
import { toBase, fmtMoney } from "@/lib/currency";
import type { TxCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "hero" | "reveal" | "second";

const EXAMPLES = [
  "I spent 25 on lunch",
  "I make 3000/month",
  "Add 0.5 ETH",
];

/**
 * Lucid Onboarding — a live demo disguised as setup.
 * Stages:
 *   hero    → centered command bar + 3 example prompts
 *   reveal  → metrics + AI response + activity fade in (still overlay, command bar docked-feel)
 *   second  → AI suggests a goal; "Set goal" or "Not now" → exits to real app
 */
export function Onboarding() {
  const [stage, setStage] = useState<Stage>("hero");
  const [text, setText] = useState("");
  const [aiReply, setAiReply] = useState<string>("");
  const [logged, setLogged] = useState<{ amount: number; category: TxCategory } | null>(null);
  const [exiting, setExiting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const base = useAppStore((s) => s.baseCurrency);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addAsset = useAppStore((s) => s.addAsset);
  const adjustCash = useAppStore((s) => s.adjustCash);
  const addGoal = useAppStore((s) => s.addGoal);
  const addActivity = useAppStore((s) => s.addActivity);
  const addMessage = useAppStore((s) => s.addMessage);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  function handleExample(prompt: string) {
    setText(prompt);
    setTimeout(() => submit(prompt), 180);
  }

  function submit(value: string) {
    const v = value.trim();
    if (!v) return;
    addMessage({ role: "user", content: v });
    const result = parseMessage(v, base);

    let reply = "Got it.";

    if (result.intent === "expense_log" && result.entries[0]?.amount != null) {
      const e = result.entries[0];
      const amt = toBase(e.amount!, e.currency ?? base, base);
      const cat = (e.category ?? "Other") as TxCategory;
      addTransaction({
        amount: e.amount!,
        currency: e.currency ?? base,
        category: cat,
        merchant: e.merchant,
        date: new Date().toISOString(),
        type: "expense",
      });
      adjustCash(-amt);
      addActivity("expense", `Logged expense: ${cat} (${fmtMoney(amt, base)}).`);
      setLogged({ amount: amt, category: cat });
      const today = getSpendInRange(useAppStore.getState(), 1);
      reply = `Logged ${fmtMoney(amt, base)} to ${cat}.\nYou've spent ${fmtMoney(today, base)} today.`;
    } else if (result.intent === "income_log" && result.entries[0]?.amount != null) {
      const e = result.entries[0];
      const amt = toBase(e.amount!, e.currency ?? base, base);
      addTransaction({
        amount: e.amount!,
        currency: e.currency ?? base,
        category: "Income",
        date: new Date().toISOString(),
        type: "income",
      });
      adjustCash(amt);
      addActivity("income", `Income: ${fmtMoney(amt, base)}.`);
      reply = `Income recorded: ${fmtMoney(amt, base)}.\nA solid save target is ~${fmtMoney(amt * 0.2, base)}/month.`;
    } else if (result.intent === "investment_log" && result.entries[0]) {
      const e = result.entries[0];
      addAsset({
        kind: e.assetKind ?? "crypto",
        symbol: e.symbol,
        name: e.assetName ?? e.symbol ?? "Investment",
        quantity: e.quantity,
        value: e.amount ?? 0,
      });
      addActivity("investment", `Added investment: ${e.symbol ?? e.assetName}.`);
      reply = `Added ${e.quantity ?? ""} ${e.symbol ?? "investment"} to your portfolio.\nTracking live in your assets.`;
    } else {
      // fallback: still log something so the demo feels alive
      addTransaction({
        amount: 25,
        currency: base,
        category: "Food",
        date: new Date().toISOString(),
        type: "expense",
      });
      adjustCash(-25);
      addActivity("expense", `Logged expense: Food (${fmtMoney(25, base)}).`);
      setLogged({ amount: 25, category: "Food" });
      reply = `Logged ${fmtMoney(25, base)} to Food.\nYou've spent ${fmtMoney(25, base)} today.`;
    }

    setAiReply(reply);
    addMessage({ role: "assistant", content: reply });
    setStage("reveal");
    setText("");

    // After breathing room, surface the second value hit
    setTimeout(() => setStage("second"), 1600);
  }

  function finish() {
    setExiting(true);
    setTimeout(() => completeOnboarding(), 320);
  }

  function setGoal() {
    const target = 200;
    addGoal({
      title: "Weekly spending under $200",
      type: "limit",
      targetAmount: target,
      timeframe: "week",
      deadline: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    addActivity("goal", `Goal created: weekly limit ${fmtMoney(target, base)}.`);
    finish();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(text);
    }
  }

  const state = useAppStore();
  const nw = getNetWorth(state);
  const today = getSpendInRange(state, 1);
  const week = getSpendInRange(state, 7);

  const isHero = stage === "hero";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-background transition-opacity duration-300",
        exiting ? "opacity-0" : "opacity-100"
      )}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>

      {/* Logo */}
      <div className="relative flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/15">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Lucid</span>
        </div>
        {stage !== "hero" && (
          <button
            type="button"
            onClick={finish}
            className="text-[12.5px] text-muted-foreground transition hover:text-foreground"
          >
            Skip
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative flex flex-1 flex-col px-5 pb-6">
        {/* Metrics — fade in after first input */}
        <div
          className={cn(
            "transition-all duration-500",
            stage === "hero"
              ? "pointer-events-none -translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          )}
        >
          <div className="mx-auto mt-4 grid w-full max-w-md gap-2.5">
            <div className="lucid-card rounded-3xl p-5">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Net worth
              </div>
              <div className="tabular mt-1 text-[34px] font-semibold leading-none tracking-tight">
                {fmtMoney(nw, base, { compact: true })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="lucid-card rounded-2xl p-4">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  Today
                </div>
                <div className="tabular mt-1 text-[20px] font-semibold tracking-tight">
                  {fmtMoney(today, base)}
                </div>
              </div>
              <div className="lucid-card rounded-2xl p-4">
                <div className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  This week
                </div>
                <div className="tabular mt-1 text-[20px] font-semibold tracking-tight">
                  {fmtMoney(week, base)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hero copy — only in hero stage */}
        {isHero && (
          <div className="mx-auto mt-auto flex w-full max-w-md flex-col items-center text-center">
            <h1 className="text-[30px] font-semibold leading-[1.05] tracking-tight">
              Stop tracking.<br />
              <span className="text-primary">Start talking.</span>
            </h1>
            <p className="mt-3 text-[14px] text-muted-foreground">
              Tell Lucid anything about your money.
            </p>
          </div>
        )}

        {/* AI Response card — appears post-input */}
        {stage !== "hero" && aiReply && (
          <div className="mx-auto mt-5 w-full max-w-md animate-fade-in">
            <div className="rounded-3xl border border-primary/30 bg-primary/[0.07] p-5 shadow-[0_18px_60px_-24px_oklch(0.66_0.18_252/0.55)]">
              <div className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <p className="whitespace-pre-line text-[14.5px] leading-snug text-foreground">
                  {aiReply}
                </p>
              </div>
            </div>

            {/* Activity preview */}
            {logged && (
              <div className="mt-3 flex items-center gap-2 px-1 text-[12px] text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
                Logged expense: {logged.category} ({fmtMoney(logged.amount, base)})
              </div>
            )}
          </div>
        )}

        {/* Second value hit — goal suggestion */}
        {stage === "second" && (
          <div className="mx-auto mt-4 w-full max-w-md animate-fade-in">
            <div className="lucid-card rounded-3xl p-5">
              <div className="flex items-start gap-2.5">
                <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <p className="text-[14px] leading-snug text-foreground/90">
                  Want to set a weekly spending target?
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={setGoal}
                  className="flex-1 rounded-2xl bg-primary px-4 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_4px_18px_-4px_oklch(0.66_0.18_252/0.7)] transition hover:scale-[1.02]"
                >
                  Set goal
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="flex-1 rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-[13.5px] font-medium text-foreground/90 transition hover:bg-surface-elevated/80"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Spacer pushes command bar */}
        <div className={cn(isHero ? "mt-8" : "mt-auto pt-6")} />

        {/* Command bar */}
        <div className="mx-auto w-full max-w-md">
          {isHero && (
            <div className="mb-3 flex flex-wrap justify-center gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => handleExample(ex)}
                  className="lucid-chip whitespace-nowrap transition-transform active:scale-95"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
          <div
            className={cn(
              "lucid-card relative flex items-end gap-2 transition-all duration-500",
              isHero
                ? "rounded-[28px] p-2.5 pl-5 shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.28),0_22px_60px_-20px_oklch(0.66_0.18_252/0.6)]"
                : "rounded-3xl p-2 pl-4",
              "focus-within:shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.5),0_12px_36px_-12px_oklch(0.66_0.18_252/0.55)]"
            )}
          >
            <Sparkles
              className={cn(
                "flex-shrink-0 text-primary",
                isHero ? "mb-3.5 h-[18px] w-[18px]" : "mb-2.5 h-4 w-4"
              )}
            />
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Tell Lucid what happened…"
              className={cn(
                "tabular flex-1 resize-none bg-transparent leading-snug text-foreground placeholder:text-muted-foreground/65 focus:outline-none",
                isHero ? "py-3.5 text-[15px]" : "py-2.5 text-[14px]"
              )}
              style={{ maxHeight: 140 }}
            />
            <button
              type="button"
              onClick={() => submit(text)}
              disabled={!text.trim()}
              className={cn(
                "flex flex-shrink-0 items-center justify-center rounded-2xl transition-all",
                isHero ? "mb-1 h-11 w-11" : "mb-1 h-9 w-9",
                text.trim()
                  ? "bg-primary text-primary-foreground shadow-[0_4px_18px_-4px_oklch(0.66_0.18_252/0.7)] hover:scale-[1.04]"
                  : "bg-surface-elevated text-muted-foreground"
              )}
              aria-label="Send"
            >
              <ArrowUp
                className={cn(isHero ? "h-[18px] w-[18px]" : "h-4 w-4")}
                strokeWidth={2.5}
              />
            </button>
          </div>

          {/* Soft account prompt — only after second value hit */}
          {stage === "second" && (
            <div className="mt-5 text-center text-[11.5px] text-muted-foreground/80">
              Save your financial system ·{" "}
              <button
                type="button"
                onClick={finish}
                className="text-foreground/80 underline-offset-4 hover:underline"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
