import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  delta,
  hint,
  prominent,
  children,
  className,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  hint?: string;
  prominent?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "lucid-card group relative overflow-hidden p-4",
        prominent && "p-5",
        className
      )}
    >
      {prominent && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.66 0.18 252 / 0.18) 0%, transparent 50%)",
          }}
        />
      )}
      <div className="relative">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "tabular mt-1.5 font-semibold tracking-tight text-foreground",
            prominent ? "text-[34px] leading-none" : "text-[22px] leading-none"
          )}
        >
          {value}
        </p>
        {(delta || hint) && (
          <div className="mt-2.5 flex items-center gap-2 text-[11px]">
            {delta && (
              <span
                className={cn(
                  "tabular inline-flex items-center rounded-md px-1.5 py-0.5 font-medium",
                  delta.positive
                    ? "bg-success/12 text-success"
                    : "bg-destructive/12 text-destructive"
                )}
              >
                {delta.value}
              </span>
            )}
            {hint && <span className="text-muted-foreground">{hint}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
