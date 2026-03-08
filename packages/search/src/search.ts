import { typesenseSearch, PHOTOS_COLLECTION } from '../src/client';

export interface SearchOptions {
  q?: string;
  query_by?: string;
  filter_by?: string;
  sort_by?: string;
  page?: number;
  per_page?: number;
  facet_by?: string[];
}

export interface SearchResult {
  photos: PhotoDoc[];
  total: number;
  page: number;
  per_page: number;
  facets?: Record<string, FacetCount[]>;
}

export interface PhotoDoc {
  id: string;
  slug: string;
  title: string;
  thumb_url?: string;
  small_url?: string;
  medium_url?: string;
  large_url?: string;
  keywords?: string[];
  gallery?: string;
  location?: string;
  taken_year?: number;
}

export interface FacetCount {
  value: string;
  count: number;
}

export async function searchPhotos(options: SearchOptions): Promise<SearchResult> {
  const {
    q = '*',
    query_by = 'title,description,keywords,location,gallery',
    filter_by,
    sort_by = 'date_uploaded:desc',
    page = 1,
    per_page = 20,
    facet_by = ['keywords', 'gallery', 'location', 'orientation', 'camera_model', 'lens', 'taken_year'],
  } = options;

  try {
    const searchResult = await typesenseSearch
      .collections(PHOTOS_COLLECTION)
      .documents()
      .search({
        q,
        query_by,
        filter_by,
        sort_by,
        page,
        per_page,
        facet_by: facet_by.length > 0 ? facet_by : undefined,
        include_fields: 'id,slug,title,thumb_url,small_url,medium_url,large_url,keywords,gallery,location,taken_year',
      });

    // Transform Typesense results to our format
    const photos: PhotoDoc[] = (searchResult.hits || []).map((hit: any) => ({
      id: hit.document.id,
      slug: hit.document.slug,
      title: hit.document.title,
      thumb_url: hit.document.thumb_url,
      small_url: hit.document.small_url,
      medium_url: hit.document.medium_url,
      large_url: hit.document.large_url,
      keywords: hit.document.keywords,
      gallery: hit.document.gallery,
      location: hit.document.location,
      taken_year: hit.document.taken_year,
    }));

    // Extract facets
    const facets: Record<string, FacetCount[]> = {};
    if (searchResult.facet_counts) {
      for (const facet of searchResult.facet_counts) {
        facets[facet.field_name] = facet counts.map((c: any) => ({
          value: c.value,
          count: c.count,
        }));
      }
    }

    return {
      photos,
      total: searchResult.found || 0,
      page: searchResult.page || 1,
      per_page: searchResult.per_page || per_page,
      facets,
    };
  } catch (error) {
    console.error('Typesense search error:', error);
    throw error;
  }
}

export default searchPhotos;
