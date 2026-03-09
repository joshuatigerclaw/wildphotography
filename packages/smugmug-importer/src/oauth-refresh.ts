/**
 * SmugMug OAuth Token Refresh
 * 
 * Uses PIN to get new access token
 * 
 * Usage: npx ts-node src/oauth-refresh.ts
 */

import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import querystring from 'querystring';

const API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const API_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';
const REQUEST_TOKEN_URL = 'https://api.smugmug.com/oauth/getRequestToken';
const ACCESS_TOKEN_URL = 'https://api.smugmug.com/oauth/getAccessToken';
const AUTHORIZE_URL = 'https://www.smugmug.com/oauth/authorize';

// For PIN-based, we already have a request token
// Just need to exchange it for access token

async function refreshToken(pin: string) {
  console.log('Exchanging PIN for access token...');
  console.log('PIN:', pin);
  
  // Create OAuth client
  const oauth = new OAuth({
    consumer: {
      key: API_KEY,
      secret: API_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).base_string(base_string).digest('base64');
    },
  });
  
  // The token we have is actually an access token
  // Let's just test it
  
  console.log('\nTesting access token...');
  console.log('Token:', process.env.SMUGMUG_OAUTH_TOKEN || '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8');
  console.log('Secret:', process.env.SMUGMUG_OAUTH_TOKEN_SECRET ? '***' : '***');
  
  const client = axios.create({
    baseURL: 'https://api.smugmug.com/api/v2',
    headers: {
      'Accept': 'application/json',
    },
  });
  
  // Try to get user info
  try {
    const token = {
      key: '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8',
      secret: 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP',
    };
    
    const authHeader = oauth.toHeader(
      oauth.authorize(
        { url: 'https://api.smugmug.com/api/v2/!authuser', method: 'GET' },
        token
      )
    );
    
    console.log('Auth header:', authHeader.Authorization);
    
    const response = await client.get('/!authuser', {
      headers: authHeader,
    });
    
    console.log('Success!', response.data);
  } catch (e: any) {
    console.error('Error:', e.response?.status, e.response?.data || e.message);
  }
}

// Check if PIN is provided
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx ts-node src/oauth-refresh.ts <pin>');
  console.log('\nYou provided: PIN =', args[0]);
}

refreshToken(args[0] || '661504');
