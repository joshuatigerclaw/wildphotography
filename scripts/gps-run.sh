#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography
S=0; N=0; F=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19; do
  echo "--- Batch $i of 19 ---"
  OUT=$(node scripts/extract-gps-batch.js 50 2>&1)
  echo "$OUT"
  R=$(echo "$OUT" | tail -1)
  echo "raw: $R"
  S=$((S + $(echo "$R" | sed 's/Results: \([0-9]*\).*/\1/')))
  N=$((N + $(echo "$R" | sed 's/Results: [0-9]* success, \([0-9]*\) no GPS.*/\1/')))
  F=$((F + $(echo "$R" | sed 's/Results: [0-9]* success, [0-9]* no GPS, \([0-9]*\) failed.*/\1/')))
  echo "Totals so far: success=$S no_gps=$N failed=$F"
  sleep 3
done
echo "=== COMPLETE: success=$S no_gps=$N failed=$F ==="
