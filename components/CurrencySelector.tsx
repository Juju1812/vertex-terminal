"use client";

import { DollarSign } from "lucide-react";
import { CURRENCIES, setCurrency, useCurrency, type CurrencyCode } from "./useCurrency";

/* ── Global currency selector ─────────────────────────────────
   Lives in the page header next to Settings / Theme so it's
   always one click away. Uses the shared useCurrency hook so
   the choice instantly applies to every price on the site. */

export default function CurrencySelector() {
  const { currency } = useCurrency();
  const active = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0];

  return (
    <label
      title={`Display currency · ${active.name}. Applies to every price across the site.`}
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
        onChange={e => setCurrency(e.target.value as CurrencyCode)}
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
