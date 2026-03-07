# WildPhotography.com — OpenClaw Master Build File

## Purpose
Build WildPhotography.com as a Cloudflare-first SmugMug replacement for a large photography library.

## Core requirements
- Support 100,000+ photos
- Import from SmugMug / PhotoQuest
- Fast public gallery browsing
- Fast keyword/title/description search
- Search facets by gallery, keyword, location, orientation, year, camera, lens
- SEO-friendly photo pages
- PayPal download purchases
- Private originals, public derivatives
- Use Cloudflare R2, Workers, Queues
- Use Neon Postgres
- Use Typesense Cloud
- Be resilient to API rate limits

## Primary Stack
- **Hosting**: Cloudflare Workers (Next.js + OpenNext adapter)
- **Storage**: Cloudflare R2
- **Background**: Cloudflare Queues
- **Database**: Neon Postgres
- **Search**: Typesense Cloud
- **Payments**: PayPal Business
- **Email**: Resend
- **Source**: SmugMug API

## Milestones

### Milestone 1 — Foundation
- [ ] Fork base repo
- [ ] Configure Cloudflare deployment
- [ ] Set up Neon DB connection
- [ ] Set up Typesense
- [ ] Set up R2
- [ ] Set up Queues
- [ ] Confirm deployment works

### Milestone 2 — Public MVP
- [ ] Homepage
- [ ] Gallery pages
- [ ] Photo pages
- [ ] Virtualized grid
- [ ] Deploy

### Milestone 3 — Search
- [ ] Typesense integration
- [ ] Facets
- [ ] Search page

### Milestone 4 — SmugMug Importer
- [ ] Metadata enumeration
- [ ] Original downloads
- [ ] Derivative generation
- [ ] Bulk Typesense indexing

### Milestone 5 — Payments
- [ ] PayPal checkout
- [ ] Webhook validation
- [ ] Download fulfillment

### Milestone 6 — Polish
- [ ] Related photos
- [ ] SEO
- [ ] Admin tools

---

_This file serves as the master project reference._
