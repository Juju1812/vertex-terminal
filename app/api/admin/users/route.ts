import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY  = process.env.SUPABASE_SECRET_KEY ?? "";
const HDR  = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

const ADMIN_EMAIL = "julian.arbib@hotmail.com";

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

    // Use SELECT * so the query works even if subscription_status /
    // subscription_end columns haven't been added to the schema yet
    // (e.g., before the Stripe webhook SQL has been run). Then
    // gracefully extract just the fields we care about.
    const ur = await fetch(
      `${URL_}/rest/v1/portfolios?select=*&order=email.asc`,
      { headers: HDR }
    );
    if (!ur.ok) {
      const errText = await ur.text().catch(() => "");
      console.error("admin/users list fetch failed:", ur.status, errText);
      return NextResponse.json({ error: `Supabase ${ur.status}: ${errText.slice(0, 200)}` }, { status: 500 });
    }
    const raw = await ur.json() as Array<Record<string, unknown>>;
    const users = raw.map(r => ({
      email:               typeof r.email === "string" ? r.email : "",
      subscription_status: typeof r.subscription_status === "string" ? r.subscription_status : null,
      subscription_end:    typeof r.subscription_end    === "string" ? r.subscription_end    : null,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("admin list error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
