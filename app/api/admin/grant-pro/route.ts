import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY  = process.env.SUPABASE_SECRET_KEY ?? "";
const HDR  = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

const ADMIN_EMAIL = "julian.arbib@hotmail.com";

/* ── Admin endpoint: grant or revoke Pro for any account ────
   Auth: caller must pass { adminEmail, adminToken } that match
   the admin row in `portfolios` AND adminEmail must equal the
   hardcoded ADMIN_EMAIL constant above. Anything else is 401.

   Body: { adminEmail, adminToken, targetEmail, action: "grant" | "revoke" }
*/
export async function POST(req: NextRequest) {
  try {
    const { adminEmail, adminToken, targetEmail, action } = await req.json() as {
      adminEmail: string;
      adminToken: string;
      targetEmail: string;
      action: "grant" | "revoke";
    };

    if (!adminEmail || !adminToken || !targetEmail || !action) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (adminEmail.toLowerCase().trim() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Verify admin token matches the stored token for the admin email
    const r = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=token`,
      { headers: HDR }
    );
    if (!r.ok) return NextResponse.json({ error: "Auth lookup failed" }, { status: 500 });
    const rows = await r.json() as { token: string | null }[];
    const stored = rows[0]?.token;
    if (!stored || stored !== adminToken) {
      return NextResponse.json({ error: "Invalid admin token" }, { status: 401 });
    }

    // Look up target user with SELECT * so we don't fail if columns
    // are missing from the schema. We just need to know the row exists.
    const targetEm = targetEmail.toLowerCase().trim();
    const tr = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(targetEm)}&select=*`,
      { headers: HDR }
    );
    if (!tr.ok) {
      const err = await tr.text().catch(() => "");
      console.error("admin grant-pro target lookup failed:", tr.status, err);
      return NextResponse.json({ error: `Supabase ${tr.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }
    const targetRows = await tr.json() as Array<Record<string, unknown>>;
    if (!targetRows.length) {
      return NextResponse.json({ error: `No account found for ${targetEm}` }, { status: 404 });
    }

    // Update subscription_status. Set subscription_end one year out for
    // "grant" so it survives any expiry check; clear it on "revoke".
    // If the columns don't exist yet, surface the precise Supabase
    // error so the user can run the right SQL migration.
    const newStatus = action === "grant" ? "pro" : "free";
    const oneYear   = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const body: Record<string, string | null> = { subscription_status: newStatus };
    body.subscription_end = action === "grant" ? oneYear : null;

    const ur = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(targetEm)}`,
      {
        method: "PATCH",
        headers: { ...HDR, "Prefer": "return=minimal" },
        body: JSON.stringify(body),
      }
    );
    if (!ur.ok) {
      const err = await ur.text().catch(() => "");
      console.error("admin grant-pro update failed:", ur.status, err);
      // Detect missing-column errors and give actionable guidance
      const missingColumn = /column.*does not exist|could not find.*column/i.test(err);
      if (missingColumn) {
        return NextResponse.json({
          error: "Schema missing — run this SQL in Supabase first:\n\nalter table portfolios add column if not exists subscription_status text default 'free';\nalter table portfolios add column if not exists subscription_end timestamptz;",
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Supabase ${ur.status}: ${err.slice(0, 200)}` }, { status: 500 });
    }

    const previousStatus = (typeof targetRows[0].subscription_status === "string"
      ? targetRows[0].subscription_status as string
      : "free");

    return NextResponse.json({
      success: true,
      email: targetEm,
      status: newStatus,
      previousStatus,
    });
  } catch (err) {
    console.error("admin grant-pro error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
