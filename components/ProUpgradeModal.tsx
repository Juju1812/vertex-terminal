"use client";

import { useState } from "react";
import { X, Zap, Sparkles, Crown, Mail, BarChart3, MessageSquare, Bell, Shield, BookOpen, Check } from "lucide-react";

interface Props {
  onClose: () => void;
  userEmail?: string;
  reason?: string;
}

const V = {
  void:"var(--void,#050407)", surface:"var(--surface,#0d0b16)", raised:"var(--raised,#1a1628)",
  border:"var(--border,rgba(60,48,100,0.5))", borderHi:"var(--border-hi,rgba(90,72,150,0.6))",
  ink0:"var(--ink0,#f4f0ff)", ink1:"var(--ink1,#cdc7e0)", ink2:"var(--ink2,#8a82a8)", ink3:"var(--ink3,#4a4468)", ink4:"var(--ink4,#2d2848)",
  gold:"var(--gold,#f0a500)", goldDim:"var(--gold-dim,rgba(240,165,0,0.10))", goldWire:"var(--gold-wire,rgba(240,165,0,0.28))",
  gain:"var(--gain,#00e5a0)", gainDim:"var(--gain-dim,rgba(0,229,160,0.08))", gainWire:"var(--gain-wire,rgba(0,229,160,0.22))",
  loss:"var(--loss,#ff4560)",
  ame:"#9B72F5", ameDim:"rgba(155,114,245,0.10)", ameWire:"rgba(155,114,245,0.30)",
};
const mono: React.CSSProperties = { fontFamily:"'DM Mono','Courier New',monospace" };

/* Real, currently-enforced gates. Order = perceived value. The
   first three are the "headline" features users hit most, then
   the rest. Keep this in sync with what's actually gated in code. */
const HEADLINE = [
  { icon: <BarChart3 size={16} color={V.gold} />, title: "Full AI Top 15",          desc: "All 15 daily picks with confidence scores, target prices, and risk notes — not just the top 5." },
  { icon: <MessageSquare size={16} color={V.gold} />, title: "Unlimited Ask Claude", desc: "Chat with Claude AI about any ticker, your portfolio, or the market — no daily message cap." },
  { icon: <Mail size={16} color={V.gold} />,      title: "Daily AI brief + earnings", desc: "Personalised pre-market email every weekday plus push alerts when your holdings report." },
];

const SECONDARY = [
  { icon: <Shield size={14} color={V.ame} />,    title: "100% ad-free",            desc: "No ads anywhere on the site." },
  { icon: <BookOpen size={14} color={V.ame} />,  title: "Portfolio simulator",      desc: "Auto-allocate the AI Top 15 picks into a back-tested portfolio." },
  { icon: <Sparkles size={14} color={V.ame} />,  title: "AI portfolio grade",       desc: "Letter grade, strengths, weaknesses, and rebalancing tips." },
  { icon: <Crown size={14} color={V.ame} />,     title: "Public share links",       desc: "Share a public read-only snapshot of your portfolio." },
  { icon: <Bell size={14} color={V.ame} />,      title: "Unlimited watchlists",     desc: "Track multiple themed lists side-by-side." },
];

export default function ProUpgradeModal({ onClose, userEmail, reason }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const upgrade = async () => {
    if (!userEmail) {
      setError("Please sign in first to upgrade.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const d = await r.json() as { url?: string; error?: string };
      if (d.url) {
        window.location.href = d.url;
      } else {
        setError(d.error ?? "Something went wrong.");
        setLoading(false);
      }
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:"fixed", inset:0,
        background:"rgba(0,0,0,0.85)",
        backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
        zIndex:9999,
        display:"flex", alignItems:"center", justifyContent:"center",
        padding:"16px",
        overflow: "auto",
      }}>
      <div style={{
        background: `linear-gradient(180deg, ${V.surface} 0%, #0a0814 100%)`,
        border:`1px solid ${V.borderHi}`,
        borderRadius:20,
        width:"100%", maxWidth:520, overflow:"hidden",
        boxShadow:"0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(240,165,0,0.06)",
        maxHeight: "min(680px, 95vh)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Gold top bar */}
        <div style={{ height:3, background:"linear-gradient(90deg,#f0a500,#ffbe1a,#ff6b35,#ffbe1a,#f0a500)", flexShrink: 0 }}/>

        {/* Close button — absolute top-right */}
        <button onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 14, zIndex: 1,
            background:"rgba(255,255,255,0.05)", border:"none",
            cursor:"pointer", color:V.ink2, padding:8,
            display:"flex", borderRadius:8,
          }}>
          <X size={14}/>
        </button>

        {/* Scrollable body */}
        <div style={{ overflow: "auto", flex: 1 }}>

          {/* Hero */}
          <div style={{ padding:"32px 28px 20px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background:"linear-gradient(135deg,#f0a500 0%,#ffbe1a 50%,#ff6b35 100%)",
              display:"inline-flex", alignItems:"center", justifyContent:"center",
              marginBottom: 14,
              boxShadow: "0 8px 32px rgba(240,165,0,0.45)",
            }}>
              <Crown size={26} color="#0a0800" fill="#0a0800"/>
            </div>
            <h2 style={{
              fontFamily:"'Cabinet Grotesk',system-ui",
              fontSize: 28, fontWeight: 900,
              color: V.ink0,
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}>
              ArbibX Pro
            </h2>
            <p style={{
              fontSize: 14, color: V.ink2, margin: 0, lineHeight: 1.5,
              maxWidth: 380, margin: "0 auto",
            }}>
              {reason || "Unlock the full AI terminal — every pick, unlimited chat, and a personalised daily brief."}
            </p>
          </div>

          {/* Pricing */}
          <div style={{
            margin: "0 28px 20px",
            padding: "18px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(240,165,0,0.10) 0%, rgba(155,114,245,0.06) 100%)",
            border: `1px solid ${V.goldWire}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontFamily:"'Cabinet Grotesk',system-ui", fontSize: 38, fontWeight: 900, color: V.gold, letterSpacing: "-0.04em", lineHeight: 1 }}>$9.99</span>
                <span style={{ ...mono, fontSize: 12, color: V.ink2 }}>/ month</span>
              </div>
              <p style={{ ...mono, fontSize: 9, color: V.ink3, margin: "4px 0 0", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Less than $0.34/day
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
              <span style={{ ...mono, color: V.gain, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} /> Cancel anytime
              </span>
              <span style={{ ...mono, color: V.gain, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} /> Instant activation
              </span>
              <span style={{ ...mono, color: V.gain, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Check size={11} /> Secure via Stripe
              </span>
            </div>
          </div>

          {/* Headline features (bigger cards) */}
          <div style={{ padding: "0 28px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {HEADLINE.map(f => (
              <div key={f.title} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px",
                borderRadius: 11,
                background: "rgba(240,165,0,0.04)",
                border: `1px solid ${V.goldWire}`,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: V.goldDim,
                  border: `1px solid ${V.goldWire}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: V.ink0, margin: 0, fontFamily: "'Cabinet Grotesk',system-ui" }}>
                    {f.title}
                  </p>
                  <p style={{ fontSize: 12, color: V.ink2, margin: "2px 0 0", lineHeight: 1.4 }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Secondary features (compact list) */}
          <div style={{ padding: "8px 28px 16px" }}>
            <p style={{ ...mono, fontSize: 9, color: V.ink4, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 10px", textAlign: "center", fontWeight: 600 }}>
              Plus everything below
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11 }}>
              {SECONDARY.map(f => (
                <div key={f.title} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 0", color: V.ink1, fontWeight: 500 }}>
                  {f.icon}
                  <span style={{ fontSize: 11, color: V.ink1 }}>{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA — fixed at bottom */}
        <div style={{ padding:"16px 28px 24px", borderTop: `1px solid ${V.border}`, background: "rgba(0,0,0,0.30)", flexShrink: 0 }}>
          {error && (
            <p style={{ ...mono, fontSize:11, color:V.loss, textAlign:"center", margin:"0 0 10px" }}>{error}</p>
          )}
          {!userEmail && (
            <p style={{ ...mono, fontSize: 10, color: V.ink3, textAlign:"center", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              Sign in first to checkout
            </p>
          )}
          <button onClick={upgrade} disabled={loading || !userEmail}
            style={{
              width:"100%", padding:"15px",
              borderRadius:13,
              background: (loading || !userEmail) ? "rgba(240,165,0,0.30)" : "linear-gradient(135deg,#f0a500,#ffbe1a)",
              border:"none", color:"#0a0800",
              fontFamily:"'Cabinet Grotesk',system-ui",
              fontSize:15, fontWeight:900,
              cursor: (loading || !userEmail) ? "not-allowed" : "pointer",
              letterSpacing:"0.02em",
              boxShadow: (loading || !userEmail) ? "none" : "0 6px 32px rgba(240,165,0,0.45)",
              transition:"all 0.2s",
              opacity: (loading || !userEmail) ? 0.6 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            <Zap size={16} fill="#0a0800" />
            {loading ? "Redirecting to Stripe..." : "Upgrade to Pro · $9.99/mo"}
          </button>
        </div>
      </div>
    </div>
  );
}
