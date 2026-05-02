import Link from "next/link";

/* ── Site footer ──────────────────────────────────────────────
   Standard 4-column footer mounted on most pages. Rendered as a
   server component so it ships zero JS. Helps with AdSense
   approval (reviewers expect to see proper legal + about links)
   and gives non-app pages a place to link back to the marketing
   surfaces (pricing, embed builder, sitemap). */

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{
      marginTop: "auto",
      padding: "44px 24px 28px",
      background: "linear-gradient(180deg, transparent 0%, rgba(8,6,16,0.55) 100%)",
      borderTop: "1px solid var(--border, rgba(60,48,100,0.4))",
      color: "var(--ink2, #7A9CBF)",
      fontFamily: "'Syne', system-ui, sans-serif",
      fontSize: 13,
      position: "relative",
      zIndex: 50,
    }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 32,
          marginBottom: 32,
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "linear-gradient(135deg, #f0a500, #ffbe1a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 17, fontWeight: 900, color: "#0a0800",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif",
                letterSpacing: "-0.04em",
              }}>X</div>
              <div>
                <div style={{ fontWeight: 800, color: "var(--ink0, #f4f0ff)", fontSize: 14, letterSpacing: "-0.01em" }}>ArbibX</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
                  AI Stock Terminal
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink3, #3D5A7A)", lineHeight: 1.55, margin: 0, maxWidth: 240 }}>
              AI-powered stock analysis, live charts, watchlists, and personalised market briefings — powered by Claude AI.
            </p>
          </div>

          {/* Product */}
          <FooterColumn title="Product" links={[
            { href: "/",                label: "Terminal" },
            { href: "/?tab=top15",      label: "AI Top 15" },
            { href: "/?tab=trackrecord",label: "Track Record" },
            { href: "/picks",           label: "Today's picks" },
            { href: "/pricing",         label: "Pro pricing" },
          ]}/>

          {/* Resources */}
          <FooterColumn title="Resources" links={[
            { href: "/embed-builder",   label: "Embed widget" },
            { href: "/sector/ai-stocks",label: "Best AI stocks" },
            { href: "/sector/dividend-stocks", label: "Best dividend stocks" },
            { href: "/sector/semiconductors",  label: "Semiconductor stocks" },
            { href: "/sitemap.xml",     label: "Sitemap", external: true },
          ]}/>

          {/* Legal */}
          <FooterColumn title="Company" links={[
            { href: "/about",   label: "About" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms",   label: "Terms" },
            { href: "mailto:hello@arbibx.com", label: "Contact", external: true },
          ]}/>
        </div>

        {/* Bottom strip */}
        <div style={{
          paddingTop: 18,
          borderTop: "1px solid var(--border, rgba(60,48,100,0.3))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "var(--ink4, #1F3550)",
          letterSpacing: "0.04em",
        }}>
          <span>© {year} ArbibX · All rights reserved</span>
          <span>Data via Polygon.io · Powered by Claude AI</span>
          <span>Not financial advice · For informational purposes only</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: {
  title: string;
  links: { href: string; label: string; external?: boolean }[];
}) {
  return (
    <div>
      <p style={{
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        color: "var(--ink4, #1F3550)",
        textTransform: "uppercase",
        letterSpacing: "0.16em",
        margin: "0 0 14px",
        fontWeight: 700,
      }}>
        {title}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {links.map(l => (
          <li key={l.href + l.label}>
            {l.external ? (
              <a href={l.href}
                target={l.href.startsWith("mailto:") ? undefined : "_blank"}
                rel={l.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
                style={{ color: "var(--ink2, #7A9CBF)", textDecoration: "none", fontSize: 12, transition: "color 0.15s" }}>
                {l.label}
              </a>
            ) : (
              <Link href={l.href}
                style={{ color: "var(--ink2, #7A9CBF)", textDecoration: "none", fontSize: 12, transition: "color 0.15s" }}>
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
