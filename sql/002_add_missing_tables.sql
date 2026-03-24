-- WildPhotography Neon PostgreSQL Schema (Compatible with existing tables)
-- Version: 1.1.0

-- ============================================
-- LOCATIONS TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    country VARCHAR(100),
    region VARCHAR(100),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    location_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_country_region ON locations(country, region);

-- ============================================
-- SPECIES TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS species (
    id SERIAL PRIMARY KEY,
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    taxon_rank VARCHAR(50),
    animal_group VARCHAR(100),
    confidence DECIMAL(3, 2),
    needs_review BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_species_common_name ON species(common_name);
CREATE INDEX IF NOT EXISTS idx_species_animal_group ON species(animal_group);

-- ============================================
-- AFFILIATE_OFFERS TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_offers (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    external_id VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    destination VARCHAR(255),
    accommodation_type VARCHAR(100),
    price_if_available VARCHAR(50),
    rating_if_available VARCHAR(20),
    review_count_if_available VARCHAR(20),
    duration_if_available VARCHAR(50),
    provider_if_available VARCHAR(255),
    relevance_score DECIMAL(3, 2),
    cta_text VARCHAR(255),
    label VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_offers_source ON affiliate_offers(source);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_category ON affiliate_offers(category);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_destination ON affiliate_offers(destination);

-- ============================================
-- PHOTO_AFFILIATE_OFFERS (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS photo_affiliate_offers (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    offer_id INTEGER NOT NULL REFERENCES affiliate_offers(id) ON DELETE CASCADE,
    relevance_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(photo_id, offer_id)
);

-- ============================================
-- IMPORT_LOGS TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS import_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(100),
    source_folder VARCHAR(1000),
    csv_path VARCHAR(1000),
    total_rows INTEGER,
    imported_new INTEGER DEFAULT 0,
    updated_existing INTEGER DEFAULT 0,
    duplicates_skipped INTEGER DEFAULT 0,
    filename_collisions_renamed INTEGER DEFAULT 0,
    rows_failed INTEGER DEFAULT 0,
    originals_uploaded INTEGER DEFAULT 0,
    derivatives_generated INTEGER DEFAULT 0,
    ready_for_public_render_count INTEGER DEFAULT 0,
    search_ready_count INTEGER DEFAULT 0,
    failed_file_paths TEXT[],
    status VARCHAR(50) DEFAULT 'running',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- REPAIR_LOGS TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS repair_logs (
    id SERIAL PRIMARY KEY,
    repair_type VARCHAR(100) NOT NULL,
    records_affected INTEGER DEFAULT 0,
    details JSONB,
    status VARCHAR(50) DEFAULT 'running',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- PUBLISH_LOGS TABLE (NEW)
-- ============================================
CREATE TABLE IF NOT EXISTS publish_logs (
    id SERIAL PRIMARY KEY,
    photo_id INTEGER REFERENCES photos(id) ON DELETE SET NULL,
    gallery_id INTEGER REFERENCES galleries(id) ON DELETE SET NULL,
    page_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================

-- Add to photos table if not exists
ALTER TABLE photos ADD COLUMN IF NOT EXISTS source_path VARCHAR(1000);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS filename VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS canonical_filename VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS safe_storage_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS gallery_slug VARCHAR(255);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE photos ADD COLUMN IF NOT EXISTS subjects TEXT[];
ALTER TABLE photos ADD COLUMN IF NOT EXISTS scene_type VARCHAR(100);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS species_common_name VARCHAR(255);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS species_scientific_name VARCHAR(255);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS species_confidence DECIMAL(3, 2);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS animal_group VARCHAR(100);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS region VARCHAR(100);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS location_name VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS location_hint VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS r2_original_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS r2_thumb_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS r2_web_small_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS r2_web_large_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS r2_print_key VARCHAR(500);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS local_backup_mirror_path VARCHAR(1000);
ALTER TABLE photos ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'new';

-- Add missing indexes to photos
CREATE INDEX IF NOT EXISTS idx_photos_content_hash ON photos(content_hash);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_slug ON photos(gallery_slug);
CREATE INDEX IF NOT EXISTS idx_photos_species_common_name ON photos(species_common_name);
CREATE INDEX IF NOT EXISTS idx_photos_location_name ON photos(location_name);
CREATE INDEX IF NOT EXISTS idx_photos_ready_for_public_render ON photos(ready_for_public_render);
CREATE INDEX IF NOT EXISTS idx_photos_search_ready ON photos(search_ready);
CREATE INDEX IF NOT EXISTS idx_photos_state ON photos(state);
CREATE INDEX IF NOT EXISTS idx_photos_country_region ON photos(country, region);
CREATE INDEX IF NOT EXISTS idx_photos_date_taken ON photos(date_taken DESC);
