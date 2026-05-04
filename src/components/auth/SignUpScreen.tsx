import { useState } from "react";
import { ArrowLeft, Mail, Sparkles } from "lucide-react";
import { LucidMark } from "@/components/LucidMark";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { cn } from "@/lib/utils";

type View = "root" | "email" | "sent";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.41 2.22-1.13 3.04-.81.94-2.13 1.66-3.22 1.58-.13-1.1.42-2.25 1.13-3.02.79-.86 2.16-1.5 3.22-1.6zM20.5 17.06c-.55 1.27-.81 1.84-1.52 2.96-.99 1.55-2.39 3.48-4.12 3.5-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09 1-1.74-.02-3.07-1.78-4.06-3.33C0 17.16-.31 11.85 1.42 9.04c1.23-1.99 3.18-3.16 5-3.16 1.86 0 3.03 1.02 4.57 1.02 1.5 0 2.41-1.02 4.56-1.02 1.62 0 3.34.88 4.57 2.41-4.02 2.2-3.36 7.93.38 8.77z" />
    </svg>
  );
}

const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function SignUpScreen() {
  const [view, setView] = useState<View>("root");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleApple() {
    setErr(null);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) setErr(result.error.message ?? "Sign-in failed");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed");
    }
  }

  async function sendMagicLink() {
    if (!validEmail(email) || loading) return;
    setLoading(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setView("sent");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[40%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[130px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+18px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {view === "root" && <RootView onApple={handleApple} onEmail={() => setView("email")} err={err} />}
        {view === "email" && (
          <EmailView
            email={email}
            setEmail={setEmail}
            onBack={() => { setView("root"); setErr(null); }}
            onSubmit={sendMagicLink}
            loading={loading}
            err={err}
          />
        )}
        {view === "sent" && (
          <SentView email={email} onBack={() => { setView("email"); }} />
        )}
      </div>
    </div>
  );
}

function RootView({ onApple, onEmail, err }: { onApple: () => void; onEmail: () => void; err: string | null }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15">
          <LucidMark size={36} stroke="#ffffff" fill="#ffffff" />
        </div>
        <h1 className="mt-5 text-[28px] font-semibold tracking-tight">Lucid</h1>
        <p className="mt-1.5 text-[14px] text-muted-foreground">Your financial clarity</p>
      </div>

      <div className="space-y-3">
        {err && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
            {err}
          </div>
        )}
        <button
          type="button"
          onClick={onApple}
          className="lucid-press flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] bg-white text-[15px] font-medium text-black transition hover:bg-white/90"
        >
          <AppleIcon className="h-[18px] w-[18px]" />
          Continue with Apple
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={onEmail}
          className="lucid-press flex h-14 w-full items-center justify-center gap-2.5 rounded-[14px] border border-border bg-surface-elevated text-[15px] font-medium text-foreground transition hover:bg-surface-elevated/80"
        >
          <Mail className="h-[18px] w-[18px]" />
          Continue with email
        </button>

        <p className="pt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
          Your data is encrypted and never sold.
          <br />
          By continuing you agree to our{" "}
          <a href="#" className="text-foreground/80 underline-offset-4 hover:underline">Terms</a> and{" "}
          <a href="#" className="text-foreground/80 underline-offset-4 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </>
  );
}

function EmailView({
  email,
  setEmail,
  onBack,
  onSubmit,
  loading,
  err,
}: {
  email: string;
  setEmail: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  err: string | null;
}) {
  const ok = validEmail(email);
  return (
    <>
      <div className="flex flex-1 flex-col">
        <span className="lucid-chip self-start text-[11px] uppercase tracking-[0.14em]">Create account</span>
        <h2 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">What's your email?</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          We'll send you a magic link — no password needed.
        </p>

        <div className="mt-7">
          <input
            autoFocus
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && ok) onSubmit(); }}
            className="h-14 w-full rounded-[14px] border border-border bg-surface-elevated px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
          {err && <p className="mt-3 text-[13px] text-destructive">{err}</p>}
        </div>

        <p className="mt-5 text-[13px] text-muted-foreground">
          Already have an account?{" "}
          <button type="button" onClick={onSubmit} disabled={!ok} className="text-primary underline-offset-4 hover:underline disabled:opacity-50">
            Sign in
          </button>
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!ok || loading}
          className={cn(
            "lucid-press h-14 w-full rounded-[14px] text-[15px] font-medium transition",
            ok && !loading
              ? "bg-primary text-primary-foreground shadow-[0_6px_22px_-4px_oklch(0.66_0.18_252/0.7)] hover:scale-[1.01]"
              : "bg-surface-elevated text-muted-foreground"
          )}
        >
          {loading ? "Sending…" : "Send magic link"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 w-full items-center justify-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
    </>
  );
}

function SentView({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-5 text-[24px] font-semibold tracking-tight">Check your inbox</h2>
        <p className="mt-2 max-w-xs text-[14px] text-muted-foreground">
          We sent a magic link to{" "}
          <span className="text-foreground">{email}</span>. Tap it to sign in.
        </p>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="flex h-12 w-full items-center justify-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Use a different email
      </button>
    </>
  );
}
