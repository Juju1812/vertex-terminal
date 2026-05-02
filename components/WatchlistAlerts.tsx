"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Star, Bell, TrendingUp, TrendingDown, Plus, Trash2,
  RefreshCw, Mail, CheckCircle, X, AlertTriangle, ExternalLink, Search,
} from "lucide-react";
import dynamic from "next/dynamic";

const WatchlistSwitcher = dynamic(() => import("./WatchlistSwitcher"), { ssr: false, loading: () => null });

/* ---- Types -------------------------------------------------- */
interface WatchedStock {
  ticker: string; name: string; price: number;
  changePct: number; high: number; low: number; volume: number;
}
interface PriceAlert {
  id: string; ticker: string; condition: "above" | "below";
  targetPrice: number; email: string; triggered: boolean; createdAt: string;
}
interface WatchlistEntry { id: string; name: string; tickers: string[]; }
interface WatchlistsState { lists: WatchlistEntry[]; activeId: string; }
interface Props {
  watchlist: string[];
  onToggleWatch: (ticker: string) => void;
  onSelectTicker?: (ticker: string) => void;
  // Optional multi-list switcher controls. When present, a pill row
  // appears at the top of the tab letting users switch / add / rename
  // / delete watchlists. When absent, behaves as before with the
  // single list passed via `watchlist`.
  watchlists?: WatchlistsState;
  onSetActiveList?: (id: string) => void;
  onAddList?: (name: string) => void;
  onRenameList?: (id: string, name: string) => void;
  onDeleteList?: (id: string) => void;
}

/* ---- Ticker metadata --------------------------------------- */
const TICKER_NAMES: Record<string, string> = {
  NVDA:"NVIDIA Corp.", MSFT:"Microsoft Corp.", AAPL:"Apple Inc.",
  META:"Meta Platforms", GOOGL:"Alphabet Inc.", AMD:"Advanced Micro Dev.",
  AVGO:"Broadcom Inc.", ORCL:"Oracle Corp.", CRM:"Salesforce Inc.",
  NOW:"ServiceNow Inc.", ADBE:"Adobe Inc.", INTC:"Intel Corp.",
  QCOM:"Qualcomm Inc.", JPM:"JPMorgan Chase", V:"Visa Inc.",
  MA:"Mastercard Inc.", BAC:"Bank of America", GS:"Goldman Sachs",
  COIN:"Coinbase Global", AMZN:"Amazon.com", TSLA:"Tesla Inc.",
  NKE:"Nike Inc.", SBUX:"Starbucks Corp.", RIVN:"Rivian Automotive",
  LCID:"Lucid Group", UNH:"UnitedHealth Group", LLY:"Eli Lilly & Co.",
  PFE:"Pfizer Inc.", MRNA:"Moderna Inc.", ABBV:"AbbVie Inc.",
  NVO:"Novo Nordisk (ADR)", PLTR:"Palantir Tech.", CRWD:"CrowdStrike",
  PANW:"Palo Alto Networks", S:"SentinelOne", NET:"Cloudflare Inc.",
  SNOW:"Snowflake Inc.", XOM:"ExxonMobil Corp.", CVX:"Chevron Corp.",
  OXY:"Occidental Petroleum", TCEHY:"Tencent (ADR)", BABA:"Alibaba (ADR)",
  BIDU:"Baidu (ADR)", TSM:"Taiwan Semi (ADR)", ASML:"ASML (ADR)",
  SAP:"SAP SE (ADR)", SONY:"Sony (ADR)", TM:"Toyota (ADR)",
  NSRGY:"Nestle (ADR)", RHHBY:"Roche (ADR)", MSTR:"MicroStrategy",
  SIRI:"Sirius XM", NKLA:"Nikola Corp.", GBTC:"Grayscale Bitcoin Tr.",
  ACMIF:"Allied Critical Metals", BTQQF:"BTQ Technologies",
};

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const ALERTS_KEY  = "arbibx-price-alerts";

/* ---- Design tokens ----------------------------------------- */
const V = {
  w1:"var(--border,rgba(130,180,255,0.055))", w2:"var(--border-hi,rgba(130,180,255,0.10))",
  ink0:"var(--ink0,#F2F6FF)", ink1:"var(--ink1,#C8D5E8)", ink2:"var(--ink2,#7A9CBF)", ink3:"var(--ink3,#3D5A7A)", ink4:"var(--ink4,#1F3550)",
  gain:"var(--gain,#00C896)", gainDim:"var(--gain-dim,rgba(0,200,150,0.08))", gainWire:"var(--gain-wire,rgba(0,200,150,0.20))",
  loss:"var(--loss,#E8445A)", lossDim:"var(--loss-dim,rgba(232,68,90,0.08))",  lossWire:"var(--loss-wire,rgba(232,68,90,0.20))",
  arc:"#4F8EF7",  arcDim:"rgba(79,142,247,0.08)",  arcWire:"rgba(79,142,247,0.22)",
  gold:"var(--gold,#E8A030)", goldDim:"var(--gold-dim,rgba(232,160,48,0.08))", goldWire:"var(--gold-wire,rgba(232,160,48,0.20))",
  ame:"#9B72F5",  ameDim:"rgba(155,114,245,0.08)", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)",
  border:`1px solid ${V.w2}`, borderRadius:14,
  boxShadow:"0 4px 16px rgba(0,0,0,0.45)",
  position:"relative" as const, ...ex,
});

const f$ = (n: number) => `$${n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fp = (n: number) => `${n>=0?"+":""}${n.toFixed(2)}%`;

/* ---- Fetch prices ------------------------------------------ */
async function fetchWatchlistPrices(tickers: string[]): Promise<Record<string, WatchedStock>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return {};
    const d = await r.json() as {
      tickers?: Array<{ ticker:string; day:{c:number;h:number;l:number;v:number}; prevDay:{c:number} }>
    };
    const result: Record<string, WatchedStock> = {};
    for (const t of d.tickers ?? []) {
      if (!t.day?.c) continue;
      const changePct = t.prevDay?.c ? +((t.day.c-t.prevDay.c)/t.prevDay.c*100).toFixed(2) : 0;
      result[t.ticker] = {
        ticker:t.ticker, name:TICKER_NAMES[t.ticker]??t.ticker,
        price:t.day.c, changePct, high:t.day.h, low:t.day.l, volume:t.day.v,
      };
    }
    return result;
  } catch { return {}; }
}

/* ---- AddAlertModal ----------------------------------------- */
function AddAlertModal({ ticker, currentPrice, onAdd, onClose }:{
  ticker:string; currentPrice:number;
  onAdd:(a:Omit<PriceAlert,"id"|"triggered"|"createdAt">)=>void;
  onClose:()=>void;
}) {
  const [condition, setCondition] = useState<"above"|"below">("above");
  const [price,     setPrice]     = useState(currentPrice.toFixed(2));
  const [email,     setEmail]     = useState(()=>{try{return JSON.parse(localStorage.getItem("arbibx-auth-user")??"{}").email??"";}catch{return "";}});
  const [error,     setError]     = useState("");

  const submit = () => {
    const p = parseFloat(price);
    if (!p||p<=0) return setError("Enter a valid price.");
    if (!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email.");
    onAdd({ticker,condition,targetPrice:p,email});
    onClose();
  };

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{background:"rgba(8,13,24,0.98)",border:`1px solid ${V.w2}`,borderRadius:18,width:"100%",maxWidth:400,padding:24}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:V.ink0,margin:0}}>Set Price Alert</p>
            <p style={{...mono,fontSize:10,color:V.ink4,margin:0,marginTop:2}}>{ticker} · Current: {f$(currentPrice)}</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,display:"flex"}}><X size={16}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Trigger when price is</p>
            <div style={{display:"flex",gap:8}}>
              {(["above","below"] as const).map(c=>(
                <button key={c} onClick={()=>setCondition(c)}
                  style={{flex:1,padding:"10px",borderRadius:9,border:`1px solid ${condition===c?(c==="above"?V.gainWire:V.lossWire):V.w1}`,background:condition===c?(c==="above"?V.gainDim:V.lossDim):"rgba(255,255,255,0.02)",color:condition===c?(c==="above"?V.gain:V.loss):V.ink3,cursor:"pointer",...mono,fontSize:12,fontWeight:600,textTransform:"capitalize"}}>
                  {c==="above"?"↑ Above":"↓ Below"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Target Price</p>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:V.ink3,...mono}}>$</span>
              <input type="number" value={price} onChange={e=>{setPrice(e.target.value);setError("");}} step="0.01"
                style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.w2}`,borderRadius:9,color:V.ink0,...mono,fontSize:15,padding:"11px 12px 11px 24px",outline:"none",boxSizing:"border-box" as const}}/>
            </div>
          </div>
          <div>
            <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:8}}>Alert Email</p>
            <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="your@email.com"
              style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.w2}`,borderRadius:9,color:V.ink0,...mono,fontSize:13,padding:"11px 14px",outline:"none",boxSizing:"border-box" as const}}/>
          </div>
          {error&&(
            <div style={{display:"flex",gap:7,padding:"8px 12px",borderRadius:8,background:V.lossDim,border:`1px solid ${V.lossWire}`}}>
              <AlertTriangle size={13} color={V.loss}/>
              <span style={{fontSize:12,color:V.loss}}>{error}</span>
            </div>
          )}
          <button onClick={submit}
            style={{padding:"13px",borderRadius:10,background:"linear-gradient(135deg,#4F8EF7,#2D6FDB)",border:"none",color:"#fff",fontSize:14,fontWeight:600,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
            <Bell size={14}/> Set Alert
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- AddTickerModal ---------------------------------------- */
function AddTickerModal({ watchlist, onAdd, onClose }:{watchlist:string[];onAdd:(t:string)=>void;onClose:()=>void}) {
  const [search, setSearch] = useState("");
  const all = Object.keys(TICKER_NAMES).filter(t=>!watchlist.includes(t));
  const filtered = search
    ? all.filter(t=>t.toLowerCase().includes(search.toLowerCase())||TICKER_NAMES[t].toLowerCase().includes(search.toLowerCase()))
    : all;

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
      <div style={{background:"rgba(8,13,24,0.98)",border:`1px solid ${V.w2}`,borderRadius:18,width:"100%",maxWidth:440,maxHeight:"70vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:`1px solid ${V.w1}`}}>
          <p style={{fontSize:15,fontWeight:700,color:V.ink0,margin:0}}>Add to Watchlist</p>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,display:"flex"}}><X size={16}/></button>
        </div>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${V.w1}`}}>
          <div style={{position:"relative"}}>
            <Search size={12} color={V.ink4} style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ticker or company..."
              style={{width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${V.w1}`,borderRadius:9,color:V.ink0,...mono,fontSize:13,padding:"8px 12px 8px 28px",outline:"none",boxSizing:"border-box" as const}}/>
          </div>
        </div>
        <div style={{overflow:"auto",flex:1}}>
          {filtered.slice(0,30).map(t=>(
            <button key={t} onClick={()=>{onAdd(t);onClose();}}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"12px 18px",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid rgba(130,180,255,0.04)`,transition:"background 0.15s"}}
              onMouseEnter={e=>(e.currentTarget.style.background="rgba(130,180,255,0.04)")}
              onMouseLeave={e=>(e.currentTarget.style.background="none")}>
              <span style={{...mono,fontSize:13,fontWeight:600,color:"var(--ticker-blue,#7EB6FF)"}}>{t}</span>
              <span style={{fontSize:12,color:V.ink3}}>{TICKER_NAMES[t]}</span>
            </button>
          ))}
          {filtered.length===0&&<p style={{color:V.ink3,fontSize:13,textAlign:"center",padding:"24px"}}>No matches found</p>}
        </div>
      </div>
    </div>
  );
}

/* ---- Main Component ---------------------------------------- */
export default function WatchlistAlerts({watchlist,onToggleWatch,onSelectTicker,watchlists,onSetActiveList,onAddList,onRenameList,onDeleteList}:Props) {
  const [prices,      setPrices]      = useState<Record<string,WatchedStock>>({});
  const [alerts,      setAlerts]      = useState<PriceAlert[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdate,  setLastUpdate]  = useState<Date|null>(null);
  const [alertTicker, setAlertTicker] = useState<string|null>(null);
  const [showAdd,     setShowAdd]     = useState(false);
  const [sendingAlert,setSendingAlert]= useState<string|null>(null);
  const [alertSent,   setAlertSent]   = useState<string|null>(null);

  // KEY FIX: alertsRef always holds the latest alerts so loadPrices
  // never reads a stale empty array from the closure
  const alertsRef = useRef<PriceAlert[]>([]);

  // Load alerts from localStorage on mount, then immediately check triggers
  // against any prices already fetched
  useEffect(()=>{
    try {
      const raw = localStorage.getItem(ALERTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PriceAlert[];
        setAlerts(parsed);
        alertsRef.current = parsed;
      }
    } catch { /**/ }
    // Re-run loadPrices after alerts are loaded so trigger check has real data
    // Small delay ensures alertsRef.current is set before loadPrices reads it
    setTimeout(() => { loadPrices(); }, 100);
  }, []); // eslint-disable-line

  // Keep ref in sync whenever alerts state changes
  useEffect(()=>{ alertsRef.current = alerts; }, [alerts]);

  const saveAlerts = useCallback((newAlerts: PriceAlert[]) => {
    setAlerts(newAlerts);
    alertsRef.current = newAlerts;
    try { localStorage.setItem(ALERTS_KEY, JSON.stringify(newAlerts)); } catch { /**/ }
  }, []);

  const loadPrices = useCallback(async () => {
    if (!watchlist.length) { setLoading(false); return; }
    setLoading(true);
    const data = await fetchWatchlistPrices(watchlist);
    setPrices(data);
    setLastUpdate(new Date());
    setLoading(false);

    // Use alertsRef.current — always fresh, never stale from closure
    const currentAlerts = alertsRef.current;
    const updated = [...currentAlerts];
    let changed = false;

    for (let i = 0; i < updated.length; i++) {
      const alert = updated[i];
      if (alert.triggered) continue;
      const stock = data[alert.ticker];
      if (!stock) continue;

      const triggered =
        (alert.condition === "above" && stock.price >= alert.targetPrice) ||
        (alert.condition === "below" && stock.price <= alert.targetPrice);

      if (triggered) {
        // Fire the email
        try {
          await fetch("/api/send-alert", {
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              email: alert.email,
              ticker: alert.ticker,
              condition: alert.condition,
              targetPrice: alert.targetPrice,
              currentPrice: stock.price,
            }),
          });
        } catch { /**/ }
        updated[i] = { ...alert, triggered:true };
        changed = true;
      }
    }

    if (changed) saveAlerts(updated);
  }, [watchlist, saveAlerts]);

  // Auto-refresh every 5 minutes so alerts fire without manual refresh
  useEffect(() => {
    const id = setInterval(() => { loadPrices(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [loadPrices]);

  // Reload when watchlist size changes (stock added/removed)
  const prevLenRef = useRef(watchlist.length);
  useEffect(() => {
    if (watchlist.length !== prevLenRef.current) {
      prevLenRef.current = watchlist.length;
      loadPrices();
    }
  }, [watchlist.length, loadPrices]);

  // For logged-in users: persist to Supabase so the Vercel cron job can
  // fire alerts even when no tab is open. localStorage stays as a UI
  // cache for instant display. Guests stay localStorage-only since they
  // have no account to email/push to.
  const getAuthUser = (): { email: string; token: string } | null => {
    try {
      const s = localStorage.getItem("arbibx-auth-user");
      if (!s) return null;
      const u = JSON.parse(s) as { email: string; token: string };
      return u.email && u.token ? u : null;
    } catch { return null; }
  };

  const addAlert = async (alert: Omit<PriceAlert,"id"|"triggered"|"createdAt">) => {
    const u = getAuthUser();
    let serverId: string | null = null;
    if (u) {
      try {
        const r = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: u.email, token: u.token,
            ticker: alert.ticker,
            condition: alert.condition,
            targetPrice: alert.targetPrice,
          }),
        });
        if (r.ok) {
          const d = await r.json() as { alert?: { id: string } };
          serverId = d.alert?.id ?? null;
        }
      } catch { /* fall through to local-only */ }
    }
    const newAlert: PriceAlert = {
      ...alert,
      id: serverId ?? `${Date.now()}-${Math.random()}`,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    saveAlerts([...alertsRef.current, newAlert]);
  };

  const removeAlert = async (id: string) => {
    const u = getAuthUser();
    if (u) {
      try {
        await fetch("/api/alerts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: u.email, token: u.token, id }),
        });
      } catch { /* */ }
    }
    saveAlerts(alertsRef.current.filter(a => a.id !== id));
  };

  const testAlert = async (alert: PriceAlert) => {
    setSendingAlert(alert.id);
    try {
      await fetch("/api/send-alert", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email:alert.email,
          ticker:alert.ticker,
          condition:alert.condition,
          targetPrice:alert.targetPrice,
          currentPrice:prices[alert.ticker]?.price ?? alert.targetPrice,
          test:true,
        }),
      });
      setAlertSent(alert.id);
      setTimeout(()=>setAlertSent(null),3000);
    } catch { /**/ }
    setSendingAlert(null);
  };

  const sortedWatchlist = [...watchlist].sort((a,b)=>(prices[b]?.changePct??0)-(prices[a]?.changePct??0));
  const gainers = watchlist.filter(t=>(prices[t]?.changePct??0)>0).length;
  const losers  = watchlist.filter(t=>(prices[t]?.changePct??0)<0).length;

  /* ---- Push notification state ---------------------------- */
  const [pushEnabled,  setPushEnabled]  = useState(false);
  const [pushLoading,  setPushLoading]  = useState(false);
  const [pushSupported,setPushSupported]= useState(false);

  useEffect(()=>{
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setPushSupported(true);
      // Check if already subscribed
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const togglePush = async () => {
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushEnabled) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        // Remove from server if logged in
        try {
          const auth = localStorage.getItem("arbibx-auth-user");
          if (auth) {
            const { email, token } = JSON.parse(auth) as { email:string; token:string };
            await fetch("/api/push-subscribe", {
              method:"DELETE",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({ email, token }),
            });
          }
        } catch { /**/ }
        setPushEnabled(false);
      } else {
        // Request permission
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setPushLoading(false); return; }

        const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: VAPID_KEY,
        });

        // Save to server if logged in
        try {
          const auth = localStorage.getItem("arbibx-auth-user");
          if (auth) {
            const { email, token } = JSON.parse(auth) as { email:string; token:string };
            await fetch("/api/push-subscribe", {
              method:"POST",
              headers:{"Content-Type":"application/json"},
              body:JSON.stringify({ email, token, subscription: sub.toJSON() }),
            });
          }
        } catch { /**/ }
        setPushEnabled(true);
      }
    } catch (err) { console.error("Push toggle error:", err); }
    setPushLoading(false);
  };

  return (
    <div style={{padding:"20px 16px",maxWidth:1280,margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:V.goldDim,border:`1px solid ${V.goldWire}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Star size={21} color={V.gold}/>
          </div>
          <div>
            <h2 style={{fontSize:19,fontWeight:700,color:V.ink0,margin:0}}>
              {watchlists ? `${(watchlists.lists.find(l=>l.id===watchlists.activeId)?.name ?? "Watchlist")} & Alerts` : "Watchlist & Alerts"}
            </h2>
            <p style={{...mono,color:V.ink4,fontSize:9,margin:0,marginTop:3,textTransform:"uppercase",letterSpacing:"0.08em"}}>
              {watchlist.length} stocks · {alerts.filter(a=>!a.triggered).length} active alerts · {lastUpdate?`Updated ${lastUpdate.toLocaleTimeString()}`:""}
            </p>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          {pushSupported&&(
            <button onClick={togglePush} disabled={pushLoading}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:9,background:pushEnabled?"rgba(0,200,150,0.08)":V.ameDim,border:`1px solid ${pushEnabled?V.gainWire:V.ameWire}`,color:pushEnabled?V.gain:V.ame,cursor:pushLoading?"not-allowed":"pointer",fontSize:12,fontWeight:600,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",opacity:pushLoading?0.6:1}}>
              <Bell size={13}/> {pushLoading?"...":pushEnabled?"Push On":"Push Off"}
            </button>
          )}
          <button onClick={()=>setShowAdd(true)}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:9,background:V.goldDim,border:`1px solid ${V.goldWire}`,color:V.gold,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif"}}>
            <Plus size={13}/> Add Stock
          </button>
          <button onClick={loadPrices} disabled={loading}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:9,background:"rgba(255,255,255,0.03)",border:`1px solid ${V.w1}`,color:V.ink2,cursor:loading?"not-allowed":"pointer",fontSize:12,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",opacity:loading?0.5:1}}>
            <RefreshCw size={12} style={{animation:loading?"spin 1s linear infinite":"none"}}/> Refresh
          </button>
        </div>
      </div>

      {/* Watchlist switcher (only when multi-list state is provided) */}
      {watchlists && onSetActiveList && onAddList && onRenameList && onDeleteList && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${V.w1}` }}>
          <p style={{ ...mono, fontSize: 9, color: V.ink4, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
            Switch list · {watchlists.lists.length} {watchlists.lists.length === 1 ? "list" : "lists"}
          </p>
          <WatchlistSwitcher
            state={watchlists}
            onSetActive={onSetActiveList}
            onAdd={onAddList}
            onRename={onRenameList}
            onDelete={onDeleteList}
          />
        </div>
      )}

      {/* Stats */}
      {watchlist.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
          {[
            {label:"Watching", val:`${watchlist.length}`, color:V.gold, icon:<Star size={13} color={V.gold}/>},
            {label:"Gainers",  val:`${gainers}`,          color:V.gain, icon:<TrendingUp size={13} color={V.gain}/>},
            {label:"Losers",   val:`${losers}`,           color:V.loss, icon:<TrendingDown size={13} color={V.loss}/>},
          ].map(s=>(
            <div key={s.label} style={{...glass({padding:"11px 14px",display:"flex",alignItems:"center",gap:10})}}>
              <div style={{width:28,height:28,borderRadius:7,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.w1}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
              <div>
                <p style={{...mono,fontSize:8,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:2}}>{s.label}</p>
                <p style={{...mono,fontSize:15,fontWeight:600,color:s.color}}>{loading?"--":s.val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty watchlist */}
      {watchlist.length===0&&(
        <div style={{...glass({padding:"48px 32px",textAlign:"center",maxWidth:480,margin:"40px auto"})}}>
          <Star size={40} color={V.ink4} style={{margin:"0 auto 16px"}}/>
          <p style={{fontSize:16,fontWeight:600,color:V.ink0,margin:"0 0 8px"}}>Your watchlist is empty</p>
          <p style={{fontSize:13,color:V.ink3,lineHeight:1.65,margin:"0 0 20px"}}>Add stocks to track prices and get email alerts when they hit your target.</p>
          <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setShowAdd(true)}
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 20px",borderRadius:10,background:"linear-gradient(135deg,#E8A030,#C47820)",border:"none",color:"#fff",fontSize:13,fontWeight:600,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",cursor:"pointer"}}>
              <Plus size={14}/> Add Your First Stock
            </button>
            <button onClick={()=>{
              ["AAPL","NVDA","MSFT","GOOGL","TSLA"].forEach(t => onToggleWatch(t));
            }}
              title="Quickly populate your watchlist with the 5 most-watched tickers"
              style={{display:"inline-flex",alignItems:"center",gap:6,padding:"10px 18px",borderRadius:10,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.w2}`,color:V.ink1,fontSize:13,fontWeight:600,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",cursor:"pointer"}}>
              ⚡ Load popular tickers
            </button>
          </div>
        </div>
      )}

      {/* Watchlist grid */}
      {watchlist.length>0&&(
        <div className="vx-stagger" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))",gap:10,marginBottom:20}}>
          {sortedWatchlist.map(ticker=>{
            const stock=prices[ticker];
            const up=(stock?.changePct??0)>=0;
            const tickerAlerts=alerts.filter(a=>a.ticker===ticker&&!a.triggered);
            return (
              <div key={ticker} style={{...glass({padding:0,overflow:"hidden"})}}>
                <div style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
                    <div>
                      <button onClick={()=>onSelectTicker?.(ticker)}
                        style={{...mono,fontSize:16,fontWeight:700,color:"var(--ticker-blue,#7EB6FF)",background:"none",border:"none",cursor:"pointer",padding:0,display:"block",marginBottom:2}}>
                        {ticker}
                      </button>
                      <p style={{fontSize:11,color:V.ink3,margin:0}}>{TICKER_NAMES[ticker]??ticker}</p>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      {tickerAlerts.length>0&&(
                        <span style={{...mono,fontSize:9,padding:"2px 7px",borderRadius:99,background:V.ameDim,color:V.ame,border:`1px solid ${V.ameWire}`}}>
                          {tickerAlerts.length} alert{tickerAlerts.length>1?"s":""}
                        </span>
                      )}
                      <button onClick={()=>onToggleWatch(ticker)} title="Remove"
                        style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,display:"flex",padding:4,borderRadius:6}}>
                        <X size={14}/>
                      </button>
                    </div>
                  </div>
                  {loading?(
                    <div style={{height:32,background:"rgba(255,255,255,0.04)",borderRadius:6,animation:"shimmer 2s ease-in-out infinite",backgroundSize:"400% 100%"}}/>
                  ):stock?(
                    <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
                      <p style={{...mono,fontSize:24,fontWeight:600,color:V.ink0,letterSpacing:"-0.03em",margin:0}}>{f$(stock.price)}</p>
                      <div style={{textAlign:"right"}}>
                        <p style={{...mono,fontSize:13,fontWeight:600,color:up?V.gain:V.loss,margin:0,display:"flex",alignItems:"center",gap:3,justifyContent:"flex-end"}}>
                          {up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{fp(stock.changePct)}
                        </p>
                        <p style={{...mono,fontSize:9,color:V.ink4,margin:0}}>H: {f$(stock.high)} L: {f$(stock.low)}</p>
                      </div>
                    </div>
                  ):(
                    <p style={{...mono,fontSize:13,color:V.ink4,margin:0}}>No price data</p>
                  )}
                </div>
                <div style={{display:"flex",borderTop:`1px solid ${V.w1}`}}>
                  <button onClick={()=>setAlertTicker(ticker)}
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px",background:"none",border:"none",borderRight:`1px solid ${V.w1}`,cursor:"pointer",color:V.ame,fontSize:11,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",transition:"background 0.15s"}}
                    onMouseEnter={e=>(e.currentTarget.style.background=V.ameDim)}
                    onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                    <Bell size={12}/> Set Alert
                  </button>
                  <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener noreferrer"
                    style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:5,padding:"10px",color:V.arc,fontSize:11,fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",textDecoration:"none",transition:"background 0.15s"}}
                    onMouseEnter={e=>((e.currentTarget as HTMLAnchorElement).style.background=V.arcDim)}
                    onMouseLeave={e=>((e.currentTarget as HTMLAnchorElement).style.background="none")}>
                    <ExternalLink size={12}/> Yahoo
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Price Alerts section */}
      {alerts.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <Bell size={14} color={V.ame}/>
            <h3 style={{fontSize:15,fontWeight:600,color:V.ink0,margin:0}}>Price Alerts</h3>
            <span style={{...mono,fontSize:9,padding:"2px 8px",borderRadius:99,background:V.ameDim,color:V.ame,border:`1px solid ${V.ameWire}`}}>
              {alerts.filter(a=>!a.triggered).length} active
            </span>
          </div>
          <div className="vx-stagger" style={{display:"flex",flexDirection:"column",gap:8}}>
            {alerts.map(alert=>{
              const stock=prices[alert.ticker];
              const pct = stock
                ? ((stock.price - alert.targetPrice) / alert.targetPrice * 100)
                : null;
              // "Close" means within 5% of target in the right direction
              const isClose = pct !== null && !alert.triggered && (
                alert.condition === "above"
                  ? pct > -5 && pct < 0   // approaching from below
                  : pct < 5  && pct > 0   // approaching from above
              );
              return (
                <div key={alert.id} style={{...glass({padding:"14px 16px",borderColor:alert.triggered?V.gainWire:isClose?V.goldWire:V.w2,background:alert.triggered?V.gainDim:"linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)"})}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:10,background:alert.condition==="above"?V.gainDim:V.lossDim,border:`1px solid ${alert.condition==="above"?V.gainWire:V.lossWire}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {alert.condition==="above"?<TrendingUp size={16} color={V.gain}/>:<TrendingDown size={16} color={V.loss}/>}
                      </div>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          <span style={{...mono,fontSize:14,fontWeight:700,color:"var(--ticker-blue,#7EB6FF)"}}>{alert.ticker}</span>
                          <span style={{...mono,fontSize:10,color:alert.condition==="above"?V.gain:V.loss}}>
                            {alert.condition==="above"?"↑ above":"↓ below"} {f$(alert.targetPrice)}
                          </span>
                          {alert.triggered&&(
                            <span style={{...mono,fontSize:9,padding:"2px 7px",borderRadius:99,background:V.gainDim,color:V.gain,border:`1px solid ${V.gainWire}`}}>Triggered ✓</span>
                          )}
                          {isClose&&!alert.triggered&&(
                            <span style={{...mono,fontSize:9,padding:"2px 7px",borderRadius:99,background:V.goldDim,color:V.gold,border:`1px solid ${V.goldWire}`}}>Close!</span>
                          )}
                        </div>
                        <p style={{...mono,fontSize:9,color:V.ink4,margin:0,marginTop:2}}>
                          {alert.email} · {stock?`Current: ${f$(stock.price)}`:"Price unavailable"}
                          {pct!==null?` · ${pct>=0?"+":""}${pct.toFixed(1)}% from target`:""}
                        </p>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      {alert.triggered ? (
                        <button onClick={()=>saveAlerts(alertsRef.current.map(a=>a.id===alert.id?{...a,triggered:false}:a))}
                          style={{...mono,fontSize:10,padding:"6px 12px",borderRadius:8,background:V.goldDim,border:`1px solid ${V.goldWire}`,color:V.gold,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                          ↺ Reset
                        </button>
                      ) : (
                        <button onClick={()=>testAlert(alert)} disabled={!!sendingAlert}
                          style={{...mono,fontSize:10,padding:"6px 12px",borderRadius:8,background:V.arcDim,border:`1px solid ${V.arcWire}`,color:"var(--ticker-blue,#7EB6FF)",cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                          {alertSent===alert.id?<><CheckCircle size={10}/> Sent!</>:sendingAlert===alert.id?"Sending...":<><Mail size={10}/> Test</>}
                        </button>
                      )}
                      <button onClick={()=>removeAlert(alert.id)}
                        style={{...mono,fontSize:10,padding:"6px 12px",borderRadius:8,background:V.lossDim,border:`1px solid ${V.lossWire}`,color:V.loss,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                        <Trash2 size={10}/> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {alertTicker&&prices[alertTicker]&&(
        <AddAlertModal ticker={alertTicker} currentPrice={prices[alertTicker].price} onAdd={addAlert} onClose={()=>setAlertTicker(null)}/>
      )}
      {showAdd&&(
        <AddTickerModal watchlist={watchlist} onAdd={onToggleWatch} onClose={()=>setShowAdd(false)}/>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
      `}</style>
    </div>
  );
}
