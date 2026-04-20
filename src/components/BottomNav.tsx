import { Link, useLocation } from "@tanstack/react-router";
import { Home, PieChart, Briefcase, Wallet, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sound";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/spending", label: "Spending", icon: PieChart },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/net-worth", label: "Net Worth", icon: Wallet },
  { to: "/insights", label: "Insights", icon: Sparkles },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active =
            to === "/"
              ? pathname === "/"
              : pathname.startsWith(to) ||
                // Treat legacy /investments as Portfolio active
                (to === "/portfolio" && pathname.startsWith("/investments"));
          return (
            <Link
              key={to}
              to={to}
              onClick={() => {
                if (!active) playSound("tap");
              }}
              className={cn(
                "lucid-press group flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2.5 py-2 transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  active && "bg-primary/15 text-primary shadow-[0_0_24px_-4px_oklch(0.66_0.18_252/0.5)]"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className={cn("text-[10px] font-medium tracking-wide", active && "text-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
