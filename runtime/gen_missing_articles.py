#!/usr/bin/env python3
"""Generate missing WildPhotography articles."""
import json, subprocess, psycopg2, sys, re, os
from datetime import datetime

BASE = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography"
PHOTOS_FILE = f"{BASE}/runtime/photos_data.json"
LINKS_FILE = f"{BASE}/runtime/link_targets.json"
OUTPUT_DIR = f"{BASE}/runtime/article_outputs"
REPORTS_DIR = f"{BASE}/reports"
DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require"
PARTNER_ID = "6ZV7KMH"
CMP = "wildphotography"
AUTHOR = "Joshua ten Brink"
CANONICAL_BASE = "https://wildphotography.com"
MIN_PHOTO_COUNT = 6

ARTICLES = [
    {"slug": "costa-rica-nature-lovers-guide", "keyword": "best places to visit in costa rica for nature lovers", "type": "theme_roundup", "theme": "nature travel"},
    {"slug": "costa-rica-beach-photography-guide", "keyword": "costa rica beach photography guide", "type": "photography_guide", "theme": "beach photography"},
    {"slug": "costa-rica-bird-photography-guide", "keyword": "costa rica bird photography guide", "type": "photography_guide", "theme": "bird photography"},
    {"slug": "best-tours-wildlife-lovers-costa-rica", "keyword": "best tours for wildlife lovers in costa rica", "type": "theme_roundup", "theme": "wildlife tours"},
    {"slug": "best-places-photograph-wildlife-costa-rica", "keyword": "best places to photograph wildlife in costa rica", "type": "photography_guide", "theme": "wildlife photography locations"},
]

def load_json(path):
    with open(path) as f:
        return json.load(f)

def call_llm(prompt):
    cmd = ["openclaw", "capability", "model", "run", "--model", "minimax-portal/MiniMax-M2.7", "--json", "--prompt", prompt]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise Exception(f"LLM failed: {result.stderr[:500]}")
    return result.stdout.strip()

def parse_json(raw):
    raw = raw.strip()
    # Check if it is a capability wrapper
    try:
        wrapper = json.loads(raw)
        if wrapper.get('capability') == 'model.run' and 'outputs' in wrapper:
            text = wrapper['outputs'][0].get('text', '')
            raw = text
    except:
        pass
    # Remove markdown code blocks
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])
    # Find JSON object
    match = re.search(r'\{[\s\S]*\}', raw)
    if match:
        return json.loads(match.group())
    return json.loads(raw)

def score_photos(photos, theme, keyword):
    scored = []
    for p in photos:
        score = 0
        kws = ((p.get('keywords') or '') + ' ' + (p.get('title') or '') + ' ' + (p.get('location_name') or '') + ' ' + (p.get('gallery_slug') or '')).lower()
        if 'beach' in theme or 'beach' in keyword:
            if any(w in kws for w in ['beach', 'coast', 'pacific', 'ocean', 'playa']): score += 10
        if 'bird' in theme or 'bird' in keyword:
            if any(w in kws for w in ['bird', 'heron', 'macaw', 'pelican', 'hawk', 'owl', 'quetzal', 'hummingbird']): score += 10
        if 'wildlife' in theme or 'wildlife' in keyword:
            if any(w in kws for w in ['wildlife', 'monkey', 'sloth', 'toucan', 'crocodile', 'turtle', 'cat', 'mammal']): score += 8
        if 'nature' in theme:
            if any(w in kws for w in ['forest', 'rainforest', 'mountain', 'volcano', 'waterfall', 'river']): score += 8
        scored.append((score, p))
    scored.sort(key=lambda x: -x[0])
    return [p for _, p in scored[:25]]

def build_prompt(article, photos, link_targets):
    theme = article['theme']
    keyword = article['keyword'].lower()
    
    photo_context = []
    for p in photos[:8]:
        photo_context.append({
            'id': p['id'], 'slug': p['slug'], 'title': p['title'],
            'thumb_url': p['thumb_url'], 'medium_url': p.get('medium_url', ''),
            'location_name': p.get('location_name', ''),
            'species_common_name': p.get('species_common_name') or '',
            'gallery_slug': p.get('gallery_slug', ''),
            'keywords': (p.get('keywords') or '')[:80]
        })
    
    lt_context = [{'slug': lt['slug'], 'page_type': lt['page_type'], 'title': lt['title']} for lt in link_targets[:30]]
    
    if article['type'] == 'theme_roundup':
        structure = """Article Type: theme_roundup
Target word count: 900–1400 words
Structure:
  H1:    Best [Theme] in Costa Rica: A Guide for [Audience]
  Intro: What makes this theme compelling — scope, why Costa Rica excels
  H2:    [Top Place / Example 1] — specific detail, photo hook, what to expect
  H2:    [Top Place / Example 2] — same pattern
  H2:    [Top Place / Example 3] — same pattern
  H2:    Best Time to Go — general seasonal guidance
  H2:    Travel and Photography Tips — practical advice
  FAQ:   3–5 questions
  Affiliate block: YES"""
    else:
        structure = """Article Type: photography_guide
Target word count: 1000–1400 words
Structure:
  H1:    Costa Rica [Subject] Photography Guide
  Intro: Why this subject is worth shooting in Costa Rica
  H2:    Best Locations for [Subject] Photography — 3–6 specific locations
  H2:    Best Light and Seasonal Conditions — golden hour, dry vs wet season
  H2:    Wildlife or Landscape Timing — species behaviour or weather patterns
  H2:    Composition Ideas for [Subject] — specific angles, framing
  H2:    Practical Field Advice — gear, safety, access
  FAQ:   3–5 questions
  Affiliate block: YES"""
    
    prompt = f"""You are generating a WildPhotography SEO article. Return ONLY a valid JSON object, no markdown, no explanation.

## Article Config
- slug: {article['slug']}
- primary_keyword: {article['keyword']}
- article_type: {article['type']}
- theme: {article['theme']}

## Article Template
{structure}

## Available Photos (top 20 by relevance, SELECT 6-10 BEST for this article):
{json.dumps(photo_context, indent=2)}

## Available Link Targets (sample of 80, use ONLY these slugs):
{json.dumps(lt_context, indent=2)}

## Affiliate Config
- partner_id: {PARTNER_ID}
- cmp: {CMP}
- author: {AUTHOR}
- publisher: WildPhotography
- canonical_base: {CANONICAL_BASE}
- min_photo_count: {MIN_PHOTO_COUNT}

## Required JSON Output Fields
Return a single JSON object with:
- slug, title, meta_title (50-60 chars), meta_description (140-160 chars), h1, excerpt
- primary_keyword, secondary_keywords (array of 3-6 phrases)
- region ("costa-rica"), location_name (null), article_type
- intro_html, body_html, faq_html, affiliate_block_html (use GetYourGuide widget block)
- internal_links (array of {{slug, page_type, anchor_text, href, placement}})
- photo_ids (array of selected photo IDs - strings)
- gallery_slugs, species_slugs, location_slugs, region_slugs (arrays)
- schema_json (Article JSON-LD)
- quality_gate_passed (boolean), quality_gate_reason (string)

## Rules
- Select 6-10 photos from the available list above
- Link to 5+ slugs from link_targets
- Word count ≥900
- Use GetYourGuide affiliate block: <div data-gyg-widget="auto" data-gyg-partner-id="{PARTNER_ID}" data-gyg-cmp="{CMP}"></div>
- Write in Joshua ten Brink voice: warm, grounded, practical. Specific observations. No AI-fluff.
- No fabricated facts about fees, schedules, or wildlife certainty

Return ONLY the JSON object."""
    return prompt

def insert_article(conn, data):
    cursor = conn.cursor()
    sql = """
    INSERT INTO content_articles (slug, title, meta_title, meta_description, h1, excerpt, 
        primary_keyword, article_type, status, created_at, updated_at, search_ready, ready_for_public_render)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'draft', NOW(), NOW(), false, false)
    ON CONFLICT (slug) DO UPDATE SET 
        title=EXCLUDED.title, meta_title=EXCLUDED.meta_title, meta_description=EXCLUDED.meta_description,
        h1=EXCLUDED.h1, excerpt=EXCLUDED.excerpt, status='draft', updated_at=NOW()
    """
    try:
        cursor.execute(sql, (data['slug'], data['title'], data['meta_title'], data['meta_description'],
            data['h1'], data['excerpt'], data['primary_keyword'], data['article_type']))
        conn.commit()
        return True
    except Exception as e:
        print(f"DB error: {e}", flush=True)
        conn.rollback()
        return False

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    photos = load_json(PHOTOS_FILE)
    link_targets = load_json(LINKS_FILE)
    
    print(f"Loaded {len(photos)} photos, {len(link_targets)} link targets", flush=True)
    
    results = []
    
    for article in ARTICLES:
        slug = article['slug']
        output_path = f"{OUTPUT_DIR}/{slug}.json"
        
        if os.path.exists(output_path):
            print(f"SKIP (exists): {slug}", flush=True)
            results.append({'slug': slug, 'status': 'skipped_exists'})
            continue
        
        print(f"Generating: {slug}", flush=True)
        try:
            scored_photos = score_photos(photos, article['theme'], article['keyword'])
            prompt = build_prompt(article, scored_photos, link_targets)
            raw = call_llm(prompt)
            data = parse_json(raw)
            
            # Quality gate
            photo_count = len(data.get('photo_ids', []))
            link_count = len(data.get('internal_links', []))
            qg_passed = data.get('quality_gate_passed', False)
            qg_reason = data.get('quality_gate_reason', '')
            
            if photo_count < MIN_PHOTO_COUNT:
                qg_passed = False
                qg_reason = (qg_reason + f"; Insufficient photos: {photo_count} < {MIN_PHOTO_COUNT}").strip()
            if link_count < 5:
                qg_passed = False
                qg_reason = (qg_reason + f"; Insufficient links: {link_count} < 5").strip()
            
            data['quality_gate_passed'] = qg_passed
            data['quality_gate_reason'] = qg_reason
            
            with open(output_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            if qg_passed:
                conn = psycopg2.connect(DB_URL)
                db_ok = insert_article(conn, data)
                conn.close()
                if db_ok:
                    results.append({'slug': slug, 'status': 'approved', 'photo_count': photo_count, 'link_count': link_count})
                    print(f"  APPROVED: {slug}", flush=True)
                else:
                    results.append({'slug': slug, 'status': 'db_error', 'photo_count': photo_count, 'link_count': link_count})
                    print(f"  DB ERROR: {slug}", flush=True)
            else:
                results.append({'slug': slug, 'status': 'rejected', 'reason': qg_reason, 'photo_count': photo_count, 'link_count': link_count})
                print(f"  REJECTED: {slug} - {qg_reason}", flush=True)
                
        except Exception as e:
            results.append({'slug': slug, 'status': 'error', 'reason': str(e)})
            print(f"  ERROR {slug}: {e}", flush=True)
    
    # Report
    approved = [r['slug'] for r in results if r['status'] == 'approved']
    rejected = [r for r in results if r['status'] in ('rejected', 'error', 'db_error')]
    skipped = [r['slug'] for r in results if r['status'] == 'skipped_exists']
    
    report = f"""# WildPhotography Article Generation Report
Generated: {datetime.now().isoformat()}

## Summary
- articles_generated: {len([r for r in results if r['status'] not in ('skipped_exists',)])}
- articles_approved: {len(approved)}
- articles_rejected: {len(rejected)}
- articles_skipped_already_existed: {len(skipped)}

## Approved
"""
    for slug in approved: report += f"- {slug}\n"
    
    report += "\n## Quality Gate Failed / Errors\n"
    for r in rejected:
        report += f"- {r['slug']}: {r.get('reason', r['status'])}\n"
    
    report += "\n## Quality Details\n"
    for r in results:
        if r['status'] not in ('skipped_exists',):
            pc = r.get('photo_count', 0)
            lc = r.get('link_count', 0)
            report += f"- {r['slug']}: photos={pc}, links={lc}, status={r['status']}\n"
    
    ts = datetime.now().strftime('%Y%m%d_%H%M')
    report_path = f"{REPORTS_DIR}/wild_article_generate_report_{ts}.md"
    with open(report_path, 'w') as f:
        f.write(report)
    
    print(f"\nReport: {report_path}", flush=True)
    print(f"Done. Approved: {approved}", flush=True)

if __name__ == "__main__":
    main()
