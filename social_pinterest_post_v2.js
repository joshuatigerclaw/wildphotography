/**
 * Social Content Distributor - Pinterest Poster v2
 * Uses fresh login and correct Pinterest UI selectors
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
        fs.unlinkSync(destPath);
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
  if (url.includes('pinterest.com') && (url.includes('login') || url === 'https://www.pinterest.com/' || url === 'https://www.pinterest.com')) {
    console.log('  Logging in to Pinterest...');
    await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    
    const emailInput = await page.$('input[type="email"], input[name="email"], input[autocomplete="username"]');
    if (emailInput) { await emailInput.type(PINTEREST_EMAIL, { delay: 50 }); }
    await sleep(500);
    
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) { await pwInput.type(PINTEREST_PASSWORD, { delay: 50 }); }
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

async function clickPublishButton(page) {
  // Try multiple strategies for the publish/save button
  const strategies = [
    // Try "Save from site" button (new Pinterest UI)
    () => page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Save from site'));
      if (btn) { btn.click(); return 'Save from site'; }
      return null;
    }),
    // Try data-testid
    () => page.evaluate(() => {
      const btn = document.querySelector('[data-testid="pin-builder-publish-button"], [data-testid="publish-button"], [data-testid="SaveButton"]');
      if (btn) { btn.click(); return 'data-testid'; }
      return null;
    }),
    // Try any button with publish/save in text
    () => page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => {
        const t = b.textContent.trim().toLowerCase();
        return t === 'publish' || t === 'publish now' || t === 'save' || t === 'save now' || t === 'done';
      });
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    }),
    // Try submit inputs
    () => page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="submit"], button[type="submit"]'));
      if (inputs[0]) { inputs[0].click(); return 'submit-input'; }
      return null;
    }),
  ];
  
  for (const strategy of strategies) {
    const result = await strategy();
    if (result) return result;
    await sleep(300);
  }
  return null;
}

async function postPin(page, pin, imagePath, photoId) {
  console.log(`\n  Posting pin ${photoId}: ${pin.title.substring(0, 50)}...`);
  console.log(`    Board: ${pin.board}`);
  
  try {
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(5000);
    
    // Check if logged in
    if (page.url().includes('login')) {
      await ensureLoggedIn(page);
      await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 45000 });
      await sleep(5000);
    }
    
    // Upload image
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      // Try direct URL
      await page.goto('https://www.pinterest.com/pin/create/?', { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(5000);
    }
    
    const finalFileInput = await page.$('input[type="file"]');
    if (finalFileInput) {
      await finalFileInput.uploadFile(imagePath);
      console.log('    Image uploaded');
      await sleep(8000); // Wait for image to process
    } else {
      console.log('    ERROR: No file input found');
      return { success: false, error: 'no_file_input' };
    }
    
    // Fill title - try new UI first (single-line input)
    const titleFilled = await page.evaluate((title) => {
      const selectors = [
        'input[aria-label*="title" i]',
        'input[placeholder*="title" i]',
        'input[data-testid="pin-builder-title"]',
        'textarea[aria-label*="title" i]',
        'textarea[placeholder*="title" i]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.value = ''; el.focus(); el.value = title; el.dispatchEvent(new Event('input', {bubbles:true})); return sel; }
      }
      return null;
    }, pin.title);
    
    if (titleFilled) console.log('    Title filled');
    else { console.log('    WARNING: Could not fill title'); }
    await sleep(1000);
    
    // Fill description
    const descFilled = await page.evaluate((desc) => {
      const selectors = [
        'textarea[aria-label*="description" i]',
        'textarea[aria-label*="Tell" i]',
        'textarea[data-testid="pin-builder-description"]',
        'textarea[placeholder*="description" i]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.value = ''; el.focus(); el.value = desc; el.dispatchEvent(new Event('input', {bubbles:true})); return sel; }
      }
      return null;
    }, pin.description);
    
    if (descFilled) console.log('    Description filled');
    else { console.log('    WARNING: Could not fill description'); }
    await sleep(1000);
    
    // Fill destination URL
    const destFilled = await page.evaluate((dest) => {
      const selectors = [
        'input[aria-label*="destination" i]',
        'input[aria-label*="link" i]',
        'input[data-testid="pin-builder-destination"]',
        'input[placeholder*="destination" i]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { el.value = ''; el.focus(); el.value = dest; el.dispatchEvent(new Event('input', {bubbles:true})); return sel; }
      }
      return null;
    }, pin.destination);
    
    if (destFilled) console.log('    Destination filled:', pin.destination);
    else { console.log('    WARNING: Could not fill destination'); }
    await sleep(2000);
    
    // Select board - click the board field
    const boardSelected = await page.evaluate((boardName) => {
      const selectors = [
        '[data-testid="board-dropdown-select"]',
        '[aria-label*="board" i]',
        'div[role="combobox"]',
        '[data-testid="board-selector"]',
        'div[aria-label*="board" i]'
      ];
      let boardField = null;
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) { boardField = el; break; }
      }
      
      if (!boardField) return 'no_board_field';
      
      boardField.click();
      return 'clicked';
    }, pin.board);
    
    if (boardSelected === 'clicked') {
      console.log('    Board dropdown clicked');
      await sleep(2000);
      
      // Type board name in search
      const boardTyped = await page.evaluate((boardName) => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const inp of inputs) {
          if (inp.offsetParent !== null && (inp.type === 'text' || inp.type === 'search' || !inp.type)) {
            if (inp.getAttribute('aria-label')?.toLowerCase().includes('board') || 
                inp.getAttribute('placeholder')?.toLowerCase().includes('board') ||
                inp.getAttribute('aria-label')?.toLowerCase().includes('search')) {
              inp.value = '';
              inp.focus();
              inp.value = boardName;
              inp.dispatchEvent(new Event('input', {bubbles:true}));
              return 'typed';
            }
          }
        }
        return null;
      }, pin.board);
      
      if (boardTyped) console.log('    Board name typed');
      await sleep(2000);
      
      // Try to select board from dropdown
      const boardMatch = await page.evaluate((boardName) => {
        const items = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] li, div[role="option"], span[data-testid*="board"]'));
        for (const item of items) {
          if (item.textContent.includes(boardName) && item.offsetParent !== null) {
            item.click();
            return item.textContent.trim().substring(0, 60);
          }
        }
        // Try clicking first option if none match
        if (items.length > 0 && items[0].offsetParent !== null) {
          items[0].click();
          return items[0].textContent.trim().substring(0, 60);
        }
        return null;
      }, pin.board);
      
      if (boardMatch) console.log('    Board selected:', boardMatch);
      else console.log('    WARNING: Board selection failed');
    } else {
      console.log('    WARNING: Board field not found:', boardSelected);
    }
    
    await sleep(3000);
    
    // Click Publish
    const published = await clickPublishButton(page);
    if (published) {
      console.log('    Publish clicked:', published);
      await sleep(5000);
      return { success: true, published };
    } else {
      console.log('    ERROR: Publish button not found');
      // Try to save state for debugging
      const html = await page.content();
      fs.writeFileSync(`/tmp/pinterest_pin_${photoId}.html`, html);
      return { success: false, error: 'no_publish_button' };
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
    const url = IMAGE_MAP[draft.photo_id];
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
  
  // Try loading existing cookies
  let cookiesLoaded = false;
  if (fs.existsSync(COOKIES_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
      if (state.cookies && state.cookies.length > 0) {
        await page.setCookie(...state.cookies);
        console.log(`Loaded ${state.cookies.length} cookies`);
        cookiesLoaded = true;
      }
    } catch(e) { console.log('Could not load cookies:', e.message); }
  }
  
  // Navigate to Pinterest
  await page.goto('https://www.pinterest.com/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  
  if (page.url().includes('login')) {
    console.log('Need to log in...');
    await ensureLoggedIn(page);
    await saveCookies(page);
  } else {
    console.log('Already logged in, URL:', page.url());
    // Do a fresh login to get valid cookies
    await ensureLoggedIn(page);
    await saveCookies(page);
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
    
    const result = await postPin(page, pin, imagePath, draft.photo_id);
    results.push({ photo_id: draft.photo_id, slug: draft.slug, ...result });
    await saveCookies(page);
    
    await sleep(4000);
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
  
  fs.writeFileSync('/tmp/pinterest_social_results_v2.json', JSON.stringify({ success, failed, results }, null, 2));
  console.log('\nResults saved to /tmp/pinterest_social_results_v2.json');
}

main().catch(console.error);
