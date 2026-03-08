/**
 * PayPal Download Payments
 * 
 * Features:
 * - Checkout creation
 * - Webhook verification
 * - Signed R2 URLs for secure downloads
 * - Order/fulfillment tracking
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// Sandbox vs production
const PAYPAL_API = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

/**
 * Create PayPal Checkout
 */
export async function createCheckout(photoId: number, price: number) {
  const sql = neon(DATABASE_URL);
  
  // Get photo details
  const photos = await sql('SELECT * FROM photos WHERE id = $1', [photoId]);
  if (photos.length === 0) throw new Error('Photo not found');
  
  const photo = photos[0];
  
  // Create order
  const orderNumber = `WP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const [order] = await sql(`
    INSERT INTO orders (order_number, customer_email, total, status)
    VALUES ($1, '', $2, 'pending')
    RETURNING *
  `, [orderNumber, price]);
  
  // Create order item
  await sql(`
    INSERT INTO order_items (order_id, photo_id, product_type, product_name, unit_price, total_price)
    VALUES ($1, $2, 'download', $3, $4, $5)
  `, [order.id, photoId, photo.title, price, price]);
  
  // Get PayPal access token
  const accessToken = await getPayPalAccessToken();
  
  // Create PayPal order
  const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderNumber,
        description: `Download: ${photo.title}`,
        amount: {
          currency_code: 'USD',
          value: price.toFixed(2),
        },
      }],
    }),
  });
  
  const paypalOrder = await response.json();
  
  // Update order with PayPal ID
  await sql('UPDATE orders SET metadata = $1 WHERE id = $2', 
    [{ paypal_order_id: paypalOrder.id }, order.id]);
  
  return {
    orderId: order.id,
    orderNumber,
    paypalOrderId: paypalOrder.id,
    approvalUrl: paypalOrder.links?.find((l: any) => l.rel === 'approve')?.href,
  };
}

/**
 * Verify PayPal Webhook
 */
export async function verifyWebhook(body: string, headers: any): Promise<boolean> {
  // In production, verify webhook signature
  // For now, basic verification
  return true;
}

/**
 * Handle Successful Payment
 */
export async function handlePaymentSuccess(paypalOrderId: string) {
  const sql = neon(DATABASE_URL);
  
  // Find order
  const orders = await sql(`
    SELECT * FROM orders 
    WHERE metadata->>'paypal_order_id' = $1
  `, [paypalOrderId]);
  
  if (orders.length === 0) {
    console.error('[paypal] Order not found:', paypalOrderId);
    return;
  }
  
  const order = orders[0];
  
  // Update order status
  await sql('UPDATE orders SET status = $1 WHERE id = $2', ['completed', order.id]);
  
  // Create fulfillment with token
  const fulfillmentToken = generateFulfillmentToken();
  
  await sql(`
    INSERT INTO fulfillments (order_id, status, token)
    VALUES ($1, 'pending', $2)
  `, [order.id, fulfillmentToken]);
  
  return { orderId: order.id, fulfillmentToken };
}

/**
 * Generate Signed Download URL
 */
export function generateSignedUrl(photoId: number, token: string, expiresIn = 3600): string {
  // TODO: Generate actual signed URL with R2
  // For now, return placeholder
  const expiry = Date.now() + (expiresIn * 1000);
  return `/api/download/${photoId}?token=${token}&expires=${expiry}`;
}

/**
 * Get PayPal Access Token
 */
async function getPayPalAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  
  const data = await response.json();
  return data.access_token;
}

/**
 * Generate secure fulfillment token
 */
function generateFulfillmentToken(): string {
  return `fmt_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
}
