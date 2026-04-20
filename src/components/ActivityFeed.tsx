import { useAppStore } from "@/lib/store";
import {
  CheckCircle2,
  Coins,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/lib/types";

const ICONS: Record<ActivityItem["kind"], React.ComponentType<{ className?: string }>> = {
  expense: ArrowDownRight,
  income: ArrowUpRight,
  asset: Coins,
  investment: TrendingUp,
  cash: Wallet,
  goal: Target,
  insight: Sparkles,
  system: CheckCircle2,
};

const COLORS: Record<ActivityItem["kind"], string> = {
  expense: "text-destructive bg-destructive/12",
  income: "text-success bg-success/12",
  asset: "text-chart-3 bg-chart-3/12",
  investment: "text-chart-4 bg-chart-4/12",
  cash: "text-chart-2 bg-chart-2/12",
  goal: "text-chart-4 bg-chart-4/10",
  insight: "text-primary bg-primary/12",
  system: "text-muted-foreground bg-muted/40",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function ActivityFeed() {
  const activity = useAppStore((s) => s.activity);
  const items = activity.slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section aria-label="Activity" className="rounded-2xl border border-border/50 bg-surface/40 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
          Activity
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
          <span className="relative flex h-1.5 w-1.5">
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success/70" />
          </span>
          Live
        </span>
      </header>
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = ICONS[item.kind];
          const colors = COLORS[item.kind];
          return (
            <li key={item.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md opacity-80",
                  colors
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] leading-snug text-muted-foreground">{item.text}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground/60">{relTime(item.date)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
