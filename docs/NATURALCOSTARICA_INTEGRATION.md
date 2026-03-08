# NaturalCostaRica Integration Plan

## Overview

NaturalCostaRica.com will consume WildPhotography as the canonical photo backend instead of SmugMug.

## Integration Architecture

```
NaturalCostaRica.com
        ↓
   WildPhotography API (this repo)
        ↓
   Neon DB + Typesense + R2
```

## API Endpoints to Use

| Endpoint | Purpose |
|----------|---------|
| `GET /api/public/photos/:slug` | Single photo details |
| `GET /api/public/search?q=` | Search photos |
| `GET /api/public/tag/:keywordSlug` | Photos by keyword |
| `GET /api/public/gallery/:slug` | Gallery with photos |

## Reusable Components

### 1. FeaturedPhoto
```tsx
// Fetch and display a featured photo
<FeaturedPhoto keyword="quetzal" size="large" />
```

### 2. RelatedPhotoStrip
```tsx
// Show related photos based on keyword
<RelatedPhotoStrip keyword="monkey" count={6} />
```

### 3. SpeciesPhotoGrid
```tsx
// Grid of photos for a species
<SpeciesPhotoGrid species="scarlet-macaw" />
```

### 4. DestinationPhotoGallery
```tsx
// Gallery for a destination
<DestinationPhotoGallery location="monteverde" />
```

## Implementation Strategy

### Step 1: API Client
Create a shared API client for NaturalCostaRica:

```typescript
// lib/wildphoto-client.ts
const API = 'https://wildphotography.com/api/public';

export async function getPhoto(slug: string) {
  const res = await fetch(`${API}/photos/${slug}`);
  return res.json();
}

export async function searchPhotos(query: string) {
  const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}`);
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

### Step 2: Update Pages

Replace direct SmugMug calls with WildPhotography API:

- Bird species pages → use `getPhotosByKeyword`
- Wildlife pages → use `getPhotosByKeyword`  
- Destination pages → use `getGallery`
- Featured content → use `searchPhotos`

### Step 3: Image Embedding

For embedded images, link back to WildPhotography:

```tsx
<a href={`https://wildphotography.com/photo/${photo.slug}`}>
  <img src={photo.images.medium} alt={photo.title} />
</a>
```

## Caching Strategy

- Cache API responses for 5-15 minutes
- Use stale-while-revalidate pattern
- Cache images at CDN level

## Migration Checklist

- [ ] Create API client in NaturalCostaRica
- [ ] Update bird pages to use WildPhotography
- [ ] Update wildlife pages to use WildPhotography
- [ ] Update destination pages to use WildPhotography
- [ ] Remove SmugMug dependencies
- [ ] Test all photo flows
- [ ] Verify SEO metadata

## Example Usage

### Bird Species Page
```tsx
import { getPhotosByKeyword } from '@/lib/wildphoto-client';

export default async function BirdPage({ params }) {
  const data = await getPhotosByKeyword(params.species);
  
  return (
    <div>
      <h1>{params.species}</h1>
      <PhotoGrid photos={data.photos} />
    </div>
  );
}
```

### Destination Page  
```tsx
import { getGallery } from '@/lib/wildphoto-client';

export default async function DestinationPage({ params }) {
  const data = await getGallery(params.destination);
  
  return (
    <div>
      <h1>{params.destination}</h1>
      <PhotoGallery photos={data.photos} cover={data.cover} />
    </div>
  );
}
```
