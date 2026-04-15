/**
 * All Images RSS Feed — WildPhotography
 * Returns the latest 500 public images, ordered newest first.
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
  return String(value ?? '')
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
  if (photo.gallery_slug?.trim()) {
    parts.push(`Gallery: ${photo.gallery_slug.replace(/-/g, ' ')}`);
  }

  const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
  if (imageUrl) {
    parts.push(`<img src="${escapeXml(imageUrl)}" alt="${escapeXml(buildPhotoTitle(photo))}" />`);
  }

  parts.push(`<p><a href="${escapeXml(`${siteUrl}/photo/${photo.slug}`)}">View photo</a></p>`);

  return parts.join("<br/>");
}

async function queryAllPhotos(): Promise<FeedPhoto[]> {
  // Use same eligibility filter as handleDailyRandomFeed for consistency
  const rows = await queryNeon<FeedPhoto>(
    `SELECT id, slug, title, description, location_name, date_taken,
            preview_url, medium_url, thumb_url, gallery_slug, species_common_name
     FROM photos
     WHERE ready_for_public_render = true
       AND search_ready = true
       AND slug IS NOT NULL
       AND COALESCE(preview_url, medium_url, thumb_url) IS NOT NULL
     ORDER BY date_taken DESC NULLS LAST, updated_at DESC NULLS LAST, id DESC
     LIMIT 500`
  );
  return rows;
}

export async function handleAllFeed(request: Request, env: { SITE_URL?: string }): Promise<Response> {
  const siteUrl = (env.SITE_URL || "https://wildphotography.com").replace(/\/+$/, "");
  const now = new Date();

  let photos: FeedPhoto[] = [];
  try {
    photos = await queryAllPhotos();
  } catch (err) {
    console.error('[all-feed] DB error:', err);
    return new Response('Database error', { status: 500 });
  }

  const pubDate = formatRfc822(now);
  const channelTitle = "WildPhotography — All Images";
  const channelLink = `${siteUrl}/feed/all.xml`;
  const channelDescription = "All public WildPhotography images, newest first.";

  const items = photos
    .map((photo) => {
      const title = buildPhotoTitle(photo);
      const link = `${siteUrl}/photo/${photo.slug}`;
      const guid = `${siteUrl}/photo/${photo.slug}`;
      const description = buildPhotoDescription(photo, siteUrl);
      const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
      const itemDate = photo.date_taken ? new Date(photo.date_taken) : now;

      return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(guid)}</guid>
      <pubDate>${escapeXml(formatRfc822(itemDate))}</pubDate>
      <description><![CDATA[${description}]]></description>
      ${imageUrl ? `<enclosure url="${escapeXml(imageUrl)}" type="image/jpeg" />` : ''}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${escapeXml(pubDate)}</lastBuildDate>
    <ttl>60</ttl>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=UTF-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}