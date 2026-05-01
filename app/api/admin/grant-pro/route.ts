import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY  = process.env.SUPABASE_SECRET_KEY ?? "";
const HDR  = { "apikey": KEY, "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" };

const ADMIN_EMAIL = "daddyjulian@arbibx.com";

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

    // Look up target user
    const targetEm = targetEmail.toLowerCase().trim();
    const tr = await fetch(
      `${URL_}/rest/v1/portfolios?email=eq.${encodeURIComponent(targetEm)}&select=email,subscription_status`,
      { headers: HDR }
    );
    if (!tr.ok) return NextResponse.json({ error: "Target lookup failed" }, { status: 500 });
    const targetRows = await tr.json() as { email: string; subscription_status: string | null }[];
    if (!targetRows.length) {
      return NextResponse.json({ error: `No account found for ${targetEm}` }, { status: 404 });
    }

    // Update subscription_status. Set subscription_end one year out for
    // "grant" so it survives any expiry check; clear it on "revoke".
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
      const err = await ur.text();
      console.error("admin grant-pro update failed:", err);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: targetEm,
      status: newStatus,
      previousStatus: targetRows[0].subscription_status ?? "free",
    });
  } catch (err) {
    console.error("admin grant-pro error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
