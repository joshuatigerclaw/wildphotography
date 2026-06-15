import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key, { apiVersion: '2024-11-20.acacia' as Stripe.LatestApiVersion });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, email, bundle } = body as {
      jobId?: string;
      email?: string;
      bundle?: boolean;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Fetch job
    const jobs = await sql`
      SELECT id, status, stripe_session_id
      FROM you_in_costa_rica_jobs
      WHERE id = ${jobId}
      LIMIT 1
    `;

    if (jobs.length === 0) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = jobs[0] as any;

    if (job.status !== "free_ready") {
      return NextResponse.json(
        { error: "Job is not in free_ready status" },
        { status: 400 }
      );
    }

    // Determine price
    const unitAmount = bundle ? 999 : 499; // $9.99 bundle / $4.99 single
    const productName = bundle
      ? "Remove Watermark - 3 Pack Bundle"
      : "Remove Watermark - High Resolution";

    // Create Stripe Checkout Session
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: unitAmount,
            product_data: {
              name: productName,
              description: bundle
                ? "Remove watermark from 3 AI-composite photos"
                : "Remove watermark and get high-resolution AI-composite photo",
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://wildphotography.com"}/you-in-costa-rica/success?session_id={CHECKOUT_SESSION_ID}&job_id=${jobId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://wildphotography.com"}/you-in-costa-rica?job_id=${jobId}`,
      customer_email: email || undefined,
      metadata: {
        jobId: String(jobId),
        bundle: bundle ? "true" : "false",
      },
    });

    // Update job with stripe_session_id and status
    await sql`
      UPDATE you_in_costa_rica_jobs
      SET
        stripe_session_id = ${session.id},
        stripe_payment_status = 'pending',
        status = 'payment_pending'
      WHERE id = ${jobId}
    `;

    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("[you-in-costa-rica/create-checkout]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
