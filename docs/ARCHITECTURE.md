# Architecture Decision - Production Runtime

## Decision: Cloudflare Workers (NOT Pages)

**Date:** 2026-03-08

### Chosen Platform
- **Main App:** Cloudflare Workers
- **Media:** Dedicated Cloudflare Worker + R2

### Rejected Options
- **Cloudflare Pages:** Not used for production (deployment issues, 404s)
- **Vercel:** Not used (staying on Cloudflare per requirement)

### Why Workers?
1. Full control over routing
2. Works with R2 natively
3. Queue support built-in
4. No deployment issues

### Architecture
```
Internet
    ↓
Cloudflare DNS
    ↓
wildphotography.com → Worker (wildphotography-web)
    ├─ / → Homepage
    ├─ /galleries → Galleries
    ├─ /gallery/[slug] → Gallery page
    ├─ /photo/[slug] → Photo page
    ├─ /search → Typesense search
    ├─ /api/* → API routes (future)
    └─ /derivatives/* → R2 media
         ↓
         R2 Bucket
```

### Data Flow
- **Database:** Neon (mock for now, can connect via D1)
- **Search:** Typesense (live!)
- **Media:** R2 via worker

### Pages Status
- Pages may remain for preview/development
- NOT production runtime
