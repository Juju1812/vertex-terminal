import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

function hash(password: string): string {
  return createHash("sha256").update(password + "arbibx-salt-2026").digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string };

    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!r.ok) return NextResponse.json({ error: "Login failed" }, { status: 500 });

    const users = await r.json() as { id: string; email: string; password_hash: string; holdings: unknown[] }[];
    if (!users.length) return NextResponse.json({ error: "No account found with this email" }, { status: 404 });

    const user = users[0];
    if (user.password_hash !== hash(password)) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    return NextResponse.json({ success: true, userId: user.id, email: user.email, holdings: user.holdings ?? [] });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
