import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import {
  Brain, Database, Filter, Sparkles, ListChecks, RefreshCw,
  ShieldAlert, BookOpen, ExternalLink, Layers, Activity, Target,
} from "lucide-react";

/* ── /methodology — public explainer page ──────────────────
   Tells users (and Pro buyers) exactly how the AI Top 15 is
   produced: what data goes in, which models run, what each
   signal means, refresh cadence, and the limits. Built as a
   real indexable page so it can be linked from the upgrade
   modal, the footer, the Top 15 tab itself, and shared. */

export const metadata: Metadata = {
  title: "Methodology — How the ArbibX AI picks stocks",
  description: "A transparent walkthrough of how the ArbibX AI Top 15 is generated: data sources, screening pipeline, the Claude model chain, signal definitions, refresh cadence, and limitations.",
  alternates: { canonical: "https://www.arbibx.com/methodology" },
  keywords: ["ArbibX methodology", "AI stock picks methodology", "Claude AI stocks", "stock screening methodology", "AI investment research"],
  openGraph: {
    title: "How the ArbibX AI picks stocks",
    description: "Inside the data pipeline + Claude model chain that produces the daily AI Top 15.",
    type: "article",
    url:  "https://www.arbibx.com/methodology",
    siteName: "ArbibX",
    images: [{
      url: `https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("How the AI picks stocks")}&s=${encodeURIComponent("Data pipeline + Claude model chain · transparent methodology")}`,
      width: 1200, height: 630,
      alt: "ArbibX methodology"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How the ArbibX AI picks stocks",
    description: "Inside the data pipeline + Claude model chain.",
    images: [`https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("How the AI picks stocks")}`],
  },
  robots: { index: true, follow: true },
};

/* ── Tokens (server-safe inline styles) ─────────────────── */
const ink0   = "var(--ink0, #f4f0ff)";
const ink1   = "var(--ink1, #cdc7e0)";
const ink2   = "var(--ink2, #7A9CBF)";
const ink3   = "var(--ink3, #3D5A7A)";
const ink4   = "var(--ink4, #1F3550)";
const gold   = "var(--gold, #f0a500)";
const goldDim  = "rgba(240,165,0,0.08)";
const goldWire = "rgba(240,165,0,0.28)";
const ame    = "#9B72F5";
const ameDim   = "rgba(155,114,245,0.08)";
const ameWire  = "rgba(155,114,245,0.28)";
const gain   = "var(--gain, #00e5a0)";
const loss   = "var(--loss, #ff4560)";
const border = "var(--border, rgba(60,48,100,0.5))";

const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };
const mono:    React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };

/* ── Pipeline stages ─────────────────────────────────────── */
const STAGES = [
  {
    icon: <Database size={20} color={gold}/>,
    label: "01 · Universe",
    title: "Pre-screen the market",
    body: "Each refresh starts with the top ~250 most-liquid US tickers across mega/large/mid-cap names — a curated universe drawn from Polygon's daily aggregates. Penny stocks, OTC names, and anything with broken data are excluded up front.",
  },
  {
    icon: <Filter size={20} color={gold}/>,
    label: "02 · Screen",
    title: "Trim to ~30 candidates",
    body: "Quantitative filters narrow the universe to roughly thirty names the model is allowed to rank. Filters look at recent price momentum, RSI extremes, distance from SMA20/SMA50, volume vs. its 30-day average, ATR (volatility), 52-week levels, and proximity to upcoming earnings. The goal is to feed the AI a high-signal short list rather than the whole market.",
  },
  {
    icon: <Brain size={20} color={ame}/>,
    label: "03 · Analyse",
    title: "Claude does the heavy lifting",
    body: "Each candidate's full quantitative profile + recent news headlines are sent to Anthropic's Claude. We use a model fallback chain — Opus 4.7 (default) → Sonnet 4.6 → Haiku 4.5 — so a temporary Opus rate-limit just downgrades the analysis instead of breaking it. Claude is prompted as a senior quantitative analyst and must cite specific numerical evidence for every recommendation.",
  },
  {
    icon: <ListChecks size={20} color={ame}/>,
    label: "04 · Rank",
    title: "Output the Top 15",
    body: "Claude returns a structured JSON array: 15 picks with a signal (Strong Buy / Buy / Hold / Sell), a confidence score, a target price, a one-line thesis, and the key risk. We sanity-check the JSON, snapshot the result to the Track Record table, and serve it to the front end.",
  },
];

/* ── Signal cheat-sheet ──────────────────────────────────── */
const SIGNALS = [
  { label: "Strong Buy", color: gain, body: "High-conviction setup. Multiple positive signals stacked (momentum + volume + favourable news + technical break). Target price typically 8-15% above current." },
  { label: "Buy",        color: gain, body: "Constructive setup with at least one strong tailwind. Reasonable risk/reward over the next 1-4 weeks. Target price typically 4-8% above current." },
  { label: "Hold",       color: ink2, body: "Neutral. Either the signals contradict or the stock has already priced in the obvious catalysts. Not a sell — just not a fresh buy here." },
  { label: "Sell",       color: loss, body: "Negative bias. Used when momentum is rolling over, RSI is overbought into resistance, or news flow has turned. Communicates risk to existing holders." },
];

/* ── Data sources ─────────────────────────────────────────── */
const SOURCES = [
  { name: "Polygon.io",       what: "Daily/intraday OHLCV bars, snapshot quotes, 52-week levels, volume — the price truth source." },
  { name: "Polygon News",     what: "Recent headlines per ticker so Claude can weigh sentiment, not just price action." },
  { name: "Polygon Reference",what: "Sector/industry classification, name + ticker mapping, fundamentals like market cap." },
  { name: "Anthropic Claude", what: "The actual ranking + thesis writing. Currently Opus 4.7 (1M ctx) with Sonnet/Haiku fallback." },
];

/* ── FAQ entries ─────────────────────────────────────────── */
const FAQ = [
  {
    q: "How often does the Top 15 refresh?",
    a: "Up to once every couple of hours during US market hours, and once overnight. The 'Run fresh analysis' button on the Top 15 tab lets you force a refresh; the result is cached for everyone so we don't burn through API quota with one-off requests.",
  },
  {
    q: "Is this financial advice?",
    a: "No. ArbibX is a research and screening tool — every page on this site is informational only. Picks are the model's read of public market data, not a personalised recommendation. Always do your own research and consult a licensed advisor before making investment decisions.",
  },
  {
    q: "Does the AI know your portfolio?",
    a: "The Top 15 model does not. It analyses the market in isolation and produces the same list for every user. The separate AI Portfolio Grade feature (Pro) is what looks at your specific holdings and writes personalised feedback.",
  },
  {
    q: "How is the confidence score calculated?",
    a: "The model assigns it directly based on how many signals agree and how cleanly they align. It's a heuristic, not a probability — a 90% confidence pick is not 'a 90% chance of being right'. Treat it as the AI's relative ordering, not a literal forecast.",
  },
  {
    q: "Can the AI hallucinate a ticker or price?",
    a: "We post-validate every pick: the ticker must exist in the candidate set we sent, prices must round-trip against Polygon, and the JSON shape is enforced. If any check fails, that pick is dropped before you see it.",
  },
  {
    q: "How is past performance shown?",
    a: "Every analysis run is snapshotted to a Track Record table. The Track Record tab compares each historical Buy/Strong Buy pick's price-at-pick vs. today's price and benchmarks the average return against the S&P 500 over the same window. There's no survivorship bias — losing picks stay in the data.",
  },
];

export default function MethodologyPage() {
  return (
    <div style={{ minHeight:"100vh", background:"var(--void,#050407)", display:"flex", flexDirection:"column", color:ink1 }}>
      <main style={{ flex:1, maxWidth:880, margin:"0 auto", padding:"56px 22px 48px", width:"100%" }}>

        {/* Back link */}
        <div style={{ marginBottom:18 }}>
          <Link href="/" style={{ ...mono, fontSize:11, color:ink3, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:6, letterSpacing:"0.06em" }}>
            ← Back to terminal
          </Link>
        </div>

        {/* Header */}
        <div style={{
          padding:"32px 30px",
          borderRadius:18,
          background:`linear-gradient(135deg, ${goldDim} 0%, ${ameDim} 100%)`,
          border:`1px solid ${goldWire}`,
          marginBottom:28,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:`linear-gradient(135deg,#f0a500,#ffbe1a)`,
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <Brain size={18} color="#0a0800"/>
            </div>
            <span style={{ ...mono, fontSize:10, color:gold, textTransform:"uppercase", letterSpacing:"0.16em", fontWeight:700 }}>
              Methodology
            </span>
          </div>
          <h1 style={{ ...display, fontSize:"clamp(28px,4.5vw,42px)", fontWeight:900, color:ink0, margin:"0 0 12px", letterSpacing:"-0.03em", lineHeight:1.1 }}>
            How the ArbibX AI picks stocks
          </h1>
          <p style={{ fontSize:15, color:ink2, margin:0, lineHeight:1.6, maxWidth:640 }}>
            Most AI stock tools tell you <em>what</em> to buy. This page tells you <em>how</em> they got there — the data, the models, the screens, and the things the system can&apos;t see. Read this before you act on a pick.
          </p>
        </div>

        {/* Pipeline */}
        <Section icon={<Layers size={16} color={gold}/>} eyebrow="The pipeline" title="From 11,000 tickers to 15 picks, in four stages">
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {STAGES.map((s, i) => (
              <div key={s.label} style={{
                position:"relative",
                padding:"18px 22px",
                borderRadius:14,
                background:"rgba(255,255,255,0.02)",
                border:`1px solid ${border}`,
              }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                  <div style={{
                    width:42, height:42, borderRadius:11,
                    background: i < 2 ? goldDim : ameDim,
                    border: `1px solid ${i < 2 ? goldWire : ameWire}`,
                    display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                  }}>
                    {s.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ ...mono, fontSize:9, color: i < 2 ? gold : ame, textTransform:"uppercase", letterSpacing:"0.16em", margin:"0 0 4px", fontWeight:700 }}>
                      {s.label}
                    </p>
                    <h3 style={{ ...display, fontSize:16, fontWeight:700, color:ink0, margin:"0 0 8px", letterSpacing:"-0.01em" }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize:13.5, color:ink2, lineHeight:1.65, margin:0 }}>
                      {s.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Signal definitions */}
        <Section icon={<Target size={16} color={gold}/>} eyebrow="Signal cheat-sheet" title="What Strong Buy / Buy / Hold / Sell actually mean">
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:10 }}>
            {SIGNALS.map(s => (
              <div key={s.label} style={{
                padding:"16px 18px",
                borderRadius:12,
                background:"rgba(255,255,255,0.02)",
                border:`1px solid ${border}`,
              }}>
                <p style={{ ...mono, fontSize:11, color:s.color, textTransform:"uppercase", letterSpacing:"0.10em", margin:"0 0 8px", fontWeight:700 }}>
                  {s.label}
                </p>
                <p style={{ fontSize:12.5, color:ink2, lineHeight:1.6, margin:0 }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontSize:12, color:ink3, lineHeight:1.6, margin:"14px 0 0", padding:"10px 14px", borderRadius:10, background:"rgba(255,69,96,0.05)", border:"1px solid rgba(255,69,96,0.20)" }}>
            <ShieldAlert size={11} color={loss} style={{ display:"inline", verticalAlign:"-1px", marginRight:6 }}/>
            <strong style={{ color:loss }}>Important:</strong> these are short-horizon read-the-tape calls, not long-term recommendations. Confidence is the model&apos;s self-rated conviction, not a probability of being right.
          </p>
        </Section>

        {/* Data sources */}
        <Section icon={<Database size={16} color={gold}/>} eyebrow="Sources" title="Where the data actually comes from">
          <div style={{ display:"flex", flexDirection:"column", gap:0, borderRadius:14, overflow:"hidden", border:`1px solid ${border}` }}>
            {SOURCES.map((s, i) => (
              <div key={s.name} style={{
                display:"grid",
                gridTemplateColumns:"160px 1fr",
                gap:14,
                padding:"14px 18px",
                background:"rgba(255,255,255,0.02)",
                borderTop: i === 0 ? "none" : `1px solid ${border}`,
              }} className="vx-source-row">
                <span style={{ ...mono, fontSize:12, color:gold, fontWeight:700 }}>{s.name}</span>
                <span style={{ fontSize:12.5, color:ink2, lineHeight:1.55 }}>{s.what}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Refresh cadence + limits */}
        <Section icon={<RefreshCw size={16} color={gold}/>} eyebrow="Cadence + limits" title="What this system can &amp; can&apos;t do">
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }} className="vx-can-grid">
            <Capability good title="Spot multi-signal setups fast"
              body="The screener narrows ~250 names to a tight short list, and Claude reads the technicals + headlines together — that's hours of manual work in seconds."/>
            <Capability good title="Show its work"
              body="Every pick comes with the numerical evidence Claude cited. You can drill into the stock detail view and verify the indicators yourself."/>
            <Capability good title="Track itself honestly"
              body="The Track Record tab keeps every historical Buy/Strong Buy pick — winners and losers — and benchmarks the average against the S&amp;P 500."/>
            <Capability title="Predict short-term price moves"
              body="It can&apos;t. Markets are noisy. Treat picks as research starting points, not forecasts."/>
            <Capability title="Read your inbox or social media"
              body="The model only sees the data we feed it. Headlines yes, your Discord chatter no."/>
            <Capability title="Account for taxes, fees, or your situation"
              body="Position sizing, capital gains, timing for your tax year — none of that is in the prompt. That part is on you."/>
          </div>
        </Section>

        {/* FAQ */}
        <Section icon={<BookOpen size={16} color={gold}/>} eyebrow="FAQ" title="Questions we get a lot">
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {FAQ.map(item => (
              <details key={item.q} style={{
                padding:"14px 18px",
                borderRadius:12,
                background:"rgba(255,255,255,0.02)",
                border:`1px solid ${border}`,
              }}>
                <summary style={{ ...display, fontSize:14, fontWeight:700, color:ink0, cursor:"pointer", listStyle:"none", letterSpacing:"-0.005em" }}>
                  {item.q}
                </summary>
                <p style={{ fontSize:13, color:ink2, lineHeight:1.65, margin:"10px 0 0" }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </Section>

        {/* Trust banner */}
        <div style={{
          marginTop:36,
          padding:"22px 26px",
          borderRadius:16,
          background:"rgba(155,114,245,0.05)",
          border:`1px solid ${ameWire}`,
          display:"flex", alignItems:"flex-start", gap:14,
        }}>
          <Sparkles size={18} color={ame} style={{ flexShrink:0, marginTop:2 }}/>
          <div>
            <p style={{ ...display, fontSize:15, fontWeight:700, color:ink0, margin:"0 0 6px" }}>
              We update this page when the methodology changes
            </p>
            <p style={{ fontSize:13, color:ink2, lineHeight:1.6, margin:"0 0 12px" }}>
              Models, prompts, and screening rules evolve. If we change something material to how picks are generated, this page is the source of truth — bookmark it.
            </p>
            <Link href="/pricing" style={{
              ...mono, fontSize:11, fontWeight:700, color:gold, textDecoration:"none",
              display:"inline-flex", alignItems:"center", gap:6,
              padding:"7px 14px", borderRadius:8,
              background:goldDim, border:`1px solid ${goldWire}`,
              letterSpacing:"0.06em",
            }}>
              See what Pro unlocks <ExternalLink size={11}/>
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <p style={{ ...mono, fontSize:9, color:ink4, textAlign:"center", marginTop:32, textTransform:"uppercase", letterSpacing:"0.14em" }}>
          Informational only · Not investment advice · Past performance ≠ future results
        </p>
      </main>

      <Footer />

      <style>{`
        details summary::-webkit-details-marker { display: none; }
        details summary::after {
          content: "+";
          float: right;
          font-family: 'DM Mono', monospace;
          color: ${ink3};
          font-weight: 400;
          margin-left: 12px;
        }
        details[open] summary::after { content: "−"; }
        @media (max-width: 640px) {
          .vx-can-grid { grid-template-columns: 1fr !important; }
          .vx-source-row { grid-template-columns: 1fr !important; gap: 4px !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Section header + body wrapper ──────────────────────── */
function Section({ icon, eyebrow, title, children }: {
  icon: React.ReactNode;
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        {icon}
        <span style={{ ...mono, fontSize:9, color:ink3, textTransform:"uppercase", letterSpacing:"0.16em", fontWeight:700 }}>
          {eyebrow}
        </span>
      </div>
      <h2 style={{ ...display, fontSize:22, fontWeight:800, color:ink0, margin:"0 0 16px", letterSpacing:"-0.02em" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ── Capability tile (for "what we can / can't do") ───── */
function Capability({ title, body, good }: { title: string; body: string; good?: boolean }) {
  return (
    <div style={{
      padding:"14px 16px",
      borderRadius:12,
      background: good ? "rgba(0,229,160,0.04)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${good ? "rgba(0,229,160,0.22)" : border}`,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
        {good
          ? <Activity size={11} color={gain}/>
          : <ShieldAlert size={11} color={loss}/>}
        <p style={{ ...mono, fontSize:9, color: good ? gain : loss, textTransform:"uppercase", letterSpacing:"0.10em", margin:0, fontWeight:700 }}>
          {good ? "Strength" : "Limit"}
        </p>
      </div>
      <p style={{ ...display, fontSize:13.5, fontWeight:700, color:ink0, margin:"0 0 5px", letterSpacing:"-0.005em" }}>
        {title}
      </p>
      <p style={{ fontSize:12, color:ink2, lineHeight:1.55, margin:0 }}>
        {body}
      </p>
    </div>
  );
}
