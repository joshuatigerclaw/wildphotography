/**
 * Database Migration Script
 * 
 * Creates all tables in Neon database
 */

const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Running migrations...\n');

  // Create tables
  const migrations = [
    // Keywords table
    `CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      slug VARCHAR(255) NOT NULL UNIQUE,
      category VARCHAR(100),
      usage_count INTEGER DEFAULT 0,
      date_created TIMESTAMP DEFAULT NOW()
    )`,
    
    // Galleries table
    `CREATE TABLE IF NOT EXISTS galleries (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      cover_photo_id INTEGER REFERENCES photos(id),
      parent_gallery_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      date_created TIMESTAMP DEFAULT NOW(),
      date_modified TIMESTAMP DEFAULT NOW()
    )`,
    
    // Photos table - Updated with R2 fields
    `CREATE TABLE IF NOT EXISTS photos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255),
      slug VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      original_r2_key VARCHAR(500),
      thumb_url VARCHAR(500),
      small_url VARCHAR(500),
      medium_url VARCHAR(500),
      large_url VARCHAR(500),
      preview_url VARCHAR(500),
      filename VARCHAR(255),
      original_filename VARCHAR(255),
      image_url VARCHAR(500),
      thumbnail_url VARCHAR(500),
      width INTEGER,
      height INTEGER,
      file_size INTEGER,
      mime_type VARCHAR(50),
      orientation VARCHAR(20),
      photographer VARCHAR(255),
      location VARCHAR(255),
      camera_model VARCHAR(255),
      lens VARCHAR(255),
      date_taken TIMESTAMP,
      date_uploaded TIMESTAMP DEFAULT NOW(),
      date_modified TIMESTAMP DEFAULT NOW(),
      is_active BOOLEAN DEFAULT true,
      popularity INTEGER DEFAULT 0,
      metadata JSONB
    )`,
    
    // Photo Keywords junction
    `CREATE TABLE IF NOT EXISTS photo_keywords (
      id SERIAL PRIMARY KEY,
      photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      keyword_id INTEGER NOT NULL REFERENCES keywords(id) ON DELETE CASCADE,
      confidence DECIMAL(5,2),
      date_assigned TIMESTAMP DEFAULT NOW()
    )`,
    
    // Gallery Photos junction
    `CREATE TABLE IF NOT EXISTS gallery_photos (
      id SERIAL PRIMARY KEY,
      gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
      photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      sort_order INTEGER DEFAULT 0,
      date_added TIMESTAMP DEFAULT NOW()
    )`,
    
    // Orders table
    `CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(50) NOT NULL UNIQUE,
      customer_email VARCHAR(255) NOT NULL,
      customer_name VARCHAR(255),
      customer_phone VARCHAR(50),
      subtotal DECIMAL(10,2),
      tax DECIMAL(10,2),
      shipping DECIMAL(10,2),
      total DECIMAL(10,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      notes TEXT,
      metadata JSONB,
      date_created TIMESTAMP DEFAULT NOW(),
      date_modified TIMESTAMP DEFAULT NOW()
    )`,
    
    // Order Items table
    `CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      photo_id INTEGER REFERENCES photos(id),
      product_type VARCHAR(100) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      quantity INTEGER DEFAULT 1,
      unit_price DECIMAL(10,2) NOT NULL,
      total_price DECIMAL(10,2) NOT NULL,
      license_type VARCHAR(50),
      download_url VARCHAR(500),
      date_created TIMESTAMP DEFAULT NOW()
    )`,
    
    // Fulfillments table
    `CREATE TABLE IF NOT EXISTS fulfillments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      order_item_id INTEGER REFERENCES order_items(id),
      status VARCHAR(20) DEFAULT 'pending',
      tracking_number VARCHAR(100),
      tracking_url VARCHAR(500),
      carrier VARCHAR(100),
      date_shipped TIMESTAMP,
      date_delivered TIMESTAMP,
      notes TEXT,
      metadata JSONB,
      date_created TIMESTAMP DEFAULT NOW(),
      date_modified TIMESTAMP DEFAULT NOW()
    )`,
    
    // Ingest Runs table
    `CREATE TABLE IF NOT EXISTS ingest_runs (
      id SERIAL PRIMARY KEY,
      run_number INTEGER,
      source VARCHAR(100) NOT NULL,
      status VARCHAR(20) DEFAULT 'queued',
      photos_processed INTEGER DEFAULT 0,
      photos_imported INTEGER DEFAULT 0,
      photos_skipped INTEGER DEFAULT 0,
      photos_failed INTEGER DEFAULT 0,
      errors JSONB,
      date_started TIMESTAMP,
      date_completed TIMESTAMP,
      date_created TIMESTAMP DEFAULT NOW()
    )`,
    
    // Ingest Jobs table
    `CREATE TABLE IF NOT EXISTS ingest_jobs (
      id SERIAL PRIMARY KEY,
      run_id INTEGER REFERENCES ingest_runs(id),
      source_id VARCHAR(255),
      source_url VARCHAR(500),
      status VARCHAR(20) DEFAULT 'queued',
      photo_id INTEGER REFERENCES photos(id),
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      date_started TIMESTAMP,
      date_completed TIMESTAMP,
      date_created TIMESTAMP DEFAULT NOW()
    )`,
    
    // Create indexes
    `CREATE INDEX IF NOT EXISTS idx_photos_slug ON photos(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_photos_active ON photos(is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery ON gallery_photos(gallery_id)`,
    `CREATE INDEX IF NOT EXISTS idx_photo_keywords_photo ON photo_keywords(photo_id)`,
    `CREATE INDEX IF NOT EXISTS idx_photo_keywords_keyword ON photo_keywords(keyword_id)`,
  ];

  for (const migration of migrations) {
    try {
      await sql(migration);
      console.log('✅ Migration executed');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
    }
  }

  console.log('\n✅ All migrations complete!');
}

migrate().catch(console.error);
