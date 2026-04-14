import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

async function getUser(email: string, token: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&token=eq.${token}&select=id,email,holdings`,
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
  const data = await res.json() as unknown[];
  return (data?.[0] as { id: string; email: string; holdings: unknown[] }) ?? null;
}

/* GET -- load holdings */
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

    return NextResponse.json({ holdings: user.holdings ?? [] });
  } catch (err) {
    console.error("Portfolio GET error:", err);
    return NextResponse.json({ error: "Failed to load portfolio" }, { status: 500 });
  }
}

/* POST -- save holdings */
export async function POST(req: NextRequest) {
  try {
    const { email, token, holdings } = await req.json() as {
      email: string;
      token: string;
      holdings: unknown[];
    };

    if (!email || !token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUser(email, token);
    if (!user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
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
        body: JSON.stringify({ holdings }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to save portfolio" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Portfolio POST error:", err);
    return NextResponse.json({ error: "Failed to save portfolio" }, { status: 500 });
  }
}
