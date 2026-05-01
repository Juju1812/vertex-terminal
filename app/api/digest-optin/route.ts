import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY  = process.env.SUPABASE_SECRET_KEY ?? "";
const HDR  = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

/* ── Daily-digest opt-in toggle ─────────────────────────────
   Auth: same pattern as /api/portfolio — caller passes their
   {email, token} which is checked against the row in
   `portfolios`. Body { enabled: boolean } updates the
   digest_optin column. */
export async function POST(req: NextRequest) {
  try {
    const { email, token, enabled } = await req.json() as {
      email:   string;
      token:   string;
      enabled: boolean;
    };

    if (!email || !token || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const em = email.toLowerCase().trim();

    // Verify the token matches the row
    const r = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(em)}&select=token`,
      { headers: HDR }
    );
    if (!r.ok) return NextResponse.json({ error: "Auth lookup failed" }, { status: 500 });
    const rows = await r.json() as { token: string | null }[];
    if (rows[0]?.token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Update opt-in flag
    const ur = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(em)}`,
      {
        method:  "PATCH",
        headers: { ...HDR, "Prefer": "return=minimal" },
        body:    JSON.stringify({ digest_optin: enabled }),
      }
    );
    if (!ur.ok) {
      const errText = await ur.text();
      console.error("digest-optin update failed:", errText);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled });
  } catch (err) {
    console.error("digest-optin error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/* ── Read current opt-in state ───────────────────────────── */
export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("email");
    const token = req.nextUrl.searchParams.get("token");
    if (!email || !token) {
      return NextResponse.json({ error: "Missing email/token" }, { status: 400 });
    }
    const em = email.toLowerCase().trim();
    const r = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(em)}&select=token,digest_optin`,
      { headers: HDR }
    );
    if (!r.ok) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    const rows = await r.json() as { token: string | null; digest_optin: boolean | null }[];
    const row = rows[0];
    if (row?.token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ enabled: row.digest_optin === true });
  } catch (err) {
    console.error("digest-optin GET error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
