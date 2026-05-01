"use client";

import { useEffect, useRef, useState } from "react";

/* ── AdSlot ───────────────────────────────────────────────────
   Renders a single Google AdSense ad placement. Hidden entirely
   for Pro users (no DOM, no <ins>, no API call to AdSense).

   Slot ID is per-placement and comes from the AdSense dashboard
   ("Ads → By ad unit → Display ads"). Each slot has its own
   numeric ID, baked in via the `slot` prop. While AdSense is
   under review (no slot IDs yet), the component renders a
   subtle placeholder so the layout doesn't shift when ads
   start loading post-approval.

   AUTH model: same client-side Pro check as AdSenseLoader so
   placement matches script load behaviour. */

const ADSENSE_CLIENT = "ca-pub-2690222846295907";

interface Props {
  /** Numeric slot ID from AdSense dashboard (when available).
      Until approval, leave as undefined and a placeholder shows. */
  slot?:    string;
  /** "auto" lets AdSense pick best layout; "horizontal", "vertical",
      or "rectangle" force a specific aspect. Default "auto". */
  format?:  "auto" | "horizontal" | "vertical" | "rectangle";
  /** When true, ad fills its container. Default true. */
  responsive?: boolean;
  /** Optional max-width clamp so super-wide screens don't end up
      with 1500px-wide ad units. */
  maxWidth?: number;
  /** A short label shown in dev/placeholder mode for context. */
  label?: string;
}

export default function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  maxWidth = 728,
  label,
}: Props) {
  const [show, setShow] = useState<"checking" | "ad" | "hide">("checking");
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const stored = localStorage.getItem("arbibx-auth-user");
        if (!stored) {
          if (!cancelled) setShow("ad");
          return;
        }
        const { email, token } = JSON.parse(stored) as { email: string; token: string };
        const r = await fetch(`/api/subscription?email=${encodeURIComponent(email)}&token=${token}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) { if (!cancelled) setShow("ad"); return; }
        const d = await r.json() as { isPro?: boolean };
        if (!cancelled) setShow(d.isPro ? "hide" : "ad");
      } catch {
        if (!cancelled) setShow("ad");
      }
    };
    check();
    window.addEventListener("arbibx-login", check);
    return () => { cancelled = true; window.removeEventListener("arbibx-login", check); };
  }, []);

  // Push the ad into AdSense's queue once the <ins> mounts and a
  // slot ID is configured.
  useEffect(() => {
    if (show !== "ad" || !slot) return;
    const id = setTimeout(() => {
      try {
        // @ts-expect-error AdSense's adsbygoogle is a global array
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch { /* AdSense not yet loaded — will retry naturally */ }
    }, 100);
    return () => clearTimeout(id);
  }, [show, slot]);

  if (show === "hide") return null;
  if (show === "checking") return null;

  // While AdSense is in review or no slot ID is configured yet, show
  // a subtle placeholder so the layout space is reserved (prevents
  // CLS when ads start loading post-approval).
  if (!slot) {
    return (
      <div aria-hidden style={{
        width: "100%", maxWidth, margin: "16px auto",
        minHeight: 90,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(255,255,255,0.02)",
        border: "1px dashed var(--border, rgba(60,48,100,0.4))",
        borderRadius: 10,
        color: "var(--ink4, #1F3550)",
        fontFamily: "'DM Mono', monospace",
        fontSize: 9,
        textTransform: "uppercase", letterSpacing: "0.16em",
        padding: "12px 16px",
        textAlign: "center",
        boxSizing: "border-box",
      }}>
        Advertisement{label ? ` · ${label}` : ""}
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth, margin: "16px auto", textAlign: "center" }}>
      <ins ref={insRef as never}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"} />
    </div>
  );
}
