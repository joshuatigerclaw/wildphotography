export type LicenseType = "web" | "full";

export type SourcePageType =
  | "photo_page"
  | "gallery_page"
  | "search"
  | "map"
  | "homepage"
  | "direct"
  | "unknown";

export interface PhotoOrder {
  order_ref: string;
  created_at: string;
  buyer_name: string;
  buyer_email: string;
  buyer_notes: string;
  photo_id: string;
  photo_slug: string;
  photo_title: string;
  gallery_slug: string;
  gallery_title: string;
  license_type: LicenseType;
  price_usd: number;
  currency: "USD";
  source_page_type: SourcePageType;
  source_url: string;
  referrer_url: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  paypal_business_email: string;
  paypal_profile_link: string;
  paypal_item_name: string;
  paypal_custom: string;
  paypal_txn_id: string;
  paypal_payment_status: string;
  paypal_payer_email: string;
  paypal_returned: boolean;
  fulfillment_status: string;
  admin_notified_at: string;
  delivered_at: string;
  delivery_notes: string;
}
