import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  name: string | null;
  base_currency: string;
  onboarding_completed: boolean;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id,name,base_currency,onboarding_completed")
      .eq("id", uid)
      .maybeSingle();
    if (data) setProfile(data as Profile);
    else {
      // Trigger may be slightly delayed; create one defensively.
      await supabase.from("profiles").insert({ id: uid }).select().maybeSingle();
      const { data: d2 } = await supabase
        .from("profiles")
        .select("id,name,base_currency,onboarding_completed")
        .eq("id", uid)
        .maybeSingle();
      if (d2) setProfile(d2 as Profile);
    }
  };

  useEffect(() => {
    // Handle magic link callback: tokens arrive in URL hash (#access_token=...&refresh_token=...)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash && hash.includes("access_token=")) {
      const params = new URLSearchParams(hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).finally(() => {
          // Clean URL so we don't re-process or leak tokens
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        });
      }
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{ session, user: session?.user ?? null, profile, loading, refreshProfile, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
