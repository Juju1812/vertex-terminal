import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

function hash(password: string): string {
  return createHash("sha256").update(password + "arbibx-salt-2026").digest("hex");
}

async function supabase(method: string, path: string, body?: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json() as { email: string; password: string };

    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const r = await supabase("POST", "/portfolios", {
      email: email.toLowerCase(),
      password_hash: hash(password),
      holdings: [],
    });

    if (r.status === 409) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    if (!r.ok) {
      const err = await r.text();
      console.error("Supabase signup error:", err);
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }

    const data = await r.json();
    const user = data[0];
    return NextResponse.json({ success: true, userId: user.id, email: user.email });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
