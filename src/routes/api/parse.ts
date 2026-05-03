import { createFileRoute } from "@tanstack/react-router";

const SYSTEM_PROMPT = `You are Lucid's financial intent parser. The user types short natural-language messages about their money (expenses, income, assets, investments, goals, or questions). Your only job is to classify the intent and extract structured fields. Be precise.

Rules:

investment_log: cryptocurrencies (BTC, ETH, SOL, SUI, ADA, XRP, DOGE, MATIC, DOT, LINK, AVAX, etc.), stocks/tickers, ETFs, bonds, brokerage. Crypto/stock symbols ALWAYS mean investment_log — never expense.

asset_log: items that retain value — car, house, watch, jewelry, gold, electronics, furniture, cash, savings deposit.

expense_log: consumption — food, transport, bills, shopping, entertainment.

income_log: salary, paycheck, client paid, freelance income.

goal_create: save X, spend less, reach net worth, weekly/monthly targets.

question: any question about their finances.

unknown: not financial.

Amount parsing: 20k = 20000, 1.5m = 1500000, 300 eur means amount=300 currency=EUR.

CRITICAL investment quantity rule: A number written directly before a crypto or stock symbol is ALWAYS a unit quantity. Examples: '0.5 ETH' means quantity=0.5 symbol=ETH with NO amount field. '2 BTC' means quantity=2 symbol=BTC with NO amount field. '10 SOL' means quantity=10 symbol=SOL with NO amount field. NEVER interpret a bare number before a symbol as a currency amount. Only set the amount field when the user explicitly mentions a currency: '500 dollars of ETH' means amount=500 currency=USD. '200 AED of BTC' means amount=200 currency=AED.

For multiple items in one message return multiple entries.

Confidence: 0.9+ when clear, 0.7 when reasonable, below 0.7 when ambiguous.`;

const TOOL_SCHEMA = {
  name: "parse_financial_input",
  description: "Extract structured financial intent and entries from user input.",
  input_schema: {
    type: "object" as const,
    properties: {
      intent: {
        type: "string",
        enum: ["expense_log", "income_log", "asset_log", "investment_log", "goal_create", "question", "unknown"],
      },
      confidence: { type: "number" },
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            amount: { type: "number" },
            quantity: { type: "number" },
            currency: { type: "string", enum: ["USD", "EUR", "GBP", "AED"] },
            category: {
              type: "string",
              enum: ["Food", "Groceries", "Transport", "Shopping", "Bills", "Entertainment", "Health", "Travel", "Income", "Other"],
            },
            merchant: { type: "string" },
            symbol: { type: "string" },
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
          months: { type: "number" },
          category: { type: "string" },
        },
      },
      reply: { type: "string" },
    },
    required: ["intent", "confidence", "entries", "reply"],
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

          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
          }

          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 1024,
              system: SYSTEM_PROMPT,
              messages: [
                {
                  role: "user",
                  content: `Base currency: ${baseCurrency || "USD"}\nInput: ${text}`,
                },
              ],
              tools: [TOOL_SCHEMA],
              tool_choice: { type: "tool", name: "parse_financial_input" },
            }),
          });

          if (!res.ok) {
            const status = res.status;
            const body = await res.text();
            console.error("Anthropic API error:", status, body);
            return Response.json({ error: "ai_error", status }, { status });
          }

          const data = await res.json();

          // Claude returns tool use in content blocks
          const toolUseBlock = data.content?.find(
            (block: { type: string }) => block.type === "tool_use"
          );

          if (!toolUseBlock?.input) {
            return Response.json({ error: "no_tool_call" }, { status: 502 });
          }

          return Response.json(toolUseBlock.input);
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
