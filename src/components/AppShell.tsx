import type { ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useCryptoPrices } from "@/lib/usePrices";

export function AppShell({
  children,
  subtitle,
}: {
  children: ReactNode;
  subtitle?: string;
}) {
  // Initialize live prices once at the shell level
  useCryptoPrices();
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
