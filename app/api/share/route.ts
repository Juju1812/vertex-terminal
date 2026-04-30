import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

/* POST /api/share
   Create a new shareable portfolio snapshot. Body:
     { email, token, holdings, showAmounts? }
   Returns: { id }                                            */
export async function POST(req: NextRequest) {
  try {
    const { email, token, holdings, showAmounts } = await req.json() as {
      email: string;
      token: string;
      holdings: unknown[];
      showAmounts?: boolean;
    };

    if (!email || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!Array.isArray(holdings) || !holdings.length) {
      return NextResponse.json({ error: "Empty portfolio" }, { status: 400 });
    }

    // Verify the user/token matches a real account
    const verifyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=email`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!verifyRes.ok) return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
    const rows = await verifyRes.json() as unknown[];
    if (!rows.length) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

    // Insert snapshot
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/shared_portfolios`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        owner_email: email,
        show_amounts: !!showAmounts,
        snapshot: { holdings, capturedAt: new Date().toISOString() },
      }),
    });

    if (!ins.ok) {
      const err = await ins.text().catch(() => "");
      console.error("[share] insert failed:", ins.status, err);
      return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
    }

    const created = await ins.json() as Array<{ id: string }>;
    return NextResponse.json({ id: created[0]?.id });
  } catch (err) {
    console.error("[share] POST error:", err);
    return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
  }
}
