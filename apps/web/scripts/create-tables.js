const { neon } = require('@neondatabase/serverless');

const sql = neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');

async function createTables() {
  console.log('Creating tables...');
  
  // Galleries
  await sql`
    CREATE TABLE IF NOT EXISTS galleries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500) UNIQUE NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'public',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ galleries');

  // Photos
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(500) UNIQUE NOT NULL,
      title VARCHAR(500),
      caption_short VARCHAR(500),
      description_long TEXT,
      location_name VARCHAR(255),
      country VARCHAR(100),
      camera_make VARCHAR(100),
      camera_model VARCHAR(100),
      lens VARCHAR(255),
      width INTEGER,
      height INTEGER,
      orientation VARCHAR(20),
      lat NUMERIC(10,7),
      lon NUMERIC(10,7),
      thumb_url VARCHAR(500),
      small_url VARCHAR(500),
      medium_url VARCHAR(500),
      large_url VARCHAR(500),
      price_download NUMERIC(10,2),
      status VARCHAR(20) DEFAULT 'public',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ photos');

  // Gallery Photos
  await sql`
    CREATE TABLE IF NOT EXISTS gallery_photos (
      gallery_id UUID REFERENCES galleries(id),
      photo_id UUID REFERENCES photos(id),
      position INTEGER,
      PRIMARY KEY (gallery_id, photo_id)
    )
  `;
  console.log('✓ gallery_photos');

  // Keywords
  await sql`
    CREATE TABLE IF NOT EXISTS keywords (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      keyword VARCHAR(255) UNIQUE NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      keyword_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ keywords');

  // Photo Keywords
  await sql`
    CREATE TABLE IF NOT EXISTS photo_keywords (
      photo_id UUID REFERENCES photos(id),
      keyword_id UUID REFERENCES keywords(id),
      PRIMARY KEY (photo_id, keyword_id)
    )
  `;
  console.log('✓ photo_keywords');

  // Orders
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      paypal_order_id VARCHAR(100) UNIQUE,
      amount_cents INTEGER NOT NULL,
      currency VARCHAR(3) DEFAULT 'USD',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ orders');

  // Order Items
  await sql`
    CREATE TABLE IF NOT EXISTS order_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id),
      photo_id UUID REFERENCES photos(id),
      sku VARCHAR(100) NOT NULL,
      unit_amount_cents INTEGER NOT NULL
    )
  `;
  console.log('✓ order_items');

  // Fulfillments
  await sql`
    CREATE TABLE IF NOT EXISTS fulfillments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID REFERENCES orders(id),
      download_token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      max_downloads INTEGER DEFAULT 5,
      download_count INTEGER DEFAULT 0
    )
  `;
  console.log('✓ fulfillments');

  // Ingest Runs
  await sql`
    CREATE TABLE IF NOT EXISTS ingest_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      started_at TIMESTAMP DEFAULT NOW(),
      ended_at TIMESTAMP
    )
  `;
  console.log('✓ ingest_runs');

  // Ingest Jobs
  await sql`
    CREATE TABLE IF NOT EXISTS ingest_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ingest_run_id UUID REFERENCES ingest_runs(id),
      job_type VARCHAR(20) NOT NULL,
      source_key VARCHAR(255),
      status VARCHAR(20) DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log('✓ ingest_jobs');

  console.log('\n✅ All tables created!');
}

createTables().catch(console.error);
