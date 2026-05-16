"use client";

import { useEffect, useState } from "react";
import {
  Flame, TrendingUp, TrendingDown, Minus, RefreshCw,
  ExternalLink, MessageCircle, ArrowRight, Star,
} from "lucide-react";
import { useCurrency } from "./useCurrency";

/* ── HypeTracker — "what the internet is talking about" ──────
   Leaderboard of the most-discussed tickers in the news over
   the last 24 hours, ranked by mention count, with a sentiment
   "vibe" badge and the top headline per ticker. Built to feel
   like the WSB front page — Gen Z's daily check on what's hot. */

interface HypeItem {
  ticker:        string;
  name:          string;
  mentions:      number;
  vibe:          "bullish" | "bearish" | "neutral";
  sentiment:     number;
  topHeadline?:  string;
  topUrl?:       string;
  topPublisher?: string;
  price:         number;
  changePct:     number;
}
interface HypeResp { items: HypeItem[]; updatedAt: string; lookbackHours: number; error?: string }

interface Props {
  onSelectTicker?: (t: string) => void;
  onAddToWatchlist?: (t: string) => void;
  watchlist?: string[];
}

const mono:    React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

const VIBE = {
  bullish:  { label: "Bullish",  color: "var(--gain,#00e5a0)", bg: "rgba(0,229,160,0.10)", icon: <TrendingUp size={11}/> },
  bearish:  { label: "Bearish",  color: "var(--loss,#ff4560)", bg: "rgba(255,69,96,0.10)", icon: <TrendingDown size={11}/> },
  neutral:  { label: "Mixed",    color: "var(--ink2,#7A9CBF)", bg: "rgba(255,255,255,0.04)", icon: <Minus size={11}/> },
} as const;

export default function HypeTracker({ onSelectTicker, onAddToWatchlist, watchlist = [] }: Props) {
  const { f$ } = useCurrency();
  const [data, setData] = useState<HypeResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/hype");
      const d = await r.json() as HypeResp;
      if (!r.ok || d.error) { setErr(d.error ?? "Failed to load"); return; }
      setData(d);
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const items = data?.items ?? [];

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(232,68,90,0.18), rgba(155,114,245,0.10))",
            border: "1px solid rgba(232,68,90,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={20} color="#ff4560"/>
          </div>
          <div>
            <h2 style={{ ...display, fontSize: 22, fontWeight: 800, color: "var(--ink0,#f4f0ff)", margin: 0, letterSpacing: "-0.02em" }}>
              Hype
            </h2>
            <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              Most-discussed tickers · last {data?.lookbackHours ?? 24}h · {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          title="Refresh"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            borderRadius: 9, background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border,rgba(60,48,100,0.5))",
            color: "var(--ink2,#7A9CBF)", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11, fontFamily: "'Bricolage Grotesque',system-ui,sans-serif",
          }}>
          <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }}/>
          Refresh
        </button>
      </div>

      {/* Vibe legend */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", ...mono, fontSize: 10, color: "var(--ink3,#3D5A7A)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Flame size={11} color="#ff6b35"/> Mentions = headline buzz
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "var(--gain,#00e5a0)" }}/> Bullish
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "var(--loss,#ff4560)" }}/> Bearish
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, background: "var(--ink3,#3D5A7A)" }}/> Mixed
        </span>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="skel" style={{ height: 88, borderRadius: 12 }}/>)}
        </div>
      )}

      {/* Error */}
      {err && !loading && (
        <div style={{ padding: 24, textAlign: "center", borderRadius: 14, background: "rgba(255,69,96,0.08)", border: "1px solid rgba(255,69,96,0.32)", color: "var(--loss,#ff4560)", ...mono, fontSize: 12 }}>
          {err}
        </div>
      )}

      {/* Empty */}
      {!loading && !err && items.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", fontSize: 13 }}>
          No tickers with significant news buzz in the last 24h. Check back later.
        </div>
      )}

      {/* Leaderboard rows */}
      {items.length > 0 && (() => {
        // Bar magnitude relative to the noisiest ticker
        const maxMentions = Math.max(...items.map(i => i.mentions), 1);
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item, i) => {
              const v = VIBE[item.vibe];
              const pct = (item.mentions / maxMentions) * 100;
              const watched = watchlist.includes(item.ticker);
              const moveColor = item.changePct >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)";
              return (
                <div key={item.ticker} style={{
                  position: "relative",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border,rgba(60,48,100,0.5))",
                  padding: "14px 16px",
                  overflow: "hidden",
                }}>
                  {/* Mention bar — soft accent at the bottom */}
                  <div style={{
                    position: "absolute", left: 0, bottom: 0, height: 3,
                    width: `${pct}%`, background: v.color, opacity: 0.5,
                    transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)",
                  }}/>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ ...mono, fontSize: 11, fontWeight: 700, color: "var(--ink4,#1F3550)", minWidth: 22, textAlign: "right" }}>
                      #{i + 1}
                    </span>

                    {/* Ticker + name + headline */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => onSelectTicker?.(item.ticker)}
                          style={{ ...mono, fontSize: 15, fontWeight: 700, color: "var(--ticker-blue,#7EB6FF)", background: "none", border: "none", padding: 0, cursor: "pointer", letterSpacing: "0.02em" }}>
                          {item.ticker}
                        </button>
                        <span style={{ fontSize: 11, color: "var(--ink3,#3D5A7A)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "min(220px, 50vw)" }}>
                          {item.name}
                        </span>
                        <span style={{
                          ...mono, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
                          background: v.bg, color: v.color, border: `1px solid ${v.color}`,
                          textTransform: "uppercase", letterSpacing: "0.10em",
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          {v.icon} {v.label}
                        </span>
                      </div>
                      {item.topHeadline && (
                        item.topUrl ? (
                          <a href={item.topUrl} target="_blank" rel="noopener noreferrer"
                            style={{ display: "block", fontSize: 12, color: "var(--ink2,#7A9CBF)", margin: "6px 0 0", lineHeight: 1.4, textDecoration: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={item.topHeadline}>
                            <ExternalLink size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4, color: "var(--ink4,#1F3550)" }}/>
                            {item.topHeadline}
                            {item.topPublisher && (
                              <span style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", marginLeft: 6 }}>
                                · {item.topPublisher}
                              </span>
                            )}
                          </a>
                        ) : (
                          <p style={{ fontSize: 12, color: "var(--ink2,#7A9CBF)", margin: "6px 0 0", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.topHeadline}
                          </p>
                        )
                      )}
                    </div>

                    {/* Right column: mentions + price */}
                    <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                      <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: v.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Flame size={11}/> {item.mentions}
                      </div>
                      {item.price > 0 && (
                        <>
                          <div style={{ ...mono, fontSize: 11, color: "var(--ink1,#cdc7e0)" }}>{f$(item.price)}</div>
                          <div style={{ ...mono, fontSize: 10, color: moveColor, fontWeight: 600 }}>
                            {item.changePct >= 0 ? "+" : ""}{item.changePct.toFixed(2)}%
                          </div>
                        </>
                      )}
                    </div>

                    {/* Watch + open */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => onAddToWatchlist?.(item.ticker)}
                        title={watched ? "In your watchlist" : "Add to watchlist"}
                        style={{
                          background: watched ? "rgba(240,165,0,0.16)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${watched ? "rgba(240,165,0,0.50)" : "var(--border,rgba(60,48,100,0.5))"}`,
                          color: watched ? "var(--gold,#f0a500)" : "var(--ink3,#3D5A7A)",
                          borderRadius: 8, padding: 6, cursor: "pointer", display: "flex",
                        }}>
                        <Star size={12} fill={watched ? "currentColor" : "none"}/>
                      </button>
                      <button onClick={() => onSelectTicker?.(item.ticker)}
                        title={`Open ${item.ticker}`}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border,rgba(60,48,100,0.5))",
                          color: "var(--ink2,#7A9CBF)",
                          borderRadius: 8, padding: 6, cursor: "pointer", display: "flex",
                        }}>
                        <ArrowRight size={12}/>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textAlign: "center", marginTop: 18, textTransform: "uppercase", letterSpacing: "0.10em", lineHeight: 1.6 }}>
        Sentiment scored from headline language · Mention count = unique articles · Not financial advice
      </p>
    </div>
  );
}
