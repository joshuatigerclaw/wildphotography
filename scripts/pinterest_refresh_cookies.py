#!/usr/bin/env python3
"""
Pinterest Cookie Refresh Script for WildPhotography.com
Uses playwright to open Chrome with existing profile, check login status,
and refresh cookies if needed.
"""

import os
import sys
import json
import time
from datetime import datetime
from pathlib import Path

COOKIES_FILE = '/Users/joshuatenbrink/.openclaw/workspace/pinterest_cookies.json'
PROFILE_PATH = '/Users/joshuatenbrink/Downloads/.pinterest-profile'
LOG_FILE = '/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/pinterest_refresh_log.txt'

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def main():
    log("=== Pinterest Cookie Refresh Started ===")
    
    # Check if chromium/playwright is available
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("ERROR: playwright not installed. Run: pip install playwright")
        return
    
    p = sync_playwright().start()
    browser = p.chromium.launch(
        headless=False,
        user_data_dir=PROFILE_PATH,
        args=['--no-sandbox', '--disable-setuid-sandbox']
    )
    
    context = browser.contexts[0] if browser.contexts else browser.new_context()
    page = context.new_page()
    
    # Navigate to Pinterest
    log("Opening Pinterest...")
    page.goto('https://www.pinterest.com', timeout=30000)
    page.wait_for_timeout(3000)
    
    # Check if logged in by looking for the user menu or login button
    try:
        login_button = page.locator('button[data-test-id="login-button"]')
        if login_button.is_visible(timeout=2000):
            log("NOT LOGGED IN - Login button visible")
            log("Please log in manually in the browser window...")
            # Wait up to 60 seconds for manual login
            page.wait_for_timeout(60000)
    except:
        log("Appears to be logged in (no login button)")
    
    # Check current cookies
    cookies = context.cookies()
    log(f"Current cookie count: {len(cookies)}")
    
    # Check for key auth cookies
    auth_cookies = [c for c in cookies if c['name'] in ('session', 'auth', '_pinterest_sess', 'csrftoken')]
    log(f"Auth cookies found: {len(auth_cookies)}")
    for c in auth_cookies[:3]:
        exp = c.get('expires', c.get('expiresUTC', 'unknown'))
        log(f"  {c['name']}: expires={exp}")
    
    # Save cookies
    with open(COOKIES_FILE, 'w') as f:
        json.dump(cookies, f, indent=2)
    log(f"Saved {len(cookies)} cookies to {COOKIES_FILE}")
    
    browser.close()
    p.stop()
    
    log("=== Done ===")

if __name__ == "__main__":
    main()