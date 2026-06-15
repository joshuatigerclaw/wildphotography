import { PhotoOrder } from "@/types/orders";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const adminEmail = "cash@pobox.com";
const fromEmail = "orders@wildphotography.com";

async function resendEmail(subject: string, text: string): Promise<string> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: adminEmail,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Resend error ${response.status}: ${err}`);
  }

  const data = await response.json() as { id?: string };
  return data.id || "";
}

export async function sendOrderStartedEmail(order: PhotoOrder): Promise<string> {
  const subject = `[WildPhotography Sale] New order started - ${order.order_ref}`;

  const text = `
New WildPhotography order started

Order Ref: ${order.order_ref}
Created At: ${order.created_at}

Buyer Name: ${order.buyer_name}
Buyer Email: ${order.buyer_email}
Buyer Notes: ${order.buyer_notes}

Photo ID: ${order.photo_id}
Photo Title: ${order.photo_title}
Photo Slug: ${order.photo_slug}
Gallery Slug: ${order.gallery_slug}
Gallery Title: ${order.gallery_title}

License Type: ${order.license_type}
Price: $${order.price_usd} USD

Source Page Type: ${order.source_page_type}
Source URL: ${order.source_url}
Referrer URL: ${order.referrer_url}
UTM Source: ${order.utm_source}
UTM Medium: ${order.utm_medium}
UTM Campaign: ${order.utm_campaign}

PayPal Business: ${order.paypal_business_email}
PayPal Profile: ${order.paypal_profile_link}
PayPal Item Name: ${order.paypal_item_name}
PayPal Custom: ${order.paypal_custom}
  `.trim();

  return resendEmail(subject, text);
}

export async function sendOrderReturnedEmail(order: PhotoOrder): Promise<string> {
  const subject = `[WildPhotography Sale] Buyer returned from PayPal - ${order.order_ref}`;

  const text = `
Buyer returned from PayPal

Order Ref: ${order.order_ref}
Buyer Name: ${order.buyer_name}
Buyer Email: ${order.buyer_email}

Photo ID: ${order.photo_id}
Photo Title: ${order.photo_title}
Photo Slug: ${order.photo_slug}
License Type: ${order.license_type}
Price: $${order.price_usd} USD

Source Page Type: ${order.source_page_type}
Source URL: ${order.source_url}

Action Required:
Verify payment manually in PayPal and fulfill manually.
  `.trim();

  return resendEmail(subject, text);
}