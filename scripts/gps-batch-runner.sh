#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography
TOTAL_SUCCESS=0
TOTAL_NO_GPS=0
TOTAL_FAILED=0
for i in $(seq 1 20); do
  echo "--- Batch $i of 20 ---"
  RESULT=$(node scripts/extract-gps-batch.js 50 2>&1)
  echo "$RESULT"
  SUCCESS=$(echo "$RESULT" | grep '^Results:' | sed 's/Results: //' | awk -F'[ ,]+' '{print $1}')
  NO_GPS=$(echo "$RESULT" | grep '^Results:' | sed 's/Results: //' | awk -F'[ ,]+' '{print $2}')
  FAILED=$(echo "$RESULT" | grep '^Results:' | sed 's/Results: //' | awk -F'[ ,]+' '{print $3}')
  [ -z "$SUCCESS" ] && SUCCESS=0
  [ -z "$NO_GPS" ] && NO_GPS=0
  [ -z "$FAILED" ] && FAILED=0
  TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCESS))
  TOTAL_NO_GPS=$((TOTAL_NO_GPS + NO_GPS))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  echo "Running totals: success=$TOTAL_SUCCESS no_gps=$TOTAL_NO_GPS failed=$TOTAL_FAILED"
  # Check remaining (skip photos already checked with no GPS)
  REMAINING=$(PGPASSWORD='npg_BvF2JsQ8drba' psql -h ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech -U neondb_owner -d wildphotography -t -c "SELECT COUNT(*) FROM photos WHERE latitude IS NULL AND original_r2_key IS NOT NULL AND original_r2_key != '' AND original_r2_key != ' ' AND (gps_source IS NULL OR gps_source = '' OR gps_source = 'exif');" 2>/dev/null | tr -d ' ')
  echo "Remaining photos: $REMAINING"
  if [ "$REMAINING" = "0" ] || [ -z "$REMAINING" ]; then
    echo "No more photos to process."
    break
  fi
  sleep 3
done
echo ""
echo "=== COMPLETE ==="
echo "Final totals: success=$TOTAL_SUCCESS no_gps=$TOTAL_NO_GPS failed=$TOTAL_FAILED"
echo "Ended: $(date)"
