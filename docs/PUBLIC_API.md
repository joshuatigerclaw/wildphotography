# WildPhotography Public API

Base URL: `https://wildphotography.com/api/public`

## Overview

WildPhotography exposes a public API for downstream consumers (like NaturalCostaRica.com) to fetch photos, galleries, and search results.

**Security:** All endpoints return only public/safe data. Private fields (original_r2_key, original URLs, download paths) are never exposed.

---

## Endpoints

### 1. Get Photo by Slug

```
GET /api/public/photos/:slug
```

**Example:**
```bash
curl "https://wildphotography.com/api/public/photos/scarlet-macaw-abc123"
```

**Response:**
```json
{
  "title": "Scarlet Macaw",
  "description": "Beautiful scarlet macaw in Costa Rica",
  "slug": "scarlet-macaw-abc123",
  "keywords": ["scarlet macaw", "macaw", "bird", "Costa Rica"],
  "images": {
    "thumb": "https://wildphotography-media.../derivatives/thumb/...",
    "small": "https://wildphotography-media.../derivatives/small/...",
    "medium": "https://wildphotography-media.../derivatives/medium/...",
    "large": "https://wildphotography-media.../derivatives/large/...",
    "preview": "https://wildphotography-media.../derivatives/preview/..."
  },
  "location": "Carara National Park, Costa Rica",
  "camera": "Canon EOS R5",
  "lens": "RF 100-400mm",
  "width": 4000,
  "height": 2667,
  "canonicalUrl": "https://wildphotography.com/photo/scarlet-macaw-abc123",
  "credit": "© Joshua ten Brink / Wildphotography",
  "license": "All Rights Reserved"
}
```

**Fields (Safe):**
- title, description, slug
- keywords (array)
- images (thumb, small, medium, large, preview - derivative URLs only)
- location, camera, lens
- width, height
- canonicalUrl
- credit, license

**Fields (Never Exposed):**
- original_r2_key
- original_url
- download paths
- private metadata

---

### 2. Search Photos

```
GET /api/public/search?q=<query>
```

**Parameters:**
- `q` - Search query (title, keywords, description, location)
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Example:**
```bash
curl "https://wildphotography.com/api/public/search?q=macaw&limit=10"
```

**Response:**
```json
{
  "photos": [
    {
      "title": "Scarlet Macaw",
      "slug": "scarlet-macaw-abc123",
      "description": "...",
      "keywords": ["scarlet macaw", "bird"],
      "location": "Costa Rica",
      "images": {
        "thumb": "https://...",
        "medium": "https://..."
      },
      "canonicalUrl": "https://wildphotography.com/photo/scarlet-macaw-abc123"
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 20
}
```

---

### 3. Get Photos by Keyword/Tag

```
GET /api/public/tag/:keywordSlug
```

**Example:**
```bash
curl "https://wildphotography.com/api/public/tag/birds"
```

**Response:**
```json
{
  "keyword": "Birds",
  "slug": "birds",
  "canonicalUrl": "https://wildphotography.com/search?q=birds",
  "photos": [
    {
      "title": "Scarlet Macaw",
      "slug": "scarlet-macaw-abc123",
      "description": "...",
      "location": "Costa Rica",
      "images": {
        "thumb": "https://...",
        "medium": "https://..."
      },
      "canonicalUrl": "https://wildphotography.com/photo/scarlet-macaw-abc123"
    }
  ]
}
```

---

### 4. Get Gallery

```
GET /api/public/gallery/:slug
```

**Example:**
```bash
curl "https://wildphotography.com/api/public/gallery/surfing-costa-rica"
```

**Response:**
```json
{
  "name": "Surfing Costa Rica",
  "slug": "surfing-costa-rica",
  "description": "Beautiful surfing photography from Costa Rica",
  "canonicalUrl": "https://wildphotography.com/gallery/surfing-costa-rica",
  "cover": "https://wildphotography-media.../derivatives/...",
  "photos": [
    {
      "title": "Big Wave",
      "slug": "big-wave-xyz789",
      "description": "...",
      "location": "Playa Hermosa",
      "images": {
        "thumb": "https://...",
        "medium": "https://..."
      },
      "canonicalUrl": "https://wildphotography.com/photo/big-wave-xyz789"
    }
  ]
}
```

---

## Use Cases for Downstream Sites

### 1. Featured Hero Image
```tsx
const { photos } = await fetch('/api/public/search?q=hero').json();
const hero = photos[0];
// Use hero.images.large for hero background
```

### 2. Related Photo Strip
```tsx
const { photos } = await fetch('/api/public/tag/birds').json();
// Display 6 photos as horizontal strip
```

### 3. Species Photo Grid
```tsx
const { photos } = await fetch('/api/public/search?q=scarlet-macaw').json();
// Display as 3x3 grid
```

### 4. Destination Gallery Block
```tsx
const gallery = await fetch('/api/public/gallery/manuel-antonio').json();
// Display cover + photo grid
```

---

## Response Stability

All response fields are stable and safe for caching:
- Derivative URLs use Workers.dev subdomain (temporary)
- Will migrate to media.wildphotography.com (planned)
- Canonical URLs always point to wildphotography.com

---

## Rate Limiting

Currently unlimited for public API. Contact for enterprise usage.

---

## Errors

| Code | Description |
|------|-------------|
| 404 | Photo/gallery not found |
| 500 | Server error |

---

## Example Client

```typescript
// lib/wildphoto-client.ts
const API = 'https://wildphotography.com/api/public';

export async function getPhoto(slug: string) {
  const res = await fetch(`${API}/photos/${slug}`);
  return res.json();
}

export async function searchPhotos(query: string, limit = 20) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return res.json();
}

export async function getPhotosByKeyword(keyword: string) {
  const slug = keyword.toLowerCase().replace(/\s+/g, '-');
  const res = await fetch(`${API}/tag/${slug}`);
  return res.json();
}

export async function getGallery(slug: string) {
  const res = await fetch(`${API}/gallery/${slug}`);
  return res.json();
}
```
