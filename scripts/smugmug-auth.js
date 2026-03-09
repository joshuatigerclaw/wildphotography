/**
 * Minimal SmugMug OAuth 1.0a Test Script - Using oauth-1.0a library
 */

const crypto = require('crypto');
const https = require('https');
const OAuth = require('oauth-1.0a');
const readline = require('readline');

// Config
const API_KEY = 'SGL2kk9VfwBLPsRvH235gfsjLvxdKMdB';
const API_SECRET = 'QWj7VcjX9dnJN9Wn97cTT8dzR6KzvsC6Jx8pHsWfxb2dg4ffnBsPKXFK4Xp3dBxp';

// Token placeholders
let REQUEST_TOKEN = '';
let REQUEST_SECRET = '';
let ACCESS_TOKEN = '';
let ACCESS_SECRET = '';

// Create OAuth client
const oauth = new OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  }
});

function makeRequest(url, method, token, tokenSecret) {
  return new Promise((resolve, reject) => {
    const request = { method: method, url: url };
    const auth = oauth.toHeader(oauth.authorize(request, { key: token || '', secret: tokenSecret || '' }));
    
    console.log(`\n=== ${method} ${url} ===`);
    console.log('Authorization:', JSON.stringify(auth).substring(0, 100) + '...');
    
    const req = https.request(url, {
      method: method,
      headers: {
        ...auth,
        'Accept': 'application/json',
        'User-Agent': 'Wildphotography/1.0',
      }
    }, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Body:', body.substring(0, 300));
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function step1_getRequestToken() {
  console.log('\n========== STEP 1: Get Request Token ==========');
  
  // Include oauth_callback in URL for PIN flow
  const url = 'https://api.smugmug.com/services/oauth/1.0a/getRequestToken?oauth_callback=oob';
  
  // For request token, we don't have a token yet
  const request = { method: 'GET', url: url };
  const auth = oauth.toHeader(oauth.authorize(request, { key: '', secret: '' }));
  
  console.log(`\n=== GET ${url} ===`);
  console.log('Authorization:', JSON.stringify(auth).substring(0, 100));
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        ...auth,
        'Accept': 'application/json',
      }
    }, (res) => {
      console.log('Status:', res.statusCode);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Body:', body.substring(0, 300));
        
        if (res.statusCode === 200 && body.includes('oauth_token')) {
          const params = new URLSearchParams(body);
          REQUEST_TOKEN = params.get('oauth_token');
          REQUEST_SECRET = params.get('oauth_token_secret');
          
          console.log('\n>>> Got Request Token:', REQUEST_TOKEN);
          console.log('>>> Got Request Secret:', REQUEST_SECRET);
          
          const authUrl = `https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=${REQUEST_TOKEN}&access=Full&permissions=Read`;
          console.log('\n>>> Authorize URL:');
          console.log(authUrl);
          
          resolve(true);
        } else {
          console.log('FAILED to get request token');
          resolve(false);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function step2_getAccessToken(pin) {
  console.log('\n========== STEP 2: Exchange for Access Token ==========');
  
  if (!REQUEST_TOKEN || !REQUEST_SECRET) {
    console.log('ERROR: No request token available');
    return false;
  }
  
  const url = `https://api.smugmug.com/services/oauth/1.0a/getAccessToken?oauth_verifier=${pin}`;
  
  const request = { method: 'GET', url: url };
  const auth = oauth.toHeader(oauth.authorize(request, { key: REQUEST_TOKEN, secret: REQUEST_SECRET }));
  
  console.log(`\n=== GET ${url} ===`);
  
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        ...auth,
        'Accept': 'application/json',
      }
    }, (res) => {
      console.log('Status:', res.statusCode);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Body:', body.substring(0, 300));
        
        if (res.statusCode === 200 && body.includes('oauth_token')) {
          const params = new URLSearchParams(body);
          ACCESS_TOKEN = params.get('oauth_token');
          ACCESS_SECRET = params.get('oauth_token_secret');
          
          console.log('\n>>> Got Access Token:', ACCESS_TOKEN);
          console.log('>>> Got Access Secret:', ACCESS_SECRET);
          
          resolve(true);
        } else {
          console.log('FAILED to get access token');
          resolve(false);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function step3_authenticatedRequest() {
  console.log('\n========== STEP 3: Authenticated API Request ==========');
  
  if (!ACCESS_TOKEN || !ACCESS_SECRET) {
    console.log('ERROR: No access token available');
    return false;
  }
  
  const url = 'https://api.smugmug.com/api/v2!authuser';
  
  return new Promise((resolve, reject) => {
    const request = { method: 'GET', url: url };
    const auth = oauth.toHeader(oauth.authorize(request, { key: ACCESS_TOKEN, secret: ACCESS_SECRET }));
    
    console.log(`\n=== GET ${url} ===`);
    
    const req = https.request(url, {
      method: 'GET',
      headers: {
        ...auth,
        'Accept': 'application/json',
      }
    }, (res) => {
      console.log('Status:', res.statusCode);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Body:', body.substring(0, 500));
        
        if (res.statusCode === 200) {
          console.log('\n>>> SUCCESS! Authenticated request worked!');
          resolve(true);
        } else {
          console.log('FAILED authenticated request');
          resolve(false);
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== SmugMug OAuth 1.0a Test ===\n');
  
  // Step 1
  const gotToken = await step1_getRequestToken();
  
  if (!gotToken) {
    console.log('\nStopping at step 1');
    process.exit(1);
  }
  
  // Step 2: Get PIN
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  
  rl.question('\nEnter the PIN from the authorize URL: ', async (pin) => {
    rl.close();
    
    const gotAccess = await step2_getAccessToken(pin.trim());
    
    if (!gotAccess) {
      console.log('\nStopping at step 2');
      process.exit(1);
    }
    
    // Step 3
    await step3_authenticatedRequest();
  });
}

main().catch(console.error);
