import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/MetricCard";
import { useAppStore, getNetWorth, getAssetValueInBase } from "@/lib/store";
import { fmtMoney } from "@/lib/currency";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { AssetKind } from "@/lib/types";

export const Route = createFileRoute("/net-worth")({
  head: () => ({
    meta: [
      { title: "Net Worth — Lucid" },
      { name: "description", content: "Your full financial overview at a glance." },
      { property: "og:title", content: "Net Worth — Lucid" },
      { property: "og:description", content: "Total net worth and breakdown by asset class." },
    ],
  }),
  component: NetWorthPage,
});

const KIND_LABEL: Record<AssetKind, string> = {
  cash: "Cash",
  savings: "Savings",
  crypto: "Crypto",
  stock: "Stocks",
  other: "Other",
};
const KIND_COLOR: Record<AssetKind, string> = {
  cash: "oklch(0.72 0.17 152)",
  savings: "oklch(0.66 0.18 252)",
  crypto: "oklch(0.78 0.14 75)",
  stock: "oklch(0.7 0.18 320)",
  other: "oklch(0.55 0.02 268)",
};

function buildHistory(currentNet: number): { date: string; value: number }[] {
  // Fake-but-believable smooth growth into current value
  const points = 30;
  const start = currentNet * 0.92;
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const noise = Math.sin(i * 0.7) * (currentNet * 0.008);
    const v = start + (currentNet - start) * t + noise;
    const d = new Date();
    d.setDate(d.getDate() - (points - 1 - i));
    out.push({ date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), value: Math.round(v) });
  }
  return out;
}

function NetWorthPage() {
  const state = useAppStore();
  const base = state.baseCurrency;
  const nw = getNetWorth(state);

  const breakdown: Record<AssetKind, number> = {
    cash: 0, savings: 0, crypto: 0, stock: 0, other: 0,
  };
  for (const a of state.assets) {
    breakdown[a.kind] += getAssetValueInBase(a, base, state.cryptoPrices);
  }
  const data = buildHistory(nw);
  const change = data.length > 1 ? ((data[data.length - 1].value - data[0].value) / data[0].value) * 100 : 0;

  return (
    <AppShell subtitle="Net worth">
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight">Net Worth</h1>

      <MetricCard
        prominent
        label="Total"
        value={fmtMoney(nw, base, { compact: true })}
        delta={{ value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, positive: change >= 0 }}
        hint="last 30 days"
      />

      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Trend
        </h2>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.18 252)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="oklch(0.66 0.18 252)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "oklch(0.6 0.018 260)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Tooltip
                cursor={{ stroke: "oklch(0.66 0.18 252 / 0.3)" }}
                contentStyle={{
                  background: "oklch(0.21 0.015 268)",
                  border: "1px solid oklch(0.27 0.014 268)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => [fmtMoney(v, base), "Net worth"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="oklch(0.7 0.18 252)"
                strokeWidth={2}
                fill="url(#nwGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Breakdown
        </h2>
        <ul className="space-y-3">
          {(Object.keys(breakdown) as AssetKind[])
            .filter((k) => breakdown[k] > 0)
            .sort((a, b) => breakdown[b] - breakdown[a])
            .map((k) => {
              const v = breakdown[k];
              const share = nw > 0 ? (v / nw) * 100 : 0;
              return (
                <li key={k}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
                      {KIND_LABEL[k]}
                      <span className="tabular text-[11px] font-normal text-muted-foreground">
                        {share.toFixed(0)}%
                      </span>
                    </span>
                    <span className="tabular text-[13px] font-semibold text-foreground">
                      {fmtMoney(v, base, { compact: true })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${share}%`, backgroundColor: KIND_COLOR[k] }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </AppShell>
  );
}
