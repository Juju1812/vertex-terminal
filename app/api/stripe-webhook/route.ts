import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-01-27.acacia",
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;

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
  const sig  = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
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
        const endDate = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : undefined;
        await updateSubscription(email, "pro", session.customer as string, endDate);
        console.log(`✅ Pro activated for ${email}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const email   = invoice.customer_email ?? "";
        if (!email) break;
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null;
        const endDate = sub?.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : undefined;
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
