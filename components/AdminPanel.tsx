"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Crown, Search, RefreshCcw, Check, AlertTriangle } from "lucide-react";

/* ── AdminPanel ───────────────────────────────────────────────
   Owner-only modal that lets the owner account (julian.arbib@hotmail.com)
   grant or revoke Pro subscriptions for any account.

   Auth: passes the admin's stored localStorage {email, token}
   to /api/admin/* routes, which verify both server-side before
   executing. Anyone tampering with localStorage just gets 401.
*/

interface User {
  email: string;
  subscription_status: string | null;
  subscription_end:    string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminPanel({ open, onClose }: Props) {
  const [users, setUsers]       = useState<User[]>([]);
  const [filter, setFilter]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [busy, setBusy]         = useState<string | null>(null); // email currently being mutated
  const [error, setError]       = useState<string | null>(null);
  const [flash, setFlash]       = useState<string | null>(null); // success message

  const adminCreds = (() => {
    try {
      const raw = localStorage.getItem("arbibx-auth-user");
      if (!raw) return null;
      const { email, token } = JSON.parse(raw) as { email: string; token: string };
      return { email, token };
    } catch { return null; }
  })();

  const loadUsers = async () => {
    if (!adminCreds) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/users", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ adminEmail: adminCreds.email, adminToken: adminCreds.token }),
      });
      const d = await r.json() as { users?: User[]; error?: string };
      if (!r.ok) { setError(d.error ?? "Failed to load"); return; }
      setUsers(d.users ?? []);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  };

  // Load on open
  useEffect(() => {
    if (!open) return;
    setError(null); setFlash(null); setFilter("");
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const mutate = async (targetEmail: string, action: "grant" | "revoke") => {
    if (!adminCreds) return;
    setBusy(targetEmail); setError(null); setFlash(null);
    try {
      const r = await fetch("/api/admin/grant-pro", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          adminEmail: adminCreds.email, adminToken: adminCreds.token,
          targetEmail, action,
        }),
      });
      const d = await r.json() as { success?: boolean; error?: string; status?: string };
      if (!r.ok || !d.success) { setError(d.error ?? "Failed"); return; }
      setFlash(`${action === "grant" ? "Granted Pro" : "Revoked Pro"} for ${targetEmail}`);
      setUsers(prev => prev.map(u =>
        u.email === targetEmail
          ? { ...u, subscription_status: d.status ?? u.subscription_status }
          : u
      ));
    } catch { setError("Network error"); }
    finally { setBusy(null); }
  };

  // Manual grant by typed email (for accounts not yet in the visible filter)
  const [manualEmail, setManualEmail] = useState("");
  const grantManual = async () => {
    const em = manualEmail.trim().toLowerCase();
    if (!em) return;
    await mutate(em, "grant");
    setManualEmail("");
  };

  const filtered = users.filter(u =>
    !filter.trim() || u.email.toLowerCase().includes(filter.trim().toLowerCase())
  );
  const proCount  = users.filter(u => u.subscription_status === "pro").length;
  const freeCount = users.length - proCount;

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
            className="vx-modal-shell"
            style={{
              backdropFilter: "blur(40px) saturate(1.5)",
              WebkitBackdropFilter: "blur(40px) saturate(1.5)",
              border: "1px solid var(--border-hi,rgba(90,72,150,0.6))",
              borderRadius: 18,
              width: "100%", maxWidth: 640,
              maxHeight: "85vh", overflow: "hidden",
              display: "flex", flexDirection: "column",
              fontFamily: "'Syne',system-ui,sans-serif",
              color: "var(--ink1,#cdc7e0)",
            }}
          >
            {/* Top accent stripe */}
            <div style={{ height: 2, background: "linear-gradient(90deg,#f0a500,#ff6b35,#f0a500)" }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Shield size={16} color="var(--gold,#f0a500)" />
                <h2 style={{ fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif", fontSize: 16, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
                  Admin · Subscription manager
                </h2>
              </div>
              <button onClick={onClose}
                aria-label="Close admin panel"
                style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: "pointer", padding: 4, display: "flex" }}>
                <X size={16} />
              </button>
            </div>

            {/* Stats + manual grant */}
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                <span style={{ color: "var(--gold,#f0a500)" }}>{proCount} Pro</span>
                <span style={{ color: "var(--ink3,#3D5A7A)" }}>·</span>
                <span style={{ color: "var(--ink2,#7A9CBF)" }}>{freeCount} Free</span>
                <span style={{ color: "var(--ink3,#3D5A7A)" }}>·</span>
                <span style={{ color: "var(--ink2,#7A9CBF)" }}>{users.length} total</span>
                <button onClick={loadUsers} disabled={loading}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ink2,#7A9CBF)", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontFamily: "'DM Mono',monospace" }}
                  title="Refresh">
                  <RefreshCcw size={11} className={loading ? "vx-spin" : ""} /> Refresh
                </button>
              </div>

              {/* Manual grant by email */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") grantManual(); }}
                  placeholder="Grant Pro to email…"
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border,rgba(60,48,100,0.5))",
                    color: "var(--ink0,#f4f0ff)", fontSize: 12,
                    fontFamily: "'DM Mono',monospace", outline: "none",
                  }} />
                <button onClick={grantManual} disabled={!manualEmail.trim() || busy === manualEmail.trim().toLowerCase()}
                  style={{
                    padding: "8px 14px", borderRadius: 8,
                    background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
                    color: "#0a0800", border: "none",
                    cursor: (!manualEmail.trim() || busy) ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 700,
                    fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                    opacity: (!manualEmail.trim() || busy) ? 0.5 : 1,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                  <Crown size={11} /> Grant Pro
                </button>
              </div>

              {/* Filter */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border,rgba(60,48,100,0.5))", borderRadius: 8, padding: "6px 10px" }}>
                <Search size={12} color="var(--ink3,#3D5A7A)" />
                <input value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Filter users…"
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "var(--ink0,#f4f0ff)", fontSize: 12,
                    fontFamily: "'DM Mono',monospace",
                  }} />
              </div>
            </div>

            {/* Flash + error */}
            {(flash || error) && (
              <div style={{ padding: "10px 22px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
                {flash && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(0,229,160,0.10)", border: "1px solid rgba(0,229,160,0.30)", color: "var(--gain,#00e5a0)", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                    <Check size={11} /> {flash}
                  </div>
                )}
                {error && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(232,68,90,0.10)", border: "1px solid rgba(232,68,90,0.30)", color: "var(--loss,#ff4560)", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
                    <AlertTriangle size={11} /> {error}
                  </div>
                )}
              </div>
            )}

            {/* User list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {loading && !users.length && (
                <p style={{ textAlign: "center", padding: 30, color: "var(--ink3,#3D5A7A)", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>Loading…</p>
              )}
              {!loading && filtered.length === 0 && (
                <p style={{ textAlign: "center", padding: 30, color: "var(--ink3,#3D5A7A)", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                  {filter.trim() ? "No matches" : "No users yet"}
                </p>
              )}
              {filtered.map(u => {
                const isPro = u.subscription_status === "pro";
                const isBusy = busy === u.email;
                return (
                  <div key={u.email}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, padding: "10px 12px", borderRadius: 8,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--border,rgba(60,48,100,0.4))",
                      marginBottom: 4,
                    }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "var(--ink0,#f4f0ff)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.email}
                      </span>
                      <span style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color: isPro ? "var(--gold,#f0a500)" : "var(--ink3,#3D5A7A)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {isPro ? "● Pro" : "○ Free"}
                        {isPro && u.subscription_end && (
                          <span style={{ color: "var(--ink4,#1F3550)", marginLeft: 8 }}>
                            until {new Date(u.subscription_end).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    </div>
                    {isPro ? (
                      <button onClick={() => mutate(u.email, "revoke")} disabled={isBusy}
                        style={{
                          padding: "6px 12px", borderRadius: 7,
                          background: "rgba(232,68,90,0.08)",
                          border: "1px solid rgba(232,68,90,0.30)",
                          color: "var(--loss,#ff4560)",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          fontSize: 10, fontWeight: 600,
                          fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                          opacity: isBusy ? 0.5 : 1,
                        }}>
                        {isBusy ? "…" : "Revoke"}
                      </button>
                    ) : (
                      <button onClick={() => mutate(u.email, "grant")} disabled={isBusy}
                        style={{
                          padding: "6px 12px", borderRadius: 7,
                          background: "rgba(240,165,0,0.10)",
                          border: "1px solid rgba(240,165,0,0.36)",
                          color: "var(--gold,#f0a500)",
                          cursor: isBusy ? "not-allowed" : "pointer",
                          fontSize: 10, fontWeight: 600,
                          fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                          opacity: isBusy ? 0.5 : 1,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                        {isBusy ? "…" : <><Crown size={10} /> Grant</>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
