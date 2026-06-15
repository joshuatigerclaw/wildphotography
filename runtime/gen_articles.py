#!/usr/bin/env python3
"""
WildPhotography Article Generator - Generate 5 pending articles
"""
import json
import subprocess
import psycopg2
import sys
import os
import re
from datetime import datetime

# Paths
BASE = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography"
PHOTOS_FILE = f"{BASE}/runtime/photos_data.json"
LINKS_FILE = f"{BASE}/runtime/link_targets.json"
QUEUE_FILE = f"{BASE}/runtime/article_queue.json"
OUTPUT_DIR = f"{BASE}/runtime/article_outputs"
REPORTS_DIR = f"{BASE}/reports"

# DB config
DB_URL = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require"

# Affiliate config
PARTNER_ID = "6ZV7KMH"
CMP = "wildphotography"
AUTHOR = "Joshua ten Brink"
PUBLISHER = "WildPhotography"
CANONICAL_BASE = "https://wildphotography.com"
MIN_PHOTO_COUNT = 6

# The 5 pending articles
ARTICLES = [
    {
        "slug": "costa-rica-nature-lovers-guide",
        "keyword": "best places to visit in costa rica for nature lovers",
        "type": "theme_roundup",
        "theme": "nature travel",
        "priority": 20,
    },
    {
        "slug": "costa-rica-beach-photography-guide",
        "keyword": "costa rica beach photography guide",
        "type": "photography_guide",
        "theme": "beach photography",
        "priority": 21,
    },
    {
        "slug": "costa-rica-bird-photography-guide",
        "keyword": "costa rica bird photography guide",
        "type": "photography_guide",
        "theme": "bird photography",
        "priority": 22,
    },
    {
        "slug": "best-tours-wildlife-lovers-costa-rica",
        "keyword": "best tours for wildlife lovers in costa rica",
        "type": "theme_roundup",
        "theme": "wildlife tours",
        "priority": 24,
    },
    {
        "slug": "best-places-photograph-wildlife-costa-rica",
        "keyword": "best places to photograph wildlife in costa rica",
        "type": "photography_guide",
        "theme": "wildlife photography locations",
        "priority": 25,
    },
]

def load_json(path):
    with open(path) as f:
        return json.load(f)

def call_llm(prompt):
    """Call the LLM via openclaw capability model run."""
    cmd = [
        "openclaw", "capability", "model", "run",
        "--model", "minimax-portal/MiniMax-M2.7",
        "--json",
        "--prompt", prompt
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if result.returncode != 0:
        raise Exception(f"LLM call failed: {result.stderr}")
    return result.stdout.strip()

def build_article_prompt(article, photos, link_targets):
    """Build the full prompt for article generation."""
    
    # Select best photos for this article topic
    topic = article['theme'] or article['type']
    keyword = article['keyword'].lower()
    
    # Score photos by relevance
    scored = []
    for p in photos:
        score = 0
        kws = ((p.get('keywords') or '') + ' ' + (p.get('title') or '') + ' ' + (p.get('location_name') or '') + ' ' + (p.get('gallery_slug') or '')).lower()
        
        if 'beach' in topic or 'beach' in keyword:
            if any(w in kws for w in ['beach', 'coast', 'pacific', 'ocean', 'playa']): score += 10
        if 'bird' in topic or 'bird' in keyword:
            if any(w in kws for w in ['bird', 'heron', 'macaw', 'pelican', 'hawk', 'owl', 'quetzal', 'hummingbird']): score += 10
        if 'wildlife' in topic or 'wildlife' in keyword:
            if any(w in kws for w in ['wildlife', 'monkey', 'sloth', 'toucan', 'crocodile', 'turtle', 'cat', 'mammal']): score += 8
        if 'nature' in topic:
            if any(w in kws for w in ['forest', 'rainforest', 'mountain', 'volcano', 'waterfall', 'river']): score += 8
        if 'tour' in topic:
            if any(w in kws for w in ['beach', 'forest', 'park', 'reserve', 'wildlife']): score += 5
        
        # Prefer diverse galleries
        gallery = p.get('gallery_slug', '')
        if gallery and gallery not in [x.get('gallery') for x in scored[-5:]]:
            score += 2
        
        scored.append((score, p))
    
    # Sort by score descending, take top 30 for LLM context
    scored.sort(key=lambda x: -x[0])
    top_photos = scored[:30]
    
    photo_context = []
    for score, p in top_photos:
        photo_context.append({
            'id': p['id'],
            'slug': p['slug'],
            'title': p['title'],
            'thumb_url': p['thumb_url'],
            'medium_url': p['medium_url'],
            'location_name': p['location_name'],
            'species_common_name': p['species_common_name'],
            'gallery_slug': p['gallery_slug'],
            'keywords': p.get('keywords', '')[:100]
        })
    
    # Build link targets context - filter to relevant ones
    lt_context = []
    for lt in link_targets[:200]:
        lt_context.append({
            'slug': lt['slug'],
            'page_type': lt['page_type'],
            'title': lt['title'],
            'region': lt.get('region', '')
        })
    
    article_type_template = {
        'theme_roundup': """Article Type: theme_roundup
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
  Affiliate block: YES""",
        
        'photography_guide': """Article Type: photography_guide
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
    }
    
    template = article_type_template.get(article['type'], article_type_template['theme_roundup'])
    
    prompt = f"""You are generating a WildPhotography SEO article. Return ONLY a valid JSON object, no markdown, no explanation.

## Article Config
- slug: {article['slug']}
- primary_keyword: {article['keyword']}
- article_type: {article['type']}
- theme: {article['theme']}

## Article Template
{template}

## Available Photos (top 30 by relevance, SELECT 6-10 BEST for this article):
{json.dumps(photo_context, indent=2)}

## Available Link Targets (sample of 200, use ONLY these slugs):
{json.dumps(lt_context, indent=2)}

## Affiliate Config
- partner_id: {PARTNER_ID}
- cmp: {CMP}
- author: {AUTHOR}
- publisher: {PUBLISHER}
- canonical_base: {CANONICAL_BASE}
- min_photo_count: {MIN_PHOTO_COUNT}

## Required JSON Output Fields
Return a single JSON object with:
- slug, title, meta_title (50-60 chars), meta_description (140-160 chars), h1, excerpt
- primary_keyword, secondary_keywords (array of 3-6 phrases)
- region (e.g. "costa-rica"), location_name (null), article_type
- intro_html, body_html, faq_html, affiliate_block_html (use GetYourGuide widget block)
- internal_links (array of {{slug, page_type, anchor_text, href, placement}})
- photo_ids (array of selected photo IDs)
- gallery_slugs, species_slugs, location_slugs, region_slugs
- schema_json (Article JSON-LD)
- quality_gate_passed (boolean), quality_gate_reason (string)

## Rules
- Select 6-10 photos from the available list above
- Link to 5+ slugs from link_targets
- Word count ≥900
- Use GetYourGuide affiliate block: <div data-gyg-widget="auto" data-gyg-partner-id="{PARTNER_ID}" data-gyg-cmp="{CMP}"></div>
- Species-only articles may omit affiliate block
- Write in Joshua ten Brink's voice: warm, grounded, practical
- No fabricated facts; keep language accurate

Return ONLY the JSON object."""
    
    return prompt

def parse_json_output(raw):
    """Parse JSON from LLM output, handling various formats."""
    raw = raw.strip()
    # Remove markdown code blocks
    if raw.startswith("```"):
        lines = raw.split("\n")
        raw = "\n".join(lines[1:-1])
    # Try to find JSON object
    match = re.search(r'\{[\s\S]*\}', raw)
    if match:
        return json.loads(match.group())
    return json.loads(raw)

def insert_article(conn, article_data):
    """Insert or update article in content_articles table."""
    cursor = conn.cursor()
    
    sql = """
    INSERT INTO content_articles (slug, title, meta_title, meta_description, h1, excerpt, 
        primary_keyword, article_type, status, created_at, updated_at, meta_description,
        search_ready, ready_for_public_render)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'draft', NOW(), NOW(), %s, false, false)
    ON CONFLICT (slug) DO UPDATE SET 
        title=EXCLUDED.title, 
        meta_title=EXCLUDED.meta_title, 
        meta_description=EXCLUDED.meta_description,
        h1=EXCLUDED.h1, 
        excerpt=EXCLUDED.excerpt,
        status='draft',
        updated_at=NOW()
    """
    
    try:
        cursor.execute(sql, (
            article_data['slug'],
            article_data['title'],
            article_data['meta_title'],
            article_data['meta_description'],
            article_data['h1'],
            article_data['excerpt'],
            article_data['primary_keyword'],
            article_data['article_type'],
            article_data['meta_description'],
        ))
        conn.commit()
        return True
    except Exception as e:
        print(f"DB insert error: {e}", flush=True)
        conn.rollback()
        return False

def update_queue(queue, drafted_slugs, rejected_slugs):
    """Update the article queue status."""
    for item in queue['queue']:
        slug = item['slug']
        if slug in drafted_slugs:
            item['status'] = 'drafted'
        elif slug in rejected_slugs:
            item['status'] = 'failed'
    
    with open(QUEUE_FILE, 'w') as f:
        json.dump(queue, f, indent=2)

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    
    # Load data
    photos = load_json(PHOTOS_FILE)
    link_targets = load_json(LINKS_FILE)
    queue = load_json(QUEUE_FILE)
    
    print(f"Loaded {len(photos)} photos and {len(link_targets)} link targets", flush=True)
    
    results = []
    approved = []
    rejected = []
    
    for article in ARTICLES:
        slug = article['slug']
        print(f"\nGenerating: {slug}", flush=True)
        
        try:
            prompt = build_article_prompt(article, photos, link_targets)
            raw_output = call_llm(prompt)
            
            article_data = parse_json_output(raw_output)
            
            # Write output file
            output_path = f"{OUTPUT_DIR}/{slug}.json"
            with open(output_path, 'w') as f:
                json.dump(article_data, f, indent=2)
            
            # Quality gate check
            qg_passed = article_data.get('quality_gate_passed', False)
            qg_reason = article_data.get('quality_gate_reason', '')
            
            # Override if photo count or link count is insufficient
            photo_count = len(article_data.get('photo_ids', []))
            link_count = len(article_data.get('internal_links', []))
            
            if photo_count < MIN_PHOTO_COUNT:
                qg_passed = False
                qg_reason = f"Insufficient photos: {photo_count} < {MIN_PHOTO_COUNT}"
            
            if link_count < 5:
                qg_passed = False
                qg_reason = (qg_reason + f" Insufficient links: {link_count} < 5").strip()
            
            article_data['quality_gate_passed'] = qg_passed
            article_data['quality_gate_reason'] = qg_reason
            
            # Re-write with updated quality gate
            with open(output_path, 'w') as f:
                json.dump(article_data, f, indent=2)
            
            if qg_passed:
                # Insert into DB
                conn = psycopg2.connect(DB_URL)
                db_success = insert_article(conn, article_data)
                conn.close()
                
                if db_success:
                    approved.append(slug)
                    print(f"  APPROVED: {slug} - {qg_reason}", flush=True)
                else:
                    rejected.append(slug)
                    print(f"  DB ERROR: {slug}", flush=True)
            else:
                rejected.append(slug)
                print(f"  REJECTED: {slug} - {qg_reason}", flush=True)
            
            results.append({
                'slug': slug,
                'quality_gate_passed': qg_passed,
                'quality_gate_reason': qg_reason,
                'photo_count': photo_count,
                'link_count': link_count,
            })
            
        except Exception as e:
            rejected.append(slug)
            print(f"  ERROR generating {slug}: {e}", flush=True)
            results.append({
                'slug': slug,
                'quality_gate_passed': False,
                'quality_gate_reason': f"Generation error: {str(e)}",
                'photo_count': 0,
                'link_count': 0,
            })
    
    # Update queue
    update_queue(queue, approved, rejected)
    
    # Generate report
    report = f"""# WildPhotography Article Generation Report
Generated: {datetime.now().isoformat()}

## Summary
- articles_generated: {len(results)}
- articles_approved: {len(approved)}
- articles_rejected: {len(rejected)}

## Approved Articles
"""
    for slug in approved:
        report += f"- {slug}\n"
    
    report += "\n## Rejected Articles\n"
    for r in results:
        if not r['quality_gate_passed']:
            report += f"- {r['slug']}: {r['quality_gate_reason']}\n"
    
    report += "\n## Quality Details\n"
    for r in results:
        report += f"- {r['slug']}: photos={r['photo_count']}, links={r['link_count']}, passed={r['quality_gate_passed']}\n"
    
    report_path = f"{REPORTS_DIR}/wild_article_generation_report_{datetime.now().strftime('%Y%m%d_%H%M')}.md"
    with open(report_path, 'w') as f:
        f.write(report)
    
    print(f"\nReport: {report_path}", flush=True)
    print(f"Approved: {approved}", flush=True)
    print(f"Rejected: {rejected}", flush=True)

if __name__ == "__main__":
    main()
