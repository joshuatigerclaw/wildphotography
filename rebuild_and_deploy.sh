#!/bin/bash
set -e
APPDIR="/Users/joshuatenbrink/.openclaw/workspace/wildphotography/apps/web"
ROOTDIR="/Users/joshuatenbrink/.openclaw/workspace/wildphotography"

echo "=== Step 1: Next.js build ==="
cd "$APPDIR" && npx next build 2>&1 | tail -5

echo "=== Step 2: Copy .next to root (skipping standalone subdir) ==="
rm -rf "$ROOTDIR/.next.old"
mv "$ROOTDIR/.next" "$ROOTDIR/.next.old" 2>/dev/null || true
# Copy everything except standalone/ to avoid OpenNext confusion
cp -r "$APPDIR/.next" "$ROOTDIR/.next"
# Remove the standalone subdir if it was copied
rm -rf "$ROOTDIR/.next/standalone"
echo ".next copied to root (standalone removed)"

echo "=== Step 3: OpenNext (from apps/web) ==="
cd "$APPDIR"
node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build --dangerouslyUseUnsupportedNextVersion --skipNextBuild 2>&1 | tail -10

echo "=== Step 4: Copy .open-next to root ==="
rm -rf "$ROOTDIR/.open-next.old"
mv "$ROOTDIR/.open-next" "$ROOTDIR/.open-next.old" 2>/dev/null || true
cp -r "$APPDIR/.open-next" "$ROOTDIR/.open-next"
echo ".open-next copied to root"

echo "=== Step 5: Deploy ==="
cd "$ROOTDIR"
npx wrangler deploy --name wildphotography-new 2>&1 | tail -8

echo "=== DONE ==="