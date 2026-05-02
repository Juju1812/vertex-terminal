import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

interface PortfolioRow {
  id: string;
  email: string;
  holdings: unknown[];
  starting_cash: number | null;
  started_at: string | null;
}

async function getUser(email: string, token: string): Promise<PortfolioRow | null> {
  // Use SELECT * so this still works even if starting_cash / started_at
  // columns haven't been added to the schema yet — we just gracefully
  // treat them as null until the user runs the migration.
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=*`,
    {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    console.error("getUser failed:", res.status, await res.text());
    return null;
  }
  const data = await res.json() as Array<Record<string, unknown>>;
  const row = data?.[0];
  if (!row) return null;
  return {
    id:            String(row.id ?? ""),
    email:         String(row.email ?? ""),
    holdings:      Array.isArray(row.holdings) ? row.holdings : [],
    starting_cash: typeof row.starting_cash === "number" ? row.starting_cash : null,
    started_at:    typeof row.started_at    === "string" ? row.started_at    : null,
  };
}

/* GET — load holdings + portfolio meta */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const token = searchParams.get("token");

    if (!email || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser(email, token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    return NextResponse.json({
      holdings:     user.holdings ?? [],
      startingCash: user.starting_cash,
      startedAt:    user.started_at,
    });
  } catch (err) {
    console.error("Portfolio GET error:", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

/* POST — save holdings (and optionally starting_cash / started_at) */
export async function POST(req: NextRequest) {
  try {
    const { email, token, holdings, startingCash, startedAt, resetStart } = await req.json() as {
      email:         string;
      token:         string;
      holdings?:     unknown[];
      startingCash?: number | null;
      startedAt?:    string | null;
      resetStart?:   boolean;
    };

    if (!email || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser(email, token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Build the patch body — only include fields the caller actually
    // sent so we never blow away starting_cash on a routine holdings save.
    const body: Record<string, unknown> = {};
    if (Array.isArray(holdings)) body.holdings = holdings;
    if (resetStart) {
      body.starting_cash = null;
      body.started_at    = null;
    } else {
      if (typeof startingCash === "number" && startingCash > 0) {
        body.starting_cash = startingCash;
        // Set started_at the first time the user sets a baseline,
        // OR honor an explicitly-provided value (e.g. backdating).
        body.started_at = (typeof startedAt === "string" && startedAt)
          ? startedAt
          : (user.started_at ?? new Date().toISOString());
      } else if (typeof startedAt === "string") {
        body.started_at = startedAt;
      }
    }

    if (!Object.keys(body).length) {
      return NextResponse.json({ success: true });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Portfolio save failed:", res.status, errText);
      // Detect missing-column errors and give actionable guidance
      const missingColumn = /column.*does not exist|could not find.*column/i.test(errText);
      if (missingColumn) {
        return NextResponse.json({
          error: "Schema missing — run this SQL in Supabase first:\n\nalter table portfolios add column if not exists starting_cash numeric;\nalter table portfolios add column if not exists started_at timestamptz;",
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to save portfolio: ${errText.slice(0, 200)}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Portfolio POST error:", err);
    return NextResponse.json({ error: "Failed to save portfolio" }, { status: 500 });
  }
}
