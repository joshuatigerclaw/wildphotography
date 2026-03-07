import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import pkg from 'typesense';
const Typesense = pkg;
import { eq, inArray, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema';

// Database connection
const sqlDb = neon(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require');
const db = drizzle(sqlDb, { schema });

// Typesense client
const typesense = new Typesense.Client({
  nodes: [{
    host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
    port: 443,
    protocol: 'https',
  }],
  apiKey: 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7',
  connectionTimeoutSeconds: 10,
});

/**
 * Sync all photos from database to Typesense
 */
async function syncPhotos() {
  console.log('Syncing photos to Typesense...\n');
  
  const photos = await db.select().from(schema.photos).where(eq(schema.photos.isActive, true));
  
  if (photos.length === 0) {
    console.log('No photos to sync.');
    return;
  }
  
  console.log(`Found ${photos.length} photos in database.`);
  
  // Transform for Typesense
  const documents = [];
  
  for (const photo of photos) {
    const doc: any = {
      id: photo.id,
      title: photo.title || '',
      description: photo.description || '',
      filename: photo.filename,
      photographer: photo.photographer || '',
      location: photo.location || '',
      keywords: [],
      galleries: [],
      dateTaken: photo.dateTaken ? new Date(photo.dateTaken).getTime() : null,
      dateUploaded: photo.dateUploaded ? new Date(photo.dateUploaded).getTime() : Date.now(),
      width: photo.width,
      height: photo.height,
      isActive: photo.isActive,
    };
    
    // Fetch keywords for this photo
    const pkResults = await db
      .select()
      .from(schema.photoKeywords)
      .where(eq(schema.photoKeywords.photoId, photo.id));
    
    if (pkResults.length > 0) {
      const kwIds = pkResults.map(r => r.keywordId);
      const kws = await db
        .select()
        .from(schema.keywords)
        .where(inArray(schema.keywords.id, kwIds));
      doc.keywords = kws.map(k => k.name);
    }
    
    // Fetch galleries for this photo
    const gpResults = await db
      .select()
      .from(schema.galleryPhotos)
      .where(eq(schema.galleryPhotos.photoId, photo.id));
    
    if (gpResults.length > 0) {
      doc.galleries = gpResults.map(g => g.galleryId);
    }
    
    documents.push(doc);
  }
  
  // Index in Typesense
  try {
    const result = await typesense.collections('photos').documents().import(documents, { action: 'upsert' });
    const successCount = (result as any[]).filter(r => r.success).length;
    console.log(`✓ Indexed ${successCount}/${documents.length} photos`);
  } catch (error: any) {
    console.error('✗ Failed to index photos:', error.message);
  }
}

/**
 * Sync all galleries from database to Typesense
 */
async function syncGalleries() {
  console.log('Syncing galleries to Typesense...\n');
  
  const galleries = await db.select().from(schema.galleries).where(eq(schema.galleries.isActive, true));
  
  if (galleries.length === 0) {
    console.log('No galleries to sync.');
    return;
  }
  
  console.log(`Found ${galleries.length} galleries in database.`);
  
  const documents = [];
  
  for (const gallery of galleries) {
    // Count photos in gallery
    const photos = await db
      .select()
      .from(schema.galleryPhotos)
      .where(eq(schema.galleryPhotos.galleryId, gallery.id));
    
    documents.push({
      id: gallery.id,
      name: gallery.name,
      slug: gallery.slug,
      description: gallery.description || '',
      parentGalleryId: gallery.parentGalleryId,
      photoCount: photos.length,
      dateCreated: gallery.dateCreated ? new Date(gallery.dateCreated).getTime() : Date.now(),
    });
  }
  
  try {
    const result = await typesense.collections('galleries').documents().import(documents, { action: 'upsert' });
    const successCount = (result as any[]).filter(r => r.success).length;
    console.log(`✓ Indexed ${successCount}/${documents.length} galleries`);
  } catch (error: any) {
    console.error('✗ Failed to index galleries:', error.message);
  }
}

/**
 * Sync all keywords from database to Typesense
 */
async function syncKeywords() {
  console.log('Syncing keywords to Typesense...\n');
  
  const keywords = await db.select().from(schema.keywords);
  
  if (keywords.length === 0) {
    console.log('No keywords to sync.');
    return;
  }
  
  console.log(`Found ${keywords.length} keywords in database.`);
  
  const documents = keywords.map(kw => ({
    id: kw.id,
    name: kw.name,
    slug: kw.slug,
    category: kw.category,
    usageCount: kw.usageCount,
  }));
  
  try {
    const result = await typesense.collections('keywords').documents().import(documents, { action: 'upsert' });
    const successCount = (result as any[]).filter(r => r.success).length;
    console.log(`✓ Indexed ${successCount}/${documents.length} keywords`);
  } catch (error: any) {
    console.error('✗ Failed to index keywords:', error.message);
  }
}

/**
 * Full sync - all collections
 */
async function fullSync() {
  console.log('=== Full Typesense Sync ===\n');
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  await syncPhotos();
  console.log('');
  await syncGalleries();
  console.log('');
  await syncKeywords();
  
  console.log('\n=== Sync Complete ===');
}

/**
 * Main CLI
 */
const args = process.argv.slice(2);
const command = args[0];

if (command === 'photos') {
  syncPhotos().catch(console.error);
} else if (command === 'galleries') {
  syncGalleries().catch(console.error);
} else if (command === 'keywords') {
  syncKeywords().catch(console.error);
} else if (command === 'full' || !command) {
  fullSync().catch(console.error);
} else {
  console.log('Usage:');
  console.log('  npx ts-node scripts/init-search.ts photos    # Sync photos only');
  console.log('  npx ts-node scripts/init-search.ts galleries # Sync galleries only');
  console.log('  npx ts-node scripts/init-search.ts keywords  # Sync keywords only');
  console.log('  npx ts-node scripts/init-search.ts full      # Full sync (default)');
}
