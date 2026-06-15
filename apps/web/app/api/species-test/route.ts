import { NextResponse } from 'next/server';

const DB = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

export async function GET() {
  try {
    const res = await fetch('https://ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': DB },
      body: JSON.stringify({ queries: [{ query: 'SELECT species_common_name as name, COUNT(*) as cnt FROM photos WHERE species_common_name IS NOT NULL AND species_common_name != \'\' AND is_active = true AND ready_for_public_render = true AND thumb_url IS NOT NULL GROUP BY species_common_name ORDER BY COUNT(*) DESC LIMIT 3', params: [] }] }),
    });

    let data: any;
    const contentType = res.headers.get('Content-Type') || '';
    
    try {
      data = await res.json();
    } catch (e: any) {
      const text = await res.text();
      return NextResponse.json({ error: 'json() failed', rawText: text.slice(0, 200), contentType, status: res.status });
    }

    // Check what format we got
    const format = Array.isArray(data) ? 'array' : (typeof data === 'object' && data !== null) ? Object.keys(data).join(',') : typeof data;
    
    // Try multiple extraction strategies
    let rows: any[] = [];
    if (Array.isArray(data)) {
      rows = data[0]?.rows ?? [];
    } else if (data?.results?.length) {
      rows = data.results[0]?.rows ?? [];
    } else if (data?.rows) {
      rows = data.rows;
    }

    return NextResponse.json({ format, rowCount: rows.length, sample: rows[0] ?? null, full: JSON.stringify(data).slice(0, 400) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}