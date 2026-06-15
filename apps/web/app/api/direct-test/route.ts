import { NextResponse } from 'next/server';

export async function GET() {
  const DATABASE_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';
  
  try {
    const res = await fetch('https://ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/sql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': DATABASE_URL,
      },
      body: JSON.stringify({
        queries: [{
          query: `SELECT species_common_name as name, COUNT(*) as cnt
                  FROM photos p
                  WHERE species_common_name IS NOT NULL AND species_common_name != ''
                  AND LOWER(species_common_name) != 'unidentified'
                  AND ready_for_public_render = true AND thumb_url IS NOT NULL
                  GROUP BY species_common_name
                  ORDER BY COUNT(*) DESC LIMIT 5`,
          params: []
        }]
      })
    });
    const data = await res.json();
    const rows = Array.isArray(data) ? data[0]?.rows : data.rows;
    return NextResponse.json({ count: rows?.length || 0, samples: rows?.slice(0,3) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}