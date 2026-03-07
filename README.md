# Wildphotography

A monorepo for the Wildphotography photography platform.

## Structure

```
apps/
  web       - Next.js web application
  api       - API server
  ingest    - Data ingestion service

packages/
  db        - Database schema & Drizzle ORM
  search    - Typesense search integration
  smugmug   - SmugMug API client
  payments  - Payment processing

scripts/   - Utility scripts
docs/     - Documentation
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Sync search index
npm run search:sync

# Start development
npm run dev
```

## Apps

### web
Next.js frontend for wildphotography.com

### api
REST API server

### ingest
Background job worker for importing photos

## Packages

### db
Drizzle ORM schema and database utilities

### search
Typesense search client and utilities

### smugmug
SmugMug API integration for photo imports

### payments
Payment processing (Stripe, etc.)
