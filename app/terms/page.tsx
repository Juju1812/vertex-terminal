import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service · ArbibX",
  description: "Terms governing use of the ArbibX AI stock terminal.",
  alternates: { canonical: "https://www.arbibx.com/terms" },
};

export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--void, #050407)", color: "var(--ink1, #cdc7e0)", fontFamily: "'Syne', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "44px 20px 60px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", fontSize: 13, lineHeight: 1.7 }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Terms of Service
          </h1>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.10em", margin: "0 0 28px" }}>
            Last updated: 1 May 2026
          </p>

          <Section title="Service summary">
            <p>ArbibX provides AI-powered analysis and information about publicly-traded US stocks. By using the site, you agree to these terms.</p>
          </Section>

          <Section title="Not financial advice">
            <p>Everything ArbibX shows is informational. AI signals, target prices, win-rate stats, portfolio grades, and the Ask Claude assistant are educational tools — not personalised investment advice. ArbibX is not a registered investment adviser. Always do your own research and consider consulting a licensed advisor before making investment decisions.</p>
          </Section>

          <Section title="No guarantee of accuracy">
            <p>Market data is sourced from third parties (Polygon.io). We make reasonable efforts to keep it accurate but cannot guarantee real-time correctness. AI analyses are probabilistic and frequently wrong. Past performance does not guarantee future results.</p>
          </Section>

          <Section title="Subscription terms">
            <p>Pro is $9.99/month, billed monthly via Stripe. Cancel anytime from your Stripe-hosted account portal — Pro features stay active until the end of the current billing period. We offer a 7-day refund window from initial signup.</p>
          </Section>

          <Section title="Acceptable use">
            <p>Don&apos;t scrape the API, attempt to bypass rate limits, or resell ArbibX content. The embeddable widget is free for personal and commercial use, no attribution required.</p>
          </Section>

          <Section title="Liability">
            <p>ArbibX is provided &quot;as is&quot; with no warranties. We&apos;re not liable for losses resulting from trading decisions you make based on information from this site. You assume all risk.</p>
          </Section>

          <Section title="Changes">
            <p>We may update these terms occasionally. Material changes will be highlighted at the top of this page; continued use of ArbibX after such changes constitutes acceptance.</p>
          </Section>

          <Section title="Contact">
            <p>Questions? Email <a href="mailto:hello@arbibx.com" style={{ color: "var(--gold, #f0a500)" }}>hello@arbibx.com</a>.</p>
          </Section>

          <Link href="/" style={{ display: "inline-block", marginTop: 28, padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border, rgba(60,48,100,0.5))", color: "var(--ink2, #7A9CBF)", textDecoration: "none", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
            ← Back to terminal
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: 18, fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        {title}
      </h2>
      <div style={{ color: "var(--ink2, #7A9CBF)" }}>{children}</div>
    </section>
  );
}
