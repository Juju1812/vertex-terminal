"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

/* ── PortfolioChart ──────────────────────────────────────────
   Renders the time-series of total portfolio value built from
   the per-portfolio `snapshots` array. If a starting cash baseline
   is set, draws a dashed reference line at that value so the user
   sees gain vs. break-even at a glance. */

interface Snapshot { d: string; v: number }

interface Props {
  snapshots:   Snapshot[];
  startingCash?: number | null;
  startedAt?:    string | null;
  format$:    (n: number, d?: number) => string;
  /** Today's live total — appended to the series so the chart
   *  trails right up to "now" instead of stopping at the last
   *  saved snapshot. Pass null to skip. */
  liveValue?: number | null;
}

export default function PortfolioChart({ snapshots, startingCash, startedAt, format$, liveValue }: Props) {
  const data = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, number>();
    for (const s of snapshots) map.set(s.d, s.v);
    if (typeof liveValue === "number" && liveValue > 0) map.set(today, liveValue);
    return [...map.entries()]
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([d, v]) => ({ d, v }));
  }, [snapshots, liveValue]);

  if (!data.length) return null;

  const first = data[0].v;
  const last  = data[data.length - 1].v;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const up = change >= 0;
  const lineColor = up ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)";
  const fillId = `pf-grad-${up ? "up" : "dn"}`;

  // Y domain: tight to the actual range with ~6% headroom either side
  // so the line doesn't touch the edges. Recharts' "auto" pads too
  // aggressively, which makes small moves look completely flat.
  const vs   = data.map(d => d.v);
  const lo   = Math.min(...vs, startingCash ?? Infinity);
  const hi   = Math.max(...vs, startingCash ?? -Infinity);
  const pad  = Math.max((hi - lo) * 0.08, hi * 0.005, 1);
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;

  return (
    <div style={{
      borderRadius: 14,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border, rgba(60,48,100,0.5))",
      padding: "16px 18px 4px",
      marginBottom: 18,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={13} color="var(--gold, #f0a500)" />
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 9,
            color: "var(--ink3, #3D5A7A)",
            textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700,
            margin: 0,
          }}>
            Portfolio value · {data.length} {data.length === 1 ? "day" : "days"} of history
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
          {up ? <TrendingUp size={11} color={lineColor}/> : <TrendingDown size={11} color={lineColor}/>}
          <span style={{ color: lineColor, fontWeight: 600 }}>
            {up ? "+" : ""}{format$(change)} ({up ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div style={{ height: 200, marginLeft: -8, marginRight: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lineColor} stopOpacity={0.28} />
                <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="d"
              tick={{ fill: "var(--ink4,#1F3550)", fontSize: 9, fontFamily: "DM Mono" }}
              tickFormatter={(d: string) => {
                // "2026-05-02" → "May 2"
                const dt = new Date(d + "T12:00:00");
                return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
              minTickGap={56}
            />
            <YAxis
              tick={{ fill: "var(--ink4,#1F3550)", fontSize: 9, fontFamily: "DM Mono" }}
              tickFormatter={(v: number) => format$(v, 0)}
              tickLine={false} axisLine={false}
              width={64}
              domain={[yMin, yMax]}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-hi, rgba(90,72,150,0.6))", strokeWidth: 1 }}
              contentStyle={{ background: "rgba(8,6,16,0.97)", border: "1px solid var(--border-hi, rgba(90,72,150,0.6))", borderRadius: 10, padding: "8px 12px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}
              labelStyle={{ color: "var(--ink3,#3D5A7A)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}
              formatter={((v: number) => [format$(v), "Value"]) as never}
              labelFormatter={((d: string) => {
                const dt = new Date(d + "T12:00:00");
                return dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
              }) as never}
            />
            {typeof startingCash === "number" && startingCash > 0 && (
              <ReferenceLine
                y={startingCash}
                stroke="var(--ink3,#3D5A7A)"
                strokeDasharray="4 6"
                strokeOpacity={0.6}
                label={{ value: `Start ${format$(startingCash, 0)}`, position: "right", fill: "var(--ink3,#3D5A7A)", fontSize: 9, fontFamily: "DM Mono" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="v"
              stroke={lineColor}
              strokeWidth={1.8}
              fill={`url(#${fillId})`}
              dot={false}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {startedAt && (
        <p style={{
          fontFamily: "'DM Mono', monospace", fontSize: 9,
          color: "var(--ink4,#1F3550)",
          margin: "6px 0 8px", textAlign: "right",
          letterSpacing: "0.06em",
        }}>
          Snapshots accumulate daily as you visit · {data.length === 1 ? "first one is today" : `oldest: ${new Date(data[0].d + "T12:00:00").toLocaleDateString()}`}
        </p>
      )}
    </div>
  );
}
