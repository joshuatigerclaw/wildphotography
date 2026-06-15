/**
 * Social Content Distributor - Pinterest Poster
 * Posts 10 pins from social_drafts_latest.json to Pinterest using Puppeteer
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DRAFTS_FILE = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/social_drafts_latest.json';
const STATE_FILE = '/Users/joshuatenbrink/.openclaw/workspace/.pinterest_credentials';
const COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_state.json';
const IMAGE_DIR = '/tmp/pinterest_social_drafts';

// Image URL mapping from Neon (photo_id -> og_image_url)
const IMAGE_MAP = {
  20614: 'https://images.wildphotography.com/derivatives/pending_hash_50_large.jpg',
  9243: 'https://images.wildphotography.com/derivatives/mediums/5861-medium.jpg',
  9819: 'https://images.wildphotography.com/derivatives/mediums/6437-medium.jpg',
  10767: 'https://images.wildphotography.com/derivatives/mediums/7385-medium.jpg',
  9448: 'https://images.wildphotography.com/derivatives/mediums/6066-medium.jpg',
  9702: 'https://images.wildphotography.com/derivatives/mediums/6320-medium.jpg',
  20149: 'https://images.wildphotography.com/derivatives/490ca90ee57663ed_medium.jpg',
  7091: 'https://images.wildphotography.com/derivatives/mediums/3709-medium.jpg',
  699: 'https://images.wildphotography.com/derivatives/2022-06-25-12-07-28-CDtGhZ/2022-06-25-12-07-28-CDtGhZ_thumb.jpg',
  16209: 'https://images.wildphotography.com/derivatives/aaf9ac3938a4dbc6_medium.jpg',
};

const PINTEREST_EMAIL = 'joshuatigerclaw@gmail.com';
const PINTEREST_PASSWORD = 'Redtiger3829!';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
  });
}

async function ensureLoggedIn(page) {
  // Check if we're on a login-required page
  const url = page.url();
  if (url.includes('pinterest.com') && (url.includes('login') || url === 'https://www.pinterest.com/' || url === 'https://www.pinterest.com')) {
    console.log('Need to log in to Pinterest...');
    await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    // Fill email
    const emailInput = await page.$('input[type="email"], input[aria-label*="email"], input[name="email"]');
    if (emailInput) {
      await emailInput.type(PINTEREST_EMAIL, { delay: 50 });
      await sleep(500);
    }
    
    // Fill password
    const pwInput = await page.$('input[type="password"], input[aria-label*="password"], input[name="password"]');
    if (pwInput) {
      await pwInput.type(PINTEREST_PASSWORD, { delay: 50 });
      await sleep(500);
    }
    
    // Click login button
    const loginBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const loginBtn = btns.find(b => b.textContent.trim().toLowerCase().includes('log in') || b.textContent.trim().toLowerCase().includes('continue'));
      if (loginBtn) { loginBtn.click(); return true; }
      return false;
    });
    
    if (loginBtn) {
      await sleep(5000);
      console.log('Login submitted, waiting for redirect...');
    }
  }
}

async function postPin(page, pin, imagePath) {
  console.log(`\nPosting: ${pin.title.substring(0, 50)}...`);
  console.log(`  Board: ${pin.board}`);
  console.log(`  Image: ${imagePath}`);
  
  // Save cookies after successful login
  async function saveCookies() {
    const cookies = await page.cookies('https://www.pinterest.com');
    fs.writeFileSync(COOKIES_FILE, JSON.stringify({ cookies, lastRun: new Date().toISOString() }));
  }
  
  try {
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(4000);
    
    // Check if redirected to login
    await ensureLoggedIn(page);
    
    // Upload image
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // Try going to create pin directly
      await page.goto('https://www.pinterest.com/pin/create/?', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(4000);
    }
    
    const finalFileInput = await page.$('input[type="file"]');
    if (finalFileInput) {
      await finalFileInput.uploadFile(imagePath);
      console.log('  Image uploaded');
      await sleep(7000);
    } else {
      console.log('  ERROR: Could not find file input');
      return { success: false, error: 'no_file_input' };
    }
    
    // Fill title
    const titleSelectors = [
      'textarea[aria-label*="title" i]',
      'textarea[data-testid="pin-builder-title"]',
      'textarea[placeholder*="title" i]',
      'textarea[name="title"]'
    ];
    for (const sel of titleSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(pin.title, { delay: 15 });
        console.log('  Title filled');
        break;
      }
    }
    await sleep(1000);
    
    // Fill description
    const descSelectors = [
      'textarea[aria-label*="description" i]',
      'textarea[aria-label*="Tell everyone" i]',
      'textarea[data-testid="pin-builder-description"]',
      'textarea[name="description"]'
    ];
    for (const sel of descSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(pin.description, { delay: 10 });
        console.log('  Description filled');
        break;
      }
    }
    await sleep(1000);
    
    // Fill destination URL
    const destSelectors = [
      'input[aria-label*="destination" i]',
      'input[aria-label*="link" i]',
      'input[data-testid="pin-builder-destination"]',
      'input[name="link"]'
    ];
    for (const sel of destSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(pin.destination, { delay: 20 });
        console.log('  Destination filled:', pin.destination);
        break;
      }
    }
    await sleep(2000);
    
    // Select board
    const boardSelectors = [
      '[data-testid="board-dropdown-select"]',
      '[aria-label*="board" i]',
      'div[role="combobox"]',
      '[data-testid="boardSelector"]'
    ];
    for (const sel of boardSelectors) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        console.log('  Board dropdown clicked');
        await sleep(1500);
        
        const boardInput = await page.$('input[aria-label*="board" i], input[placeholder*="board" i], input[type="search"]');
        if (boardInput) {
          await boardInput.type(pin.board, { delay: 80 });
          await sleep(2000);
          
          const selected = await page.evaluate((boardName) => {
            const items = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] li, [data-testid*="board"], div[aria-label*="board"]'));
            for (const item of items) {
              if (item.textContent.includes(boardName)) {
                item.click();
                return item.textContent.trim();
              }
            }
            // Try first option
            const first = items[0];
            if (first) { first.click(); return first.textContent.trim(); }
            return null;
          }, pin.board);
          
          if (selected) console.log('  Board selected:', selected);
        }
        break;
      }
    }
    
    await sleep(3000);
    
    // Click Publish
    const published = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const btn of btns) {
        const text = btn.textContent.trim().toLowerCase();
        if (text === 'publish' || text === 'publish now' || text === 'save') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    
    if (published) {
      console.log('  Publish clicked!');
      await sleep(4000);
      await saveCookies();
      return { success: true };
    } else {
      console.log('  ERROR: Could not find Publish button');
      return { success: false, error: 'no_publish_button' };
    }
    
  } catch (err) {
    console.log('  ERROR:', err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  // Read drafts
  const drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
  console.log(`Loaded ${drafts.length} drafts`);
  
  // Create temp image dir
  if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
  
  // Download images first
  console.log('\n=== Downloading images ===');
  const imagePaths = {};
  for (const draft of drafts) {
    const url = IMAGE_MAP[draft.photo_id];
    if (!url) { console.log(`  No image for photo_id ${draft.photo_id}`); continue; }
    const ext = path.extname(url) || '.jpg';
    const dest = path.join(IMAGE_DIR, `${draft.photo_id}${ext}`);
    imagePaths[draft.photo_id] = dest;
    if (!fs.existsSync(dest)) {
      try {
        console.log(`  Downloading ${draft.photo_id}...`);
        await downloadImage(url, dest);
        console.log(`  Saved to ${dest}`);
      } catch (e) {
        console.log(`  FAILED to download ${url}: ${e.message}`);
      }
    } else {
      console.log(`  Already cached: ${dest}`);
    }
  }
  
  // Launch browser
  console.log('\n=== Launching browser ===');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  // Load cookies if available
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      if (state.cookies && state.cookies.length > 0) {
        await page.setCookie(...state.cookies);
        console.log(`Loaded ${state.cookies.length} cookies from state`);
      }
    } catch (e) {
      console.log('Could not load cookies:', e.message);
    }
  }
  
  // Navigate to Pinterest to check login status
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  if (currentUrl.includes('login')) {
    console.log('Need to log in...');
    await ensureLoggedIn(page);
  }
  
  // Post each pin
  console.log('\n=== Posting Pins ===');
  const results = [];
  for (const draft of drafts) {
    const pin = draft.platforms.pinterest;
    const imagePath = imagePaths[draft.photo_id];
    
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.log(`\nSKIP ${draft.photo_id}: No image file`);
      results.push({ photo_id: draft.photo_id, success: false, error: 'no_image' });
      continue;
    }
    
    const result = await postPin(page, pin, imagePath);
    results.push({ photo_id: draft.photo_id, slug: draft.slug, ...result });
    
    // Pause between pins
    await sleep(3000);
  }
  
  await browser.close();
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Posted: ${success}, Failed: ${failed}`);
  results.forEach(r => {
    if (r.success) console.log(`  ✅ ${r.photo_id} (${r.slug})`);
    else console.log(`  ❌ ${r.photo_id} (${r.slug}): ${r.error}`);
  });
  
  fs.writeFileSync('/tmp/pinterest_social_results.json', JSON.stringify({ success, failed, results }, null, 2));
  console.log('\nResults saved to /tmp/pinterest_social_results.json');
}

main().catch(console.error);
