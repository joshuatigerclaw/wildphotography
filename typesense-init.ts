import pkg from 'typesense';
const Typesense = pkg;
type CollectionCreateSchema = any;

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

// Index schemas
const schemas: Record<string, CollectionCreateSchema> = {
  photos: {
    name: 'photos',
    fields: [
      { name: 'id', type: 'int64', facet: false },
      { name: 'title', type: 'string', facet: false },
      { name: 'description', type: 'string', facet: false },
      { name: 'filename', type: 'string', facet: false },
      { name: 'photographer', type: 'string', facet: true },
      { name: 'location', type: 'string', facet: true },
      { name: 'keywords', type: 'string[]', facet: false },
      { name: 'galleries', type: 'int64[]', facet: false },
      { name: 'dateTaken', type: 'int64', facet: false, optional: true },
      { name: 'dateUploaded', type: 'int64', facet: false },
      { name: 'width', type: 'int32', facet: false, optional: true },
      { name: 'height', type: 'int32', facet: false, optional: true },
      { name: 'isActive', type: 'bool', facet: false },
    ],
    default_sorting_field: 'dateUploaded',
  },
  galleries: {
    name: 'galleries',
    fields: [
      { name: 'id', type: 'int64', facet: false },
      { name: 'name', type: 'string', facet: false },
      { name: 'slug', type: 'string', facet: false },
      { name: 'description', type: 'string', facet: false },
      { name: 'parentGalleryId', type: 'int64', facet: false, optional: true },
      { name: 'photoCount', type: 'int32', facet: false },
      { name: 'dateCreated', type: 'int64', facet: false },
    ],
    default_sorting_field: 'dateCreated',
  },
  keywords: {
    name: 'keywords',
    fields: [
      { name: 'id', type: 'int64', facet: false },
      { name: 'name', type: 'string', facet: false },
      { name: 'slug', type: 'string', facet: false },
      { name: 'category', type: 'string', facet: true, optional: true },
      { name: 'usageCount', type: 'int32', facet: false },
    ],
    default_sorting_field: 'usageCount',
  },
};

async function initializeIndexes() {
  console.log('Initializing Typesense indexes...\n');

  for (const [name, schema] of Object.entries(schemas)) {
    try {
      // Check if collection exists
      const exists = await client.collections(name).retrieve().catch(() => null);
      
      if (exists) {
        console.log(`✓ Collection '${name}' already exists, updating schema...`);
        await client.collections(name).delete();
        console.log(`  → Deleted old collection`);
      }
      
      // Create new collection
      const created = await client.collections().create(schema);
      console.log(`✓ Created collection '${name}'`);
      console.log(`  → Fields: ${schema.fields.map((f: any) => f.name).join(', ')}\n`);
      
    } catch (error: any) {
      console.error(`✗ Failed to create collection '${name}':`, error.message);
    }
  }

  console.log('Initialization complete!');
}

async function listIndexes() {
  console.log('Current Typesense indexes:\n');
  const collections = await client.collections().retrieve();
  
  for (const col of collections) {
    console.log(`- ${col.name}: ${col.num_documents} documents`);
  }
}

async function deleteIndex(name: string) {
  try {
    await client.collections(name).delete();
    console.log(`✓ Deleted collection '${name}'`);
  } catch (error: any) {
    console.error(`✗ Failed to delete '${name}':`, error.message);
  }
}

// CLI args
const args = process.argv.slice(2);
const command = args[0];

if (command === 'list') {
  listIndexes().catch(console.error);
} else if (command === 'delete' && args[1]) {
  deleteIndex(args[1]).catch(console.error);
} else if (command === 'init' || !command) {
  initializeIndexes().catch(console.error);
} else {
  console.log('Usage:');
  console.log('  npx ts-node typesense-init.ts init    # Initialize all indexes');
  console.log('  npx ts-node typesense-init.ts list    # List current indexes');
  console.log('  npx ts-node typesense-init.ts delete # Delete an index');
}
