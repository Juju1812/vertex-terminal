import { NextRequest, NextResponse } from "next/server";

/* ── /api/portfolio — multi-portfolio aware ───────────────────
   Source of truth is the `portfolios_v2` jsonb column on the
   `portfolios` Supabase table:

     { list: Portfolio[], activeId: string }

   Each Portfolio = { id, name, holdings, startingCash, startedAt }.

   On read:
   - If `portfolios_v2` is present + non-empty, return it.
   - Else build a single-portfolio v2 from the legacy `holdings` +
     `starting_cash` + `started_at` columns so existing accounts keep
     working without forcing a write.

   On write:
   - Accept either a full v2 payload `{ portfolios, activeId }` OR
     legacy single-portfolio fields (`holdings`, `startingCash`,
     `startedAt`, `resetStart`) which apply to the *active* portfolio.
   - Always mirror the active portfolio's holdings/start fields back
     into the legacy columns so consumers like the daily-digest cron
     keep functioning.
*/

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

interface Holding { id: string; ticker: string; shares: number; buyPrice: number }
interface Snapshot { d: string; v: number }
interface Portfolio {
  id:           string;
  name:         string;
  holdings:     Holding[];
  startingCash: number | null;
  startedAt:    string | null;
  snapshots:    Snapshot[];
}
interface PortfoliosV2 {
  list:     Portfolio[];
  activeId: string;
}
interface PortfolioRow {
  id:             string;
  email:          string;
  holdings:       unknown[];
  starting_cash:  number | null;
  started_at:     string | null;
  portfolios_v2:  PortfoliosV2 | null;
}

const HDR = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

/* ── Helpers ─────────────────────────────────────────────── */

function newId(prefix = "p"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizePortfolio(p: unknown, fallbackName = "Main"): Portfolio {
  const o = (p && typeof p === "object") ? p as Record<string, unknown> : {};
  const id = typeof o.id === "string" && o.id ? o.id : newId();
  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 60) : fallbackName;
  const holdingsRaw = Array.isArray(o.holdings) ? o.holdings : [];
  const holdings: Holding[] = holdingsRaw
    .map(h => {
      const oh = (h && typeof h === "object") ? h as Record<string, unknown> : {};
      return {
        id:       typeof oh.id       === "string" ? oh.id : newId("h"),
        ticker:   typeof oh.ticker   === "string" ? oh.ticker.toUpperCase() : "",
        shares:   typeof oh.shares   === "number" ? oh.shares : Number(oh.shares) || 0,
        buyPrice: typeof oh.buyPrice === "number" ? oh.buyPrice : Number(oh.buyPrice) || 0,
      };
    })
    .filter(h => h.ticker && h.shares > 0 && h.buyPrice > 0);
  const startingCash = typeof o.startingCash === "number" && o.startingCash > 0 ? o.startingCash : null;
  const startedAt    = typeof o.startedAt    === "string" && o.startedAt ? o.startedAt : null;
  // Snapshots: array of { d: "YYYY-MM-DD", v: number }. Capped at 730
  // entries (~2 years of daily) so the row stays small.
  const snapshotsRaw = Array.isArray(o.snapshots) ? o.snapshots : [];
  const snapshots: Snapshot[] = snapshotsRaw
    .map(s => {
      const so = (s && typeof s === "object") ? s as Record<string, unknown> : {};
      return {
        d: typeof so.d === "string" ? so.d : "",
        v: typeof so.v === "number" ? so.v : Number(so.v) || 0,
      };
    })
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.d) && s.v >= 0)
    .slice(-730);
  return { id, name, holdings, startingCash, startedAt, snapshots };
}

function buildV2FromLegacy(row: PortfolioRow): PortfoliosV2 {
  const p: Portfolio = {
    id: newId(),
    name: "Main",
    holdings: Array.isArray(row.holdings)
      ? (row.holdings as unknown[]).map(h => sanitizePortfolio({ holdings: [h] }).holdings[0]).filter(Boolean) as Holding[]
      : [],
    startingCash: typeof row.starting_cash === "number" ? row.starting_cash : null,
    startedAt:    typeof row.started_at    === "string" ? row.started_at    : null,
    snapshots:    [],
  };
  // Recompute holdings via direct sanitization of array items
  const holdingsRaw = Array.isArray(row.holdings) ? row.holdings : [];
  p.holdings = holdingsRaw.map(h => {
    const oh = (h && typeof h === "object") ? h as Record<string, unknown> : {};
    return {
      id:       typeof oh.id       === "string" ? oh.id : newId("h"),
      ticker:   typeof oh.ticker   === "string" ? oh.ticker.toUpperCase() : "",
      shares:   typeof oh.shares   === "number" ? oh.shares : Number(oh.shares) || 0,
      buyPrice: typeof oh.buyPrice === "number" ? oh.buyPrice : Number(oh.buyPrice) || 0,
    };
  }).filter(h => h.ticker && h.shares > 0 && h.buyPrice > 0);
  return { list: [p], activeId: p.id };
}

function pickActive(v2: PortfoliosV2): Portfolio {
  return v2.list.find(p => p.id === v2.activeId) ?? v2.list[0];
}

async function getRow(email: string, token: string): Promise<PortfolioRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=*`,
    { headers: HDR }
  );
  if (!res.ok) {
    console.error("getRow failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json() as Array<Record<string, unknown>>;
  const row = data?.[0];
  if (!row) return null;

  // portfolios_v2 may be string (jsonb-as-text) or object — handle both
  let v2: PortfoliosV2 | null = null;
  const raw = row.portfolios_v2;
  if (raw && typeof raw === "object" && Array.isArray((raw as { list?: unknown }).list)) {
    v2 = raw as PortfoliosV2;
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.list)) v2 = parsed;
    } catch { /* */ }
  }

  return {
    id:            String(row.id ?? ""),
    email:         String(row.email ?? ""),
    holdings:      Array.isArray(row.holdings) ? row.holdings : [],
    starting_cash: typeof row.starting_cash === "number" ? row.starting_cash : null,
    started_at:    typeof row.started_at    === "string" ? row.started_at    : null,
    portfolios_v2: v2,
  };
}

function readV2(row: PortfolioRow): PortfoliosV2 {
  if (row.portfolios_v2 && row.portfolios_v2.list.length > 0) {
    // Sanitize each portfolio defensively
    const list = row.portfolios_v2.list.map((p, i) => sanitizePortfolio(p, `Portfolio ${i + 1}`));
    const activeId = list.some(p => p.id === row.portfolios_v2!.activeId)
      ? row.portfolios_v2.activeId
      : list[0].id;
    return { list, activeId };
  }
  return buildV2FromLegacy(row);
}

/* ── GET — load portfolios ─────────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!email || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await getRow(email, token);
    if (!row) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const v2 = readV2(row);
    const active = pickActive(v2);

    return NextResponse.json({
      portfolios:   v2.list,
      activeId:     v2.activeId,
      // Legacy single-portfolio fields, populated from the active
      // portfolio so callers that still read these keep working.
      holdings:     active?.holdings ?? [],
      startingCash: active?.startingCash ?? null,
      startedAt:    active?.startedAt    ?? null,
    });
  } catch (err) {
    console.error("Portfolio GET error:", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

/* ── POST — save portfolios ─────────────────────────────── */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email:        string;
      token:        string;
      // New v2 payload
      portfolios?:  unknown[];
      activeId?:    string;
      // Legacy single-portfolio updates (apply to active)
      holdings?:    unknown[];
      startingCash?: number | null;
      startedAt?:   string | null;
      resetStart?:  boolean;
    };
    const { email, token } = body;

    if (!email || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const row = await getRow(email, token);
    if (!row) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    let v2 = readV2(row);

    if (Array.isArray(body.portfolios)) {
      // Full v2 replace. Sanitize each portfolio.
      const list = body.portfolios.map((p, i) => sanitizePortfolio(p, `Portfolio ${i + 1}`));
      if (!list.length) {
        // Don't allow empty list — fall back to a single empty Main portfolio
        list.push({ id: newId(), name: "Main", holdings: [], startingCash: null, startedAt: null, snapshots: [] });
      }
      const activeId = (typeof body.activeId === "string" && list.some(p => p.id === body.activeId))
        ? body.activeId
        : list[0].id;
      v2 = { list, activeId };
    } else {
      // Legacy partial update — operate on the active portfolio.
      const idx = v2.list.findIndex(p => p.id === v2.activeId);
      if (idx >= 0) {
        const cur = v2.list[idx];
        const next: Portfolio = { ...cur };
        if (Array.isArray(body.holdings)) {
          // Re-sanitize holdings
          next.holdings = body.holdings.map(h => {
            const oh = (h && typeof h === "object") ? h as Record<string, unknown> : {};
            return {
              id:       typeof oh.id       === "string" ? oh.id : newId("h"),
              ticker:   typeof oh.ticker   === "string" ? oh.ticker.toUpperCase() : "",
              shares:   typeof oh.shares   === "number" ? oh.shares : Number(oh.shares) || 0,
              buyPrice: typeof oh.buyPrice === "number" ? oh.buyPrice : Number(oh.buyPrice) || 0,
            };
          }).filter(h => h.ticker && h.shares > 0 && h.buyPrice > 0);
        }
        if (body.resetStart) {
          next.startingCash = null;
          next.startedAt    = null;
        } else {
          if (typeof body.startingCash === "number" && body.startingCash > 0) {
            next.startingCash = body.startingCash;
            next.startedAt    = (typeof body.startedAt === "string" && body.startedAt)
              ? body.startedAt
              : (cur.startedAt ?? new Date().toISOString());
          } else if (typeof body.startedAt === "string") {
            next.startedAt = body.startedAt;
          }
        }
        v2.list[idx] = next;
      }
    }

    const active = pickActive(v2);

    // Write portfolios_v2 + mirror active fields to legacy columns so
    // consumers like the daily-digest cron + share routes keep reading
    // a sensible single-portfolio view.
    const patch: Record<string, unknown> = {
      portfolios_v2: v2,
      holdings: active.holdings,
      starting_cash: active.startingCash,
      started_at: active.startedAt,
    };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...HDR, "Prefer": "return=minimal" },
        body: JSON.stringify(patch),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Portfolio save failed:", res.status, errText);
      const missingColumn = /column.*does not exist|could not find.*column/i.test(errText);
      if (missingColumn) {
        return NextResponse.json({
          error: "Schema missing — run this SQL in Supabase first:\n\nalter table portfolios add column if not exists portfolios_v2 jsonb;\nalter table portfolios add column if not exists starting_cash numeric;\nalter table portfolios add column if not exists started_at timestamptz;",
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to save portfolio: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    return NextResponse.json({
      success:    true,
      portfolios: v2.list,
      activeId:   v2.activeId,
    });
  } catch (err) {
    console.error("Portfolio POST error:", err);
    return NextResponse.json({ error: "Failed to save portfolio" }, { status: 500 });
  }
}
