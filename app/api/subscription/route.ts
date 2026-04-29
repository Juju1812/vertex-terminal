import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  if (!email || !token) {
    return NextResponse.json({ isPro: false });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&select=subscription_status,subscription_end,token`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const rows = await r.json() as { subscription_status: string; subscription_end: string | null; token: string }[];
    const row  = rows[0];

    if (!row || row.token !== token) {
      return NextResponse.json({ isPro: false });
    }

    // Check if subscription is active
    const isPro = row.subscription_status === "pro" && (
      !row.subscription_end || new Date(row.subscription_end) > new Date()
    );

    return NextResponse.json({ isPro, status: row.subscription_status, endsAt: row.subscription_end });
  } catch {
    return NextResponse.json({ isPro: false });
  }
}
