import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

/* ── Dynamic Open Graph image generator ───────────────────────
   Renders a 1200×630 PNG card on demand for any ticker, portfolio,
   or arbitrary text. Used by:
     - /stock/[ticker]    → ?type=ticker&t=AAPL
     - /p/[id] share      → ?type=portfolio&grade=A&pnl=24.5&n=8
     - root + everywhere  → default branded card

   Edge runtime so it's fast globally. The fonts are system / web
   fonts that ImageResponse can resolve at the edge. */

function pillBg(positive: boolean): string {
  return positive ? "rgba(0,229,160,0.16)" : "rgba(255,69,96,0.16)";
}
function pillFg(positive: boolean): string {
  return positive ? "#00e5a0" : "#ff4560";
}

async function fetchTickerSnap(ticker: string): Promise<{
  name: string;
  price: number;
  changePct: number;
} | null> {
  try {
    const [snap, ref] = await Promise.all([
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500) }),
      fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500) }),
    ]);
    if (!snap.ok) return null;
    const sd = await snap.json() as { ticker?: { day: { c: number }; prevDay: { c: number } } };
    const cur  = sd.ticker?.day?.c, prev = sd.ticker?.prevDay?.c;
    if (!cur || !prev) return null;
    let name = ticker;
    if (ref.ok) {
      const rd = await ref.json() as { results?: { name?: string } };
      name = rd.results?.name ?? ticker;
    }
    return { name, price: cur, changePct: ((cur - prev) / prev) * 100 };
  } catch { return null; }
}

const Logo = (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 11,
      background: "linear-gradient(135deg, #f0a500 0%, #ffbe1a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 26, fontWeight: 900, color: "#0a0800",
      fontFamily: "'Inter', system-ui, sans-serif",
      letterSpacing: "-0.04em",
    }}>X</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#f4f0ff", letterSpacing: "-0.02em", fontFamily: "'Inter', system-ui, sans-serif" }}>ArbibX</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#7A9CBF", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>AI Stock Terminal</div>
    </div>
  </div>
);

const cardBaseStyle = {
  width: "100%",
  height: "100%",
  background: "#08060f",
  position: "relative" as const,
  display: "flex",
  flexDirection: "column" as const,
  fontFamily: "'Inter', system-ui, sans-serif",
  color: "#f4f0ff",
  padding: "56px 64px",
  boxSizing: "border-box" as const,
};

const goldGlow = (
  <div style={{
    position: "absolute",
    top: -180, right: -120,
    width: 600, height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(240,165,0,0.22) 0%, transparent 65%)",
    display: "flex",
  }} />
);

const purpleGlow = (
  <div style={{
    position: "absolute",
    bottom: -180, left: -120,
    width: 520, height: 520,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(155,114,245,0.16) 0%, transparent 60%)",
    display: "flex",
  }} />
);

const accentBar = (
  <div style={{
    position: "absolute", top: 0, left: 0, right: 0,
    height: 4,
    background: "linear-gradient(90deg, #f0a500 0%, #ff6b35 50%, #f0a500 100%)",
    display: "flex",
  }} />
);

/* ── Templates ──────────────────────────────────────────── */

function TickerCard(args: { ticker: string; name: string; price: number | null; changePct: number | null }) {
  const { ticker, name, price, changePct } = args;
  const hasPrice = price != null && changePct != null;
  const positive = (changePct ?? 0) >= 0;

  return (
    <div style={cardBaseStyle}>
      {accentBar}
      {goldGlow}
      {purpleGlow}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
        {Logo}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 99,
          background: "rgba(240,165,0,0.10)",
          border: "1px solid rgba(240,165,0,0.40)",
        }}>
          <div style={{ width: 7, height: 7, borderRadius: 99, background: "#f0a500", display: "flex" }} />
          <span style={{ fontSize: 13, color: "#f0a500", fontWeight: 600, fontFamily: "'Courier New', monospace", letterSpacing: "0.10em" }}>LIVE • AI ANALYSIS</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 60, zIndex: 2 }}>
        <span style={{ fontSize: 17, color: "#7A9CBF", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
          Stock analysis
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontSize: 130, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.05em", color: "#f4f0ff", fontFamily: "'Inter', system-ui, sans-serif" }}>
            {ticker}
          </span>
          {hasPrice && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 12,
              background: pillBg(positive),
              border: `1px solid ${pillFg(positive)}40`,
              color: pillFg(positive),
              fontSize: 28, fontWeight: 700,
              fontFamily: "'Courier New', monospace",
            }}>
              <span>{positive ? "▲" : "▼"}</span>
              <span>{positive ? "+" : ""}{(changePct ?? 0).toFixed(2)}%</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: 32, color: "#cdc7e0", fontWeight: 500, marginTop: 4 }}>
          {name.slice(0, 60)}
        </span>
        {hasPrice && (
          <span style={{ fontSize: 56, fontWeight: 800, color: "#f0a500", marginTop: 14, fontFamily: "'Courier New', monospace", letterSpacing: "-0.02em" }}>
            ${price?.toFixed(2)}
          </span>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 36, left: 64, right: 64,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 2,
      }}>
        <span style={{ fontSize: 17, color: "#7A9CBF", fontWeight: 500 }}>
          Live charts • AI signals • Earnings • News
        </span>
        <span style={{ fontSize: 17, color: "#f0a500", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Courier New', monospace" }}>
          arbibx.com
        </span>
      </div>
    </div>
  );
}

function PortfolioCard(args: { grade: string; pnl: number | null; positions: number | null; name?: string }) {
  const { grade, pnl, positions, name } = args;
  const positive = (pnl ?? 0) >= 0;
  const gradeColor = grade.startsWith("A") ? "#00e5a0" : grade.startsWith("B") ? "#f0a500" : grade.startsWith("C") ? "#ffbe1a" : "#ff4560";

  return (
    <div style={cardBaseStyle}>
      {accentBar}
      {goldGlow}
      {purpleGlow}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
        {Logo}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 14px", borderRadius: 99,
          background: "rgba(155,114,245,0.10)",
          border: "1px solid rgba(155,114,245,0.40)",
        }}>
          <span style={{ fontSize: 13, color: "#9B72F5", fontWeight: 600, fontFamily: "'Courier New', monospace", letterSpacing: "0.10em" }}>SHARED PORTFOLIO</span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 56, marginTop: 70, zIndex: 2 }}>
        {/* Grade circle */}
        <div style={{
          width: 220, height: 220, borderRadius: "50%",
          background: `${gradeColor}1A`,
          border: `4px solid ${gradeColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 130, fontWeight: 900, color: gradeColor, lineHeight: 1, letterSpacing: "-0.04em" }}>{grade}</span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 17, color: "#7A9CBF", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            AI portfolio grade
          </span>
          {name && (
            <span style={{ fontSize: 38, color: "#f4f0ff", fontWeight: 700, letterSpacing: "-0.01em" }}>
              {name.slice(0, 36)}
            </span>
          )}
          {pnl != null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span style={{ fontSize: 64, fontWeight: 800, color: pillFg(positive), fontFamily: "'Courier New', monospace", letterSpacing: "-0.02em" }}>
                {positive ? "+" : ""}{pnl.toFixed(1)}%
              </span>
              <span style={{ fontSize: 22, color: "#7A9CBF", fontWeight: 500 }}>total return</span>
            </div>
          )}
          {positions != null && (
            <span style={{ fontSize: 22, color: "#cdc7e0", fontWeight: 500 }}>
              {positions} {positions === 1 ? "position" : "positions"}
            </span>
          )}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 36, left: 64, right: 64,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 2,
      }}>
        <span style={{ fontSize: 17, color: "#7A9CBF", fontWeight: 500 }}>
          AI grading • Performance • Holdings breakdown
        </span>
        <span style={{ fontSize: 17, color: "#f0a500", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Courier New', monospace" }}>
          arbibx.com
        </span>
      </div>
    </div>
  );
}

function DefaultCard(args: { headline?: string; subhead?: string }) {
  const headline = args.headline ?? "AI-powered stock terminal";
  const subhead  = args.subhead  ?? "Live charts, AI Top 15, earnings, news, and portfolio analytics";

  return (
    <div style={cardBaseStyle}>
      {accentBar}
      {goldGlow}
      {purpleGlow}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 2 }}>
        {Logo}
        <span style={{
          padding: "8px 14px", borderRadius: 99,
          background: "rgba(0,229,160,0.10)",
          border: "1px solid rgba(0,229,160,0.40)",
          fontSize: 13, color: "#00e5a0", fontWeight: 700,
          fontFamily: "'Courier New', monospace", letterSpacing: "0.12em",
        }}>POWERED BY CLAUDE AI</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28, marginTop: 90, zIndex: 2 }}>
        <span style={{
          fontSize: 88, fontWeight: 900,
          letterSpacing: "-0.04em", lineHeight: 1.02,
          color: "#f4f0ff",
          maxWidth: 920,
        }}>
          {headline}
        </span>
        <span style={{ fontSize: 28, color: "#cdc7e0", fontWeight: 500, lineHeight: 1.4, maxWidth: 920 }}>
          {subhead}
        </span>
      </div>

      <div style={{
        position: "absolute", bottom: 36, left: 64, right: 64,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 2,
      }}>
        <span style={{ fontSize: 17, color: "#7A9CBF", fontWeight: 500 }}>
          Real-time market data • AI analysis • Public sharing
        </span>
        <span style={{ fontSize: 17, color: "#f0a500", fontWeight: 700, letterSpacing: "0.06em", fontFamily: "'Courier New', monospace" }}>
          arbibx.com
        </span>
      </div>
    </div>
  );
}

/* ── Handler ────────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type  = searchParams.get("type") ?? "default";
  const debug = searchParams.get("debug") === "1";

  const SIZE = { width: 1200, height: 630 };

  // Inner render with explicit catch so a CSS issue in one template
  // can't kill the whole route. Each branch first tries to render
  // its specific card; if that throws (Satori CSS quirk, etc.), we
  // fall through to the always-safe DefaultCard.
  const renderSafe = async (jsx: React.ReactElement): Promise<Response> => {
    try {
      return new ImageResponse(jsx, SIZE);
    } catch (err) {
      console.error("[og] inner render failed:", err);
      if (debug) {
        return new Response(`OG render error: ${err instanceof Error ? err.message : String(err)}`, {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        });
      }
      try {
        return new ImageResponse(<DefaultCard />, SIZE);
      } catch (err2) {
        console.error("[og] fallback render failed:", err2);
        return new Response("OG render failed", { status: 500 });
      }
    }
  };

  try {
    if (type === "ticker") {
      const ticker = (searchParams.get("t") ?? "").toUpperCase().slice(0, 8);
      if (!ticker) return renderSafe(<DefaultCard />);
      const snap = await fetchTickerSnap(ticker);
      return renderSafe(
        <TickerCard
          ticker={ticker}
          name={snap?.name ?? ticker}
          price={snap?.price ?? null}
          changePct={snap?.changePct ?? null}
        />
      );
    }

    if (type === "portfolio") {
      const grade  = (searchParams.get("grade") ?? "A").slice(0, 3);
      const pnlRaw = parseFloat(searchParams.get("pnl") ?? "");
      const posRaw = parseInt(searchParams.get("n") ?? "", 10);
      const name   = searchParams.get("name") ?? undefined;
      return renderSafe(
        <PortfolioCard
          grade={grade}
          pnl={Number.isFinite(pnlRaw) ? pnlRaw : null}
          positions={Number.isFinite(posRaw) ? posRaw : null}
          name={name}
        />
      );
    }

    // Default + custom-headline cards
    const headline = searchParams.get("h") ?? undefined;
    const subhead  = searchParams.get("s") ?? undefined;
    return renderSafe(<DefaultCard headline={headline} subhead={subhead} />);
  } catch (err) {
    console.error("[og] outer error:", err);
    if (debug) {
      return new Response(`OG outer error: ${err instanceof Error ? err.message : String(err)}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return renderSafe(<DefaultCard />);
  }
}
