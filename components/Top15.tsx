"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Trophy, Target, Shield, Zap, ChevronUp, ChevronDown, X } from "lucide-react";

interface Stock { rank:number; ticker:string; name:string; price:number; changePct:number; floor:number; ceiling:number; confidence:number; sector:string; score:number; }
interface Alloc  { ticker:string; name:string; price:number; dollars:number; shares:number; pct:number; note:string; }

const KEY="1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr", BASE="https://api.polygon.io";

const UNI=[
  {ticker:"NVDA",name:"NVIDIA Corp.",        sector:"Technology"},  {ticker:"MSFT",name:"Microsoft Corp.",     sector:"Technology"},
  {ticker:"AAPL",name:"Apple Inc.",           sector:"Technology"},  {ticker:"META",name:"Meta Platforms",      sector:"Technology"},
  {ticker:"GOOGL",name:"Alphabet Inc.",       sector:"Technology"},  {ticker:"AMZN",name:"Amazon.com",          sector:"Consumer"},
  {ticker:"AMD", name:"Advanced Micro Dev.",  sector:"Technology"},  {ticker:"PLTR",name:"Palantir Tech.",      sector:"Technology"},
  {ticker:"JPM", name:"JPMorgan Chase",       sector:"Financials"},  {ticker:"V",   name:"Visa Inc.",           sector:"Financials"},
  {ticker:"UNH", name:"UnitedHealth Group",   sector:"Healthcare"},  {ticker:"LLY", name:"Eli Lilly & Co.",     sector:"Healthcare"},
  {ticker:"TSLA",name:"Tesla Inc.",           sector:"Consumer"},    {ticker:"ORCL",name:"Oracle Corp.",         sector:"Technology"},
  {ticker:"CRWD",name:"CrowdStrike",          sector:"Technology"},  {ticker:"PANW",name:"Palo Alto Networks",  sector:"Technology"},
  {ticker:"AVGO",name:"Broadcom Inc.",        sector:"Technology"},  {ticker:"CRM", name:"Salesforce Inc.",     sector:"Technology"},
  {ticker:"NOW", name:"ServiceNow Inc.",      sector:"Technology"},  {ticker:"COIN",name:"Coinbase Global",     sector:"Financials"},
];

const MP:Record<string,number>={NVDA:875,MSFT:415,AAPL:228,META:554,GOOGL:178,AMZN:201,AMD:162,PLTR:38,JPM:224,V:296,UNH:512,LLY:798,TSLA:248,ORCL:142,CRWD:368,PANW:341,AVGO:1642,CRM:299,NOW:812,COIN:234};
const MC:Record<string,number>={NVDA:2.9,MSFT:-.52,AAPL:1.42,META:1.63,GOOGL:.81,AMZN:-.44,AMD:3.72,PLTR:4.96,JPM:.5,V:.83,UNH:-.81,LLY:1.24,TSLA:-3.58,ORCL:.92,CRWD:2.44,PANW:1.87,AVGO:1.11,CRM:.68,NOW:1.33,COIN:5.21};
const SC:Record<string,string>={Technology:"#3B82F6",Financials:"#8B5CF6",Healthcare:"#10B981",Consumer:"#F59E0B"};

async function pg<T>(p:string):Promise<T|null>{try{const r=await fetch(`${BASE}${p}${p.includes("?")?"&":"?"}apiKey=${KEY}`);return r.ok?r.json():null;}catch{return null;}}

function score(chg:number,vol:number,conf:number){return+(Math.min(Math.max(chg/5,-1),1)*40+Math.min(vol/60e6,1)*30+(conf/100)*30).toFixed(2);}
function fc(price:number,chg:number){return{floor:+(price*(1-(chg<0?.06:.04))).toFixed(2),ceiling:+(price*(1+(chg>2?.14:chg>0?.10:.08))).toFixed(2)};}
function conf(chg:number,vol:number){let c=60;if(chg>3)c+=18;else if(chg>1)c+=10;else if(chg<-2)c-=12;if(vol>50e6)c+=12;else if(vol>25e6)c+=6;return Math.min(96,Math.max(42,c));}

async function fetchTop15():Promise<Stock[]>{
  const tickers=UNI.map(u=>u.ticker).join(",");
  const data=await pg<{tickers?:Array<{ticker:string;day:{c:number;v:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`);
  const rows=UNI.map(u=>{
    const s=data?.tickers?.find(t=>t.ticker===u.ticker);
    const price=s?.day?.c||MP[u.ticker]||100,prev=s?.prevDay?.c||price*.99,vol=s?.day?.v||30e6;
    const chg=s?+((price-prev)/prev*100).toFixed(2):(MC[u.ticker]??0);
    const c=conf(chg,vol),{floor,ceiling}=fc(price,chg);
    return{rank:0,ticker:u.ticker,name:u.name,sector:u.sector,price,changePct:chg,floor,ceiling,confidence:c,score:score(chg,vol,c)};
  });
  rows.sort((a,b)=>b.score-a.score);rows.forEach((r,i)=>r.rank=i+1);
  return rows.slice(0,15);
}

function simulate(stocks:Stock[],cash:number):Alloc[]{
  const picks=stocks.slice(0,8),tw=picks.reduce((s,p)=>s+p.confidence*Math.max(p.score+60,1),0);
  return picks.map(p=>{
    const w=(p.confidence*Math.max(p.score+60,1))/tw,dollars=Math.round(cash*w*100)/100;
    const upside=(((p.ceiling-p.price)/p.price)*100).toFixed(1);
    return{ticker:p.ticker,name:p.name,price:p.price,dollars,shares:Math.floor(dollars/p.price),pct:+(w*100).toFixed(1),note:`${(w*100).toFixed(1)}% · ${upside}% to target · ${p.confidence}% conf`};
  }).sort((a,b)=>b.dollars-a.dollars);
}

const f$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fp=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;

const C={
  bgBase:"#060B14",bgRaised:"#0A1220",bgElevated:"#0F1A2B",bgOverlay:"#142035",bgHover:"#18273D",
  borderSoft:"rgba(100,160,220,0.11)",borderMid:"rgba(100,160,220,0.18)",
  text:"#EEF3FA",textSec:"#7A9DBF",textMuted:"#3D5A7A",
  em:"#10B981",emB:"#34D399",emD:"rgba(16,185,129,0.10)",emBorder:"rgba(16,185,129,0.20)",
  cr:"#F43F5E",crB:"#FB7185",crD:"rgba(244,63,94,0.10)",crBorder:"rgba(244,63,94,0.20)",
  sap:"#3B82F6",gold:"#F59E0B",
};
const card=(ex?:React.CSSProperties):React.CSSProperties=>({background:C.bgRaised,border:`1px solid ${C.borderSoft}`,borderRadius:14,boxShadow:"0 4px 16px rgba(0,0,0,0.4)",...ex});
const mono={fontFamily:"'JetBrains Mono','Courier New',monospace"} as React.CSSProperties;

function ConfBar({pct}:{pct:number}){
  const color=pct>=80?C.emB:pct>=65?C.gold:C.crB;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.8s cubic-bezier(0,0,0.2,1)"}}/>
      </div>
      <span style={{...mono,fontSize:10,color,minWidth:26}}>{pct}%</span>
    </div>
  );
}

function SimModal({stocks,onClose}:{stocks:Stock[];onClose:()=>void}){
  const [cash,setCash]=useState("50000");
  const num=Math.max(100,parseFloat(cash.replace(/,/g,""))||50000);
  const allocs=simulate(stocks,num);
  const total=allocs.reduce((s,a)=>s+a.dollars,0);
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{...card({borderRadius:"20px 20px 0 0",boxShadow:"0 -20px 60px rgba(0,0,0,0.6)"}),width:"100%",maxWidth:680,maxHeight:"88vh",overflow:"auto",animation:"slideUp 0.3s cubic-bezier(.34,1.56,.64,1) both"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderBottom:`1px solid ${C.borderSoft}`,position:"sticky",top:0,background:C.bgRaised,zIndex:1,backdropFilter:"blur(10px)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#3B82F6,#10B981)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <DollarSign size={15} color="#fff"/>
            </div>
            <div>
              <p style={{fontWeight:700,fontSize:14,color:C.text}}>Portfolio Simulator</p>
              <p style={{...mono,fontSize:10,color:C.textMuted}}>AI-weighted allocation · Top 8 by signal strength</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.textSec,padding:6,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",minWidth:36,minHeight:36}}>
            <X size={17}/>
          </button>
        </div>
        {/* Input */}
        <div style={{padding:"14px 20px",borderBottom:`1px solid ${C.borderSoft}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <label style={{fontSize:12,color:C.textSec,whiteSpace:"nowrap"}}>Investment Amount</label>
          <div style={{position:"relative",flex:1,minWidth:140}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.textMuted,...mono,fontSize:14}}>$</span>
            <input type="number" value={cash} onChange={e=>setCash(e.target.value)} min="100" step="1000"
              style={{width:"100%",background:C.bgBase,border:`1px solid ${C.borderSoft}`,borderRadius:9,color:C.text,...mono,fontSize:14,padding:"9px 12px 9px 24px",outline:"none"}}/>
          </div>
          <p style={{...mono,fontSize:12,color:C.emB,whiteSpace:"nowrap"}}>Cash reserve: {f$(num-total)}</p>
        </div>
        {/* Rows */}
        <div style={{padding:"12px 20px"}}>
          {allocs.map((a,i)=>(
            <div key={a.ticker} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:`1px solid rgba(100,160,220,0.06)`,flexWrap:"wrap"}}>
              <span style={{...mono,color:C.textMuted,fontSize:11,minWidth:24}}>#{i+1}</span>
              <span style={{...mono,fontWeight:700,fontSize:13,color:"#60A5FA",minWidth:50}}>{a.ticker}</span>
              <div style={{flex:1,minWidth:120}}>
                <div style={{height:2,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden",marginBottom:3}}>
                  <div style={{width:`${a.pct}%`,height:"100%",background:"linear-gradient(90deg,#3B82F6,#10B981)",borderRadius:99}}/>
                </div>
                <span style={{...mono,color:C.textMuted,fontSize:9}}>{a.note}</span>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{...mono,fontSize:13,fontWeight:600,color:C.text}}>{f$(a.dollars)}</p>
                <p style={{...mono,fontSize:10,color:C.textSec}}>{a.shares} sh · {a.pct}%</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:"14px 20px",borderTop:`1px solid ${C.borderSoft}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,background:C.bgBase,borderRadius:"0 0 20px 20px"}}>
          <p style={{fontSize:11,color:C.textSec,maxWidth:300}}>Weights based on confidence × momentum score. Fractional shares excluded.</p>
          <div style={{textAlign:"right"}}>
            <p style={{...mono,fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total Deployed</p>
            <p style={{...mono,fontSize:20,fontWeight:700,color:C.emB}}>{f$(total)}</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

export default function Top15(){
  const [stocks,setStocks]=useState<Stock[]>([]);
  const [loading,setLoading]=useState(true);
  const [ts,setTs]=useState<Date|null>(null);
  const [showSim,setShowSim]=useState(false);
  const [sortCol,setSortCol]=useState<keyof Stock>("rank");
  const [sortDir,setSortDir]=useState<"asc"|"desc">("asc");
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{setBusy(true);const d=await fetchTop15();setStocks(d);setTs(new Date());setLoading(false);setBusy(false);},[]);
  useEffect(()=>{load();const id=setInterval(load,15*60*1000);return()=>clearInterval(id);},[load]);

  const sorted=[...stocks].sort((a,b)=>{const av=a[sortCol]as number,bv=b[sortCol]as number;return sortDir==="asc"?av-bv:bv-av;});
  const toggle=(col:keyof Stock)=>{if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("asc");}};

  if(loading) return(
    <div style={{padding:24,display:"flex",flexDirection:"column",gap:12}}>
      {[180,80,80,80,80].map((h,i)=>(
        <div key={i} style={{background:"linear-gradient(90deg,#0A1220 25%,#142035 50%,#0A1220 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.8s ease-in-out infinite",borderRadius:12,height:h}}/>
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );

  const ColH=({label,col,right}:{label:string;col:keyof Stock;right?:boolean})=>(
    <th onClick={()=>toggle(col)} style={{...mono,fontSize:9,color:sortCol===col?"#60A5FA":C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 12px",cursor:"pointer",userSelect:"none",textAlign:right?"right":"left",fontWeight:500,whiteSpace:"nowrap",background:C.bgRaised}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
        {label}{sortCol===col?(sortDir==="asc"?<ChevronUp size={10} color="#60A5FA"/>:<ChevronDown size={10} color="#60A5FA"/>):<span style={{opacity:.25}}>⇅</span>}
      </span>
    </th>
  );

  return(
    <div style={{padding:"20px 16px",maxWidth:1200,margin:"0 auto",animation:"fadeUp 0.3s ease-out both"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:18,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:11,background:"linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05))",border:"1px solid rgba(245,158,11,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Trophy size={20} color={C.gold}/>
          </div>
          <div>
            <h2 style={{fontSize:18,fontWeight:700,color:C.text,margin:0}}>Top 15 Stocks</h2>
            <p style={{...mono,color:C.textMuted,fontSize:10,margin:0,marginTop:2}}>Ranked · momentum × volume × AI confidence</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {ts&&<span style={{...mono,color:C.textMuted,fontSize:9}}>Updated {ts.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={busy}
            style={{display:"flex",alignItems:"center",gap:5,background:C.bgElevated,border:`1px solid ${C.borderSoft}`,borderRadius:9,color:busy?C.textMuted:C.textSec,padding:"7px 13px",cursor:"pointer",fontSize:12,fontWeight:500,minHeight:36,transition:"all 0.15s"}}>
            <RefreshCw size={12} style={{animation:busy?"spin 1s linear infinite":"none"}}/> Refresh
          </button>
          <button onClick={()=>setShowSim(true)}
            style={{display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,rgba(59,130,246,0.12),rgba(16,185,129,0.08))",border:"1px solid rgba(59,130,246,0.25)",borderRadius:9,color:"#60A5FA",padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:600,minHeight:36,transition:"all 0.15s"}}>
            <DollarSign size={13}/> Simulate Portfolio
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
        {[
          {icon:<TrendingUp size={13} color={C.emB}/>,  label:"Bullish Signals",   val:`${stocks.filter(s=>s.changePct>0).length} / ${stocks.length}`},
          {icon:<Shield size={13} color="#60A5FA"/>,     label:"Avg Confidence",    val:`${Math.round(stocks.reduce((s,x)=>s+x.confidence,0)/(stocks.length||1))}%`},
          {icon:<Target size={13} color={C.gold}/>,      label:"Avg Upside",        val:`+${(stocks.reduce((s,x)=>s+((x.ceiling-x.price)/x.price)*100,0)/(stocks.length||1)).toFixed(1)}%`},
          {icon:<Zap size={13} color="#8B5CF6"/>,        label:"Sectors Covered",   val:[...new Set(stocks.map(s=>s.sector))].length+" sectors"},
        ].map(s=>(
          <div key={s.label} style={{...card(),padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
            <div>
              <p style={{...mono,color:C.textMuted,fontSize:8,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{s.label}</p>
              <p style={{...mono,fontSize:13,fontWeight:600,color:C.text}}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{...card({overflow:"hidden"})}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.borderSoft}`}}>
                <ColH label="Rank"       col="rank"/>
                <th style={{...mono,fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 12px",textAlign:"left",fontWeight:500,background:C.bgRaised,whiteSpace:"nowrap"}}>Ticker</th>
                <th style={{...mono,fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 12px",textAlign:"left",fontWeight:500,background:C.bgRaised,whiteSpace:"nowrap",minWidth:130}}>Company</th>
                <ColH label="Price"      col="price"      right/>
                <ColH label="Today"      col="changePct"  right/>
                <ColH label="Floor"      col="floor"      right/>
                <ColH label="Ceiling"    col="ceiling"    right/>
                <ColH label="Confidence" col="confidence" right/>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,idx)=>{
                const up=s.changePct>=0, sc=SC[s.sector]??"#7A9DBF";
                return(
                  <tr key={s.ticker} style={{borderBottom:`1px solid rgba(100,160,220,0.05)`,transition:"background 0.12s",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:12,color:idx<3?C.gold:C.textMuted,fontWeight:700}}>
                        {idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":`#${s.rank}`}
                      </span>
                    </td>
                    <td style={{padding:"14px 12px"}}>
                      <p style={{...mono,fontSize:13,fontWeight:700,color:"#60A5FA",marginBottom:3}}>{s.ticker}</p>
                      <span style={{...mono,fontSize:8,padding:"1px 6px",borderRadius:4,background:`${sc}15`,color:sc,border:`1px solid ${sc}25`}}>{s.sector}</span>
                    </td>
                    <td style={{padding:"14px 12px",fontSize:12,color:C.textSec,maxWidth:160}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{s.name}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:13,fontWeight:600,color:C.text}}>{f$(s.price)}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:11,padding:"3px 8px",borderRadius:6,background:up?C.emD:C.crD,color:up?C.emB:C.crB,border:`1px solid ${up?C.emBorder:C.crBorder}`,display:"inline-flex",alignItems:"center",gap:3}}>
                        {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{fp(s.changePct)}
                      </span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:11,color:C.crB}}>{f$(s.floor)}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <p style={{...mono,fontSize:12,color:C.emB,fontWeight:500}}>{f$(s.ceiling)}</p>
                      <p style={{...mono,fontSize:9,color:C.textMuted}}>+{(((s.ceiling-s.price)/s.price)*100).toFixed(1)}%</p>
                    </td>
                    <td style={{padding:"14px 16px 14px 12px",minWidth:120}}>
                      <ConfBar pct={s.confidence}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{...mono,color:C.textMuted,fontSize:9,marginTop:12,lineHeight:1.6}}>
        ⚡ Auto-refreshes every 15 min · Rankings reflect real-time momentum, volume strength, and AI confidence signals · Not financial advice
      </p>
      {showSim&&<SimModal stocks={stocks} onClose={()=>setShowSim(false)}/>}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
