import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useMarketPrices } from "@/lib/market";

export function AppShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  // Refresh live market prices for every held investment.
  useMarketPrices();
  const { pathname } = useLocation();
  return (
    <div className="relative min-h-screen pb-28">
      <AppHeader subtitle={subtitle} />
      <main key={pathname} className="lucid-fade mx-auto max-w-2xl px-5 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
