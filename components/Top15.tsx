"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, DollarSign,
  Trophy, Target, Shield, Zap, ChevronUp, ChevronDown, X,
} from "lucide-react";
import { CountdownBar } from "@/components/CountdownBar";

/* ── Types ────────────────────────────────────────────────── */
interface Stock  { rank:number; ticker:string; name:string; price:number; changePct:number; floor:number; ceiling:number; conf:number; sector:string; score:number; }
interface Alloc  { ticker:string; name:string; price:number; dollars:number; shares:number; pct:number; note:string; }

/* ── Constants ────────────────────────────────────────────── */
const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";

const UNI = [
  {t:"NVDA",n:"NVIDIA Corp.",          s:"Technology"}, {t:"MSFT",n:"Microsoft Corp.",      s:"Technology"},
  {t:"AAPL",n:"Apple Inc.",            s:"Technology"}, {t:"META",n:"Meta Platforms",        s:"Technology"},
  {t:"GOOGL",n:"Alphabet Inc.",        s:"Technology"}, {t:"AMZN",n:"Amazon.com",            s:"Consumer"},
  {t:"AMD", n:"Advanced Micro Dev.",   s:"Technology"}, {t:"PLTR",n:"Palantir Tech.",         s:"Technology"},
  {t:"JPM", n:"JPMorgan Chase",        s:"Financials"}, {t:"V",   n:"Visa Inc.",             s:"Financials"},
  {t:"UNH", n:"UnitedHealth Group",    s:"Healthcare"}, {t:"LLY", n:"Eli Lilly & Co.",       s:"Healthcare"},
  {t:"TSLA",n:"Tesla Inc.",            s:"Consumer"},   {t:"ORCL",n:"Oracle Corp.",           s:"Technology"},
  {t:"CRWD",n:"CrowdStrike",           s:"Technology"}, {t:"PANW",n:"Palo Alto Networks",    s:"Technology"},
  {t:"AVGO",n:"Broadcom Inc.",         s:"Technology"}, {t:"CRM", n:"Salesforce Inc.",        s:"Technology"},
  {t:"NOW", n:"ServiceNow Inc.",       s:"Technology"}, {t:"COIN",n:"Coinbase Global",        s:"Financials"},
];
const MP:Record<string,number>  = {NVDA:875,MSFT:415,AAPL:228,META:554,GOOGL:178,AMZN:201,AMD:162,PLTR:38,JPM:224,V:296,UNH:512,LLY:798,TSLA:248,ORCL:142,CRWD:368,PANW:341,AVGO:1642,CRM:299,NOW:812,COIN:234};
const MC:Record<string,number>  = {NVDA:2.9,MSFT:-.52,AAPL:1.42,META:1.63,GOOGL:.81,AMZN:-.44,AMD:3.72,PLTR:4.96,JPM:.5,V:.83,UNH:-.81,LLY:1.24,TSLA:-3.58,ORCL:.92,CRWD:2.44,PANW:1.87,AVGO:1.11,CRM:.68,NOW:1.33,COIN:5.21};

const SECTOR_HUE: Record<string,string> = { Technology:"#4F8EF7", Financials:"#9B72F5", Healthcare:"#00C896", Consumer:"#E8A030" };

/* ── Scoring helpers ─────────────────────────────────────── */
const calcConf   = (chg:number,vol:number) => { let c=60; if(chg>3)c+=18;else if(chg>1)c+=10;else if(chg<-2)c-=12; if(vol>50e6)c+=12;else if(vol>25e6)c+=6; return Math.min(96,Math.max(42,c)); };
const calcScore  = (chg:number,vol:number,conf:number) => +(Math.min(Math.max(chg/5,-1),1)*40+Math.min(vol/60e6,1)*30+(conf/100)*30).toFixed(2);
const calcLevels = (price:number,chg:number) => ({ floor:+(price*(1-(chg<0?.06:.04))).toFixed(2), ceiling:+(price*(1+(chg>2?.14:chg>0?.10:.08))).toFixed(2) });

/* ── API ──────────────────────────────────────────────────── */
async function pg<T>(p:string):Promise<T|null>{try{const r=await fetch(`${BASE}${p}${p.includes("?")?"&":"?"}apiKey=${KEY}`);return r.ok?r.json():null;}catch{return null;}}

async function fetchTop15():Promise<Stock[]>{
  const tickers=UNI.map(u=>u.t).join(",");
  const data=await pg<{tickers?:Array<{ticker:string;day:{c:number;v:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`);
  const rows=UNI.map(u=>{
    const snap=data?.tickers?.find(t=>t.ticker===u.t);
    const price=snap?.day?.c||MP[u.t]||100, prev=snap?.prevDay?.c||price*.99, vol=snap?.day?.v||30e6;
    const chg=snap?+((price-prev)/prev*100).toFixed(2):(MC[u.t]??0), conf=calcConf(chg,vol);
    const {floor,ceiling}=calcLevels(price,chg);
    return {rank:0,ticker:u.t,name:u.n,sector:u.s,price,changePct:chg,floor,ceiling,conf,score:calcScore(chg,vol,conf)};
  });
  rows.sort((a,b)=>b.score-a.score); rows.forEach((r,i)=>r.rank=i+1);
  return rows.slice(0,15);
}

/* ── Portfolio simulator ─────────────────────────────────── */
function simulate(stocks:Stock[],cash:number):Alloc[]{
  const picks=stocks.slice(0,8), tw=picks.reduce((s,p)=>s+p.conf*Math.max(p.score+60,1),0);
  return picks.map(p=>{
    const w=(p.conf*Math.max(p.score+60,1))/tw, dollars=Math.round(cash*w*100)/100;
    const upside=(((p.ceiling-p.price)/p.price)*100).toFixed(1);
    return{ticker:p.ticker,name:p.name,price:p.price,dollars,shares:Math.floor(dollars/p.price),pct:+(w*100).toFixed(1),note:`${(w*100).toFixed(1)}% · +${upside}% target · ${p.conf}% conf`};
  }).sort((a,b)=>b.dollars-a.dollars);
}

/* ── Format ──────────────────────────────────────────────── */
const f$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fp=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;

/* ── Design tokens ───────────────────────────────────────── */
const V={
  d0:"#050810",d1:"#080D18",d2:"#0C1220",d3:"#101828",d4:"#151F30",dh:"#1E2D40",
  w1:"rgba(130,180,255,0.055)",w2:"rgba(130,180,255,0.10)",w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF",ink1:"#C8D5E8",ink2:"#7A9CBF",ink3:"#3D5A7A",ink4:"#1F3550",
  gain:"#00C896",gainDim:"rgba(0,200,150,0.08)",gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A",lossDim:"rgba(232,68,90,0.08)",lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",arcDim:"rgba(79,142,247,0.10)",arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030",goldDim:"rgba(232,160,48,0.10)",ame:"#9B72F5",
};
const mono:React.CSSProperties={fontFamily:"'Geist Mono','Courier New',monospace"};
const glass=(ex?:React.CSSProperties):React.CSSProperties=>({background:"linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",backdropFilter:"blur(24px) saturate(1.5)",WebkitBackdropFilter:"blur(24px) saturate(1.5)",border:`1px solid ${V.w2}`,borderRadius:16,boxShadow:"0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",position:"relative" as const,overflow:"hidden",...ex});

/* ── Confidence bar ─────────────────────────────────────── */
function ConfBar({pct}:{pct:number}){
  const c=pct>=80?V.gain:pct>=65?V.gold:V.loss;
  return(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:2,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:99,transition:"width 1s cubic-bezier(0.16,1,0.3,1)"}}/>
      </div>
      <span style={{...mono,fontSize:10,color:c,minWidth:26}}>{pct}%</span>
    </div>
  );
}

/* ── Simulator modal ─────────────────────────────────────── */
function SimModal({stocks,onClose}:{stocks:Stock[];onClose:()=>void}){
  const [cash,setCash]=useState("50000");
  const num=Math.max(100,parseFloat(cash.replace(/,/g,""))||50000);
  const allocs=simulate(stocks,num);
  const total=allocs.reduce((s,a)=>s+a.dollars,0);
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(4px)"}}>
      <div style={{...glass({borderRadius:"20px 20px 0 0"}),width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",animation:"vx-rise 0.35s cubic-bezier(0.16,1,0.3,1) both"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 22px",borderBottom:`1px solid ${V.w1}`,position:"sticky",top:0,background:"rgba(8,13,24,0.97)",backdropFilter:"blur(20px)",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#4F8EF7,#00C896)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(79,142,247,0.35)"}}>
              <DollarSign size={16} color="#fff"/>
            </div>
            <div>
              <p style={{fontWeight:600,fontSize:14,color:V.ink0}}>Portfolio Simulator</p>
              <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.08em"}}>AI-weighted · Top 8 by signal strength</p>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,padding:6,borderRadius:8,display:"flex",minWidth:34,minHeight:34,alignItems:"center",justifyContent:"center"}}>
            <X size={16}/>
          </button>
        </div>

        {/* Amount input */}
        <div style={{padding:"16px 22px",borderBottom:`1px solid ${V.w1}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <label style={{...mono,fontSize:10,color:V.ink3,textTransform:"uppercase",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>Investment Amount</label>
          <div style={{position:"relative",flex:1,minWidth:140}}>
            <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:V.ink3,...mono,fontSize:14}}>$</span>
            <input type="number" value={cash} onChange={e=>setCash(e.target.value)} className="vx-input" style={{paddingLeft:22}} min="100" step="1000"/>
          </div>
          <p style={{...mono,fontSize:11,color:V.gain,whiteSpace:"nowrap"}}>Reserve: {f$(num-total)}</p>
        </div>

        {/* Allocation rows */}
        <div style={{padding:"14px 22px"}}>
          {allocs.map((a,i)=>(
            <div key={a.ticker} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:`1px solid rgba(130,180,255,0.05)`,flexWrap:"wrap"}}>
              <span style={{...mono,color:V.ink4,fontSize:10,minWidth:22}}>#{i+1}</span>
              <span style={{...mono,fontWeight:500,fontSize:13,color:"#7EB6FF",minWidth:50}}>{a.ticker}</span>
              <div style={{flex:1,minWidth:120}}>
                <div style={{height:2,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                  <div style={{width:`${a.pct}%`,height:"100%",background:"linear-gradient(90deg,#4F8EF7,#00C896)",borderRadius:99}}/>
                </div>
                <span style={{...mono,color:V.ink4,fontSize:9}}>{a.note}</span>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <p style={{...mono,fontSize:13,fontWeight:500,color:V.ink0}}>{f$(a.dollars)}</p>
                <p style={{...mono,fontSize:9,color:V.ink3}}>{a.shares} sh · {a.pct}%</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{padding:"14px 22px",borderTop:`1px solid ${V.w1}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,background:"rgba(5,8,16,0.8)"}}>
          <p style={{fontSize:11,color:V.ink3,maxWidth:300}}>Weighted by confidence × momentum. Fractional shares excluded.</p>
          <div style={{textAlign:"right"}}>
            <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Total Deployed</p>
            <p style={{...mono,fontSize:22,fontWeight:500,color:V.gain,letterSpacing:"-0.02em"}}>{f$(total)}</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes vx-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────── */
export default function Top15(){
  const [stocks,setStocks]=useState<Stock[]>([]);
  const [loading,setLoading]=useState(true);
  const [showSim,setShowSim]=useState(false);
  const [sortCol,setSortCol]=useState<keyof Stock>("rank");
  const [sortDir,setSortDir]=useState<"asc"|"desc">("asc");

  const loadData=useCallback(async()=>{
    const d=await fetchTop15();
    setStocks(d);
    setLoading(false);
  },[]);

  // Initial load
  useEffect(()=>{ loadData(); },[loadData]);

  const sorted=[...stocks].sort((a,b)=>{const av=a[sortCol]as number,bv=b[sortCol]as number;return sortDir==="asc"?av-bv:bv-av;});
  const toggle=(col:keyof Stock)=>{if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortCol(col);setSortDir("asc");}};

  if(loading) return(
    <div style={{padding:28,display:"flex",flexDirection:"column",gap:12}}>
      {[220,70,70,70,70,70].map((h,i)=>(
        <div key={i} style={{background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)",backgroundSize:"400% 100%",animation:"shimmer 2.2s ease-in-out infinite",borderRadius:14,height:h}}/>
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );

  const ColH=({label,col,right}:{label:string;col:keyof Stock;right?:boolean})=>(
    <th onClick={()=>toggle(col)} style={{...mono,fontSize:9,color:sortCol===col?"#7EB6FF":V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",padding:"11px 12px",cursor:"pointer",userSelect:"none",textAlign:right?"right":"left",fontWeight:sortCol===col?500:400,whiteSpace:"nowrap",background:"rgba(5,8,16,0.7)"}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
        {label}
        {sortCol===col?(sortDir==="asc"?<ChevronUp size={10} color="#7EB6FF"/>:<ChevronDown size={10} color="#7EB6FF"/>):<span style={{opacity:.18}}>⇅</span>}
      </span>
    </th>
  );

  return(
    <div style={{padding:"24px 16px",maxWidth:1280,margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:13}}>
          <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,rgba(232,160,48,0.15),rgba(232,160,48,0.06))",border:"1px solid rgba(232,160,48,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(232,160,48,0.12)"}}>
            <Trophy size={21} color={V.gold}/>
          </div>
          <div>
            <h2 style={{fontSize:19,fontWeight:700,color:V.ink0,margin:0,letterSpacing:"-0.01em"}}>Top 15 Stocks</h2>
            <p style={{...mono,color:V.ink4,fontSize:9,margin:0,marginTop:3,textTransform:"uppercase",letterSpacing:"0.08em"}}>Ranked · momentum × volume × AI confidence</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <button onClick={()=>setShowSim(true)} className="vx-btn vx-btn-arc" style={{fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",fontWeight:600}}>
            <DollarSign size={13}/> Simulate Portfolio
          </button>
        </div>
      </div>

      {/* Countdown bar */}
      <div style={{marginBottom:18}}>
        <CountdownBar
          onRefresh={loadData}
          label="Next ranking update"
        />
      </div>

      {/* Stat strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:18}}>
        {[
          {icon:<TrendingUp size={13} color={V.gain}/>,  label:"Bullish",       val:`${stocks.filter(s=>s.changePct>0).length}/${stocks.length}`},
          {icon:<Shield size={13} color="#7EB6FF"/>,      label:"Avg Confidence",val:`${Math.round(stocks.reduce((s,x)=>s+x.conf,0)/(stocks.length||1))}%`},
          {icon:<Target size={13} color={V.gold}/>,       label:"Avg Upside",   val:`+${(stocks.reduce((s,x)=>s+((x.ceiling-x.price)/x.price)*100,0)/(stocks.length||1)).toFixed(1)}%`},
          {icon:<Zap size={13} color={V.ame}/>,           label:"Sectors",      val:[...new Set(stocks.map(s=>s.sector))].length+" covered"},
        ].map(s=>(
          <div key={s.label} style={{...glass({padding:"12px 16px",display:"flex",alignItems:"center",gap:10})}}>
            <div style={{width:30,height:30,borderRadius:8,background:"rgba(255,255,255,0.04)",border:`1px solid ${V.w1}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
            <div>
              <p style={{...mono,color:V.ink4,fontSize:8,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2}}>{s.label}</p>
              <p style={{...mono,fontSize:14,fontWeight:500,color:V.ink0}}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{...glass({overflow:"hidden"})}}>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:620}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${V.w1}`}}>
                <ColH label="Rank"    col="rank"/>
                <th style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",padding:"11px 12px",textAlign:"left",fontWeight:400,background:"rgba(5,8,16,0.7)",whiteSpace:"nowrap"}}>Ticker</th>
                <th style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.1em",padding:"11px 12px",textAlign:"left",fontWeight:400,background:"rgba(5,8,16,0.7)",whiteSpace:"nowrap",minWidth:130}}>Company</th>
                <ColH label="Price"   col="price"   right/>
                <ColH label="Today"   col="changePct" right/>
                <ColH label="Floor"   col="floor"   right/>
                <ColH label="Ceiling" col="ceiling" right/>
                <ColH label="Conf."   col="conf"    right/>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,idx)=>{
                const up=s.changePct>=0, sc=SECTOR_HUE[s.sector]??"#7A9CBF";
                return(
                  <tr key={s.ticker} style={{borderBottom:`1px solid rgba(130,180,255,0.04)`,transition:"background 0.15s",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.background=V.dh}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:12,color:idx<3?V.gold:V.ink4,fontWeight:500}}>
                        {idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":`#${s.rank}`}
                      </span>
                    </td>
                    <td style={{padding:"14px 12px"}}>
                      <p style={{...mono,fontSize:13,fontWeight:500,color:"#7EB6FF",letterSpacing:"-0.01em",marginBottom:3}}>{s.ticker}</p>
                      <span style={{...mono,fontSize:8,padding:"1px 6px",borderRadius:4,background:`${sc}12`,color:sc,border:`1px solid ${sc}20`}}>{s.sector}</span>
                    </td>
                    <td style={{padding:"14px 12px",fontSize:12,color:V.ink2,maxWidth:150}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{s.name}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:13,fontWeight:500,color:V.ink0}}>{f$(s.price)}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:11,padding:"3px 8px",borderRadius:6,background:up?V.gainDim:V.lossDim,color:up?V.gain:V.loss,border:`1px solid ${up?V.gainWire:V.lossWire}`,display:"inline-flex",alignItems:"center",gap:3}}>
                        {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{fp(s.changePct)}
                      </span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <span style={{...mono,fontSize:12,color:V.loss}}>{f$(s.floor)}</span>
                    </td>
                    <td style={{padding:"14px 12px",textAlign:"right"}}>
                      <p style={{...mono,fontSize:12,color:V.gain,fontWeight:500}}>{f$(s.ceiling)}</p>
                      <p style={{...mono,fontSize:9,color:V.ink4}}>+{(((s.ceiling-s.price)/s.price)*100).toFixed(1)}%</p>
                    </td>
                    <td style={{padding:"14px 16px 14px 12px",minWidth:120}}>
                      <ConfBar pct={s.conf}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{...mono,color:V.ink4,fontSize:9,marginTop:12,lineHeight:1.6}}>
        ⚡ Refreshes every 15 min · Rankings reflect momentum, volume, and AI signal strength · Not financial advice
      </p>

      {showSim&&<SimModal stocks={stocks} onClose={()=>setShowSim(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
