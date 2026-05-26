#!/usr/bin/env python3
"""
Backlink Discovery Script for WildPhotography.com
Searches DuckDuckGo for mentions of Joshua ten Brink / WildPhotography
and logs opportunities where photos are used without proper credit/backlink.
"""

import os
import sys
import json
import time
import re
import psycopg2
from datetime import datetime
from urllib.parse import quote

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Installing dependencies...")
    os.system("pip3 install requests beautifulsoup4")
    import requests
    from bs4 import BeautifulSoup

# DB connection
DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

LOG_FILE = "/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/backlink_discovery_log.txt"
OUTREACH_FILE = "/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/outreach_drafts.json"

SEARCH_QUERIES = [
    "Joshua ten Brink photography",
    "Joshua ten Brink Costa Rica",
    "Joshua ten Brink photo",
    "Joshua ten Brink WildPhotography",
    "Joshua ten Brink Costa Rica wildlife",
    "WildPhotography.com Costa Rica",
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")

def get_db():
    return psycopg2.connect(DB_URL)

def email_from_page(soup):
    """Extract email addresses from page"""
    text = soup.get_text()
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    # Filter out common noise
    valid = [e for e in emails if not any(n in e.lower() for n in ['example.com', 'domain.com', 'noreply', 'no-reply'])]
    return valid[0] if valid else None

def check_backlink(soup, url):
    """Check if page links to wildphotography.com"""
    links = soup.find_all('a', href=True)
    for link in links:
        href = link['href'].lower()
        if 'wildphotography.com' in href or 'wildphoto' in href:
            return True
    return False

def credit_found(soup, text=None):
    """Check if page mentions Joshua ten Brink or WildPhotography"""
    content = text or soup.get_text()
    content_lower = content.lower()
    patterns = ['joshua ten brink', 'wildphotography', 'photo by joshua', 'joshua t.', 'ten brink']
    return any(p in content_lower for p in patterns)

def search_duckduckgo(query, max_results=15):
    """Search DuckDuckGo and return list of result dicts"""
    encoded_q = quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded_q}"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        results = []
        for result in soup.select('.result'):
            a = result.select_one('.result__a')
            if not a:
                continue
            title = a.get_text(strip=True)
            link = a.get('href', '')
            # Extract real URL from redirect links (uddg param)
            if 'uddg' in link:
                import urllib.parse
                qs = urllib.parse.parse_qs(urllib.parse.urlparse(link).query)
                link = qs.get('uddg', [link])[0]
            snippet_el = result.select_one('.result__snippet')
            snippet_text = snippet_el.get_text(strip=True) if snippet_el else ''
            results.append({'title': title, 'url': link, 'snippet': snippet_text})
            if len(results) >= max_results:
                break
        return results
    except Exception as e:
        log(f"Search error for '{query}': {e}")
        return []

def insert_opportunity(conn, domain, page_url, page_title, credit, backlink, email):
    """Insert or skip duplicate opportunity"""
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO backlink_opportunities 
            (source_domain, page_url, page_title, credit_found, backlink_found, contact_email, outreach_status)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending')
            ON CONFLICT (source_domain, page_url) DO NOTHING
            RETURNING id
        """, (domain, page_url, page_title, credit, backlink, email))
        row = cur.fetchone()
        conn.commit()
        return row is not None
    except Exception as e:
        log(f"DB insert error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()

def main():
    log("=== Backlink Discovery Started ===")
    
    conn = get_db()
    stats = {'visited': 0, 'new': 0, 'backlinks': 0, 'emails': 0, 'errors': 0}
    outreach_drafts = []
    
    for query in SEARCH_QUERIES:
        log(f"\nSearching: {query}")
        results = search_duckduckgo(query)
        log(f"  Found {len(results)} results")
        
        for r in results:
            url = r['url']
            if not url or url.startswith('https://duckduckgo.com'):
                continue
            
            domain = re.sub(r'^https?://', '', url).split('/')[0]
            stats['visited'] += 1
            
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, 'html.parser')
                text = soup.get_text()
                
                has_credit = credit_found(soup, text)
                has_backlink = check_backlink(soup, url)
                email = email_from_page(soup)
                
                log(f"  {'✅' if has_credit else '❌'} {domain} - {r['title'][:60]}")
                log(f"       credit={has_credit}, backlink={has_backlink}, email={email}")
                
                if has_credit:
                    inserted = insert_opportunity(conn, domain, url, r['title'], has_credit, has_backlink, email)
                    if inserted:
                        stats['new'] += 1
                        log(f"       → New opportunity added")
                    if has_backlink:
                        stats['backlinks'] += 1
                    if email:
                        stats['emails'] += 1
                        outreach_drafts.append({
                            "domain": domain,
                            "page_url": url,
                            "page_title": r['title'],
                            "contact_email": email,
                            "subject": "Photo credit link update",
                            "body": f"Hi,\n\nThank you for featuring my Costa Rica photography. Could you please update the photo credit to include a link to: https://wildphotography.com\n\nCredit: Photo by Joshua ten Brink / WildPhotography.com\n\nThank you,\nJoshua"
                        })
                
                time.sleep(3)  # Rate limit
                
            except Exception as e:
                stats['errors'] += 1
                log(f"  ERROR visiting {url}: {e}")
    
    conn.close()
    
    # Save outreach drafts
    with open(OUTREACH_FILE, 'w') as f:
        json.dump(outreach_drafts, f, indent=2)
    log(f"\nSaved {len(outreach_drafts)} outreach drafts to {OUTREACH_FILE}")
    
    log("\n=== Summary ===")
    log(f"Pages visited:   {stats['visited']}")
    log(f"New opportunities: {stats['new']}")
    log(f"Already have backlinks: {stats['backlinks']}")
    log(f"Contact emails found: {stats['emails']}")
    log(f"Errors: {stats['errors']}")
    log("=== Done ===")

if __name__ == "__main__":
    main()