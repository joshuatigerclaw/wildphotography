/**
 * Daily Random RSS Feed — WildPhotography
 * Returns exactly 3 photos per day, deterministically seeded by UTC date.
 */

import { queryNeon } from '../lib/db';

type FeedPhoto = {
  id: string;
  slug: string;
  title: string | null;
  description: string | null;
  location_name: string | null;
  date_taken: string | null;
  preview_url: string | null;
  medium_url: string | null;
  thumb_url: string | null;
  gallery_slug: string | null;
  species_common_name: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatRfc822(date: Date): string {
  return date.toUTCString();
}

function buildPhotoTitle(photo: FeedPhoto): string {
  if (photo.title?.trim()) return photo.title.trim();
  if (photo.species_common_name && photo.location_name) {
    return `${photo.species_common_name} in ${photo.location_name}`;
  }
  if (photo.species_common_name) return photo.species_common_name;
  if (photo.location_name) return `Photo from ${photo.location_name}`;
  return "WildPhotography Photo";
}

function buildPhotoDescription(photo: FeedPhoto, siteUrl: string): string {
  const parts: string[] = [];

  if (photo.description?.trim()) {
    parts.push(photo.description.trim());
  }
  if (photo.location_name?.trim()) {
    parts.push(`Location: ${photo.location_name.trim()}`);
  }
  if (photo.species_common_name?.trim()) {
    parts.push(`Subject: ${photo.species_common_name.trim()}`);
  }

  const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
  if (imageUrl) {
    parts.push(`<img src="${escapeXml(imageUrl)}" alt="${escapeXml(buildPhotoTitle(photo))}" />`);
  }

  parts.push(`<p><a href="${escapeXml(`${siteUrl}/photo/${photo.slug}`)}">View photo</a></p>`);

  return parts.join("<br/>");
}

async function queryDailyPhotos(seed: string): Promise<FeedPhoto[]> {
  // Deterministic daily selection using date seed for pseudo-random offset
  // Convert date seed to integer for modulo-based selection
  const seedNum = parseInt(seed.replace(/-/g, ''), 10); // e.g. "2026-04-15" -> 20260415
  const offset = seedNum % 30200; // deterministic offset within eligible range
  const rows = await queryNeon<FeedPhoto>(
    `SELECT id, slug, title, description, location_name, date_taken, preview_url, medium_url, thumb_url, gallery_slug, species_common_name ` +
    `FROM photos ` +
    `WHERE ready_for_public_render = true AND search_ready = true ` +
    `AND slug IS NOT NULL AND COALESCE(preview_url, medium_url, thumb_url) IS NOT NULL ` +
    `ORDER BY id OFFSET ${offset} LIMIT 3`
  );
  return rows;
}

export async function handleDailyRandomFeed(request: Request, env: { SITE_URL?: string }): Promise<Response> {
  const siteUrl = (env.SITE_URL || "https://wildphotography.com").replace(/\/+$/, "");
  const now = new Date();
  const seed = now.toISOString().slice(0, 10);

  let photos: FeedPhoto[] = [];
  try {
    photos = await queryDailyPhotos(seed);
  } catch (err) {
    return new Response('Database error', { status: 500 });
  }

  const pubDate = formatRfc822(now);
  const channelTitle = "WildPhotography Daily Random Feed";
  const channelLink = `${siteUrl}/feed/daily-random.xml`;

  const items = photos
    .map((photo) => {
      const title = buildPhotoTitle(photo);
      const link = `${siteUrl}/photo/${photo.slug}`;
      const guid = `wildphotography-daily-${seed}-${photo.id}`;
      const description = buildPhotoDescription(photo, siteUrl);
      const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
      const itemDate = photo.date_taken ? new Date(photo.date_taken) : now;

      return '\n    <item>\n      <title>' + escapeXml(title) + '</title>\n      <link>' + escapeXml(link) + '</link>\n      <guid isPermaLink="false">' + escapeXml(guid) + '</guid>\n      <pubDate>' + escapeXml(formatRfc822(itemDate)) + '</pubDate>\n      <description><![CDATA[' + description + ']]></description>\n      ' + (imageUrl ? '<enclosure url="' + escapeXml(imageUrl) + '" type="image/jpeg" />' : '') + '\n    </item>';
    })
    .join('');

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>' + escapeXml(channelTitle) + '</title>\n    <link>' + escapeXml(channelLink) + '</link>\n    <description>Three rotating WildPhotography images selected daily.</description>\n    <language>en-us</language>\n    <lastBuildDate>' + escapeXml(pubDate) + '</lastBuildDate>\n    <ttl>1440</ttl>' + items + '\n  </channel>\n</rss>';

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=UTF-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
