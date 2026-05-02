import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Vercel env vars");
  // Pinned to the API version the installed SDK (stripe@22.x) expects.
  _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "price_1TRZcvBSokNCjoE8ih9s2zxo";
const APP_URL  = "https://www.arbibx.com";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email: string };

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const stripe = getStripe();

    // Check if customer already exists
    const existing = await stripe.customers.list({ email, limit: 1 });
    let customerId = existing.data[0]?.id;

    if (!customerId) {
      const customer = await stripe.customers.create({ email });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: `${APP_URL}/?pro=success`,
      cancel_url:  `${APP_URL}/?pro=cancel`,
      metadata: { email },
      subscription_data: {
        metadata: { email },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    // Surface the real Stripe / config error to the client so the user
    // can see what's actually wrong (missing env var, bad price ID,
    // test/live key mismatch, etc.) instead of a generic message.
    console.error("Checkout error:", err);
    const message = err instanceof Error ? err.message : "Failed to create checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
