# WildPhotography Database Schema

## Quick Start

Apply the schema to your Neon database:

```bash
# Set your Neon connection string
export NEON_CONNECTION_STRING="postgresql://user:pass@host/neondb?sslmode=require"

# Apply schema
psql $NEON_CONNECTION_STRING -f sql/001_initial_schema.sql
```

## Required Environment Variables

### For Python Controller

```bash
# Cloudflare R2
export R2_ENDPOINT="https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
export R2_ACCESS_KEY_ID="your-key"
export R2_SECRET_ACCESS_KEY="your-secret"
export R2_BUCKET="wildphoto-storage"
export R2_PUBLIC_URL="https://pub-7d412c6efb5943b5bc587e695e22001e.r2.dev"

# Neon PostgreSQL
export NEON_CONNECTION_STRING="postgresql://neondb_owner:pass@host/neondb?sslmode=require"

# Typesense
export TYPESENSE_HOST="your-typesense-host"
export TYPESENSE_PORT="443"
export TYPESENSE_API_KEY="your-key"
export TYPESENSE_HTTPS="true"

# Gemini Vision (for species identification)
export GEMINI_API_KEY="your-key"

# TomTom (for geocoding)
export TOMTOM_API_KEY="your-key"
```

## Schema Overview

### Tables

| Table | Purpose |
|-------|---------|
| `galleries` | Photo galleries |
| `photos` | Photo metadata with R2 keys |
| `locations` | Location reference data |
| `species` | Species reference data |
| `gallery_photos` | Gallery-photo junction |
| `affiliate_offers` | Tours, hotels, products |
| `photo_affiliates` | Photo-offer linking |
| `import_logs` | Import batch tracking |
| `repair_logs` | Repair operation logs |
| `publish_logs` | Publishing history |
| `photo_visits` | View tracking |

### Key Indexes

- `photos.content_hash` - Deduplication
- `photos.slug` - URL lookups
- `photos.gallery_slug` - Gallery queries
- `photos.ready_for_public_render` - Publishing filters
- `photos.search_ready` - Search indexing

## Rollback

To drop all tables:

```sql
DROP TABLE IF EXISTS photo_visits CASCADE;
DROP TABLE IF EXISTS publish_logs CASCADE;
DROP TABLE IF EXISTS repair_logs CASCADE;
DROP TABLE IF EXISTS import_logs CASCADE;
DROP TABLE IF EXISTS photo_affiliate_offers CASCADE;
DROP TABLE IF EXISTS affiliate_offers CASCADE;
DROP TABLE IF EXISTS gallery_photos CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS species CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS galleries CASCADE;
```
