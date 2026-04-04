"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, AlertTriangle, CheckCircle, XCircle, Info,
  Mail, LogIn, LogOut, UserPlus, Eye, EyeOff, User,
} from "lucide-react";

/* -- Types ---------------------------------------------------- */
interface H  { id: string; ticker: string; shares: number; buyPrice: number; }
interface EH extends H { name: string; cur: number; cost: number; val: number; pnl: number; pct: number; day: number; }
interface AuthUser { userId: string; email: string; }

const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";
const SK   = "arbibx-session";

const KNOWN: Record<string, { n: string; p: number; d: number }> = {
  AAPL:{ n:"Apple Inc.",           p:203,  d:-2.3 }, MSFT:{ n:"Microsoft Corp.",     p:363,  d:-1.7 },
  NVDA:{ n:"NVIDIA Corp.",         p:177,  d:-1.1 }, GOOGL:{ n:"Alphabet Inc.",      p:155,  d:-2.0 },
  META:{ n:"Meta Platforms",       p:510,  d:-2.8 }, TSLA:{ n:"Tesla Inc.",          p:252,  d:-4.9 },
  AMZN:{ n:"Amazon.com Inc.",      p:185,  d:-3.4 }, AMD:{ n:"Advanced Micro Dev.",  p:95,   d:-3.2 },
  PLTR:{ n:"Palantir Technologies",p:149,  d:-2.1 }, JPM:{ n:"JPMorgan Chase",       p:235,  d:-1.4 },
  V:   { n:"Visa Inc.",            p:335,  d:-0.7 }, UNH:{ n:"UnitedHealth Group",   p:490,  d:-2.5 },
  LLY: { n:"Eli Lilly & Co.",      p:780,  d:-1.1 }, AVGO:{ n:"Broadcom Inc.",       p:294,  d:-2.4 },
  CRM: { n:"Salesforce Inc.",      p:255,  d:-1.6 }, ORCL:{ n:"Oracle Corp.",        p:160,  d:-1.3 },
  COIN:{ n:"Coinbase Global",      p:170,  d:-5.2 }, CRWD:{ n:"CrowdStrike",         p:340,  d:-1.8 },
};

async function pg<T>(p: string): Promise<T | null> {
  try {
    const r = await fetch(`${BASE}${p}${p.includes("?") ? "&" : "?"}apiKey=${KEY}`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function fetchPrices(tks: string[]): Promise<Record<string, { p: number; d: number; n: string }>> {
  if (!tks.length) return {};
  const data = await pg<{ tickers?: { ticker: string; day: { c: number }; prevDay: { c: number } }[] }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tks.join(",")}`
  );
  const res: Record<string, { p: number; d: number; n: string }> = {};
  tks.forEach(t => {
    const s = data?.tickers?.find(x => x.ticker === t), k = KNOWN[t];
    if (s?.day?.c && s?.prevDay?.c) {
      const p = s.day.c;
      res[t] = { p, d: +((p - s.prevDay.c) / s.prevDay.c * 100).toFixed(2), n: k?.n ?? t };
    } else if (k) {
      res[t] = { p: k.p, d: k.d, n: k.n };
    } else {
      res[t] = { p: 0, d: 0, n: t };
    }
  });
  return res;
}

/* -- Grade ---------------------------------------------------- */
interface Grade {
  letter: string; score: number; summary: string;
  strengths: string[]; weaknesses: string[]; tips: string[];
  divScore: number; volatility: string; winRate: number;
  maxDrawdown: number; concentration: number;
}

function grade(h: EH[]): Grade {
  if (!h.length) return { letter:"N/A", score:0, summary:"Add positions to receive a portfolio analysis.", strengths:[], weaknesses:[], tips:["Add at least 3 positions to begin."], divScore:0, volatility:"--", winRate:0, maxDrawdown:0, concentration:0 };
  let s = 50;
  const st: string[] = [], wk: string[] = [], tp: string[] = [];
  const n = h.length;
  if (n >= 8) { s += 15; st.push(`Strong diversification across ${n} positions.`); }
  else if (n >= 5) { s += 8; st.push(`Reasonable spread across ${n} positions.`); }
  else { s -= 8; wk.push(`Only ${n} position${n > 1 ? "s" : ""} -- consider diversifying.`); tp.push("Add 3+ more positions across different sectors."); }
  const tv = h.reduce((a, x) => a + x.val, 0);
  const maxW = Math.max(...h.map(x => tv > 0 ? (x.val / tv) * 100 : 0));
  if (maxW > 40) { s -= 12; wk.push(`${h.find(x => tv > 0 && (x.val / tv) * 100 === maxW)?.ticker} is ${maxW.toFixed(0)}% of portfolio -- too concentrated.`); tp.push("Reduce largest position to under 25%."); }
  else if (maxW < 25) { s += 8; st.push("Well-balanced position sizing."); }
  const wins = h.filter(x => x.pct > 0).length;
  const wr = wins / n;
  if (wr >= 0.7) { s += 12; st.push(`${wins}/${n} positions profitable.`); }
  else if (wr >= 0.5) { s += 5; }
  else { s -= 8; wk.push(`Only ${wins}/${n} positions are profitable.`); tp.push("Review underperforming positions for exit opportunities."); }
  const tp2 = maxW / 100;
  const divScore = Math.min(100, Math.round((Math.min(n, 10) / 10) * 40 + (1 - tp2) * 30 + (maxW < 25 ? 30 : maxW < 35 ? 20 : 10)));
  const dayChanges = h.map(x => Math.abs(x.day));
  const avgDayChg = dayChanges.reduce((a, b) => a + b, 0) / (dayChanges.length || 1);
  const volatility = avgDayChg > 3 ? "Very High" : avgDayChg > 1.8 ? "High" : avgDayChg > 0.9 ? "Medium" : "Low";
  const maxDrawdown = Math.min(0, Math.min(...h.map(x => x.pct)));
  s = Math.min(100, Math.max(0, Math.round(s)));
  const L = s >= 95 ? "A+" : s >= 90 ? "A" : s >= 85 ? "A-" : s >= 80 ? "B+" : s >= 75 ? "B" : s >= 70 ? "B-" : s >= 65 ? "C+" : s >= 60 ? "C" : s >= 55 ? "C-" : s >= 50 ? "D+" : s >= 45 ? "D" : "F";
  const sum = s >= 85 ? "Outstanding -- excellent diversification and strong risk-adjusted returns." : s >= 70 ? "Strong portfolio with targeted areas to optimize." : s >= 55 ? "Average -- notable risk factors need addressing." : "Below par -- significant restructuring recommended.";
  if (!tp.length) tp.push("Continue monitoring and rebalance quarterly.");
  return { letter:L, score:s, summary:sum, strengths:st, weaknesses:wk, tips:tp, divScore, volatility, winRate:Math.round(wr * 100), maxDrawdown, concentration:maxW };
}

const f$ = (n: number, d = 2) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const gc = (l: string) => l.startsWith("A") ? "#00C896" : l.startsWith("B") ? "#4F8EF7" : l.startsWith("C") ? "#E8A030" : l.startsWith("D") ? "#F97316" : "#E8445A";

/* -- Design tokens -------------------------------------------- */
const V = {
  d0:"#050810", d1:"#080D18", d2:"#0C1220", d3:"#101828", d4:"#151F30", dh:"#1E2D40",
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)", w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",  arcDim:"rgba(79,142,247,0.10)",  arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", ame:"#9B72F5", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter:"blur(24px) saturate(1.5)", WebkitBackdropFilter:"blur(24px) saturate(1.5)",
  border:`1px solid ${V.w2}`, borderRadius:16,
  boxShadow:"0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  position:"relative" as const, overflow:"hidden", ...ex,
});

/* -- Auth Panel ----------------------------------------------- */
function AuthPanel({ onAuth }: { onAuth: (user: AuthUser, holdings: H[]) => void }) {
  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const submit = async () => {
    setError(""); setSuccess(""); setLoading(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email: email.trim(), password }),
      });
      const d = await r.json() as { success?: boolean; error?: string; user?: { email: string; token: string }; holdings?: H[] };
      if (d.success && d.user) {
        if (mode === "signup") setSuccess("Account created! You're now logged in.");
        try { localStorage.setItem(SK, JSON.stringify(d.user)); } catch { /**/ }
        onAuth({ userId: d.user.token, email: d.user.email }, d.holdings ?? []);
      } else {
        setError(d.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error -- please try again");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:440, margin:"40px auto", padding:"0 16px" }}>
      <div style={{ ...glass({ padding:32 }) }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:52, height:52, borderRadius:14, background:`rgba(155,114,245,0.12)`, border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            <User size={24} color={V.ame} />
          </div>
          <h2 style={{ fontSize:20, fontWeight:700, color:V.ink0, margin:"0 0 6px" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p style={{ color:V.ink3, fontSize:13, margin:0 }}>
            {mode === "login" ? "Log in to access your saved portfolio" : "Sign up to save your portfolio across devices"}
          </p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div>
            <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="your@email.com"
              style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:14, padding:"11px 14px", outline:"none", boxSizing:"border-box" }}
            />
          </div>

          <div>
            <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submit()}
                placeholder={mode === "signup" ? "Min. 6 characters" : "Your password"}
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:14, padding:"11px 40px 11px 14px", outline:"none", boxSizing:"border-box" }}
              />
              <button onClick={() => setShowPw(s => !s)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:2, display:"flex" }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}` }}>
              <XCircle size={13} color={V.loss} />
              <span style={{ fontSize:12, color:V.loss }}>{error}</span>
            </div>
          )}
          {success && (
            <div style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", borderRadius:8, background:"rgba(0,200,150,0.07)", border:`1px solid ${V.gainWire}` }}>
              <CheckCircle size={13} color={V.gain} />
              <span style={{ fontSize:12, color:V.gain }}>{success}</span>
            </div>
          )}

          <button onClick={submit} disabled={loading}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px", borderRadius:10, background:"linear-gradient(135deg,rgba(155,114,245,0.25),rgba(155,114,245,0.12))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor: loading ? "not-allowed" : "pointer", fontSize:14, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: loading ? 0.7 : 1, transition:"all 0.2s", marginTop:4 }}>
            {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>

          <p style={{ textAlign:"center", fontSize:13, color:V.ink3, margin:"4px 0 0" }}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); setSuccess(""); }}
              style={{ background:"none", border:"none", color:"#7EB6FF", cursor:"pointer", fontSize:13, fontWeight:600, padding:0 }}>
              {mode === "login" ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

/* -- Email Alerts --------------------------------------------- */
function EmailAlerts() {
  const [email,    setEmail]    = useState("");
  const [status,   setStatus]   = useState<"idle"|"loading"|"success"|"error">("idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [subEmail, setSubEmail] = useState<string|null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem("arbibx-alert-email"); if (s) setSubEmail(s); } catch { /**/ }
  }, []);

  const subscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrMsg("Please enter a valid email address."); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const r = await fetch("/api/subscribe", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email }) });
      const d = await r.json() as { success?: boolean; error?: string };
      if (d.success) {
        setStatus("success"); setSubEmail(email);
        try { localStorage.setItem("arbibx-alert-email", email); } catch { /**/ }
        setEmail("");
      } else { setStatus("error"); setErrMsg(d.error ?? "Something went wrong."); }
    } catch { setStatus("error"); setErrMsg("Network error -- please try again."); }
  };

  const unsubscribe = () => {
    setSubEmail(null); setStatus("idle");
    try { localStorage.removeItem("arbibx-alert-email"); } catch { /**/ }
  };

  return (
    <div style={{ ...glass({ padding:0 }) }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 22px", borderBottom:`1px solid ${V.w1}` }}>
        <div style={{ width:36, height:36, borderRadius:9, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Mail size={16} color={V.ame} />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:0 }}>AI Trade Alerts</p>
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Email notifications when signals fire</p>
        </div>
        {subEmail && (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, background:"rgba(0,200,150,0.08)", border:`1px solid ${V.gainWire}` }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:V.gain }} />
            <span style={{ ...mono, fontSize:9, color:V.gain }}>Active</span>
          </div>
        )}
      </div>
      <div style={{ padding:"18px 22px" }}>
        {subEmail ? (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderRadius:9, background:"rgba(0,200,150,0.06)", border:`1px solid rgba(0,200,150,0.18)`, marginBottom:14 }}>
              <CheckCircle size={14} color={V.gain} />
              <div>
                <p style={{ fontSize:12, color:V.ink0, fontWeight:500, margin:0 }}>Alerts active for <span style={{ color:V.gain }}>{subEmail}</span></p>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7, marginBottom:14 }}>
              {[
                { label:"Buy Signal",      color:V.gain,    bg:"rgba(0,200,150,0.07)",  border:"rgba(0,200,150,0.18)"  },
                { label:"Add to Position", color:"#7EB6FF", bg:"rgba(79,142,247,0.07)", border:"rgba(79,142,247,0.18)" },
                { label:"Sell Signal",     color:V.loss,    bg:"rgba(232,68,90,0.07)",  border:"rgba(232,68,90,0.18)"  },
                { label:"Risk Alert",      color:V.gold,    bg:"rgba(232,160,48,0.07)", border:"rgba(232,160,48,0.18)" },
              ].map(a => (
                <div key={a.label} style={{ padding:"10px 12px", borderRadius:8, background:a.bg, border:`1px solid ${a.border}` }}>
                  <p style={{ ...mono, fontSize:9, color:a.color, textTransform:"uppercase", letterSpacing:"0.08em", margin:0, fontWeight:600 }}>{a.label}</p>
                </div>
              ))}
            </div>
            <button onClick={unsubscribe}
              style={{ ...mono, fontSize:10, color:V.ink3, background:"none", border:`1px solid ${V.w1}`, borderRadius:7, padding:"5px 12px", cursor:"pointer" }}>
              Unsubscribe
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:13, color:V.ink2, lineHeight:1.65, marginBottom:14 }}>
              Get emailed the moment our AI fires a high-confidence trade signal -- buy, add, or sell.
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrMsg(""); }}
                onKeyDown={e => e.key === "Enter" && subscribe()}
                placeholder="your@email.com"
                style={{ flex:1, minWidth:160, background:"rgba(255,255,255,0.04)", border:`1px solid ${errMsg ? V.lossWire : V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none" }}
              />
              <button onClick={subscribe} disabled={status === "loading"}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(155,114,245,0.20),rgba(155,114,245,0.10))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", whiteSpace:"nowrap" }}>
                <Mail size={13} />{status === "loading" ? "Sending..." : "Subscribe"}
              </button>
            </div>
            {errMsg && <p style={{ fontSize:12, color:V.loss, margin:"0 0 8px" }}>{errMsg}</p>}
            {status === "success" && <p style={{ fontSize:12, color:V.gain, margin:"0 0 8px" }}>Check your inbox for a confirmation email!</p>}
            <p style={{ fontSize:11, color:V.ink4, margin:0 }}>No spam. Unsubscribe any time. Not investment advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* == Main Component =========================================== */
export default function MyStocks() {
  const [user,     setUser]     = useState<AuthUser | null>(null);
  const [holdings, setH]        = useState<H[]>([]);
  const [prices,   setP]        = useState<Record<string, { p: number; d: number; n: string }>>({});
  const [loading,  setL]        = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [ts,       setTs]       = useState<Date | null>(null);
  const [ticker,   setTicker]   = useState("");
  const [shares,   setShares]   = useState("");
  const [bp,       setBp]       = useState("");
  const [err,      setErr]      = useState("");

  /* Restore session from localStorage */
  useEffect(() => {
    try {
      const s = localStorage.getItem(SK);
      if (s) {
        const { user: u, holdings: h } = JSON.parse(s) as { user: AuthUser; holdings: H[] };
        if (u?.userId) { setUser(u); setH(h ?? []); }
      }
    } catch { /**/ }
  }, []);

  /* Save session to localStorage whenever it changes */
  useEffect(() => {
    if (user) {
      try { localStorage.setItem(SK, JSON.stringify({ user, holdings })); } catch { /**/ }
    }
  }, [user, holdings]);

  /* Auto-save to Supabase when holdings change (debounced) */
  useEffect(() => {
    if (!user) return;
    const id = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, token: user.userId, holdings }),
        });
      } catch { /**/ }
      setSaving(false);
    }, 1500);
    return () => clearTimeout(id);
  }, [holdings, user]);

  const handleAuth = (u: AuthUser, h: H[]) => {
    setUser(u);
    setH(h);
  };

  const logout = () => {
    setUser(null); setH([]); setP({});
    try { localStorage.removeItem(SK); } catch { /**/ }
  };

  const fetchAll = useCallback(async () => {
    if (!holdings.length) return;
    setL(true);
    setP(await fetchPrices([...new Set(holdings.map(h => h.ticker))]));
    setTs(new Date()); setL(false);
  }, [holdings]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const add = () => {
    const t = ticker.trim().toUpperCase(), s = parseFloat(shares), b = parseFloat(bp);
    if (!t) return setErr("Enter a ticker symbol.");
    if (!s || s <= 0) return setErr("Enter a valid share count.");
    if (!b || b <= 0) return setErr("Enter a valid buy price.");
    setH(prev => [...prev, { id:`${Date.now()}-${Math.random()}`, ticker:t, shares:s, buyPrice:b }]);
    setTicker(""); setShares(""); setBp(""); setErr("");
  };

  const enriched: EH[] = holdings.map(h => {
    const p = prices[h.ticker];
    const cur = p?.p || h.buyPrice, cost = h.shares * h.buyPrice, val = h.shares * cur;
    return { ...h, name:p?.n || KNOWN[h.ticker]?.n || h.ticker, cur, cost, val, pnl:val - cost, pct:((cur - h.buyPrice) / h.buyPrice) * 100, day:p?.d || 0 };
  });

  const tv = enriched.reduce((s, h) => s + h.val, 0);
  const tc = enriched.reduce((s, h) => s + h.cost, 0);
  const tp = tc > 0 ? (tv - tc) / tc * 100 : 0;
  const g = grade(enriched);
  const gc_ = gc(g.letter);

  /* Show auth screen if not logged in */
  if (!user) {
    return (
      <div style={{ padding:"0 0 40px" }}>
        <div style={{ padding:"24px 16px 0", maxWidth:1280, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:8 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <BookOpen size={21} color={V.ame} />
            </div>
            <div>
              <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>My Portfolio</h2>
              <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Sign in to save your portfolio across devices
              </p>
            </div>
          </div>
        </div>
        <AuthPanel onAuth={handleAuth} />
        <style>{`@keyframes vx-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ padding:"24px 16px", maxWidth:1280, margin:"0 auto", animation:"vx-rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:13 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BookOpen size={21} color={V.ame} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>My Portfolio</h2>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:3 }}>
              <User size={11} color={V.ink4} />
              <span style={{ ...mono, color:V.ink4, fontSize:10 }}>{user.email}</span>
              {saving && <span style={{ ...mono, fontSize:9, color:V.arc }}>saving...</span>}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {ts && <span style={{ ...mono, color:V.ink4, fontSize:9 }}>{ts.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading || !holdings.length}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, color:V.ink2, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <button onClick={logout}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <LogOut size={12} />
            Log out
          </button>
        </div>
      </div>

      {/* Add position */}
      <div style={{ ...glass({ padding:"18px 20px", marginBottom:20 }) }}>
        <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>Add Position</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10, alignItems:"end", flexWrap:"wrap" }}>
          {[
            { label:"Ticker",        val:ticker, set:setTicker, ph:"AAPL",   type:"text"   },
            { label:"Shares",        val:shares, set:setShares, ph:"10",     type:"number" },
            { label:"Buy Price ($)", val:bp,     set:setBp,     ph:"180.00", type:"number" },
          ].map(f => (
            <div key={f.label}>
              <label style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:5 }}>{f.label}</label>
              <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                onKeyDown={e => e.key === "Enter" && add()} placeholder={f.ph}
                style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none", boxSizing:"border-box" }} />
            </div>
          ))}
          <button onClick={add}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(155,114,245,0.22),rgba(155,114,245,0.10))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", whiteSpace:"nowrap", height:42 }}>
            <Plus size={15} /> Add
          </button>
        </div>
        {err && <p style={{ fontSize:12, color:V.loss, marginTop:8, margin:"8px 0 0" }}>{err}</p>}
      </div>

      {holdings.length > 0 && (
        <>
          {/* Summary stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:10, marginBottom:20 }}>
            {[
              { l:"Portfolio Value",  v:f$(tv),              c:V.ink0  },
              { l:"Total Cost",       v:f$(tc),              c:V.ink2  },
              { l:"Total P&L",        v:`${tp>=0?"+":""}${f$(tv-tc)}`, c:tp>=0?V.gain:V.loss },
              { l:"Return",           v:fp(tp),              c:tp>=0?V.gain:V.loss },
              { l:"Positions",        v:String(holdings.length), c:V.ink0 },
              { l:"Win Rate",         v:`${g.winRate}%`,     c:g.winRate>=60?V.gain:V.loss },
            ].map(s => (
              <div key={s.l} style={{ ...glass({ padding:"14px 16px" }) }}>
                <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{s.l}</p>
                <p style={{ ...mono, fontSize:15, fontWeight:500, color:s.c, letterSpacing:"-0.01em" }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div style={{ ...glass({ overflow:"hidden", marginBottom:20 }) }}>
            <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                    {["Ticker","Shares","Buy Price","Current","P&L","Day",""].map(h => (
                      <th key={h} style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 14px", textAlign:"left", fontWeight:400, background:"rgba(5,8,16,0.6)", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(h => {
                    const pos = h.pct >= 0, dayPos = h.day >= 0;
                    return (
                      <tr key={h.id} style={{ borderBottom:`1px solid rgba(130,180,255,0.04)` }}>
                        <td style={{ padding:"12px 14px" }}>
                          <p style={{ ...mono, fontSize:13, fontWeight:500, color:"#7EB6FF" }}>{h.ticker}</p>
                          <p style={{ fontSize:11, color:V.ink3, marginTop:1 }}>{h.name}</p>
                        </td>
                        <td style={{ ...mono, padding:"12px 14px", fontSize:12, color:V.ink1 }}>{h.shares}</td>
                        <td style={{ ...mono, padding:"12px 14px", fontSize:12, color:V.ink2 }}>{f$(h.buyPrice)}</td>
                        <td style={{ ...mono, padding:"12px 14px", fontSize:13, fontWeight:500, color:V.ink0 }}>{f$(h.cur)}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <p style={{ ...mono, fontSize:12, color:pos?V.gain:V.loss }}>{pos?"+":""}{f$(h.pnl)}</p>
                          <p style={{ ...mono, fontSize:10, color:pos?V.gain:V.loss }}>{fp(h.pct)}</p>
                        </td>
                        <td style={{ ...mono, padding:"12px 14px", fontSize:11, color:dayPos?V.gain:V.loss }}>{fp(h.day)}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <button onClick={() => setH(prev => prev.filter(x => x.id !== h.id))}
                            style={{ background:"none", border:"none", cursor:"pointer", color:V.ink4, padding:4, borderRadius:6, display:"flex", transition:"color 0.2s" }}
                            onMouseEnter={e => e.currentTarget.style.color = V.loss}
                            onMouseLeave={e => e.currentTarget.style.color = V.ink4}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Grade */}
          <div style={{ ...glass({ marginBottom:20, overflow:"visible" }) }}>
            <div style={{ padding:"18px 22px 14px", borderBottom:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ width:56, height:56, borderRadius:14, background:`${gc_}15`, border:`1px solid ${gc_}33`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ ...mono, fontSize:24, fontWeight:700, color:gc_ }}>{g.letter}</span>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:15, fontWeight:600, color:V.ink0, margin:"0 0 3px" }}>AI Portfolio Grade</p>
                <p style={{ fontSize:13, color:V.ink2, margin:0 }}>{g.summary}</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, minWidth:200 }}>
                {[
                  { l:"Diversification", v:`${g.divScore}/100` },
                  { l:"Volatility",      v:g.volatility },
                  { l:"Win Rate",        v:`${g.winRate}%` },
                  { l:"Max Drawdown",    v:`${g.maxDrawdown.toFixed(1)}%` },
                ].map(s => (
                  <div key={s.l} style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"8px 10px" }}>
                    <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>{s.l}</p>
                    <p style={{ ...mono, fontSize:12, color:V.ink0 }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
              {[
                { t:"Strengths",   c:V.gain,    icon:<TrendingUp  size={11} color={V.gain} />,    items:g.strengths, sym:"+" },
                { t:"Weaknesses",  c:V.loss,    icon:<AlertTriangle size={11} color={V.loss} />,  items:g.weaknesses,sym:"!" },
                { t:"Suggestions", c:"#7EB6FF", icon:<Info         size={11} color="#7EB6FF" />,  items:g.tips,      sym:"->" },
              ].map((col, ci) => (
                <div key={col.t} style={{ padding:"16px 18px", borderRight:ci < 2 ? `1px solid ${V.w1}` : "none", borderTop:`1px solid ${V.w1}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                    {col.icon}
                    <span style={{ ...mono, fontSize:9, fontWeight:500, color:col.c, textTransform:"uppercase", letterSpacing:"0.1em" }}>{col.t}</span>
                  </div>
                  {col.items.length ? col.items.map((s, i) => (
                    <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                      <span style={{ color:col.c, fontSize:11, marginTop:1, flexShrink:0 }}>{col.sym}</span>
                      <span style={{ fontSize:12, color:V.ink2, lineHeight:1.6 }}>{s}</span>
                    </div>
                  )) : <p style={{ fontSize:12, color:V.ink4 }}>None identified.</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Email Alerts */}
      <div style={{ marginBottom:20 }}>
        <EmailAlerts />
      </div>

      {!holdings.length && (
        <div style={{ ...glass({ padding:60, textAlign:"center" }) }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"rgba(155,114,245,0.08)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <BookOpen size={26} color={V.ame} />
          </div>
          <p style={{ fontSize:16, fontWeight:600, color:V.ink0, marginBottom:6 }}>No positions yet</p>
          <p style={{ color:V.ink3, fontSize:13 }}>Add your first position above to start tracking.</p>
        </div>
      )}

      <style>{`
        @keyframes vx-rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
