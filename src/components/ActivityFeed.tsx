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
  const messages = useAppStore((s) => s.messages);

  const items: { kind: ActivityItem["kind"] | "chat"; text: string; date: string; id: string }[] = [
    ...messages
      .filter((m) => m.role === "assistant")
      .slice(-3)
      .map((m) => ({ kind: "chat" as const, text: m.content, date: m.date, id: m.id })),
    ...activity.map((a) => ({ kind: a.kind, text: a.text, date: a.date, id: a.id })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  if (items.length === 0) return null;

  return (
    <section aria-label="Activity" className="lucid-card p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Activity
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </header>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const Icon = item.kind === "chat" ? Sparkles : ICONS[item.kind];
          const colors = item.kind === "chat" ? "text-primary bg-primary/12" : COLORS[item.kind];
          return (
            <li key={item.id} className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
                  colors
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-foreground">{item.text}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">{relTime(item.date)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
