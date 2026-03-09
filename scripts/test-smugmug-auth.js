/**
 * Minimal SmugMug OAuth 1.0a Test Script
 * 
 * Tests each step of the OAuth flow to identify the issue.
 */

const crypto = require('crypto');
const https = require('https');

// Config
const API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const API_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';

// Existing token (if any)
const ACCESS_TOKEN = '3wMMdDs7h8n7M82ML5kD4WDk8TLhbGV8';
const ACCESS_SECRET = 'V5Ggv3kvtffLpxqBjXP5HMQgrZHPfRfFP8c2sfdkTmdkrBD4Qx5ZZLgPQJzHR4LP';

// OAuth 1.0a implementation
class OAuth1 {
  constructor(config) {
    this.consumer_key = config.consumer_key;
    this.consumer_secret = config.consumer_secret;
    this.signature_method = config.signature_method || 'HMAC-SHA1';
    this.hash_function = config.hash_function;
  }

  sign(url, method, tokenSecret = '') {
    const nonce = crypto.randomBytes(16).toString('hex').substring(0, 32);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    const params = {
      oauth_consumer_key: this.consumer_key,
      oauth_nonce: nonce,
      oauth_signature_method: this.signature_method,
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    };
    
    if (ACCESS_TOKEN) {
      params.oauth_token = ACCESS_TOKEN;
    }
    
    // Build signature base string
    const sortedParams = Object.keys(params).sort().map(k => 
      `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`
    ).join('&');
    
    const baseString = `${method.toUpperCase()}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
    const signingKey = `${this.consumer_secret}&${tokenSecret}`;
    
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    params.oauth_signature = signature;
    
    // Build header
    const authHeader = 'OAuth ' + Object.keys(params).map(k => 
      `${k}="${encodeURIComponent(params[k])}"`
    ).join(', ');
    
    return authHeader;
  }
}

const oauth = new OAuth1({
  consumer_key: API_KEY,
  consumer_secret: API_SECRET,
});

function makeRequest(url, method, tokenSecret = '') {
  return new Promise((resolve, reject) => {
    const authHeader = oauth.sign(url, method, tokenSecret);
    
    console.log(`\n=== ${method} ${url} ===`);
    console.log('Authorization:', authHeader.substring(0, 100) + '...');
    
    const req = https.get(url, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'Wildphotography/1.0',
      }
    }, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Body preview:', data.substring(0, 500));
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => reject(new Error('Timeout')));
  });
}

async function testAuth() {
  console.log('=== SmugMug OAuth 1.0a Test ===\n');
  
  // Test 1: Try to get request token
  console.log('\n--- STEP 1: Get Request Token ---');
  try {
    const result = await makeRequest('https://api.smugmug.com/oauth/getRequestToken', 'GET');
    console.log('Request token result:', result.body.substring(0, 200));
  } catch (e) {
    console.log('Request token error:', e.message);
  }
  
  // Test 2: Try to get access token  
  console.log('\n--- STEP 2: Get Access Token ---');
  try {
    const result = await makeRequest('https://api.smugmug.com/oauth/getAccessToken', 'GET', ACCESS_SECRET);
    console.log('Access token result:', result.body.substring(0, 200));
  } catch (e) {
    console.log('Access token error:', e.message);
  }
  
  // Test 3: Try authenticated API call
  console.log('\n--- STEP 3: Authenticated API Call ---');
  try {
    const result = await makeRequest('https://api.smugmug.com/api/v2!authuser', 'GET', ACCESS_SECRET);
    console.log('API result:', result.body.substring(0, 200));
  } catch (e) {
    console.log('API error:', e.message);
  }
  
  // Test 4: Try different API endpoints
  console.log('\n--- STEP 4: Different API Endpoints ---');
  const endpoints = [
    'https://api.smugmug.com/api/v2/user',
    'https://api.smugmug.com/api/v2!authuser',
    'https://api.smugmug.com/api/v2/node',
  ];
  
  for (const endpoint of endpoints) {
    try {
      const result = await makeRequest(endpoint, 'GET', ACCESS_SECRET);
      console.log(`${endpoint}: ${result.status}`);
    } catch (e) {
      console.log(`${endpoint}: ERROR - ${e.message}`);
    }
  }
}

testAuth().catch(console.error);
