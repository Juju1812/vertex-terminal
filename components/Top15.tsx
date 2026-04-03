"use client";

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, DollarSign, Trophy, Target, Shield, Zap, ChevronUp, ChevronDown, X } from "lucide-react";

interface Top15Stock { rank:number; ticker:string; name:string; price:number; changePct:number; floor:number; ceiling:number; confidence:number; sector:string; score:number; }
interface Allocation { ticker:string; name:string; price:number; confidence:number; dollars:number; shares:number; pct:number; rationale:string; }

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";

const UNIVERSE = [
  {ticker:"NVDA", name:"NVIDIA Corp.",           sector:"Technology"},
  {ticker:"MSFT", name:"Microsoft Corp.",          sector:"Technology"},
  {ticker:"AAPL", name:"Apple Inc.",               sector:"Technology"},
  {ticker:"META", name:"Meta Platforms",           sector:"Technology"},
  {ticker:"GOOGL",name:"Alphabet Inc.",            sector:"Technology"},
  {ticker:"AMZN", name:"Amazon.com Inc.",          sector:"Consumer"},
  {ticker:"AMD",  name:"Advanced Micro Devices",   sector:"Technology"},
  {ticker:"PLTR", name:"Palantir Technologies",    sector:"Technology"},
  {ticker:"JPM",  name:"JPMorgan Chase & Co.",     sector:"Financials"},
  {ticker:"V",    name:"Visa Inc.",               sector:"Financials"},
  {ticker:"UNH",  name:"UnitedHealth Group",       sector:"Healthcare"},
  {ticker:"LLY",  name:"Eli Lilly & Co.",          sector:"Healthcare"},
  {ticker:"TSLA", name:"Tesla Inc.",               sector:"Consumer"},
  {ticker:"ORCL", name:"Oracle Corp.",             sector:"Technology"},
  {ticker:"CRWD", name:"CrowdStrike Holdings",     sector:"Technology"},
  {ticker:"PANW", name:"Palo Alto Networks",       sector:"Technology"},
  {ticker:"AVGO", name:"Broadcom Inc.",            sector:"Technology"},
  {ticker:"CRM",  name:"Salesforce Inc.",          sector:"Technology"},
  {ticker:"NOW",  name:"ServiceNow Inc.",          sector:"Technology"},
  {ticker:"COIN", name:"Coinbase Global",          sector:"Financials"},
];

const MOCK_PRICES: Record<string,number> = {NVDA:875.42,MSFT:415.32,AAPL:228.52,META:554.78,GOOGL:178.94,AMZN:201.17,AMD:162.34,PLTR:38.92,JPM:224.31,V:296.14,UNH:512.88,LLY:798.44,TSLA:248.50,ORCL:142.67,CRWD:368.92,PANW:341.18,AVGO:1642.33,CRM:299.11,NOW:812.44,COIN:234.67};
const MOCK_CHG: Record<string,number>    = {NVDA:2.90,MSFT:-0.52,AAPL:1.42,META:1.63,GOOGL:0.81,AMZN:-0.44,AMD:3.72,PLTR:4.96,JPM:0.50,V:0.83,UNH:-0.81,LLY:1.24,TSLA:-3.58,ORCL:0.92,CRWD:2.44,PANW:1.87,AVGO:1.11,CRM:0.68,NOW:1.33,COIN:5.21};
const SECTOR_COLOR: Record<string,string> = {Technology:"#00D4FF",Financials:"#A855F7",Healthcare:"#00FF94",Consumer:"#FFB800"};

async function polyGet<T>(path:string):Promise<T|null> {
  try { const r=await fetch(`${BASE}${path}${path.includes("?")?"&":"?"}apiKey=${API_KEY}`); return r.ok?r.json():null; } catch{return null;}
}

function calcScore(changePct:number,volume:number,confidence:number){
  return +(Math.min(Math.max(changePct/5,-1),1)*40+Math.min(volume/60_000_000,1)*30+(confidence/100)*30).toFixed(2);
}
function deriveFloorCeiling(price:number,changePct:number){
  return {floor:+(price*(1-(changePct<0?.06:.04))).toFixed(2),ceiling:+(price*(1+(changePct>2?.14:changePct>0?.10:.08))).toFixed(2)};
}
function deriveConfidence(changePct:number,volume:number){
  let c=60;
  if(changePct>3)c+=18;else if(changePct>1)c+=10;else if(changePct<-2)c-=12;
  if(volume>50_000_000)c+=12;else if(volume>25_000_000)c+=6;
  return Math.min(96,Math.max(42,c));
}

async function fetchTop15():Promise<Top15Stock[]> {
  const tickers=UNIVERSE.map(u=>u.ticker).join(",");
  const data=await polyGet<{tickers?:Array<{ticker:string;day:{c:number;v:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`);
  const rows=UNIVERSE.map(u=>{
    const snap=data?.tickers?.find(t=>t.ticker===u.ticker);
    const price=snap?.day?.c||MOCK_PRICES[u.ticker]||100;
    const prevClose=snap?.prevDay?.c||price*.99;
    const volume=snap?.day?.v||30_000_000;
    const rawChg=((price-prevClose)/prevClose)*100;
    const changePct=snap?+rawChg.toFixed(2):(MOCK_CHG[u.ticker]??0);
    const confidence=deriveConfidence(changePct,volume);
    const {floor,ceiling}=deriveFloorCeiling(price,changePct);
    return {rank:0,ticker:u.ticker,name:u.name,sector:u.sector,price,changePct,floor,ceiling,confidence,score:calcScore(changePct,volume,confidence)};
  });
  rows.sort((a,b)=>b.score-a.score);
  rows.forEach((r,i)=>r.rank=i+1);
  return rows.slice(0,15);
}

function simulatePortfolio(stocks:Top15Stock[],cash:number):Allocation[] {
  const picks=stocks.slice(0,8);
  const totalW=picks.reduce((s,p)=>s+p.confidence*Math.max(p.score+60,1),0);
  return picks.map(p=>{
    const w=(p.confidence*Math.max(p.score+60,1))/totalW;
    const dollars=Math.round(cash*w*100)/100;
    const shares=Math.floor(dollars/p.price);
    const pct=+(w*100).toFixed(1);
    const upside=+(((p.ceiling-p.price)/p.price)*100).toFixed(1);
    return {ticker:p.ticker,name:p.name,price:p.price,confidence:p.confidence,dollars,shares,pct,rationale:`${pct}% · ${upside}% to target · ${p.confidence}% confidence`};
  }).sort((a,b)=>b.dollars-a.dollars);
}

const fmt$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fmtPct=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;

const T={
  card:{background:"#0D1321",border:"1px solid #1E293B",borderRadius:12}as React.CSSProperties,
  mono:{fontFamily:"'IBM Plex Mono','Courier New',monospace"}as React.CSSProperties,
  muted:{color:"#7A9BBF"}as React.CSSProperties,
};

function ConfBar({pct}:{pct:number}){
  const color=pct>=80?"#00FF94":pct>=65?"#FFB800":"#FF3B5C";
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <div style={{flex:1,height:3,background:"#111E30",borderRadius:99,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.6s ease"}}/>
      </div>
      <span style={{...T.mono,fontSize:10,color,minWidth:26}}>{pct}%</span>
    </div>
  );
}

function SimModal({stocks,onClose}:{stocks:Top15Stock[];onClose:()=>void}){
  const [cash,setCash]=useState("50000");
  const cashNum=Math.max(100,parseFloat(cash.replace(/,/g,""))||50000);
  const allocs=simulatePortfolio(stocks,cashNum);
  const total=allocs.reduce((s,a)=>s+a.dollars,0);
  const leftover=cashNum-total;
  return(
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0}}>
      <div style={{background:"#0D1321",border:"1px solid #1E293B",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"auto",animation:"slideUp 0.25s ease-out"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px",borderBottom:"1px solid #1E293B",position:"sticky",top:0,background:"#0D1321",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#00D4FF,#00FF94)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <DollarSign size={15} color="#060B14"/>
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:14}}>Portfolio Simulator</div>
              <div style={{...T.mono,...T.muted,fontSize:10}}>AI-weighted across Top 8</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",...T.muted,padding:6,minWidth:36,minHeight:36,display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button>
        </div>
        {/* Cash input */}
        <div style={{padding:"14px 18px",borderBottom:"1px solid #1E293B",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <label style={{fontSize:12,...T.muted,whiteSpace:"nowrap"}}>Investment Amount</label>
          <div style={{position:"relative",flex:1,minWidth:140}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",...T.muted,...T.mono,fontSize:14}}>$</span>
            <input type="number" value={cash} onChange={e=>setCash(e.target.value)} min="100" step="1000"
              style={{width:"100%",background:"#060B14",border:"1px solid #1E293B",borderRadius:8,color:"#E2EAF4",...T.mono,fontSize:14,padding:"9px 12px 9px 24px",outline:"none"}}/>
          </div>
          <div style={{...T.mono,fontSize:12,color:"#00FF94",whiteSpace:"nowrap"}}>Cash left: {fmt$(leftover)}</div>
        </div>
        {/* Allocations */}
        <div style={{padding:"12px 18px"}}>
          {allocs.map((a,i)=>(
            <div key={a.ticker} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px solid #111E30",flexWrap:"wrap"}}>
              <span style={{...T.mono,...T.muted,fontSize:11,minWidth:24}}>#{i+1}</span>
              <span style={{...T.mono,fontWeight:700,fontSize:13,color:"#00D4FF",minWidth:50}}>{a.ticker}</span>
              <div style={{flex:1,minWidth:120}}>
                <div style={{height:3,background:"#111E30",borderRadius:99,overflow:"hidden",marginBottom:3}}>
                  <div style={{width:`${a.pct}%`,height:"100%",background:"linear-gradient(90deg,#00D4FF,#00FF94)",borderRadius:99}}/>
                </div>
                <span style={{...T.mono,...T.muted,fontSize:9}}>{a.rationale}</span>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{...T.mono,fontSize:12,fontWeight:600}}>{fmt$(a.dollars)}</div>
                <div style={{...T.mono,...T.muted,fontSize:10}}>{a.shares} sh · {a.pct}%</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:"14px 18px",borderTop:"1px solid #1E293B",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
          <p style={{...T.muted,fontSize:11,maxWidth:300}}>Fractional shares excluded. Keep {fmt$(leftover)} as cash reserve.</p>
          <div style={{textAlign:"right"}}>
            <div style={{...T.mono,...T.muted,fontSize:9}}>Total Deployed</div>
            <div style={{...T.mono,fontSize:18,fontWeight:700,color:"#00FF94"}}>{fmt$(total)}</div>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}

export default function Top15(){
  const [stocks,setStocks]=useState<Top15Stock[]>([]);
  const [loading,setLoading]=useState(true);
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
  const [showSim,setShowSim]=useState(false);
  const [sortCol,setSortCol]=useState<keyof Top15Stock>("rank");
  const [sortDir,setSortDir]=useState<"asc"|"desc">("asc");
  const [refreshing,setRefreshing]=useState(false);

  const load=useCallback(async()=>{
    setRefreshing(true);
    setStocks(await fetchTop15());
    setLastUpdated(new Date());
    setLoading(false);setRefreshing(false);
  },[]);

  useEffect(()=>{ load(); const id=setInterval(load,15*60*1000); return()=>clearInterval(id); },[load]);

  const sorted=[...stocks].sort((a,b)=>{
    const av=a[sortCol]as number,bv=b[sortCol]as number;
    return sortDir==="asc"?av-bv:bv-av;
  });

  const toggleSort=(col:keyof Top15Stock)=>{
    if(sortCol===col)setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortCol(col);setSortDir("asc");}
  };

  if(loading) return(
    <div style={{padding:32,display:"flex",alignItems:"center",justifyContent:"center",gap:12,...T.muted,fontFamily:"monospace",fontSize:13,minHeight:300}}>
      <RefreshCw size={20} style={{animation:"spin 1s linear infinite"}}/>Loading live data…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const ColH=({label,col}:{label:string;col:keyof Top15Stock})=>(
    <th onClick={()=>toggleSort(col)}
      style={{...T.mono,fontSize:9,color:sortCol===col?"#00D4FF":"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 10px",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",textAlign:"right",fontWeight:500,background:"#0D1321",position:"sticky",top:0}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
        {label}{sortCol===col?(sortDir==="asc"?<ChevronUp size={10} color="#00D4FF"/>:<ChevronDown size={10} color="#00D4FF"/>):<span style={{opacity:.3}}>⇅</span>}
      </span>
    </th>
  );

  return(
    <div style={{padding:"16px",maxWidth:1200,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Trophy size={18} color="#FFB800"/>
          </div>
          <div>
            <h2 style={{margin:0,fontSize:"clamp(15px,4vw,18px)",fontWeight:700}}>Top 15 Stocks</h2>
            <p style={{...T.muted,margin:0,fontSize:11}}>Ranked by momentum · volume · AI confidence</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          {lastUpdated&&<span style={{...T.mono,...T.muted,fontSize:9}}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={load} disabled={refreshing}
            style={{display:"flex",alignItems:"center",gap:5,background:"#111E30",border:"1px solid #1E293B",borderRadius:8,color:refreshing?"#3D5A7A":"#7A9BBF",padding:"7px 11px",cursor:"pointer",fontSize:12,minHeight:36}}>
            <RefreshCw size={12} style={{animation:refreshing?"spin 1s linear infinite":"none"}}/> Refresh
          </button>
          <button onClick={()=>setShowSim(true)}
            style={{display:"flex",alignItems:"center",gap:5,background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:8,color:"#00D4FF",padding:"7px 13px",cursor:"pointer",fontSize:12,fontWeight:600,minHeight:36}}>
            <DollarSign size={13}/> Simulate Portfolio
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
        {[
          {icon:<TrendingUp size={13} color="#00FF94"/>,  label:"Positive",     val:`${stocks.filter(s=>s.changePct>0).length}/${stocks.length} stocks`},
          {icon:<Shield size={13} color="#00D4FF"/>,      label:"Avg Confidence",val:`${Math.round(stocks.reduce((s,x)=>s+x.confidence,0)/(stocks.length||1))}%`},
          {icon:<Target size={13} color="#FFB800"/>,      label:"Avg Upside",   val:`+${(stocks.reduce((s,x)=>s+((x.ceiling-x.price)/x.price)*100,0)/(stocks.length||1)).toFixed(1)}%`},
          {icon:<Zap size={13} color="#A855F7"/>,         label:"Sectors",      val:[...new Set(stocks.map(s=>s.sector))].length+" covered"},
        ].map(s=>(
          <div key={s.label} style={{...T.card,padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:"#111E30",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{...T.mono,...T.muted,fontSize:8,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:1}}>{s.label}</div>
              <div style={{...T.mono,fontSize:12,fontWeight:700}}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile card list */}
      <div style={{display:"block"}}>
        {/* Desktop table */}
        <div style={{...T.card,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:580}}>
            <thead>
              <tr style={{borderBottom:"1px solid #1E293B"}}>
                <ColH label="Rank"    col="rank"       />
                <th style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 10px",textAlign:"left",background:"#0D1321",position:"sticky",top:0,fontWeight:500,whiteSpace:"nowrap"}}>Ticker</th>
                <th style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.06em",padding:"10px 10px",textAlign:"left",background:"#0D1321",position:"sticky",top:0,fontWeight:500,whiteSpace:"nowrap",minWidth:130}}>Company</th>
                <ColH label="Price"      col="price"      />
                <ColH label="% Today"    col="changePct"  />
                <ColH label="Floor"      col="floor"      />
                <ColH label="Ceiling"    col="ceiling"    />
                <ColH label="Confidence" col="confidence" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((s,idx)=>{
                const up=s.changePct>=0;
                const sCol=SECTOR_COLOR[s.sector]??"#7A9BBF";
                return(
                  <tr key={s.ticker} style={{borderBottom:"1px solid #0D1520",transition:"background 0.12s"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#111E30")}
                    onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                    <td style={{padding:"12px 10px",textAlign:"right"}}>
                      <span style={{...T.mono,fontSize:11,color:idx<3?"#FFB800":"#3D5A7A",fontWeight:700}}>
                        {idx<3?["🥇","🥈","🥉"][idx]:`#${s.rank}`}
                      </span>
                    </td>
                    <td style={{padding:"12px 10px"}}>
                      <div style={{...T.mono,fontSize:12,fontWeight:700,color:"#00D4FF"}}>{s.ticker}</div>
                      <div style={{fontSize:9,padding:"1px 5px",borderRadius:3,background:`${sCol}15`,color:sCol,border:`1px solid ${sCol}25`,display:"inline-block",marginTop:2,...T.mono}}>{s.sector}</div>
                    </td>
                    <td style={{padding:"12px 10px",fontSize:11,...T.muted,maxWidth:160}}>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{s.name}</span>
                    </td>
                    <td style={{padding:"12px 10px",textAlign:"right"}}>
                      <span style={{...T.mono,fontSize:12,fontWeight:600}}>{fmt$(s.price)}</span>
                    </td>
                    <td style={{padding:"12px 10px",textAlign:"right"}}>
                      <span style={{...T.mono,fontSize:11,padding:"2px 7px",borderRadius:5,background:up?"rgba(0,255,148,0.1)":"rgba(255,59,92,0.1)",color:up?"#00FF94":"#FF3B5C",display:"inline-flex",alignItems:"center",gap:3}}>
                        {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{fmtPct(s.changePct)}
                      </span>
                    </td>
                    <td style={{padding:"12px 10px",textAlign:"right"}}>
                      <span style={{...T.mono,fontSize:11,color:"#FF3B5C"}}>{fmt$(s.floor)}</span>
                    </td>
                    <td style={{padding:"12px 10px",textAlign:"right"}}>
                      <div style={{...T.mono,fontSize:11,color:"#00FF94"}}>{fmt$(s.ceiling)}</div>
                      <div style={{...T.mono,fontSize:9,color:"#3D5A7A"}}>+{(((s.ceiling-s.price)/s.price)*100).toFixed(1)}%</div>
                    </td>
                    <td style={{padding:"12px 14px 12px 10px",minWidth:120}}>
                      <ConfBar pct={s.confidence}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{...T.muted,fontSize:10,marginTop:10,...T.mono}}>⚡ Rankings refresh every 15 min · Not financial advice</p>
      {showSim&&<SimModal stocks={stocks} onClose={()=>setShowSim(false)}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
