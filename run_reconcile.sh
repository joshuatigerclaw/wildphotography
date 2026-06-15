#!/bin/bash
cd /Users/joshuatenbrink/.openclaw/workspace/wildphotography
export NEON_DATABASE_URL="postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"
export TYPESENSE_HOST="uibn03zvateqwdx2p-1.a1.typesense.net"
export TYPESENSE_API_KEY="MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
python3 scripts/wild_typesense_reconcile.py
