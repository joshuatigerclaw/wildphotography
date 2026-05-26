import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/admin/db';
import { createHash, randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const PLANS: Record<string, { name: string; limit: number }> = {
  explorer: { name: 'Explorer Developer', limit: 250 },
  professional: { name: 'Professional Tourism', limit: 750 },
  enterprise: { name: 'AI & Enterprise Vision', limit: 2000 },
};

function generateApiKey(): string {
  const bytes = randomBytes(32);
  return `wpa_${bytes.toString('base64url')}`;
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function buildOnboardingText(opts: {
  planName: string;
  monthlyLimit: number;
  apiKey: string;
  keyPrefix: string;
}): string {
  return `Welcome to the WildPhotography API!

Your account has been set up.

Plan: ${opts.planName}
Monthly call limit: ${opts.monthlyLimit.toLocaleString()} requests/month

Your API key: ${opts.apiKey}
Key prefix: ${opts.keyPrefix}

Quick start:
GET https://www.wildphotography.com/api/v1/search?q=toucan

Full docs: https://www.wildphotography.com/developers/api

Important notes:
- Only approved derivative images are returned. Original files are never exposed.
- Your API key is shown once — store it securely.
- If you exceed your monthly limit, requests will return HTTP 429 until the next calendar month.
- For support, reply to this email or contact josh@wildphotography.com

We look forward to seeing what you build!`;
}

async function adminAuth(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;
  return token === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await adminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const leadId = parseInt(id, 10);
  if (isNaN(leadId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const body = await req.json();
  const { plan_id } = body;

  const plan = PLANS[plan_id || 'explorer'] || PLANS['explorer'];

  const client = getAdminClient();
  try {
    await client.connect();

    // Get the lead
    const leadRes = await client.query('SELECT * FROM api_waitlist WHERE id = $1', [leadId]);
    if (!leadRes.rows.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    const lead = leadRes.rows[0];

    // Check if already a customer
    let customerRes = await client.query(
      'SELECT id FROM api_customers WHERE email = $1',
      [lead.email.toLowerCase()]
    );

    let customerId: number;

    if (customerRes.rows.length) {
      customerId = customerRes.rows[0].id;
      // Update plan
      await client.query(
        `UPDATE api_customers SET plan_id = $1, plan_name = $2, monthly_call_limit = $3, status = 'active', onboarded_at = NOW(), updated_at = NOW() WHERE id = $4`,
        [plan_id || 'explorer', plan.name, plan.limit, customerId]
      );
    } else {
      // Create customer
      customerRes = await client.query(
        `INSERT INTO api_customers (lead_id, email, company, website, plan_id, plan_name, monthly_call_limit, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id`,
        [leadId, lead.email.toLowerCase(), lead.company, lead.website, plan_id || 'explorer', plan.name, plan.limit]
      );
      customerId = customerRes.rows[0].id;
    }

    // Generate API key
    const rawKey = generateApiKey();
    const keyPrefix = rawKey.slice(0, 12);
    const keyHash = hashKey(rawKey);

    // Check if already has an active key
    const existingKeyRes = await client.query(
      'SELECT id FROM api_keys WHERE customer_id = $1 AND status = $2',
      [customerId, 'active']
    );

    let apiKeyRecord: { id: number; key_prefix: string };

    if (existingKeyRes.rows.length) {
      // Revoke existing key
      await client.query(
        'UPDATE api_keys SET status = $1 WHERE customer_id = $2 AND status = $3',
        ['revoked', customerId, 'active']
      );
    }

    const keyRes = await client.query(
      `INSERT INTO api_keys (customer_id, key_hash, key_prefix, status)
       VALUES ($1, $2, $3, 'active') RETURNING id, key_prefix`,
      [customerId, keyHash, keyPrefix]
    );
    apiKeyRecord = keyRes.rows[0];

    // Update lead status
    await client.query(
      `UPDATE api_waitlist SET status = 'onboarded', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );

    const onboardingText = buildOnboardingText({
      planName: plan.name,
      monthlyLimit: plan.limit,
      apiKey: rawKey,
      keyPrefix,
    });

    return NextResponse.json({
      success: true,
      customer_id: customerId,
      api_key_id: apiKeyRecord.id,
      api_key_prefix: keyPrefix,
      // FULL key shown only once in the onboard response
      api_key: rawKey,
      onboarding_text: onboardingText,
    });
  } catch (e) {
    console.error('API lead onboard error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await client.end();
  }
}