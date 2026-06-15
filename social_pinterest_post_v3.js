/**
 * Social Content Distributor - Pinterest Poster v3
 * Fixed selectors for new Pinterest UI (dynamic UUID-based IDs)
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DRAFTS_FILE = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/social_drafts_latest.json';
const COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_state.json';
const IMAGE_DIR = '/tmp/pinterest_social_drafts';

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(destPath); } catch(e){}
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => { try { fs.unlinkSync(destPath); } catch(e){} reject(err); });
  });
}

async function ensureLoggedIn(page) {
  const url = page.url();
  if (url.includes('login') || url === 'https://www.pinterest.com/' || url === 'https://www.pinterest.com') {
    console.log('  Logging in to Pinterest...');
    await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) await emailInput.type(PINTEREST_EMAIL, { delay: 50 });
    await sleep(500);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) await pwInput.type(PINTEREST_PASSWORD, { delay: 50 });
    await sleep(500);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.match(/log in|sign in|continue/i));
      if (btn) btn.click();
    });
    await sleep(6000);
    console.log('  Login complete, URL:', page.url());
  }
}

async function saveCookies(page) {
  const cookies = await page.cookies('https://www.pinterest.com');
  fs.writeFileSync(COOKIES_FILE, JSON.stringify({ cookies, lastRun: new Date().toISOString() }));
}

/**
 * Fill a form field using keyboard typing (more reliable than JS for React inputs)
 */
async function fillFieldByPlaceholder(page, placeholder, value) {
  const selectors = [
    `[placeholder="${placeholder}"]`,
    `textarea[placeholder="${placeholder}"]`,
    `input[placeholder="${placeholder}"]`
  ];
  
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await sleep(200);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.type(value, { delay: 30 });
      return true;
    }
  }
  return false;
}

/**
 * Find and click the Save / Publish button
 */
async function clickSaveButton(page) {
  // Wait for "Save from site" button to appear (it appears after destination is filled)
  await sleep(3000);
  
  const strategies = [
    // Try "Save from site" - the main publish button in new Pinterest UI
    () => page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Save from site'));
      if (btn && !btn.disabled) { btn.click(); return 'Save from site'; }
      return null;
    }),
    // Try "Publish" / "Save" text
    () => page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of btns) {
        const t = btn.textContent.trim().toLowerCase();
        if ((t === 'publish' || t === 'publish now' || t === 'save' || t === 'done') && !btn.disabled) {
          btn.click(); return t;
        }
      }
      return null;
    }),
    // Try clicking the publish-immediately radio + confirm
    () => page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const pubImmediately = radios.find(r => r.value === 'publish-immediately');
      if (pubImmediately) {
        pubImmediately.click();
        return 'publish-immediately';
      }
      return null;
    }),
  ];
  
  for (const strategy of strategies) {
    const result = await strategy();
    if (result) return result;
    await sleep(500);
  }
  return null;
}

/**
 * Find the board dropdown and select the target board
 */
async function selectBoard(page, boardName) {
  // Try clicking board-related elements
  const boardSelectors = [
    '[data-testid="board-selector"]',
    '[aria-label*="board" i]',
    'div[role="combobox"]',
    '[data-testid="board-dropdown"]',
    'div[data-testid*="board"]'
  ];
  
  for (const sel of boardSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      await sleep(2000);
      
      // Now look for search input in the dropdown
      const searchInput = await page.$('input[type="search"], input[placeholder*="earch"], input[aria-label*="board" i]');
      if (searchInput) {
        await searchInput.type(boardName, { delay: 80 });
        await sleep(2000);
        
        // Click first matching option
        const selected = await page.evaluate((name) => {
          const items = Array.from(document.querySelectorAll('[role="option"], li[role="option"], div[role="listbox"] div'));
          for (const item of items) {
            if (item.textContent.includes(name) && item.offsetParent !== null) {
              item.click();
              return item.textContent.trim().substring(0, 60);
            }
          }
          return null;
        }, boardName);
        
        if (selected) return selected;
      }
      return 'clicked';
    }
  }
  
  return null;
}

async function postPin(page, pin, imagePath, photoId) {
  console.log(`\n  Posting pin ${photoId}: ${pin.title.substring(0, 50)}...`);
  
  try {
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(6000);
    
    if (page.url().includes('login')) {
      await ensureLoggedIn(page);
      await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(6000);
    }
    
    // Upload image
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      await page.goto('https://www.pinterest.com/pin/create/?', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(6000);
    }
    
    const finalFileInput = await page.$('input[type="file"]');
    if (finalFileInput) {
      await finalFileInput.uploadFile(imagePath);
      console.log('    Image uploaded');
      await sleep(12000); // Wait for image to fully process and form to render
    } else {
      return { success: false, error: 'no_file_input' };
    }
    
    // Fill destination link first (this triggers "Save from site" button)
    const destField = await page.$('textarea[placeholder="Add a destination link"]');
    if (destField) {
      await destField.click();
      await sleep(300);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.type(pin.destination, { delay: 25 });
      console.log('    Destination filled:', pin.destination.substring(0, 50));
      await sleep(2000);
    } else {
      console.log('    WARNING: No destination field found');
    }
    
    // Fill title
    const titleField = await page.$('textarea[placeholder="Add your title"]');
    if (titleField) {
      await titleField.click();
      await sleep(300);
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.type(pin.title, { delay: 25 });
      console.log('    Title filled');
      await sleep(1500);
    } else {
      console.log('    WARNING: No title field found');
    }
    
    // Select board
    const boardResult = await selectBoard(page, pin.board);
    if (boardResult) {
      console.log('    Board:', boardResult);
    } else {
      console.log('    WARNING: Board selection failed');
    }
    await sleep(2000);
    
    // Click Save / Publish button
    const saveResult = await clickSaveButton(page);
    if (saveResult) {
      console.log('    Save clicked:', saveResult);
      await sleep(5000);
      return { success: true, published: saveResult };
    } else {
      // Try one more time with a longer wait
      console.log('    Retrying save button...');
      await sleep(5000);
      const retryResult = await clickSaveButton(page);
      if (retryResult) {
        console.log('    Save clicked (retry):', retryResult);
        await sleep(5000);
        return { success: true, published: retryResult };
      }
      return { success: false, error: 'no_save_button' };
    }
    
  } catch (err) {
    console.log('    ERROR:', err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  const drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
  console.log(`Loaded ${drafts.length} drafts`);
  
  if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
  
  // Download images
  console.log('\n=== Downloading images ===');
  const imagePaths = {};
  for (const draft of drafts) {
    // Use image_url from the draft platform data (IMAGE_MAP fallback removed)
    const url = draft.platforms && draft.platforms.pinterest && draft.platforms.pinterest.image_url;
    if (!url) { console.log(`  No image for ${draft.photo_id}`); continue; }
    const ext = path.extname(url) || '.jpg';
    const dest = path.join(IMAGE_DIR, `${draft.photo_id}${ext}`);
    imagePaths[draft.photo_id] = dest;
    if (!fs.existsSync(dest)) {
      try {
        console.log(`  Downloading ${draft.photo_id}...`);
        await downloadImage(url, dest);
        console.log(`  Saved: ${dest}`);
      } catch (e) {
        console.log(`  FAILED: ${e.message}`);
      }
    } else {
      console.log(`  Cached: ${dest}`);
    }
  }
  
  console.log('\n=== Launching browser ===');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Load cookies
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      if (state.cookies && state.cookies.length > 0) {
        await page.setCookie(...state.cookies);
        console.log(`Loaded ${state.cookies.length} cookies`);
      }
    } catch(e) { console.log('Could not load cookies:', e.message); }
  }
  
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  
  if (page.url().includes('login')) {
    await ensureLoggedIn(page);
  }
  
  await saveCookies(page);
  
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
    
    const result = await postPin(page, pin, imagePath, draft.photo_id);
    results.push({ photo_id: draft.photo_id, slug: draft.slug, ...result });
    await saveCookies(page);
    
    await sleep(5000);
  }
  
  await browser.close();
  
  console.log('\n=== SUMMARY ===');
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Posted: ${success}, Failed: ${failed}`);
  results.forEach(r => {
    if (r.success) console.log(`  ✅ ${r.photo_id} (${r.slug})`);
    else console.log(`  ❌ ${r.photo_id} (${r.slug}): ${r.error}`);
  });
  
  fs.writeFileSync('/tmp/pinterest_social_results_v3.json', JSON.stringify({ success, failed, results }, null, 2));
  console.log('\nResults saved to /tmp/pinterest_social_results_v3.json');
}

main().catch(console.error);
