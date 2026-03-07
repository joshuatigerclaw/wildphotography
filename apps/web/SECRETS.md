# Cloudflare Pages Secrets Required
# Run these commands to set secrets:

wrangler secret put DATABASE_URL
wrangler secret put TYPESENSE_HOST
wrangler secret put TYPESENSE_ADMIN_KEY
wrangler secret put TYPESENSE_SEARCH_KEY
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_SECRET
wrangler secret put SMUGMUG_API_KEY
wrangler secret put SMUGMUG_API_SECRET
wrangler secret put SMUGMUG_ACCESS_TOKEN
wrangler secret put SMUGMUG_ACCESS_TOKEN_SECRET

# Or set as environment variables:
# export DATABASE_URL="postgresql://..."
# export TYPESENSE_HOST="uibn03zvateqwdx2p-1.a1.typesense.net"
# export TYPESENSE_ADMIN_KEY="MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7"
# export TYPESENSE_SEARCH_KEY="Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE"
# export PAYPAL_CLIENT_ID="..."
# export PAYPAL_SECRET="..."
# export SMUGMUG_API_KEY="..."
# export SMUGMUG_API_SECRET="..."
# export SMUGMUG_ACCESS_TOKEN="..."
# export SMUGMUG_ACCESS_TOKEN_SECRET="..."
