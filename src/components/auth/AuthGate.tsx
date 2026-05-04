import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { LucidMark } from "@/components/LucidMark";
import { SignUpScreen } from "./SignUpScreen";
import { OnboardingFlow } from "./OnboardingFlow";

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
