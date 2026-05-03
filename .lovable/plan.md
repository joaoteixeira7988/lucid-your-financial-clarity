## Fix investment quantity bug in ChatInput

When the user types "bought 0.5 ETH", the parser sets `quantity=0.5` and (incorrectly) also `amount=0.5`. The current handler then treats `0.5` as a currency amount and computes `purchaseValueBase`, which downstream logic conflates with the unit quantity, producing wrong portfolio values.

### Change

In `src/components/ChatInput.tsx`, inside the `result.intent === "investment_log"` loop (around lines 138–164):

1. Add a `console.log("[investment_log] parsed entry:", { quantity, amount, symbol, currency, assetKind })` at the top of the loop body so we can see exactly what the parser returns.

2. Introduce `const hasUnitQuantity = quantity != null && !!symbol;`

3. Only compute `purchaseValueBase` from `e.amount` when `!hasUnitQuantity`. If both quantity and symbol are present, ignore `e.amount` entirely and let the existing `quantity * livePriceUsd` branch derive `purchaseValueBase` from the live price.

No other files change. Behavior for currency-denominated inputs ("$500 of ETH") and for amount-only inputs (no quantity) is preserved by the existing two follow-up branches.
