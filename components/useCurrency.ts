"use client";

import { useEffect, useMemo, useState } from "react";

/* ── Global currency hook ─────────────────────────────────────
   Single source of truth for the user's display currency.
   Components call useCurrency() to get a re-renders-on-change
   `f$` formatter that converts USD inputs into the chosen
   currency at the latest cached FX rate.

   FX rates come from a free public endpoint (no key) and are
   cached in localStorage for 1h plus an in-memory cache so a
   page with many price components only fetches once. */

const CURRENCY_KEY = "arbibx-portfolio-currency";
const FX_CACHE_KEY = "arbibx-fx-rates-v1";
const FX_TTL_MS    = 60 * 60 * 1000;

export const CURRENCIES = [
  { code: "USD", name: "US Dollar",         symbol: "$"  },
  { code: "EUR", name: "Euro",              symbol: "€"  },
  { code: "GBP", name: "British Pound",     symbol: "£"  },
  { code: "CAD", name: "Canadian Dollar",   symbol: "C$" },
  { code: "JPY", name: "Japanese Yen",      symbol: "¥"  },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc",       symbol: "Fr" },
  { code: "INR", name: "Indian Rupee",      symbol: "₹"  },
] as const;
export type CurrencyCode = typeof CURRENCIES[number]["code"];

export const CURRENCY_STORAGE_KEY = CURRENCY_KEY;
export const CURRENCY_CHANGE_EVENT = "arbibx-currency-change";

/* ── Module-level caches ─────────────────────────────────────
   Shared across every hook instance so a page that renders 30
   prices fires one fetch, not 30. */
let cachedRates: Record<string, number> | null = null;
let inflightFetch: Promise<Record<string, number>> | null = null;

function readCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  try {
    const v = localStorage.getItem(CURRENCY_KEY);
    if (v && CURRENCIES.some(c => c.code === v)) return v as CurrencyCode;
  } catch { /* */ }
  return "USD";
}

function loadFxRates(): Promise<Record<string, number>> {
  if (cachedRates) return Promise.resolve(cachedRates);
  if (typeof window === "undefined") return Promise.resolve({ USD: 1 });
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { rates: Record<string, number>; expiresAt: number };
      if (parsed.expiresAt > Date.now() && parsed.rates?.USD) {
        cachedRates = parsed.rates;
        return Promise.resolve(cachedRates);
      }
    }
  } catch { /* */ }
  if (!inflightFetch) {
    inflightFetch = fetch("https://api.exchangerate-api.com/v4/latest/USD", { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("fx fetch failed")))
      .then((d: { rates?: Record<string, number> }) => {
        const rates = { USD: 1, ...(d.rates ?? {}) };
        cachedRates = rates;
        try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates, expiresAt: Date.now() + FX_TTL_MS })); } catch { /* */ }
        return rates;
      })
      .catch(() => {
        cachedRates = { USD: 1 };
        return cachedRates;
      })
      .finally(() => { inflightFetch = null; });
  }
  return inflightFetch;
}

/* ── Setter helper (used by CurrencySelector) ─────────────── */
export function setCurrency(next: CurrencyCode) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CURRENCY_KEY, next); } catch { /* */ }
  window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: next }));
}

/* ── The hook ─────────────────────────────────────────────── */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => readCurrency());
  const [rates, setRates]            = useState<Record<string, number>>(() => cachedRates ?? { USD: 1 });

  useEffect(() => {
    let cancelled = false;
    if (!cachedRates) {
      loadFxRates().then(r => { if (!cancelled) setRates(r); });
    } else if (rates !== cachedRates) {
      setRates(cachedRates);
    }
    const onChange = (e: Event) => {
      const next = (e as CustomEvent).detail as CurrencyCode | undefined;
      if (next && CURRENCIES.some(c => c.code === next)) setCurrencyState(next);
      else setCurrencyState(readCurrency());
    };
    window.addEventListener(CURRENCY_CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CURRENCY_CHANGE_EVENT, onChange);
    };
    // intentionally empty deps — listener should attach once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fxRate  = rates[currency] ?? 1;
  // "ready" means we have a real rate (or USD which never needs one),
  // so callers can short-circuit display until conversion is trustworthy.
  const fxReady = currency === "USD" || (rates[currency] != null && rates[currency] !== 1);

  const f$ = useMemo(() => {
    return (n: number, d = 2): string => {
      const decimals = currency === "JPY" ? 0 : d;
      const value    = Number.isFinite(n) ? n * fxRate : 0;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    };
  }, [currency, fxRate]);

  return { currency, fxRate, fxReady, f$ };
}
