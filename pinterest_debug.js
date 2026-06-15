/**
 * Debug Pinterest pin-builder page structure to find correct selectors
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
  
  if (fs.existsSync(COOKIES_FILE)) {
    const state = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
    if (state.cookies) {
      await page.setCookie(...state.cookies);
    }
  }
  
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  
  // Check current URL
  console.log('URL:', page.url());
  
  // If on login, log in
  if (page.url().includes('login')) {
    console.log('Logging in...');
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) await emailInput.type(PINTEREST_EMAIL, { delay: 50 });
    await sleep(500);
    const pwInput = await page.$('input[type="password"]');
    if (pwInput) await pwInput.type(PINTEREST_PASSWORD, { delay: 50 });
    await sleep(500);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.match(/log in|continue/i));
      if (btn) btn.click();
    });
    await sleep(6000);
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);
  }
  
  console.log('Final URL:', page.url());
  
  // Get all buttons and their text
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]')).map(el => ({
      tag: el.tagName,
      type: el.type,
      text: el.textContent?.trim().substring(0, 100),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestId: Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps')),
      classes: el.className?.substring(0, 100),
      dataTestid: el.getAttribute('data-testid')
    })).filter(b => b.text || b.ariaLabel || b.dataTestid);
  });
  
  console.log('\nButtons found:');
  buttons.slice(0, 30).forEach(b => {
    console.log(JSON.stringify(b));
  });
  
  // Also check for forms and submit inputs
  const forms = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('form, [role="form"]')).map(f => ({
      tag: f.tagName,
      id: f.id,
      action: f.action
    }));
  });
  console.log('\nForms:', forms);
  
  await browser.close();
}

main().catch(console.error);
