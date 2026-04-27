import { NextRequest, NextResponse } from "next/server";
import { appendOrderRow } from "@/lib/google-sheets";
import { generateOrderRef } from "@/lib/order-ref";
import { LICENSES, isValidLicense } from "@/lib/pricing";
import {
  buildPayPalCustom,
  buildPayPalItemName,
  buildPayPalUrl,
} from "@/lib/paypal";
import { sendOrderStartedEmail } from "@/lib/admin-email";
import { PhotoOrder } from "@/types/orders";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      buyer_name,
      buyer_email,
      buyer_notes = "",
      photo_id,
      photo_slug,
      photo_title,
      gallery_slug = "",
      gallery_title = "",
      license_type,
      source_page_type = "photo_page",
      source_url = "",
      referrer_url = "",
      utm_source = "",
      utm_medium = "",
      utm_campaign = "",
    } = body;

    if (!buyer_name || !buyer_email || !photo_id || !photo_slug || !photo_title) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidLicense(license_type)) {
      return NextResponse.json({ ok: false, error: "Invalid license_type" }, { status: 400 });
    }

    const orderRef = generateOrderRef();
    const license = LICENSES[license_type];

    const paypalItemName = buildPayPalItemName({
      photoTitle: photo_title,
      licenseLabel: license.label,
      orderRef,
    });

    const paypalCustom = buildPayPalCustom({
      order_ref: orderRef,
      photo_id: String(photo_id),
      photo_slug: String(photo_slug),
      gallery_slug: String(gallery_slug),
      license_type,
      buyer_email: String(buyer_email),
      source_page_type: String(source_page_type),
    });

    const order: PhotoOrder = {
      order_ref: orderRef,
      created_at: new Date().toISOString(),
      buyer_name: String(buyer_name),
      buyer_email: String(buyer_email),
      buyer_notes: String(buyer_notes),
      photo_id: String(photo_id),
      photo_slug: String(photo_slug),
      photo_title: String(photo_title),
      gallery_slug: String(gallery_slug),
      gallery_title: String(gallery_title),
      license_type,
      price_usd: license.price,
      currency: "USD",
      source_page_type,
      source_url: String(source_url),
      referrer_url: String(referrer_url),
      utm_source: String(utm_source),
      utm_medium: String(utm_medium),
      utm_campaign: String(utm_campaign),
      paypal_business_email: process.env.PAYPAL_BUSINESS_EMAIL || "cash@pobox.com",
      paypal_profile_link: process.env.PAYPAL_PROFILE_LINK || "paypal.me/joshuatenbrink",
      paypal_item_name: paypalItemName,
      paypal_custom: paypalCustom,
      paypal_txn_id: "",
      paypal_payment_status: "pending",
      paypal_payer_email: "",
      paypal_returned: false,
      fulfillment_status: "pending",
      admin_notified_at: "",
      delivered_at: "",
      delivery_notes: "",
    };

    await appendOrderRow(order);
    await sendOrderStartedEmail(order);

    const paypalUrl = buildPayPalUrl({
      businessEmail: order.paypal_business_email,
      itemName: order.paypal_item_name,
      amount: order.price_usd,
      custom: order.paypal_custom,
      orderRef: order.order_ref,
      siteUrl: process.env.SITE_URL!,
    });

    return NextResponse.json({
      ok: true,
      orderRef,
      paypalUrl,
      priceUsd: order.price_usd,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
