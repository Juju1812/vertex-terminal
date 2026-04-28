"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, AlertTriangle, CheckCircle, XCircle,
  Info, Mail, LogOut, Eye, EyeOff, X,
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

/* ---- Expanded KNOWN list — covers ALL 57 universe stocks ---- */
const KNOWN: Record<string, { n: string; p: number; d: number }> = {
  // Large Cap Tech
  AAPL:  { n:"Apple Inc.",              p:203,  d:-2.3 },
  MSFT:  { n:"Microsoft Corp.",         p:363,  d:-1.7 },
  NVDA:  { n:"NVIDIA Corp.",            p:177,  d:-1.1 },
  GOOGL: { n:"Alphabet Inc.",           p:155,  d:-2.0 },
  META:  { n:"Meta Platforms",          p:510,  d:-2.8 },
  AMD:   { n:"Advanced Micro Dev.",     p:95,   d:-3.2 },
  AVGO:  { n:"Broadcom Inc.",           p:294,  d:-2.4 },
  ORCL:  { n:"Oracle Corp.",            p:160,  d:-1.3 },
  CRM:   { n:"Salesforce Inc.",         p:255,  d:-1.6 },
  NOW:   { n:"ServiceNow Inc.",         p:750,  d:-1.9 },
  ADBE:  { n:"Adobe Inc.",              p:360,  d:-1.8 },
  INTC:  { n:"Intel Corp.",             p:21,   d:-2.1 },
  QCOM:  { n:"Qualcomm Inc.",           p:145,  d:-2.0 },
  // Financials
  JPM:   { n:"JPMorgan Chase",          p:235,  d:-1.4 },
  V:     { n:"Visa Inc.",               p:335,  d:-0.7 },
  MA:    { n:"Mastercard Inc.",         p:480,  d:-0.9 },
  BAC:   { n:"Bank of America",         p:38,   d:-2.1 },
  GS:    { n:"Goldman Sachs",           p:490,  d:-1.8 },
  COIN:  { n:"Coinbase Global",         p:170,  d:-5.2 },
  GBTC:  { n:"Grayscale Bitcoin Trust", p:62,   d:-3.1 },
  // Consumer / EV
  AMZN:  { n:"Amazon.com",              p:185,  d:-3.4 },
  TSLA:  { n:"Tesla Inc.",              p:252,  d:-4.9 },
  NKE:   { n:"Nike Inc.",               p:72,   d:-1.5 },
  SBUX:  { n:"Starbucks Corp.",         p:85,   d:-1.2 },
  RIVN:  { n:"Rivian Automotive",       p:11,   d:-4.2 },
  LCID:  { n:"Lucid Group",             p:2.5,  d:-3.8 },
  SIRI:  { n:"Sirius XM Holdings",      p:22,   d:-1.0 },
  NKLA:  { n:"Nikola Corp.",            p:0.8,  d:-5.0 },
  BABA:  { n:"Alibaba Group (ADR)",     p:95,   d:-2.5 },
  SONY:  { n:"Sony Group (ADR)",        p:20,   d:-1.3 },
  TM:    { n:"Toyota Motor (ADR)",      p:175,  d:-1.1 },
  // OTC international ADRs — these are the ones that were missing
  NSRGY: { n:"Nestle SA (ADR)",         p:82,   d:-0.8 },
  RHHBY: { n:"Roche Holding (ADR)",     p:33,   d:-1.2 },
  TCEHY: { n:"Tencent Holdings (ADR)",  p:48,   d:-1.5 },
  BIDU:  { n:"Baidu Inc. (ADR)",        p:85,   d:-2.0 },
  TSM:   { n:"Taiwan Semi (ADR)",       p:145,  d:-1.8 },
  ASML:  { n:"ASML Holding (ADR)",      p:620,  d:-2.1 },
  SAP:   { n:"SAP SE (ADR)",            p:220,  d:-0.9 },
  NVO:   { n:"Novo Nordisk (ADR)",      p:68,   d:-1.4 },
  // Healthcare
  UNH:   { n:"UnitedHealth Group",      p:490,  d:-2.5 },
  LLY:   { n:"Eli Lilly & Co.",         p:780,  d:-1.1 },
  PFE:   { n:"Pfizer Inc.",             p:25,   d:-1.3 },
  MRNA:  { n:"Moderna Inc.",            p:35,   d:-3.2 },
  ABBV:  { n:"AbbVie Inc.",             p:170,  d:-1.0 },
  // Cybersecurity / AI
  PLTR:  { n:"Palantir Tech.",          p:149,  d:-2.1 },
  CRWD:  { n:"CrowdStrike",             p:340,  d:-1.8 },
  PANW:  { n:"Palo Alto Networks",      p:165,  d:-1.5 },
  S:     { n:"SentinelOne",             p:18,   d:-2.3 },
  NET:   { n:"Cloudflare Inc.",         p:95,   d:-2.0 },
  SNOW:  { n:"Snowflake Inc.",          p:145,  d:-2.8 },
  // Energy
  XOM:   { n:"ExxonMobil Corp.",        p:105,  d:-1.2 },
  CVX:   { n:"Chevron Corp.",           p:145,  d:-1.0 },
  OXY:   { n:"Occidental Petroleum",    p:42,   d:-1.8 },
  // OTC / Speculative
  MSTR:  { n:"MicroStrategy Inc.",      p:310,  d:-4.5 },
  ACMIF: { n:"Allied Critical Metals",  p:0.12, d:-2.0 },
  BTQQF: { n:"BTQ Technologies",        p:0.45, d:-3.0 },
  CRCUF: { n:"Calibre Mining",          p:1.2,  d:-1.5 },
};

/* ---- API helpers -------------------------------------------- */
async function fetchPrices(tks: string[]): Promise<Record<string, { p: number; d: number; n: string }>> {
  if (!tks.length) return {};

  const res: Record<string, { p: number; d: number; n: string }> = {};

  // First try snapshot (works for listed stocks)
  try {
    const r = await fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tks.join(",")}&apiKey=${KEY}`);
    const data = r.ok ? await r.json() as { tickers?: { ticker: string; day: { c: number }; prevDay: { c: number } }[] } : null;
    if (data?.tickers) {
      for (const s of data.tickers) {
        if (s?.day?.c && s?.prevDay?.c) {
          const p = s.day.c;
          res[s.ticker] = {
            p,
            d: +((p - s.prevDay.c) / s.prevDay.c * 100).toFixed(2),
            n: KNOWN[s.ticker]?.n ?? s.ticker,
          };
        }
      }
    }
  } catch { /**/ }

  // For any tickers the snapshot missed, try bars (works for OTC/ADR)
  const missed = tks.filter(t => !res[t]);
  if (missed.length) {
    const to   = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0];
    await Promise.all(missed.map(async t => {
      try {
        const r = await fetch(`${BASE}/v2/aggs/ticker/${t}/range/1/day/${from}/${to}?adjusted=true&sort=desc&limit=2&apiKey=${KEY}`);
        const d = r.ok ? await r.json() as { results?: { c: number }[] } : null;
        if (d?.results && d.results.length >= 2) {
          const cur  = d.results[0].c;
          const prev = d.results[1].c;
          res[t] = { p: cur, d: +((cur - prev) / prev * 100).toFixed(2), n: KNOWN[t]?.n ?? t };
        }
      } catch { /**/ }
    }));
  }

  // Final fallback: use KNOWN static prices for anything still missing
  for (const t of tks) {
    if (!res[t]) {
      const k = KNOWN[t];
      res[t] = k
        ? { p: k.p, d: k.d, n: k.n }
        : { p: 0, d: 0, n: t };
    }
  }

  return res;
}

/* ---- Grade -------------------------------------------------- */
function grade(h: EH[]): Grade {
  if (!h.length) return {
    letter:"N/A", score:0,
    summary:"Add positions to receive a portfolio analysis.",
    strengths:[], weaknesses:[],
    tips:["Add at least 3 positions to begin."],
    divScore:0, volatility:"--", winRate:0, maxDrawdown:0, concentration:0,
  };

  let s = 50;
  const st: string[] = [], wk: string[] = [], tp: string[] = [];
  const n = h.length;

  if (n >= 8)      { s += 15; st.push(`Strong diversification across ${n} positions.`); }
  else if (n >= 5) { s += 8;  st.push(`Reasonable spread across ${n} positions.`); }
  else             { s -= 10; wk.push(`Only ${n} position${n === 1 ? "" : "s"} — consider diversifying.`); }

  const tv   = h.reduce((a, x) => a + x.val, 0);
  const maxW = tv > 0 ? Math.max(...h.map(x => x.val / tv * 100)) : 0;
  if (maxW > 40)      { s -= 12; wk.push(`Largest position is ${maxW.toFixed(0)}% of portfolio — overweight.`); }
  else if (maxW < 25) { s += 8;  st.push("Well-balanced position sizes."); }

  const winners = h.filter(x => x.pnl > 0).length;
  const wr = winners / n;
  if (wr >= 0.7)      { s += 12; st.push(`${winners}/${n} positions are profitable.`); }
  else if (wr < 0.4)  { s -= 8;  wk.push(`Only ${winners}/${n} positions are in profit.`); }

  if (!tp.length) tp.push("Continue monitoring and rebalance quarterly.");

  s = Math.min(100, Math.max(0, Math.round(s)));
  const L = s >= 95 ? "A+" : s >= 90 ? "A" : s >= 85 ? "A-" : s >= 80 ? "B+" :
            s >= 75 ? "B"  : s >= 70 ? "B-": s >= 65 ? "C+" : s >= 60 ? "C"  :
            s >= 55 ? "C-" : s >= 50 ? "D+": s >= 45 ? "D"  : "F";

  const sum = s >= 85 ? "Outstanding — excellent diversification and strong risk-adjusted returns."
            : s >= 70 ? "Strong portfolio with targeted areas to optimize."
            : s >= 55 ? "Average — notable risk factors need addressing."
            : "Below par — significant restructuring recommended.";

  const divScore = Math.min(100, Math.round(
    (Math.min(n, 10) / 10) * 40 +
    (1 - maxW / 100) * 30 +
    (maxW < 25 ? 30 : maxW < 35 ? 20 : 10)
  ));
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
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",  arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", ame:"#9B72F5", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter:"blur(24px) saturate(1.5)", WebkitBackdropFilter:"blur(24px) saturate(1.5)",
  border:`1px solid ${V.w2}`, borderRadius:16,
  boxShadow:"0 4px 16px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.06)",
  position:"relative" as const, overflow:"hidden", ...ex,
});

/* ============================================================
   EMAIL ALERTS
   ============================================================ */
function EmailAlerts({ userEmail }: { userEmail?: string }) {
  const [email,    setEmail]    = useState(userEmail ?? "");
  const [status,   setStatus]   = useState<"idle"|"loading"|"success"|"error">("idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [subEmail, setSubEmail] = useState<string | null>(null);

  useEffect(() => {
    if (userEmail) setEmail(userEmail);
    try { const s = localStorage.getItem("arbibx-alert-email"); if (s) setSubEmail(s); } catch { /**/ }
  }, [userEmail]);

  const subscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrMsg("Please enter a valid email."); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const r = await fetch("/api/subscribe", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email}) });
      const d = await r.json() as { success?: boolean; error?: string };
      if (d.success) {
        setStatus("success"); setSubEmail(email);
        try { localStorage.setItem("arbibx-alert-email", email); } catch { /**/ }
        setEmail("");
      } else { setStatus("error"); setErrMsg(d.error ?? "Something went wrong."); }
    } catch { setStatus("error"); setErrMsg("Network error — please try again."); }
  };

  return (
    <div style={{ ...glass({ padding:0 }) }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 24px", borderBottom:`1px solid ${V.w1}` }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Mail size={18} color={V.ame} />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:0 }}>AI Trade Alerts</p>
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>Email when signals fire</p>
        </div>
        {subEmail && (
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background:"rgba(0,200,150,0.08)", border:`1px solid ${V.gainWire}` }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:V.gain }} />
            <span style={{ ...mono, fontSize:9, color:V.gain }}>Active</span>
          </div>
        )}
      </div>
      <div style={{ padding:"20px 24px" }}>
        {subEmail ? (
          <div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"12px 14px", borderRadius:10, background:"rgba(0,200,150,0.06)", border:`1px solid rgba(0,200,150,0.18)`, marginBottom:12 }}>
              <CheckCircle size={15} color={V.gain} style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:12, color:V.ink2, margin:0 }}>Alerts active for <strong style={{color:V.ink0}}>{subEmail}</strong></p>
            </div>
            <button onClick={() => { setSubEmail(null); try { localStorage.removeItem("arbibx-alert-email"); } catch { /**/ } }}
              style={{ ...mono, fontSize:10, color:V.ink3, background:"none", border:`1px solid ${V.w1}`, borderRadius:7, padding:"6px 12px", cursor:"pointer" }}>
              Unsubscribe
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize:13, color:V.ink2, lineHeight:1.65, marginBottom:14 }}>
              Get emailed when AI fires a high-confidence signal.
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrMsg(""); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && subscribe()} placeholder="your@email.com"
                style={{ flex:1, minWidth:160, background:"rgba(255,255,255,0.04)", border:`1px solid ${errMsg ? V.lossWire : V.w2}`, borderRadius:9, color:V.ink0, ...mono, fontSize:13, padding:"10px 14px", outline:"none" }} />
              <button onClick={subscribe} disabled={status==="loading"}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(155,114,245,0.20),rgba(155,114,245,0.10))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor:status==="loading"?"not-allowed":"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity:status==="loading"?0.7:1, whiteSpace:"nowrap" }}>
                <Mail size={14} />{status==="loading"?"Sending...":"Subscribe"}
              </button>
            </div>
            {errMsg && <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, marginBottom:8 }}><XCircle size={13} color={V.loss}/><span style={{ fontSize:12, color:V.loss }}>{errMsg}</span></div>}
            {status==="success" && <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.07)", border:`1px solid ${V.gainWire}`, marginBottom:8 }}><CheckCircle size={13} color={V.gain}/><span style={{ fontSize:12, color:V.gain }}>Check your inbox!</span></div>}
            <p style={{ fontSize:11, color:V.ink4, margin:0 }}>No spam. Unsubscribe any time.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function MyStocks({ onSignIn }: { onSignIn?: () => void }) {
  const [user,     setUser]    = useState<AuthUser | null>(null);
  const [holdings, setH]       = useState<H[]>([]);
  const [prices,   setP]       = useState<Record<string, { p: number; d: number; n: string }>>({});
  const [loading,  setL]       = useState(false);
  const [syncing,  setSyncing] = useState(false);
  const [ts,       setTs]      = useState<Date | null>(null);
  const [ticker,   setTicker]  = useState("");
  const [shares,   setShares]  = useState("");
  const [bp,       setBp]      = useState("");
  const [err,      setErr]     = useState("");

  // loadedRef: true once initial load is fully complete
  // isFetchingRef: true while actively reading from Supabase — blocks saves during this window
  const loadedRef     = useRef(false);
  const isFetchingRef = useRef(false);

  /* ---- Load holdings --------------------------------------- */
  const loadFromCloud = useCallback(async (u: AuthUser) => {
    isFetchingRef.current = true;
    try {
      const r = await fetch(`/api/portfolio?email=${encodeURIComponent(u.email)}&token=${u.token}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json() as { holdings?: H[]; error?: string };
      if (Array.isArray(d.holdings)) {
        setH(d.holdings);
        // Mirror to localStorage as offline backup
        try { localStorage.setItem(SK, JSON.stringify(d.holdings)); } catch { /**/ }
      } else {
        // Supabase returned error — fall back to localStorage
        const local = localStorage.getItem(SK);
        if (local) setH(JSON.parse(local));
      }
    } catch {
      // Network/auth error — fall back to localStorage
      try {
        const local = localStorage.getItem(SK);
        if (local) setH(JSON.parse(local));
      } catch { /**/ }
    } finally {
      isFetchingRef.current = false;
      loadedRef.current = true;
    }
  }, []);

  /* ---- Init on mount --------------------------------------- */
  useEffect(() => {
    const init = async () => {
      try {
        const stored = localStorage.getItem(AU);
        if (stored) {
          const u = JSON.parse(stored) as AuthUser;
          setUser(u);
          await loadFromCloud(u);
        } else {
          // Guest — load from localStorage only
          try {
            const local = localStorage.getItem(SK);
            if (local) setH(JSON.parse(local));
          } catch { /**/ }
          loadedRef.current = true;
        }
      } catch {
        loadedRef.current = true;
      }
    };

    init();

    // Re-init when user logs in from global modal
    const onLogin = async () => {
      try {
        const stored = localStorage.getItem(AU);
        if (!stored) return;
        const u = JSON.parse(stored) as AuthUser;
        setUser(u);
        await loadFromCloud(u);
      } catch { /**/ }
    };

    window.addEventListener("arbibx-login", onLogin);

    // Also pick up localStorage changes (e.g. from SimModal Add/Replace)
    const onStorage = (e: StorageEvent) => {
      if (e.key === SK && !isFetchingRef.current) {
        try {
          const local = localStorage.getItem(SK);
          if (local) {
            const parsed = JSON.parse(local) as H[];
            setH(parsed);
          }
        } catch { /**/ }
      }
      if (e.key === AU) onLogin();
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("arbibx-login", onLogin);
      window.removeEventListener("storage", onStorage);
    };
  }, [loadFromCloud]);

  /* ---- Save holdings — guarded ----------------------------- */
  const saveToCloud = useCallback(async (u: AuthUser, h: H[]) => {
    setSyncing(true);
    try {
      const r = await fetch("/api/portfolio", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:u.email, token:u.token, holdings:h }),
      });
      if (!r.ok) console.error("Save failed:", r.status);
      else {
        // Keep localStorage in sync
        try { localStorage.setItem(SK, JSON.stringify(h)); } catch { /**/ }
      }
    } catch (e) { console.error("Save error:", e); }
    setSyncing(false);
  }, []);

  useEffect(() => {
    // GUARD: never save before initial load finishes, or while actively fetching
    if (!loadedRef.current || isFetchingRef.current) return;

    if (user) {
      saveToCloud(user, holdings);
    } else {
      try { localStorage.setItem(SK, JSON.stringify(holdings)); } catch { /**/ }
    }
  }, [holdings, user, saveToCloud]);

  const logout = () => {
    setUser(null);
    setH([]);
    loadedRef.current = true;
    try { localStorage.removeItem(AU); localStorage.removeItem(SK); } catch { /**/ }
  };

  /* ---- Fetch prices ---------------------------------------- */
  const fetchAll = useCallback(async () => {
    if (!holdings.length) return;
    setL(true);
    setP(await fetchPrices([...new Set(holdings.map(h => h.ticker))]));
    setTs(new Date()); setL(false);
  }, [holdings]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ---- Add position ---------------------------------------- */
  const add = () => {
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const b = parseFloat(bp);
    if (!t)          return setErr("Enter a ticker symbol.");
    if (!s || s <= 0) return setErr("Enter a valid share count.");
    if (!b || b <= 0) return setErr("Enter a valid buy price.");
    setH(prev => [...prev, { id:`${Date.now()}-${Math.random()}`, ticker:t, shares:s, buyPrice:b }]);
    setTicker(""); setShares(""); setBp(""); setErr("");
  };

  /* ---- Enrich holdings ------------------------------------- */
  const enriched: EH[] = holdings.map(h => {
    const p = prices[h.ticker];
    const k = KNOWN[h.ticker];
    // Use live price if available, then KNOWN fallback, then buy price
    const cur  = p?.p || k?.p || h.buyPrice;
    const cost = h.shares * h.buyPrice;
    const val  = h.shares * cur;
    return {
      ...h,
      name: p?.n || k?.n || h.ticker,
      cur, cost, val,
      pnl: val - cost,
      pct: ((cur - h.buyPrice) / h.buyPrice) * 100,
      day: p?.d || k?.d || 0,
    };
  });

  const tv  = enriched.reduce((s, h) => s + h.val, 0);
  const tc  = enriched.reduce((s, h) => s + h.cost, 0);
  const tp  = tc > 0 ? (tv - tc) / tc * 100 : 0;
  const g   = grade(enriched);
  const gc_ = gc(g.letter);

  return (
    <div style={{ padding:"24px 16px", maxWidth:1280, margin:"0 auto", animation:"vx-rise 0.35s cubic-bezier(0.16,1,0.3,1) both" }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:13 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BookOpen size={21} color={V.ame} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>My Portfolio</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {user ? `Signed in as ${user.email}` : "Holdings · P&L · AI Grade"}
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
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading || !holdings.length ? "not-allowed" : "pointer", fontSize:12, opacity:holdings.length ? 1 : 0.4, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Auth prompt ────────────────────────────────────── */}
      {!user && (
        <div style={{ ...glass({ padding:"20px 24px", marginBottom:24 }) }}>
          <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
            <div style={{ width:44, height:44, borderRadius:12, background:"rgba(79,142,247,0.10)", border:"1px solid rgba(79,142,247,0.20)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <BookOpen size={20} color="#7EB6FF" />
            </div>
            <div style={{ flex:1, minWidth:200 }}>
              <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:"0 0 3px" }}>Save your portfolio across devices</p>
              <p style={{ fontSize:12, color:V.ink3, margin:0, lineHeight:1.5 }}>Sign in or create a free account to sync your holdings anywhere.</p>
            </div>
            <button onClick={() => onSignIn?.()}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:10, background:"linear-gradient(135deg,#4F8EF7,#2D6FDB)", border:"none", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", flexShrink:0 }}>
              Sign In / Sign Up
            </button>
          </div>
          <p style={{ ...mono, fontSize:10, color:V.ink4, margin:"12px 0 0", lineHeight:1.6 }}>
            Portfolio saves locally until you sign in. Your data won't be lost.
          </p>
        </div>
      )}

      {/* ── Add position ───────────────────────────────────── */}
      <div style={{ ...glass({ padding:20, marginBottom:20 }) }}>
        <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:14 }}>Add Position</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:10 }} className="add-grid">
          {[
            { val:ticker, set:setTicker, ph:"AAPL",  label:"Ticker",       type:"text"   },
            { val:shares, set:setShares, ph:"10",     label:"Shares",       type:"number" },
            { val:bp,     set:setBp,     ph:"180.00", label:"Buy Price ($)", type:"number" },
          ].map(f => (
            <div key={f.label}>
              <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:5 }}>{f.label}</p>
              <input
                value={f.val}
                onChange={e => { f.set(e.target.value); setErr(""); }}
                placeholder={f.ph}
                type={f.type}
                onKeyDown={e => e.key === "Enter" && add()}
                style={{ width:"100%", background:"rgba(255,255,255,0.035)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, ...mono, fontSize:13, padding:"10px 12px", outline:"none", boxSizing:"border-box", textTransform: f.label === "Ticker" ? "uppercase" : "none" }} />
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

      {/* ── Holdings ───────────────────────────────────────── */}
      {enriched.length > 0 && (
        <>
          {/* Summary stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[
              { l:"Portfolio Value", v:f$(tv),                               c:V.ink0 },
              { l:"Total Cost",      v:f$(tc),                               c:V.ink2 },
              { l:"Total P&L",       v:`${tv >= tc ? "+" : ""}${f$(tv-tc)}`, c:tv >= tc ? V.gain : V.loss },
              { l:"Return",          v:fp(tp),                               c:tp >= 0 ? V.gain : V.loss },
            ].map(s => (
              <div key={s.l} style={{ ...glass({ padding:"14px 16px" }) }}>
                <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", margin:"0 0 5px" }}>{s.l}</p>
                <p style={{ ...mono, fontSize:15, fontWeight:600, color:s.c, margin:0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Positions table */}
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
                  { l:"Win Rate",     v:`${g.winRate}%`,             c: g.winRate >= 60 ? V.gain : V.loss },
                  { l:"Volatility",   v:g.volatility,                c: g.volatility === "Low" ? V.gain : g.volatility === "Very High" ? V.loss : V.gold },
                  { l:"Diversif.",    v:`${g.divScore}/100`,         c:"#7EB6FF" },
                  { l:"Max Position", v:`${g.concentration.toFixed(0)}%`, c: g.concentration < 30 ? V.gain : V.loss },
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
                { t:"Strengths",   c:V.gain,    icon:<TrendingUp    size={11} color={V.gain}  />, items:g.strengths,  sym:"+",  empty:"Keep building."   },
                { t:"Weaknesses",  c:V.loss,    icon:<AlertTriangle size={11} color={V.loss}  />, items:g.weaknesses, sym:"!",  empty:"Looking good."    },
                { t:"Suggestions", c:"#7EB6FF", icon:<Info          size={11} color="#7EB6FF" />, items:g.tips,       sym:"->", empty:"Keep monitoring." },
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

      {/* ── Email alerts ───────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <EmailAlerts userEmail={user?.email} />
      </div>

      {/* ── Empty state ────────────────────────────────────── */}
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
