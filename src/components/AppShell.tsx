import type { ReactNode } from "react";
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
  return (
    <div className="relative min-h-screen pb-28">
      <AppHeader subtitle={subtitle} />
      <main className="mx-auto max-w-2xl px-5 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
