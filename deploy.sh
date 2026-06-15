#!/bin/bash
cd "$(dirname "$0")"
echo "Running OpenNext build..."
node node_modules/@opennextjs/cloudflare/dist/cli/index.js build --dangerouslyUseUnsupportedNextVersion 2>&1
echo "OpenNext exit: $?"
echo "Copying to root .open-next..."
cp -R apps/web/.open-next/. .open-next/ 2>/dev/null || cp -R apps/web/.open-next . 2>/dev/null
echo "Done."
