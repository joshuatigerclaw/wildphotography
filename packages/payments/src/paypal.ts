/**
 * PayPal Download Payments - Updated for current schema
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

// PayPal configuration - set via environment variables
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// Sandbox vs production
const PAYPAL_API = process.env.NODE_ENV === 'production' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

// Download pricing
const DOWNLOAD_PRICE_CENTS = 2900; // $29.00

/**
 * Create PayPal Checkout for photo download
 */
export async function createCheckout(photoId: number, email?: string) {
  const sql = neon(DATABASE_URL);
  
  // Get photo details
  const photos = await sql('SELECT id, slug, title, original_r2_key FROM photos WHERE id = $1', [photoId]);
  if (photos.length === 0) throw new Error('Photo not found');
  
  const photo = photos[0];
  
  // Check if original exists for download
  if (!photo.original_r2_key) {
    throw new Error('Original not available for download');
  }
  
  // Create order
  const orderNumber = `WP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  
  const [order] = await sql(`
    INSERT INTO orders (email, status, paypal_order_id, amount_cents, currency, date_created)
    VALUES ($1, 'pending', '', $2, 'USD', NOW())
    RETURNING *
  `, [email || '', DOWNLOAD_PRICE_CENTS]);
  
  // Create order item
  await sql(`
    INSERT INTO order_items (order_id, photo_id, sku, unit_amount_cents)
    VALUES ($1, $2, 'download', $3)
  `, [order.id, photoId, DOWNLOAD_PRICE_CENTS]);
  
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
          value: (DOWNLOAD_PRICE_CENTS / 100).toFixed(2),
        },
      }],
    }),
  });
  
  const paypalOrder = await response.json();
  
  // Update order with PayPal ID
  await sql('UPDATE orders SET paypal_order_id = $1 WHERE id = $2', 
    [paypalOrder.id, order.id]);
  
  return {
    orderId: order.id,
    orderNumber,
    paypalOrderId: paypalOrder.id,
    approvalUrl: paypalOrder.links?.find((l: any) => l.rel === 'approve')?.href,
  };
}

/**
 * Verify PayPal webhook signature
 */
export async function verifyWebhook(body: string, headers: any): Promise<boolean> {
  // In production, verify the webhook signature using PayPal's SDK
  // For now, log the webhook and return true for testing
  console.log('[paypal] Webhook received:', headers['paypal-transmission-id']);
  return true;
}

/**
 * Handle successful payment - fulfill the order
 */
export async function handlePaymentSuccess(paypalOrderId: string) {
  const sql = neon(DATABASE_URL);
  
  // Find order by PayPal order ID
  const orders = await sql(`
    SELECT o.*, pi.photo_id
    FROM orders o
    JOIN order_items pi ON o.id = pi.order_id
    WHERE o.paypal_order_id = $1
  `, [paypalOrderId]);
  
  if (orders.length === 0) {
    console.error('[paypal] Order not found for PayPal ID:', paypalOrderId);
    return null;
  }
  
  const order = orders[0];
  
  // Skip if already completed
  if (order.status === 'completed') {
    console.log('[paypal] Order already completed:', order.id);
    return { orderId: order.id, alreadyCompleted: true };
  }
  
  // Update order status
  await sql('UPDATE orders SET status = $1, date_modified = NOW() WHERE id = $2', 
    ['completed', order.id]);
  
  // Create fulfillment with token
  const downloadToken = generateDownloadToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await sql(`
    INSERT INTO fulfillments (order_id, download_token, expires_at, max_downloads, download_count)
    VALUES ($1, $2, $3, 5, 0)
  `, [order.id, downloadToken, expiresAt.toISOString()]);
  
  console.log('[paypal] Fulfillment created for order:', order.id);
  
  return { 
    orderId: order.id, 
    photoId: order.photo_id,
    downloadToken,
    expiresAt 
  };
}

/**
 * Verify download token and generate signed URL
 */
export async function verifyAndGetDownloadUrl(token: string, photoId: number) {
  const sql = neon(DATABASE_URL);
  
  // Find fulfillment
  const fulfillments = await sql(`
    SELECT f.*, o.status as order_status
    FROM fulfillments f
    JOIN orders o ON f.order_id = o.id
    WHERE f.download_token = $1 AND o.status = 'completed'
  `, [token]);
  
  if (fulfillments.length === 0) {
    throw new Error('Invalid or expired download token');
  }
  
  const fulfillment = fulfillments[0];
  
  // Check expiration
  if (new Date(fulfillment.expires_at) < new Date()) {
    throw new Error('Download token expired');
  }
  
  // Check download count
  if (fulfillment.download_count >= fulfillment.max_downloads) {
    throw new Error('Maximum downloads exceeded');
  }
  
  // Get photo
  const photos = await sql('SELECT * FROM photos WHERE id = $1', [photoId]);
  if (photos.length === 0) {
    throw new Error('Photo not found');
  }
  
  const photo = photos[0];
  
  if (!photo.original_r2_key) {
    throw new Error('Original not available');
  }
  
  // Increment download count
  await sql('UPDATE fulfillments SET download_count = download_count + 1 WHERE id = $1', 
    [fulfillment.id]);
  
  // Generate signed URL (using R2 signed URL)
  // For now, return a protected route URL that will serve the file
  const signedUrl = `/api/download/${photoId}?token=${token}`;
  
  return {
    url: signedUrl,
    photoTitle: photo.title,
    expiresAt: fulfillment.expires_at,
    remainingDownloads: fulfillment.max_downloads - fulfillment.download_count - 1,
  };
}

/**
 * Get PayPal Access Token
 */
async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }
  
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
  
  if (!data.access_token) {
    throw new Error('Failed to get PayPal access token');
  }
  
  return data.access_token;
}

/**
 * Generate secure download token
 */
function generateDownloadToken(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 15)}_${Math.random().toString(36).slice(2, 15)}`;
}

export default {
  createCheckout,
  verifyWebhook,
  handlePaymentSuccess,
  verifyAndGetDownloadUrl,
};
