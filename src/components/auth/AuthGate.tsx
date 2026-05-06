import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LucidMark } from "@/components/LucidMark";
import { SignUpScreen } from "./SignUpScreen";
import { OnboardingFlow } from "./OnboardingFlow";

const GUEST_KEY = "lucid:guest-mode";

export function isGuestMode() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GUEST_KEY) === "1";
}

export function enableGuestMode() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_KEY, "1");
  window.dispatchEvent(new Event("lucid:guest-mode-changed"));
}

export function disableGuestMode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_KEY);
  window.dispatchEvent(new Event("lucid:guest-mode-changed"));
}

function SplashLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="pulse-aura" aria-hidden />
        <LucidMark size={56} />
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth();

  if (loading) return <SplashLoader />;
  if (!session) return <SignUpScreen />;
  if (!profile) return <SplashLoader />;
  if (!profile.onboarding_completed) return <OnboardingFlow />;

  return <>{children}</>;
}
