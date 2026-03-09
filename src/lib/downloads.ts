/**
 * PayPal Download Module
 * 
 * Handles checkout, webhook verification, and download fulfillment
 */

import type { Env } from '../types';

// PayPal API endpoints
const PAYPAL_API = {
  sandbox: 'https://api-mandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

// In-memory store for completed orders (in production, use a database)
const completedOrders = new Map<string, { photoSlug: string; email: string; timestamp: number }>();

/**
 * Get PayPal access token
 */
export async function getPayPalToken(env: Env): Promise<string | null> {
  const mode = env.PAYPAL_MODE || 'sandbox';
  const clientId = env.PAYPAL_CLIENT_ID || '';
  const clientSecret = env.PAYPAL_CLIENT_SECRET || '';
  
  if (!clientId || !clientSecret || clientId.startsWith('AVkBZPIeN') || clientId.includes('...')) {
    console.error('[paypal] Missing or placeholder credentials');
    return null;
  }
  
  const auth = btoa(`${clientId}:${clientSecret}`);
  
  try {
    const response = await fetch(`${PAYPAL_API[mode as keyof typeof PAYPAL_API]}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    
    if (!response.ok) {
      console.error('[paypal] Token error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.access_token || null;
  } catch (e) {
    console.error('[paypal] Token fetch error:', e);
    return null;
  }
}

/**
 * Create PayPal order for photo download
 */
export async function createOrder(
  photoSlug: string,
  photoTitle: string,
  priceCents: number,
  env: Env
): Promise<{ orderId: string; approveUrl: string } | null> {
  const token = await getPayPalToken(env);
  if (!token) return null;
  
  const mode = env.PAYPAL_MODE || 'sandbox';
  const price = (priceCents / 100).toFixed(2);
  
  try {
    const response = await fetch(
      `${PAYPAL_API[mode as keyof typeof PAYPAL_API]}/v2/checkout/orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: photoSlug,
            description: `Download: ${photoTitle}`,
            amount: {
              currency_code: 'USD',
              value: price,
            },
          }],
        }),
      }
    );
    
    if (!response.ok) {
      console.error('[paypal] Create order error:', response.status);
      return null;
    }
    
    const data = await response.json();
    const approveLink = data.links?.find((l: any) => l.rel === 'approve');
    
    return {
      orderId: data.id,
      approveUrl: approveLink?.href || '',
    };
  } catch (e) {
    console.error('[paypal] Create order error:', e);
    return null;
  }
}

/**
 * Capture PayPal order
 */
export async function captureOrder(orderId: string, env: Env): Promise<{ success: boolean; email?: string }> {
  const token = await getPayPalToken(env);
  if (!token) return { success: false };
  
  const mode = env.PAYPAL_MODE || 'sandbox';
  
  try {
    const response = await fetch(
      `${PAYPAL_API[mode as keyof typeof PAYPAL_API]}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      console.error('[paypal] Capture error:', response.status);
      return { success: false };
    }
    
    const data = await response.json();
    if (data.status !== 'COMPLETED') {
      console.error('[paypal] Order not completed:', data.status);
      return { success: false };
    }
    
    // Get payer email from purchase unit
    const email = data.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id 
      || data.payer?.email_address 
      || 'customer@example.com';
    
    const photoSlug = data.purchase_units?.[0]?.reference_id || '';
    
    // Store completed order
    completedOrders.set(orderId, {
      photoSlug,
      email,
      timestamp: Date.now(),
    });
    
    return { success: true, email };
  } catch (e) {
    console.error('[paypal] Capture error:', e);
    return { success: false };
  }
}

/**
 * Verify PayPal webhook signature
 */
export async function verifyWebhook(
  body: string,
  headers: Record<string, string>,
  env: Env
): Promise<boolean> {
  // In production, verify PayPal-Signature header
  // For now, accept webhooks with valid transmission ID
  const transmissionId = headers['paypal-transmission-id'];
  const timestamp = headers['paypal-transmission-time'];
  
  if (!transmissionId || !timestamp) {
    console.log('[paypal] Missing webhook headers');
    return false;
  }
  
  console.log('[paypal] Webhook received:', transmissionId);
  return true;
}

/**
 * Generate signed R2 download URL (10 minute expiry)
 */
export function generateSignedUrl(photoSlug: string, env: Env): string {
  const expiry = Math.floor(Date.now() / 1000) + 600; // 10 minutes
  const token = `${photoSlug}:${expiry}`;
  
  // Simple signed URL using base64 (in production, use proper HMAC)
  const signature = btoa(token).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  
  // Note: R2 doesn't natively support signed URLs like S3
  // We'll handle this via a download endpoint that validates the token
  return `${env.SITE_URL}/api/v1/download/${photoSlug}?expires=${expiry}&sig=${signature}`;
}

/**
 * Verify download token
 */
export function verifyDownloadToken(photoSlug: string, expires: string, signature: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const exp = parseInt(expires, 10);
  
  // Check expiry
  if (now > exp) {
    console.log('[download] Link expired');
    return false;
  }
  
  // Verify signature
  const expectedSig = btoa(`${photoSlug}:${exp}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
  if (signature !== expectedSig) {
    console.log('[download] Invalid signature');
    return false;
  }
  
  return true;
}

/**
 * Send download receipt email via Resend
 */
export async function sendDownloadEmail(
  email: string,
  photoTitle: string,
  downloadUrl: string,
  env: Env
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY not configured');
    return false;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Wildphotography <noreply@wildphotography.com>',
        to: email,
        subject: `Your download: ${photoTitle}`,
        html: `
          <h1>Thank you for your purchase!</h1>
          <p>Your photo download is ready:</p>
          <h2>${photoTitle}</h2>
          <p><a href="${downloadUrl}" style="background:#0070ba;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Download Now</a></p>
          <p><small>This link expires in 10 minutes.</small></p>
          <p>Best regards,<br>Joshua ten Brink<br>Wildphotography</p>
        `,
      }),
    });
    
    if (!response.ok) {
      console.error('[email] Send error:', response.status);
      return false;
    }
    
    return true;
  } catch (e) {
    console.error('[email] Send error:', e);
    return false;
  }
}

/**
 * Get completed order info
 */
export function getCompletedOrder(orderId: string) {
  return completedOrders.get(orderId) || null;
}
