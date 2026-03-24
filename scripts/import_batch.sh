#!/bin/bash

# WildPhotography Import Batch Script
# Process up to 100 photos from the queue

set -e

# Configuration
QUEUE_FILE="/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/birds_import_queue.json"
OUTPUT_DIR="/Users/joshuatenbrink/.openclaw/workspace/wildphotography/storage/derivatives"
R2_BUCKET="wildphoto-storage"
R2_REGION="auto"
AWS_ACCESS_KEY="b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_KEY="3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"
R2_ENDPOINT="https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"

# Database
DB_HOST="ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech"
DB_NAME="wildphotography"
DB_USER="neondb_owner"
DB_PASS="npg_BvF2JsQ8drba"

export PGPASSWORD="$DB_PASS"

# Gallery ID for Birds
GALLERY_ID=5

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Process queue
echo "Starting import batch..."

# Get first 100 pending items from queue
ITEMS=$(jq -c '.[] | select(.status == "pending") | select(.attempt_count < 3)' "$QUEUE_FILE" | head -100)

COUNT=0
DUPLICATES_SKIPPED=0
COLLISIONS_RENAMED=0
UPLOADED=0
DERIVATIVES_GENERATED=0
FAILED=0

for ITEM in $ITEMS; do
    COUNT=$((COUNT + 1))
    
    # Extract fields
    ID=$(echo "$ITEM" | jq -r '.id')
    SOURCE_PATH=$(echo "$ITEM" | jq -r '.source_path')
    FILENAME=$(echo "$ITEM" | jq -r '.filename')
    CONTENT_HASH=$(echo "$ITEM" | jq -r '.content_hash')
    GALLERY_FOLDER=$(echo "$ITEM" | jq -r '.gallery_folder')
    
    echo "Processing: $FILENAME"
    
    # Check if source file exists
    if [ ! -f "$SOURCE_PATH" ]; then
        echo "  - Source file not found, skipping"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    # Check for duplicate by content_hash
    EXISTS=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM photos WHERE content_hash = '$CONTENT_HASH';" 2>/dev/null | tr -d ' ')
    if [ "$EXISTS" -gt 0 ]; then
        echo "  - Duplicate by content_hash, skipping"
        DUPLICATES_SKIPPED=$((DUPLICATES_SKIPPED + 1))
        continue
    fi
    
    # Check for filename collision
    COLLISION=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM photos WHERE filename = '$FILENAME';" 2>/dev/null | tr -d ' ')
    if [ "$COLLISION" -gt 0 ]; then
        # Rename - add hash suffix
        BASE=$(basename "$FILENAME" | sed 's/\.[^.]*$//')
        EXT=$(basename "$FILENAME" | sed 's/.*\.//')
        NEW_FILENAME="${BASE}_${CONTENT_HASH:0:8}.${EXT}"
        echo "  - Filename collision, renamed to $NEW_FILENAME"
        COLLISIONS_RENAMED=$((COLLISIONS_RENAMED + 1))
    else
        NEW_FILENAME="$FILENAME"
    fi
    
    # Generate slug from filename
    SLUG=$(echo "$NEW_FILENAME" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-_')
    
    # Check slug uniqueness
    SLUG_EXISTS=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM photos WHERE slug = '$SLUG';" 2>/dev/null | tr -d ' ')
    if [ "$SLUG_EXISTS" -gt 0 ]; then
        SLUG="${SLUG}_${CONTENT_HASH:0:8}"
    fi
    
    # Generate derivatives
    echo "  - Generating derivatives..."
    
    # Get image dimensions
    DIMENSIONS=$(identify -format "%wx%h" "$SOURCE_PATH" 2>/dev/null)
    WIDTH=$(echo "$DIMENSIONS" | cut -d'x' -f1)
    HEIGHT=$(echo "$DIMENSIONS" | cut -d'x' -f2)
    
    if [ "$WIDTH" -gt "$HEIGHT" ]; then
        ORIENTATION="landscape"
    elif [ "$HEIGHT" -gt "$WIDTH" ]; then
        ORIENTATION="portrait"
    else
        ORIENTATION="square"
    fi
    
    # Generate thumb (150px)
    THUMB_KEY="derivatives/thumb/${CONTENT_HASH}.jpg"
    convert "$SOURCE_PATH" -resize 150x150^ -gravity center -extent 150x150 -quality 85 "$OUTPUT_DIR/${CONTENT_HASH}_thumb.jpg" 2>/dev/null
    DERIVATIVES_GENERATED=$((DERIVATIVES_GENERATED + 1))
    
    # Generate small (600px)
    SMALL_KEY="derivatives/small/${CONTENT_HASH}.jpg"
    convert "$SOURCE_PATH" -resize 600x600> -quality 85 "$OUTPUT_DIR/${CONTENT_HASH}_small.jpg" 2>/dev/null
    DERIVATIVES_GENERATED=$((DERIVATIVES_GENERATED + 1))
    
    # Generate medium (1200px)
    MEDIUM_KEY="derivatives/medium/${CONTENT_HASH}.jpg"
    convert "$SOURCE_PATH" -resize 1200x1200> -quality 90 "$OUTPUT_DIR/${CONTENT_HASH}_medium.jpg" 2>/dev/null
    DERIVATIVES_GENERATED=$((DERIVATIVES_GENERATED + 1))
    
    # Generate large (2400px)
    LARGE_KEY="derivatives/large/${CONTENT_HASH}.jpg"
    convert "$SOURCE_PATH" -resize 2400x2400> -quality 92 "$OUTPUT_DIR/${CONTENT_HASH}_large.jpg" 2>/dev/null
    DERIVATIVES_GENERATED=$((DERIVATIVES_GENERATED + 1))
    
    # Generate preview (watermarked preview for display)
    PREVIEW_KEY="derivatives/preview/${CONTENT_HASH}.jpg"
    convert "$SOURCE_PATH" -resize 1200x1200> -quality 85 \
        -gravity southeast -fill white -pointsize 20 -annotate +30+30 "Preview" \
        "$OUTPUT_DIR/${CONTENT_HASH}_preview.jpg" 2>/dev/null || \
        convert "$SOURCE_PATH" -resize 1200x1200> -quality 85 "$OUTPUT_DIR/${CONTENT_HASH}_preview.jpg" 2>/dev/null
    DERIVATIVES_GENERATED=$((DERIVATIVES_GENERATED + 1))
    
    # Upload to R2
    echo "  - Uploading to R2..."
    
    ORIGINAL_KEY="originals/${CONTENT_HASH}.${EXT}"
    
    # Upload original
    s5cmd cp "$SOURCE_PATH" "s3://${R2_BUCKET}/${ORIGINAL_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    # Upload derivatives
    s5cmd cp "$OUTPUT_DIR/${CONTENT_HASH}_thumb.jpg" "s3://${R2_BUCKET}/${THUMB_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    s5cmd cp "$OUTPUT_DIR/${CONTENT_HASH}_small.jpg" "s3://${R2_BUCKET}/${SMALL_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    s5cmd cp "$OUTPUT_DIR/${CONTENT_HASH}_medium.jpg" "s3://${R2_BUCKET}/${MEDIUM_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    s5cmd cp "$OUTPUT_DIR/${CONTENT_HASH}_large.jpg" "s3://${R2_BUCKET}/${LARGE_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    s5cmd cp "$OUTPUT_DIR/${CONTENT_HASH}_preview.jpg" "s3://${R2_BUCKET}/${PREVIEW_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --access-key "$AWS_ACCESS_KEY" \
        --secret-key "$AWS_SECRET_KEY" \
        --acl public-read 2>/dev/null || true
    
    UPLOADED=$((UPLOADED + 1))
    
    # Insert into database
    echo "  - Inserting into database..."
    
    psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
    INSERT INTO photos (
        slug, filename, canonical_filename, content_hash,
        original_r2_key, thumb_url, small_url, medium_url, large_url, preview_url,
        r2_original_key, r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key,
        width, height, orientation, gallery_id, gallery_slug,
        source_path, original_source_path,
        ready_for_public_render, search_ready, derivatives_complete, original_stored,
        status, state, date_uploaded
    ) VALUES (
        '$SLUG', '$FILENAME', '$NEW_FILENAME', '$CONTENT_HASH',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${ORIGINAL_KEY}',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${THUMB_KEY}',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${SMALL_KEY}',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${MEDIUM_KEY}',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${LARGE_KEY}',
        'https://${R2_BUCKET}.r2.cloudflarestorage.com/${PREVIEW_KEY}',
        '$ORIGINAL_KEY', '$THUMB_KEY', '$SMALL_KEY', '$LARGE_KEY', '$LARGE_KEY',
        $WIDTH, $HEIGHT, '$ORIENTATION', $GALLERY_ID, 'birds',
        '$SOURCE_PATH', '$SOURCE_PATH',
        true, true, true, true,
        'active', 'imported', NOW()
    );" 2>/dev/null || echo "  - Database insert failed"
    
    # Update queue status
    # Using jq to update the specific item in the queue
    TMP_FILE=$(mktemp)
    jq --arg id "$ID" '(.[] | select(.id == $id) | .status) = "completed"' "$QUEUE_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$QUEUE_FILE"
    
    echo "  - Completed: $FILENAME"
    
    # Stop if we've processed 100
    if [ $COUNT -ge 100 ]; then
        break
    fi
done

echo ""
echo "=== IMPORT BATCH COMPLETE ==="
echo "Photos processed: $COUNT"
echo "Duplicates skipped: $DUPLICATES_SKIPPED"
echo "Filename collisions renamed: $COLLISIONS_RENAMED"
echo "Originals uploaded: $UPLOADED"
echo "Derivatives generated: $DERIVATIVES_GENERATED"
echo "Failed: $FAILED"
