import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY      = process.env.SUPABASE_SECRET_KEY!;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  "mailto:alerts@arbibx.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

export async function POST(req: NextRequest) {
  try {
    const { email, title, body, url } = await req.json() as {
      email: string;
      title: string;
      body: string;
      url?: string;
    };

    if (!email || !title || !body) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Look up subscription from Supabase
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}&select=push_subscription`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    const rows = await r.json() as { push_subscription: string | null }[];
    const raw  = rows[0]?.push_subscription;
    if (!raw) return NextResponse.json({ error: "No subscription found" }, { status: 404 });

    const subscription = JSON.parse(raw) as webpush.PushSubscription;
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url: url ?? "/" })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
  }
}
