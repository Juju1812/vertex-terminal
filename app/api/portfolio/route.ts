import { NextRequest, NextResponse } from "next/server";

const URL_  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY   = process.env.SUPABASE_SECRET_KEY!;
const HDR   = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

async function verifyUser(email: string, token: string) {
  const r = await fetch(
    `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=id,holdings`,
    { headers: HDR }
  );
  const d = await r.json() as Record<string, unknown>[];
  return d?.[0] ?? null;
}

/* GET ??? load holdings */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email") ?? "";
    const token = searchParams.get("token") ?? "";
    if (!email || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await verifyUser(email, token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({ holdings: user.holdings ?? [] });
  } catch (err) {
    console.error("Portfolio GET error:", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

/* POST ??? save holdings */
export async function POST(req: NextRequest) {
  try {
    const { email, token, holdings } = await req.json() as { email: string; token: string; holdings: unknown[] };
    if (!email || !token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await verifyUser(email, token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await fetch(`${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { ...HDR, "Prefer": "return=minimal" },
      body: JSON.stringify({ holdings }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Portfolio POST error:", err);
    return NextResponse.json({ error: "Failed to save portfolio" }, { status: 500 });
  }
}
