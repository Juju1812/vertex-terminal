"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Trash2, Bot, User } from "lucide-react";

/* ── AskClaude ────────────────────────────────────────────────
   Floating gold "Ask Claude" pill in the bottom-right that
   expands into a side panel chat. Streams replies token-by-token
   from /api/chat with the user's current ticker / portfolio /
   watchlist context auto-injected so answers feel grounded.

   Persistence: conversation history is kept in localStorage
   under "arbibx-ask-claude-history" so reopening the panel
   keeps the thread. "Clear" wipes it.

   Suggested prompts adapt to what the user is looking at —
   ticker page → "Why is X moving?", Portfolio → "Grade my
   portfolio", etc.
*/

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  ticker?:           string | null;
  watchlistTickers?: string[];
  tab?:              string;
  /** Free users get 5 messages per UTC day. Pro is unlimited. */
  isPro?:    boolean;
  onUpgrade?: () => void;
}

const STORAGE_KEY  = "arbibx-ask-claude-history";
const HOLDINGS_KEY = "arbibx-holdings-local";
const QUOTA_KEY    = "arbibx-ask-claude-quota";
const FREE_QUOTA   = 5;

/* Per-day client-side message-count tracker. Resets at UTC
   midnight automatically by storing the date alongside the count. */
function readQuota(): { date: string; count: number } {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { date: string; count: number };
      const today = new Date().toISOString().split("T")[0];
      if (p.date === today) return p;
    }
  } catch { /* */ }
  return { date: new Date().toISOString().split("T")[0], count: 0 };
}
function bumpQuota() {
  try {
    const q = readQuota();
    localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: q.date, count: q.count + 1 }));
  } catch { /* */ }
}

/* Holdings live inside MyStocks rather than page.tsx, so we read
   them straight from localStorage when assembling chat context.
   For logged-in users this is a slight mirror lag (the in-app
   poller writes back), but good enough for chat grounding. */
function readPortfolioTickers(): string[] {
  try {
    const raw = localStorage.getItem(HOLDINGS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Array<{ ticker?: string }>;
    return arr.map(h => (h.ticker ?? "").toUpperCase()).filter(Boolean);
  } catch { return []; }
}

function suggestionsFor(tab: string | undefined, ticker: string | null | undefined, hasPortfolio: boolean): string[] {
  if (tab === "portfolio" && hasPortfolio) {
    return [
      "Grade my portfolio",
      "What's my biggest risk?",
      "Suggest 2 stocks to balance my exposure",
      "What's the next earnings I should watch?",
    ];
  }
  if (tab === "top15") {
    return [
      "Which Top 15 pick has the strongest setup?",
      "Compare the top 3 picks",
      "Any picks to skip and why?",
    ];
  }
  if (tab === "watchlist") {
    return [
      "Rank my watchlist by short-term momentum",
      "Which has the best risk-reward right now?",
      "Any of these reporting earnings this week?",
    ];
  }
  if (ticker) {
    return [
      `Why is ${ticker} moving today?`,
      `Is ${ticker} a buy at this price?`,
      `Compare ${ticker} to its main peers`,
      `${ticker} earnings outlook`,
    ];
  }
  return [
    "What's moving in the market today?",
    "Best 3 sectors for the next 30 days",
    "Explain pre-market vs after-hours",
    "How do I read a P/E ratio?",
  ];
}

/* Tiny, dependency-free markdown → HTML. Handles: **bold**,
   *italic*, `code`, line breaks, "- " bullet lists. Anything
   else passes through as plain text. Escapes HTML to avoid
   injection — Claude's output is otherwise rendered raw. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function renderMd(raw: string): string {
  const lines = escapeHtml(raw).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-•]\s+(.+)$/);
    if (m) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inlineMd(m[1])}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      if (line.trim() === "") html += "<br/>";
      else html += `<div>${inlineMd(line)}</div>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}
function inlineMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/* Pull tickers explicitly mentioned in a message so the chat
   can adapt context when the user pivots ("ok what about NVDA").
   Looks for $TICKER, plain TICKER (1-5 caps), or "ticker NVDA"
   patterns. Filters by a short blocklist of common all-caps
   English words. */
const TICKER_BLOCKLIST = new Set([
  "I","A","AI","AND","OR","BUT","FOR","TO","IN","ON","AT","BY","OF","WITH",
  "IS","IT","AS","BE","AM","DO","SO","NO","NOT","WAS","ARE","WERE","BEEN",
  "THE","WHY","HOW","WHAT","WHEN","WHO","WHERE","CAN","WILL","WOULD","SHOULD",
  "OK","YES","NO","NOW","TLDR","FYI","BTW","P","E","ROI","P/E","PE","EPS","EOD",
  "ETF","IPO","CEO","CFO","CTO","COO","SEC","FED","GDP","CPI","RSI","MA","SMA",
  "USA","US","UK","EU","NYSE","NASDAQ","DOW","GOAT","LFG","IMO",
]);
function extractTickers(text: string): string[] {
  const found = new Set<string>();
  const re = /\$([A-Z]{1,5})\b|\b([A-Z]{2,5})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const t = (m[1] ?? m[2] ?? "").toUpperCase();
    if (t && !TICKER_BLOCKLIST.has(t)) found.add(t);
  }
  return [...found].slice(0, 5);
}

export default function AskClaude({ ticker, watchlistTickers, tab, isPro = true, onUpgrade }: Props) {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput]       = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [portfolioTickers, setPortfolioTickers] = useState<string[]>([]);
  // Lets the user override the page ticker (or remove it entirely)
  // so the chat doesn't get permanently stuck on whatever was on
  // screen when the panel was first opened.
  const [overrideTicker, setOverrideTicker] = useState<string | null | "cleared">(null);
  const abortRef  = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  // The ticker actually used as context: explicit override > page ticker
  const effectiveTicker = overrideTicker === "cleared" ? null : (overrideTicker ?? ticker ?? null);

  // Re-read holdings whenever the panel opens (so context stays
  // fresh after the user adds/removes positions in another tab)
  useEffect(() => {
    if (open) setPortfolioTickers(readPortfolioTickers());
  }, [open]);

  // Hydrate from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw) as ChatMsg[]);
    } catch { /* */ }
  }, []);

  // Persist on change (debounced via the natural batch of state changes)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* */ }
  }, [messages]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !streaming) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, streaming]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    // Free-tier quota check — Pro users skip entirely.
    if (!isPro) {
      const q = readQuota();
      if (q.count >= FREE_QUOTA) {
        onUpgrade?.();
        return;
      }
      bumpQuota();
    }
    setError(null);
    setInput("");

    const next: ChatMsg[] = [...messages, { role: "user", content: trimmed }, { role: "assistant", content: "" }];
    setMessages(next);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Re-read holdings at send time (covers the case where the user
      // edits their portfolio between opening the panel and sending)
      const freshHoldings = readPortfolioTickers();
      // If the user mentioned a specific ticker in this message, treat
      // it as the new focus — overrides whatever ticker the page had.
      const mentioned = extractTickers(trimmed);
      const focusTicker = mentioned[0] ?? effectiveTicker ?? null;
      if (mentioned[0] && mentioned[0] !== effectiveTicker) {
        setOverrideTicker(mentioned[0]);
      }
      const r = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(0, -1).filter(m => m.content.trim().length > 0),
          context:  {
            ticker: focusTicker,
            mentionedTickers: mentioned,
            portfolioTickers: freshHoldings,
            watchlistTickers,
            tab,
          },
        }),
        signal: controller.signal,
      });
      if (!r.ok || !r.body) {
        const errText = await r.text().catch(() => "");
        setError(errText || `Request failed (${r.status})`);
        setMessages(prev => prev.slice(0, -1)); // drop the empty assistant turn
        setStreaming(false);
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Network error");
        setMessages(prev => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, streaming, effectiveTicker, watchlistTickers, tab, isPro, onUpgrade]);

  const stop = () => { abortRef.current?.abort(); };
  const clear = () => {
    if (streaming) return;
    setMessages([]);
    setError(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const suggestions = suggestionsFor(tab, effectiveTicker, (portfolioTickers?.length ?? 0) > 0);

  return (
    <>
      {/* Floating launcher pill */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Ask Claude"
        title="Ask Claude (AI assistant)"
        style={{
          position: "fixed",
          bottom: "max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))",
          right: 16,
          zIndex: 8500,
          display: open ? "none" : "inline-flex",
          alignItems: "center", gap: 8,
          padding: "11px 16px 11px 13px",
          borderRadius: 99,
          background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
          color: "#0a0800",
          border: "none",
          cursor: "pointer",
          fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif",
          fontWeight: 800, fontSize: 13,
          boxShadow: "0 8px 32px rgba(240,165,0,0.5), 0 0 0 1px rgba(240,165,0,0.6)",
        }}
      >
        <Sparkles size={15} /> Ask Claude
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9000,
              background: "rgba(0,0,0,0.4)",
              backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
              display: "flex", justifyContent: "flex-end",
              pointerEvents: "auto",
            }}
            onClick={e => { if (e.target === e.currentTarget && !streaming) setOpen(false); }}
          >
            <motion.aside
              initial={{ x: 480, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 480, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
              role="dialog"
              aria-label="Ask Claude"
              className="vx-modal-shell"
              style={{
                width: "min(440px, 100vw)",
                height: "100vh",
                backdropFilter: "blur(40px) saturate(1.5)",
                WebkitBackdropFilter: "blur(40px) saturate(1.5)",
                borderLeft: "1px solid var(--border-hi,rgba(90,72,150,0.6))",
                display: "flex", flexDirection: "column",
                fontFamily: "'Syne',system-ui,sans-serif",
                color: "var(--ink1,#cdc7e0)",
              }}
            >
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 16px rgba(240,165,0,0.35)",
                  }}>
                    <Sparkles size={14} color="#0a0800" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontFamily: "'Cabinet Grotesk',system-ui,sans-serif", fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
                      Ask Claude
                    </h3>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink3,#3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      AI assistant · context-aware
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {messages.length > 0 && (
                    <button onClick={clear} disabled={streaming}
                      title="Clear conversation"
                      style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: streaming ? "not-allowed" : "pointer", padding: 6, display: "flex", borderRadius: 6 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                  <button onClick={() => !streaming && setOpen(false)}
                    aria-label="Close"
                    style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: streaming ? "not-allowed" : "pointer", padding: 6, display: "flex", borderRadius: 6 }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Context banner — clearly shows what Claude sees and
                  lets the user remove the ticker focus or pick a new
                  one from their watchlist. */}
              <div style={{ padding: "10px 18px", background: "rgba(240,165,0,0.06)", borderBottom: "1px solid rgba(240,165,0,0.20)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--gold,#f0a500)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
                  Focus
                </span>
                {effectiveTicker ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 4px 3px 9px", borderRadius: 99, background: "rgba(240,165,0,0.12)", border: "1px solid rgba(240,165,0,0.40)", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--gold,#f0a500)", fontWeight: 600 }}>
                    {effectiveTicker}
                    <button onClick={() => setOverrideTicker("cleared")}
                      title="Clear ticker focus"
                      style={{ background: "rgba(240,165,0,0.16)", border: "none", borderRadius: 99, padding: 2, display: "flex", cursor: "pointer", color: "var(--gold,#f0a500)" }}>
                      <X size={9} />
                    </button>
                  </span>
                ) : (
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--ink3,#3D5A7A)" }}>
                    no specific stock
                  </span>
                )}
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink3,#3D5A7A)" }}>·</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--ink2,#7A9CBF)" }}>
                  {(portfolioTickers?.length ?? 0)} pos · {(watchlistTickers?.length ?? 0)} watched
                </span>

                {/* Quick switches: ticker on the page (if different from current focus) */}
                {ticker && ticker !== effectiveTicker && (
                  <button onClick={() => setOverrideTicker(null)}
                    style={{ marginLeft: "auto", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border,rgba(60,48,100,0.5))", borderRadius: 99, padding: "3px 9px", color: "var(--ink2,#7A9CBF)", fontSize: 10, fontFamily: "'DM Mono',monospace", cursor: "pointer" }}
                    title={`Switch focus to ${ticker} (the stock you're viewing)`}>
                    → {ticker}
                  </button>
                )}
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
                {messages.length === 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
                    <p style={{ fontSize: 13, color: "var(--ink2,#7A9CBF)", margin: 0, lineHeight: 1.55 }}>
                      I can answer questions about any stock, your portfolio, the market, or trading concepts. I see whatever ticker or page you&apos;re on, so just ask naturally.
                    </p>
                    <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "4px 0 0" }}>
                      Try one of these
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
                      {suggestions.map(s => (
                        <button key={s} onClick={() => send(s)}
                          style={{
                            textAlign: "left", padding: "9px 12px", borderRadius: 9,
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border,rgba(60,48,100,0.5))",
                            color: "var(--ink1,#cdc7e0)", cursor: "pointer", fontSize: 12,
                            fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background    = "rgba(240,165,0,0.06)";
                            e.currentTarget.style.borderColor   = "rgba(240,165,0,0.32)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background    = "rgba(255,255,255,0.03)";
                            e.currentTarget.style.borderColor   = "var(--border,rgba(60,48,100,0.5))";
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => {
                  const isUser = m.role === "user";
                  const isLastAssistant = i === messages.length - 1 && m.role === "assistant" && streaming;
                  return (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: isUser ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#f0a500,#ffbe1a)",
                        border: isUser ? "1px solid var(--border,rgba(60,48,100,0.5))" : "none",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        color: isUser ? "var(--ink2,#7A9CBF)" : "#0a0800",
                      }}>
                        {isUser ? <User size={12} /> : <Bot size={13} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.12em", margin: "3px 0 4px", fontWeight: 600 }}>
                          {isUser ? "You" : "Claude"}
                        </p>
                        <div className="vx-chat-md"
                          style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink0,#f4f0ff)" }}
                          dangerouslySetInnerHTML={{ __html: m.content ? renderMd(m.content) : (isLastAssistant ? "<em style='color:var(--ink3,#3D5A7A)'>thinking…</em>" : "") }} />
                      </div>
                    </div>
                  );
                })}

                {error && (
                  <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(232,68,90,0.10)", border: "1px solid rgba(232,68,90,0.30)", color: "var(--loss,#ff4560)", fontSize: 12, fontFamily: "'DM Mono',monospace" }}>
                    {error}
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding: "12px 14px 14px", borderTop: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border,rgba(60,48,100,0.5))",
                  borderRadius: 12, padding: "8px 8px 8px 12px",
                }}>
                  <textarea ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={effectiveTicker ? `Ask about ${effectiveTicker}…` : "Ask anything about stocks…"}
                    rows={1}
                    style={{
                      flex: 1, resize: "none", background: "transparent", border: "none", outline: "none",
                      color: "var(--ink0,#f4f0ff)", fontSize: 13, fontFamily: "'Syne',system-ui,sans-serif",
                      padding: "4px 0", lineHeight: 1.4, maxHeight: 120, minHeight: 22,
                    }} />
                  {streaming ? (
                    <button onClick={stop}
                      title="Stop generating"
                      style={{
                        padding: 8, borderRadius: 8,
                        background: "rgba(232,68,90,0.10)",
                        border: "1px solid rgba(232,68,90,0.30)",
                        color: "var(--loss,#ff4560)", cursor: "pointer", display: "flex",
                      }}>
                      <X size={14} />
                    </button>
                  ) : (
                    <button onClick={() => send(input)}
                      disabled={!input.trim()}
                      title="Send (Enter)"
                      style={{
                        padding: 8, borderRadius: 8,
                        background: input.trim() ? "linear-gradient(135deg,#f0a500,#ffbe1a)" : "rgba(255,255,255,0.04)",
                        border: input.trim() ? "none" : "1px solid var(--border,rgba(60,48,100,0.5))",
                        color: input.trim() ? "#0a0800" : "var(--ink3,#3D5A7A)",
                        cursor: input.trim() ? "pointer" : "not-allowed", display: "flex",
                      }}>
                      <Send size={13} />
                    </button>
                  )}
                </div>
                <div style={{ margin: "8px 4px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 9, fontFamily: "'DM Mono',monospace", color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Enter to send · Shift+Enter for newline · Esc to close
                  </p>
                  {!isPro && (() => {
                    const q = readQuota();
                    const remaining = Math.max(0, FREE_QUOTA - q.count);
                    return (
                      <button onClick={() => onUpgrade?.()}
                        style={{
                          background: remaining === 0 ? "linear-gradient(135deg,#f0a500,#ffbe1a)" : "rgba(240,165,0,0.10)",
                          color:      remaining === 0 ? "#0a0800" : "var(--gold,#f0a500)",
                          border:     remaining === 0 ? "none" : "1px solid rgba(240,165,0,0.32)",
                          padding: "3px 9px", borderRadius: 99, cursor: "pointer",
                          fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                          textTransform: "uppercase", letterSpacing: "0.10em",
                        }}
                        title={remaining === 0 ? "Daily limit reached — upgrade for unlimited" : `${remaining} of ${FREE_QUOTA} messages left today`}>
                        {remaining === 0 ? "Upgrade for unlimited" : `${remaining}/${FREE_QUOTA} left · Pro`}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
