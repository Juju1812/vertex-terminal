import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import PricingCheckout from "./PricingCheckout";

/* ── /pricing — public Pro pricing page ──────────────────────
   Standalone, indexable, shareable URL for the Pro pitch.
   Mirrors the upgrade-modal content as a real page so people
   can land here directly (e.g., via a tweet link or footer
   click) instead of only seeing pricing after hitting a gate. */

export const metadata: Metadata = {
  title: "Pricing — ArbibX Pro · $9.99/mo · AI stock terminal",
  description: "Unlock the full ArbibX terminal: all 15 daily AI picks, unlimited Ask Claude, daily AI brief, earnings reminders, AI portfolio grading, and 100% ad-free. $9.99/mo, cancel anytime.",
  alternates: { canonical: "https://www.arbibx.com/pricing" },
  keywords: ["ArbibX Pro", "stock terminal pricing", "AI stock analysis subscription", "Claude AI stocks", "stock app subscription"],
  openGraph: {
    title: "ArbibX Pro · $9.99/mo · AI stock terminal",
    description: "All 15 AI picks, unlimited Ask Claude, daily brief, earnings reminders, AI portfolio grading, ad-free.",
    type: "website",
    url:  "https://www.arbibx.com/pricing",
    siteName: "ArbibX",
    images: [{
      url: `https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("ArbibX Pro · $9.99/mo")}&s=${encodeURIComponent("Full AI Top 15, unlimited Claude, daily brief, ad-free")}`,
      width: 1200, height: 630,
      alt: "ArbibX Pro pricing"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ArbibX Pro · $9.99/mo",
    description: "Full AI Top 15, unlimited Claude, daily brief, ad-free.",
    images: [`https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("ArbibX Pro · $9.99/mo")}`],
  },
  robots: { index: true, follow: true },
};

const FEATURES = [
  { title: "Full AI Top 15",          desc: "All 15 daily picks with confidence scores, target prices, and risk notes — not just the top 5." },
  { title: "Unlimited Ask Claude",     desc: "Chat with Claude AI about any ticker, your portfolio, or market dynamics — no daily message cap." },
  { title: "Daily AI brief email",     desc: "Personalised pre-market summary every weekday morning. What moved your portfolio, what to watch, key catalysts." },
  { title: "Earnings reminders",       desc: "Push + email alerts when any of your holdings is reporting in the next 5 days. Email + browser notification." },
  { title: "100% ad-free",             desc: "Zero ads anywhere on the site. The AdSense script doesn't even load for Pro members." },
  { title: "Portfolio simulator",      desc: "Auto-allocate the AI Top 15 picks into a back-tested portfolio with real share counts and dollar weights." },
  { title: "AI portfolio grade",       desc: "Letter grade for your portfolio plus AI-written strengths, weaknesses, and rebalancing suggestions." },
  { title: "Public share links",       desc: "Generate a public read-only snapshot of your portfolio to share with friends." },
  { title: "Unlimited watchlists",     desc: "Free is capped at one list — Pro lets you organise themes into as many lists as you want." },
];

const FAQ = [
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your Stripe-hosted account portal at any moment — your Pro features stay active until the end of the current billing period."
  },
  {
    q: "Do I get charged immediately?",
    a: "Yes. Pro is monthly billing, $9.99 charged at signup and again every 30 days unless you cancel."
  },
  {
    q: "What's the refund policy?",
    a: "If you're unhappy within 7 days of signup, email hello@arbibx.com and we'll refund you in full, no questions."
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. Apple Pay and Google Pay too where supported."
  },
  {
    q: "Is the AI's analysis financial advice?",
    a: "No. ArbibX is an information tool. AI signals are educational starting points — always do your own research and consult a licensed advisor before making investment decisions."
  },
];

export default function PricingPage() {
  // FAQ JSON-LD for rich-result eligibility on Google
  const faqLd = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    "mainEntity": FAQ.map(f => ({
      "@type":    "Question",
      "name":     f.q,
      "acceptedAnswer": { "@type": "Answer", "text": f.a },
    })),
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <main style={{
        minHeight: "100vh",
        background: "var(--void, #050407)",
        color:      "var(--ink1, #cdc7e0)",
        fontFamily: "'Syne', system-ui, sans-serif",
        display:    "flex", flexDirection: "column",
      }}>
        <div style={{ flex: 1, padding: "44px 20px 60px" }}>
          <div style={{ maxWidth: 880, margin: "0 auto" }}>

            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11, color: "var(--gold, #f0a500)",
                textTransform: "uppercase", letterSpacing: "0.18em",
                margin: 0, marginBottom: 14, fontWeight: 700,
              }}>
                ArbibX Pro
              </p>
              <h1 style={{
                fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
                fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800,
                color: "var(--ink0, #f4f0ff)",
                margin: "0 0 14px",
                letterSpacing: "-0.03em", lineHeight: 1.05,
              }}>
                Unlock the full AI terminal
              </h1>
              <p style={{
                fontSize: 16, color: "var(--ink2, #7A9CBF)",
                margin: "0 auto", maxWidth: 580, lineHeight: 1.55,
              }}>
                All 15 AI picks, unlimited Ask Claude, daily AI brief, earnings reminders, and 100% ad-free. One simple monthly price.
              </p>
            </div>

            {/* Pricing card with checkout */}
            <PricingCheckout />

            {/* Feature list */}
            <section style={{ marginTop: 48 }}>
              <h2 style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                fontSize: 22, fontWeight: 700,
                color: "var(--ink0, #f4f0ff)",
                margin: "0 0 18px",
                letterSpacing: "-0.01em",
                textAlign: "center",
              }}>
                Everything Pro unlocks
              </h2>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}>
                {FEATURES.map(f => (
                  <div key={f.title} style={{
                    padding: "16px 18px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border, rgba(60,48,100,0.5))",
                  }}>
                    <p style={{
                      fontSize: 14, fontWeight: 700,
                      color: "var(--ink0, #f4f0ff)",
                      margin: "0 0 4px",
                      fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                    }}>
                      ✓ {f.title}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.5 }}>
                      {f.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* FAQ */}
            <section style={{ marginTop: 48 }}>
              <h2 style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                fontSize: 22, fontWeight: 700,
                color: "var(--ink0, #f4f0ff)",
                margin: "0 0 18px",
                letterSpacing: "-0.01em",
                textAlign: "center",
              }}>
                Frequently asked
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {FAQ.map(f => (
                  <details key={f.q}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 11,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border, rgba(60,48,100,0.5))",
                      cursor: "pointer",
                    }}>
                    <summary style={{
                      cursor: "pointer", listStyle: "none",
                      fontSize: 14, fontWeight: 600,
                      color: "var(--ink0, #f4f0ff)",
                      fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                    }}>
                      {f.q}
                    </summary>
                    <p style={{ fontSize: 13, color: "var(--ink2, #7A9CBF)", margin: "10px 0 4px", lineHeight: 1.6 }}>
                      {f.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>

            {/* Back link */}
            <div style={{ marginTop: 44, textAlign: "center" }}>
              <Link href="/"
                style={{
                  display: "inline-block",
                  padding: "10px 18px", borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border, rgba(60,48,100,0.5))",
                  color: "var(--ink2, #7A9CBF)", textDecoration: "none",
                  fontFamily: "'DM Mono', monospace", fontSize: 12,
                }}>
                ← Back to terminal
              </Link>
            </div>
          </div>
        </div>

        <Footer />
      </main>
    </>
  );
}
