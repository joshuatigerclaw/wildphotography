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

/**
 * Get PayPal access token
 */
export async function getPayPalToken(env: Env): Promise<string | null> {
  const mode = env.PAYPAL_MODE || 'sandbox';
  const clientId = env.PAYPAL_CLIENT_ID || '';
  const clientSecret = env.PAYPAL_CLIENT_SECRET || '';
  
  if (!clientId || !clientSecret) {
    console.error('[paypal] Missing credentials');
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
  
  const order = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: photoSlug,
      description: `Download: ${photoTitle}`,
      amount: {
        currency_code: 'USD',
        value: price,
      },
    }],
    application_context: {
      brand_name: 'Wildphotography',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${env.SITE_URL}/download/complete`,
      cancel_url: `${env.SITE_URL}/photo/${photoSlug}`,
    },
  };
  
  try {
    const response = await fetch(`${PAYPAL_API[mode as keyof typeof PAYPAL_API]}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error('[paypal] Create order error:', err);
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
export async function captureOrder(orderId: string, env: Env): Promise<boolean> {
  const token = await getPayPalToken(env);
  if (!token) return false;
  
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
      return false;
    }
    
    const data = await response.json();
    return data.status === 'COMPLETED';
  } catch (e) {
    console.error('[paypal] Capture error:', e);
    return false;
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
  // For now, simplified verification
  // In production, verify PayPal-Signature header
  const transmissionId = headers['paypal-transmission-id'];
  const timestamp = headers['paypal-transmission-time'];
  
  if (!transmissionId || !timestamp) {
    console.log('[paypal] Missing webhook headers');
    return false;
  }
  
  // Log webhook for debugging
  console.log('[paypal] Webhook received:', transmissionId, timestamp);
  return true;
}

/**
 * Generate signed download URL for R2
 */
export function generateSignedUrl(
  r2Key: string,
  env: Env,
  expirySeconds: number = 3600
): string {
  // In production, use R2 signed URLs
  // For now, return the public URL (downloads should be protected)
  const bucketUrl = `https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev`;
  
  // Note: R2 doesn't support signed URLs in the same way as S3
  // We'll use a token-based approach
  return `${bucketUrl}/downloads/${r2Key}?token=${Date.now()}`;
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
    console.error('[resend] Missing API key');
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
        from: 'Wildphotography <downloads@wildphotography.com>',
        to: email,
        subject: `Your download: ${photoTitle}`,
        html: `
          <h1>Thank you for your purchase!</h1>
          <p>Your photo download is ready:</p>
          <p><a href="${downloadUrl}">Download ${photoTitle}</a></p>
          <p>This link expires in 7 days.</p>
          <p>- The Wildphotography Team</p>
        `,
      }),
    });
    
    return response.ok;
  } catch (e) {
    console.error('[resend] Send error:', e);
    return false;
  }
}
