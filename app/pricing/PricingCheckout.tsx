"use client";

import { useEffect, useState } from "react";
import { Crown, Zap, Check } from "lucide-react";

/* Client-side checkout panel for the /pricing page. Reads auth
   from localStorage so logged-in users can upgrade in one click,
   logged-out users see a "Sign in to upgrade" prompt. */

export default function PricingCheckout() {
  const [user, setUser]     = useState<{ email: string; token: string } | null>(null);
  const [isPro, setIsPro]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("arbibx-auth-user");
      if (!raw) return;
      const u = JSON.parse(raw) as { email: string; token: string };
      setUser(u);
      // Check Pro status so we can show "Already Pro" instead of CTA
      fetch(`/api/subscription?email=${encodeURIComponent(u.email)}&token=${u.token}`)
        .then(r => r.json())
        .then((d: { isPro?: boolean }) => setIsPro(!!d.isPro))
        .catch(() => { /* */ });
    } catch { /* */ }
  }, []);

  const upgrade = async () => {
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/create-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: user.email }),
      });
      const d = await r.json() as { url?: string; error?: string };
      if (d.url) window.location.href = d.url;
      else { setError(d.error ?? "Something went wrong."); setLoading(false); }
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 460,
      margin: "0 auto",
      padding: "32px 28px",
      borderRadius: 18,
      background: "linear-gradient(135deg, rgba(240,165,0,0.10) 0%, rgba(155,114,245,0.06) 100%)",
      border: "1px solid rgba(240,165,0,0.40)",
      textAlign: "center",
      boxShadow: "0 12px 40px rgba(240,165,0,0.10), 0 0 0 1px rgba(240,165,0,0.10) inset",
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 13,
        background: "linear-gradient(135deg, #f0a500, #ffbe1a, #ff6b35)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        marginBottom: 14, boxShadow: "0 8px 28px rgba(240,165,0,0.45)",
      }}>
        <Crown size={26} color="#0a0800" fill="#0a0800" />
      </div>

      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--gold, #f0a500)", textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 6px", fontWeight: 700 }}>
        Pro · Monthly
      </p>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 6 }}>
        <span style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: 56, fontWeight: 900, color: "var(--gold, #f0a500)", letterSpacing: "-0.04em", lineHeight: 1 }}>$9.99</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--ink2, #7A9CBF)" }}>/ mo</span>
      </div>

      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--ink3, #3D5A7A)", margin: "0 0 22px", textTransform: "uppercase", letterSpacing: "0.10em" }}>
        Less than $0.34 / day
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", marginBottom: 22, fontSize: 12, color: "var(--ink2, #7A9CBF)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={13} color="var(--gain, #00e5a0)" /> Cancel anytime
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={13} color="var(--gain, #00e5a0)" /> Instant activation
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={13} color="var(--gain, #00e5a0)" /> Secure payment via Stripe
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={13} color="var(--gain, #00e5a0)" /> 7-day refund guarantee
        </span>
      </div>

      {error && (
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--loss, #ff4560)", margin: "0 0 12px" }}>{error}</p>
      )}

      {isPro ? (
        <div style={{
          padding: "14px 18px",
          borderRadius: 12,
          background: "rgba(0,229,160,0.10)",
          border: "1px solid rgba(0,229,160,0.32)",
          color: "var(--gain, #00e5a0)",
          fontFamily: "'DM Mono', monospace",
          fontSize: 13, fontWeight: 700,
          display: "inline-flex", alignItems: "center", gap: 8,
        }}>
          <Check size={14} /> You're already Pro · Thanks!
        </div>
      ) : (
        <>
          {!user && (
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--ink3, #3D5A7A)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              Sign in first to checkout
            </p>
          )}
          <button onClick={upgrade} disabled={loading || !user}
            style={{
              width: "100%",
              padding: "16px 20px",
              borderRadius: 12,
              background: (loading || !user)
                ? "rgba(240,165,0,0.30)"
                : "linear-gradient(135deg,#f0a500,#ffbe1a)",
              color: "#0a0800",
              border: "none",
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: 16, fontWeight: 900,
              letterSpacing: "0.02em",
              cursor: (loading || !user) ? "not-allowed" : "pointer",
              boxShadow: (loading || !user) ? "none" : "0 8px 32px rgba(240,165,0,0.45)",
              opacity: (loading || !user) ? 0.6 : 1,
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}>
            <Zap size={16} fill="#0a0800" />
            {loading ? "Redirecting to Stripe..." : "Upgrade to Pro"}
          </button>
        </>
      )}
    </div>
  );
}
