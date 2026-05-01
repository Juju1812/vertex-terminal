"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  TrendingUp, TrendingDown, ArrowLeft, BookOpen,
  Eye, Lock, Calendar,
} from "lucide-react";

interface SharedHolding {
  ticker: string;
  shares: number | null;
  buyPrice: number;
  currentPrice: number;
  costBasis: number | null;
  marketValue: number | null;
  pnlDollar: number | null;
  pnlPct: number;
}

interface ShareData {
  id: string;
  capturedAt: string;
  ownerHandle: string | null;
  showAmounts: boolean;
  holdings: SharedHolding[];
  totalReturnPct: number;
}

const f$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const mono: React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

export default function SharedPortfolioView({ id }: { id: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/share/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((d: ShareData) => { setData(d); setLoading(false); })
      .catch(async err => {
        setError(err?.status === 404 ? "Share not found" : "Failed to load share");
        setLoading(false);
      });
  }, [id]);

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.010) 100%)",
    border: "1px solid var(--border,rgba(60,48,100,0.5))",
    borderRadius: 16,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Syne',system-ui,sans-serif" }}>
        <div className="skel" style={{ width: 320, height: 200, borderRadius: 16 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Syne',system-ui,sans-serif", color: "var(--ink1,#cdc7e0)" }}>
        <div style={{ ...cardStyle, padding: 32, maxWidth: 400, textAlign: "center" }}>
          <h1 style={{ ...display, fontSize: 24, color: "var(--ink0,#f4f0ff)", margin: "0 0 10px" }}>{error ?? "Share not found"}</h1>
          <p style={{ fontSize: 14, color: "var(--ink2,#7A9CBF)", marginBottom: 20 }}>
            This share link doesn&apos;t exist or has been removed.
          </p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 9, background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.30)", color: "var(--gold,#f0a500)", textDecoration: "none", ...mono, fontSize: 12 }}>
            <ArrowLeft size={12} /> Back to ArbibX
          </Link>
        </div>
      </div>
    );
  }

  const totalUp = data.totalReturnPct >= 0;
  const winners = data.holdings.filter(h => h.pnlPct > 0).length;
  const losers  = data.holdings.filter(h => h.pnlPct < 0).length;

  return (
    <div style={{ minHeight: "100vh", color: "var(--ink1,#cdc7e0)", fontFamily: "'Syne',system-ui,sans-serif" }}>
      {/* Header — uses CSS variable for theme parity */}
      <header className="vx-page-header" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(40px) saturate(2)", WebkitBackdropFilter: "blur(40px) saturate(2)", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--ink2,#7A9CBF)", textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "linear-gradient(135deg,#f0a500,#ff6b35)" }}>
              <Image src="/logo.png" alt="ArbibX" width={28} height={28} style={{ objectFit: "cover" }} unoptimized />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ ...mono, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: "var(--ink0,#f4f0ff)" }}>ArbibX</div>
              <div style={{ ...mono, fontSize: 7, color: "var(--ink4,#1F3550)", letterSpacing: "0.2em", marginTop: 1 }}>TERMINAL</div>
            </div>
          </Link>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, background: "linear-gradient(135deg,#f0a500,#ffbe1a)", color: "#0a0500", textDecoration: "none", fontFamily: "'Cabinet Grotesk',system-ui,sans-serif", fontSize: 12, fontWeight: 700 }}>
            Try ArbibX free
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 16px 64px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Hero */}
        <div style={{ ...cardStyle, padding: "24px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <BookOpen size={14} color="var(--gold,#f0a500)" />
            <span style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Shared portfolio snapshot
            </span>
          </div>
          <h1 style={{ ...display, fontSize: "clamp(24px,4vw,36px)", fontWeight: 800, color: "var(--ink0,#f4f0ff)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            {data.ownerHandle ? `${data.ownerHandle}'s portfolio` : "Anonymous portfolio"}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ ...mono, fontSize: 11, color: "var(--ink3,#3D5A7A)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Calendar size={11} /> Captured {new Date(data.capturedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span style={{ ...mono, fontSize: 11, padding: "3px 9px", borderRadius: 6, background: data.showAmounts ? "rgba(255,255,255,0.04)" : "rgba(240,165,0,0.10)", border: `1px solid ${data.showAmounts ? "var(--border,rgba(60,48,100,0.5))" : "rgba(240,165,0,0.28)"}`, color: data.showAmounts ? "var(--ink2,#7A9CBF)" : "var(--gold,#f0a500)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              {data.showAmounts ? <><Eye size={11} /> Showing $ amounts</> : <><Lock size={11} /> $ amounts hidden</>}
            </span>
          </div>

          {/* Aggregate */}
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div>
              <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Avg return / position</p>
              <p style={{ ...mono, fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: totalUp ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)" }}>{fp(data.totalReturnPct)}</p>
            </div>
            <div>
              <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Positions</p>
              <p style={{ ...mono, fontSize: 26, fontWeight: 600, color: "var(--ink0,#f4f0ff)" }}>{data.holdings.length}</p>
              <p style={{ ...mono, fontSize: 10, color: "var(--ink3,#3D5A7A)", marginTop: 2 }}>{winners}W · {losers}L</p>
            </div>
          </div>
        </div>

        {/* Holdings */}
        <div style={cardStyle}>
          <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
            <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>Positions</h2>
          </div>
          <div>
            {data.holdings.map((h, i) => {
              const up = h.pnlPct >= 0;
              return (
                <a key={`${h.ticker}-${i}`} href={`/stock/${h.ticker}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: data.showAmounts
                      ? "minmax(80px, 100px) 1fr minmax(100px, auto) minmax(100px, auto)"
                      : "minmax(80px, 100px) 1fr minmax(100px, auto)",
                    alignItems: "center", gap: 14,
                    padding: "14px 22px",
                    borderBottom: i < data.holdings.length - 1 ? "1px solid var(--border,rgba(60,48,100,0.5))" : "none",
                    textDecoration: "none", transition: "background 0.15s",
                  }}
                  className="row-hover">
                  <span style={{ ...mono, fontSize: 14, fontWeight: 500, color: "var(--ticker-blue,#7EB6FF)" }}>{h.ticker}</span>
                  <div>
                    <p style={{ ...mono, fontSize: 11, color: "var(--ink3,#3D5A7A)", margin: 0 }}>
                      {f$(h.buyPrice)} → {f$(h.currentPrice)}
                    </p>
                    {data.showAmounts && h.shares != null && (
                      <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", margin: "2px 0 0" }}>
                        {h.shares} shares
                      </p>
                    )}
                  </div>
                  {data.showAmounts && h.marketValue != null && (
                    <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: "var(--ink0,#f4f0ff)", textAlign: "right" }}>
                      {f$(h.marketValue)}
                    </span>
                  )}
                  <span style={{ ...mono, fontSize: 13, fontWeight: 600, color: up ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)", textAlign: "right", display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {fp(h.pnlPct)}
                  </span>
                </a>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div style={{ ...cardStyle, padding: "18px 26px", textAlign: "center", background: "linear-gradient(135deg, rgba(240,165,0,0.06) 0%, rgba(255,107,53,0.04) 100%)" }}>
          <p style={{ ...display, fontSize: 16, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: "0 0 6px" }}>
            Want your own AI-picked portfolio?
          </p>
          <p style={{ fontSize: 13, color: "var(--ink2,#7A9CBF)", margin: "0 0 14px" }}>
            Free to sign up · Claude AI screens 250+ stocks every hour
          </p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "11px 22px", borderRadius: 10, background: "linear-gradient(135deg,#f0a500,#ffbe1a)", color: "#0a0500", textDecoration: "none", ...display, fontSize: 13, fontWeight: 800, letterSpacing: "0.02em", boxShadow: "0 4px 24px rgba(240,165,0,0.32)" }}>
            Open ArbibX Terminal
          </Link>
        </div>

        <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 8 }}>
          Snapshot · Not financial advice · Past performance ≠ future results
        </p>
      </main>
    </div>
  );
}
