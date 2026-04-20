import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * AI Response container — the "brain" of Lucid.
 * Shows only the latest assistant reply (1–2 short lines), replacing the
 * previous one with a soft fade. Distinct from the Activity feed, which is
 * a passive system log.
 */
export function AIResponse() {
  const messages = useAppStore((s) => s.messages);
  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  const [shown, setShown] = useState(latest);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!latest || latest.id === shown?.id) return;
    setFading(true);
    const t = setTimeout(() => {
      setShown(latest);
      setFading(false);
    }, 140);
    return () => clearTimeout(t);
  }, [latest, shown?.id]);

  if (!shown) {
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
            <p className="mt-1 text-[14px] leading-snug text-foreground/85">
              Ready when you are. Log an expense, add an asset, or ask anything.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // Split assistant content into up to 2 sentence-lines for a clean read.
  const lines = shown.content
    .split(/(?<=[.!?])\s+(?=[A-Z$])/)
    .filter(Boolean)
    .slice(0, 2);

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
          className={cn(
            "min-w-0 flex-1 pt-0.5 transition-opacity duration-150",
            fading ? "opacity-0" : "opacity-100"
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
        </div>
      </div>
    </section>
  );
}
