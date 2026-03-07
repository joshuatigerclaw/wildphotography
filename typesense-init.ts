import pkg from 'typesense';
const Typesense = pkg;

// Typesense configuration (Wildphotography - Typesense Cloud)
const typesenseConfig = {
  nodes: [
    {
      host: 'uibn03zvateqwdx2p-1.a1.typesense.net',
      port: 443,
      protocol: 'https',
    },
  ],
  apiKey: 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7', // Admin key
  connectionTimeoutSeconds: 10,
};

const client = new Typesense.Client(typesenseConfig);

export const searchClient = new Typesense.Client({
  ...typesenseConfig,
  apiKey: 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE', // Search-only key for queries
});

// Exact schema from master spec
const photosSchema = {
  name: 'photos',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'slug', type: 'string', optional: true },
    { name: 'title', type: 'string', optional: true },
    { name: 'description', type: 'string', optional: true },
    { name: 'keywords', type: 'string[]', optional: true, facet: true },
    { name: 'keyword_slugs', type: 'string[]', optional: true, facet: true },
    { name: 'gallery', type: 'string', optional: true, facet: true },
    { name: 'gallery_slug', type: 'string', optional: true, facet: true },
    { name: 'location', type: 'string', optional: true, facet: true },
    { name: 'location_slug', type: 'string', optional: true, facet: true },
    { name: 'country', type: 'string', optional: true, facet: true },
    { name: 'orientation', type: 'string', optional: true, facet: true },
    { name: 'camera_model', type: 'string', optional: true, facet: true },
    { name: 'lens', type: 'string', optional: true, facet: true },
    { name: 'taken_year', type: 'int32', optional: true, facet: true },
    { name: 'taken_timestamp', type: 'int64' },
    { name: 'width', type: 'int32', optional: true },
    { name: 'height', type: 'int32', optional: true },
    { name: 'thumb_url', type: 'string', optional: true },
    { name: 'small_url', type: 'string', optional: true },
    { name: 'medium_url', type: 'string', optional: true },
    { name: 'large_url', type: 'string', optional: true },
    { name: 'preview_url', type: 'string', optional: true },
    { name: 'lat', type: 'float', optional: true },
    { name: 'lon', type: 'float', optional: true },
    { name: 'price_download', type: 'float', optional: true },
    { name: 'status', type: 'string', optional: true, facet: true },
  ],
  default_sorting_field: 'taken_timestamp',
};

async function initializePhotosIndex() {
  console.log('Setting up photos collection...\n');

  try {
    // Delete existing collection
    const existing = await client.collections('photos').retrieve().catch(() => null);
    if (existing) {
      console.log('Deleting existing photos collection...');
      await client.collections('photos').delete();
    }

    // Create new collection
    const created = await client.collections().create(photosSchema);
    console.log('✓ Created photos collection');
    console.log('  → Fields:', photosSchema.fields.map((f: any) => f.name).join(', '));
    console.log('  → Default sort:', photosSchema.default_sorting_field);

  } catch (error: any) {
    console.error('✗ Failed:', error.message);
  }
}

async function listCollections() {
  console.log('\nCurrent collections:\n');
  const collections = await client.collections().retrieve();
  
  for (const col of collections) {
    console.log(`- ${col.name}: ${col.num_documents} documents`);
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

if (command === 'init' || !command) {
  initializePhotosIndex().then(listCollections);
} else if (command === 'list') {
  listCollections();
}
