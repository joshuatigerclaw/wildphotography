#!/bin/bash
# WildPhotography Import Batch Script - Multi-gallery support with directory deduplication
# PROCESSING ORDER (enforced):
#  1. dedupe directories          ← NEW
#  2. dedupe files by hash
#  3. rename filename collisions
#  4. reuse existing gallery slugs only
#  5. upload originals
#  6. generate all 5 derivatives
#  7. update Neon with canonical R2 keys only
#  8. set readiness flags only when fully complete
#  9. index only search_ready records

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_FILE="${QUEUE_FILE:-/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/batch_clean_import_queue.json}"
QUEUE_ITEMS_FILE="/tmp/pending_items_batch_$$.jsonl"
OUTPUT_DIR="/Users/joshuatenbrink/.openclaw/workspace/wildphotography/storage/derivatives"
R2_BUCKET="wildphoto-storage"
AWS_ACCESS_KEY="b821d56d29d9a2c716f783fc481e2f75"
AWS_SECRET_KEY="3af780dfe8dbb6d48b792e4bf8ba5836ae659c89192645a7ae971300464aa48f"
R2_ENDPOINT="https://3ec62f93675c404fe4a9a4949e38e5e5.r2.cloudflarestorage.com"
DB_HOST="ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech"
DB_NAME="wildphotography"
DB_USER="neondb_owner"
DB_PASS="npg_BvF2JsQ8drba"
RUN_TS=$(date -u +%Y%m%dT%H%M%S)

export PGPASSWORD="$DB_PASS"

mkdir -p "$OUTPUT_DIR"

# ── Directory Identity Registry ──────────────────────────────────────────────────
declare -A DIR_CANONICAL_PATH   # canonical_path → gallery_folder (original)
declare -A DIR_NORMALIZED_NAME  # normalized_name → gallery_folder (original)
declare -A DIR_GALLERY_SLUG     # normalized_slug → canonical_gallery_folder
declare -A DIR_FLAGS            # normalized_slug → flag (duplicate|conflict|manual_review)

# ── Result Counters ─────────────────────────────────────────────────────────────
DIRS_DEDUPED=0
DIRS_PROCESSED=0
DIRS_DUPLICATE_SKIPPED=0
DIRS_CONFLICT_AVOIDED=0
DIRS_MANUAL_REVIEW=0
PHOTOS_PROCESSED=0
PHOTOS_DUPLICATE_HASH=0
PHOTOS_PERCEPTUAL_DUPLICATE=0
PHOTOS_VARIANT_FLAGGED=0
PHOTOS_FILENAME_COLLISION=0
PHOTOS_ORIGINALS_UPLOADED=0
PHOTOS_DERIVATIVES_GENERATED=0
PHOTOS_FAILED=0
SPELLING_CORRECTIONS=0
SPELLING_EXAMPLES=()
NORMALIZED_LOCATIONS=0
NORMALIZED_SPECIES=0
NORMALIZED_KEYWORDS=0
AMBIGUOUS_VARIANTS=0
FAILED_PATHS=()

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0: Normalize a directory identity
# Returns: normalized_slug|canonical_path|normalized_name
# ─────────────────────────────────────────────────────────────────────────────
normalize_dir_identity() {
    local dir_path="$1"
    # Resolve to absolute path and resolve symlinks / ".." / etc.
    local canonical
    canonical=$(cd "$(dirname "$dir_path")" 2>/dev/null && realpath "$(basename "$dir_path")" 2>/dev/null) \
        || canonical=$(python3 -c "import os; print(os.path.realpath(os.path.abspath('$dir_path')))")

    # Normalize: lowercase, collapse spaces/hyphens/underscores to single hyphen, strip leading/trailing
    local normalized
    normalized=$(echo "$canonical" | python3 -c "
import sys
p = sys.stdin.read().strip()
# Normalize: lower, collapse runs of [-_ ] to single hyphen
import re
p = p.lower()
p = re.sub(r'[\-\_\s]+', '-', p)
p = re.sub(r'[^a-z0-9\-]', '', p)
p = re.sub(r'^-+|-+$', '', p)
print(p)
")

    # Normalized folder name (last component only)
    local normalized_name
    normalized_name=$(basename "$normalized")

    # Derive gallery slug from normalized path
    local gallery_slug
    gallery_slug=$(echo "$normalized_name" | python3 -c "
import sys, re
n = sys.stdin.read().strip()
# Collapse runs of separators
n = re.sub(r'[\-\_]+', '-', n)
n = re.sub(r'^-+|-+$', '', n)
print(n)
")

    echo "${gallery_slug}|${canonical}|${normalized_name}"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Load queue and deduplicate directories BEFORE any processing
# Returns: filtered queue JSON to $QUEUE_ITEMS_FILE
# ─────────────────────────────────────────────────────────────────────────────
dedupe_directories() {
    echo "=== STEP 1: Directory deduplication ==="

    local tmp_items="/tmp/all_queue_items_$$.jsonl"
    local deduped_items="/tmp/deduped_queue_items_$$.jsonl"

    # Extract all pending items (keep JSON objects as single lines)
    jq -c '.[] | select(.status == "pending") | select(.attempt_count < 3)' "$QUEUE_FILE" 2>/dev/null > "$tmp_items" || {
        echo "ERROR: Could not read queue file $QUEUE_FILE"
        return 1
    }

    local total_items
    total_items=$(wc -l < "$tmp_items" 2>/dev/null || echo 0)
    echo "  Total queue items loaded: $total_items"

    # Process each item and build a directory → gallery_folder map
    local dir_map_file="/tmp/dir_map_$$.json"
    : > "$dir_map_file"

    while IFS= read -r item; do
        local gallery_folder
        gallery_folder=$(echo "$item" | jq -r '.gallery_folder // empty')

        # Build full source path
        local source_path item_filename
        source_path=$(echo "$item" | jq -r '.source_path // empty')
        item_filename=$(echo "$item" | jq -r '.filename // empty')

        # Determine the directory containing the source file
        local dir_path="${source_path%/*}"  # Remove filename to get directory

        # Normalize this directory
        local result
        result=$(normalize_dir_identity "$dir_path")
        local gallery_slug canonical_path normalized_name
        gallery_slug=$(echo "$result" | cut -d'|' -f1)
        canonical_path=$(echo "$result" | cut -d'|' -f2)
        normalized_name=$(echo "$result" | cut -d'|' -f3)

        # Append to dir map (keyed by original gallery_folder)
        # Store: canonical_path, normalized_name, gallery_slug, original_gallery_folder, item_json
        echo "{\"canonical_path\":\"$canonical_path\",\"normalized_name\":\"$normalized_name\",\"gallery_slug\":\"$gallery_slug\",\"original_gallery_folder\":\"$gallery_folder\",\"item\":$(echo "$item" | jq -c .)}" >> "$dir_map_file"

    done < "$tmp_items"

    # Now analyze directory registry — detect duplicates and conflicts
    local unique_dirs_file="/tmp/unique_dirs_$$.json"
    : > "$unique_dirs_file"

    # Build registry: key by canonical_path, normalized_name, gallery_slug
    local registry_by_canonical="/tmp/reg_canonical_$$.json"
    local registry_by_normname="/tmp/reg_normname_$$.json"
    local registry_by_slug="/tmp/reg_slug_$$.json"
    : > "$registry_by_canonical" > "$registry_by_normname" > "$registry_by_slug"

    while IFS= read -r entry; do
        local canonical_path normalized_name gallery_slug original_gallery_folder
        canonical_path=$(echo "$entry" | jq -r '.canonical_path')
        normalized_name=$(echo "$entry" | jq -r '.normalized_name')
        gallery_slug=$(echo "$entry" | jq -r '.gallery_slug')
        original_gallery_folder=$(echo "$entry" | jq -r '.original_gallery_folder')

        # Skip empty
        [[ -z "$canonical_path" || "$canonical_path" == "None" ]] && continue

        # Check canonical path already registered
        if grep -q "\"${canonical_path}\"" "$registry_by_canonical" 2>/dev/null; then
            : # already registered
        else
            echo "{\"canonical_path\":\"$canonical_path\",\"normalized_name\":\"$normalized_name\",\"gallery_slug\":\"$gallery_slug\",\"original_gallery_folder\":\"$original_gallery_folder\"}" >> "$registry_by_canonical"
        fi

        # Check normalized name already registered
        if grep -q "\"${normalized_name}\"" "$registry_by_normname" 2>/dev/null; then
            : # already registered
        else
            echo "{\"canonical_path\":\"$canonical_path\",\"normalized_name\":\"$normalized_name\",\"gallery_slug\":\"$gallery_slug\",\"original_gallery_folder\":\"$original_gallery_folder\"}" >> "$registry_by_normname"
        fi

        # Check slug — if conflict, flag for manual review
        if grep -q "\"${gallery_slug}\"" "$registry_by_slug" 2>/dev/null; then
            # Check if it's the SAME canonical path (ok) or different (conflict)
            local existing_entry
            existing_entry=$(grep "\"${gallery_slug}\"" "$registry_by_slug" | head -1)
            local existing_canonical
            existing_canonical=$(echo "$existing_entry" | jq -r '.canonical_path')
            if [[ "$canonical_path" != "$existing_canonical" ]]; then
                # Different directories → same slug → manual review
                echo "{\"canonical_path\":\"$canonical_path\",\"normalized_name\":\"$normalized_name\",\"gallery_slug\":\"$gallery_slug\",\"original_gallery_folder\":\"$original_gallery_folder\",\"flag\":\"manual_review\"}" >> "$registry_by_slug"
            fi
        else
            echo "{\"canonical_path\":\"$canonical_path\",\"normalized_name\":\"$normalized_name\",\"gallery_slug\":\"$gallery_slug\",\"original_gallery_folder\":\"$original_gallery_folder\"}" >> "$registry_by_slug"
        fi

    done < "$dir_map_file"

    # Build final deduplicated item list
    local seen_canonical="/tmp/seen_canonical_$$.txt"
    local seen_normname="/tmp/seen_normname_$$.txt"
    : > "$seen_canonical" > "$seen_normname"
    : > "$deduped_items"

    while IFS= read -r entry; do
        local canonical_path normalized_name gallery_slug original_gallery_folder item_json flag
        canonical_path=$(echo "$entry" | jq -r '.canonical_path')
        normalized_name=$(echo "$entry" | jq -r '.normalized_name')
        gallery_slug=$(echo "$entry" | jq -r '.gallery_slug')
        original_gallery_folder=$(echo "$entry" | jq -r '.original_gallery_folder')
        flag=$(echo "$entry" | jq -r '.flag // "ok"')
        item_json=$(echo "$entry" | jq -c '.item')

        [[ -z "$canonical_path" || "$canonical_path" == "None" ]] && continue

        case "$flag" in
            manual_review)
                echo "  MANUAL REVIEW [${gallery_slug}]: $canonical_path"
                echo "{\"gallery_folder\":\"$original_gallery_folder\",\"canonical_path\":\"$canonical_path\",\"slug\":\"$gallery_slug\",\"status\":\"manual_review\",\"item\":$item_json}" >> "$deduped_items"
                DIRS_MANUAL_REVIEW=$((DIRS_MANUAL_REVIEW + 1))
                ;;
            *)
                # Check if canonical path already seen
                if grep -Fxq "$canonical_path" "$seen_canonical" 2>/dev/null; then
                    echo "  DUPLICATE DIR SKIPPED: $canonical_path (canonical path match)"
                    DIRS_DUPLICATE_SKIPPED=$((DIRS_DUPLICATE_SKIPPED + 1))
                    continue
                fi
                # Check if normalized name already seen
                if grep -Fxq "$normalized_name" "$seen_normname" 2>/dev/null; then
                    echo "  DUPLICATE DIR SKIPPED: $canonical_path (normalized name match: $normalized_name)"
                    DIRS_DUPLICATE_SKIPPED=$((DIRS_DUPLICATE_SKIPPED + 1))
                    continue
                fi
                # OK — register and include
                echo "$canonical_path" >> "$seen_canonical"
                echo "$normalized_name" >> "$seen_normname"
                echo "$item_json" >> "$deduped_items"
                DIRS_PROCESSED=$((DIRS_PROCESSED + 1))
                ;;
        esac

    done < "$dir_map_file"

    # Report
    local deduped_count
    deduped_count=$(wc -l < "$deduped_items" 2>/dev/null || echo 0)
    echo "  Directories processed (unique):   $DIRS_PROCESSED"
    echo "  Duplicate directories skipped:    $DIRS_DUPLICATE_SKIPPED"
    echo "  Gallery slug conflicts avoided:   $DIRS_CONFLICT_AVOIDED"
    echo "  Directories flagged manual review: $DIRS_MANUAL_REVIEW"
    echo "  Items after dedup:               $deduped_count"

    # Move deduped items to working file
    cp "$deduped_items" "$QUEUE_ITEMS_FILE"

    # Cleanup
    rm -f "$tmp_items" "$deduped_items" "$dir_map_file" "$unique_dirs_file"
    rm -f "$registry_by_canonical" "$registry_by_normname" "$registry_by_slug"
    rm -f "$seen_canonical" "$seen_normname"

    echo ""
}

# ── Gallery slug lookup (from DB) ──────────────────────────────────────────────
get_gallery_id_and_slug() {
    local gallery_folder="$1"
    # Try exact match first
    local result
    result=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT id, slug FROM galleries WHERE slug = LOWER(REPLACE('$gallery_folder', ' ', '-')) LIMIT 1;" 2>/dev/null | tr -d ' ' | tr -d '|' || echo "")
    if [[ -n "$result" && "$result" != "()" ]]; then
        echo "$result"
        return
    fi
    # Try by folder name (last component)
    local folder_name
    folder_name=$(basename "$gallery_folder")
    result=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT id, slug FROM galleries WHERE LOWER(REPLACE(name, ' ', '-')) = LOWER(REPLACE('$folder_name', ' ', '-')) LIMIT 1;" 2>/dev/null | tr -d ' ' | tr -d '|' || echo "")
    echo "$result"
}

# ── Process photos (steps 2-8) ───────────────────────────────────────────────────
process_photos() {
    local batch_limit="${BATCH_LIMIT:-100}"

    echo "=== STEP 2-8: Photo processing ==="

    local count=0
    local batch_start_ts
    batch_start_ts=$(date -u +%Y%m%dT%H%M%S)

    # ── Step 2: Multi-layer duplicate detection + spelling normalization ──
    echo "  Running multi-layer dedup and spelling normalization..."
    local dedup_queue_file="/tmp/dedup_queue_$$.json"
    cp "$QUEUE_ITEMS_FILE" "$dedup_queue_file" 2>/dev/null || cp /dev/null "$dedup_queue_file"

    local dedup_output="/tmp/dedup_results_$$.json"
    python3 "${SCRIPT_DIR}/import_dedup_normalize.py" "$dedup_queue_file" > "$dedup_output" 2>&1 || true

    # Load decisions into associative array (bash workaround)
    # Read skip decisions: action=skip_duplicate → increment skip counters
    local skipped_exact=0 skipped_perceptual=0 flagged_variant=0
    local spelling_corrections=0 spelling_examples=()

    if [[ -f "$dedup_output" ]]; then
        local report_section
        report_section=$(python3 -c "
import json, sys
try:
    with open('$dedup_output') as f:
        d = json.load(f)
    r = d.get('report', {})
    print('exact_hash', r.get('exact_hash_duplicates_skipped', 0))
    print('perceptual', r.get('perceptual_duplicates_skipped', 0))
    print('variants', r.get('likely_variants_flagged', 0))
    print('spelling', r.get('spelling_corrections_applied', 0))
    examples = r.get('spelling_corrections_examples', [])
    for ex in examples[:5]:
        print('SPELLING:', ex)
    # Write decisions to file
    with open('/tmp/dedup_decisions.json', 'w') as f2:
        json.dump(d.get('decisions', {}), f2)
except Exception as e:
    print('ERROR:', e, file=sys.stderr)
    print('no_decisions')
" 2>/dev/null)

        while IFS= read -r line; do
            case "$line" in
                exact_hash*) skipped_exact=$(echo "$line" | awk '{print $2}') ;;
                perceptual*) skipped_perceptual=$(echo "$line" | awk '{print $2}') ;;
                variants*) flagged_variant=$(echo "$line" | awk '{print $2}') ;;
                spelling*) spelling_corrections=$(echo "$line" | awk '{print $2}') ;;
                SPELLING:*) spelling_examples+=("${line#SPELLING: }") ;;
            esac
        done <<< "$report_section"

        PHOTOS_DUPLICATE_HASH=$((skipped_exact + skipped_perceptual))
        PHOTOS_VARIANT_FLAGGED=${flagged_variant:-0}
        SPELLING_CORRECTIONS=${spelling_corrections:-0}
        echo "  Multi-layer dedup: ${skipped_exact} exact hash, ${skipped_perceptual} perceptual, ${flagged_variant:-0} variants"
        echo "  Spelling normalization: ${spelling_corrections:-0} corrections applied"
        for ex in "${spelling_examples[@]:-}"; do
            echo "    - $ex"
        done
    fi

    # Load skip decisions into a lookup file for the photo loop
    local skip_file="/tmp/dedup_skip_ids_$$.txt"
    : > "$skip_file"
    if [[ -f "/tmp/dedup_decisions.json" ]]; then
        python3 -c "
import json
try:
    with open('/tmp/dedup_decisions.json') as f:
        d = json.load(f)
    for item_id, dec in d.items():
        action = dec.get('action', '')
        if 'skip' in action or 'variant' in action:
            print(item_id, dec.get('reason', ''), dec.get('canonical_id', ''), sep='|')
except: pass
" > "$skip_file" 2>/dev/null || true
    fi

    # Also pre-fetch exact hash set for fast lookup in loop
    local hash_batch_file="/tmp/hash_batch_$$.txt"
    jq -r '.content_hash' "$QUEUE_ITEMS_FILE" 2>/dev/null > "$hash_batch_file" || true
    local hash_count
    hash_count=$(wc -l < "$hash_batch_file" 2>/dev/null || echo 0)
    if [[ "$hash_count" -gt 0 ]]; then
        local hashes_list
        hashes_list=$(paste -sd, "$hash_batch_file" 2>/dev/null | tr ',' "','")
        EXISTING_HASHES=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT content_hash FROM photos WHERE content_hash IN ('${hashes_list}');" 2>/dev/null \
            | tr -d ' ' | grep -v '^$' || echo "")
        echo "  Pre-fetched ${#EXISTING_HASHES} existing hashes from DB"
    fi
    rm -f "$hash_batch_file" "$dedup_queue_file"

    while IFS= read -r item && [[ $count -lt $batch_limit ]]; do
        count=$((count + 1))

        local id source_path filename content_hash gallery_folder size
        id=$(echo "$item" | jq -r '.id')
        source_path=$(echo "$item" | jq -r '.source_path')
        filename=$(echo "$item" | jq -r '.filename')
        content_hash=$(echo "$item" | jq -r '.content_hash')
        gallery_folder=$(echo "$item" | jq -r '.gallery_folder')
        size=$(echo "$item" | jq -r '.size')

        # ── Step 2: Hash duplicate detection ─────────────────────────────────
        if echo "$EXISTING_HASHES" | grep -qF "$content_hash" 2>/dev/null; then
            echo "  [$count] DUPLICATE HASH: $filename"
            PHOTOS_DUPLICATE_HASH=$((PHOTOS_DUPLICATE_HASH + 1))
            jq --arg id "$id" --arg reason "hash_duplicate" \
                '(.[] | select(.id == $id) | .status) = "skipped" | (.[] | select(.id == $id) | .skip_reason) = $reason' \
                "$QUEUE_FILE" > /tmp/queue_upd_$$.json && mv /tmp/queue_upd_$$.json "$QUEUE_FILE"
            continue
        fi

        # ── Resolve gallery_id and slug (step 4) ─────────────────────────────
        local gallery_result gallery_id gallery_slug
        gallery_result=$(get_gallery_id_and_slug "$gallery_folder")
        gallery_id=$(echo "$gallery_result" | cut -d'|' -f1)
        gallery_slug=$(echo "$gallery_result" | cut -d'|' -f2)

        if [[ -z "$gallery_id" || "$gallery_id" == "()" ]]; then
            echo "  [$count] NO GALLERY: $gallery_folder — flag for manual review"
            PHOTOS_FAILED=$((PHOTOS_FAILED + 1))
            FAILED_PATHS+=("[no_gallery]$source_path")
            jq --arg id "$id" --arg reason "gallery_not_found" \
                '(.[] | select(.id == $id) | .status) = "manual_review" | (.[] | select(.id == $id) | .skip_reason) = $reason' \
                "$QUEUE_FILE" > /tmp/queue_upd_$$.json && mv /tmp/queue_upd_$$.json "$QUEUE_FILE"
            continue
        fi

        echo "  [$count] Processing: $filename (Gallery: $gallery_slug)"

        # ── Step 3: Same-filename/different-content collision ───────────────
        local new_filename="$filename"
        local collision_count
        collision_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM photos WHERE filename = '$filename' AND gallery_id = $gallery_id;" 2>/dev/null | tr -d ' ' || echo "0")

        if [[ "$collision_count" -gt 0 ]]; then
            local base ext
            base=$(echo "$filename" | sed 's/\.[^.]*$//')
            ext=$(echo "$filename" | sed 's/.*\.//')
            new_filename="${base}_${content_hash:0:8}.${ext}"
            echo "    Filename collision → renamed to $new_filename"
            PHOTOS_FILENAME_COLLISION=$((PHOTOS_FILENAME_COLLISION + 1))
        fi

        # ── Generate slug ───────────────────────────────────────────────────
        local slug
        slug=$(echo "$new_filename" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9\-_')
        local slug_exists
        slug_exists=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
            "SELECT COUNT(*) FROM photos WHERE slug = '$slug';" 2>/dev/null | tr -d ' ' || echo "0")
        if [[ "$slug_exists" -gt 0 ]]; then
            slug="${slug}_${content_hash:0:8}"
        fi

        # ── Get image dimensions ───────────────────────────────────────────
        local dimensions width height orientation
        dimensions=$(identify -format "%wx%h" "$source_path" 2>/dev/null || echo "")
        if [[ -z "$dimensions" ]]; then
            echo "    ERROR: Could not get image dimensions"
            PHOTOS_FAILED=$((PHOTOS_FAILED + 1))
            FAILED_PATHS+=("[no_dims]$source_path")
            continue
        fi
        width=$(echo "$dimensions" | cut -d'x' -f1)
        height=$(echo "$dimensions" | cut -d'x' -f2)
        if   [[ "$width" -gt "$height" ]]; then orientation="landscape"
        elif [[ "$height" -gt "$width" ]]; then orientation="portrait"
        else orientation="square"; fi

        local ext
        ext=$(echo "$filename" | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]')

        # ── Step 5: Upload original to R2 ─────────────────────────────────
        local original_key="originals/${gallery_slug}/${content_hash}.${ext}"
        echo "    Uploading original to R2..."
        if s5cmd cp "$source_path" "s3://${R2_BUCKET}/${original_key}" \
            --endpoint-url "$R2_ENDPOINT" \
            --access-key "$AWS_ACCESS_KEY" \
            --secret-key "$AWS_SECRET_KEY" \
            --acl public-read > /dev/null 2>&1; then
            PHOTOS_ORIGINALS_UPLOADED=$((PHOTOS_ORIGINALS_UPLOADED + 1))
        else
            echo "    ERROR: R2 upload failed"
            PHOTOS_FAILED=$((PHOTOS_FAILED + 1))
            FAILED_PATHS+=("[upload_fail]$source_path")
            continue
        fi

        # ── Step 6: Generate all 5 derivatives ─────────────────────────────
        echo "    Generating derivatives..."
        local deriv_suffixes=(thumb small medium large preview)
        local deriv_sizes=(150 600 1200 2400 1200)
        local deriv_count=0

        for i in "${!deriv_suffixes[@]}"; do
            local suf="${deriv_suffixes[$i]}"
            local dim="${deriv_sizes[$i]}"
            local deriv_path="$OUTPUT_DIR/${content_hash}_${suf}.jpg"
            if convert "$source_path" -resize "${dim}x${dim}>" -quality 85 "$deriv_path" 2>/dev/null; then
                local deriv_key="derivatives/${gallery_slug}/${content_hash}_${suf}.jpg"
                if s5cmd cp "$deriv_path" "s3://${R2_BUCKET}/${deriv_key}" \
                    --endpoint-url "$R2_ENDPOINT" \
                    --access-key "$AWS_ACCESS_KEY" \
                    --secret-key "$AWS_SECRET_KEY" \
                    --acl public-read > /dev/null 2>&1; then
                    deriv_count=$((deriv_count + 1))
                fi
                rm -f "$deriv_path"
            fi
        done
        PHOTOS_DERIVATIVES_GENERATED=$((PHOTOS_DERIVATIVES_GENERATED + deriv_count))

        # ── Step 7: Insert to DB with canonical R2 keys ────────────────────
        echo "    Inserting to DB..."
        local thumb_key="derivatives/${gallery_slug}/${content_hash}_thumb.jpg"
        local small_key="derivatives/${gallery_slug}/${content_hash}_small.jpg"
        local medium_key="derivatives/${gallery_slug}/${content_hash}_medium.jpg"
        local large_key="derivatives/${gallery_slug}/${content_hash}_large.jpg"
        local preview_key="derivatives/${gallery_slug}/${content_hash}_preview.jpg"

        local insert_result
        insert_result=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "
        INSERT INTO photos (
            slug, filename, canonical_filename, content_hash,
            original_r2_key,
            r2_original_key, r2_thumb_key, r2_web_small_key, r2_web_large_key, r2_print_key,
            thumb_url, small_url, medium_url, large_url, preview_url,
            width, height, orientation, gallery_id, gallery_slug,
            source_path, original_source_path,
            derivatives_complete, ready_for_public_render, original_stored,
            status, state, date_uploaded
        ) VALUES (
            '$slug', '$filename', '$new_filename', '$content_hash',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${original_key}',
            '$original_key', '$thumb_key', '$small_key', '$large_key', '$large_key',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${thumb_key}',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${small_key}',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${medium_key}',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${large_key}',
            'https://${R2_BUCKET}.r2.cloudflarestorage.com/${preview_key}',
            $width, $height, '$orientation', $gallery_id, '$gallery_slug',
            '$source_path', '$source_path',
            false, false, true,
            'active', 'imported', NOW()
        ) RETURNING id;" 2>&1 | tail -1 || echo "INSERT_FAILED")

        if echo "$insert_result" | grep -qE '^[0-9]+$'; then
            PHOTOS_PROCESSED=$((PHOTOS_PROCESSED + 1))
            echo "    ✓ Photo $slug inserted (ID: $insert_result)"
        else
            echo "    ERROR: DB insert failed: $insert_result"
            PHOTOS_FAILED=$((PHOTOS_FAILED + 1))
            FAILED_PATHS+=("[db_fail]$source_path")
            continue
        fi

        # ── Mark completed in queue ─────────────────────────────────────────
        jq --arg id "$id" --arg ts "$batch_start_ts" \
            '(.[] | select(.id == $id) | .status) = "completed" | (.[] | select(.id == $id) | .completed_at) = $ts' \
            "$QUEUE_FILE" > /tmp/queue_upd_$$.json && mv /tmp/queue_upd_$$.json "$QUEUE_FILE"

    done < "$QUEUE_ITEMS_FILE"

    echo ""
}

# ── Step 8: Set readiness flags for complete records ─────────────────────────
set_readiness_flags() {
    echo "=== STEP 8: Setting readiness flags ==="
    local ready_count
    ready_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        UPDATE photos
        SET derivatives_complete = true,
            ready_for_public_render = true
        WHERE status = 'active'
          AND state = 'imported'
          AND derivatives_complete = false
          AND original_stored = true
          AND r2_thumb_key IS NOT NULL
          AND r2_thumb_key != ''
        RETURNING id;" 2>/dev/null | grep -c '^[0-9]' || echo "0")
    echo "  Flags updated: $ready_count photos"
    echo ""
}

# ── Step 9: Index search_ready records (no-op here — handled by indexer cron) ──
# ── Final report ────────────────────────────────────────────────────────────────
print_report() {
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "  IMPORT BATCH REPORT — $RUN_TS"
    echo "══════════════════════════════════════════════════════════════"
    echo ""
    echo "  DIRECTORY DEDUPLICATION:"
    echo "    directories_processed:             $DIRS_PROCESSED"
    echo "    duplicate_directories_skipped:     $DIRS_DUPLICATE_SKIPPED"
    echo "    gallery_slug_conflicts_avoided:    $DIRS_CONFLICT_AVOIDED"
    echo "    directories_flagged_manual_review:  $DIRS_MANUAL_REVIEW"
    echo ""
    echo "  DUPLICATE DETECTION:"
    echo "    exact_hash_duplicates_skipped:    $PHOTOS_DUPLICATE_HASH"
    echo "    perceptual_duplicates_skipped:    $PHOTOS_PERCEPTUAL_DUPLICATE"
    echo "    likely_variants_flagged:           $PHOTOS_VARIANT_FLAGGED"
    echo "    canonical_records_reused:          $PHOTOS_ORIGINALS_UPLOADED"
    echo ""
    echo "  SPELLING / NORMALIZATION:"
    echo "    spelling_corrections_applied:      ${SPELLING_CORRECTIONS:-0}"
    echo "    normalized_locations_count:        ${NORMALIZED_LOCATIONS:-0}"
    echo "    normalized_species_count:         ${NORMALIZED_SPECIES:-0}"
    echo "    normalized_keywords_count:          ${NORMALIZED_KEYWORDS:-0}"
    echo "    ambiguous_text_variants_flagged:   ${AMBIGUOUS_VARIANTS:-0}"
    if [[ \${#SPELLING_EXAMPLES[@]} -gt 0 ]]; then
        echo "    Sample corrections:"
        for ex in "\${SPELLING_EXAMPLES[@]}"; do
            echo "      - $ex"
        done
    fi
    echo ""
    echo "  FILE PROCESSING:"
    echo "    photos_processed:                   $PHOTOS_PROCESSED"
    echo "    duplicates_skipped_by_hash:       $PHOTOS_DUPLICATE_HASH"
    echo "    filename_collisions_renamed:       $PHOTOS_FILENAME_COLLISION"
    echo "    originals_uploaded:                $PHOTOS_ORIGINALS_UPLOADED"
    echo "    derivatives_generated:             $PHOTOS_DERIVATIVES_GENERATED"
    echo "    failed_files_count:                $PHOTOS_FAILED"
    echo ""
    if [[ ${#FAILED_PATHS[@]} -gt 0 ]]; then
        echo "  FAILED FILE PATHS:"
        for p in "${FAILED_PATHS[@]}"; do
            echo "    $p"
        done
    else
        echo "  FAILED FILE PATHS: none"
    fi
    echo ""

    # Sample gallery URL
    local sample_gallery_slug
    sample_gallery_slug=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT slug FROM galleries ORDER BY id DESC LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "unknown")
    echo "  SAMPLE GALLERY URL: https://wildphotography.com/gallery/${sample_gallery_slug}"
    echo ""

    # Sample photo URL
    local sample_photo_slug
    sample_photo_slug=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT slug FROM photos ORDER BY id DESC LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "unknown")
    echo "  SAMPLE PHOTO URL: https://wildphotography.com/photo/${sample_photo_slug}"
    echo ""

    # DB readiness counts
    local ready_count search_ready_count
    ready_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM photos WHERE ready_for_public_render = true;" 2>/dev/null | tr -d ' ' || echo "?")
    search_ready_count=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM photos WHERE search_ready = true;" 2>/dev/null | tr -d ' ' || echo "?")
    echo "  ready_for_public_render count:  $ready_count"
    echo "  search_ready count:             $search_ready_count"
    echo ""
    echo "══════════════════════════════════════════════════════════════"

    # Write report to file
    local report_file="/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/batch_import_${RUN_TS}_report.json"
    cat > "$report_file" << REPORT
{
  "run_at": "$RUN_TS",
  "queue_file": "$QUEUE_FILE",
  "directories_processed": $DIRS_PROCESSED,
  "duplicate_directories_skipped": $DIRS_DUPLICATE_SKIPPED,
  "gallery_slug_conflicts_avoided": $DIRS_CONFLICT_AVOIDED,
  "directories_flagged_manual_review": $DIRS_MANUAL_REVIEW,
  "exact_hash_duplicates_skipped": $PHOTOS_DUPLICATE_HASH,
  "perceptual_duplicates_skipped": $PHOTOS_PERCEPTUAL_DUPLICATE,
  "likely_variants_flagged": $PHOTOS_VARIANT_FLAGGED,
  "canonical_records_reused": $PHOTOS_ORIGINALS_UPLOADED,
  "spelling_corrections_applied": ${SPELLING_CORRECTIONS:-0},
  "normalized_locations_count": ${NORMALIZED_LOCATIONS:-0},
  "normalized_species_count": ${NORMALIZED_SPECIES:-0},
  "normalized_keywords_count": ${NORMALIZED_KEYWORDS:-0},
  "ambiguous_text_variants_flagged": ${AMBIGUOUS_VARIANTS:-0},
  "photos_processed": $PHOTOS_PROCESSED,
  "duplicates_skipped_by_hash": $PHOTOS_DUPLICATE_HASH,
  "filename_collisions_renamed": $PHOTOS_FILENAME_COLLISION,
  "originals_uploaded": $PHOTOS_ORIGINALS_UPLOADED,
  "derivatives_generated": $PHOTOS_DERIVATIVES_GENERATED,
  "ready_for_public_render_count": $ready_count,
  "search_ready_count": $search_ready_count,
  "failed_files_count": $PHOTOS_FAILED,
  "failed_file_paths": $(printf '%s\n' "${FAILED_PATHS[@]}" | jq -R . | jq -s .)
}
REPORT
    echo "  Report saved: $report_file"
}

# ── Main ────────────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "══════════════════════════════════════════════════════════════"
    echo "  WildPhotography Import Batch — $RUN_TS"
    echo "  Queue: $QUEUE_FILE"
    echo "══════════════════════════════════════════════════════════════"
    echo ""

    # Step 1: Directory deduplication (before ANY file processing)
    dedupe_directories

    # Steps 2-8: Process photos
    process_photos

    # Step 8: Set readiness flags
    set_readiness_flags

    # Step 9: Indexing is handled by wild_typesense_reconcile_no_llm cron

    # Report
    print_report

    # Cleanup
    rm -f "$QUEUE_ITEMS_FILE"
}

# Allow running individual steps
case "${1:-main}" in
    dedupe)   dedupe_directories ;;
    process)  process_photos ;;
    flags)    set_readiness_flags ;;
    report)   print_report ;;
    *)        main ;;
esac
