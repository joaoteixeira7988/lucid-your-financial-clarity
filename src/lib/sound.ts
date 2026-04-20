/**
 * Lucid sound system — minimal, premium, iOS-inspired.
 *
 * Synthesized with WebAudio (no asset files). Each sound is a short, soft
 * envelope-shaped tone — never playful, never loud. Respects prefers-reduced-motion
 * and a global mute toggle persisted to localStorage.
 */

type SoundKind = "tap" | "send" | "confirm";

const STORAGE_KEY = "lucid-sound-muted";
let ctx: AudioContext | null = null;
let lastPlayedAt = 0;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setMuted(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Play a tiny, low-volume tone. Throttled to prevent stacking.
 */
export function playSound(kind: SoundKind = "tap") {
  if (typeof window === "undefined") return;
  if (isMuted() || prefersReducedMotion()) return;

  const now = performance.now();
  if (now - lastPlayedAt < 60) return; // anti-stack
  lastPlayedAt = now;

  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();

  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  // Tuning per kind — all <100ms, low gain, soft sine
  let freq = 720;
  let dur = 0.06;
  let peak = 0.035;

  if (kind === "tap") {
    freq = 720;
    dur = 0.055;
    peak = 0.03;
  } else if (kind === "send") {
    freq = 880;
    dur = 0.07;
    peak = 0.04;
  } else if (kind === "confirm") {
    freq = 980;
    dur = 0.085;
    peak = 0.045;
  }

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  // Gentle downward glide for a "settled" feel
  osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t + dur);

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
