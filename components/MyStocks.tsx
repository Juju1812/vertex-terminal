"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw, BookOpen, Star, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";

interface Holding { id:string; ticker:string; shares:number; buyPrice:number; }
interface EnrichedHolding extends Holding { name:string; currentPrice:number; totalCost:number; currentValue:number; pnl:number; pnlPct:number; dayChangePct:number; }
interface PortfolioGrade { letter:string; score:number; summary:string; strengths:string[]; weaknesses:string[]; suggestions:string[]; }

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const STORAGE_KEY = "vertex-my-stocks";

const KNOWN: Record<string,{name:string;price:number;dayChg:number}> = {
  AAPL:{name:"Apple Inc.",              price:228.52,dayChg: 1.42},
  MSFT:{name:"Microsoft Corp.",          price:415.32,dayChg:-0.52},
  NVDA:{name:"NVIDIA Corp.",             price:875.42,dayChg: 2.90},
  GOOGL:{name:"Alphabet Inc.",           price:178.94,dayChg: 0.81},
  META:{name:"Meta Platforms",           price:554.78,dayChg: 1.63},
  TSLA:{name:"Tesla Inc.",              price:248.50,dayChg:-3.58},
  AMZN:{name:"Amazon.com Inc.",          price:201.17,dayChg:-0.44},
  AMD:{name:"Advanced Micro Devices",    price:162.34,dayChg: 3.72},
  PLTR:{name:"Palantir Technologies",    price: 38.92,dayChg: 4.96},
  JPM:{name:"JPMorgan Chase & Co.",      price:224.31,dayChg: 0.50},
  V:{name:"Visa Inc.",                   price:296.14,dayChg: 0.83},
  UNH:{name:"UnitedHealth Group",        price:512.88,dayChg:-0.81},
  LLY:{name:"Eli Lilly & Co.",           price:798.44,dayChg: 1.24},
  AVGO:{name:"Broadcom Inc.",            price:1642.33,dayChg:1.11},
  CRM:{name:"Salesforce Inc.",           price:299.11,dayChg: 0.68},
};

async function polyGet<T>(path:string):Promise<T|null>{
  try{const r=await fetch(`${BASE}${path}${path.includes("?")?"&":"?"}apiKey=${API_KEY}`);return r.ok?r.json():null;}catch{return null;}
}

async function fetchPrices(tickers:string[]):Promise<Record<string,{price:number;dayChg:number;name:string}>>{
  if(!tickers.length)return{};
  const data=await polyGet<{tickers?:Array<{ticker:string;day:{c:number};prevDay:{c:number}}>}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}`);
  const result:Record<string,{price:number;dayChg:number;name:string}>={};
  tickers.forEach(t=>{
    const snap=data?.tickers?.find(x=>x.ticker===t);
    const known=KNOWN[t];
    if(snap?.day?.c&&snap?.prevDay?.c){
      const price=snap.day.c,dayChg=((price-snap.prevDay.c)/snap.prevDay.c)*100;
      result[t]={price,dayChg:+dayChg.toFixed(2),name:known?.name??t};
    }else if(known){result[t]={price:known.price,dayChg:known.dayChg,name:known.name};}
    else{result[t]={price:0,dayChg:0,name:t};}
  });
  return result;
}

function gradePortfolio(holdings:EnrichedHolding[]):PortfolioGrade{
  if(!holdings.length)return{letter:"N/A",score:0,summary:"Add holdings to receive a grade.",strengths:[],weaknesses:[],suggestions:["Add at least 3 holdings to get started."]};
  let score=50;
  const strengths:string[]=[],weaknesses:string[]=[],suggestions:string[]=[];
  const count=holdings.length;
  if(count>=8){score+=15;strengths.push(`Well diversified across ${count} positions.`);}
  else if(count>=5){score+=8;strengths.push(`Reasonable diversification (${count} positions).`);}
  else if(count<3){score-=10;weaknesses.push("Highly concentrated — fewer than 3 holdings.");suggestions.push("Add 3–5 more holdings from different sectors.");}
  const winners=holdings.filter(h=>h.pnlPct>0).length;
  const winRate=winners/count;
  if(winRate>0.7){score+=15;strengths.push(`${winners}/${count} positions are profitable.`);}
  else if(winRate>0.5)score+=7;
  else if(winRate<0.35){score-=12;weaknesses.push(`${count-winners}/${count} positions are in the red.`);suggestions.push("Review losing positions — consider trimming those down >15%.");}
  const avgReturn=holdings.reduce((s,h)=>s+h.pnlPct,0)/count;
  if(avgReturn>20){score+=15;strengths.push(`Exceptional avg return of +${avgReturn.toFixed(1)}%.`);}
  else if(avgReturn>10){score+=10;strengths.push(`Solid avg return of +${avgReturn.toFixed(1)}%.`);}
  else if(avgReturn>0)score+=4;
  else if(avgReturn<-10){score-=15;weaknesses.push(`Portfolio down ${avgReturn.toFixed(1)}% on average.`);suggestions.push("Reallocate from underperformers to stronger momentum names.");}
  else if(avgReturn<0)score-=6;
  const totalValue=holdings.reduce((s,h)=>s+h.currentValue,0);
  const maxPct=Math.max(...holdings.map(h=>(h.currentValue/totalValue)*100));
  if(maxPct>40){score-=8;weaknesses.push(`Top position is ${maxPct.toFixed(0)}% of portfolio.`);suggestions.push("Trim your largest position to under 25%.");}
  else if(maxPct<25){score+=6;strengths.push("No single position dominates — good balance.");}
  const techTickers=["NVDA","MSFT","AAPL","META","GOOGL","AMD","PLTR","ORCL","CRWD","CRM","AVGO"];
  const techPct=holdings.filter(h=>techTickers.includes(h.ticker)).length/count;
  if(techPct>0.8){score-=6;weaknesses.push("Heavy tech concentration.");suggestions.push("Add Financials, Healthcare, or Consumer exposure.");}
  else if(techPct<0.5){score+=5;strengths.push("Good sector balance beyond tech.");}
  score=Math.min(100,Math.max(0,Math.round(score)));
  const letter=score>=95?"A+":score>=90?"A":score>=85?"A-":score>=80?"B+":score>=75?"B":score>=70?"B-":score>=65?"C+":score>=60?"C":score>=55?"C-":score>=50?"D+":score>=45?"D":"F";
  const summary=score>=85?"Outstanding portfolio — excellent diversification and strong returns.":score>=70?"Good portfolio with room for improvement.":score>=55?"Average portfolio — notable weaknesses need addressing.":"Below-average portfolio — significant changes recommended.";
  if(!suggestions.length)suggestions.push("Keep monitoring momentum and rebalance quarterly.");
  return{letter,score,summary,strengths,weaknesses,suggestions};
}

const fmt$=(n:number,d=2)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const fmtPct=(n:number)=>`${n>=0?"+":""}${n.toFixed(2)}%`;
const gradeColor=(l:string)=>l.startsWith("A")?"#00FF94":l.startsWith("B")?"#00D4FF":l.startsWith("C")?"#FFB800":l.startsWith("D")?"#FF7B00":"#FF3B5C";

const T={
  card:{background:"#0D1321",border:"1px solid #1E293B",borderRadius:12}as React.CSSProperties,
  cardSm:{background:"#0D1321",border:"1px solid #1E293B",borderRadius:8}as React.CSSProperties,
  mono:{fontFamily:"'IBM Plex Mono','Courier New',monospace"}as React.CSSProperties,
  muted:{color:"#7A9BBF"}as React.CSSProperties,
};

function AddForm({onAdd}:{onAdd:(h:Omit<Holding,"id">)=>void}){
  const [ticker,setTicker]=useState("");
  const [shares,setShares]=useState("");
  const [buyPrice,setBuyPrice]=useState("");
  const [err,setErr]=useState("");
  const inp:React.CSSProperties={background:"#060B14",border:"1px solid #1E293B",borderRadius:7,color:"#E2EAF4",...T.mono,fontSize:14,padding:"10px 10px",outline:"none",width:"100%"};
  const submit=()=>{
    const t=ticker.trim().toUpperCase(),s=parseFloat(shares),b=parseFloat(buyPrice);
    if(!t)return setErr("Enter a ticker.");
    if(!s||s<=0)return setErr("Enter valid share count.");
    if(!b||b<=0)return setErr("Enter valid buy price.");
    onAdd({ticker:t,shares:s,buyPrice:b});
    setTicker("");setShares("");setBuyPrice("");setErr("");
  };
  return(
    <div style={{...T.card,padding:14,marginBottom:14}}>
      <p style={{fontSize:11,...T.muted,marginBottom:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",...T.mono}}>Add Holding</p>
      {/* Mobile: stacked; Desktop: grid */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,alignItems:"end"}}>
        <div>
          <label style={{fontSize:9,color:"#3D5A7A",display:"block",marginBottom:4,...T.mono,textTransform:"uppercase",letterSpacing:"0.07em"}}>Ticker</label>
          <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder="e.g. AAPL" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div>
          <label style={{fontSize:9,color:"#3D5A7A",display:"block",marginBottom:4,...T.mono,textTransform:"uppercase",letterSpacing:"0.07em"}}>Shares</label>
          <input value={shares} onChange={e=>setShares(e.target.value)} placeholder="10" type="number" min="0.001" step="any" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div>
          <label style={{fontSize:9,color:"#3D5A7A",display:"block",marginBottom:4,...T.mono,textTransform:"uppercase",letterSpacing:"0.07em"}}>Buy Price ($)</label>
          <input value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} placeholder="180.00" type="number" min="0.01" step="any" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div style={{display:"flex",alignItems:"flex-end"}}>
          <button onClick={submit}
            style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(0,212,255,0.12)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:7,color:"#00D4FF",padding:"10px 16px",cursor:"pointer",fontSize:13,fontWeight:600,width:"100%",minHeight:42}}>
            <Plus size={14}/> Add
          </button>
        </div>
      </div>
      {err&&<p style={{color:"#FF3B5C",fontSize:11,marginTop:8,...T.mono}}>⚠ {err}</p>}
    </div>
  );
}

export default function MyStocks(){
  const [holdings,setHoldings]=useState<Holding[]>([]);
  const [prices,setPrices]=useState<Record<string,{price:number;dayChg:number;name:string}>>({});
  const [loading,setLoading]=useState(false);
  const [lastFetch,setLastFetch]=useState<Date|null>(null);

  useEffect(()=>{try{const s=localStorage.getItem(STORAGE_KEY);if(s)setHoldings(JSON.parse(s));}catch{}},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(holdings));}catch{}},[holdings]);

  const fetchAll=useCallback(async()=>{
    if(!holdings.length)return;
    setLoading(true);
    setPrices(await fetchPrices([...new Set(holdings.map(h=>h.ticker))]));
    setLastFetch(new Date());setLoading(false);
  },[holdings]);
  useEffect(()=>{fetchAll();},[fetchAll]);

  const addHolding=(h:Omit<Holding,"id">)=>setHoldings(prev=>[...prev,{...h,id:`${Date.now()}-${Math.random()}`}]);
  const removeHolding=(id:string)=>setHoldings(prev=>prev.filter(h=>h.id!==id));

  const enriched:EnrichedHolding[]=holdings.map(h=>{
    const p=prices[h.ticker];
    const currentPrice=p?.price||h.buyPrice;
    const totalCost=h.shares*h.buyPrice,currentValue=h.shares*currentPrice;
    const pnl=currentValue-totalCost,pnlPct=((currentPrice-h.buyPrice)/h.buyPrice)*100;
    return{...h,name:p?.name||KNOWN[h.ticker]?.name||h.ticker,currentPrice,totalCost,currentValue,pnl,pnlPct,dayChangePct:p?.dayChg||0};
  });

  const totalCost=enriched.reduce((s,h)=>s+h.totalCost,0);
  const totalValue=enriched.reduce((s,h)=>s+h.currentValue,0);
  const totalPnl=totalValue-totalCost;
  const totalPnlPct=totalCost>0?(totalPnl/totalCost)*100:0;
  const grade=gradePortfolio(enriched);
  const gradeCol=gradeColor(grade.letter);

  return(
    <div style={{padding:"16px",maxWidth:1200,margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:10,background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <BookOpen size={18} color="#A855F7"/>
          </div>
          <div>
            <h2 style={{margin:0,fontSize:"clamp(15px,4vw,18px)",fontWeight:700}}>My Stocks</h2>
            <p style={{...T.muted,margin:0,fontSize:11}}>Track holdings · P&L · AI Portfolio Grade</p>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {lastFetch&&<span style={{...T.mono,...T.muted,fontSize:9}}>Updated {lastFetch.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading||!holdings.length}
            style={{display:"flex",alignItems:"center",gap:5,background:"#111E30",border:"1px solid #1E293B",borderRadius:8,color:loading?"#3D5A7A":"#7A9BBF",padding:"7px 11px",cursor:"pointer",fontSize:12,minHeight:36}}>
            <RefreshCw size={12} style={{animation:loading?"spin 1s linear infinite":"none"}}/> Refresh
          </button>
        </div>
      </div>

      <AddForm onAdd={addHolding}/>

      {holdings.length>0&&(
        <>
          {/* Summary strip */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
            {[
              {label:"Portfolio Value",val:fmt$(totalValue),color:"#E2EAF4"},
              {label:"Total Cost",     val:fmt$(totalCost), color:"#7A9BBF"},
              {label:"Total P&L",      val:fmt$(totalPnl),  color:totalPnl>=0?"#00FF94":"#FF3B5C"},
              {label:"Total Return",   val:fmtPct(totalPnlPct),color:totalPnlPct>=0?"#00FF94":"#FF3B5C"},
            ].map(s=>(
              <div key={s.label} style={{...T.cardSm,padding:"10px 12px"}}>
                <div style={{...T.mono,...T.muted,fontSize:9,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.label}</div>
                <div style={{...T.mono,fontSize:"clamp(14px,3.5vw,18px)",fontWeight:700,color:s.color}}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Holdings — responsive scroll table */}
          <div style={{...T.card,overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:12}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
              <thead>
                <tr style={{borderBottom:"1px solid #1E293B"}}>
                  {["Ticker","Company","Shares","Buy $","Current $","Value","P&L","Return","Today",""].map(h=>(
                    <th key={h} style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.06em",padding:"9px 10px",textAlign:h===""?"center":"left",fontWeight:500,whiteSpace:"nowrap",background:"#0D1321"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(h=>{
                  const up=h.pnlPct>=0,dayUp=h.dayChangePct>=0;
                  return(
                    <tr key={h.id} style={{borderBottom:"1px solid #0D1520",transition:"background 0.12s"}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#111E30")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <td style={{padding:"11px 10px"}}><span style={{...T.mono,fontSize:12,fontWeight:700,color:"#00D4FF"}}>{h.ticker}</span></td>
                      <td style={{padding:"11px 10px",fontSize:11,...T.muted,maxWidth:130}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{h.name}</span></td>
                      <td style={{padding:"11px 10px",...T.mono,fontSize:11}}>{h.shares.toLocaleString()}</td>
                      <td style={{padding:"11px 10px",...T.mono,fontSize:11}}>{fmt$(h.buyPrice)}</td>
                      <td style={{padding:"11px 10px",...T.mono,fontSize:12,fontWeight:600}}>{h.currentPrice>0?fmt$(h.currentPrice):<span style={T.muted}>—</span>}</td>
                      <td style={{padding:"11px 10px",...T.mono,fontSize:11}}>{fmt$(h.currentValue)}</td>
                      <td style={{padding:"11px 10px"}}><span style={{...T.mono,fontSize:11,color:up?"#00FF94":"#FF3B5C"}}>{up?"+":""}{fmt$(h.pnl)}</span></td>
                      <td style={{padding:"11px 10px"}}>
                        <span style={{...T.mono,fontSize:10,padding:"2px 6px",borderRadius:4,background:up?"rgba(0,255,148,0.1)":"rgba(255,59,92,0.1)",color:up?"#00FF94":"#FF3B5C",display:"inline-flex",alignItems:"center",gap:3}}>
                          {up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{fmtPct(h.pnlPct)}
                        </span>
                      </td>
                      <td style={{padding:"11px 10px"}}><span style={{...T.mono,fontSize:10,color:dayUp?"#00FF94":"#FF3B5C"}}>{fmtPct(h.dayChangePct)}</span></td>
                      <td style={{padding:"11px 10px",textAlign:"center"}}>
                        <button onClick={()=>removeHolding(h.id)}
                          style={{background:"none",border:"none",cursor:"pointer",color:"#3D5A7A",padding:4,borderRadius:4,minWidth:32,minHeight:32,display:"flex",alignItems:"center",justifyContent:"center"}}
                          onMouseEnter={e=>(e.currentTarget.style.color="#FF3B5C")}
                          onMouseLeave={e=>(e.currentTarget.style.color="#3D5A7A")}>
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* AI Grade */}
          <div style={{...T.card,overflow:"hidden"}}>
            {/* Grade row */}
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {/* Top: badge + summary */}
              <div style={{display:"flex",alignItems:"stretch",borderBottom:"1px solid #1E293B",flexWrap:"wrap"}}>
                <div style={{padding:"20px 22px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRight:"1px solid #1E293B",minWidth:100,background:`${gradeCol}08`,flexShrink:0}}>
                  <div style={{...T.mono,fontSize:9,color:gradeCol,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>Grade</div>
                  <div style={{fontSize:48,fontWeight:900,lineHeight:1,color:gradeCol,textShadow:`0 0 25px ${gradeCol}44`}}>{grade.letter}</div>
                  <div style={{...T.mono,fontSize:10,color:gradeCol,marginTop:4}}>{grade.score}/100</div>
                </div>
                <div style={{flex:1,padding:"18px 18px",minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                    <Star size={14} color={gradeCol} fill={gradeCol}/>
                    <span style={{fontWeight:700,fontSize:13}}>AI Portfolio Analysis</span>
                  </div>
                  <p style={{...T.muted,fontSize:12,lineHeight:1.6,margin:"0 0 12px"}}>{grade.summary}</p>
                  <div style={{height:4,background:"#111E30",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${grade.score}%`,background:`linear-gradient(90deg,${gradeCol}66,${gradeCol})`,borderRadius:99,transition:"width 0.8s ease"}}/>
                  </div>
                </div>
              </div>

              {/* Three cols — stack on mobile */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))"}}>
                <div style={{padding:"14px 16px",borderRight:"1px solid #1E293B"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                    <CheckCircle size={12} color="#00FF94"/>
                    <span style={{fontSize:10,fontWeight:700,color:"#00FF94",textTransform:"uppercase",letterSpacing:"0.07em"}}>Strengths</span>
                  </div>
                  {grade.strengths.length?grade.strengths.map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:7,marginBottom:7}}>
                      <span style={{color:"#00FF94",fontSize:12,marginTop:1}}>✓</span>
                      <span style={{fontSize:11,...T.muted,lineHeight:1.5}}>{s}</span>
                    </div>
                  )):<p style={{...T.muted,fontSize:11}}>None yet.</p>}
                </div>
                <div style={{padding:"14px 16px",borderRight:"1px solid #1E293B"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                    <XCircle size={12} color="#FF3B5C"/>
                    <span style={{fontSize:10,fontWeight:700,color:"#FF3B5C",textTransform:"uppercase",letterSpacing:"0.07em"}}>Weaknesses</span>
                  </div>
                  {grade.weaknesses.length?grade.weaknesses.map((w,i)=>(
                    <div key={i} style={{display:"flex",gap:7,marginBottom:7}}>
                      <AlertTriangle size={11} color="#FF3B5C" style={{marginTop:2,flexShrink:0}}/>
                      <span style={{fontSize:11,...T.muted,lineHeight:1.5}}>{w}</span>
                    </div>
                  )):<p style={{...T.muted,fontSize:11}}>No major weaknesses.</p>}
                </div>
                <div style={{padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
                    <Info size={12} color="#00D4FF"/>
                    <span style={{fontSize:10,fontWeight:700,color:"#00D4FF",textTransform:"uppercase",letterSpacing:"0.07em"}}>Suggestions</span>
                  </div>
                  {grade.suggestions.map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:7,marginBottom:7}}>
                      <span style={{color:"#00D4FF",fontSize:12,marginTop:1}}>→</span>
                      <span style={{fontSize:11,...T.muted,lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!holdings.length&&(
        <div style={{...T.card,padding:48,textAlign:"center"}}>
          <BookOpen size={32} color="#1E293B" style={{marginBottom:10}}/>
          <p style={{fontSize:14,fontWeight:600,marginBottom:5}}>No holdings yet</p>
          <p style={{...T.muted,fontSize:12}}>Add your first stock above to start tracking.</p>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
