import { Resend } from "resend";
import { PhotoOrder } from "@/types/orders";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

const adminEmail = process.env.WILDPHOTO_ADMIN_EMAIL!;
const fromEmail = process.env.RESEND_FROM_EMAIL!;

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

  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to: adminEmail,
    subject,
    text,
  });

  if (error) throw new Error(error.message);
  return data?.id || "";
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

  const { data, error } = await getResend().emails.send({
    from: fromEmail,
    to: adminEmail,
    subject,
    text,
  });

  if (error) throw new Error(error.message);
  return data?.id || "";
}
