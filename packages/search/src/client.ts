import { Client } from 'typesense';

// Typesense configuration
const TYPESENSE_HOST = process.env.TYPESENSE_HOST || 'uibn03zvateqwdx2p-1.a1.typesense.net';
const TYPESENSE_PORT = parseInt(process.env.TYPESENSE_PORT || '443');
const TYPESENSE_PROTOCOL = 'https';
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY || 'MPphr9zDlLzHRFQHDH4AyQb5hw2ugew7';
const TYPESENSE_SEARCH_KEY = process.env.TYPESENSE_SEARCH_KEY || 'Hhg7V2CK3DsS94nZwgEkRzikLnEYiizE';

// Create admin client (for indexing)
export const typesenseAdmin = new Client({
  nodes: [{
    host: TYPESENSE_HOST,
    port: TYPESENSE_PORT,
    protocol: TYPESENSE_PROTOCOL,
  }],
  apiKey: TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 30,
});

// Create search client (for querying)
export const typesenseSearch = new Client({
  nodes: [{
    host: TYPESENSE_HOST,
    port: TYPESENSE_PORT,
    protocol: TYPESENSE_PROTOCOL,
  }],
  apiKey: TYPESENSE_SEARCH_KEY,
  connectionTimeoutSeconds: 10,
});

// Collection name
export const PHOTOS_COLLECTION = 'photos';

export default typesenseSearch;
