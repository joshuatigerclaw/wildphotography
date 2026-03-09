/**
 * SmugMug API Test - Fixed Version
 * 
 * Note: The OAuth token may be expired. Run this to test.
 * 
 * To refresh token:
 * 1. Go to https://api.smugmug.com/oauth/authorize
 * 2. Get new access token
 */
import { SmugMugClient } from './src/client';

const client = new SmugMugClient({
  apiKey: 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB',
  apiSecret: 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp',
  accessToken: process.env.SMUGMUG_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN',
  accessTokenSecret: process.env.SMUGMUG_ACCESS_TOKEN_SECRET || 'YOUR_ACCESS_TOKEN_SECRET',
});

async function test() {
  console.log('Testing SmugMug API...');
  console.log('Token:', client.getRateLimitStatus());
  
  try {
    const result = await client.getAlbums({ count: 5 });
    console.log('Success! Found', result.albums.length, 'albums');
    result.albums.forEach(a => console.log(' -', a.Name, '(' + (a.ImageCount || 0) + ' photos)'));
  } catch (e: any) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}

test();
