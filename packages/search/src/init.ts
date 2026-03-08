#!/usr/bin/env npx ts-node
import { typesenseAdmin, PHOTOS_COLLECTION } from '../src/client';

// Schema for photos collection
const photosSchema = {
  name: PHOTOS_COLLECTION,
  fields: [
    // Core identification
    { name: 'id', type: 'string', facet: false },
    { name: 'slug', type: 'string', facet: false },
    { name: 'title', type: 'string', facet: false },
    { name: 'description', type: 'string', facet: false, optional: true },
    
    // Image URLs (for display)
    { name: 'thumb_url', type: 'string', facet: false, optional: true },
    { name: 'small_url', type: 'string', facet: false, optional: true },
    { name: 'medium_url', type: 'string', facet: false, optional: true },
    { name: 'large_url', type: 'string', facet: false, optional: true },
    { name: 'original_url', type: 'string', facet: false, optional: true },
    
    // Facetable fields
    { name: 'keywords', type: 'string[]', facet: true, optional: true },
    { name: 'gallery', type: 'string', facet: true, optional: true },
    { name: 'gallery_id', type: 'string', facet: true, optional: true },
    { name: 'location', type: 'string', facet: true, optional: true },
    { name: 'orientation', type: 'string', facet: true, optional: true },
    { name: 'camera_model', type: 'string', facet: true, optional: true },
    { name: 'lens', type: 'string', facet: true, optional: true },
    { name: 'taken_year', type: 'int32', facet: true, optional: true },
    { name: 'taken_month', type: 'int32', facet: true, optional: true },
    
    // Sorting fields
    { name: 'date_taken', type: 'int64', facet: false, optional: true },
    { name: 'date_uploaded', type: 'int64', facet: false, optional: true },
    { name: 'popularity', type: 'int32', facet: false, optional: true },
    
    // Metadata
    { name: 'width', type: 'int32', facet: false, optional: true },
    { name: 'height', type: 'int32', facet: false, optional: true },
  ] as any[],
};

async function createCollection() {
  console.log('Creating Typesense collection...');
  
  try {
    // Check if collection exists
    const collections = await typesenseAdmin.collections().retrieve();
    const exists = collections.find((c: any) => c.name === PHOTOS_COLLECTION);
    
    if (exists) {
      console.log(`Collection '${PHOTOS_COLLECTION}' already exists. Deleting and recreating...`);
      await typesenseAdmin.collections(PHOTOS_COLLECTION).delete();
    }
    
    // Create collection with schema
    const result = await typesenseAdmin.collections().create(photosSchema as any);
    console.log('Collection created successfully:', result.name);
    
    return result;
  } catch (error) {
    console.error('Error creating collection:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createCollection()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

export { createCollection };
