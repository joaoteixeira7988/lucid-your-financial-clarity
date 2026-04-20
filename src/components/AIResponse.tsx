import { useEffect, useState } from "react";
import { Sparkles, Check, Pencil } from "lucide-react";
import { useAppStore } from "@/lib/store";
import {
  getProactiveNudge,
  markCheckinShown,
  dismissNudge,
  type ProactiveNudge,
} from "@/lib/insights";
import type { TxCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const CORRECTABLE_CATEGORIES: TxCategory[] = [
  "Food",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Travel",
  "Other",
];

/**
 * AI Response container — the "brain" of Lucid.
 *
 * Shows the latest assistant reply, with three subtle layers of intelligence:
 *   1. Inline correction chips when the last action was an expense (trust)
 *   2. Weekly soft check-in (Yes / Adjust)
 *   3. Proactive nudge fallback when the assistant is idle
 */
export function AIResponse() {
  const messages = useAppStore((s) => s.messages);
  const lastAction = useAppStore((s) => s.lastAction);
  const updateTransaction = useAppStore((s) => s.updateTransaction);
  const addMessage = useAppStore((s) => s.addMessage);
  const addActivity = useAppStore((s) => s.addActivity);

  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  const [shown, setShown] = useState(latest);
  const [fading, setFading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nudge, setNudge] = useState<ProactiveNudge | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  useEffect(() => {
    if (!latest || latest.id === shown?.id) return;
    setFading(true);
    setEditing(false);
    setNudgeDismissed(false);
    const t = setTimeout(() => {
      setShown(latest);
      setFading(false);
    }, 140);
    return () => clearTimeout(t);
  }, [latest, shown?.id]);

  // Recompute proactive nudge when the assistant is idle for a moment after
  // an action — quiet intelligence, not a notification.
  useEffect(() => {
    const idle = setTimeout(() => {
      const n = getProactiveNudge();
      setNudge(n);
      if (n?.kind === "checkin") markCheckinShown();
    }, 1200);
    return () => clearTimeout(idle);
  }, [messages.length, lastAction?.at]);

  const showCorrection =
    lastAction?.kind === "expense" &&
    lastAction.transactionId &&
    shown?.id === latest?.id;

  function applyCategory(next: TxCategory) {
    if (!lastAction?.transactionId) return;
    updateTransaction(lastAction.transactionId, { category: next, confidence: 1 });
    addActivity("system", `Corrected category to ${next}.`);
    addMessage({ role: "assistant", content: `Updated to ${next}. Lucid will remember.` });
    setEditing(false);
  }

  function handleCheckin(answer: "yes" | "adjust") {
    if (!nudge) return;
    dismissNudge(nudge.id);
    setNudge(null);
    if (answer === "yes") {
      addMessage({ role: "assistant", content: "Confirmed. Your week looks accurate." });
    } else {
      addMessage({
        role: "assistant",
        content: "Tell me what's off — say something like \"remove the 25 lunch\" or \"change Uber to 18\".",
      });
    }
  }

  // ---- Empty state with optional proactive nudge ----
  if (!shown) {
    const text =
      nudge && !nudgeDismissed
        ? nudge.text
        : "Ready when you are. Log an expense, add an asset, or ask anything.";
    return (
      <section
        aria-label="Lucid response"
        className="lucid-card relative overflow-hidden p-4"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Lucid
            </p>
            <p className="mt-1 text-[14px] leading-snug text-foreground/85">{text}</p>
          </div>
        </div>
      </section>
    );
  }

  const lines = shown.content
    .split(/(?<=[.!?])\s+(?=[A-Z$€£0-9])/)
    .filter(Boolean)
    .slice(0, 2);

  const showNudge = !!nudge && !nudgeDismissed && !showCorrection;
  const showCheckinChips = showNudge && nudge.kind === "checkin";

  return (
    <section
      aria-label="Lucid response"
      aria-live="polite"
      className={cn(
        "lucid-card relative overflow-hidden p-4 transition-shadow",
        "shadow-[0_0_0_1px_oklch(0.66_0.18_252/0.18),0_8px_24px_-12px_oklch(0.66_0.18_252/0.35)]"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div
          key={shown.id}
          className={cn(
            "min-w-0 flex-1 pt-0.5 transition-opacity duration-150",
            fading ? "opacity-0" : "lucid-rise opacity-100"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Lucid
          </p>
          <div className="mt-1 space-y-0.5">
            {lines.map((line, i) => (
              <p
                key={i}
                className={cn(
                  "text-[14.5px] leading-snug",
                  i === 0 ? "text-foreground" : "text-foreground/70"
                )}
              >
                {line}
              </p>
            ))}
          </div>

          {/* Inline correction — frictionless trust */}
          {showCorrection && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Change category
            </button>
          )}
          {showCorrection && editing && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CORRECTABLE_CATEGORIES.filter((c) => c !== lastAction?.category).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => applyCategory(c)}
                  className="lucid-chip"
                >
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="lucid-chip opacity-60"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Proactive nudge — quiet observation under the latest reply */}
          {showNudge && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-border/50 bg-surface-elevated/60 px-3 py-2">
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary/70" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug text-foreground/85">{nudge.text}</p>
                {showCheckinChips ? (
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCheckin("yes")}
                      className="lucid-chip inline-flex items-center gap-1"
                    >
                      <Check className="h-3 w-3" />
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckin("adjust")}
                      className="lucid-chip"
                    >
                      Adjust
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      dismissNudge(nudge.id);
                      setNudgeDismissed(true);
                    }}
                    className="mt-1 text-[10.5px] text-muted-foreground/60 hover:text-foreground"
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
