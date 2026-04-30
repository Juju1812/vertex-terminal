"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Trash2, Settings as SettingsIcon, Eye } from "lucide-react";

/* ── SettingsModal ─────────────────────────────────────────
   Lightweight preferences panel. All settings persist to
   localStorage. Triggered by the gear icon in the header.

   Exposes:
     - Default tab on load (which tab opens when you arrive)
     - Replay onboarding tour
     - Clear local data (signs out + wipes localStorage)
     - Build / version info

   Theme + perf mode are already toggleable from the header
   directly, so they're not duplicated here.
*/

const TABS = [
  { id: "markets",   label: "Markets" },
  { id: "top15",     label: "AI Top 15" },
  { id: "earnings",  label: "Earnings" },
  { id: "news",      label: "News" },
  { id: "screener",  label: "Screener" },
  { id: "analytics", label: "Analytics" },
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
];

const DEFAULT_TAB_KEY = "arbibx-default-tab";
const TOUR_KEY        = "arbibx-tour-seen";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: Props) {
  const [defaultTab, setDefaultTab] = useState<string>("markets");
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!open) return;
    try { setDefaultTab(localStorage.getItem(DEFAULT_TAB_KEY) ?? "markets"); } catch { /* */ }
    setConfirmingClear(false);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setDefault = (id: string) => {
    setDefaultTab(id);
    try { localStorage.setItem(DEFAULT_TAB_KEY, id); } catch { /* */ }
  };

  const replayTour = () => {
    try { localStorage.removeItem(TOUR_KEY); } catch { /* */ }
    onClose();
    setTimeout(() => window.location.reload(), 50);
  };

  const clearAllData = () => {
    try {
      // Drop everything ArbibX-prefixed; keep theme + perf prefs to avoid
      // a jarring visual flash on the next reload.
      const keep = new Set(["arbibx-theme", "arbibx-perf"]);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("arbibx-") && !keep.has(k)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* */ }
    window.location.href = "/";
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px 16px",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{
              background: "rgba(8,6,16,0.97)",
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
              border: "1px solid var(--border-hi,rgba(90,72,150,0.6))",
              borderRadius: 18,
              width: "100%", maxWidth: 480,
              maxHeight: "85vh", overflowY: "auto",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 32px rgba(240,165,0,0.10)",
              fontFamily: "'Syne',system-ui,sans-serif",
              color: "var(--ink1,#cdc7e0)",
            }}
          >
            {/* Top accent stripe */}
            <div style={{ height: 2, background: "linear-gradient(90deg,#f0a500,#ff6b35,#f0a500)" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SettingsIcon size={16} color="var(--gold,#f0a500)" />
                <h2 style={{ fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif", fontSize: 16, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
                  Settings
                </h2>
              </div>
              <button onClick={onClose}
                aria-label="Close settings"
                style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: "pointer", padding: 4, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 22px 18px", display: "flex", flexDirection: "column", gap: 22 }}>

              {/* Default tab */}
              <section>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  Default tab
                </p>
                <p style={{ fontSize: 12, color: "var(--ink3,#3D5A7A)", margin: "0 0 10px", lineHeight: 1.5 }}>
                  Which tab opens when you arrive at ArbibX.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6 }}>
                  {TABS.map(t => (
                    <button key={t.id} onClick={() => setDefault(t.id)}
                      style={{
                        padding: "8px 10px", borderRadius: 8,
                        background: defaultTab === t.id ? "rgba(240,165,0,0.10)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${defaultTab === t.id ? "rgba(240,165,0,0.32)" : "var(--border,rgba(60,48,100,0.5))"}`,
                        color: defaultTab === t.id ? "var(--gold,#f0a500)" : "var(--ink2,#7A9CBF)",
                        cursor: "pointer", fontSize: 11, fontWeight: defaultTab === t.id ? 600 : 400,
                        fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Onboarding */}
              <section>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  Tour
                </p>
                <button onClick={replayTour}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "10px 14px", borderRadius: 9,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border,rgba(60,48,100,0.5))",
                    color: "var(--ink1,#cdc7e0)", cursor: "pointer", fontSize: 12,
                    fontFamily: "'Cabinet Grotesk',system-ui,sans-serif", fontWeight: 600,
                  }}>
                  <Eye size={12} /> Replay onboarding tour
                </button>
                <p style={{ fontSize: 11, color: "var(--ink4,#1F3550)", margin: "8px 0 0", lineHeight: 1.5 }}>
                  Reloads the page and shows the 5-step intro again.
                </p>
              </section>

              {/* Danger zone */}
              <section style={{ paddingTop: 16, borderTop: "1px dashed var(--border,rgba(60,48,100,0.5))" }}>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--loss,#ff4560)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                  Danger zone
                </p>
                {!confirmingClear ? (
                  <button onClick={() => setConfirmingClear(true)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 14px", borderRadius: 9,
                      background: "rgba(232,68,90,0.07)",
                      border: "1px solid rgba(232,68,90,0.25)",
                      color: "var(--loss,#ff4560)", cursor: "pointer", fontSize: 12,
                      fontFamily: "'Cabinet Grotesk',system-ui,sans-serif", fontWeight: 600,
                    }}>
                    <Trash2 size={12} /> Clear all local data
                  </button>
                ) : (
                  <div style={{ background: "rgba(232,68,90,0.08)", border: "1px solid rgba(232,68,90,0.30)", borderRadius: 10, padding: "12px 14px" }}>
                    <p style={{ fontSize: 12, color: "var(--ink0,#f4f0ff)", margin: "0 0 10px", lineHeight: 1.5 }}>
                      Sign out, clear watchlist, alerts, and cached preferences. <strong>Cloud-synced portfolio data is kept.</strong>
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={clearAllData}
                        style={{
                          padding: "8px 14px", borderRadius: 8,
                          background: "var(--loss,#ff4560)", color: "#0a0500",
                          border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
                          fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                        }}>
                        <RotateCcw size={11} style={{ marginRight: 5 }} /> Yes, clear it
                      </button>
                      <button onClick={() => setConfirmingClear(false)}
                        style={{
                          padding: "8px 14px", borderRadius: 8,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border,rgba(60,48,100,0.5))",
                          color: "var(--ink2,#7A9CBF)", cursor: "pointer", fontSize: 11,
                          fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                        }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Build info */}
              <section style={{ paddingTop: 12, borderTop: "1px dashed var(--border,rgba(60,48,100,0.5))" }}>
                <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4,#1F3550)", margin: 0, lineHeight: 1.6 }}>
                  ArbibX Terminal · Powered by Polygon.io + Claude AI<br/>
                  Theme + performance mode toggleable from the header
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
