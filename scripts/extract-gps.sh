#!/bin/bash
# GPS Extraction - run via cron or manually
# Usage: ./extract-gps.sh [batch_size] [max_batches]

BATCH_SIZE=${1:-50}
MAX_BATCHES=${2:-100}

cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography

echo "=== GPS Extraction Run ==="
echo "Batch size: $BATCH_SIZE, Max batches: $MAX_BATCHES"
echo "Started: $(date)"

TOTAL_SUCCESS=0
TOTAL_NO_GPS=0
TOTAL_FAILED=0

for ((i=1; i<=MAX_BATCHES; i++)); do
    echo ""
    echo "--- Batch $i of $MAX_BATCHES ---"
    
    RESULT=$(node scripts/extract-gps-batch.js $BATCH_SIZE 2>&1)
    
    echo "$RESULT"
    
    # Parse results (BSD/macOS compatible grep)
    SUCCESS=$(echo "$RESULT" | grep 'success:' | grep -oE '[0-9]+')
    NO_GPS=$(echo "$RESULT" | grep 'no GPS:' | grep -oE '[0-9]+')
    FAILED=$(echo "$RESULT" | grep 'failed:' | grep -oE '[0-9]+')
    
    TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCESS))
    TOTAL_NO_GPS=$((TOTAL_NO_GPS + NO_GPS))
    TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
    
    # Check if we have more photos to process (use same COALESCE logic as batch query)
    REMAINING=$(PGPASSWORD='npg_BvF2JsQ8drba' psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c "SELECT COUNT(*) FROM photos WHERE latitude IS NULL AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) IS NOT NULL AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) != '' AND COALESCE(NULLIF(r2_original_key, ''), NULLIF(original_r2_key, '')) != ' ' AND (gps_source IS NULL OR gps_source = '' OR gps_source = 'exif');" 2>/dev/null | tr -d ' ')
    
    echo "Remaining photos: $REMAINING"
    echo "Running totals: success=$TOTAL_SUCCESS no_gps=$TOTAL_NO_GPS failed=$TOTAL_FAILED"
    
    if [ -z "$REMAINING" ] || [ "$REMAINING" -eq 0 ]; then
        echo "No more photos to process."
        break
    fi
    
    # Small delay between batches
    sleep 2
done

echo ""
echo "=== COMPLETE ==="
echo "Final totals: success=$TOTAL_SUCCESS no_gps=$TOTAL_NO_GPS failed=$TOTAL_FAILED"
echo "Ended: $(date)"
