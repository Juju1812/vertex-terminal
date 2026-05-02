import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy · ArbibX",
  description: "How ArbibX collects, uses, and protects your data.",
  alternates: { canonical: "https://www.arbibx.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--void, #050407)", color: "var(--ink1, #cdc7e0)", fontFamily: "'Syne', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "44px 20px 60px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", fontSize: 13, lineHeight: 1.7 }}>
          <h1 style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: "clamp(28px, 4vw, 38px)", fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Privacy Policy
          </h1>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.10em", margin: "0 0 28px" }}>
            Last updated: 1 May 2026
          </p>

          <Section title="What we collect">
            <p>If you create an account, we store your email address and a hashed password (we never see your raw password). When you save a portfolio or watchlist, those are stored against your account in our Supabase database.</p>
            <p>We also store local preferences (theme, currency, perf mode) in your browser&apos;s localStorage — these never leave your device.</p>
          </Section>

          <Section title="What we don't collect">
            <p>We don&apos;t track you across sites. We don&apos;t sell your data. We don&apos;t share your portfolio with anyone unless you explicitly create a public share link.</p>
          </Section>

          <Section title="Third-party services">
            <ul style={{ paddingLeft: 22, margin: "0" }}>
              <li><strong>Polygon.io</strong> — provides live market data. They never see your account information.</li>
              <li><strong>Anthropic (Claude)</strong> — runs the AI analysis and the Ask Claude chat. Conversations are sent to Anthropic&apos;s API for inference; per their policy these are not used to train models.</li>
              <li><strong>Stripe</strong> — handles Pro subscription billing. We never see your card details.</li>
              <li><strong>Resend</strong> — sends email (price alerts, daily AI brief, earnings reminders).</li>
              <li><strong>Vercel</strong> — hosts the application.</li>
              <li><strong>Google AdSense</strong> — serves ads to non-Pro users. AdSense uses cookies for ad targeting per Google&apos;s policy. Pro members never load AdSense.</li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>We use cookies for essential site functionality (auth tokens, preferences). For non-Pro users, Google AdSense may set additional advertising cookies — these are governed by Google&apos;s privacy policy.</p>
          </Section>

          <Section title="Your rights">
            <p>You can delete your account at any time by emailing <a href="mailto:hello@arbibx.com" style={{ color: "var(--gold, #f0a500)" }}>hello@arbibx.com</a>. We&apos;ll permanently remove your data within 7 days.</p>
            <p>You can also clear your local browser data via Settings → Clear all local data.</p>
          </Section>

          <Section title="Contact">
            <p>Questions about this policy? Email <a href="mailto:hello@arbibx.com" style={{ color: "var(--gold, #f0a500)" }}>hello@arbibx.com</a>.</p>
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
