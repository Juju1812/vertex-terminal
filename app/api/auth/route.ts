import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";

const URL_  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY   = process.env.SUPABASE_SECRET_KEY!;
const HDR   = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

function hash(pw: string, salt: string) {
  return createHash("sha256").update(pw + salt).digest("hex");
}

async function findUser(email: string) {
  const r = await fetch(`${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&select=*`, { headers: HDR });
  if (!r.ok) {
    console.error("findUser failed:", r.status, await r.text());
    return null;
  }
  const d = await r.json() as Record<string, unknown>[];
  return d?.[0] ?? null;
}

async function createUser(email: string, passwordHash: string, token: string) {
  const r = await fetch(`${URL_}/rest/v1/portfolios`, {
    method: "POST",
    headers: { ...HDR, "Prefer": "return=representation" },
    body: JSON.stringify({ email, password_hash: passwordHash, token, holdings: [] }),
  });
  if (!r.ok) {
    console.error("createUser failed:", r.status, await r.text());
  }
  return r.ok;
}

async function updateToken(email: string, token: string) {
  await fetch(`${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { ...HDR, "Prefer": "return=minimal" },
    body: JSON.stringify({ token }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action, email, password } = await req.json() as { action: string; email: string; password: string };

    const em = email?.toLowerCase().trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em))
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    if (action === "signup") {
      const existing = await findUser(em);
      if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

      const salt  = randomBytes(16).toString("hex");
      const token = randomBytes(32).toString("hex");
      const ph    = hash(password, salt) + ":" + salt;
      const ok    = await createUser(em, ph, token);
      if (!ok) return NextResponse.json({ error: "Failed to create account" }, { status: 500 });

      return NextResponse.json({ success: true, user: { email: em, token }, holdings: [] });
    }

    if (action === "login") {
      const user = await findUser(em);
      if (!user) return NextResponse.json({ error: "No account found with this email" }, { status: 401 });

      const [storedHash, salt] = (user.password_hash as string).split(":");
      if (hash(password, salt) !== storedHash)
        return NextResponse.json({ error: "Incorrect password" }, { status: 401 });

      const token = randomBytes(32).toString("hex");
      await updateToken(em, token);

      return NextResponse.json({ success: true, user: { email: em, token }, holdings: user.holdings ?? [] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Auth error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
