import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

/* Helpers */
async function verifyUser(email: string, token: string): Promise<boolean> {
  if (!email || !token) return false;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=email`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  if (!r.ok) return false;
  const rows = await r.json() as unknown[];
  return rows.length > 0;
}

/* GET /api/alerts?email=&token=
   Returns all alerts for this user (both pending and triggered). */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email") ?? "";
    const token = req.nextUrl.searchParams.get("token") ?? "";
    if (!await verifyUser(email, token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/price_alerts?owner_email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    const alerts = await r.json();
    return NextResponse.json({ alerts });
  } catch (err) {
    console.error("[alerts] GET error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/* POST /api/alerts
   Body: { email, token, ticker, condition, targetPrice }
   Creates a new alert. Returns the created row. */
export async function POST(req: NextRequest) {
  try {
    const { email, token, ticker, condition, targetPrice } = await req.json() as {
      email: string; token: string; ticker: string;
      condition: "above" | "below"; targetPrice: number;
    };
    if (!await verifyUser(email, token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!ticker || !condition || !targetPrice || targetPrice <= 0) {
      return NextResponse.json({ error: "Invalid alert" }, { status: 400 });
    }
    const r = await fetch(`${SUPABASE_URL}/rest/v1/price_alerts`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        owner_email: email,
        ticker: ticker.toUpperCase(),
        condition,
        target_price: targetPrice,
      }),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("[alerts] insert failed:", r.status, errText);
      return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }
    const created = await r.json();
    return NextResponse.json({ alert: Array.isArray(created) ? created[0] : created });
  } catch (err) {
    console.error("[alerts] POST error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/* DELETE /api/alerts
   Body: { email, token, id }
   Removes a single alert. */
export async function DELETE(req: NextRequest) {
  try {
    const { email, token, id } = await req.json() as { email: string; token: string; id: string };
    if (!await verifyUser(email, token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/price_alerts?id=eq.${encodeURIComponent(id)}&owner_email=eq.${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=minimal" },
      }
    );
    if (!r.ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[alerts] DELETE error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
