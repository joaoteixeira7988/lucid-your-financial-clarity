import { useState } from "react";
import { ArrowRight, Coins, LineChart, Sparkles, Target, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Currency } from "@/lib/types";

const STEPS = 4;
const CURRENCIES: Currency[] = ["AED", "USD", "GBP", "EUR"];

export function OnboardingFlow() {
  const { user, refreshProfile } = useAuth();
  const setBaseCurrency = useAppStore((s) => s.setBaseCurrency);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const [step, setStep] = useState(0); // 0..3
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<Currency>("AED");
  const [saving, setSaving] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 1));

  async function savePersonalisation(skip = false) {
    if (!user) return;
    setSaving(true);
    const payload: { base_currency: string; name?: string } = { base_currency: currency };
    if (!skip && name.trim()) payload.name = name.trim();
    await supabase.from("profiles").update(payload).eq("id", user.id);
    setBaseCurrency(currency);
    await refreshProfile();
    setSaving(false);
    next();
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
    completeOnboarding();
    await refreshProfile();
    setSaving(false);
  }

  const progress = ((step + 1) / STEPS) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/12 blur-[130px]" />
      </div>

      {/* Progress */}
      <div className="relative px-6 pt-[calc(env(safe-area-inset-top)+18px)]">
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-400",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+24px)]">
        {step === 0 && <Welcome onNext={next} />}
        {step === 1 && <Features onNext={next} />}
        {step === 2 && (
          <Personalise
            name={name}
            setName={setName}
            currency={currency}
            setCurrency={setCurrency}
            onContinue={() => savePersonalisation(false)}
            onSkip={() => savePersonalisation(true)}
            saving={saving}
          />
        )}
        {step === 3 && <Ready name={name} onGo={finish} saving={saving} />}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "lucid-press flex h-14 w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-medium transition",
        !disabled
          ? "bg-primary text-primary-foreground shadow-[0_6px_22px_-4px_oklch(0.66_0.18_252/0.7)] hover:scale-[1.01]"
          : "bg-surface-elevated text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  return (
    <>
      <div className="lucid-rise flex flex-1 flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-[32px] text-primary">
          ✦
        </div>
        <h2 className="mt-6 text-[30px] font-semibold leading-[1.1] tracking-tight">
          Stop tracking.
          <br />
          <span className="text-primary">Start talking.</span>
        </h2>
        <p className="mt-3 max-w-sm text-[14.5px] leading-snug text-muted-foreground">
          Lucid understands your money the same way you talk about it. No categories. No forms.
        </p>

        <div className="lucid-card mt-8 w-full space-y-2.5 rounded-3xl p-4">
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary px-3.5 py-2.5 text-left text-[13.5px] text-primary-foreground">
              Spent 240 on groceries and paid Etisalat 350
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-surface-elevated px-3.5 py-2.5 text-left text-[13.5px] text-foreground">
              Logged both. You're 12% under budget this week. Nice.
            </div>
          </div>
        </div>
      </div>
      <PrimaryButton onClick={onNext}>Next <ArrowRight className="h-4 w-4" /></PrimaryButton>
    </>
  );
}

function Features({ onNext }: { onNext: () => void }) {
  const items = [
    { icon: Wallet, title: "Net worth tracking", sub: "Assets, investments, cash — live" },
    { icon: LineChart, title: "Crypto and stocks", sub: "Live prices, portfolio value" },
    { icon: Target, title: "Smart goals", sub: "Monthly targets with AI coaching" },
    { icon: Coins, title: "Multi-currency", sub: "AED, USD, EUR, GBP" },
  ];
  return (
    <>
      <div className="lucid-rise flex-1">
        <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Your full financial picture</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">Not just expenses — everything in one place.</p>

        <div className="mt-7 space-y-2.5">
          {items.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="lucid-card flex items-center gap-3.5 rounded-2xl p-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-medium text-foreground">{title}</div>
                <div className="text-[12.5px] text-muted-foreground">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PrimaryButton onClick={onNext}>Next <ArrowRight className="h-4 w-4" /></PrimaryButton>
    </>
  );
}

function Personalise({
  name,
  setName,
  currency,
  setCurrency,
  onContinue,
  onSkip,
  saving,
}: {
  name: string;
  setName: (v: string) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  onContinue: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const ok = name.trim().length > 0 && !saving;
  return (
    <>
      <div className="lucid-rise flex-1">
        <span className="lucid-chip text-[11px] uppercase tracking-[0.14em]">One quick thing</span>
        <h2 className="mt-5 text-[26px] font-semibold leading-tight tracking-tight">Make Lucid yours</h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Set your name and base currency so Lucid can personalise everything.
        </p>

        <div className="mt-7 space-y-3">
          <input
            autoFocus
            placeholder="First name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 w-full rounded-[14px] border border-border bg-surface-elevated px-4 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />

          <div className="grid grid-cols-2 gap-2.5">
            {CURRENCIES.map((c) => {
              const active = c === currency;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "lucid-press h-14 rounded-[14px] border text-[14.5px] font-medium transition",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-surface-elevated text-foreground/85 hover:bg-surface-elevated/80"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <PrimaryButton onClick={onContinue} disabled={!ok}>Continue</PrimaryButton>
        <button
          type="button"
          onClick={onSkip}
          disabled={saving}
          className="h-12 w-full text-[13.5px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </>
  );
}

function Ready({ name, onGo, saving }: { name: string; onGo: () => void; saving: boolean }) {
  const examples = [
    { tag: "Try saying", text: "Spent 150 on dinner and paid my gym 300" },
    { tag: "Or ask", text: "How much have I spent this week?" },
    { tag: "Or log", text: "Bought 0.5 ETH and got paid my salary" },
  ];
  const heading = name.trim() ? `You're all set, ${name.trim()}.` : "You're all set.";
  return (
    <>
      <div className="lucid-rise flex flex-1 flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-[32px] text-primary">✦</div>
        <h2 className="mt-6 text-[26px] font-semibold leading-tight tracking-tight">{heading}</h2>
        <p className="mt-2 max-w-sm text-[14px] text-muted-foreground">
          Just talk to Lucid like you'd text a friend about money.
        </p>

        <div className="mt-7 w-full space-y-2.5">
          {examples.map((e) => (
            <div key={e.tag} className="lucid-card rounded-2xl p-4 text-left">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                {e.tag}
              </div>
              <div className="mt-1.5 text-[14px] text-foreground/90">{e.text}</div>
            </div>
          ))}
        </div>
      </div>
      <PrimaryButton onClick={onGo} disabled={saving}>{saving ? "Setting up…" : "Let's go"}</PrimaryButton>
    </>
  );
}
