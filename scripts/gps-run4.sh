#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  echo "=== Batch $i ==="
  node scripts/extract-gps-batch.js 50 2>&1
  sleep 3
done
