-- WildPhotography Neon PostgreSQL Schema
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- GALLERIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS galleries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(500) NOT NULL,
    description TEXT,
    cover_photo_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for galleries
CREATE INDEX IF NOT EXISTS idx_galleries_slug ON galleries(slug);
CREATE INDEX IF NOT EXISTS idx_galleries_is_active ON galleries(is_active);

-- ============================================
-- LOCATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for locations
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_country_region ON locations(country, region);
CREATE INDEX IF NOT EXISTS idx_locations_name_gin ON locations USING gin(name gin_trgm_ops);

-- ============================================
-- SPECIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS species (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    common_name VARCHAR(255) NOT NULL,
    scientific_name VARCHAR(255),
    taxon_rank VARCHAR(50),
    animal_group VARCHAR(100),
    confidence DECIMAL(3, 2),
    needs_review BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for species
CREATE INDEX IF NOT EXISTS idx_species_common_name ON species(common_name);
CREATE INDEX IF NOT EXISTS idx_species_animal_group ON species(animal_group);

-- ============================================
-- PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) NOT NULL,
    
    -- Source info
    source_path VARCHAR(1000),
    filename VARCHAR(500),
    canonical_filename VARCHAR(500),
    content_hash VARCHAR(64),
    safe_storage_key VARCHAR(500),
    
    -- Gallery linkage
    gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
    gallery_slug VARCHAR(255),
    
    -- Public metadata
    title VARCHAR(500),
    description TEXT,
    description_long TEXT,
    keywords TEXT[],
    subjects TEXT[],
    scene_type VARCHAR(100),
    
    -- Species
    species_common_name VARCHAR(255),
    species_scientific_name VARCHAR(255),
    species_confidence DECIMAL(3, 2),
    animal_group VARCHAR(100),
    
    -- Location
    country VARCHAR(100),
    region VARCHAR(100),
    location_name VARCHAR(500),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    location_hint VARCHAR(500),
    
    -- EXIF
    date_taken TIMESTAMP WITH TIME ZONE,
    date_uploaded TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    camera_make VARCHAR(100),
    camera_model VARCHAR(100),
    lens_model VARCHAR(200),
    iso VARCHAR(50),
    shutter_speed VARCHAR(50),
    aperture VARCHAR(50),
    focal_length_mm VARCHAR(50),
    width INTEGER,
    height INTEGER,
    
    -- R2 storage keys (canonical)
    r2_original_key VARCHAR(500),
    r2_thumb_key VARCHAR(500),
    r2_web_small_key VARCHAR(500),
    r2_web_large_key VARCHAR(500),
    r2_print_key VARCHAR(500),
    
    -- Legacy URL fields (for migration)
    thumb_url VARCHAR(1000),
    small_url VARCHAR(1000),
    medium_url VARCHAR(1000),
    large_url VARCHAR(1000),
    preview_url VARCHAR(1000),
    
    -- Local backup mirror
    local_backup_mirror_path VARCHAR(1000),
    
    -- State flags
    ready_for_public_render BOOLEAN DEFAULT false,
    search_ready BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT false,
    needs_review BOOLEAN DEFAULT false,
    state VARCHAR(50) DEFAULT 'new',
    
    -- Views
    views_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for photos
CREATE UNIQUE INDEX IF NOT EXISTS idx_photos_slug ON photos(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_photos_content_hash ON photos(content_hash);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_id ON photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_photos_gallery_slug ON photos(gallery_slug);
CREATE INDEX IF NOT EXISTS idx_photos_species_common_name ON photos(species_common_name);
CREATE INDEX IF NOT EXISTS idx_photos_location_name ON photos(location_name);
CREATE INDEX IF NOT EXISTS idx_photos_ready_for_public_render ON photos(ready_for_public_render);
CREATE INDEX IF NOT EXISTS idx_photos_search_ready ON photos(search_ready);
CREATE INDEX IF NOT EXISTS idx_photos_state ON photos(state);
CREATE INDEX IF NOT EXISTS idx_photos_country_region ON photos(country, region);
CREATE INDEX IF NOT EXISTS idx_photos_date_taken ON photos(date_taken DESC);
CREATE INDEX IF NOT EXISTS idx_photos_date_uploaded ON photos(date_uploaded DESC);

-- ============================================
-- GALLERY_PHOTOS (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS gallery_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(gallery_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_id ON gallery_photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_photo_id ON gallery_photos(photo_id);

-- ============================================
-- AFFILIATE_OFFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS affiliate_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL, -- 'getyourguide', 'viator', 'amazon', 'expedia'
    external_id VARCHAR(255),
    category VARCHAR(100) NOT NULL, -- 'tour', 'hotel', 'product'
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

-- Indexes for affiliate_offers
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_source ON affiliate_offers(source);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_category ON affiliate_offers(category);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_destination ON affiliate_offers(destination);
CREATE INDEX IF NOT EXISTS idx_affiliate_offers_is_active ON affiliate_offers(is_active);

-- ============================================
-- PHOTO_AFFILIATE_OFFERS (junction)
-- ============================================
CREATE TABLE IF NOT EXISTS photo_affiliate_offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    offer_id UUID NOT NULL REFERENCES affiliate_offers(id) ON DELETE CASCADE,
    relevance_position INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(photo_id, offer_id)
);

-- ============================================
-- IMPORT_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- REPAIR_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS repair_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repair_type VARCHAR(100) NOT NULL,
    records_affected INTEGER DEFAULT 0,
    details JSONB,
    status VARCHAR(50) DEFAULT 'running',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PUBLISH_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS publish_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    gallery_id UUID REFERENCES galleries(id) ON DELETE SET NULL,
    page_type VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- PHOTO_VISITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS photo_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    slug VARCHAR(255),
    referrer VARCHAR(500),
    user_agent VARCHAR(500),
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_visits_photo_id ON photo_visits(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_visits_visited_at ON photo_visits(visited_at DESC);
