"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Copy, Check, Sun, Moon, ArrowLeft } from "lucide-react";

/* ── Embed builder UI ─────────────────────────────────────────
   Live preview + copy-pasteable iframe code. Three knobs:
   ticker, theme, size. Snippet updates instantly. */

const POPULAR = ["AAPL","NVDA","TSLA","MSFT","GOOGL","META","AMZN","SPY","QQQ","BTC"];

const SIZES = [
  { label: "Compact",   w: 280, h: 200 },
  { label: "Standard",  w: 320, h: 240 },
  { label: "Wide",      w: 480, h: 240 },
] as const;

export default function EmbedBuilderClient() {
  const [ticker, setTicker] = useState("AAPL");
  const [theme, setTheme]   = useState<"dark" | "light">("dark");
  const [sizeIdx, setSizeIdx] = useState(1);
  const [copied, setCopied]   = useState(false);

  const size = SIZES[sizeIdx];
  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 8) || "AAPL";

  const iframeSrc = useMemo(() => {
    const params = theme === "light" ? "?theme=light" : "";
    return `https://www.arbibx.com/embed/${cleanTicker}${params}`;
  }, [cleanTicker, theme]);

  const snippet = useMemo(() => {
    return `<iframe src="${iframeSrc}" width="${size.w}" height="${size.h}" frameborder="0" style="border-radius:12px;border:none" loading="lazy"></iframe>`;
  }, [iframeSrc, size.w, size.h]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* */ }
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: "var(--void, #050407)",
      color: "var(--ink1, #cdc7e0)",
      fontFamily: "'Syne', system-ui, sans-serif",
      padding: "32px 20px 60px",
    }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontFamily: "'DM Mono', monospace", fontSize: 10,
            color: "var(--gold, #f0a500)",
            textTransform: "uppercase", letterSpacing: "0.16em",
            margin: 0, marginBottom: 8, fontWeight: 600,
          }}>
            Free · No signup required
          </p>
          <h1 style={{
            fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
            fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 700,
            color: "var(--ink0, #f4f0ff)",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}>
            Embed live stock widgets
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
            Drop a live, AI-linked ArbibX card into any Substack, Notion page, blog, or website.
            Live price, 30-day sparkline, click-through to full analysis. Free, no API key,
            updates automatically.
          </p>
        </div>

        {/* Two-column: controls + preview */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 18,
          marginBottom: 22,
        }} className="vx-embed-grid">

          {/* Controls */}
          <div style={{
            padding: 22,
            borderRadius: 14,
            border: "1px solid var(--border, rgba(60,48,100,0.5))",
            background: "rgba(255,255,255,0.02)",
            display: "flex", flexDirection: "column", gap: 18,
          }}>
            {/* Ticker input */}
            <div>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Ticker
              </label>
              <input value={ticker}
                onChange={e => setTicker(e.target.value)}
                placeholder="AAPL"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border, rgba(60,48,100,0.5))",
                  color: "var(--ink0, #f4f0ff)",
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'DM Mono', monospace",
                  letterSpacing: "0.04em",
                  outline: "none",
                  textTransform: "uppercase",
                  boxSizing: "border-box",
                }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {POPULAR.map(t => (
                  <button key={t} onClick={() => setTicker(t)}
                    style={{
                      padding: "4px 9px", borderRadius: 99,
                      background: cleanTicker === t ? "rgba(240,165,0,0.14)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${cleanTicker === t ? "rgba(240,165,0,0.40)" : "var(--border, rgba(60,48,100,0.5))"}`,
                      color: cleanTicker === t ? "var(--gold, #f0a500)" : "var(--ink2, #7A9CBF)",
                      fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600,
                      cursor: "pointer",
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Theme
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([{ k: "dark", icon: <Moon size={13} /> }, { k: "light", icon: <Sun size={13} /> }] as const).map(opt => {
                  const active = theme === opt.k;
                  return (
                    <button key={opt.k} onClick={() => setTheme(opt.k)}
                      style={{
                        padding: "9px 12px", borderRadius: 9,
                        background: active ? "rgba(240,165,0,0.10)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(240,165,0,0.40)" : "var(--border, rgba(60,48,100,0.5))"}`,
                        color: active ? "var(--gold, #f0a500)" : "var(--ink2, #7A9CBF)",
                        fontSize: 12, fontWeight: 600, fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                        cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                        textTransform: "capitalize",
                      }}>
                      {opt.icon} {opt.k}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size */}
            <div>
              <label style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, display: "block", marginBottom: 8 }}>
                Size
              </label>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${SIZES.length}, 1fr)`, gap: 8 }}>
                {SIZES.map((s, i) => {
                  const active = i === sizeIdx;
                  return (
                    <button key={s.label} onClick={() => setSizeIdx(i)}
                      style={{
                        padding: "9px 8px", borderRadius: 9,
                        background: active ? "rgba(240,165,0,0.10)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${active ? "rgba(240,165,0,0.40)" : "var(--border, rgba(60,48,100,0.5))"}`,
                        color: active ? "var(--gold, #f0a500)" : "var(--ink2, #7A9CBF)",
                        cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 2, alignItems: "center",
                        fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                      }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: active ? "var(--gold, #f0a500)" : "var(--ink4, #1F3550)" }}>{s.w}×{s.h}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: 22,
            borderRadius: 14,
            border: "1px solid var(--border, rgba(60,48,100,0.5))",
            background: "rgba(255,255,255,0.02)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 280,
          }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, alignSelf: "flex-start", margin: "0 0 12px" }}>
              Live preview
            </p>
            <iframe
              key={`${cleanTicker}-${theme}-${sizeIdx}`}
              src={iframeSrc}
              width={size.w}
              height={size.h}
              frameBorder={0}
              style={{ border: "none", borderRadius: 12, maxWidth: "100%" }}
              loading="lazy"
            />
          </div>
        </div>

        {/* Snippet */}
        <div style={{
          padding: 18,
          borderRadius: 14,
          border: "1px solid var(--border, rgba(60,48,100,0.5))",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, margin: 0 }}>
              Embed code · paste into your blog
            </p>
            <button onClick={copy}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 9,
                background: copied ? "rgba(0,229,160,0.14)" : "linear-gradient(135deg,#f0a500,#ffbe1a)",
                color: copied ? "var(--gain, #00e5a0)" : "#0a0800",
                border: copied ? "1px solid rgba(0,229,160,0.32)" : "none",
                fontSize: 12, fontWeight: 700,
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                cursor: "pointer",
              }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre style={{
            margin: 0,
            padding: "14px 16px",
            background: "rgba(0,0,0,0.30)",
            borderRadius: 9,
            border: "1px solid var(--border, rgba(60,48,100,0.4))",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "var(--ink1, #cdc7e0)",
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.5,
          }}>
{snippet}
          </pre>
        </div>

        {/* How-to */}
        <section style={{ marginTop: 28, fontSize: 14, lineHeight: 1.7, color: "var(--ink2, #7A9CBF)" }}>
          <h2 style={{
            fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
            fontSize: 20, fontWeight: 700,
            color: "var(--ink0, #f4f0ff)",
            margin: "8px 0 12px",
            letterSpacing: "-0.01em",
          }}>
            How to embed
          </h2>
          <ol style={{ paddingLeft: 22, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <li><strong style={{ color: "var(--ink0, #f4f0ff)" }}>Substack</strong> — paste the iframe directly into the editor (Substack supports raw HTML in posts).</li>
            <li><strong style={{ color: "var(--ink0, #f4f0ff)" }}>Notion</strong> — type <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontFamily: "'DM Mono', monospace" }}>/embed</code>, paste the iframe URL (just the <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4, fontFamily: "'DM Mono', monospace" }}>https://www.arbibx.com/embed/AAPL</code> part).</li>
            <li><strong style={{ color: "var(--ink0, #f4f0ff)" }}>WordPress</strong> — paste the full iframe code in a Custom HTML block.</li>
            <li><strong style={{ color: "var(--ink0, #f4f0ff)" }}>Any other site</strong> — paste the iframe code anywhere HTML is allowed.</li>
          </ol>
          <p style={{ marginTop: 16, fontSize: 12, color: "var(--ink3, #3D5A7A)" }}>
            The widget links to ArbibX&apos;s full ticker analysis. Embed-friendly licence: free for personal & commercial use, no attribution required (though appreciated).
          </p>
        </section>

        <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--border, rgba(60,48,100,0.5))",
              color: "var(--ink2, #7A9CBF)", textDecoration: "none",
              fontFamily: "'DM Mono', monospace", fontSize: 12,
            }}>
            <ArrowLeft size={12} /> Back to terminal
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .vx-embed-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
