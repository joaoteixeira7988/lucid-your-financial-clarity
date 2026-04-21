import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles, Target } from "lucide-react";
import { useAppStore, getNetWorth, getSpendInRange } from "@/lib/store";
import { parseMessageAI } from "@/lib/aiParser";
import { toBase, fmtMoney } from "@/lib/currency";
import type { TxCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "hero" | "reveal" | "second";

const ROTATING_PLACEHOLDERS = [
  "Try: I spent 25 on lunch",
  "Try: I make 3000/month",
  "Try: bought a car for 20k",
  "Try: add 0.5 ETH",
];

const QUICK_ACTIONS: { label: string; prompt: string }[] = [
  { label: "Food", prompt: "Spent 12 on food" },
  { label: "Transport", prompt: "Spent 8 on transport" },
  { label: "Shopping", prompt: "Spent 40 on shopping" },
  { label: "Add asset", prompt: "Add 5000 in cash" },
  { label: "Add investment", prompt: "Add 0.5 ETH" },
  { label: "Set goal", prompt: "Save 500 this month" },
];

export function Onboarding() {
  const [stage, setStage] = useState<Stage>("hero");
  const [text, setText] = useState("");
  const [aiReply, setAiReply] = useState<string>("");
  const [logged, setLogged] = useState<{ amount: number; category: TxCategory } | null>(null);
  const [exiting, setExiting] = useState(false);
  const [phIndex, setPhIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const base = useAppStore((s) => s.baseCurrency);
  const addTransaction = useAppStore((s) => s.addTransaction);
  const addAsset = useAppStore((s) => s.addAsset);
  const adjustCash = useAppStore((s) => s.adjustCash);
  const addGoal = useAppStore((s) => s.addGoal);
  const addActivity = useAppStore((s) => s.addActivity);
  const addMessage = useAppStore((s) => s.addMessage);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  // Rotate placeholder
  useEffect(() => {
    if (stage !== "hero") return;
    const id = setInterval(() => {
      setPhIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
    }, 2600);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [text]);

  function handleQuick(prompt: string) {
    setText(prompt);
    setTimeout(() => submit(prompt), 160);
  }

  async function submit(value: string) {
    const v = value.trim();
    if (!v) return;
    addMessage({ role: "user", content: v });
    setText("");
    setStage("reveal");
    const result = await parseMessageAI(v, base);

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
      type: "spend_less",
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
        <div className="absolute left-1/2 top-[42%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[130px]" />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="flex items-center gap-2 opacity-90">
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

      {/* HERO STAGE — focused center stack */}
      {isHero && (
        <div className="relative flex flex-1 flex-col items-center justify-center px-5 pb-[calc(96px+env(safe-area-inset-bottom))]">
          <div className="w-full max-w-md -translate-y-2">
            {/* Headline */}
            <div className="lucid-rise text-center">
              <h1 className="text-[30px] font-semibold leading-[1.05] tracking-tight">
                Stop tracking.
                <br />
                <span className="text-primary">Start talking.</span>
              </h1>
              <p className="mt-2.5 text-[14px] text-muted-foreground">
                Tell Lucid anything about your money.
              </p>
              <p className="mt-1 text-[11px] tracking-wide text-muted-foreground/55">
                Lucid is ready
              </p>
            </div>

            {/* Quick action category pills — above the command bar */}
            <div
              className="lucid-rise mt-6 flex gap-1.5 overflow-x-auto pb-1"
              style={{
                animationDelay: "80ms",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <style>{`.qa-row::-webkit-scrollbar{display:none}`}</style>
              <div className="qa-row mx-auto flex gap-1.5">
                {QUICK_ACTIONS.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => handleQuick(a.prompt)}
                    className="lucid-press lucid-chip whitespace-nowrap opacity-80 hover:opacity-100"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Command bar — focal point */}
            <div
              className="lucid-rise mt-3"
              style={{ animationDelay: "140ms" }}
            >
              <div
                className={cn(
                  "lucid-card lucid-breathe relative flex items-end gap-2 rounded-[28px] bg-surface/95 p-2.5 pl-5 backdrop-blur-xl",
                  "focus-within:!shadow-[0_0_0_1.5px_oklch(0.66_0.18_252/0.6),0_28px_72px_-18px_oklch(0.66_0.18_252/0.7)] focus-within:!opacity-100"
                )}
              >
                <Sparkles className="mb-4 h-[18px] w-[18px] flex-shrink-0 text-primary" />
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder={ROTATING_PLACEHOLDERS[phIndex]}
                  autoFocus
                  className="tabular flex-1 resize-none bg-transparent py-4 text-[15.5px] leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  style={{ maxHeight: 140 }}
                />
                <button
                  type="button"
                  onClick={() => submit(text)}
                  disabled={!text.trim()}
                  className={cn(
                    "lucid-press mb-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-all",
                    text.trim()
                      ? "bg-primary text-primary-foreground shadow-[0_6px_22px_-4px_oklch(0.66_0.18_252/0.75)] hover:scale-[1.04]"
                      : "bg-surface-elevated text-muted-foreground"
                  )}
                  aria-label="Send"
                >
                  <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVEAL / SECOND STAGES */}
      {!isHero && (
        <div className="relative flex flex-1 flex-col px-5 pb-6">
          {/* Metrics */}
          <div className="lucid-rise mx-auto mt-4 grid w-full max-w-md gap-2.5">
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

          {/* AI Response card */}
          {aiReply && (
            <div className="lucid-rise mx-auto mt-5 w-full max-w-md">
              <div className="rounded-3xl border border-primary/30 bg-primary/[0.07] p-5 shadow-[0_18px_60px_-24px_oklch(0.66_0.18_252/0.55)]">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <p className="whitespace-pre-line text-[14.5px] leading-snug text-foreground">
                    {aiReply}
                  </p>
                </div>
              </div>
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
            <div className="lucid-rise mx-auto mt-4 w-full max-w-md">
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
                    className="lucid-press flex-1 rounded-2xl bg-primary px-4 py-3 text-[13.5px] font-medium text-primary-foreground shadow-[0_4px_18px_-4px_oklch(0.66_0.18_252/0.7)] hover:scale-[1.02]"
                  >
                    Set goal
                  </button>
                  <button
                    type="button"
                    onClick={finish}
                    className="lucid-press flex-1 rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-[13.5px] font-medium text-foreground/90 hover:bg-surface-elevated/80"
                  >
                    Not now
                  </button>
                </div>
              </div>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
