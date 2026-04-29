"use client";

import { useState } from "react";
import { X, Zap, Check, Star, Bell, RefreshCw, Shield } from "lucide-react";

interface Props {
  onClose: () => void;
  userEmail?: string;
  reason?: string;
}

const V = {
  void:"#050407", surface:"#0d0b16", raised:"#1a1628",
  border:"rgba(60,48,100,0.5)", borderHi:"rgba(90,72,150,0.6)",
  ink0:"#f4f0ff", ink1:"#cdc7e0", ink2:"#8a82a8", ink3:"#4a4468", ink4:"#2d2848",
  gold:"#f0a500", goldDim:"rgba(240,165,0,0.10)", goldWire:"rgba(240,165,0,0.28)",
  gain:"#00e5a0", gainDim:"rgba(0,229,160,0.08)", gainWire:"rgba(0,229,160,0.22)",
  loss:"#ff4560",
};
const mono: React.CSSProperties = { fontFamily:"'DM Mono','Courier New',monospace" };

const FEATURES = [
  { icon:<Shield  size={14} color={V.gold}/>,  label:"No ads",                     free:"Ads shown",       pro:"100% ad-free" },
  { icon:<Bell    size={14} color={V.gold}/>,  label:"Price alerts",               free:"Max 3 alerts",    pro:"Unlimited alerts" },
  { icon:<RefreshCw size={14} color={V.gold}/>,label:"AI analysis refresh",        free:"Every 60 min",    pro:"Every 30 min" },
  { icon:<Star    size={14} color={V.gold}/>,  label:"Watchlist",                  free:"Max 10 stocks",   pro:"Unlimited stocks" },
  { icon:<Zap     size={14} color={V.gold}/>,  label:"Pro badge",                  free:"—",               pro:"✓ Included" },
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
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:V.surface, border:`1px solid ${V.borderHi}`, borderRadius:22, width:"100%", maxWidth:480, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>

        {/* Gold top bar */}
        <div style={{ height:3, background:"linear-gradient(90deg,#f0a500,#ffbe1a,#ff6b35)" }}/>

        {/* Header */}
        <div style={{ padding:"24px 24px 0", display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#f0a500,#ff6b35)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Zap size={18} color="#0a0800" fill="#0a0800"/>
              </div>
              <span style={{ fontFamily:"'Cabinet Grotesk',system-ui", fontSize:20, fontWeight:900, color:V.ink0, letterSpacing:"-0.02em" }}>ArbibX Pro</span>
            </div>
            {reason && (
              <p style={{ ...mono, fontSize:10, color:V.gold, margin:0, letterSpacing:"0.08em" }}>{reason}</p>
            )}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:6, display:"flex", borderRadius:8 }}>
            <X size={16}/>
          </button>
        </div>

        {/* Price */}
        <div style={{ padding:"20px 24px", display:"flex", alignItems:"baseline", gap:6 }}>
          <span style={{ fontFamily:"'Cabinet Grotesk',system-ui", fontSize:48, fontWeight:900, color:V.gold, letterSpacing:"-0.04em", lineHeight:1 }}>$9.99</span>
          <span style={{ ...mono, fontSize:12, color:V.ink3 }}>/month</span>
          <span style={{ ...mono, fontSize:10, color:V.gain, marginLeft:8, padding:"2px 8px", borderRadius:99, background:V.gainDim, border:`1px solid ${V.gainWire}` }}>Cancel anytime</span>
        </div>

        {/* Feature comparison */}
        <div style={{ margin:"0 24px 20px", border:`1px solid ${V.border}`, borderRadius:14, overflow:"hidden" }}>
          {/* Header row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px", background:V.raised, padding:"8px 14px", borderBottom:`1px solid ${V.border}` }}>
            <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em" }}>Feature</span>
            <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", textAlign:"center" }}>Free</span>
            <span style={{ ...mono, fontSize:9, color:V.gold, textTransform:"uppercase", letterSpacing:"0.1em", textAlign:"center" }}>Pro</span>
          </div>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 80px", padding:"10px 14px", borderBottom: i < FEATURES.length-1 ? `1px solid ${V.border}` : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                {f.icon}
                <span style={{ fontSize:12, color:V.ink1 }}>{f.label}</span>
              </div>
              <span style={{ ...mono, fontSize:10, color:V.ink3, textAlign:"center", alignSelf:"center" }}>{f.free}</span>
              <span style={{ ...mono, fontSize:10, color:V.gain, textAlign:"center", alignSelf:"center", fontWeight:600 }}>{f.pro}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding:"0 24px 24px", display:"flex", flexDirection:"column", gap:10 }}>
          {error && (
            <p style={{ ...mono, fontSize:11, color:V.loss, textAlign:"center", margin:0 }}>{error}</p>
          )}
          <button onClick={upgrade} disabled={loading}
            style={{ width:"100%", padding:"15px", borderRadius:13, background: loading ? "rgba(240,165,0,0.4)" : "linear-gradient(135deg,#f0a500,#ffbe1a)", border:"none", color:"#0a0800", fontFamily:"'Cabinet Grotesk',system-ui", fontSize:15, fontWeight:900, cursor: loading ? "not-allowed" : "pointer", letterSpacing:"0.02em", boxShadow: loading ? "none" : "0 4px 32px rgba(240,165,0,0.4)", transition:"all 0.2s", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Redirecting to Stripe..." : "Upgrade to Pro →"}
          </button>
          <p style={{ ...mono, fontSize:9, color:V.ink4, textAlign:"center", margin:0 }}>
            Secure payment via Stripe · Cancel anytime · Instant activation
          </p>
        </div>
      </div>
    </div>
  );
}
