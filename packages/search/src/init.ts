#!/usr/bin/env npx ts-node
import { typesenseAdmin, PHOTOS_COLLECTION } from '../src/client';

/**
 * Typesense photos collection schema
 * 
 * Requirements:
 * - default_sorting_field must be taken_timestamp
 * - taken_timestamp must always be present on indexed documents
 * - facetable fields must be marked correctly
 * - does NOT expose internal/private-only fields
 */
const photosSchema = {
  name: PHOTOS_COLLECTION,
  default_sorting_field: 'taken_timestamp',
  fields: [
    // Core identification (not faceted)
    { name: 'id', type: 'string', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'title', type: 'string', facet: false },
    { name: 'description', type: 'string', facet: false, optional: true },
    
    // Image URLs - derivatives only (not faceted)
    { name: 'thumb_url', type: 'string', facet: false, optional: true },
    { name: 'small_url', type: 'string', facet: false, optional: true },
    { name: 'medium_url', type: 'string', facet: false, optional: true },
    { name: 'large_url', type: 'string', facet: false, optional: true },
    { name: 'preview_url', type: 'string', facet: false, optional: true },
    
    // FACETABLE fields
    { name: 'keywords', type: 'string[]', facet: true, optional: true },
    { name: 'gallery', type: 'string', facet: true, optional: true },
    { name: 'gallery_slug', type: 'string', facet: true, optional: true },
    { name: 'location', type: 'string', facet: true, optional: true },
    { name: 'country', type: 'string', facet: true, optional: true },
    { name: 'orientation', type: 'string', facet: true, optional: true },
    { name: 'camera_model', type: 'string', facet: true, optional: true },
    { name: 'lens', type: 'string', facet: true, optional: true },
    { name: 'taken_year', type: 'int32', facet: true, optional: true },
    { name: 'taken_month', type: 'int32', facet: true, optional: true },
    { name: 'status', type: 'string', facet: true, optional: true },
    
    // Sorting fields
    { name: 'taken_timestamp', type: 'int64', facet: false, optional: true },
    { name: 'date_uploaded', type: 'int64', facet: false, optional: true },
    { name: 'popularity', type: 'int32', facet: false, optional: true },
    
    // Metadata (not faceted)
    { name: 'width', type: 'int32', facet: false, optional: true },
    { name: 'height', type: 'int32', facet: false, optional: true },
    { name: 'price_download', type: 'int32', facet: false, optional: true },
    
    // Geolocation (optional)
    { name: 'lat', type: 'float', facet: false, optional: true },
    { name: 'lon', type: 'float', facet: false, optional: true },
  ] as any[],
};

/**
 * Check if collection exists and has compatible schema
 */
async function checkCollection(): Promise<boolean> {
  try {
    const collections = await typesenseAdmin.collections().retrieve();
    const existing = collections.find((c: any) => c.name === PHOTOS_COLLECTION);
    
    if (!existing) {
      return false;
    }
    
    console.log(`Collection '${PHOTOS_COLLECTION}' exists with ${existing.num_documents} documents`);
    return true;
  } catch (error) {
    console.log('Collection does not exist');
    return false;
  }
}

/**
 * Delete existing collection
 */
async function deleteCollection(): Promise<void> {
  try {
    await typesenseAdmin.collections(PHOTOS_COLLECTION).delete();
    console.log(`Deleted existing collection '${PHOTOS_COLLECTION}'`);
  } catch (error) {
    // Collection might not exist
    console.log('No existing collection to delete');
  }
}

/**
 * Create collection with schema
 */
async function createCollection(): Promise<void> {
  console.log(`Creating collection '${PHOTOS_COLLECTION}'...`);
  
  try {
    const result = await typesenseAdmin.collections().create(photosSchema as any);
    console.log(`✅ Collection created: ${result.name}`);
    console.log(`   Fields: ${result.fields?.length || 0}`);
    console.log(`   Default sorting: ${result.default_sorting_field}`);
  } catch (error: any) {
    console.error('❌ Error creating collection:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Typesense Collection Initialization ===\n');
  
  const exists = await checkCollection();
  
  if (exists) {
    const shouldRecreate = process.argv.includes('--recreate') || process.argv.includes('-r');
    
    if (shouldRecreate) {
      console.log('Recreating collection (--recreate flag detected)\n');
      await deleteCollection();
      await createCollection();
    } else {
      console.log('Collection already exists. Use --recreate to recreate.\n');
    }
  } else {
    await createCollection();
  }
  
  console.log('\n✅ Initialization complete!');
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Initialization failed:', err);
      process.exit(1);
    });
}

export { createCollection, photosSchema };
