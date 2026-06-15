/**
 * Debug Pinterest pin-builder page structure AFTER image upload
 */
const puppeteer = require('puppeteer');
const fs = require('fs');

const COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_state.json';
const PINTEREST_EMAIL = 'joshuatigerclaw@gmail.com';
const PINTEREST_PASSWORD = 'Redtiger3829!';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  if (fs.existsSync(COOKIES_FILE)) {
    const state = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    if (state.cookies) {
      await page.setCookie(...state.cookies);
    }
  }
  
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  
  if (page.url().includes('login')) {
    console.log('Logging in...');
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
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
  }
  
  // Upload a test image
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/tmp/pinterest_social_drafts/9243.jpg');
    console.log('Image uploaded');
    await sleep(10000); // Wait longer for image to process
  }
  
  // Now get all inputs and textareas
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea')).map(el => ({
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute('aria-label'),
      name: el.name,
      id: el.id,
      value: el.value?.substring(0, 50),
      maxLength: el.maxLength
    })).filter(i => i.tag === 'INPUT' || i.tag === 'TEXTAREA');
  });
  
  console.log('\nInputs found:');
  inputs.forEach(i => console.log(JSON.stringify(i)));
  
  // Get all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.textContent?.trim().substring(0, 80),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestid: el.getAttribute('data-testid'),
      disabled: el.disabled
    })).filter(b => b.text || b.ariaLabel);
  });
  
  console.log('\nButtons:');
  buttons.forEach(b => console.log(JSON.stringify(b)));
  
  // Get page title and URL
  console.log('\nPage URL:', page.url());
  console.log('Page title:', await page.title());
  
  await browser.close();
}

main().catch(console.error);
