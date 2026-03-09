/**
 * PayPal Webhook API
 * 
 * POST /api/paypal/webhook
 * 
 * Handles PayPal webhook events
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);
    const eventType = event.event_type;
    
    console.log('[paypal] Webhook event:', eventType);
    
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED') {
      const paypalOrderId = event.resource?.id;
      
      if (paypalOrderId) {
        // Find and fulfill order
        const orders = await sql(`
          SELECT o.*, pi.photo_id
          FROM orders o
          JOIN order_items pi ON o.id = pi.order_id
          WHERE o.paypal_order_id = $1
        `, [paypalOrderId]);
        
        if (orders.length > 0 && orders[0].status !== 'completed') {
          await sql('UPDATE orders SET status = $1, date_modified = NOW() WHERE id = $2', 
            ['completed', orders[0].id]);
          
          // Create fulfillment
          const token = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          
          await sql(`
            INSERT INTO fulfillments (order_id, download_token, expires_at, max_downloads, download_count)
            VALUES ($1, $2, $3, 5, 0)
          `, [orders[0].id, token, expiresAt]);
          
          console.log('[paypal] Order fulfilled:', orders[0].id);
        }
      }
    }
    
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[paypal] Webhook error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
