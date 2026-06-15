/**
 * Debug Pinterest - check if we can reach pin-builder after fresh login
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
  
  // Clear any existing cookies
  await page.deleteCookie();
  
  // Navigate to login
  console.log('Navigating to login...');
  await page.goto('https://www.pinterest.com/login/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);
  console.log('Login URL:', page.url());
  
  // Fill email
  const emailInput = await page.$('input[type="email"], input[name="email"], input[autocomplete="username"]');
  if (emailInput) {
    console.log('Found email input, typing...');
    await emailInput.type(PINTEREST_EMAIL, { delay: 50 });
  } else {
    console.log('No email input found');
    const html = await page.content();
    console.log('Page title:', await page.title());
    fs.writeFileSync('/tmp/pinterest_login_page.html', html);
    console.log('Saved page to /tmp/pinterest_login_page.html');
    await browser.close();
    return;
  }
  await sleep(500);
  
  // Click continue or type password depending on the form
  // Some Pinterest login forms have email -> password in sequence
  const pwInput = await page.$('input[type="password"]');
  if (pwInput) {
    console.log('Found password field directly');
    await pwInput.type(PINTEREST_PASSWORD, { delay: 50 });
    await sleep(500);
  } else {
    // Click "Continue" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cont = btns.find(b => b.textContent.includes('Continue') || b.textContent.includes('Next'));
      if (cont) cont.click();
    });
    await sleep(2000);
    
    // Now find password
    const pwInput2 = await page.$('input[type="password"], input[name="password"]');
    if (pwInput2) {
      console.log('Found password field after continue');
      await pwInput2.type(PINTEREST_PASSWORD, { delay: 50 });
    }
  }
  
  await sleep(500);
  
  // Submit login
  const submitted = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const loginBtn = btns.find(b => b.textContent.match(/log in|sign in|continue/i));
    if (loginBtn) { loginBtn.click(); return true; }
    // Try form submit
    const form = document.querySelector('form');
    if (form) { form.submit(); return true; }
    return false;
  });
  
  if (submitted) console.log('Login submitted');
  await sleep(6000);
  console.log('After login URL:', page.url());
  
  // Now try to go to pin builder
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(5000);
  console.log('Pin-builder URL:', page.url());
  
  // Check for file input
  const fileInput = await page.$('input[type="file"]');
  console.log('File input found:', !!fileInput);
  
  // Get all buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(el => ({
      text: el.textContent?.trim().substring(0, 80),
      ariaLabel: el.getAttribute('aria-label'),
      dataTestid: el.getAttribute('data-testid'),
      disabled: el.disabled
    })).filter(b => b.text || b.ariaLabel);
  });
  console.log('\nButtons:', JSON.stringify(buttons.slice(0, 20), null, 2));
  
  // Save cookies
  const cookies = await page.cookies('https://www.pinterest.com');
  fs.writeFileSync(COOKIES_FILE, JSON.stringify({ cookies, lastRun: new Date().toISOString() }));
  console.log('\nSaved', cookies.length, 'cookies');
  
  await browser.close();
}

main().catch(console.error);
