import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY  = process.env.SUPABASE_SECRET_KEY ?? "";
const HDR  = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

const ADMIN_EMAIL = "daddyjulian@arbibx.com";

/* ── Admin user list ─────────────────────────────────────────
   Returns email + subscription_status for every account.
   Same auth as grant-pro: { adminEmail, adminToken } in body.
*/
export async function POST(req: NextRequest) {
  try {
    const { adminEmail, adminToken } = await req.json() as {
      adminEmail: string;
      adminToken: string;
    };
    if (!adminEmail || !adminToken) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const r = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=token`,
      { headers: HDR }
    );
    if (!r.ok) return NextResponse.json({ error: "Auth lookup failed" }, { status: 500 });
    const rows = await r.json() as { token: string | null }[];
    if (rows[0]?.token !== adminToken) {
      return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
    }

    const ur = await fetch(
      `${URL_}/rest/v1/portfolios?select=email,subscription_status,subscription_end&order=email.asc`,
      { headers: HDR }
    );
    if (!ur.ok) return NextResponse.json({ error: "List fetch failed" }, { status: 500 });
    const users = await ur.json() as Array<{
      email: string;
      subscription_status: string | null;
      subscription_end: string | null;
    }>;

    return NextResponse.json({ users });
  } catch (err) {
    console.error("admin list error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
