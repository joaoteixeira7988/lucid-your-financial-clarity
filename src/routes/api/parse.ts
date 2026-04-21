import { createFileRoute } from "@tanstack/react-router";

/**
 * Server route: GPT-powered structured financial input parser.
 * Returns a normalized ParsedResult-shaped JSON via tool calling.
 */

const SYSTEM_PROMPT = `You are Lucid's financial intent parser. The user types short natural-language messages about their money (expenses, income, assets, investments, goals, or questions). Your only job is to classify the intent and extract structured fields. Be precise.

Rules:
- "investment_log": cryptocurrencies (BTC, ETH, SOL, SUI, ADA, XRP, DOGE, MATIC, DOT, LINK, AVAX, etc.), stocks/tickers, ETFs, bonds, brokerage. Crypto/stock symbols ALWAYS mean investment_log — never expense.
- "asset_log": items that retain value — car, house, watch, jewelry, gold, electronics, furniture, cash, savings deposit. "Bought a car for 20k" → asset_log.
- "expense_log": consumption — food, transport, bills, shopping, entertainment.
- "income_log": salary, paycheck, client paid, freelance income.
- "goal_create": save X, spend less, reach net worth, weekly/monthly targets.
- "question": any question about their finances.
- "unknown": not financial.

Amount parsing: "20k" = 20000, "1.5m" = 1500000, "300 eur" → amount=300 currency=EUR. "0.4 ETH" → quantity=0.4 symbol=ETH (no amount).
For investment_log: if user says "X worth of SYM" or "X eur of SYM", it's amount in currency. If user says "add 0.5 ETH" or "have 2 BTC", it's quantity.
For multiple items in one message ("0.4 ETH and 500 of BTC"), return multiple entries.

Confidence: 0.9+ when clear, 0.7 when reasonable, <0.7 when ambiguous.`;

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "parse_financial_input",
    description: "Extract structured financial intent and entries from user input.",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["expense_log", "income_log", "asset_log", "investment_log", "goal_create", "question", "unknown"],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        entries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "number", description: "Monetary amount in the given currency" },
              quantity: { type: "number", description: "Crypto/stock unit quantity (e.g. 0.5 ETH)" },
              currency: { type: "string", enum: ["USD", "EUR", "GBP", "AED"] },
              category: {
                type: "string",
                enum: ["Food", "Groceries", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Travel", "Income", "Other"],
              },
              merchant: { type: "string" },
              symbol: { type: "string", description: "Ticker like BTC, ETH, SUI, AAPL" },
              assetKind: {
                type: "string",
                enum: ["cash", "savings", "crypto", "stock", "vehicle", "property", "valuable", "electronics", "furniture", "other"],
              },
              assetName: { type: "string" },
            },
          },
        },
        goal: {
          type: "object",
          properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["save", "spend_less", "net_worth"] },
            targetAmount: { type: "number" },
            timeframe: { type: "string", enum: ["week", "month", "year"] },
            months: { type: "number", description: "Number of months until deadline" },
            category: { type: "string" },
          },
        },
        reply: { type: "string", description: "Short, calm 1-sentence confirmation. Empty for questions." },
      },
      required: ["intent", "confidence", "entries", "reply"],
      additionalProperties: false,
    },
  },
};

export const Route = createFileRoute("/api/parse")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { text, baseCurrency } = (await request.json()) as {
            text: string;
            baseCurrency: string;
          };
          if (!text || typeof text !== "string") {
            return Response.json({ error: "Missing text" }, { status: 400 });
          }

          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "LOVABLE_API_KEY not configured" }, { status: 500 });
          }

          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Base currency: ${baseCurrency || "USD"}\nInput: ${text}` },
              ],
              tools: [TOOL_SCHEMA],
              tool_choice: { type: "function", function: { name: "parse_financial_input" } },
            }),
          });

          if (!res.ok) {
            const status = res.status;
            const body = await res.text();
            console.error("AI gateway error:", status, body);
            return Response.json({ error: "ai_error", status }, { status });
          }

          const data = await res.json();
          const call = data.choices?.[0]?.message?.tool_calls?.[0];
          if (!call?.function?.arguments) {
            return Response.json({ error: "no_tool_call" }, { status: 502 });
          }
          const parsed = JSON.parse(call.function.arguments);
          return Response.json(parsed);
        } catch (e) {
          console.error("parse handler error:", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "unknown" },
            { status: 500 }
          );
        }
      },
    },
  },
});
