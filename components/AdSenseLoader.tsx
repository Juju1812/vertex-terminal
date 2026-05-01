"use client";

import { useEffect, useState } from "react";

/* ── AdSenseLoader ────────────────────────────────────────────
   Conditionally injects the Google AdSense script tag only for
   non-Pro users. Pro users get a fully ad-free experience —
   the script never loads, so AdSense Auto Ads can't insert any
   placements either.

   Strategy:
   1. On mount, read the auth user from localStorage. If absent
      (logged-out), assume free and load the script.
   2. If logged in, hit /api/subscription. Only skip the script
      load when isPro === true.
   3. Listen for the "arbibx-login" event so a fresh sign-in
      that yields Pro status removes any subsequent script load
      on the next reload (we don't try to remove an already-
      loaded script — page reload is the clean cutoff).

   The actual <ins class="adsbygoogle"> ad slots are gated
   independently by AdSlot.tsx so they don't render for Pro
   users even on a stale tab where the script already loaded. */

const ADSENSE_CLIENT = "ca-pub-2690222846295907";

let scriptInjected = false;

function injectAdSenseScript() {
  if (scriptInjected) return;
  if (typeof document === "undefined") return;
  if (document.querySelector('script[src*="adsbygoogle.js"]')) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement("script");
  s.async = true;
  s.crossOrigin = "anonymous";
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(s);
  scriptInjected = true;
}

export default function AdSenseLoader() {
  const [, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const stored = localStorage.getItem("arbibx-auth-user");
        if (!stored) {
          // Logged out → free → load ads
          injectAdSenseScript();
          if (!cancelled) setReady(true);
          return;
        }
        const { email, token } = JSON.parse(stored) as { email: string; token: string };
        const r = await fetch(`/api/subscription?email=${encodeURIComponent(email)}&token=${token}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (!r.ok) {
          // On any failure, default to loading ads (safer for revenue
          // than accidentally disabling for a real free user)
          injectAdSenseScript();
          if (!cancelled) setReady(true);
          return;
        }
        const d = await r.json() as { isPro?: boolean };
        if (!d.isPro) {
          injectAdSenseScript();
        }
        if (!cancelled) setReady(true);
      } catch {
        injectAdSenseScript();
        if (!cancelled) setReady(true);
      }
    };
    check();
    window.addEventListener("arbibx-login", check);
    return () => {
      cancelled = true;
      window.removeEventListener("arbibx-login", check);
    };
  }, []);

  return null;
}
