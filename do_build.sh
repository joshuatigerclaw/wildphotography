#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography/apps/web
node ../node_modules/@opennextjs/cloudflare/dist/cli/index.js build --dangerouslyUseUnsupportedNextVersion 2>&1
