

## Fix: Onboarding skips immediately to the main hub

### Root cause

The Zustand store in `src/lib/store.ts` uses `persist` middleware, and `onboardingComplete` is part of the persisted state. Once the flag flips to `true` (from a prior session, a hot reload during development, or any earlier `completeOnboarding()` call), it's saved in `localStorage` forever. On the next load, the gate in `src/routes/index.tsx`:

```tsx
{!onboardingComplete && <Onboarding />}
```

…sees `true` from the rehydrated store and never mounts the onboarding screen. That's why it appears to "skip automatically before you write anything" — it was already marked complete in storage.

A secondary issue makes this worse: in onboarding, the `submit` flow auto-advances `hero → reveal → second` after 1.6s, but `finish()` is only called on explicit user click. However if the persisted localStorage already contained `onboardingComplete: true` from any earlier test, the screen never appears at all.

### The fix

**1. Stop persisting the onboarding flag**

In `src/lib/store.ts`, configure `persist` with a `partialize` option that excludes `onboardingComplete` (and ideally `messages`, since "engagement" is also session-like for first-run feel). This ensures onboarding state is decided fresh per session based on actual data, not a sticky flag.

**2. Derive "needs onboarding" from real data, not a flag**

Replace the boolean with a derived check:
- Show onboarding when the user has **no transactions, no assets, and no messages** — i.e., a true blank slate.
- Once they submit their first command in onboarding, the new transaction/message exists, so the derived check naturally flips to "complete" without needing a persisted flag.

This makes the behavior self-healing: clearing data re-shows onboarding; using the app hides it. No flag drift possible.

**3. Clear the stale persisted value on load (one-time migration)**

Bump the persist `version` so existing users with `onboardingComplete: true` already in localStorage get reset cleanly, and the new `partialize` takes effect.

**4. Keep `Skip` working**

The `Skip` button and `finish()` path still call `completeOnboarding()`, but now that just sets in-memory state for the current session — enough to dismiss the overlay until they engage for real.

### Files to change

- `src/lib/store.ts`
  - Add `partialize` to `persist` options to omit `onboardingComplete` and `messages` from storage.
  - Bump `version` (and add a no-op `migrate`) so cached state from prior sessions is invalidated.
  - Keep `completeOnboarding` for the in-session dismiss.

- `src/routes/index.tsx`
  - Replace `const onboardingComplete = state.onboardingComplete;` with a derived `showOnboarding = !state.onboardingComplete && state.transactions.length === 0 && state.assets.length === 0 && state.messages.length === 0;`
  - Render `{showOnboarding && <Onboarding />}`.

- `src/components/Onboarding.tsx`
  - No structural changes needed; `submit()` already adds a transaction + message, which (combined with the derived check above) hides the overlay after the reveal stage completes via `finish()`.

### Result

- Fresh load → onboarding shows, command bar focused, user can type.
- After first command → reveal stage plays, then either `Set goal` or `Continue` dismisses cleanly.
- Reload mid-app (with real data) → onboarding stays hidden.
- Clearing localStorage → onboarding returns. No more "skipped automatically."

