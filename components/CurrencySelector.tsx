"use client";

import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

/* ── Global currency selector ─────────────────────────────────
   Lives in the page header next to Settings / Theme so it's
   always one click away. Stores the choice in localStorage and
   dispatches a custom event so any component that converts
   values (MyStocks, etc.) can re-read on change without prop
   drilling. */

const CURRENCY_KEY = "arbibx-portfolio-currency";

const CURRENCIES = [
  { code: "USD", name: "US Dollar",        symbol: "$"  },
  { code: "EUR", name: "Euro",             symbol: "€"  },
  { code: "GBP", name: "British Pound",    symbol: "£"  },
  { code: "CAD", name: "Canadian Dollar",  symbol: "C$" },
  { code: "JPY", name: "Japanese Yen",     symbol: "¥"  },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc",      symbol: "Fr" },
  { code: "INR", name: "Indian Rupee",     symbol: "₹"  },
] as const;
type CurrencyCode = typeof CURRENCIES[number]["code"];

export default function CurrencySelector() {
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  // Hydrate from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CURRENCY_KEY) as CurrencyCode | null;
      if (saved && CURRENCIES.some(c => c.code === saved)) {
        setCurrency(saved);
      }
    } catch { /* */ }
  }, []);

  const change = (next: CurrencyCode) => {
    setCurrency(next);
    try { localStorage.setItem(CURRENCY_KEY, next); } catch { /* */ }
    // Tell MyStocks (and any future listener) that the choice changed
    window.dispatchEvent(new CustomEvent("arbibx-currency-change", { detail: next }));
  };

  const active = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0];

  return (
    <label
      title={`Display currency · ${active.name}. Currently applied to portfolio values.`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 0,
        borderRadius: 8,
        border: "1px solid transparent",
        background: "transparent",
        cursor: "pointer",
        padding: 0,
        height: 36,
      }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "0 8px", height: "100%",
        color: "var(--ink3, #3D5A7A)",
        fontFamily: "'DM Mono', monospace",
        fontSize: 11, fontWeight: 700,
      }}>
        <DollarSign size={13} />
        <span style={{ letterSpacing: "0.04em" }}>{active.code}</span>
      </span>
      <select
        value={currency}
        onChange={e => change(e.target.value as CurrencyCode)}
        aria-label="Display currency"
        style={{
          position: "absolute",
          opacity: 0,
          width: 80,
          height: 36,
          cursor: "pointer",
        }}>
        {CURRENCIES.map(c => (
          <option key={c.code} value={c.code} style={{ background: "#0a0810", color: "#fff" }}>
            {c.symbol} {c.code} — {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
