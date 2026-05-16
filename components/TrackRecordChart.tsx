"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Line,
} from "recharts";
import { TrendingUp, TrendingDown, Activity, Sparkles } from "lucide-react";

/* ── TrackRecordChart ────────────────────────────────────────
   "If you'd bought the AI's BUY picks on each snapshot date and
    held to today, here's your return vs. just buying SPY."
   - X axis = pick date (one point per snapshot day)
   - Y axis = % return since that date, measured to today
   - AI line = average return of that day's BUY picks held to now
   - SPY line = SPY return from that date to now (overlay)
   The 0% reference line is drawn so users see break-even at
   a glance. */

interface SeriesPoint {
  date:         string;
  returnPct:    number;
  spyReturnPct: number | null;
  picks:        number;
}

interface Props {
  series:    SeriesPoint[];
  /** Days window the parent is showing — used in the empty-state
   *  copy so users know which window they're looking at. */
  days:      7 | 30 | 90 | 365;
}

const mono:    React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

export default function TrackRecordChart({ series, days }: Props) {
  const data = useMemo(() => {
    return series.map(s => ({
      date:  s.date,
      ai:    s.returnPct,
      spy:   s.spyReturnPct,
      picks: s.picks,
    }));
  }, [series]);

  // Empty / single-point state — render a small explainer instead of
  // a chart with one dot, which Recharts would draw as nothing visible.
  if (data.length < 2) {
    return (
      <div style={{
        marginBottom: 18,
        padding: "28px 26px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border, rgba(60,48,100,0.5))",
        textAlign: "center",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
          background: "rgba(155,114,245,0.10)", border: "1px solid rgba(155,114,245,0.28)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={18} color="#9B72F5" />
        </div>
        <p style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: "0 0 4px" }}>
          Not enough snapshots yet to chart
        </p>
        <p style={{ fontSize: 12, color: "var(--ink2,#7A9CBF)", margin: 0, lineHeight: 1.55, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
          The AI Top 15 only saves a snapshot when someone runs an analysis. The {days === 365 ? "1y" : `${days}d`} window currently has {data.length === 0 ? "no snapshots" : "only one snapshot"} — open the Top 15 tab daily, or pick a wider range, to grow this chart.
        </p>
      </div>
    );
  }

  const lastAi  = data[data.length - 1].ai;
  const firstAi = data[0].ai;
  const lastSpy = data[data.length - 1].spy;
  const firstSpy = data[0].spy;

  // Y domain: tight to actual range so small differences are visible.
  const allValues = data.flatMap(d => [d.ai, ...(d.spy != null ? [d.spy] : []), 0]);
  const lo = Math.min(...allValues);
  const hi = Math.max(...allValues);
  const pad = Math.max((hi - lo) * 0.15, 1);
  const yMin = lo - pad;
  const yMax = hi + pad;

  // Best vs SPY indicator — first snapshot is the OLDEST (longest hold),
  // which is usually the most informative "follow strategy" return.
  const aiVsSpyFirst = (firstSpy != null) ? firstAi - firstSpy : null;
  const wonVsSpy = aiVsSpyFirst != null && aiVsSpyFirst > 0;

  return (
    <div style={{
      marginBottom: 18,
      borderRadius: 14,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border, rgba(60,48,100,0.5))",
      padding: "16px 18px 6px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <Activity size={13} color="var(--gold, #f0a500)" />
            <p style={{ ...mono, fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, margin: 0 }}>
              Follow-the-AI return
            </p>
          </div>
          <p style={{ fontSize: 11, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.4, maxWidth: 480 }}>
            Each point: &ldquo;if you&apos;d bought the AI&apos;s BUY picks on this date, this is your return today&rdquo; — vs. SPY held over the same window.
          </p>
        </div>
        {aiVsSpyFirst != null && (
          <span style={{
            ...mono, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 99,
            background: wonVsSpy ? "rgba(0,229,160,0.12)" : "rgba(255,69,96,0.12)",
            border: `1px solid ${wonVsSpy ? "rgba(0,229,160,0.40)" : "rgba(255,69,96,0.40)"}`,
            color: wonVsSpy ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)",
            display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
            {wonVsSpy ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
            {wonVsSpy ? "+" : ""}{aiVsSpyFirst.toFixed(2)}% vs SPY (oldest pick)
          </span>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: 220, marginLeft: -8, marginRight: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="tr-ai-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)"} stopOpacity={0.30} />
                <stop offset="100%" stopColor={lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--ink4,#1F3550)", fontSize: 9, fontFamily: "DM Mono" }}
              tickFormatter={(d: string) => {
                const dt = new Date(d + "T12:00:00");
                return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }}
              tickLine={false} axisLine={false}
              interval="preserveStartEnd"
              minTickGap={56}
            />
            <YAxis
              tick={{ fill: "var(--ink4,#1F3550)", fontSize: 9, fontFamily: "DM Mono" }}
              tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`}
              tickLine={false} axisLine={false}
              width={48}
              domain={[yMin, yMax]}
            />
            <Tooltip
              cursor={{ stroke: "var(--border-hi, rgba(90,72,150,0.6))", strokeWidth: 1 }}
              contentStyle={{ background: "rgba(8,6,16,0.97)", border: "1px solid var(--border-hi, rgba(90,72,150,0.6))", borderRadius: 10, padding: "8px 12px", fontFamily: "'DM Mono', monospace", fontSize: 12 }}
              labelStyle={{ color: "var(--ink3,#3D5A7A)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}
              formatter={((v: number, name: string, item: { payload?: { picks?: number } }) => {
                const label = name === "ai" ? "AI picks" : name === "spy" ? "SPY" : name;
                if (typeof v !== "number") return [v as unknown as string, label];
                const sign = v >= 0 ? "+" : "";
                const tail = name === "ai" && item?.payload?.picks
                  ? ` (${item.payload.picks} picks)`
                  : "";
                return [`${sign}${v.toFixed(2)}%${tail}`, label];
              }) as never}
              labelFormatter={((d: string) => {
                const dt = new Date(d + "T12:00:00");
                return `Picked ${dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
              }) as never}
            />
            <ReferenceLine y={0} stroke="var(--ink3,#3D5A7A)" strokeDasharray="4 6" strokeOpacity={0.5} />
            <Area
              type="monotone"
              dataKey="ai"
              name="ai"
              stroke={lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)"}
              strokeWidth={2}
              fill="url(#tr-ai-grad)"
              dot={{ r: 3, strokeWidth: 0, fill: lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)" }}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="spy"
              name="spy"
              stroke="var(--ticker-blue,#7EB6FF)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 4px 0", fontSize: 10, ...mono, color: "var(--ink3,#3D5A7A)", flexWrap: "wrap", gap: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 14, height: 2, background: lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)" }}/> AI picks
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 14, height: 2, background: "var(--ticker-blue,#7EB6FF)", borderTop: "2px dashed var(--ticker-blue,#7EB6FF)", borderRadius: 0 }}/> SPY
          </span>
        </span>
        <span style={{ letterSpacing: "0.06em" }}>
          {data.length} snapshot{data.length === 1 ? "" : "s"}
          {lastSpy != null && (
            <> · latest: AI <strong style={{ color: lastAi >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)" }}>
              {lastAi >= 0 ? "+" : ""}{lastAi.toFixed(2)}%
            </strong> vs SPY <strong style={{ color: "var(--ticker-blue,#7EB6FF)" }}>
              {lastSpy >= 0 ? "+" : ""}{lastSpy.toFixed(2)}%
            </strong></>
          )}
        </span>
      </div>
    </div>
  );
}
