"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, BookOpen, Star, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

interface H  { id:string; ticker:string; shares:number; buyPrice:number; }
interface EH extends H { name:string; cur:number; cost:number; val:number; pnl:number; pct:number; day:number; }
interface Grade { letter:string; score:number; summary:string; strengths:string[]; weaknesses:string[]; tips:string[]; }

const KEY="1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr", BASE="https://api.polygon.io", SK="vertex-my-stocks";

const KNOWN:Record<string,{name:string;price:number;day:number}>={
  AAPL:{name:"Apple Inc.",            price:228.52,day: 1.42},MSFT:{name:"Microsoft Corp.",   price:415.32,day:-.52},
  NVDA:{name:"NVIDIA Corp.",          price:875.42,day: 2.90},GOOGL:{name:"Alphabet Inc.",     price:178.94,day: .81},
  META:{name:"Meta Platforms",        price:554.78,day: 1.63},TSLA:{name:"Tesla Inc.",         price:248.50,day:-3.58},
  AMZN:{name:"Amazon.com Inc.",       price:201.17,day:-.44}, AMD:{name:"Advanced Micro Dev.", price:162.34,day: 3.72},
  PLTR:{name:"Palantir Technologies", price: 38.92,day: 4.96},JPM:{name:"JPMorgan Chase",      price:224.31,day: .50},
  V:   {name:"Visa Inc.",             price:296.14,day: .83}, UNH:{name:"UnitedHealth Group",  price:512.88,day:-.81},
  LLY: {name:"Eli Lilly & Co.",       price:798.44,day: 1.24},AVGO:{name:"Broadcom Inc.",      price:1642.33,day:1.11},
  CRM: {name:"Salesforce Inc.",       price:299.11,day: .68},
};

async function pg<T>(p:string):Promise<T|null>{try{const r=await fetch(`${BASE}${p}${p.includes("?")?"&":"?"}apiKey=${KEY}`);return r.ok?r.json():null;}catch{return null;}}

async function fetchPrices(tickers:string[]):Promise<Record<string,{price:number;day:number;name:string}>>{
  if(!tickers.length)return{};
  const data=await pg<{tickers?:Array<{ticker:string;day:{c:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}`);
  const res:Record<string,{price:number;day:number;name:string}>={};
  tickers.forEach(t=>{
    const s=data?.tickers?.find(x=>x.ticker===t),k=KNOWN[t];
    if(s?.day?.c&&s?.prevDay?.c){const p=s.day.c;res[t]={price:p,day:+((p-s.prevDay.c)/s.prevDay.c*100).toFixed(2),name:k?.name??t};}
    else if(k){res[t]={price:k.price,day:k.day,name:k.name};}
    else{res[t]={price:0,day:0,name:t};}
  });
  return res;
}

function gradePortfolio(h:EH[]):Grade{
  if(!h.length)return{letter:"N/A",score:0,summary:"Add holdings to receive an analysis.",strengths:[],weaknesses:[],tips:["Add at least 3 positions to begin grading."]};
  let s=50;const strengths:string[]=[],weaknesses:string[]=[],tips:string[]=[];
  const n=h.length;
  if(n>=8){s+=15;strengths.push(`Strong diversification across ${n} positions.`);}
  else if(n>=5){s+=8;strengths.push(`Reasonable spread across ${n} positions.`);}
  else if(n<3){s-=10;weaknesses.push("High concentration risk — under 3 positions.");tips.push("Add 3–5 more positions across different sectors.");}
  const wr=h.filter(x=>x.pct>0).length/n;
  if(wr>.7){s+=15;strengths.push(`${(wr*100).toFixed(0)}% of positions are profitable.`);}
  else if(wr>.5)s+=7;
  else if(wr<.35){s-=12;weaknesses.push(`${Math.round((1-wr)*100)}% of positions are underwater.`);tips.push("Review losing positions — trim those down >15%.");}
  const avg=h.reduce((x,y)=>x+y.pct,0)/n;
  if(avg>20){s+=15;strengths.push(`Exceptional avg return of +${avg.toFixed(1)}%.`);}
  else if(avg>10){s+=10;strengths.push(`Solid avg return of +${avg.toFixed(1)}%.`);}
  else if(avg>0)s+=4;
  else if(avg<-10){s-=15;weaknesses.push(`Portfolio is averaging ${avg.toFixed(1)}%.`);tips.push("Consider reallocating from laggards to momentum leaders.");}
  else if(avg<0)s-=6;
  const tv=h.reduce((x,y)=>x+y.val,0),max=Math.max(...h.map(x=>(x.val/tv)*100));
  if(max>40){s-=8;weaknesses.push(`Largest position is ${max.toFixed(0)}% of portfolio.`);tips.push("Trim your top position to below 25% to reduce idiosyncratic risk.");}
  else if(max<25){s+=6;strengths.push("No single position dominates — well-balanced weight distribution.");}
  const tech=["NVDA","MSFT","AAPL","META","GOOGL","AMD","PLTR","ORCL","CRWD","CRM","AVGO"];
  const tp=h.filter(x=>tech.includes(x.ticker)).length/n;
  if(tp>.8){s-=6;weaknesses.push("Heavy tech concentration — sector rotation risk.");tips.push("Add Financials, Healthcare, or Consumer exposure.");}
  else if(tp<.5){s+=5;strengths.push("Good cross-sector diversification.");}
  s=Math.min(100,Math.max(0,Math.round(s)));
  const L=s>=95?"A+":s>=90?"A":s>=85?"A-":s>=80?"B+":s>=75?"B":s>=70?"B-":s>=65?"C+":s>=60?"C":s>=55?"C-":s>=50?"D+":s>=45?"D":"F";
  const summary=s>=85?"Outstanding — exceptional diversification and performance.":s>=70?"Strong portfolio with targeted areas to optimize.":s>=55?"Average — several risk factors need addressing.":"Below par — structural changes recommended.";
  if(!tips.length)tips.push("Continue monitoring momentum and rebalance quarterly.");
  return{letter:L,score:s,summary,strengths,weaknesses,tips};
}

const f$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fp=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;
const gc=(l:string)=>l.startsWith("A")?"#10B981":l.startsWith("B")?"#3B82F6":l.startsWith("C")?"#F59E0B":l.startsWith("D")?"#F97316":"#F43F5E";

const C={
  bgBase:"#060B14",bgRaised:"#0A1220",bgElevated:"#0F1A2B",bgOverlay:"#142035",bgHover:"#18273D",
  bs:"rgba(100,160,220,0.11)",bm:"rgba(100,160,220,0.18)",
  text:"#EEF3FA",textSec:"#7A9DBF",textMuted:"#3D5A7A",
  em:"#10B981",emB:"#34D399",emD:"rgba(16,185,129,0.10)",emBorder:"rgba(16,185,129,0.20)",
  cr:"#F43F5E",crB:"#FB7185",crD:"rgba(244,63,94,0.10)",crBorder:"rgba(244,63,94,0.20)",
  sap:"#3B82F6",gold:"#F59E0B",am:"#8B5CF6",
};
const card=(ex?:React.CSSProperties):React.CSSProperties=>({background:C.bgRaised,border:`1px solid ${C.bs}`,borderRadius:14,boxShadow:"0 4px 16px rgba(0,0,0,0.4)",...ex});
const mono={fontFamily:"'JetBrains Mono','Courier New',monospace"} as React.CSSProperties;

export default function MyStocks(){
  const [holdings,setH]=useState<H[]>([]);
  const [prices,setP]=useState<Record<string,{price:number;day:number;name:string}>>({});
  const [loading,setL]=useState(false);
  const [ts,setTs]=useState<Date|null>(null);
  const [ticker,setTicker]=useState("");
  const [shares,setShares]=useState("");
  const [bp,setBp]=useState("");
  const [err,setErr]=useState("");

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

  const del=(id:string)=>setH(prev=>prev.filter(h=>h.id!==id));

  const enriched:EH[]=holdings.map(h=>{
    const p=prices[h.ticker];
    const cur=p?.price||h.buyPrice,cost=h.shares*h.buyPrice,val=h.shares*cur;
    return{...h,name:p?.name||KNOWN[h.ticker]?.name||h.ticker,cur,cost,val,pnl:val-cost,pct:((cur-h.buyPrice)/h.buyPrice)*100,day:p?.day||0};
  });

  const tv=enriched.reduce((s,h)=>s+h.val,0);
  const tc=enriched.reduce((s,h)=>s+h.cost,0);
  const tp=tc>0?(tv-tc)/tc*100:0;
  const grade=gradePortfolio(enriched);
  const gc_=gc(grade.letter);

  const inp:React.CSSProperties={background:C.bgBase,border:`1px solid ${C.bs}`,borderRadius:9,color:C.text,...mono,fontSize:14,padding:"10px 12px",outline:"none",width:"100%",transition:"border-color 0.15s"};

  return(
    <div style={{padding:"20px 16px",maxWidth:1200,margin:"0 auto",animation:"fadeUp 0.3s ease-out both"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:11,background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.22)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <BookOpen size={20} color={C.am}/>
          </div>
          <div>
            <h2 style={{fontSize:18,fontWeight:700,color:C.text,margin:0}}>My Portfolio</h2>
            <p style={{...mono,color:C.textMuted,fontSize:10,margin:0,marginTop:2}}>Holdings · P&L · AI Grade</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {ts&&<span style={{...mono,color:C.textMuted,fontSize:9}}>Updated {ts.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading||!holdings.length}
            style={{display:"flex",alignItems:"center",gap:5,background:C.bgElevated,border:`1px solid ${C.bs}`,borderRadius:9,color:loading?C.textMuted:C.textSec,padding:"7px 13px",cursor:"pointer",fontSize:12,fontWeight:500,minHeight:36,transition:"all 0.15s"}}>
            <RefreshCw size={12} style={{animation:loading?"spin 1s linear infinite":"none"}}/>Refresh
          </button>
        </div>
      </div>

      {/* Add form */}
      <div style={{...card({background:`linear-gradient(135deg,${C.bgRaised},${C.bgElevated})`}),padding:18,marginBottom:18}}>
        <p style={{...mono,fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>Add Position</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,alignItems:"end"}}>
          <div>
            <label style={{...mono,fontSize:8,color:C.textMuted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>Ticker</label>
            <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder="AAPL" style={inp}
              onFocus={e=>e.target.style.borderColor=C.bm} onBlur={e=>e.target.style.borderColor=C.bs} onKeyDown={e=>e.key==="Enter"&&add()}/>
          </div>
          <div>
            <label style={{...mono,fontSize:8,color:C.textMuted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>Shares</label>
            <input value={shares} onChange={e=>setShares(e.target.value)} placeholder="10" type="number" min="0.001" step="any" style={inp}
              onFocus={e=>e.target.style.borderColor=C.bm} onBlur={e=>e.target.style.borderColor=C.bs} onKeyDown={e=>e.key==="Enter"&&add()}/>
          </div>
          <div>
            <label style={{...mono,fontSize:8,color:C.textMuted,display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.1em"}}>Buy Price ($)</label>
            <input value={bp} onChange={e=>setBp(e.target.value)} placeholder="180.00" type="number" min="0.01" step="any" style={inp}
              onFocus={e=>e.target.style.borderColor=C.bm} onBlur={e=>e.target.style.borderColor=C.bs} onKeyDown={e=>e.key==="Enter"&&add()}/>
          </div>
          <button onClick={add} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"linear-gradient(135deg,rgba(59,130,246,0.15),rgba(16,185,129,0.08))",border:"1px solid rgba(59,130,246,0.25)",borderRadius:9,color:"#60A5FA",padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:600,minHeight:44,transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="linear-gradient(135deg,rgba(59,130,246,0.22),rgba(16,185,129,0.12))"}
            onMouseLeave={e=>e.currentTarget.style.background="linear-gradient(135deg,rgba(59,130,246,0.15),rgba(16,185,129,0.08))"}>
            <Plus size={15}/>Add Position
          </button>
        </div>
        {err&&<p style={{...mono,color:C.crB,fontSize:11,marginTop:8}}>⚠ {err}</p>}
      </div>

      {holdings.length>0&&(
        <>
          {/* Summary strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
            {[
              {l:"Portfolio Value",v:f$(tv),      c:C.text},
              {l:"Total Cost",     v:f$(tc),       c:C.textSec},
              {l:"Unrealized P&L", v:f$(tv-tc),   c:tv>=tc?C.emB:C.crB},
              {l:"Total Return",   v:fp(tp),       c:tp>=0?C.emB:C.crB},
            ].map(s=>(
              <div key={s.l} style={{...card({background:`linear-gradient(135deg,${C.bgRaised},${C.bgElevated})`}),padding:"12px 16px"}}>
                <p style={{...mono,color:C.textMuted,fontSize:8,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{s.l}</p>
                <p style={{...mono,fontSize:"clamp(16px,3.5vw,22px)",fontWeight:700,color:s.c}}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div style={{...card({overflow:"hidden"}),marginBottom:16}}>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.bs}`}}>
                    {["Ticker","Company","Shares","Buy Price","Current","Value","P&L","Return","Today",""].map(h=>(
                      <th key={h} style={{...mono,fontSize:8,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 12px",textAlign:h===""?"center":"left",fontWeight:500,whiteSpace:"nowrap",background:C.bgRaised}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map(h=>{
                    const up=h.pct>=0,du=h.day>=0;
                    return(
                      <tr key={h.id} style={{borderBottom:`1px solid rgba(100,160,220,0.05)`,transition:"background 0.12s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:13,fontWeight:700,color:"#60A5FA"}}>{h.ticker}</span></td>
                        <td style={{padding:"12px 12px",fontSize:11,color:C.textSec,maxWidth:140}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{h.name}</span></td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12}}>{h.shares.toLocaleString()}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12}}>{f$(h.buyPrice)}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:13,fontWeight:600,color:C.text}}>{h.cur>0?f$(h.cur):"—"}</td>
                        <td style={{padding:"12px 12px",...mono,fontSize:12}}>{f$(h.val)}</td>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:12,color:up?C.emB:C.crB,fontWeight:500}}>{up?"+":""}{f$(h.pnl)}</span></td>
                        <td style={{padding:"12px 12px"}}>
                          <span style={{...mono,fontSize:11,padding:"2px 7px",borderRadius:5,background:up?C.emD:C.crD,color:up?C.emB:C.crB,border:`1px solid ${up?C.emBorder:C.crBorder}`,display:"inline-flex",alignItems:"center",gap:3}}>
                            {up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{fp(h.pct)}
                          </span>
                        </td>
                        <td style={{padding:"12px 12px"}}><span style={{...mono,fontSize:11,color:du?C.emB:C.crB}}>{fp(h.day)}</span></td>
                        <td style={{padding:"12px 12px",textAlign:"center"}}>
                          <button onClick={()=>del(h.id)}
                            style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:4,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",minWidth:32,minHeight:32,transition:"color 0.15s"}}
                            onMouseEnter={e=>e.currentTarget.style.color=C.crB}
                            onMouseLeave={e=>e.currentTarget.style.color=C.textMuted}>
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

          {/* AI Grade */}
          <div style={card({overflow:"hidden"})}>
            {/* Grade hero */}
            <div style={{display:"flex",flexWrap:"wrap",borderBottom:`1px solid ${C.bs}`}}>
              <div style={{padding:"24px 28px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${C.bs}`,minWidth:110,background:`linear-gradient(135deg,${gc_}10,${gc_}05)`,flexShrink:0}}>
                <p style={{...mono,fontSize:8,color:gc_,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:6}}>Portfolio Grade</p>
                <p style={{fontFamily:"'DM Serif Display',Georgia,serif",fontSize:52,fontWeight:700,lineHeight:1,color:gc_,textShadow:`0 0 32px ${gc_}55`}}>{grade.letter}</p>
                <p style={{...mono,fontSize:11,color:gc_,marginTop:5}}>{grade.score}/100</p>
              </div>
              <div style={{flex:1,padding:"20px 22px",minWidth:200}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <Star size={15} color={gc_} fill={gc_}/>
                  <span style={{fontSize:14,fontWeight:700,color:C.text}}>AI Portfolio Analysis</span>
                </div>
                <p style={{color:C.textSec,fontSize:13,lineHeight:1.6,marginBottom:14}}>{grade.summary}</p>
                <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${grade.score}%`,background:`linear-gradient(90deg,${gc_}80,${gc_})`,borderRadius:99,transition:"width 1s cubic-bezier(0,0,0.2,1)"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                  <span style={{...mono,fontSize:8,color:C.textMuted}}>0</span>
                  <span style={{...mono,fontSize:8,color:C.textMuted}}>100</span>
                </div>
              </div>
            </div>
            {/* Three columns */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))"}}>
              {[
                {title:"Strengths", color:C.emB, icon:<CheckCircle size={12} color={C.emB}/>, items:grade.strengths, sym:"✓", empty:"No strengths identified yet."},
                {title:"Weaknesses",color:C.crB, icon:<XCircle size={12} color={C.crB}/>,     items:grade.weaknesses,sym:"!",icon2:<AlertTriangle size={10} color={C.crB}/>, empty:"No major weaknesses."},
                {title:"Suggestions",color:"#60A5FA",icon:<Info size={12} color="#60A5FA"/>,  items:grade.tips,      sym:"→", empty:"Keep monitoring performance."},
              ].map((col,ci)=>(
                <div key={col.title} style={{padding:"16px 18px",borderRight:ci<2?`1px solid ${C.bs}`:"none",borderTop:`1px solid ${C.bs}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10}}>
                    {col.icon}
                    <span style={{...mono,fontSize:9,fontWeight:700,color:col.color,textTransform:"uppercase",letterSpacing:"0.1em"}}>{col.title}</span>
                  </div>
                  {col.items.length?col.items.map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                      <span style={{color:col.color,fontSize:12,marginTop:1,flexShrink:0}}>{col.sym}</span>
                      <span style={{fontSize:12,color:C.textSec,lineHeight:1.55}}>{s}</span>
                    </div>
                  )):<p style={{fontSize:12,color:C.textMuted}}>{col.empty}</p>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!holdings.length&&(
        <div style={{...card(),padding:56,textAlign:"center"}}>
          <BookOpen size={36} color={C.bs} style={{marginBottom:12}}/>
          <p style={{fontSize:15,fontWeight:600,marginBottom:6,color:C.text}}>No positions yet</p>
          <p style={{color:C.textSec,fontSize:13}}>Add your first position above to start tracking performance and receive an AI grade.</p>
        </div>
      )}

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
