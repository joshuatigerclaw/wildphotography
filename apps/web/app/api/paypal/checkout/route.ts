/**
 * PayPal Checkout API
 * 
 * POST /api/paypal/checkout
 * Body: { photoId: number }
 * 
 * Returns PayPal order for checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

const DOWNLOAD_PRICE_CENTS = 2900;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { photoId, email } = body;
    
    if (!photoId) {
      return NextResponse.json({ error: 'photoId required' }, { status: 400 });
    }
    
    // Get photo details
    const photos = await sql('SELECT id, slug, title, original_r2_key FROM photos WHERE id = $1', [photoId]);
    if (photos.length === 0) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    
    const photo = photos[0];
    
    if (!photo.original_r2_key) {
      return NextResponse.json({ error: 'Original not available for download' }, { status: 400 });
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
    
    // Return mock checkout for now (needs PayPal credentials)
    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      message: 'PayPal checkout requires PAYPAL_CLIENT_ID and PAYPAL_SECRET env vars',
      photoTitle: photo.title,
      price: DOWNLOAD_PRICE_CENTS / 100,
    });
  } catch (error: any) {
    console.error('[paypal] Checkout error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
