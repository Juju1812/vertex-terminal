"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, Star, AlertTriangle, CheckCircle, XCircle, Info, Mail,
} from "lucide-react";

/* ?????? Types ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
interface H  { id:string; ticker:string; shares:number; buyPrice:number; }
interface EH extends H { name:string; cur:number; cost:number; val:number; pnl:number; pct:number; day:number; }

const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";
const SK   = "vertex-my-stocks-v2";

const KNOWN:Record<string,{n:string;p:number;d:number}>={
  AAPL:{n:"Apple Inc.",           p:228.52,d: 1.42}, MSFT:{n:"Microsoft Corp.",     p:415.32,d:-.52},
  NVDA:{n:"NVIDIA Corp.",         p:875.42,d: 2.90}, GOOGL:{n:"Alphabet Inc.",       p:178.94,d: .81},
  META:{n:"Meta Platforms",       p:554.78,d: 1.63}, TSLA:{n:"Tesla Inc.",           p:248.50,d:-3.58},
  AMZN:{n:"Amazon.com Inc.",      p:201.17,d:-.44},  AMD: {n:"Advanced Micro Dev.",  p:162.34,d: 3.72},
  PLTR:{n:"Palantir Technologies",p: 38.92,d: 4.96}, JPM: {n:"JPMorgan Chase",       p:224.31,d: .50},
  V:   {n:"Visa Inc.",            p:296.14,d: .83},  UNH: {n:"UnitedHealth Group",   p:512.88,d:-.81},
  LLY: {n:"Eli Lilly & Co.",      p:798.44,d: 1.24}, AVGO:{n:"Broadcom Inc.",        p:1642.33,d:1.11},
  CRM: {n:"Salesforce Inc.",      p:299.11,d: .68},  ORCL:{n:"Oracle Corp.",         p:142.67,d: .92},
};

async function pg<T>(p:string):Promise<T|null>{try{const r=await fetch(`${BASE}${p}${p.includes("?")?"&":"?"}apiKey=${KEY}`);return r.ok?r.json():null;}catch{return null;}}

async function fetchPrices(tks:string[]):Promise<Record<string,{p:number;d:number;n:string}>>{
  if(!tks.length)return{};
  const data=await pg<{tickers?:Array<{ticker:string;day:{c:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tks.join(",")}`);
  const res:Record<string,{p:number;d:number;n:string}>={};
  tks.forEach(t=>{
    const s=data?.tickers?.find(x=>x.ticker===t),k=KNOWN[t];
    if(s?.day?.c&&s?.prevDay?.c){const p=s.day.c;res[t]={p,d:+((p-s.prevDay.c)/s.prevDay.c*100).toFixed(2),n:k?.n??t};}
    else if(k){res[t]={p:k.p,d:k.d,n:k.n};}
    else{res[t]={p:0,d:0,n:t};}
  });
  return res;
}

interface Grade {
  letter:string; score:number; summary:string;
  strengths:string[]; weaknesses:string[]; tips:string[];
  divScore: number;       // 0???100 diversification
  volatility: string;     // Low / Medium / High / Very High
  winRate: number;        // % profitable positions
  maxDrawdown: number;    // largest single loss %
  concentration: number;  // largest position weight %
}

function grade(h:EH[]):Grade{
  if(!h.length)return{letter:"N/A",score:0,summary:"Add positions to receive a portfolio analysis.",strengths:[],weaknesses:[],tips:["Add at least 3 positions to begin."],divScore:0,volatility:"???",winRate:0,maxDrawdown:0,concentration:0};
  let s=50;const st:string[]=[],wk:string[]=[],tp:string[]=[];
  const n=h.length;

  // Diversification
  if(n>=8){s+=15;st.push(`Strong diversification across ${n} positions.`);}
  else if(n>=5){s+=8;st.push(`Reasonable spread across ${n} positions.`);}
  else if(n<3){s-=10;wk.push("High concentration ??? under 3 positions.");tp.push("Add 3???5 more positions across different sectors.");}

  // Win rate
  const winners=h.filter(x=>x.pct>0).length;
  const wr=winners/n;
  if(wr>.7){s+=15;st.push(`${(wr*100).toFixed(0)}% of positions are profitable.`);}
  else if(wr>.5)s+=7;
  else if(wr<.35){s-=12;wk.push(`${Math.round((1-wr)*100)}% of positions are underwater.`);tp.push("Review losers ??? trim positions down more than 15%.");}

  // Avg return
  const avg=h.reduce((x,y)=>x+y.pct,0)/n;
  if(avg>20){s+=15;st.push(`Exceptional avg return of +${avg.toFixed(1)}%.`);}
  else if(avg>10){s+=10;st.push(`Solid avg return of +${avg.toFixed(1)}%.`);}
  else if(avg>0)s+=4;
  else if(avg<-10){s-=15;wk.push(`Portfolio averaging ${avg.toFixed(1)}%.`);tp.push("Reallocate from laggards to stronger momentum names.");}
  else if(avg<0)s-=6;

  // Concentration
  const tv=h.reduce((x,y)=>x+y.val,0);
  const weights=h.map(x=>+(x.val/tv*100).toFixed(1));
  const maxW=Math.max(...weights);
  if(maxW>40){s-=8;wk.push(`Top position is ${maxW.toFixed(0)}% of portfolio.`);tp.push("Trim largest position to below 25%.");}
  else if(maxW<25){s+=6;st.push("No single position dominates ??? balanced weighting.");}

  // Sector concentration
  const tech=["NVDA","MSFT","AAPL","META","GOOGL","AMD","PLTR","ORCL","CRWD","CRM","AVGO"];
  const tp2=h.filter(x=>tech.includes(x.ticker)).length/n;
  if(tp2>.8){s-=6;wk.push("Heavy tech concentration ??? sector rotation risk.");tp.push("Add Financials, Healthcare, or Consumer exposure.");}
  else if(tp2<.5){s+=5;st.push("Good cross-sector exposure.");}

  s=Math.min(100,Math.max(0,Math.round(s)));
  const L=s>=95?"A+":s>=90?"A":s>=85?"A-":s>=80?"B+":s>=75?"B":s>=70?"B-":s>=65?"C+":s>=60?"C":s>=55?"C-":s>=50?"D+":s>=45?"D":"F";
  const sum=s>=85?"Outstanding ??? excellent diversification and strong risk-adjusted returns.":s>=70?"Strong portfolio with targeted areas to optimize.":s>=55?"Average ??? notable risk factors need addressing.":"Below par ??? significant restructuring recommended.";
  if(!tp.length)tp.push("Continue monitoring and rebalance quarterly.");

  // Risk metrics
  const divScore = Math.min(100, Math.round(
    (Math.min(n,10)/10)*40 + (1-tp2)*30 + (maxW<25?30:maxW<35?20:10)
  ));

  // Volatility estimate from daily change spread
  const dayChanges = h.map(x => Math.abs(x.day));
  const avgDayChg = dayChanges.reduce((a,b)=>a+b,0) / (dayChanges.length||1);
  const volatility = avgDayChg > 3 ? "Very High" : avgDayChg > 1.8 ? "High" : avgDayChg > 0.9 ? "Medium" : "Low";

  // Max drawdown = worst single position loss
  const maxDrawdown = Math.min(0, Math.min(...h.map(x => x.pct)));

  return{letter:L,score:s,summary:sum,strengths:st,weaknesses:wk,tips:tp,divScore,volatility,winRate:Math.round(wr*100),maxDrawdown,concentration:maxW};
}

const f$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fp=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;
const gc=(l:string)=>l.startsWith("A")?"#00C896":l.startsWith("B")?"#4F8EF7":l.startsWith("C")?"#E8A030":l.startsWith("D")?"#F97316":"#E8445A";

/* ?????? Design tokens ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */
const V={
  d0:"#050810",d1:"#080D18",d2:"#0C1220",d3:"#101828",d4:"#151F30",dh:"#1E2D40",
  w1:"rgba(130,180,255,0.055)",w2:"rgba(130,180,255,0.10)",w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF",ink1:"#C8D5E8",ink2:"#7A9CBF",ink3:"#3D5A7A",ink4:"#1F3550",
  gain:"#00C896",gainDim:"rgba(0,200,150,0.08)",gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A",lossDim:"rgba(232,68,90,0.08)",lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030",ame:"#9B72F5",ameWire:"rgba(155,114,245,0.22)",
};
const mono:React.CSSProperties={fontFamily:"'Geist Mono','Courier New',monospace"};
const glass=(ex?:React.CSSProperties):React.CSSProperties=>({background:"linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",backdropFilter:"blur(24px) saturate(1.5)",WebkitBackdropFilter:"blur(24px) saturate(1.5)",border:`1px solid ${V.w2}`,borderRadius:16,boxShadow:"0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",position:"relative" as const,overflow:"hidden",...ex});

/* ?????? Email Alerts Component ???????????????????????????????????????????????????????????????????????????????????????????????? */
function EmailAlerts() {
  const [email,    setEmail]    = useState("");
  const [status,   setStatus]   = useState<"idle"|"loading"|"success"|"error">("idle");
  const [errMsg,   setErrMsg]   = useState("");
  const [subEmail, setSubEmail] = useState<string|null>(null);

  // Persist subscription in localStorage
  useEffect(() => {
    try { const s = localStorage.getItem("arbibx-alert-email"); if (s) setSubEmail(s); } catch { /**/ }
  }, []);

  const subscribe = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrMsg("Please enter a valid email address."); return;
    }
    setStatus("loading"); setErrMsg("");
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json() as { success?: boolean; error?: string };
      if (d.success) {
        setStatus("success");
        setSubEmail(email);
        try { localStorage.setItem("arbibx-alert-email", email); } catch { /**/ }
        setEmail("");
      } else {
        setStatus("error"); setErrMsg(d.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error"); setErrMsg("Network error ??? please try again.");
    }
  };

  const unsubscribe = () => {
    setSubEmail(null); setStatus("idle");
    try { localStorage.removeItem("arbibx-alert-email"); } catch { /**/ }
  };

  return (
    <div style={{ ...glass({ padding:0, marginTop:0 }) }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"20px 24px", borderBottom:`1px solid ${V.w1}` }}>
        <div style={{ width:38, height:38, borderRadius:10, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Mail size={18} color={V.ame} />
        </div>
        <div>
          <p style={{ fontSize:14, fontWeight:600, color:V.ink0, margin:0 }}>AI Trade Alerts</p>
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>
            Email notifications when signals fire
          </p>
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
          /* Already subscribed */
          <div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 16px", borderRadius:10, background:"rgba(0,200,150,0.06)", border:`1px solid rgba(0,200,150,0.18)`, marginBottom:16 }}>
              <CheckCircle size={16} color={V.gain} style={{ flexShrink:0, marginTop:1 }} />
              <div>
                <p style={{ fontSize:13, color:V.ink0, fontWeight:500, margin:"0 0 2px" }}>Alerts active</p>
                <p style={{ ...mono, fontSize:11, color:V.ink2, margin:0 }}>{subEmail}</p>
              </div>
            </div>

            <p style={{ fontSize:12, color:V.ink3, lineHeight:1.65, marginBottom:16 }}>
              You'll receive an email when our AI detects a high-confidence signal to buy, add to, or exit a position in any of the tracked stocks.
            </p>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              {[
                { label:"Buy Signal",     desc:"Confidence 80%+",        color:V.gain,    bg:"rgba(0,200,150,0.07)",    border:"rgba(0,200,150,0.18)" },
                { label:"Add to Position",desc:"Strong momentum",         color:"#7EB6FF", bg:"rgba(79,142,247,0.07)",   border:"rgba(79,142,247,0.18)" },
                { label:"Sell Signal",    desc:"Exit recommended",        color:V.loss,    bg:"rgba(232,68,90,0.07)",    border:"rgba(232,68,90,0.18)" },
                { label:"Risk Alert",     desc:"Concentration too high",  color:V.gold,    bg:"rgba(232,160,48,0.07)",   border:"rgba(232,160,48,0.18)" },
              ].map(a => (
                <div key={a.label} style={{ padding:"12px 14px", borderRadius:9, background:a.bg, border:`1px solid ${a.border}` }}>
                  <p style={{ ...mono, fontSize:9, color:a.color, textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 3px", fontWeight:600 }}>{a.label}</p>
                  <p style={{ fontSize:11, color:V.ink3, margin:0 }}>{a.desc}</p>
                </div>
              ))}
            </div>

            <button onClick={unsubscribe}
              style={{ ...mono, fontSize:10, color:V.ink3, background:"none", border:`1px solid ${V.w1}`, borderRadius:7, padding:"6px 12px", cursor:"pointer", transition:"all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = V.lossWire; e.currentTarget.style.color = V.loss; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V.w1;      e.currentTarget.style.color = V.ink3; }}>
              Unsubscribe
            </button>
          </div>
        ) : (
          /* Subscribe form */
          <div>
            <p style={{ fontSize:13, color:V.ink2, lineHeight:1.65, marginBottom:18 }}>
              Get emailed the moment our AI fires a high-confidence trade signal ??? buy, add, or sell ??? on any stock we track.
            </p>

            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrMsg(""); setStatus("idle"); }}
                onKeyDown={e => e.key === "Enter" && subscribe()}
                placeholder="your@email.com"
                style={{ flex:1, minWidth:180, background:"rgba(255,255,255,0.04)", border:`1px solid ${errMsg ? V.lossWire : V.w2}`, borderRadius:9, color:V.ink0, fontFamily:"'Geist Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none", transition:"border-color 0.2s" }}
              />
              <button onClick={subscribe} disabled={status === "loading"}
                style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 20px", borderRadius:9, background:"linear-gradient(135deg,rgba(155,114,245,0.20),rgba(155,114,245,0.10))", border:`1px solid ${V.ameWire}`, color:V.ame, cursor: status === "loading" ? "not-allowed" : "pointer", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", transition:"all 0.2s", opacity: status === "loading" ? 0.7 : 1, whiteSpace:"nowrap" }}>
                <Mail size={14} />
                {status === "loading" ? "Sending..." : "Subscribe"}
              </button>
            </div>

            {errMsg && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(232,68,90,0.07)", border:`1px solid ${V.lossWire}`, marginBottom:12 }}>
                <XCircle size={13} color={V.loss} />
                <span style={{ fontSize:12, color:V.loss }}>{errMsg}</span>
              </div>
            )}

            {status === "success" && (
              <div style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 12px", borderRadius:8, background:"rgba(0,200,150,0.07)", border:`1px solid ${V.gainWire}`, marginBottom:12 }}>
                <CheckCircle size={13} color={V.gain} />
                <span style={{ fontSize:12, color:V.gain }}>Check your inbox for a confirmation email!</span>
              </div>
            )}

            <p style={{ fontSize:11, color:V.ink4, lineHeight:1.6, margin:0 }}>
              No spam. Unsubscribe any time. Not investment advice.
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes live-pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  );
}

export default function MyStocks(){
  const [holdings,setH]=useState<H[]>([]);
  const [prices,setP]=useState<Record<string,{p:number;d:number;n:string}>>({});
  const [loading,setL]=useState(false);
  const [ts,setTs]=useState<Date|null>(null);
  const [ticker,setTicker]=useState(""), [shares,setShares]=useState(""), [bp,setBp]=useState(""), [err,setErr]=useState("");

  useEffect(()=>{try{const s=localStorage.getItem(SK);if(s)setH(JSON.parse(s));}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(SK,JSON.stringify(holdings));}catch{}},[holdings]);

  const fetchAll=useCallback(async()=>{
    if(!holdings.length)return;
    setL(true);
    setP(await fetchPrices([...new Set(holdings.map(h=>h.ticker))]));
    setTs(new Date());setL(false);
  },[holdings]);
  useEffect(()=>{fetchAll();},[fetchAll]);

  const add=()=>{
    const t=ticker.trim().toUpperCase(),s=parseFloat(shares),b=parseFloat(bp);
    if(!t)return setErr("Enter a ticker symbol.");
    if(!s||s<=0)return setErr("Enter a valid share count.");
    if(!b||b<=0)return setErr("Enter a valid buy price.");
    setH(prev=>[...prev,{id:`${Date.now()}-${Math.random()}`,ticker:t,shares:s,buyPrice:b}]);
    setTicker("");setShares("");setBp("");setErr("");
  };

  const enriched:EH[]=holdings.map(h=>{
    const p=prices[h.ticker];
    const cur=p?.p||h.buyPrice,cost=h.shares*h.buyPrice,val=h.shares*cur;
    return{...h,name:p?.n||KNOWN[h.ticker]?.n||h.ticker,cur,cost,val,pnl:val-cost,pct:((cur-h.buyPrice)/h.buyPrice)*100,day:p?.d||0};
  });

  const tv=enriched.reduce((s,h)=>s+h.val,0),tc=enriched.reduce((s,h)=>s+h.cost,0);
  const tp=tc>0?(tv-tc)/tc*100:0;
  const g=grade(enriched), gc_=gc(g.letter);

  return(
    <div style={{padding:"24px 16px",maxWidth:1280,margin:"0 auto",animation:"vx-rise 0.35s cubic-bezier(0.16,1,0.3,1) both"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div style={{width:42,height:42,borderRadius:12,background:"rgba(155,114,245,0.12)",border:`1px solid ${V.ameWire}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(155,114,245,0.12)"}}>
            <BookOpen size={21} color={V.ame}/>
          </div>
          <div>
            <h2 style={{fontSize:19,fontWeight:700,color:V.ink0,margin:0,letterSpacing:"-0.01em"}}>My Portfolio</h2>
            <p style={{...mono,color:V.ink4,fontSize:9,margin:0,marginTop:3,textTransform:"uppercase",letterSpacing:"0.08em"}}>Holdings ?? P&L ?? AI Grade</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {ts&&<span style={{...mono,color:V.ink4,fontSize:9}}>{ts.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading||!holdings.length} className="vx-btn vx-btn-ghost" style={{fontFamily:"'Bricolage Grotesque',system-ui,sans-serif"}}>
            <RefreshCw size={12} style={{animation:loading?"spin 1s linear infinite":"none"}}/>Refresh
          </button>
        </div>
      </div>

      {/* Add form */}
      <div style={{...glass({padding:22}),marginBottom:20}}>
        <div style={{position:"absolute",top:-30,right:-20,width:160,height:160,borderRadius:"50%",background:"rgba(79,142,247,0.05)",filter:"blur(40px)",pointerEvents:"none"}}/>
        <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:14,position:"relative"}}>Add Position</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,alignItems:"end",position:"relative"}}>
          {[
            {l:"Ticker",v:ticker,set:(x:string)=>setTicker(x.toUpperCase()),p:"AAPL",t:"text"},
            {l:"Shares",v:shares,set:setShares,p:"10",t:"number"},
            {l:"Buy Price ($)",v:bp,set:setBp,p:"180.00",t:"number"},
          ].map(f=>(
            <div key={f.l}>
              <label style={{...mono,fontSize:8,color:V.ink4,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.1em"}}>{f.l}</label>
              <input value={f.v} onChange={e=>f.set(e.target.value)} placeholder={f.p} type={f.t} min={f.t==="number"?"0.001":undefined} step={f.t==="number"?"any":undefined}
                className="vx-input" onKeyDown={e=>e.key==="Enter"&&add()}/>
            </div>
          ))}
          <button onClick={add} className="vx-btn vx-btn-arc" style={{fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",fontWeight:600,minHeight:44,justifyContent:"center"}}>
            <Plus size={15}/> Add
          </button>
        </div>
        {err&&<p style={{...mono,color:V.loss,fontSize:11,marginTop:10}}>??? {err}</p>}
      </div>

      {holdings.length>0&&(
        <>
          {/* Summary strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:18}}>
            {[
              {l:"Portfolio Value",v:f$(tv),c:V.ink0},
              {l:"Total Cost",     v:f$(tc),c:V.ink2},
              {l:"Unrealized P&L", v:f$(tv-tc),c:tv>=tc?V.gain:V.loss},
              {l:"Total Return",   v:fp(tp),c:tp>=0?V.gain:V.loss},
            ].map(s=>(
              <div key={s.l} style={{...glass({padding:"14px 18px"})}}>
                <p style={{...mono,color:V.ink4,fontSize:8,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:5}}>{s.l}</p>
                <p style={{...mono,fontSize:"clamp(17px,3.5vw,24px)",fontWeight:500,color:s.c,letterSpacing:"-0.025em"}}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div style={{...glass({overflow:"hidden"}),marginBottom:18}}>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${V.w1}`}}>
                    {["Ticker","Company","Shares","Buy","Current","Value","P&L","Return","Today",""].map(h=>(
                      <th key={h} style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.09em",padding:"11px 12px",textAlign:h===""?"center":"left",fontWeight:400,whiteSpace:"nowrap",background:"rgba(5,8,16,0.7)"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(h=>{
                    const up=h.pct>=0,du=h.day>=0;
                    return(
                      <tr key={h.id} style={{borderBottom:`1px solid rgba(130,180,255,0.04)`,transition:"background 0.15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=V.dh}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:13,fontWeight:500,color:"#7EB6FF",letterSpacing:"-0.01em"}}>{h.ticker}</span></td>
                        <td style={{padding:"12px 12px",fontSize:12,color:V.ink2,maxWidth:140}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{h.name}</span></td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12,color:V.ink1}}>{h.shares.toLocaleString()}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12,color:V.ink2}}>{f$(h.buyPrice)}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:13,fontWeight:500,color:V.ink0}}>{h.cur>0?f$(h.cur):"???"}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12,color:V.ink1}}>{f$(h.val)}</td>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:12,color:up?V.gain:V.loss,fontWeight:500}}>{up?"+":""}{f$(h.pnl)}</span></td>
                        <td style={{padding:"12px 12px"}}>
                          <span style={{...mono,fontSize:11,padding:"2px 8px",borderRadius:6,background:up?V.gainDim:V.lossDim,color:up?V.gain:V.loss,border:`1px solid ${up?V.gainWire:V.lossWire}`,display:"inline-flex",alignItems:"center",gap:3}}>
                            {up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{fp(h.pct)}
                          </span>
                        </td>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:11,color:du?V.gain:V.loss}}>{fp(h.day)}</span></td>
                        <td style={{padding:"12px 12px",textAlign:"center"}}>
                          <button onClick={()=>setH(prev=>prev.filter(x=>x.id!==h.id))}
                            style={{background:"none",border:"none",cursor:"pointer",color:V.ink4,padding:4,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",minWidth:32,minHeight:32,transition:"color 0.15s"}}
                            onMouseEnter={e=>e.currentTarget.style.color=V.loss}
                            onMouseLeave={e=>e.currentTarget.style.color=V.ink4}>
                            <Trash2 size={13}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
              AI PORTFOLIO GRADE ??? enhanced
          ?????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????? */}
          <div style={{...glass({overflow:"hidden"})}}>

            {/* ?????? Top ambient glow matching grade color ?????? */}
            <div style={{position:"absolute",top:-60,left:"50%",transform:"translateX(-50%)",width:300,height:200,borderRadius:"50%",background:`radial-gradient(ellipse, ${gc_}14 0%, transparent 70%)`,pointerEvents:"none",zIndex:0}}/>

            {/* ?????? Grade hero ?????? */}
            <div style={{position:"relative",zIndex:1,display:"flex",flexWrap:"wrap",borderBottom:`1px solid ${V.w1}`}}>

              {/* Big letter */}
              <div style={{padding:"28px 32px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${V.w1}`,minWidth:120,flexShrink:0,background:`radial-gradient(circle at 50% 40%, ${gc_}10, transparent 70%)`}}>
                <p style={{...mono,fontSize:8,color:gc_,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:8,opacity:.8}}>AI Grade</p>
                <p style={{fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",fontSize:62,fontWeight:700,lineHeight:1,color:gc_,textShadow:`0 0 48px ${gc_}60, 0 0 12px ${gc_}30`,letterSpacing:"-0.04em"}}>{g.letter}</p>
                <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8}}>
                  <div style={{width:36,height:3,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${g.score}%`,background:gc_,borderRadius:99}}/>
                  </div>
                  <p style={{...mono,fontSize:9,color:gc_,opacity:.75}}>{g.score}</p>
                </div>
              </div>

              {/* Summary + score bar */}
              <div style={{flex:1,padding:"22px 24px",minWidth:200,position:"relative",zIndex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <Star size={14} color={gc_} fill={gc_}/>
                  <span style={{fontSize:15,fontWeight:700,color:V.ink0}}>AI Portfolio Analysis</span>
                </div>
                <p style={{color:V.ink2,fontSize:13,lineHeight:1.7,marginBottom:16}}>{g.summary}</p>
                {/* Segmented score bar */}
                <div style={{position:"relative",height:6,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden",marginBottom:6}}>
                  <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${g.score}%`,background:`linear-gradient(90deg,${gc_}70,${gc_})`,borderRadius:99,transition:"width 1.4s cubic-bezier(0.16,1,0.3,1)",boxShadow:`0 0 8px ${gc_}50`}}/>
                  {/* Grade zone markers */}
                  {[45,55,65,70,75,80,85,90,95].map(mark=>(
                    <div key={mark} style={{position:"absolute",left:`${mark}%`,top:0,bottom:0,width:1,background:"rgba(255,255,255,0.08)"}}/>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>F</span>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>D</span>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>C</span>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>B</span>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>A</span>
                  <span style={{...mono,fontSize:8,color:V.ink4}}>A+</span>
                </div>
              </div>
            </div>

            {/* ?????? Risk metrics strip ?????? */}
            <div style={{position:"relative",zIndex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",borderBottom:`1px solid ${V.w1}`}}>
              {[
                {
                  label: "Diversification",
                  value: `${g.divScore}/100`,
                  sub: g.divScore >= 70 ? "Well diversified" : g.divScore >= 45 ? "Moderate" : "Concentrated",
                  color: g.divScore >= 70 ? V.gain : g.divScore >= 45 ? V.gold : V.loss,
                  bar: g.divScore,
                },
                {
                  label: "Volatility",
                  value: g.volatility,
                  sub: g.volatility === "Low" ? "Stable" : g.volatility === "Medium" ? "Normal range" : "Elevated risk",
                  color: g.volatility === "Low" ? V.gain : g.volatility === "Medium" ? V.gold : V.loss,
                  bar: g.volatility === "Low" ? 25 : g.volatility === "Medium" ? 55 : g.volatility === "High" ? 78 : 95,
                },
                {
                  label: "Win Rate",
                  value: `${g.winRate}%`,
                  sub: `${enriched.filter(x=>x.pct>0).length} of ${enriched.length} profitable`,
                  color: g.winRate >= 60 ? V.gain : g.winRate >= 40 ? V.gold : V.loss,
                  bar: g.winRate,
                },
                {
                  label: "Top Concentration",
                  value: `${g.concentration.toFixed(1)}%`,
                  sub: g.concentration < 25 ? "Balanced" : g.concentration < 40 ? "Moderate" : "Overweight",
                  color: g.concentration < 25 ? V.gain : g.concentration < 40 ? V.gold : V.loss,
                  bar: Math.min(100, g.concentration * 2),
                },
                {
                  label: "Max Drawdown",
                  value: g.maxDrawdown < -0.01 ? `${g.maxDrawdown.toFixed(1)}%` : "None",
                  sub: g.maxDrawdown < -15 ? "Review position" : g.maxDrawdown < -5 ? "Monitor closely" : "Within tolerance",
                  color: g.maxDrawdown < -15 ? V.loss : g.maxDrawdown < -5 ? V.gold : V.gain,
                  bar: Math.min(100, Math.abs(g.maxDrawdown) * 4),
                },
              ].map((m, i, arr) => (
                <div key={m.label} style={{padding:"16px 18px",borderRight:i<arr.length-1?`1px solid ${V.w1}`:"none"}}>
                  <p style={{...mono,fontSize:8,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>{m.label}</p>
                  <p style={{...mono,fontSize:16,fontWeight:500,color:m.color,letterSpacing:"-0.02em",marginBottom:3}}>{m.value}</p>
                  <p style={{fontSize:10,color:V.ink3,marginBottom:8}}>{m.sub}</p>
                  {/* Mini bar */}
                  <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${m.bar}%`,background:m.color,borderRadius:99,transition:"width 1s cubic-bezier(0.16,1,0.3,1)",opacity:.75}}/>
                  </div>
                </div>
              ))}
            </div>

            {/* ?????? Three-column analysis ?????? */}
            <div style={{position:"relative",zIndex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
              {[
                {t:"Strengths",  c:V.gain,   icon:<CheckCircle size={11} color={V.gain}/>,  items:g.strengths,  sym:"???", empty:"None identified yet."},
                {t:"Weaknesses", c:V.loss,   icon:<XCircle     size={11} color={V.loss}/>,  items:g.weaknesses, sym:"!", empty:"No major issues."},
                {t:"Suggestions",c:"#7EB6FF",icon:<Info        size={11} color="#7EB6FF"/>, items:g.tips,       sym:"???", empty:"Keep monitoring."},
              ].map((col,ci)=>(
                <div key={col.t} style={{padding:"18px 20px",borderRight:ci<2?`1px solid ${V.w1}`:"none",borderTop:`1px solid ${V.w1}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    {col.icon}
                    <span style={{...mono,fontSize:9,fontWeight:500,color:col.c,textTransform:"uppercase",letterSpacing:"0.1em"}}>{col.t}</span>
                  </div>
                  {col.items.length ? col.items.map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:9,marginBottom:9}}>
                      <span style={{color:col.c,fontSize:12,marginTop:1,flexShrink:0,opacity:.9}}>{col.sym}</span>
                      <span style={{fontSize:12,color:V.ink2,lineHeight:1.6}}>{s}</span>
                    </div>
                  )) : <p style={{fontSize:12,color:V.ink4}}>{col.empty}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ?????? AI Email Alerts ?????? */}
      <EmailAlerts />

      {!holdings.length&&(
        <div style={{...glass({padding:60,textAlign:"center"})}}>
          <div style={{width:56,height:56,borderRadius:14,background:"rgba(155,114,245,0.08)",border:`1px solid ${V.ameWire}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <BookOpen size={26} color={V.ame}/>
          </div>
          <p style={{fontSize:16,fontWeight:600,color:V.ink0,marginBottom:6}}>No positions yet</p>
          <p style={{color:V.ink3,fontSize:13}}>Add your first position above to start tracking and receive an AI portfolio grade.</p>
        </div>
      )}

      <style>{`
        @keyframes vx-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
