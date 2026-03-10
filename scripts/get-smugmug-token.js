/**
 * SmugMug OAuth Token Fetcher
 * 
 * Usage: node scripts/get-smugmug-token.js
 * 
 * This will:
 * 1. Print the authorization URL
 * 2. You visit it and authorize
 * 3. Enter the verifier code here
 * 4. Get your access token
 */

const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const readline = require('readline');

// YOUR API CREDENTIALS - replace with your values
const API_KEY = process.env.SMUGMUG_API_KEY || '6hJGBgm49JsxZhWnBm3vMFcKnH5tbSd9';
const API_SECRET = process.env.SMUGMUG_API_SECRET || 'MMD4PRS7x52DSW44jjQHNv9FfqN22RwJf8p8XHWFnjcSkkMwGxHGmcw4DwTcHChs';

const oauth = new OAuth({
  consumer: { key: API_KEY, secret: API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base, key) {
    return crypto.createHmac('sha1', key).update(base).digest('base64');
  }
});

function getAuthorizationUrl() {
  // Step 1: Get request token
  const requestData = {
    url: 'https://api.smugmug.com/services/oauth/1.0a/getToken',
    method: 'GET'
  };

  const requestToken = oauth.toHeader(oauth.authorize(requestData));
  
  return fetch(requestData.url, {
    method: 'GET',
    headers: {
      ...requestToken,
      'Accept': 'application/json'
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('\n=== Step 1: Request Token ===');
    console.log('Token:', data.oauth_token);
    console.log('Secret:', data.oauth_token_secret);
    
    // Step 2: Authorization URL
    const authUrl = `https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=${data.oauth_token}&Access=Full&Permits=Download`;
    
    console.log('\n=== Step 2: Authorization ===');
    console.log('Visit this URL and authorize:');
    console.log(authUrl);
    console.log('\nAfter authorizing, you\'ll get a verifier code.');
    
    return { token: data.oauth_token, secret: data.oauth_token_secret };
  });
}

function getAccessToken(requestToken, requestSecret, verifier) {
  // Step 3: Get access token
  const accessData = {
    url: 'https://api.smugmug.com/services/oauth/1.0a/getAccessToken',
    method: 'GET'
  };

  const token = { key: requestToken, secret: requestSecret };
  const authHeader = oauth.toHeader(oauth.authorize(accessData, token));
  
  // Add verifier to URL
  const urlWithVerifier = `${accessData.url}?oauth_verifier=${verifier}`;
  
  return fetch(urlWithVerifier, {
    method: 'GET',
    headers: {
      ...authHeader,
      'Accept': 'application/json'
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('\n=== Step 3: Access Token ===');
    console.log('Access Token:', data.oauth_token);
    console.log('Access Token Secret:', data.oauth_token_secret);
    console.log('\n=== Use these in your code ===');
    console.log(`ACCESS_TOKEN = '${data.oauth_token}'`);
    console.log(`ACCESS_SECRET = '${data.oauth_token_secret}'`);
    return data;
  });
}

// Interactive prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== SmugMug OAuth Token Fetcher ===\n');

getAuthorizationUrl()
  .then(({ token, secret }) => {
    rl.question('\nEnter the verifier code from the browser: ', (verifier) => {
      getAccessToken(token, secret, verifier)
        .then(() => rl.close());
    });
  })
  .catch(err => {
    console.error('Error:', err);
    rl.close();
  });
