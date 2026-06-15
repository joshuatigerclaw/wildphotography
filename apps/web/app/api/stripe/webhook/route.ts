import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("[stripe/webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const jobId = session.metadata?.jobId;
        if (!jobId) {
          console.error("[stripe/webhook] Missing jobId in session metadata");
          break;
        }
        await sql`
          UPDATE you_in_costa_rica_jobs
          SET
            stripe_payment_status = 'paid',
            stripe_amount_cents = ${session.amount_total ?? 0},
            status = 'premium_ready'
          WHERE id = ${jobId}
        `;
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const jobId = session.metadata?.jobId;
        if (!jobId) break;
        await sql`
          UPDATE you_in_costa_rica_jobs
          SET stripe_payment_status = 'paid', status = 'premium_ready'
          WHERE id = ${jobId}
        `;
        break;
      }
      case "checkout.session.async_payment_failed":
      case "payment_intent.payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent;
        const jobId = session.metadata?.jobId;
        if (!jobId) break;
        await sql`
          UPDATE you_in_costa_rica_jobs
          SET stripe_payment_status = 'failed', status = 'free_ready'
          WHERE id = ${jobId}
        `;
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe/webhook] Handler error:", err);
    return NextResponse.json({ error: "Internal handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}