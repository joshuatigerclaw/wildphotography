#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "=== Batch $i ==="
  node scripts/extract-gps-batch.js 50 2>&1
  sleep 3
done
