import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SignUpScreen } from "./SignUpScreen";
import { OnboardingFlow } from "./OnboardingFlow";

export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
        </div>
      </div>
    );
  }

  if (!session) return <SignUpScreen />;

  // Wait for profile fetch to avoid flashing onboarding for completed users
  if (!profile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" />
        </div>
      </div>
    );
  }

  if (!profile.onboarding_completed) return <OnboardingFlow />;

  return <>{children}</>;
}
