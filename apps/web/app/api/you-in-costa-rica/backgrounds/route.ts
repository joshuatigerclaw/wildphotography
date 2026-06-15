import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

const R2_PUBLIC = 'https://images.wildphotography.com';

export const dynamic = 'force-dynamic';

function withR2Base(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return R2_PUBLIC + '/' + url;
}

interface CandidatePhoto {
  id: string;
  slug: string;
  title: string;
  thumbUrl: string | null;
  mediumUrl: string | null;
  keywords: string | null;
  gallerySlug: string | null;
}

function categorizePhoto(photo: CandidatePhoto): string | null {
  const kw = ((photo.keywords || '') + ' ' + photo.title + ' ' + (photo.gallerySlug || '')).toLowerCase();
  
  // Beach
  if (/\b(beach|coast|ocean|surf|pacific|caribbean|playa|shoreline|sand)\b/.test(kw)) return 'beach';
  // Volcano
  if (/\b(volcano|arenal|poas|irazu|turrialba|rincon|tenorio|miravalles|volcan|volcán)\b/.test(kw)) return 'volcano';
  // Waterfall
  if (/\b(waterfall|cascade|catarata|naranjo|fortuna|water\s*fall|falls?\b)/.test(kw)) return 'waterfall';
  // Rainforest
  if (/\b(rainforest|jungle|cloud forest|monteverde|cloud-forest|cerro|braulio|talamanca|forest)\b/.test(kw)) return 'rainforest';
  // Wildlife (birds, animals, species)
  if (/\b(bird|macaw|toucan|quetzal|wildlife|animal|mammal|monkey|sloth|coati|raptor|owl|flycatcher|hummingbird|heron|egret|ibis|tanager|warbler|finch|sparrow|owl|jaguar|puma|peccary|tapir|raccoon)\b/.test(kw)) return 'wildlife';
  // Aerial
  if (/\b(aerial|drone|bird'?s? eye|panorama|bird'?s-eye|overhead|above)\b/.test(kw)) return 'aerial';
  // Sunset
  if (/\b(sunset|dusk|golden hour|amanecer|atardecer|sunrise|solar)\b/.test(kw)) return 'sunset';
  
  return null;
}

export async function GET() {
  const sql = neon(DATABASE_URL);
  
  const result = await sql(`
    SELECT 
      p.id,
      p.slug,
      p.title,
      p.thumb_url,
      p.medium_url,
      p.keywords,
      (SELECT g.slug FROM gallery_photos gp2 
       JOIN galleries g ON gp2.gallery_id = g.id 
       WHERE gp2.photo_id = p.id 
       ORDER BY gp2.sort_order ASC NULLS LAST LIMIT 1) AS gallery_slug
    FROM photos p
    WHERE p.is_active = true
      AND p.ready_for_public_render = true
      AND p.medium_url IS NOT NULL
      AND p.thumb_url IS NOT NULL
      AND p.large_url IS NOT NULL
      AND p.views_count IS NOT NULL
    ORDER BY p.views_count DESC
    LIMIT 200
  `);
  
  const rows = result as any[];
  
  const categories: Record<string, CandidatePhoto[]> = {
    beach: [],
    volcano: [],
    waterfall: [],
    rainforest: [],
    wildlife: [],
    aerial: [],
    sunset: [],
  };
  
  for (const row of rows) {
    const cat = categorizePhoto(row);
    if (cat && categories[cat] && categories[cat].length < 20) {
      categories[cat].push({
        id: String(row.id),
        slug: row.slug,
        title: row.title || '',
        thumbUrl: withR2Base(row.thumb_url),
        mediumUrl: withR2Base(row.medium_url),
        keywords: row.keywords,
        gallerySlug: row.gallery_slug,
      });
    }
  }
  
  return NextResponse.json(categories);
}