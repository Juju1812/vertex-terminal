"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, AlertTriangle, CheckCircle, XCircle,
  Info, Mail, LogOut, LogIn, UserPlus, Eye, EyeOff, User,
} from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface H  { id: string; ticker: string; shares: number; buyPrice: number; }
interface EH extends H { name: string; cur: number; cost: number; val: number; pnl: number; pct: number; day: number; }
interface AuthUser { email: string; token: string; }
interface Grade {
  letter: string; score: number; summary: string;
  strengths: string[]; weaknesses: string[]; tips: string[];
  divScore: number; volatility: string; winRate: number;
  maxDrawdown: number; concentration: number;
}

/* ---- Constants ---------------------------------------------- */
const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";
const SK   = "arbibx-holdings-local";
const AU   = "arbibx-auth-user";

const KNOWN: Record<string, { n: string; p: number; d: number }> = {
  AAPL: { n:"Apple Inc.",          p:203, d:-2.3 }, MSFT: { n:"Microsoft Corp.",     p:363, d:-1.7 },
  NVDA: { n:"NVIDIA Corp.",        p:177, d:-1.1 }, GOOGL:{ n:"Alphabet Inc.",        p:155, d:-2.0 },
  META: { n:"Meta Platforms",      p:510, d:-2.8 }, TSLA: { n:"Tesla Inc.",           p:252, d:-4.9 },
  AMZN: { n:"Amazon.com Inc.",     p:185, d:-3.4 }, AMD:  { n:"Advanced Micro Dev.",  p:95,  d:-3.2 },
  PLTR: { n:"Palantir Tech.",      p:149, d:-2.1 }, JPM:  { n:"JPMorgan Chase",       p:235, d:-1.4 },
  V:    { n:"Visa Inc.",           p:335, d:-0.7 }, UNH:  { n:"UnitedHealth Group",   p:490, d:-2.5 },
  LLY:  { n:"Eli Lilly & Co.",     p:780, d:-1.1 }, AVGO: { n:"Broadcom Inc.",        p:294, d:-2.4 },
  CRM:  { n:"Salesforce Inc.",     p:255, d:-1.6 }, ORCL: { n:"Oracle Corp.",         p:160, d:-1.3 },
  COIN: { n:"Coinbase Global",     p:170, d:-5.2 }, CRWD: { n:"CrowdStrike",          p:340, d:-1.8 },
  PANW: { n:"Palo Alto Networks",  p:165, d:-1.5 }, NOW:  { n:"ServiceNow Inc.",      p:750, d:-1.9 },
};

/* ---- API helpers -------------------------------------------- */
async function fetchPrices(tks: string[]): Promise<Record<string, { p: number; d: number; n: string }>> {
  if (!tks.length) return {};
  try {
    const r = await fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tks.join(",")}&apiKey=${KEY}`);
    const data = r.ok ? await r.json() as { tickers?: { ticker: string; day: { c: number }; prevDay: { c: number } }[] } : null;
    const res: Record<string, { p: number; d: number; n: string }> = {};
    tks.forEach(t => {
      const s = data?.tickers?.find(x => x.ticker === t);
      const k = KNOWN[t];
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
  } catch { return {}; }
}

/* ---- Grade -------------------------------------------------- */
function grade(h: EH[]): Grade {
  if (!h.length) return { letter:"N/A", score:0, summary:"Add positions to receive a portfolio analysis.", strengths:[], weaknesses:[], tips:["Add at least 3 positions to begin."], divScore:0, volatility:"--", winRate:0, maxDrawdown:0, concentration:0 };
  let s = 50;
  const st: string[] = [], wk: string[] = [], tp: string[] = [];
  const n = h.length;

  if (n >= 8) { s += 15; st.push(`Strong diversification across ${n} positions.`); }
  else if (n >= 5) { s += 8; st.push(`Reasonable spread across ${n} positions.`); }
  else { s -= 10; wk.push(`Only ${n} position${n === 1 ? "" : "s"} -- consider diversifying.`); }

  const tv = h.reduce((a, x) => a + x.val, 0);
  const maxW = tv > 0 ? Math.max(...h.map(x => x.val / tv * 100)) : 0;
  if (maxW > 40) { s -= 12; wk.push(`Largest position is ${maxW.toFixed(0)}% of portfolio -- overweight.`); }
  else if (maxW < 25) { s += 8; st.push("Well-balanced position sizes."); }

  const winners = h.filter(x => x.pnl > 0).length;
  const wr = winners / n;
  if (wr >= 0.7) { s += 12; st.push(`${winners}/${n} positions are profitable.`); }
  else if (wr < 0.4) { s -= 8; wk.push(`Only ${winners}/${n} positions are in profit.`); }

  if (!tp.length) tp.push("Continue monitoring and rebalance quarterly.");

  s = Math.min(100, Math.max(0, Math.round(s)));
  const L = s >= 95 ? "A+" : s >= 90 ? "A" : s >= 85 ? "A-" : s >= 80 ? "B+" : s >= 75 ? "B" : s >= 70 ? "B-" : s >= 65 ? "C+" : s >= 60 ? "C" : s >= 55 ? "C-" : s >= 50 ? "D+" : s >= 45 ? "D" : "F";
  const sum = s >= 85 ? "Outstanding -- excellent diversification and strong risk-adjusted returns." : s >= 70 ? "Strong portfolio with targeted areas to optimize." : s >= 55 ? "Average -- notable risk factors need addressing." : "Below par -- significant restructuring recommended.";
  const divScore = Math.min(100, Math.round((Math.min(n, 10) / 10) * 40 + (1 - maxW / 100) * 30 + (maxW < 25 ? 30 : maxW < 35 ? 20 : 10)));
  const avgDayChg = h.reduce((a, x) => a + Math.abs(x.day), 0) / (h.length || 1);
  const volatility = avgDayChg > 3 ? "Very High" : avgDayChg > 1.8 ? "High" : avgDayChg > 0.9 ? "Medium" : "Low";
  const maxDrawdown = Math.min(0, Math.min(...h.map(x => x.pct)));

  return { letter:L, score:s, summary:sum, strengths:st, weaknesses:wk, tips:tp, divScore, volatility, winRate:Math.round(wr * 100), maxDrawdown, concentration:maxW };
}

/* ---- Format & design ---------------------------------------- */
const f$ = (n: number, d = 2) => new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const gc = (l: string) => l.startsWith("A") ? "#00C896" : l.startsWith("B") ? "#4F8EF7" : l.startsWith("C") ? "#E8A030" : l.startsWith("D") ? "#F97316" : "#E8445A";

const V = {
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)", w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",  arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", ame:"#9B72F5", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  border: `1px solid ${V.w2}`, borderRadius: 16,
  boxShadow: "0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  position: "relative" as const, overflow: "hidden", ...ex,
});

/* ============================================================
   AUTH MODAL
   ============================================================ */
function AuthModal({ onAuth }: { onAuth: (user: AuthUser, holdings: H[]) => void }) {
  const [mode,     setMode]     = useState<"login" | "signup">("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const submit = async () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email, password }),
      });
      const d = await r.json() as { success?: boolean; error?: string; user?: AuthUser; holdings?: H[] };
      if (d.success && d.user) {
        onAuth(d.user, d.holdings ?? []);
      } else {
        setError(d.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error -- please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ ...glass({ padding:0 }), maxWidth:440, margin:"0 auto" }}>
      <div style={{ padding:"28px 28px 0" }}>
        <div style={{ width:46, height:46, borderRadius:12, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
          {mode === "login" ? <LogIn size={21} color={V.ame} /> : <UserPlus size={21} color={V.ame} />}
        </div>
        <h2 style={{ fontSize:20, fontWeight:700, color:V.ink0, margin:"0 0 6px" }}>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p style={{ color:V.ink3, fontSize:13, margin:"0 0 22px", lineHeight:1.6 }}>
          {mode === "login"
            ? "Sign in to access your saved portfolio from any device."
            : "Sign up free to save your portfolio and get AI alerts."}
        </p>
      </div>

      <div style={{ padding:"0 28px 28px", display:"flex", flexDirection:"column", gap:12 }}>
        <div>
          <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:6 }}>Email</label>
          <input type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="your@email.com"
            style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:14, padding:"11px 14px", outline:"none", boxSizing:"border-box" }}
          />
        </div>

        <div>
          <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em", display:"block", marginBottom:6 }}>Password</label>
          <div style={{ position:"relative" }}>
            <input type={showPw ? "text" : "password"} value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && submit()}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:14, padding:"11px 40px 11px 14px", outline:"none", boxSizing:"border-box" }}
            />
            <button onClick={() => setShowPw(s => !s)}
              style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:V.ink3, display:"flex", alignItems:"center" }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}` }}>
            <XCircle size={14} color={V.loss} style={{ flexShrink:0 }} />
            <span style={{ fontSize:12, color:V.loss }}>{error}</span>
          </div>
        )}

        <button onClick={submit} disabled={loading}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 20px", borderRadius:10, background:"linear-gradient(135deg,rgba(155,114,245,0.25),rgba(155,114,245,0.12))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor: loading ? "not-allowed" : "pointer", fontSize:14, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: loading ? 0.7 : 1, transition:"all 0.2s", marginTop:4 }}>
          {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <p style={{ textAlign:"center", fontSize:13, color:V.ink3, margin:0 }}>
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => { setMode(m => m === "login" ? "signup" : "login"); setError(""); }}
            style={{ background:"none", border:"none", color:"#7EB6FF", cursor:"pointer", fontSize:13, fontWeight:500, padding:0 }}>
            {mode === "login" ? "Sign up free" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   EMAIL ALERTS
   ============================================================ */
function EmailAlerts({ userEmail }: { userEmail?: string }) {
  const [email,    setEmail]    = useState(userEmail ?? "");
  const [status,   setStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [subEmail, setSubEmail] = useState<string | null>(null);

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
    try { const s = localStorage.getItem("arbibx-alert-email"); if (s) setSubEmail(s); } catch { /**/ }
  }, [userEmail]);

  const subscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrMsg("Please enter a valid email address."); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const r = await fetch("/api/subscribe", { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email }) });
      const d = await r.json() as { success?: boolean; error?: string };
      if (d.success) {
        setStatus("success"); setSubEmail(email);
        try { localStorage.setItem("arbibx-alert-email", email); } catch { /**/ }
        setEmail("");
      } else { setStatus("error"); setErrMsg(d.error ?? "Something went wrong."); }
    } catch { setStatus("error"); setErrMsg("Network error -- please try again."); }
  };

  return (
    <div style={{ ...glass({ padding:0 }) }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 24px", borderBottom:`1px solid ${V.w1}` }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Mail size={18} color={V.ame} />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:0 }}>AI Trade Alerts</p>
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Email notifications when signals fire</p>
        </div>
        {subEmail && (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:"rgba(0,200,150,0.08)", border:`1px solid ${V.gainWire}` }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:V.gain, animation:"live-pulse 2s ease-in-out infinite" }} />
            <span style={{ ...mono, fontSize:9, color:V.gain }}>Active</span>
          </div>
        )}
      </div>
      <div style={{ padding:"20px 24px" }}>
        {subEmail ? (
          <div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", borderRadius:10, background:"rgba(0,200,150,0.06)", border:`1px solid rgba(0,200,150,0.18)`, marginBottom:16 }}>
              <CheckCircle size={16} color={V.gain} style={{ flexShrink:0, marginTop:1 }} />
              <div>
                <p style={{ fontSize:13, color:V.ink0, fontWeight:500, margin:"0 0 2px" }}>Alerts active for {subEmail}</p>
                <p style={{ fontSize:12, color:V.ink3, margin:0 }}>You'll get emailed when AI fires a high-confidence signal.</p>
              </div>
            </div>
            <button onClick={() => { setSubEmail(null); try { localStorage.removeItem("arbibx-alert-email"); } catch { /**/ } }}
              style={{ ...mono, fontSize:10, color:V.ink3, background:"none", border:`1px solid ${V.w1}`, borderRadius:7, padding:"6px 12px", cursor:"pointer" }}>
              Unsubscribe
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:13, color:V.ink2, lineHeight:1.65, marginBottom:16 }}>
              Get emailed when our AI fires a high-confidence buy, add, or sell signal.
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              <input type="email" value={email}
                onChange={e => { setEmail(e.target.value); setErrMsg(""); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && subscribe()}
                placeholder="your@email.com"
                style={{ flex:1, minWidth:160, background:"rgba(255,255,255,0.04)", border:`1px solid ${errMsg ? V.lossWire : V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none" }}
              />
              <button onClick={subscribe} disabled={status === "loading"}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(155,114,245,0.20),rgba(155,114,245,0.10))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor: status === "loading" ? "not-allowed" : "pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: status === "loading" ? 0.7 : 1, whiteSpace:"nowrap" }}>
                <Mail size={14} />{status === "loading" ? "Sending..." : "Subscribe"}
              </button>
            </div>
            {errMsg && <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, marginBottom:10 }}><XCircle size={13} color={V.loss} /><span style={{ fontSize:12, color:V.loss }}>{errMsg}</span></div>}
            {status === "success" && <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.07)", border:`1px solid ${V.gainWire}`, marginBottom:10 }}><CheckCircle size={13} color={V.gain} /><span style={{ fontSize:12, color:V.gain }}>Check your inbox for a confirmation email!</span></div>}
            <p style={{ fontSize:11, color:V.ink4, margin:0 }}>No spam. Unsubscribe any time. Not investment advice.</p>
          </div>
        )}
      </div>
      <style>{`@keyframes live-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function MyStocks() {
  const [user,    setUser]   = useState<AuthUser | null>(null);
  const [holdings, setH]     = useState<H[]>([]);
  const [prices,  setP]      = useState<Record<string, { p: number; d: number; n: string }>>({});
  const [loading, setL]      = useState(false);
  const [syncing, setSyncing]= useState(false);
  const [ts,      setTs]     = useState<Date | null>(null);
  const [ticker,  setTicker] = useState("");
  const [shares,  setShares] = useState("");
  const [bp,      setBp]     = useState("");
  const [err,     setErr]    = useState("");

  /* Load auth on mount */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(AU);
      if (stored) {
        const u = JSON.parse(stored) as AuthUser;
        setUser(u);
        fetch(`/api/portfolio?email=${encodeURIComponent(u.email)}&token=${u.token}`)
          .then(r => r.json())
          .then((d: { holdings?: H[] }) => { if (d.holdings) setH(d.holdings); })
          .catch(() => { /**/ });
      } else {
        const s = localStorage.getItem(SK);
        if (s) setH(JSON.parse(s));
      }
    } catch { /**/ }
  }, []);

  /* Save holdings */
  const saveCloudHoldings = useCallback(async (u: AuthUser, h: H[]) => {
    setSyncing(true);
    try {
      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: u.email, token: u.token, holdings: h }),
      });
    } catch { /**/ }
    setSyncing(false);
  }, []);

  useEffect(() => {
    if (user) {
      saveCloudHoldings(user, holdings);
    } else {
      try { localStorage.setItem(SK, JSON.stringify(holdings)); } catch { /**/ }
    }
  }, [holdings, user, saveCloudHoldings]);

  const handleAuth = (u: AuthUser, h: H[]) => {
    setUser(u); setH(h);
    try { localStorage.setItem(AU, JSON.stringify(u)); } catch { /**/ }
  };

  const logout = () => {
    setUser(null); setH([]);
    try { localStorage.removeItem(AU); localStorage.removeItem(SK); } catch { /**/ }
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
    const p = prices[h.ticker], k = KNOWN[h.ticker];
    const cur = p?.p || k?.p || h.buyPrice;
    const cost = h.shares * h.buyPrice, val = h.shares * cur;
    return { ...h, name: p?.n || k?.n || h.ticker, cur, cost, val, pnl: val - cost, pct: ((cur - h.buyPrice) / h.buyPrice) * 100, day: p?.d || k?.d || 0 };
  });

  const tv = enriched.reduce((s, h) => s + h.val, 0);
  const tc = enriched.reduce((s, h) => s + h.cost, 0);
  const tp = tc > 0 ? (tv - tc) / tc * 100 : 0;
  const g = grade(enriched);
  const gc_ = gc(g.letter);

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
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {user ? `Signed in as ${user.email}` : "Holdings -- P&L -- AI Grade"}
            </p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {syncing && <span style={{ ...mono, fontSize:9, color:V.ink4 }}>Saving...</span>}
          {ts && !syncing && <span style={{ ...mono, color:V.ink4, fontSize:9 }}>{ts.toLocaleTimeString()}</span>}
          {user && (
            <button onClick={logout}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
              <LogOut size={12} /> Sign out
            </button>
          )}
          <button onClick={fetchAll} disabled={loading || !holdings.length}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading || !holdings.length ? "not-allowed" : "pointer", fontSize:12, opacity: holdings.length ? 1 : 0.4, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* Auth section */}
      {!user && (
        <div style={{ marginBottom:24 }}>
          <div style={{ ...glass({ padding:"14px 20px", marginBottom:16 }) }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:V.gold, flexShrink:0 }} />
              <span style={{ fontSize:13, color:V.gold, fontWeight:500 }}>Sign in to save your portfolio across devices</span>
            </div>
          </div>
          <AuthModal onAuth={handleAuth} />
        </div>
      )}

      {/* Add position */}
      <div style={{ ...glass({ padding:20, marginBottom:20 }) }}>
        <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Add Position</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10 }} className="add-grid">
          {[
            { val:ticker, set:setTicker, ph:"AAPL",   label:"Ticker" },
            { val:shares, set:setShares, ph:"10",      label:"Shares" },
            { val:bp,     set:setBp,     ph:"180.00",  label:"Buy Price ($)" },
          ].map(f => (
            <div key={f.label}>
              <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:5 }}>{f.label}</p>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                onKeyDown={e => e.key === "Enter" && add()}
                style={{ width:"100%", background:"rgba(255,255,255,0.035)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none", boxSizing:"border-box" }} />
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"flex-end" }}>
            <button onClick={add}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(79,142,247,0.18),rgba(79,142,247,0.08))", border:`1px solid ${V.arcWire}`, color:"#7EB6FF", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", whiteSpace:"nowrap" }}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
        {err && <p style={{ color:V.loss, fontSize:12, marginTop:10 }}>{err}</p>}
      </div>

      {/* Holdings */}
      {enriched.length > 0 && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[
              { l:"Portfolio Value", v:f$(tv),                              c:V.ink0                      },
              { l:"Total Cost",      v:f$(tc),                              c:V.ink2                      },
              { l:"Total P&L",       v:`${tv >= tc ? "+" : ""}${f$(tv-tc)}`,c:tv >= tc ? V.gain : V.loss },
              { l:"Return",          v:fp(tp),                              c:tp >= 0  ? V.gain : V.loss  },
            ].map(s => (
              <div key={s.l} style={{ ...glass({ padding:"14px 16px" }) }}>
                <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 5px" }}>{s.l}</p>
                <p style={{ ...mono, fontSize:15, fontWeight:600, color:s.c, margin:0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          <div style={{ ...glass({ overflow:"hidden", marginBottom:20 }) }}>
            {enriched.map((h, i) => {
              const up = h.pnl >= 0, dayUp = h.day >= 0;
              return (
                <div key={h.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto auto", gap:12, alignItems:"center", padding:"14px 18px", borderBottom: i < enriched.length - 1 ? `1px solid ${V.w1}` : "none" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ ...mono, fontSize:14, fontWeight:600, color:"#7EB6FF" }}>{h.ticker}</span>
                      <span style={{ fontSize:11, color:V.ink3 }}>{h.name}</span>
                    </div>
                    <div style={{ ...mono, fontSize:10, color:V.ink4, marginTop:2 }}>{h.shares} sh @ {f$(h.buyPrice)}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0, margin:0 }}>{f$(h.cur)}</p>
                    <p style={{ ...mono, fontSize:10, color: dayUp ? V.gain : V.loss, margin:0 }}>{fp(h.day)} today</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0, margin:0 }}>{f$(h.val)}</p>
                    <p style={{ ...mono, fontSize:10, color:V.ink3, margin:0 }}>{f$(h.cost)} cost</p>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ ...mono, fontSize:13, fontWeight:600, color: up ? V.gain : V.loss, margin:0 }}>{up ? "+" : ""}{f$(h.pnl)}</p>
                    <p style={{ ...mono, fontSize:10, color: up ? V.gain : V.loss, margin:0 }}>{fp(h.pct)}</p>
                  </div>
                  <button onClick={() => setH(prev => prev.filter(x => x.id !== h.id))}
                    style={{ background:"none", border:"none", cursor:"pointer", color:V.ink4, padding:6, borderRadius:7, display:"flex", alignItems:"center", transition:"color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = V.loss}
                    onMouseLeave={e => e.currentTarget.style.color = V.ink4}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* AI Grade */}
          <div style={{ ...glass({ overflow:"hidden", marginBottom:20 }) }}>
            <div style={{ padding:"20px 24px", borderBottom:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:52, height:52, borderRadius:13, background:`${gc_}15`, border:`1px solid ${gc_}30`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ ...mono, fontSize:22, fontWeight:700, color:gc_ }}>{g.letter}</span>
                </div>
                <div>
                  <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:0 }}>AI Portfolio Grade</p>
                  <p style={{ fontSize:12, color:V.ink3, margin:"2px 0 0", maxWidth:400 }}>{g.summary}</p>
                </div>
              </div>
              <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                {[
                  { l:"Win Rate",      v:`${g.winRate}%`,             c: g.winRate >= 60 ? V.gain : V.loss },
                  { l:"Volatility",    v:g.volatility,                c: g.volatility === "Low" ? V.gain : g.volatility === "Very High" ? V.loss : V.gold },
                  { l:"Diversif.",     v:`${g.divScore}/100`,         c:"#7EB6FF" },
                  { l:"Max Position",  v:`${g.concentration.toFixed(0)}%`, c: g.concentration < 30 ? V.gain : V.loss },
                ].map(s => (
                  <div key={s.l} style={{ textAlign:"center" }}>
                    <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 3px" }}>{s.l}</p>
                    <p style={{ ...mono, fontSize:14, fontWeight:600, color:s.c, margin:0 }}>{s.v}</p>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
              {[
                { t:"Strengths",   c:V.gain,    icon:<TrendingUp   size={11} color={V.gain}  />, items:g.strengths,  sym:"+",  empty:"Keep building."    },
                { t:"Weaknesses",  c:V.loss,    icon:<AlertTriangle size={11} color={V.loss}  />, items:g.weaknesses, sym:"!",  empty:"Looking good."     },
                { t:"Suggestions", c:"#7EB6FF", icon:<Info         size={11} color="#7EB6FF" />, items:g.tips,       sym:"->", empty:"Keep monitoring."  },
              ].map((col, ci) => (
                <div key={col.t} style={{ padding:"18px 20px", borderRight: ci < 2 ? `1px solid ${V.w1}` : "none", borderTop:`1px solid ${V.w1}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                    {col.icon}
                    <span style={{ ...mono, fontSize:9, fontWeight:500, color:col.c, textTransform:"uppercase", letterSpacing:"0.1em" }}>{col.t}</span>
                  </div>
                  {col.items.length ? col.items.map((s, i) => (
                    <div key={i} style={{ display:"flex", gap:9, marginBottom:9 }}>
                      <span style={{ color:col.c, fontSize:12, marginTop:1, flexShrink:0 }}>{col.sym}</span>
                      <span style={{ fontSize:12, color:V.ink2, lineHeight:1.6 }}>{s}</span>
                    </div>
                  )) : <p style={{ fontSize:12, color:V.ink4 }}>{col.empty}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Email alerts */}
      <div style={{ marginBottom:20 }}>
        <EmailAlerts userEmail={user?.email} />
      </div>

      {/* Empty state */}
      {!enriched.length && (
        <div style={{ ...glass({ padding:60, textAlign:"center" }) }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"rgba(155,114,245,0.08)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <BookOpen size={26} color={V.ame} />
          </div>
          <p style={{ fontSize:16, fontWeight:600, color:V.ink0, marginBottom:6 }}>No positions yet</p>
          <p style={{ color:V.ink3, fontSize:13 }}>Add your first position above to start tracking your portfolio.</p>
        </div>
      )}

      <style>{`
        @keyframes vx-rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @media(max-width:640px) { .add-grid { grid-template-columns:1fr 1fr !important; } }
      `}</style>
    </div>
  );
}
