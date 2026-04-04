import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { userId, holdings } = await req.json() as { userId: string; holdings: unknown[] };

    if (!userId) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?id=eq.${userId}`,
      {
        method: "PATCH",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ holdings }),
      }
    );

    if (!r.ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
