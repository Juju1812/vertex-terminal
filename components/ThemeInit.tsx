"use client";

import { useEffect } from "react";

/* ── ThemeInit ──────────────────────────────────────────────
   Renders nothing. Mounts at the root layout level so EVERY
   route (the main terminal, /stock/[ticker], /p/[id], anything
   else added later) reads the user's saved theme + perf prefs
   from localStorage and applies the data-theme + data-perf
   attributes to <html> on first paint.

   Without this, only the main page.tsx route applied the
   theme — subroutes always rendered in dark mode regardless
   of what the user picked. */

export default function ThemeInit() {
  useEffect(() => {
    try {
      const theme = localStorage.getItem("arbibx-theme");
      if (theme === "light" || theme === "dark") {
        document.documentElement.setAttribute("data-theme", theme);
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
      }
      const perf = localStorage.getItem("arbibx-perf");
      if (perf === "lite") {
        document.documentElement.setAttribute("data-perf", "low");
      } else {
        // "auto" or "full" both default to "high"; auto-detection on the
        // main route may flip it later. Subroutes don't run the FPS check.
        document.documentElement.setAttribute("data-perf", "high");
      }
    } catch { /* noop — localStorage unavailable, default theme will apply */ }
  }, []);
  return null;
}
