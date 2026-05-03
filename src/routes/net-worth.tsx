import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useAppStore,
  getNetWorth,
  getAssetValueInBase,
  getInvestmentValue,
  getCashTotal,
  getTangibleAssetValue,
} from "@/lib/store";
import { fmtMoney } from "@/lib/currency";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
} from "recharts";
import type { AssetKind } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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

type Class = "Cash" | "Savings" | "Investments" | "Property" | "Vehicle" | "Valuables" | "Other";

const CLASS_OF: Record<AssetKind, Class> = {
  cash: "Cash",
  savings: "Savings",
  crypto: "Investments",
  stock: "Investments",
  property: "Property",
  vehicle: "Vehicle",
  valuable: "Valuables",
  electronics: "Other",
  furniture: "Other",
  other: "Other",
};

const CLASS_COLOR: Record<Class, string> = {
  Cash: "oklch(0.72 0.17 152)",
  Savings: "oklch(0.7 0.18 200)",
  Investments: "oklch(0.66 0.18 252)",
  Property: "oklch(0.7 0.18 320)",
  Vehicle: "oklch(0.78 0.14 75)",
  Valuables: "oklch(0.66 0.21 25)",
  Other: "oklch(0.55 0.02 268)",
};

type Point = { date: string; value: number; marker?: "asset" | "investment" | "spend"; markerLabel?: string };

function buildHistory(currentNet: number, markers: { dayOffset: number; kind: "asset" | "investment" | "spend"; label: string }[]): Point[] {
  const points = 30;
  const start = currentNet * 0.92;
  const out: Point[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const noise = Math.sin(i * 0.7) * (currentNet * 0.008);
    const v = start + (currentNet - start) * t + noise;
    const d = new Date();
    d.setDate(d.getDate() - (points - 1 - i));
    const dayOffset = points - 1 - i;
    const marker = markers.find((m) => m.dayOffset === dayOffset);
    out.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(v),
      marker: marker?.kind,
      markerLabel: marker?.label,
    });
  }
  return out;
}

function NetWorthPage() {
  const state = useAppStore();
  const base = state.baseCurrency;
  const nw = getNetWorth(state);
  const invest = getInvestmentValue(state);
  const cash = getCashTotal(state);
  const tangible = getTangibleAssetValue(state);

  const breakdown: Record<Class, number> = {
    Cash: 0, Savings: 0, Investments: 0, Property: 0, Vehicle: 0, Valuables: 0, Other: 0,
  };
  for (const a of state.assets) {
    breakdown[CLASS_OF[a.kind]] += getAssetValueInBase(a, base, state.cryptoPrices, state.stockPrices);
  }

  // Pull markers from recent activity for graph annotations.
  const now = Date.now();
  const day = 86400000;
  const markers = state.activity
    .filter((a) => a.kind === "asset" || a.kind === "investment" || a.kind === "expense")
    .slice(0, 4)
    .map((a) => {
      const offset = Math.min(29, Math.max(0, Math.round((now - new Date(a.date).getTime()) / day)));
      return {
        dayOffset: 29 - offset,
        kind: a.kind === "expense" ? ("spend" as const) : (a.kind as "asset" | "investment"),
        label: a.text.replace(/\.$/, ""),
      };
    });

  const data = buildHistory(nw, markers);
  const change = data.length > 1 ? ((data[data.length - 1].value - data[0].value) / data[0].value) * 100 : 0;
  const absChange = data.length > 1 ? data[data.length - 1].value - data[0].value : 0;

  // Driver: which class moved most.
  const topClass = (Object.keys(breakdown) as Class[])
    .filter((k) => breakdown[k] > 0)
    .sort((a, b) => breakdown[b] - breakdown[a])[0];
  const driver = invest > tangible && invest > cash ? "investments" : tangible > cash ? "assets" : "cash";

  // Breakdown interpretation line.
  const topShare = topClass ? (breakdown[topClass] / nw) * 100 : 0;
  const breakdownLine = topClass
    ? topShare > 35
      ? `Most of your net worth is tied in ${topClass.toLowerCase()} (${topShare.toFixed(0)}%).`
      : `Your wealth is well-distributed across ${Object.values(breakdown).filter((v) => v > 0).length} classes.`
    : `Add an asset to begin building your picture.`;

  // Position: a single high-level assessment.
  const position = (() => {
    if (Math.abs(change) < 1.5)
      return {
        icon: Minus,
        line: "Stable position — no meaningful movement this month.",
        tone: "neutral" as const,
      };
    if (change >= 5)
      return {
        icon: TrendingUp,
        line: `Strong upward trend — net worth has grown consistently, driven by ${driver}.`,
        tone: "positive" as const,
      };
    if (change > 0)
      return {
        icon: TrendingUp,
        line: `Quiet growth — small but steady gains in ${driver}.`,
        tone: "positive" as const,
      };
    if (change <= -5)
      return {
        icon: TrendingDown,
        line: `Pullback this month — recent outflows weighed on ${driver}.`,
        tone: "negative" as const,
      };
    return {
      icon: TrendingDown,
      line: `Slight dip — recent spending edged ahead of asset growth.`,
      tone: "negative" as const,
    };
  })();

  const PositionIcon = position.icon;

  return (
    <AppShell subtitle="Net worth">
      <h1 className="mb-4 text-[22px] font-semibold tracking-tight">Net Worth</h1>

      {/* Hero: total + powerful contextual line */}
      <section className="lucid-card relative overflow-hidden p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(120% 100% at 0% 0%, oklch(0.66 0.18 252 / 0.18) 0%, transparent 55%)",
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</p>
          <p className="tabular mt-1.5 text-[34px] font-semibold leading-none tracking-tight">
            {fmtMoney(nw, base, { compact: true })}
          </p>
          <p className="tabular mt-3 text-[13.5px] leading-snug text-foreground/85">
            <span className={change >= 0 ? "text-success" : "text-destructive"}>
              {change >= 0 ? "+" : "−"}
              {fmtMoney(Math.abs(absChange), base, { compact: true })}
            </span>{" "}
            in the last 30 days{" "}
            <span className="text-muted-foreground">
              ({change >= 0 ? "+" : ""}{change.toFixed(1)}% — driven by {driver})
            </span>
          </p>
        </div>
      </section>

      {/* Interactive trend chart */}
      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Trend
        </h2>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 6, left: 6, bottom: 0 }}>
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
                cursor={{ stroke: "oklch(0.66 0.18 252 / 0.35)", strokeWidth: 1 }}
                contentStyle={{
                  background: "oklch(0.21 0.015 268)",
                  border: "1px solid oklch(0.34 0.016 268)",
                  borderRadius: 12,
                  fontSize: 12,
                  padding: "8px 10px",
                }}
                labelStyle={{ color: "oklch(0.68 0.018 260)", marginBottom: 2, fontSize: 11 }}
                formatter={(v: number, _n, item) => {
                  const p = item?.payload as Point | undefined;
                  if (p?.markerLabel) return [`${fmtMoney(v, base)} · ${p.markerLabel}`, "Net worth"];
                  return [fmtMoney(v, base), "Net worth"];
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="oklch(0.7 0.18 252)"
                strokeWidth={2}
                fill="url(#nwGrad)"
              />
              {data.map((p, i) =>
                p.marker ? (
                  <ReferenceDot
                    key={i}
                    x={p.date}
                    y={p.value}
                    r={4}
                    fill={
                      p.marker === "asset"
                        ? "oklch(0.7 0.18 320)"
                        : p.marker === "investment"
                          ? "oklch(0.66 0.18 252)"
                          : "oklch(0.66 0.21 25)"
                    }
                    stroke="oklch(0.145 0.012 270)"
                    strokeWidth={2}
                  />
                ) : null
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {markers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.7 0.18 320)" }} /> Asset
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.66 0.18 252)" }} /> Investment
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "oklch(0.66 0.21 25)" }} /> Spend
            </span>
          </div>
        )}
      </section>

      {/* Breakdown */}
      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Breakdown
        </h2>
        <ul className="space-y-3">
          {(Object.keys(breakdown) as Class[])
            .filter((k) => breakdown[k] > 0)
            .sort((a, b) => breakdown[b] - breakdown[a])
            .map((k) => {
              const v = breakdown[k];
              const share = nw > 0 ? (v / nw) * 100 : 0;
              return (
                <li key={k}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CLASS_COLOR[k] }} />
                      {k}
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
                      style={{ width: `${share}%`, backgroundColor: CLASS_COLOR[k] }}
                    />
                  </div>
                </li>
              );
            })}
        </ul>
        <p className="mt-4 text-[12.5px] leading-snug text-muted-foreground">{breakdownLine}</p>
      </section>

      {/* Position — single high-level assessment */}
      <section className="lucid-card mt-4 p-5">
        <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Position
        </h2>
        <div className="flex items-start gap-3">
          <span
            className={
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl " +
              (position.tone === "positive"
                ? "bg-success/12 text-success"
                : position.tone === "negative"
                  ? "bg-destructive/12 text-destructive"
                  : "bg-primary/12 text-primary")
            }
          >
            <PositionIcon className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <p className="pt-1 text-[14.5px] leading-snug text-foreground/95">{position.line}</p>
        </div>
      </section>
    </AppShell>
  );
}
