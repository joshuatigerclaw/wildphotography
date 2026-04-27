const PAYPAL_BASE_URL = "https://www.paypal.com/cgi-bin/webscr";

export function buildPayPalCustom(payload: {
  order_ref: string;
  photo_id: string;
  photo_slug: string;
  gallery_slug: string;
  license_type: string;
  buyer_email: string;
  source_page_type: string;
}): string {
  return [
    `order_ref=${payload.order_ref}`,
    `photo_id=${payload.photo_id}`,
    `slug=${payload.photo_slug}`,
    `gallery=${payload.gallery_slug}`,
    `license=${payload.license_type}`,
    `buyer=${payload.buyer_email}`,
    `source=${payload.source_page_type}`,
  ].join("|");
}

export function buildPayPalItemName(args: {
  photoTitle: string;
  licenseLabel: string;
  orderRef: string;
}): string {
  return `WildPhotography - ${args.photoTitle} - ${args.licenseLabel} - ${args.orderRef}`;
}

export function buildPayPalUrl(args: {
  businessEmail: string;
  itemName: string;
  amount: number;
  custom: string;
  orderRef: string;
  siteUrl: string;
}): string {
  const url = new URL(PAYPAL_BASE_URL);
  url.searchParams.set("cmd", "_xclick");
  url.searchParams.set("business", args.businessEmail);
  url.searchParams.set("item_name", args.itemName);
  url.searchParams.set("amount", args.amount.toFixed(2));
  url.searchParams.set("currency_code", "USD");
  url.searchParams.set("custom", args.custom);
  url.searchParams.set(
    "return",
    `${args.siteUrl}/thank-you?order_ref=${encodeURIComponent(args.orderRef)}`
  );
  url.searchParams.set(
    "cancel_return",
    `${args.siteUrl}/payment-cancelled?order_ref=${encodeURIComponent(args.orderRef)}`
  );
  url.searchParams.set(
    "notify_url",
    `${args.siteUrl}/api/paypal/ipn-placeholder`
  );
  return url.toString();
}
