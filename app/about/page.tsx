import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "About ArbibX · AI-powered stock terminal",
  description: "ArbibX combines live market data with Claude AI analysis to help retail investors make better-informed decisions. Built by indie developers for serious traders.",
  alternates: { canonical: "https://www.arbibx.com/about" },
};

export default function AboutPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--void, #050407)", color: "var(--ink1, #cdc7e0)", fontFamily: "'Syne', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "44px 20px 60px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", fontSize: 14, lineHeight: 1.7 }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "0 0 18px", letterSpacing: "-0.02em" }}>
            About ArbibX
          </h1>
          <p>
            ArbibX is an AI-powered stock terminal built for retail investors who want institutional-grade analysis without the institutional price tag. Live market data flows in from Polygon.io, and every signal is reasoned through Claude AI from Anthropic.
          </p>
          <p style={{ marginTop: 14 }}>
            What we do:
          </p>
          <ul style={{ paddingLeft: 22, margin: "8px 0 16px" }}>
            <li>Rank thousands of US-listed stocks every hour and surface the 15 most actionable picks with confidence scores, target prices, and risk notes.</li>
            <li>Track AI performance over time so you can verify the receipts — see the public Track Record tab.</li>
            <li>Provide a context-aware Ask Claude assistant that knows your portfolio, watchlist, and current ticker.</li>
            <li>Send personalised pre-market briefs and earnings reminders straight to your inbox.</li>
          </ul>
          <p>
            We&apos;re an independent operation. No ad-driven analyst rotation, no paid placements in the rankings — the AI ranks what it ranks. Pro membership funds the API costs that keep the analysis running.
          </p>
          <p style={{ marginTop: 14 }}>
            Questions, bug reports, or feature requests? Email <a href="mailto:hello@arbibx.com" style={{ color: "var(--gold, #f0a500)", textDecoration: "none" }}>hello@arbibx.com</a> — we read every message.
          </p>
          <p style={{ marginTop: 30, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Not financial advice · For informational purposes only
          </p>
          <Link href="/" style={{ display: "inline-block", marginTop: 28, padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border, rgba(60,48,100,0.5))", color: "var(--ink2, #7A9CBF)", textDecoration: "none", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
            ← Back to terminal
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
