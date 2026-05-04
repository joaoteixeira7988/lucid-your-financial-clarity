import { useAppStore } from "@/lib/store";
import type { Currency } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import { LucidMark } from "@/components/LucidMark";

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "AED"];

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const base = useAppStore((s) => s.baseCurrency);
  const setBase = useAppStore((s) => s.setBaseCurrency);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="relative flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <LucidMark size={28} stroke="#ffffff" fill="#ffffff" />
            <span className="absolute -inset-px rounded-lg ring-1 ring-inset ring-white/10" />
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">Lucid</span>
            {subtitle && (
              <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {subtitle}
              </span>
            )}
          </div>
        </Link>
        <select
          aria-label="Base currency"
          value={base}
          onChange={(e) => setBase(e.target.value as Currency)}
          className="cursor-pointer rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
