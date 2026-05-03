## Problem

The Net Worth hero sums **every** asset (cash, savings, investments, tangibles) minus liabilities. The Portfolio page only shows two slices:

- **Investments tab** → crypto + stock only (`getInvestmentValue`)
- **Assets tab** → vehicle/property/valuables/etc. only (`getTangibleAssetValue`)

Cash and Savings are invisible on Portfolio, so Portfolio's headline numbers are always smaller than Net Worth. That's the mismatch.

## Fix

Make Portfolio account for everything Net Worth counts, while keeping the existing Investments / Assets breakdown views useful.

### 1. Add a "Total" header card to Portfolio (always visible, above the segmented control)

A single prominent card showing **Total portfolio = Net Worth** in the base currency, with a one-line breakdown chip row underneath:

```text
┌──────────────────────────────────────────┐
│ TOTAL                                    │
│ $58,340                                  │
│ Cash $3.2k · Savings $12.4k ·            │
│ Investments $11.5k · Assets $34.5k       │
└──────────────────────────────────────────┘
```

This number will exactly equal the Net Worth hero (minus liabilities, which Portfolio will also subtract for parity). No more "where did the rest of my money go?" confusion.

### 2. Relabel the existing tab metric cards

- Investments tab `MetricCard` label: "Portfolio value" → **"Investments"** (it's a subset, name it accurately).
- Assets tab `MetricCard` label: keep "Tracked assets".

Both keep their current numbers; only the headline framing changes so the user understands these are slices of the Total above.

### 3. Add a third "Cash" segment to the tab control

A new `cash` view listing each cash + savings asset (name, kind, value), so every dollar counted in Total is reachable from Portfolio. Empty state mirrors the others ("No cash accounts yet…").

### 4. Wire the Total card to live state

`Total = getNetWorth(state)` (already exists in `src/lib/store.ts`). The breakdown chips reuse `getCashTotal`, `getInvestmentValue`, `getTangibleAssetValue`, plus a savings split (filter `kind === "savings"` vs `"cash"` for the chip detail).

## Files to change

- `src/routes/portfolio.tsx` — add Total card, add Cash view, extend segmented control to 3 options, relabel Investments metric card.

No store, parser, or chat changes needed — the underlying numbers are already correct; this is a presentation fix so Portfolio reconciles with Net Worth at a glance.

## Out of scope (call out, don't fix here)

- The Net Worth page's "−30 days" delta is synthetic (`buildHistory` fabricates a curve). If you want that to be real, it's a separate task that needs a net-worth history table.
