/**
 * Daily Random RSS Feed — Cloudflare Worker
 * Uses pg library (available in CF Workers via polyfill)
 */
import { Client } from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require';

function escapeXml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRfc822(date) {
  return date.toUTCString();
}

function buildTitle(photo) {
  if (photo.title?.trim()) return photo.title.trim();
  if (photo.species_common_name && photo.location_name) return photo.species_common_name + ' in ' + photo.location_name;
  if (photo.species_common_name) return photo.species_common_name;
  if (photo.location_name) return 'Photo from ' + photo.location_name;
  return 'WildPhotography Photo';
}

function buildDescription(photo) {
  const parts = [];
  if (photo.description?.trim()) parts.push(photo.description.trim());
  if (photo.location_name?.trim()) parts.push('Location: ' + photo.location_name.trim());
  if (photo.species_common_name?.trim()) parts.push('Subject: ' + photo.species_common_name.trim());
  const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
  if (imageUrl) parts.push('<img src="' + escapeXml(imageUrl) + '" alt="' + escapeXml(buildTitle(photo)) + '" />');
  parts.push('<p><a href="https://wildphotography.com/photo/' + photo.slug + '">View photo</a></p>');
  return parts.join('<br/>');
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== '/feed/daily-random.xml') {
      return new Response('Not Found', { status: 404 });
    }

    const now = new Date();
    const seed = now.toISOString().slice(0, 10);
    const seedNum = parseInt(seed.replace(/-/g, ''), 10);
    const offset = seedNum % 30200;

    let client;
    try {
      client = new Client({ connectionString: DATABASE_URL });
      await client.connect();
      const result = await client.query(
        `SELECT id, slug, title, description, location_name, date_taken, preview_url, medium_url, thumb_url, gallery_slug, species_common_name FROM photos WHERE ready_for_public_render = true AND search_ready = true AND slug IS NOT NULL AND COALESCE(preview_url, medium_url, thumb_url) IS NOT NULL ORDER BY id OFFSET $1 LIMIT 3`,
        [offset]
      );
      const photos = result.rows;

      const items = photos.map(photo => {
        const title = buildTitle(photo);
        const link = 'https://wildphotography.com/photo/' + photo.slug;
        const guid = 'wildphotography-daily-' + seed + '-' + photo.id;
        const description = buildDescription(photo);
        const imageUrl = photo.preview_url || photo.medium_url || photo.thumb_url;
        const itemDate = photo.date_taken ? new Date(photo.date_taken) : now;
        return '\n    <item>\n      <title>' + escapeXml(title) + '</title>\n      <link>' + escapeXml(link) + '</link>\n      <guid isPermaLink="false">' + escapeXml(guid) + '</guid>\n      <pubDate>' + escapeXml(formatRfc822(itemDate)) + '</pubDate>\n      <description><![CDATA[' + description + ']]></description>\n      ' + (imageUrl ? '<enclosure url="' + escapeXml(imageUrl) + '" type="image/jpeg" />' : '') + '\n    </item>';
      }).join('');

      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>WildPhotography Daily Random Feed</title>\n    <link>https://wildphotography.com/feed/daily-random.xml</link>\n    <description>Three rotating WildPhotography images selected daily.</description>\n    <language>en-us</language>\n    <lastBuildDate>' + escapeXml(formatRfc822(now)) + '</lastBuildDate>\n    <ttl>1440</ttl>' + items + '\n  </channel>\n</rss>';

      return new Response(xml, {
        headers: {
          'content-type': 'application/rss+xml; charset=UTF-8',
          'cache-control': 'public, max-age=3600'
        }
      });
    } catch (err) {
      console.error('[feed] error:', err);
      return new Response('Server error', { status: 500 });
    } finally {
      if (client) await client.end().catch(() => {});
    }
  }
};
