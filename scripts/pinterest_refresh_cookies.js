#!/usr/bin/env node
/**
 * Pinterest Cookie Refresh - Node.js version
 * Uses playwright to open Chrome with existing profile, get cookies, save to file.
 */

const fs = require('fs');
const {chromium} = require('playwright');

const COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_cookies.json';
const PROFILE_PATH = '/Users/joshuatenbrink/Downloads/.pinterest-profile';
const LOG_FILE = '/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/pinterest_refresh_log.txt';

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

(async () => {
  log('=== Pinterest Cookie Refresh (Node.js) Started ===');
  
  let context;
  try {
    context = await chromium.launchPersistentContext(PROFILE_PATH, {
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-service-autorun',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate'
      ]
    });
  } catch(e) {
    log(`ERROR: Failed to open browser: ${e.message}`);
    process.exit(1);
  }

  const page = await context.newPage();
  
  // Navigate to Pinterest
  log('Opening Pinterest...');
  try {
    await page.goto('https://www.pinterest.com', {timeout: 30000});
    await page.waitForTimeout(3000);
  } catch(e) {
    log(`Navigation error: ${e.message}`);
  }

  // Check if logged in
  try {
    const loginVisible = await page.locator('[data-test-id="login-button"]').isVisible().catch(() => false);
    if (loginVisible) {
      log('NOT LOGGED IN - Login button visible');
      log('Please log in manually in the browser window...');
      await page.waitForTimeout(60000);
    } else {
      log('Appears to be logged in');
    }
  } catch(e) {
    log('Login check error: ' + e.message);
  }

  // Get all cookies for pinterest.com
  const cookies = await context.cookies('https://www.pinterest.com');
  log(`Current cookie count: ${cookies.length}`);
  
  // Check auth cookies
  const authCookies = cookies.filter(c => ['session','auth','_pinterest_sess','csrftoken'].includes(c.name));
  log(`Auth cookies found: ${authCookies.length}`);
  for (const c of authCookies.slice(0, 3)) {
    log(`  ${c.name}: expires=${c.expires}`);
  }

  // Save cookies
  fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
  log(`Saved ${cookies.length} cookies to ${COOKIES_FILE}`);

  await context.close();
  log('=== Done ===');
})();