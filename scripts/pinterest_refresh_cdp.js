#!/usr/bin/env node
/**
 * Pinterest Cookie Refresh via CDP - WildPhotography.com
 * Connects to Joshua's running Chrome browser via Chrome DevTools Protocol
 * to extract fresh Pinterest session cookies.
 * 
 * This approach avoids the launchPersistentContext issue on this system
 * by connecting to an already-running browser instance.
 */

const fs = require('fs');
const path = require('path');

const COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_cookies.json';
const LOG_FILE = '/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/pinterest_refresh_log.txt';
const CDP_URL = 'http://localhost:18800';

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch(e) {}
}

async function main() {
  log('=== Pinterest Cookie Refresh via CDP Started ===');
  
  const {chromium} = require('playwright');
  let browser;
  
  try {
    // Connect to existing Chrome via CDP
    browser = await chromium.connectOverCDP(CDP_URL);
    log('Connected to Chrome at ' + CDP_URL);
  } catch(e) {
    log(`ERROR: Cannot connect to Chrome at ${CDP_URL}`);
    log('Make sure Chrome is running with remote debugging enabled:');
    log('  open -a "Google Chrome" --args --remote-debugging-port=18800');
    log(`Error: ${e.message}`);
    return;
  }

  // Get the first available context (Joshua's active browser session)
  const context = browser.contexts()[0] || await browser.newContext();
  
  // Navigate to Pinterest to ensure cookies are current
  const page = await context.newPage();
  try {
    await page.goto('https://www.pinterest.com', {timeout: 20000, waitUntil: 'domcontentloaded'});
    await page.waitForTimeout(2000);
    log('Loaded Pinterest');
  } catch(e) {
    log('Navigation warning: ' + e.message);
  }

  // Get all cookies from the context
  const cookies = await context.cookies();
  log(`Total cookies in browser context: ${cookies.length}`);

  // Filter for Pinterest cookies
  const pinterestCookies = cookies.filter(c => 
    c.domain.includes('pinterest.com') || c.domain === '.pinterest.com'
  );
  log(`Pinterest cookies: ${pinterestCookies.length}`);

  // Show auth cookies
  const authCookies = pinterestCookies.filter(c => 
    ['session','auth','_pinterest_sess','csrftoken','_auth'].includes(c.name)
  );
  log(`Auth cookies found: ${authCookies.length}`);
  for (const c of authCookies.slice(0, 5)) {
    const expDate = c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session';
    log(`  ${c.name}: expires=${expDate} httpOnly=${c.httpOnly}`);
  }

  // Check if we have valid session cookies
  const hasSession = pinterestCookies.some(c => c.name === '_pinterest_sess' && c.expires > 0);
  const hasAuth = pinterestCookies.some(c => c.name === '_auth' && c.expires > 0);
  
  if (!hasSession || !hasAuth) {
    log('WARNING: Session cookies may be expired or missing');
    log('Joshua may need to log in to Pinterest in the Chrome window');
  } else {
    log('Session appears valid');
  }

  // Save cookies
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(pinterestCookies, null, 2));
  log(`Saved ${pinterestCookies.length} Pinterest cookies to ${COOKIES_FILE}`);

  await browser.close();
  log('=== Done ===');
}

main().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });