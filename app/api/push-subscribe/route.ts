import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { email, token, subscription } = await req.json() as {
      email: string;
      token: string;
      subscription: PushSubscriptionJSON;
    };

    if (!email || !token || !subscription) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Store subscription in Supabase on the user's row
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ push_subscription: JSON.stringify(subscription) }),
      }
    );

    if (!r.ok) throw new Error(`Supabase error: ${r.status}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email, token } = await req.json() as { email: string; token: string };
    if (!email || !token) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({ push_subscription: null }),
      }
    );

    if (!r.ok) throw new Error(`Supabase error: ${r.status}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
