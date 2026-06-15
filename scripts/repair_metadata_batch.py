#!/usr/bin/env python3
"""
WildPhotography Repair Agent — Metadata Enrichment Batch
Fallback-only: generates title/meta_description/keywords from slug/gallery context.
"""

import json, os, re, time
from datetime import datetime, timezone
import psycopg2

DB = dict(host='ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech',
          database='wildphotography', user='neondb_owner',
          password='npg_BvF2JsQ8drba', sslmode='require', channel_binding='require')
OUTPUT = "/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/repair_batch_20260603_results.json"
LIMIT = 200

def conn():
    return psycopg2.connect(**DB)

def fetch(limit):
    c = conn()
    cur = c.cursor()
    cur.execute("""
        SELECT p.id, p.slug, p.title,
               COALESCE(p.description,''), COALESCE(p.description_long,''),
               COALESCE(p.keywords,''), COALESCE(p.location_name,''),
               COALESCE(p.region,''), COALESCE(p.country,''),
               COALESCE(p.species_common_name,''), COALESCE(p.gallery_slug,''),
               p.gallery_id, COALESCE(g.name,'') AS gallery_name,
               p.status, COALESCE(p.filename,'')
        FROM photos p
        LEFT JOIN galleries g ON g.id = p.gallery_id
        WHERE p.status != 'archived'
          AND (p.title IS NULL OR p.title = '' OR p.meta_description IS NULL
               OR p.meta_description = '' OR p.keywords IS NULL OR p.keywords = '')
        ORDER BY p.id DESC LIMIT %s
    """, (limit,))
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    c.close()
    return [dict(zip(cols, r)) for r in rows]

def do_update(photo_id, title, meta_desc, keywords):
    c = conn()
    cur = c.cursor()
    try:
        cur.execute(
            "UPDATE photos SET title=%s, meta_description=%s, keywords=%s, updated_at=NOW() WHERE id=%s",
            (title, meta_desc, keywords, photo_id))
        c.commit()
        c.close()
        return True
    except Exception as e:
        c.rollback(); c.close()
        from sys import stderr
        print(f"  DB error: {e}", file=stderr)
        return False

FIXES = {"puntarenAs":"Puntarenas","guanacásté":"Guanacaste","alajuéla":"Alajuela",
         "san josè":"San José","arenál":"Arenal","irazú":"Irazú","poas":"Poás",
         "montezuma":"Montezuma","tamarindo":"Tamarindo","samara":"Sámara","osa":"Osa",
         "corcovado":"Corcovado","tortuguero":"Tortuguero","manuel antonio":"Manuel Antonio",
         "puerto viejo":"Puerto Viejo","quetzal":"Quetzal","nauyaca":"Nauyaca",
         "tarcoles":"Tárcoles","costa-rica":"Costa Rica","costa_rica":"Costa Rica",
         "playas del coco":"Playas del Coco","playas-del-coco":"Playas del Coco"}

def normalize(t):
    if not t: return t
    t = str(t).strip()
    for w, c in FIXES.items():
        t = re.sub(re.escape(w), c, t, flags=re.IGNORECASE)
    return re.sub(r'\s+', ' ', t).strip()

def humanize(t):
    if not t: return t
    t = t.strip()
    for pat, repl in [
        (r'\bNestled\b','Tucked'),(r'\bEmbracing\b','Framed by'),(r'\bBreathtaking\b','Stunning'),
        (r'\bTranquil\b','Peaceful'),(r'\bPristine\b','Crystal-clear'),(r'\bSerene\b','Calm'),
        (r'\bVibrant\b','Bright'),(r'\bLush\b','Green'),(r'\bCaptivating\b','Striking'),
        (r'\bIdyllic\b','Perfect'),(r'\bSecluded\b','Quiet'),(r'\bRemote\b','Off-the-beaten-path'),
        (r'\bQuintessential\b',''),(r'\bFeaturing\b',''),(r'\bShowcasing\b',''),(r'\boffers\b','has'),
        (r'\bProvides\b','Gives'),(r'\bDiscover\b','See'),(r'\bExperience\b','Enjoy'),
        (r'\bExplore\b','Visit'),(r'\bsurrounded by\b','framed by'),(r'\bfurthermore\b',''),
        (r'\bAdditionally\b',''),(r'\bIn this\b','Here'),(r'\bThe image\b','This'),
        (r'\bThis image\b','This'),(r'\bThis photo\b','This'),(r'\bThis photograph\b','This'),
    ]:
        t = re.sub(pat, repl, t)
    t = re.sub(r'^, ','',t); t = re.sub(r'\s+, ',', ',t); t = re.sub(r'\s{2,}',' ',t)
    return t.strip(' ,.-')

STOPWORDS = frozenset(['img','dsc','p','dji','pc','costa','rica','photo','photography',
                       'birds','bird','of','in','the','and','a','best','gallery',
                       'wild','photography','wildlife','costa','rica','from','jpg',
                       'cr','cr2','nef','arw','dng'])

GENERIC_RE = re.compile(
    r'^IMG[_\s]\d+|DSC[_-]?\d+|P\d{5,}|DJI[_\s]\d+|CL0A\d+|P\d{6,}|PC3\d+|^\d{4}[_-]\d{2}[_-]\d{2}',
    re.IGNORECASE)

def is_generic(slug): return bool(GENERIC_RE.match(slug or ''))

def make_title(p):
    slug = p.get('slug','') or ''; gal = p.get('gallery_name','') or ''
    loc = p.get('location_name','') or ''; reg = p.get('region','') or ''
    country = p.get('country','') or 'Costa Rica'; spec = p.get('species_common_name','') or ''
    words = []
    if not is_generic(slug):
        words = [w.title() for w in re.split(r'[-_]', slug)
                 if w.lower() not in STOPWORDS and len(w) > 2]
        words = words[:4]
    if gal and gal not in words: words.insert(0, normalize(gal))
    if spec and spec not in words: words.insert(0, normalize(spec))
    if not words: words = [country, 'Wildlife Photography']
    return ' — '.join(words[:5]) if len(words) > 1 else words[0]

def make_meta(p):
    loc = p.get('location_name','') or ''; reg = p.get('region','') or ''
    country = p.get('country','') or 'Costa Rica'
    loc_str = normalize(loc or reg)
    if loc_str:
        return f"{loc_str} wildlife photograph from Costa Rica — captured by Joshua ten Brink for WildPhotography."
    return f"Costa Rica wildlife photography by Joshua ten Brink — part of the WildPhotography collection."

def make_keywords(p):
    spec = normalize(p.get('species_common_name','') or '')
    loc = normalize(p.get('location_name','') or '')
    reg = normalize(p.get('region','') or '')
    gal = normalize(p.get('gallery_name','') or '')
    country = p.get('country','') or 'Costa Rica'
    parts = [x for x in [spec, loc or reg, gal, country, 'wildlife photography'] if x][:5]
    return ', '.join(parts)

def main():
    print(f"[repair_batch_20260603] Starting fallback-only batch. Limit={LIMIT}")
    photos = fetch(LIMIT)
    print(f"Fetched {len(photos)} photos needing repair.")
    if not photos:
        print("Nothing to process."); return

    updated, failed = [], []
    for i, p in enumerate(photos):
        pid = p['id']; slug = p.get('slug','') or ''
        title = humanize(make_title(p))
        meta  = humanize(make_meta(p))
        kw    = make_keywords(p)

        print(f"[{i+1}/{len(photos)}] photo_id={pid} | {title[:60]}")

        if len(title) < 5:
            print(f"  SKIP: title too short")
            failed.append({'photo_id':pid,'reason':'title_too_short','slug':slug})
            continue

        ok = do_update(pid, title, meta, kw)
        if ok:
            print(f"  OK")
            updated.append({'photo_id':pid,'title':title,'meta_description':meta,
                            'keywords_generated':kw,'slug':slug,
                            'gallery_name':p.get('gallery_name','')})
        else:
            print(f"  DB FAIL")
            failed.append({'photo_id':pid,'reason':'db_update_failed','slug':slug})

        time.sleep(0.02)

    data = {'batch_id':'repair_20260603','timestamp':datetime.now(timezone.utc).isoformat(),
            'total_fetched':len(photos),'updated_count':len(updated),
            'failed_count':len(failed),'results':updated,'failures':failed}
    with open(OUTPUT,'w') as f: json.dump(data, f, indent=2, default=str)

    print(f"\n=== RESULTS ===")
    print(f"Fetched:  {len(photos)}")
    print(f"Updated:  {len(updated)}")
    print(f"Failed:   {len(failed)}")
    print(f"Output:   {OUTPUT}")
    if updated:
        print(f"\nSample titles ({min(8,len(updated))}):")
        for item in updated[:8]:
            print(f"  [{item['photo_id']}] {item['title'][:70]}")
    print("Done.")

if __name__ == '__main__':
    main()