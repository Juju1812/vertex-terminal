"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, AlertTriangle, CheckCircle, XCircle,
  Info, Mail, LogOut, Eye, EyeOff, X, Download, Share2, Copy, ChevronRight, DollarSign,
  Sparkles, Calendar, Wallet, Activity, Minus,
} from "lucide-react";
import { useCurrency } from "./useCurrency";
import PortfolioSwitcher from "./PortfolioSwitcher";

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

/* ---- Multi-portfolio types --------------------------------- */
interface Portfolio {
  id:           string;
  name:         string;
  holdings:     H[];
  startingCash: number | null;
  startedAt:    string | null;
}
interface PortfoliosV2 { list: Portfolio[]; activeId: string }

/* ---- Constants ---------------------------------------------- */
const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";
const SK   = "arbibx-holdings-local";        // legacy single-portfolio holdings (kept for SimModal compat)
const SK_V2 = "arbibx-portfolios-v2-local";  // new multi-portfolio store for guests + offline backup
const AU   = "arbibx-auth-user";

const newPortfolioId = (prefix = "p") =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const makeMainPortfolio = (holdings: H[] = [], startingCash: number | null = null, startedAt: string | null = null): Portfolio => ({
  id: newPortfolioId(),
  name: "Main",
  holdings,
  startingCash,
  startedAt,
});

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
  // Detect "fresh" portfolio: positions haven't moved meaningfully
  // from cost basis yet (avg absolute % change < 1.5%). Penalizing
  // win rate on day 1 is unfair - prices haven't had time to move.
  // The previous behavior gave every fresh 8-position portfolio a
  // C- automatically because winners=0 → -8 from the base score.
  const avgAbsMove = h.reduce((a, x) => a + Math.abs(x.pct), 0) / n;
  const isFresh = avgAbsMove < 1.5;
  if (isFresh) {
    tp.push("Portfolio is too fresh to grade win rate — check back after a few trading days for an accurate score.");
  } else if (wr >= 0.7) {
    s += 12; st.push(`${winners}/${n} positions are profitable.`);
  } else if (wr < 0.4) {
    s -= 8;  wk.push(`Only ${winners}/${n} positions are in profit.`);
  }

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
// Currency-aware money formatter is defined inside MyStocks (closes
// over the user's selected currency). Anything outside the component
// that needs USD-only formatting can use Intl.NumberFormat directly.
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const gc = (l: string) => l.startsWith("A") ? "#00C896" : l.startsWith("B") ? "#4F8EF7" : l.startsWith("C") ? "#E8A030" : l.startsWith("D") ? "#F97316" : "#E8445A";

const V = {
  w1:"var(--border,rgba(130,180,255,0.055))", w2:"var(--border-hi,rgba(130,180,255,0.10))",
  ink0:"var(--ink0,#F2F6FF)", ink1:"var(--ink1,#C8D5E8)", ink2:"var(--ink2,#7A9CBF)", ink3:"var(--ink3,#3D5A7A)", ink4:"var(--ink4,#1F3550)",
  gain:"var(--gain,#00C896)", gainDim:"var(--gain-dim,rgba(0,200,150,0.08))", gainWire:"var(--gain-wire,rgba(0,200,150,0.20))",
  loss:"var(--loss,#E8445A)", lossDim:"var(--loss-dim,rgba(232,68,90,0.08))",  lossWire:"var(--loss-wire,rgba(232,68,90,0.20))",
  arc:"#4F8EF7",  arcWire:"rgba(79,142,247,0.22)",
  gold:"var(--gold,#E8A030)", ame:"#9B72F5", ameWire:"rgba(155,114,245,0.22)",
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
export default function MyStocks({
  onSignIn,
  isPro = true,
  onUpgrade,
}: {
  onSignIn?: () => void;
  /** When false, the AI portfolio grade is locked behind an
      upgrade overlay. */
  isPro?:    boolean;
  onUpgrade?: () => void;
}) {
  const [user,     setUser]    = useState<AuthUser | null>(null);
  // Multi-portfolio state — `holdings` / `startingCash` / `startedAt`
  // below are derived from the active portfolio so existing call sites
  // (which read those locals) keep working unchanged.
  const [portfolios, setPortfolios] = useState<Portfolio[]>(() => [makeMainPortfolio()]);
  const [activeId,   setActiveId]   = useState<string>("");
  const [prices,   setP]       = useState<Record<string, { p: number; d: number; n: string }>>({});
  const [loading,  setL]       = useState(false);
  const [syncing,  setSyncing] = useState(false);
  const [ts,       setTs]      = useState<Date | null>(null);
  const [ticker,   setTicker]  = useState("");
  const [shares,   setShares]  = useState("");
  const [bp,       setBp]      = useState("");
  const [err,      setErr]     = useState("");

  // Portfolio baseline: optional starting cash + start date so the
  // user can answer "how is my portfolio doing since I started" rather
  // than just per-position P&L vs. each buyPrice. Lives on each
  // portfolio, so the values below come from the active portfolio.
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [startInput,   setStartInput]   = useState("");
  const [startDate,    setStartDate]    = useState<string>("");
  const [startBusy,    setStartBusy]    = useState(false);
  const [startError,   setStartError]   = useState<string | null>(null);

  /* ---- Derived from active portfolio ----------------------- */
  const activePortfolio = portfolios.find(p => p.id === activeId) ?? portfolios[0];
  const holdings        = activePortfolio?.holdings ?? [];
  const startingCash    = activePortfolio?.startingCash ?? null;
  const startedAt       = activePortfolio?.startedAt    ?? null;

  // Mutate the active portfolio's holdings. Mirrors React's
  // setState(updater | value) ergonomics so the existing setH(...)
  // call sites stay valid.
  const setH = useCallback((updater: H[] | ((prev: H[]) => H[])) => {
    setPortfolios(prev => prev.map(p =>
      p.id === activeId
        ? { ...p, holdings: typeof updater === "function" ? (updater as (prev: H[]) => H[])(p.holdings) : updater }
        : p
    ));
  }, [activeId]);
  // Setters for the two derived baseline fields. Used by load + start
  // modal so the existing call sites keep their old shape.
  const setStartingCash = useCallback((next: number | null) => {
    setPortfolios(prev => prev.map(p => p.id === activeId ? { ...p, startingCash: next } : p));
  }, [activeId]);
  const setStartedAt = useCallback((next: string | null) => {
    setPortfolios(prev => prev.map(p => p.id === activeId ? { ...p, startedAt: next } : p));
  }, [activeId]);

  // Currency comes from the global useCurrency hook — single
  // source of truth shared with the header selector and every
  // other price-displaying component. Source data stays USD;
  // f$() handles the FX multiply + Intl formatting.
  const { currency, fxReady, f$ } = useCurrency();

  // loadedRef: true once initial load is fully complete
  // isFetchingRef: true while actively reading from Supabase — blocks saves during this window
  const loadedRef     = useRef(false);
  const isFetchingRef = useRef(false);

  /* ---- Load portfolios ------------------------------------- */
  const loadFromLocal = useCallback(() => {
    // Prefer the v2 multi-portfolio store; fall back to the legacy
    // single-portfolio holdings array if v2 hasn't been written yet.
    try {
      const v2raw = localStorage.getItem(SK_V2);
      if (v2raw) {
        const v2 = JSON.parse(v2raw) as PortfoliosV2;
        if (Array.isArray(v2.list) && v2.list.length > 0) {
          setPortfolios(v2.list);
          const active = (v2.activeId && v2.list.some(p => p.id === v2.activeId)) ? v2.activeId : v2.list[0].id;
          setActiveId(active);
          return;
        }
      }
    } catch { /**/ }
    try {
      const legacy = localStorage.getItem(SK);
      const legacyHoldings = legacy ? JSON.parse(legacy) as H[] : [];
      const main = makeMainPortfolio(legacyHoldings);
      setPortfolios([main]);
      setActiveId(main.id);
    } catch {
      const main = makeMainPortfolio();
      setPortfolios([main]);
      setActiveId(main.id);
    }
  }, []);

  const loadFromCloud = useCallback(async (u: AuthUser) => {
    isFetchingRef.current = true;
    try {
      const r = await fetch(`/api/portfolio?email=${encodeURIComponent(u.email)}&token=${u.token}`);
      if (!r.ok) throw new Error(`${r.status}`);
      const d = await r.json() as {
        portfolios?: Portfolio[];
        activeId?: string;
        // legacy
        holdings?: H[]; startingCash?: number | null; startedAt?: string | null;
        error?: string;
      };
      if (Array.isArray(d.portfolios) && d.portfolios.length > 0) {
        setPortfolios(d.portfolios);
        const active = (d.activeId && d.portfolios.some(p => p.id === d.activeId))
          ? d.activeId
          : d.portfolios[0].id;
        setActiveId(active);
        // Mirror to localStorage as offline + multi-portfolio backup
        try {
          localStorage.setItem(SK_V2, JSON.stringify({ list: d.portfolios, activeId: active }));
          const activeHoldings = d.portfolios.find(p => p.id === active)?.holdings ?? [];
          localStorage.setItem(SK, JSON.stringify(activeHoldings));
        } catch { /**/ }
      } else if (Array.isArray(d.holdings)) {
        // Pure legacy response — wrap as single-portfolio v2
        const main = makeMainPortfolio(d.holdings, d.startingCash ?? null, d.startedAt ?? null);
        setPortfolios([main]);
        setActiveId(main.id);
        try {
          localStorage.setItem(SK_V2, JSON.stringify({ list: [main], activeId: main.id }));
          localStorage.setItem(SK, JSON.stringify(d.holdings));
        } catch { /**/ }
      } else {
        // No cloud data — fall back to local
        loadFromLocal();
      }
    } catch {
      loadFromLocal();
    } finally {
      isFetchingRef.current = false;
      loadedRef.current = true;
    }
  }, [loadFromLocal]);

  /* ---- Set / reset portfolio start ------------------------- */
  // Both just mutate the active portfolio's baseline locally — the
  // top-level save effect picks the change up and POSTs the full
  // portfolios_v2 payload to /api/portfolio. Errors surface via the
  // `saveStatus` indicator in the header.
  const savePortfolioStart = useCallback(async (cash: number, dateIso: string) => {
    if (!user) { setStartError("Sign in to set a portfolio start"); return false; }
    setStartBusy(true); setStartError(null);
    try {
      setStartingCash(cash);
      setStartedAt(dateIso);
      return true;
    } finally { setStartBusy(false); }
  }, [user, setStartingCash, setStartedAt]);

  const resetPortfolioStart = useCallback(async () => {
    if (!user) return;
    setStartBusy(true); setStartError(null);
    try {
      setStartingCash(null);
      setStartedAt(null);
    } finally { setStartBusy(false); }
  }, [user, setStartingCash, setStartedAt]);

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
          loadFromLocal();
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

    // Re-fetch from Supabase when user returns to the tab/app on any device
    // This ensures cross-device sync without needing to sign out and back in
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const stored = localStorage.getItem(AU);
        if (!stored) return;
        const u = JSON.parse(stored) as AuthUser;
        await loadFromCloud(u);
      } catch { /**/ }
    };

    document.addEventListener("visibilitychange", onVisibility);

    // Also pick up changes from SimModal (Add/Replace) — it dispatches
    // a custom `arbibx-portfolios-changed` event after writing v2.
    const onPortfoliosChanged = async () => {
      const stored = localStorage.getItem(AU);
      if (stored) {
        try { await loadFromCloud(JSON.parse(stored) as AuthUser); } catch { /**/ }
      } else {
        loadFromLocal();
      }
    };
    window.addEventListener("arbibx-portfolios-changed", onPortfoliosChanged);

    // Backwards-compat: legacy SimModal builds dispatched a storage
    // event on the SK key with a flat holdings array. If that fires,
    // route the holdings into the active portfolio.
    const onStorage = (e: StorageEvent) => {
      if (e.key === SK && !isFetchingRef.current) {
        try {
          const local = localStorage.getItem(SK);
          if (local) setH(JSON.parse(local) as H[]);
        } catch { /**/ }
      }
      if (e.key === SK_V2 && !isFetchingRef.current) {
        loadFromLocal();
      }
      if (e.key === AU) onLogin();
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("arbibx-login", onLogin);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("arbibx-portfolios-changed", onPortfoliosChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFromCloud, loadFromLocal]);

  /* ---- Save holdings — guarded ----------------------------- */
  // saveStatus: visible UI indicator. "idle" by default, "syncing"
  // while POST in flight, "saved" briefly after success, "error" on
  // network failure, "expired" on 401 (token no longer valid - user
  // needs to sign in again).
  const [saveStatus, setSaveStatus] = useState<"idle"|"syncing"|"saved"|"error"|"expired">("idle");
  const saveStatusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToCloud = useCallback(async (u: AuthUser, list: Portfolio[], active: string) => {
    setSyncing(true);
    setSaveStatus("syncing");
    const activeHoldings = list.find(p => p.id === active)?.holdings ?? [];
    try {
      const r = await fetch("/api/portfolio", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:u.email, token:u.token, portfolios:list, activeId:active }),
      });
      if (r.status === 401) {
        console.warn("Save failed: 401 - token invalid. User needs to re-sign-in.");
        setSaveStatus("expired");
        try {
          localStorage.setItem(SK_V2, JSON.stringify({ list, activeId: active }));
          localStorage.setItem(SK,    JSON.stringify(activeHoldings));
        } catch { /**/ }
      } else if (!r.ok) {
        console.error("Save failed:", r.status);
        setSaveStatus("error");
        try {
          localStorage.setItem(SK_V2, JSON.stringify({ list, activeId: active }));
          localStorage.setItem(SK,    JSON.stringify(activeHoldings));
        } catch { /**/ }
      } else {
        try {
          localStorage.setItem(SK_V2, JSON.stringify({ list, activeId: active }));
          localStorage.setItem(SK,    JSON.stringify(activeHoldings));
        } catch { /**/ }
        setSaveStatus("saved");
        if (saveStatusTimer.current) clearTimeout(saveStatusTimer.current);
        saveStatusTimer.current = setTimeout(() => setSaveStatus("idle"), 1800);
      }
    } catch (e) {
      console.error("Save error:", e);
      setSaveStatus("error");
      try {
        localStorage.setItem(SK_V2, JSON.stringify({ list, activeId: active }));
        localStorage.setItem(SK,    JSON.stringify(activeHoldings));
      } catch { /**/ }
    }
    setSyncing(false);
  }, []);

  useEffect(() => {
    // GUARD: never save before initial load finishes, or while actively fetching
    if (!loadedRef.current || isFetchingRef.current) return;
    if (!portfolios.length || !activeId) return;

    if (user) {
      saveToCloud(user, portfolios, activeId);
    } else {
      try {
        localStorage.setItem(SK_V2, JSON.stringify({ list: portfolios, activeId }));
        localStorage.setItem(SK,    JSON.stringify(holdings));
      } catch { /**/ }
    }
  }, [portfolios, activeId, holdings, user, saveToCloud]);

  /* ---- Portfolio CRUD -------------------------------------- */
  const addPortfolio = useCallback((name: string) => {
    const fresh = makeMainPortfolio();
    fresh.name = name.trim() || "Untitled";
    setPortfolios(prev => [...prev, fresh]);
    setActiveId(fresh.id);
  }, []);
  const renamePortfolio = useCallback((id: string, name: string) => {
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() || p.name } : p));
  }, []);
  const deletePortfolio = useCallback((id: string) => {
    setPortfolios(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(p => p.id !== id);
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }, [activeId]);

  const logout = () => {
    setUser(null);
    const main = makeMainPortfolio();
    setPortfolios([main]);
    setActiveId(main.id);
    loadedRef.current = true;
    try {
      localStorage.removeItem(AU);
      localStorage.removeItem(SK);
      localStorage.removeItem(SK_V2);
    } catch { /**/ }
  };

  /* ---- Fetch prices + portfolio push alerts ---------------- */
  const fetchAll = useCallback(async () => {
    if (!holdings.length) return;
    setL(true);
    const newPrices = await fetchPrices([...new Set(holdings.map(h => h.ticker))]);
    setP(newPrices);
    setTs(new Date());
    setL(false);

    // Portfolio alerts — only if logged in
    try {
      const auth = localStorage.getItem(AU);
      if (!auth) return;
      const { email } = JSON.parse(auth) as AuthUser;

      const enrichedNow = holdings.map(h => {
        const p   = newPrices[h.ticker];
        const cur = p?.p || KNOWN[h.ticker]?.p || h.buyPrice;
        const day = p?.d || KNOWN[h.ticker]?.d || 0;
        const pct = ((cur - h.buyPrice) / h.buyPrice) * 100;
        return { ticker:h.ticker, name:p?.n||KNOWN[h.ticker]?.n||h.ticker, cur, day, pct, shares:h.shares, buyPrice:h.buyPrice };
      });

      // Use a per-day key so alerts fire at most once per day per trigger
      const todayKey = `arbibx-palerts-${new Date().toISOString().split("T")[0]}`;
      const firedToday = new Set<string>(JSON.parse(localStorage.getItem(todayKey) ?? "[]") as string[]);
      const pushAlerts: { title:string; body:string }[] = [];

      // 1. Position down 5%+ today
      for (const h of enrichedNow) {
        const key = `drop-${h.ticker}`;
        if (h.day <= -5 && !firedToday.has(key)) {
          pushAlerts.push({
            title: `⚠️ ${h.ticker} down ${Math.abs(h.day).toFixed(1)}% today`,
            body:  `${h.name} dropped ${Math.abs(h.day).toFixed(1)}% today. Current: $${h.cur.toFixed(2)}`,
          });
          firedToday.add(key);
        }
      }

      // 2. Position up 20%+ from buy price
      for (const h of enrichedNow) {
        const key = `gain-${h.ticker}`;
        if (h.pct >= 20 && !firedToday.has(key)) {
          pushAlerts.push({
            title: `🚀 ${h.ticker} up ${h.pct.toFixed(0)}% from your buy`,
            body:  `${h.name} is up ${h.pct.toFixed(1)}% since you bought at $${h.buyPrice.toFixed(2)}. Current: $${h.cur.toFixed(2)}`,
          });
          firedToday.add(key);
        }
      }

      // 3. Total portfolio down 3%+ today
      const pfKey  = "portfolio-drop";
      const totVal = enrichedNow.reduce((s, h) => s + h.cur * h.shares, 0);
      const prevVal = enrichedNow.reduce((s, h) => s + (h.cur / (1 + h.day / 100)) * h.shares, 0);
      const totDay = prevVal > 0 ? ((totVal - prevVal) / prevVal) * 100 : 0;
      if (totDay <= -3 && !firedToday.has(pfKey)) {
        pushAlerts.push({
          title: `📉 Portfolio down ${Math.abs(totDay).toFixed(1)}% today`,
          body:  `Your portfolio dropped ${Math.abs(totDay).toFixed(1)}% today. Value: $${totVal.toLocaleString("en-US",{maximumFractionDigits:0})}`,
        });
        firedToday.add(pfKey);
      }

      if (pushAlerts.length) {
        localStorage.setItem(todayKey, JSON.stringify([...firedToday]));
        for (const alert of pushAlerts) {
          fetch("/api/push-send", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ email, title:alert.title, body:alert.body, url:"/?tab=portfolio" }),
          }).catch(()=>{/***/});
        }
      }
    } catch { /**/ }
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

  /* Share dialog state — generates a /p/[id] snapshot link */
  const [shareOpen,    setShareOpen]    = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareUrl,     setShareUrl]     = useState<string | null>(null);
  const [shareCopied,  setShareCopied]  = useState(false);
  const [shareErr,     setShareErr]     = useState<string | null>(null);
  const [shareShowAmounts, setShareShowAmounts] = useState(false);

  const generateShareLink = useCallback(async () => {
    if (!user) { setShareErr("Sign in to share your portfolio."); return; }
    if (!holdings.length) { setShareErr("Add at least one position first."); return; }
    setShareLoading(true);
    setShareErr(null);
    setShareUrl(null);
    setShareCopied(false);
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email, token: user.token,
          holdings, showAmounts: shareShowAmounts,
        }),
      });
      const d = await r.json() as { id?: string; error?: string };
      if (!r.ok || !d.id) {
        setShareErr(d.error ?? "Failed to create share link");
        return;
      }
      const url = `${window.location.origin}/p/${d.id}`;
      setShareUrl(url);
      // Auto-copy to clipboard if available
      try {
        await navigator.clipboard?.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
      } catch { /* */ }
    } catch {
      setShareErr("Network error - try again");
    } finally {
      setShareLoading(false);
    }
  }, [user, holdings, shareShowAmounts]);

  /* CSV export — opens a download with a single-shot Blob URL.
     Includes: ticker, name, shares, buy price, current price,
     cost basis, market value, P&L $, P&L %, today's day change %.
     Header row + data rows. Quotes any field that contains a comma. */
  const exportCSV = () => {
    if (!enriched.length) return;
    const csvField = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = [
      ["Ticker", "Name", "Shares", "Buy Price", "Current Price", "Cost Basis", "Market Value", "P&L $", "P&L %", "Today %"],
      ...enriched.map(h => [
        h.ticker,
        h.name,
        h.shares,
        h.buyPrice.toFixed(2),
        h.cur.toFixed(2),
        h.cost.toFixed(2),
        h.val.toFixed(2),
        h.pnl.toFixed(2),
        h.pct.toFixed(2),
        h.day.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(csvField).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `arbibx-portfolio-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const tv  = enriched.reduce((s, h) => s + h.val, 0);
  const tc  = enriched.reduce((s, h) => s + h.cost, 0);
  const tp  = tc > 0 ? (tv - tc) / tc * 100 : 0;
  const g   = grade(enriched);
  const gc_ = gc(g.letter);

  // Baseline math: when the user has set a starting cash + start date,
  // we treat starting_cash as the "account size" they began with.
  // Cash left over = starting_cash - sum(buyPrice * shares), clamped
  // to ≥0 so a user who later invested more than their stated start
  // doesn't see negative cash. Total account value = holdings + cash.
  const cashLeft         = startingCash != null ? Math.max(0, startingCash - tc) : 0;
  const totalAccountVal  = startingCash != null ? tv + cashLeft : tv;
  const returnSinceStart = startingCash != null && startingCash > 0
    ? (totalAccountVal - startingCash) / startingCash * 100
    : null;
  const startDateLabel = startedAt ? new Date(startedAt).toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }) : "";

  const openStartModal = () => {
    setStartInput(startingCash != null ? String(startingCash) : "10000");
    setStartDate(startedAt ? startedAt.split("T")[0] : new Date().toISOString().split("T")[0]);
    setStartError(null);
    setStartModalOpen(true);
  };
  const submitStart = async () => {
    const cash = parseFloat(startInput.replace(/,/g, ""));
    if (!cash || cash <= 0) { setStartError("Enter a positive starting amount"); return; }
    const dateIso = startDate ? new Date(startDate + "T00:00:00").toISOString() : new Date().toISOString();
    const ok = await savePortfolioStart(cash, dateIso);
    if (ok) setStartModalOpen(false);
  };

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
          {/* Currency now lives in the global header — single source
              of truth via localStorage + the arbibx-currency-change
              event. Show a small "loading" hint here only while the
              FX rate is fetching for a non-USD pick. */}
          {!fxReady && currency !== "USD" && (
            <span title={`Loading ${currency} exchange rate`}
              style={{ ...mono, fontSize: 9, color: V.gold, padding: "6px 10px", borderRadius: 8, background: V.goldDim, border: `1px solid ${V.goldWire}`, display: "inline-flex", alignItems: "center", gap: 5, textTransform: "uppercase", letterSpacing: "0.10em", fontWeight: 700 }}>
              <DollarSign size={10} /> {currency} loading…
            </span>
          )}
          {/* Visible save status — replaces the silent failures.
              "expired" means the token is invalid (typically because
              another device logged in under the legacy rotation
              behavior); the user must sign back in. */}
          {saveStatus === "syncing" && (
            <span style={{ ...mono, fontSize:9, color:V.ink3, display:"inline-flex", alignItems:"center", gap:5 }}>
              <RefreshCw size={9} style={{ animation:"spin 1s linear infinite" }} /> Saving…
            </span>
          )}
          {saveStatus === "saved" && (
            <span style={{ ...mono, fontSize:9, color:V.gain, display:"inline-flex", alignItems:"center", gap:4 }}>
              <CheckCircle size={9} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span style={{ ...mono, fontSize:9, color:V.loss, display:"inline-flex", alignItems:"center", gap:4 }} title="Save failed - retry by editing any holding">
              <AlertTriangle size={9} /> Save failed
            </span>
          )}
          {saveStatus === "expired" && (
            <button onClick={() => { logout(); onSignIn?.(); }}
              style={{ ...mono, fontSize:9, color:V.loss, background:"rgba(232,68,90,0.10)", border:`1px solid ${V.lossWire}`, padding:"4px 10px", borderRadius:6, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:4 }}
              title="Your sign-in expired - click to sign in again">
              <AlertTriangle size={9} /> Session expired · Sign in again
            </button>
          )}
          {ts && saveStatus === "idle" && <span style={{ ...mono, color:V.ink4, fontSize:9 }}>{ts.toLocaleTimeString()}</span>}
          {user && (
            <button onClick={logout}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
              <LogOut size={12} /> Sign out
            </button>
          )}
          {user && (
            <button onClick={() => { setShareOpen(true); setShareUrl(null); setShareErr(null); setShareCopied(false); }}
              disabled={!holdings.length}
              title="Generate a public share link for this portfolio"
              style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background: holdings.length ? "rgba(155,114,245,0.10)" : "rgba(255,255,255,0.03)", border: `1px solid ${holdings.length ? V.ameWire : V.w1}`, color: holdings.length ? V.ame : V.ink3, cursor: holdings.length ? "pointer" : "not-allowed", fontSize:12, opacity:holdings.length ? 1 : 0.4, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
              <Share2 size={12} /> Share
            </button>
          )}
          <button onClick={exportCSV} disabled={!holdings.length}
            title="Download portfolio as CSV"
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: holdings.length ? "pointer" : "not-allowed", fontSize:12, opacity:holdings.length ? 1 : 0.4, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <Download size={12} /> Export CSV
          </button>
          <button onClick={fetchAll} disabled={loading || !holdings.length}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading || !holdings.length ? "not-allowed" : "pointer", fontSize:12, opacity:holdings.length ? 1 : 0.4, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Portfolio switcher ─────────────────────────────── */}
      {portfolios.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <PortfolioSwitcher
            portfolios={portfolios.map(p => ({ id: p.id, name: p.name, positions: p.holdings.length }))}
            activeId={activeId}
            onSetActive={setActiveId}
            onAdd={addPortfolio}
            onRename={renamePortfolio}
            onDelete={deletePortfolio}
          />
        </div>
      )}

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

      {/* ── Portfolio snapshot — baseline + return since start ── */}
      {user && startingCash != null && returnSinceStart != null ? (
        <div style={{
          ...glass({ padding:"22px 24px", marginBottom:20 }),
          background: returnSinceStart >= 0
            ? "linear-gradient(135deg, rgba(0,229,160,0.08) 0%, rgba(0,229,160,0.02) 70%, transparent 100%)"
            : "linear-gradient(135deg, rgba(255,69,96,0.08) 0%, rgba(255,69,96,0.02) 70%, transparent 100%)",
          border: `1px solid ${returnSinceStart >= 0 ? V.gainWire : V.lossWire}`,
        }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:18, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:240 }}>
              <p style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.16em", margin:"0 0 6px", fontWeight:700 }}>
                <Calendar size={9} style={{ display:"inline", verticalAlign:"-1px", marginRight:5 }}/>
                Tracking since {startDateLabel}
              </p>
              <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
                <span style={{ fontFamily:"'Cabinet Grotesk',system-ui,sans-serif", fontSize:"clamp(34px,6vw,52px)", fontWeight:900, color: returnSinceStart >= 0 ? V.gain : V.loss, letterSpacing:"-0.04em", lineHeight:1 }}>
                  {returnSinceStart >= 0 ? "+" : ""}{returnSinceStart.toFixed(2)}%
                </span>
                <span style={{ ...mono, fontSize:13, fontWeight:600, color: returnSinceStart >= 0 ? V.gain : V.loss }}>
                  {returnSinceStart >= 0 ? "+" : ""}{f$(totalAccountVal - startingCash)}
                </span>
              </div>
              <p style={{ ...mono, fontSize:11, color:V.ink2, margin:"10px 0 0" }}>
                Total value <strong style={{ color:V.ink0 }}>{f$(totalAccountVal)}</strong>
                {" · "}Started with <strong style={{ color:V.ink1 }}>{f$(startingCash)}</strong>
              </p>
              <p style={{ ...mono, fontSize:10, color:V.ink3, margin:"6px 0 0" }}>
                <span style={{ color:V.ink2 }}>{f$(tv)}</span> in {enriched.length} position{enriched.length === 1 ? "" : "s"}
                {cashLeft > 0 && <> · <Wallet size={10} style={{ display:"inline", verticalAlign:"-1px" }}/> <span style={{ color:V.ink2 }}>{f$(cashLeft)}</span> uninvested cash</>}
                {cashLeft === 0 && tc > startingCash && <> · <span style={{ color:V.gold }}>Over-invested by {f$(tc - startingCash)}</span></>}
              </p>
            </div>
            <div style={{ display:"flex", gap:6, flexShrink:0 }}>
              <button onClick={openStartModal}
                title="Edit starting cash or start date"
                style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, color:V.ink2, cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
                Edit
              </button>
              <button onClick={() => { if (confirm("Reset portfolio start? Your holdings will stay; only the baseline + start date are cleared.")) resetPortfolioStart(); }}
                title="Clear baseline and start date"
                style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", borderRadius:8, background:"rgba(232,68,90,0.06)", border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : user ? (
        <div style={{ ...glass({ padding:"18px 22px", marginBottom:20, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }) }}>
          <div style={{ width:38, height:38, borderRadius:10, background:"rgba(155,114,245,0.10)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Sparkles size={17} color={V.ame}/>
          </div>
          <div style={{ flex:1, minWidth:220 }}>
            <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:"0 0 2px", fontFamily:"'Cabinet Grotesk',system-ui,sans-serif" }}>
              Track your portfolio from a fresh start
            </p>
            <p style={{ fontSize:12, color:V.ink3, margin:0, lineHeight:1.55 }}>
              Set a starting cash amount and date to see total return since you began — not just per-position P&amp;L.
            </p>
          </div>
          <button onClick={openStartModal}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, background:"linear-gradient(135deg,#9B72F5,#7B52D5)", border:"none", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", flexShrink:0 }}>
            <Sparkles size={12}/> Start tracking
          </button>
        </div>
      ) : null}

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
              style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", borderRadius:9, background:"linear-gradient(135deg,rgba(79,142,247,0.18),rgba(79,142,247,0.08))", border:`1px solid ${V.arcWire}`, color:"var(--ticker-blue,#7EB6FF)", cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", whiteSpace:"nowrap" }}>
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

          {/* Positions table — each row is a link to the dedicated
              ticker page, with the trash button stop-propagated so
              the user can still delete without navigating. */}
          <div className="vx-stagger" style={{ ...glass({ overflow:"hidden", marginBottom:20 }) }}>
            {enriched.map((h, i) => {
              const up = h.pnl >= 0, dayUp = h.day >= 0;
              return (
                <Link key={h.id}
                  href={`/stock/${h.ticker}`}
                  style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto auto auto", gap:12, alignItems:"center", padding:"14px 18px", borderBottom: i < enriched.length - 1 ? `1px solid ${V.w1}` : "none", textDecoration:"none", color:"inherit", transition:"background 0.15s ease" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ ...mono, fontSize:14, fontWeight:600, color:"var(--ticker-blue,#7EB6FF)" }}>{h.ticker}</span>
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
                  <ChevronRight size={14} style={{ color: V.ink4, opacity: 0.6 }} />
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setH(prev => prev.filter(x => x.id !== h.id)); }}
                    aria-label={`Remove ${h.ticker}`}
                    style={{ background:"none", border:"none", cursor:"pointer", color:V.ink4, padding:6, borderRadius:7, display:"flex", alignItems:"center", transition:"color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = V.loss}
                    onMouseLeave={e => e.currentTarget.style.color = V.ink4}>
                    <Trash2 size={14} />
                  </button>
                </Link>
              );
            })}
          </div>

          {/* AI Grade — Pro-locked. Free users see a teaser of the
              grade card with the actual letter / strengths / weaknesses
              blurred out and an upgrade CTA overlay. */}
          <div style={{ ...glass({ overflow:"hidden", marginBottom:20 }), position: "relative" }}>
            {!isPro && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 5,
                background: "linear-gradient(180deg, rgba(8,6,15,0.30) 0%, rgba(8,6,15,0.85) 100%)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 20,
              }}>
                <div style={{
                  textAlign: "center",
                  maxWidth: 360,
                  padding: "20px 22px",
                  borderRadius: 14,
                  background: "linear-gradient(135deg, rgba(240,165,0,0.12) 0%, rgba(155,114,245,0.08) 100%)",
                  border: "1px solid rgba(240,165,0,0.40)",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                }}>
                  <p style={{ ...mono, fontSize: 9, color: V.gold, textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 6px", fontWeight: 700 }}>
                    Pro · AI Portfolio Grade
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: V.ink0, margin: "0 0 6px", fontFamily: "'Cabinet Grotesk',system-ui" }}>
                    See your portfolio&apos;s letter grade
                  </p>
                  <p style={{ fontSize: 12, color: V.ink2, margin: "0 0 14px", lineHeight: 1.5 }}>
                    Win rate, volatility score, diversification, plus AI-written strengths, weaknesses, and rebalancing tips.
                  </p>
                  <button onClick={() => onUpgrade?.()}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 9,
                      background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
                      color: "#0a0800",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: "'Cabinet Grotesk',system-ui",
                      boxShadow: "0 4px 18px rgba(240,165,0,0.50)",
                    }}>
                    Unlock Pro · $9.99/mo
                  </button>
                </div>
              </div>
            )}
            <div style={{ padding:"20px 24px", borderBottom:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, filter: !isPro ? "blur(6px)" : "none" }}>
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", filter: !isPro ? "blur(6px)" : "none" }}>
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
        <div style={{ ...glass({ padding:"56px 32px", textAlign:"center", maxWidth:540, margin:"0 auto" }) }}>
          <div style={{ width:56, height:56, borderRadius:14, background:"rgba(155,114,245,0.08)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <BookOpen size={26} color={V.ame} />
          </div>
          <p style={{ fontSize:18, fontWeight:700, color:V.ink0, margin:"0 0 6px", fontFamily:"'Cabinet Grotesk',system-ui,sans-serif", letterSpacing:"-0.01em" }}>
            Build your portfolio
          </p>
          <p style={{ color:V.ink3, fontSize:13, margin:"0 0 22px", lineHeight:1.6 }}>
            Add a real position above with ticker, share count, and buy price — or load a sample to see what live tracking + AI grading looks like.
          </p>
          <button onClick={() => {
            const demo: H[] = [
              { id:`demo-${Date.now()}-1`, ticker:"AAPL",  shares:10, buyPrice:175 },
              { id:`demo-${Date.now()}-2`, ticker:"NVDA",  shares:5,  buyPrice:140 },
              { id:`demo-${Date.now()}-3`, ticker:"MSFT",  shares:8,  buyPrice:320 },
              { id:`demo-${Date.now()}-4`, ticker:"GOOGL", shares:12, buyPrice:145 },
              { id:`demo-${Date.now()}-5`, ticker:"AMZN",  shares:6,  buyPrice:175 },
            ];
            setH(demo);
            setErr("");
          }}
            style={{
              display:"inline-flex", alignItems:"center", gap:6,
              padding:"10px 18px", borderRadius:10,
              background:"rgba(155,114,245,0.10)",
              border:`1px solid ${V.ameWire}`,
              color:V.ame, cursor:"pointer",
              fontSize:13, fontWeight:600,
              fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",
            }}>
            ⚡ Load sample portfolio
          </button>
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:"14px 0 0", textTransform:"uppercase", letterSpacing:"0.10em" }}>
            5 large-caps · easy to remove later
          </p>
        </div>
      )}

      <style>{`
        @keyframes vx-rise { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @media(max-width:640px) { .add-grid { grid-template-columns:1fr 1fr !important; } }
      `}</style>

      {/* ── Portfolio start modal ──────────────────────────── */}
      {startModalOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setStartModalOpen(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
          <div style={{ background:"rgba(8,6,16,0.97)", border:`1px solid ${V.w2}`, borderRadius:18, width:"100%", maxWidth:440, padding:0, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.78), 0 0 32px rgba(155,114,245,0.12)" }}>
            <div style={{ height:2, background:"linear-gradient(90deg,#9B72F5,#7B52D5,#9B72F5)" }}/>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 22px", borderBottom:`1px solid ${V.w1}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Sparkles size={16} color={V.ame}/>
                <h2 style={{ fontFamily:"'Cabinet Grotesk',system-ui,sans-serif", fontSize:16, fontWeight:700, color:V.ink0, margin:0 }}>
                  {startingCash != null ? "Edit portfolio start" : "Set portfolio start"}
                </h2>
              </div>
              <button onClick={() => setStartModalOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:4, display:"flex" }}>
                <X size={16}/>
              </button>
            </div>
            <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:16 }}>
              <p style={{ fontSize:13, color:V.ink2, margin:0, lineHeight:1.55 }}>
                Anchor your portfolio to a starting cash amount + date. Performance will be measured against this baseline rather than against each position&apos;s buy price.
              </p>

              <div>
                <label style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.10em", display:"block", marginBottom:6, fontWeight:700 }}>
                  Starting cash
                </label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:V.ink3, fontSize:14, ...mono }}>$</span>
                  <input
                    autoFocus
                    type="number"
                    value={startInput}
                    onChange={e => { setStartInput(e.target.value); setStartError(null); }}
                    onKeyDown={e => { if (e.key === "Enter") submitStart(); }}
                    placeholder="10000"
                    style={{ width:"100%", padding:"10px 12px 10px 26px", borderRadius:9, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, color:V.ink0, fontSize:15, ...mono, outline:"none", boxSizing:"border-box" }}/>
                </div>
              </div>

              <div>
                <label style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.10em", display:"block", marginBottom:6, fontWeight:700 }}>
                  Start date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e.target.value); setStartError(null); }}
                  max={new Date().toISOString().split("T")[0]}
                  style={{ width:"100%", padding:"10px 12px", borderRadius:9, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w2}`, color:V.ink0, fontSize:13, ...mono, outline:"none", boxSizing:"border-box", colorScheme:"dark" }}/>
                <p style={{ ...mono, fontSize:9, color:V.ink4, margin:"5px 0 0", lineHeight:1.5 }}>
                  Backdate to when you actually started — the return % is measured from this date.
                </p>
              </div>

              {startError && (
                <div style={{ ...mono, fontSize:11, color:V.loss, padding:"8px 12px", borderRadius:8, background:"rgba(232,68,90,0.08)", border:`1px solid ${V.lossWire}`, lineHeight:1.5, whiteSpace:"pre-wrap" }}>
                  {startError}
                </div>
              )}

              <button onClick={submitStart} disabled={startBusy}
                style={{ padding:"11px 18px", borderRadius:10, background: startBusy ? "rgba(155,114,245,0.30)" : "linear-gradient(135deg,#9B72F5,#7B52D5)", border:"none", color:"#fff", cursor: startBusy ? "not-allowed" : "pointer", fontSize:13, fontWeight:700, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {startBusy ? <RefreshCw size={13} style={{ animation:"spin 1s linear infinite" }}/> : <Sparkles size={13}/>}
                {startBusy ? "Saving…" : (startingCash != null ? "Update start" : "Start tracking")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share modal ──────────────────────────────────────── */}
      {shareOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setShareOpen(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
          <div style={{ background:"rgba(8,6,16,0.97)", border:`1px solid ${V.w2}`, borderRadius:18, width:"100%", maxWidth:440, padding:0, overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.7), 0 0 32px rgba(155,114,245,0.10)" }}>
            <div style={{ height:2, background:"linear-gradient(90deg,#9B72F5,#f0a500,#9B72F5)" }}/>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 22px", borderBottom:`1px solid ${V.w1}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <Share2 size={16} color={V.ame}/>
                <h2 style={{ fontFamily:"'Cabinet Grotesk',system-ui,sans-serif", fontSize:16, fontWeight:700, color:V.ink0, margin:0 }}>Share portfolio</h2>
              </div>
              <button onClick={()=>setShareOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:4, display:"flex" }}><X size={16}/></button>
            </div>
            <div style={{ padding:"18px 22px", display:"flex", flexDirection:"column", gap:14 }}>
              <p style={{ fontSize:13, color:V.ink2, margin:0, lineHeight:1.55 }}>
                Generate a public, read-only snapshot of your current portfolio. Anyone with the link can see the tickers and returns. <strong>This is a moment-in-time snapshot</strong> — it doesn&apos;t update if you change your portfolio later.
              </p>

              {/* Show $ amounts toggle */}
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"12px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, cursor:"pointer" }}>
                <input type="checkbox" checked={shareShowAmounts}
                  onChange={e=>setShareShowAmounts(e.target.checked)}
                  style={{ marginTop:2, accentColor:V.ame }}/>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:V.ink0, margin:0 }}>Show dollar amounts</p>
                  <p style={{ fontSize:11, color:V.ink3, margin:"3px 0 0", lineHeight:1.4 }}>
                    Off: only ticker names + return % are visible. <br/>
                    On: shares, cost basis, and market value are visible.
                  </p>
                </div>
              </label>

              {!shareUrl && (
                <button onClick={generateShareLink} disabled={shareLoading}
                  style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"11px 18px", borderRadius:10, background: shareLoading ? "rgba(155,114,245,0.20)" : "linear-gradient(135deg,#9B72F5,#7E5BD8)", color:"#fff", border:"none", cursor: shareLoading ? "wait" : "pointer", fontSize:13, fontWeight:700, fontFamily:"'Cabinet Grotesk',system-ui,sans-serif", opacity: shareLoading ? 0.7 : 1, boxShadow:"0 4px 24px rgba(155,114,245,0.32)" }}>
                  <Share2 size={14}/> {shareLoading ? "Generating link..." : "Create share link"}
                </button>
              )}

              {shareUrl && (
                <div>
                  <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Your share URL</p>
                  <div style={{ display:"flex", gap:8 }}>
                    <input readOnly value={shareUrl}
                      onFocus={e=>e.currentTarget.select()}
                      style={{ flex:1, ...mono, fontSize:12, padding:"10px 12px", borderRadius:9, background:"rgba(155,114,245,0.06)", border:`1px solid ${V.ameWire}`, color:V.ink0, outline:"none" }}/>
                    <button onClick={()=>{ navigator.clipboard?.writeText(shareUrl); setShareCopied(true); setTimeout(()=>setShareCopied(false),2000); }}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"10px 14px", borderRadius:9, background: shareCopied ? "rgba(0,229,160,0.12)" : "rgba(155,114,245,0.10)", border:`1px solid ${shareCopied ? V.gainWire : V.ameWire}`, color: shareCopied ? V.gain : V.ame, cursor:"pointer", ...mono, fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>
                      {shareCopied ? <><CheckCircle size={11}/> Copied</> : <><Copy size={11}/> Copy</>}
                    </button>
                  </div>
                  <p style={{ fontSize:11, color:V.ink3, marginTop:8, lineHeight:1.5 }}>
                    Visit the link to preview, or share it anywhere. <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ color:V.ame, textDecoration:"underline" }}>Open share page →</a>
                  </p>
                </div>
              )}

              {shareErr && (
                <div style={{ display:"flex", alignItems:"flex-start", gap:8, padding:"10px 12px", borderRadius:8, background:V.lossDim, border:`1px solid ${V.lossWire}` }}>
                  <AlertTriangle size={13} color={V.loss} style={{ flexShrink:0, marginTop:1 }}/>
                  <p style={{ fontSize:12, color:V.loss, margin:0 }}>{shareErr}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
