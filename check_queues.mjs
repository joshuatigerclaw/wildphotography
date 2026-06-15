import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_CONNECTION_STRING!);

const [drift, repair, validation, covers, orphans, galleries, photos] = await Promise.all([
  sql`SELECT COUNT(*) as cnt FROM photos WHERE status = 'active' AND search_ready = false AND thumb_url IS NOT NULL AND ready_for_public_render = true`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM photos WHERE repair_needed = true OR (thumb_url IS NULL AND status = 'active')`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM photos WHERE validation_status = 'pending'`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM galleries WHERE cover_photo_id IS NULL AND photo_count > 0`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM photos WHERE status = 'orphan'`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM galleries`.catch(() => [{cnt:0}]),
  sql`SELECT COUNT(*) as cnt FROM photos`.catch(() => [{cnt:0}])
]);

console.log(JSON.stringify({
  staleDrift: Number(drift[0]?.cnt ?? 0),
  repairBacklog: Number(repair[0]?.cnt ?? 0),
  validationQueue: Number(validation[0]?.cnt ?? 0),
  missingCovers: Number(covers[0]?.cnt ?? 0),
  orphanedCount: Number(orphans[0]?.cnt ?? 0),
  totalGalleries: Number(galleries[0]?.cnt ?? 0),
  totalPhotos: Number(photos[0]?.cnt ?? 0)
}, null, 2));