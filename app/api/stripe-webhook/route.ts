import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

// In the dahlia API version Stripe moved `current_period_end` from
// the Subscription object onto each SubscriptionItem. Pull the latest
// item end so we can store a sensible expiry on the user's row.
function subscriptionEndIso(sub: Stripe.Subscription | null | undefined): string | undefined {
  if (!sub) return undefined;
  const ends = (sub.items?.data ?? [])
    .map(i => (i as unknown as { current_period_end?: number }).current_period_end ?? 0)
    .filter(n => n > 0);
  if (!ends.length) return undefined;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? "";

async function updateSubscription(email: string, status: "pro" | "free", stripeCustomerId?: string, subscriptionEnd?: string) {
  const body: Record<string, string> = { subscription_status: status };
  if (stripeCustomerId) body.stripe_customer_id = stripeCustomerId;
  if (subscriptionEnd)  body.subscription_end   = subscriptionEnd;

  await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify(body),
    }
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const email   = session.metadata?.email ?? session.customer_email ?? "";
        if (!email) break;
        const sub = session.subscription
          ? await stripe.subscriptions.retrieve(session.subscription as string)
          : null;
        const endDate = subscriptionEndIso(sub);
        await updateSubscription(email, "pro", session.customer as string, endDate);
        console.log(`✅ Pro activated for ${email}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const email   = invoice.customer_email ?? "";
        if (!email) break;
        // In dahlia, invoices reference subscriptions through a parent
        // structure rather than a top-level field. Fall back to the
        // legacy field for older event payloads.
        const subId =
          (invoice as unknown as { subscription?: string | null }).subscription ??
          invoice.parent?.subscription_details?.subscription ??
          null;
        const sub = typeof subId === "string"
          ? await stripe.subscriptions.retrieve(subId)
          : null;
        const endDate = subscriptionEndIso(sub);
        await updateSubscription(email, "pro", invoice.customer as string, endDate);
        console.log(`✅ Pro renewed for ${email}`);
        break;
      }

      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj   = event.data.object as Stripe.Subscription | Stripe.Invoice;
        const custId = "customer" in obj ? obj.customer as string : "";
        if (!custId) break;
        const customer = await stripe.customers.retrieve(custId) as Stripe.Customer;
        const email    = customer.email ?? "";
        if (!email) break;
        await updateSubscription(email, "free");
        console.log(`❌ Pro cancelled for ${email}`);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
  }

  return NextResponse.json({ received: true });
}
