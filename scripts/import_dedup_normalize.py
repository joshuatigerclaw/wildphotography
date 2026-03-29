#!/usr/bin/env python3
"""
WildPhotography Multi-Layer Duplicate Detection & Spelling Normalization
Implements:
  - Exact binary hash match
  - Perceptual hash match (pHash via ImageMagick histogram)
  - Image dimension / EXIF / filename similarity
  - Canonical record selection
  - Spelling/text normalization with fuzzy DB-aware correction
  - Batch reporting
"""

import os
import re
import subprocess
import hashlib
import psycopg2
import json
import imagehash
from PIL import Image
from difflib import SequenceMatcher
from collections import defaultdict

# ── Config ─────────────────────────────────────────────────────────────────────
DB = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

# Thresholds
PERCEPTUAL_SIMILARITY_THRESHOLD = 0.90   # Hamming similarity for pHash
DIMENSION_TOLERANCE = 5                 # pixels tolerance for dimension match
ASPECT_TOLERANCE = 0.02                 # aspect ratio decimal tolerance
FUZZY_STRONG = 0.90                    # auto-correct threshold
FUZZY_MEDIUM = 0.75                    # flag-for-review threshold

# Costa Rica place name overrides (authoritative spellings)
COSTA_RICA_PLACES = {
    "puntarena": "Puntarenas", "puntarenas": "Puntarenas", "puntarenAs": "Puntarenas",
    "puntarenäs": "Puntarenas", "punta arenas": "Puntarenas",
    "guanacaste": "Guanacaste", "guanacásté": "Guanacaste",
    "alajuela": "Alajuela", "alajuéla": "Alajuela",
    "heredia": "Heredia", "hérédia": "Heredia",
    "limon": "Limón", "limon": "Limón", "limón": "Limón",
    "cartago": "Cartago", "cARTAGO": "Cartago",
    "san jose": "San José", "sanjose": "San José", "san josé": "San José",
    "san josè": "San José",
    "arenal": "Arenal", "arenál": "Arenal",
    "poas": "Poás", "poás": "Poás", "poas": "Poás",
    "irazu": "Irazú", "irazú": "Irazú", "volcan irazu": "Volcán Irazú",
    "volcan poas": "Volcán Poás", "volcan arenal": "Volcán Arenal",
    "montezuma": "Montezuma",
    "tamarindo": "Tamarindo",
    "samara": "Sámara", "samara": "Sámara", "sámara": "Sámara",
    "carrillo": "Carillo", "playa carillo": "Playa Carillo",
    "playa-hermosa": "Playa Hermosa", "playa hermosa": "Playa Hermosa",
    "papagayo": "Papagayo", "peninsula papagayo": "Península Papagayo",
    "corcovado": "Corcovado",
    "tortuguero": "Tortuguero", "tortuguéro": "Tortuguero",
    "manuel antonio": "Manuel Antonio", "manuel-antonio": "Manuel Antonio",
    "dominical": "Dominical", "uvita": "Uvita",
    "puerto viejo": "Puerto Viejo", "puerto-viejo": "Puerto Viejo",
    "cahuita": "Cahuita",
    "jaco": "Jaco", "jaćo": "Jaco", "jaco beach": "Jaco Beach",
    "quetzal": "Quetzal", "resplendent quetzal": "Resplendent Quetzal",
    "scarlett macaw": "Scarlet Macaw", "scarlet-macaw": "Scarlet Macaw",
    "scarlatt macaw": "Scarlet Macaw", "scarlet macaw": "Scarlet Macaw",
    "scarlet macaw ": "Scarlet Macaw",
    "keel-billed toucan": "Keel-billed Toucan", "keel billed toucan": "Keel-billed Toucan",
    "keelbilled toucan": "Keel-billed Toucan",
    "montezuma oropendola": "Montezuma Oropendola", "montezuma oroupendola": "Montezuma Oropendola",
    "blue-crowned motmot": "Blue-crowned Motmot", "blue crowned motmot": "Blue-crowned Motmot",
    "turquoise-browed motmot": "Turquoise-browed Motmot", "turquoise browed motmot": "Turquoise-browed Motmot",
    "great green macaw": "Great Green Macaw", "great-green macaw": "Great Green Macaw",
    "costa rica": "Costa Rica", "costa-rica": "Costa Rica",
    "costa-rica-gallery": "Costa Rica Gallery", "costa rica gallery": "Costa Rica Gallery",
    "nicoya": "Nicoya", "peninsula de nicoya": "Península de Nicoya",
    "peninsula de osa": "Península de Osa", "corcovado peninsula": "Península de Osa",
    "nauyaca": "Nauyaca", "nauyaca waterfall": "Nauyaca Waterfalls",
    "rincon de la vieja": "Rincon de la Vieja", "rincón de la vieja": "Rincon de la Vieja",
    "rio savagre": "Rio Savagre", "savagre": "Savagre",
    "tarcoles": "Tárcoles", "tarcol": "Tárcoles",
    "golfo de nicoya": "Golfo de Nicoya",
    "las catalinas": "Las Catalinas", "las-catalinas": "Las Catalinas",
    "flamingo": "Flamingo", "flamingo beach": "Flamingo Beach",
    "playas del coco": "Playas del Coco", "playas-del coco": "Playas del Coco",
}

# ── DB helpers ──────────────────────────────────────────────────────────────────
def db():
    return psycopg2.connect(DB, connect_timeout=15)

def qa(sql, args=None):
    conn = db()
    cur = conn.cursor()
    cur.execute(sql, args or {})
    rows = cur.fetchall()
    conn.close()
    return rows

def q1(sql, args=None):
    rows = qa(sql, args)
    return rows[0][0] if rows else None

# ── EXIF extraction ────────────────────────────────────────────────────────────
def get_exif(path):
    """Extract EXIF data using ImageMagick identify."""
    try:
        result = subprocess.run(
            ["identify", "-format", "%[EXIF:*]", path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return {}
        exif = {}
        for line in result.stdout.splitlines():
            if "=" in line:
                key, val = line.split("=", 1)
                exif[key.strip()] = val.strip()
        return exif
    except Exception:
        return {}

# ── Perceptual hash ─────────────────────────────────────────────────────────────
def compute_phash(path):
    """Compute average perceptual hash using PIL."""
    try:
        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")
        return imagehash.phash(img, hash_size=8)
    except Exception:
        return None

def phash_similarity(h1, h2):
    if h1 is None or h2 is None:
        return 0.0
    return 1.0 - (h1 - h2) / 64.0  # hamming distance / max bits

# ── Image metadata ────────────────────────────────────────────────────────────────
def get_image_metadata(path):
    """Get dimensions, aspect ratio, and approximate capture time from file."""
    try:
        result = subprocess.run(
            ["identify", "-format", "%w %h %[EXIF:DateTime] %[EXIF:Make] %[EXIF:Model]", path],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return None
        parts = result.stdout.strip().split()
        if len(parts) < 2:
            return None
        width, height = int(parts[0]), int(parts[1])
        datetime_str = parts[2] if len(parts) > 2 else None
        make = parts[3] if len(parts) > 3 else None
        model = parts[4] if len(parts) > 4 else None
        aspect = width / height if height > 0 else 0
        return {
            "width": width, "height": height,
            "aspect": round(aspect, 4),
            "datetime": datetime_str,
            "make": make, "model": model,
        }
    except Exception:
        return None

# ── Filename similarity ─────────────────────────────────────────────────────────
def filename_stem_similarity(f1, f2):
    """Compare filename stems (no extension, no path)."""
    s1 = os.path.splitext(os.path.basename(f1))[0].lower()
    s2 = os.path.splitext(os.path.basename(f2))[0].lower()
    # Remove trailing numbers (sequence numbers)
    s1 = re.sub(r'\d+$', '', s1).strip()
    s2 = re.sub(r'\d+$', '', s2).strip()
    return SequenceMatcher(None, s1, s2).ratio()

# ── Layer 1: Exact hash duplicate ──────────────────────────────────────────────
def find_exact_hash_duplicates(content_hash):
    """Find photos in DB with the same content_hash."""
    rows = qa(
        "SELECT id, slug, gallery_id, gallery_slug, title, thumb_url, ready_for_public_render, r2_original_key FROM photos WHERE content_hash = %s",
        (content_hash,)
    )
    return [{
        "id": r[0], "slug": r[1], "gallery_id": r[2], "gallery_slug": r[3],
        "title": r[4], "thumb_url": r[5], "ready": r[6], "r2_key": r[7]
    } for r in rows]

# ── Layer 2: Perceptual + metadata duplicate ─────────────────────────────────────
def find_perceptual_duplicates(phash_obj, width, height, aspect, limit=10):
    """
    Find photos in DB that are likely the same photo using pre-computed
    perceptual hash proximity. Uses stored phash if available.
    Falls back to dimension + aspect ratio + camera proximity.
    """
    if phash_obj is None:
        # Fall back to dimension + aspect ratio only
        return find_dimension_duplicates(width, height, aspect)

    # Try to use stored phash column if it exists
    rows = qa("""
        SELECT id, slug, gallery_id, gallery_slug, title, thumb_url,
               ready_for_public_render, r2_original_key
        FROM photos
        WHERE phash IS NOT NULL
        ORDER BY
            (width IS NOT NULL AND ABS(width - %s) < %s)::int DESC,
            (aspect IS NOT NULL AND ABS(aspect - %s) < %s)::int DESC
        LIMIT %s
    """, (width, DIMENSION_TOLERANCE, aspect, ASPECT_TOLERANCE, limit))

    results = []
    for r in rows:
        stored_phash_str = q1("SELECT phash FROM photos WHERE id = %s", (r[0],))
        if not stored_phash_str:
            results.append({"id": r[0], "slug": r[1], "gallery_id": r[2],
                "gallery_slug": r[3], "title": r[4], "thumb_url": r[5],
                "ready": r[6], "r2_key": r[7], "similarity": 0.0})
            continue
        try:
            stored_hash = imagehash.hex_to_hash(stored_phash_str)
            sim = phash_similarity(phash_obj, stored_hash)
            results.append({"id": r[0], "slug": r[1], "gallery_id": r[2],
                "gallery_slug": r[3], "title": r[4], "thumb_url": r[5],
                "ready": r[6], "r2_key": r[7], "similarity": round(sim, 4)})
        except Exception:
            results.append({"id": r[0], "slug": r[1], "gallery_id": r[2],
                "gallery_slug": r[3], "title": r[4], "thumb_url": r[5],
                "ready": r[6], "r2_key": r[7], "similarity": 0.0})

    return results

def find_dimension_duplicates(width, height, aspect, limit=20):
    """Fallback: find photos with matching dimensions/aspect ratio."""
    rows = qa("""
        SELECT id, slug, gallery_id, gallery_slug, title, thumb_url,
               ready_for_public_render, r2_original_key, width, height
        FROM photos
        WHERE width IS NOT NULL AND height IS NOT NULL
          AND ABS(width - %s) < %s
          AND ABS(ASPECT(CAST(width AS NUMERIC), CAST(height AS NUMERIC)) - %s) < %s
        ORDER BY ABS(width - %s) ASC
        LIMIT %s
    """, (width, DIMENSION_TOLERANCE, aspect, ASPECT_TOLERANCE, width, limit))

    return [{
        "id": r[0], "slug": r[1], "gallery_id": r[2], "gallery_slug": r[3],
        "title": r[4], "thumb_url": r[5], "ready": r[6], "r2_key": r[7],
        "width": r[8], "height": r[9], "similarity": 0.5
    } for r in rows]

# ── Duplicate classification ────────────────────────────────────────────────────
def classify_duplicate(new_path, new_phash, new_meta, candidates):
    """
    Classify whether new_path is a duplicate of any candidate record.
    Returns: (classification, best_match_id_or_none, reason)
    """
    if not candidates:
        return "distinct_photo", None, "no_candidates"

    best = None
    best_score = 0.0
    best_reason = ""

    for cand in candidates:
        score = 0.0
        reasons = []

        # Exact hash match
        # (handled upstream — only perceptual path here)
        if new_meta and cand.get("width"):
            # Dimension match
            w_tol = abs(new_meta["width"] - cand.get("width", 0))
            a_tol = abs(new_meta["aspect"] - (cand.get("width", 1) / max(cand.get("height", 1), 1)))
            if w_tol < DIMENSION_TOLERANCE:
                score += 0.3
                reasons.append(f"dim_match(w={w_tol})")
            if a_tol < ASPECT_TOLERANCE:
                score += 0.1
                reasons.append(f"aspect_match")

        # Filename similarity
        fn_sim = filename_stem_similarity(new_path, cand.get("slug", ""))
        if fn_sim > 0.6:
            score += fn_sim * 0.3
            reasons.append(f"fname_sim={fn_sim:.2f}")

        # EXIF camera match
        if new_meta and cand.get("make") and new_meta.get("make"):
            if new_meta["make"].lower() == cand["make"].lower():
                score += 0.15
                reasons.append("camera_match")
            if new_meta.get("model", "").lower() == cand.get("model", "").lower():
                score += 0.1
                reasons.append("model_match")

        # EXIF datetime match
        if new_meta and new_meta.get("datetime") and cand.get("datetime"):
            if new_meta["datetime"] == cand["datetime"]:
                score += 0.25
                reasons.append("datetime_exact")

        # Perceptual similarity
        if new_phash and cand.get("similarity", 0) > PERCEPTUAL_SIMILARITY_THRESHOLD:
            score += cand["similarity"]
            reasons.append(f"phash_sim={cand['similarity']:.2f}")

        if score > best_score:
            best_score = score
            best = cand
            best_reason = "; ".join(reasons)

    if best_score >= 0.85:
        return "exact_duplicate", best["id"], best_reason
    elif best_score >= 0.60:
        return "likely_same_photo_variant", best["id"], best_reason
    else:
        return "distinct_photo", None, "no_strong_match"

# ── Canonical record selection ─────────────────────────────────────────────────
def select_canonical(new_record, existing_records):
    """
    Select the canonical record from a set of duplicate candidates.
    new_record = {path, width, height, metadata_complete, has_raw, phash, ...}
    existing_records = list of DB photo records
    """
    if not existing_records:
        return None  # no conflict — new record stands alone

    candidates = existing_records + [new_record]

    def score(r):
        s = 0
        if r.get("ready_for_public_render"):
            s += 40
        if r.get("metadata_complete"):
            s += 20
        if r.get("has_raw") or (r.get("r2_key") and "originals" in r.get("r2_key","")):
            s += 15
        # Prefer higher resolution
        s += min((r.get("width", 0) * r.get("height", 0)) / 1_000_000, 20)
        # Prefer older stable keys (if r2_key follows production pattern)
        if r.get("r2_key") and "originals/" in r.get("r2_key",""):
            s += 10
        return s

    scored = sorted(candidates, key=score, reverse=True)
    return scored[0]

# ── Spelling / text normalization ──────────────────────────────────────────────
def normalize_text(text):
    """Apply spelling corrections to a text string."""
    if not text or not isinstance(text, str):
        return text
    original = text
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Apply known corrections
    lower = text.lower()
    # Check for known misspellings
    for wrong, correct in COSTA_RICA_PLACES.items():
        # Match whole word or compound
        pattern = re.compile(r'\b' + re.escape(wrong) + r'\b', re.IGNORECASE)
        if pattern.search(text):
            text = pattern.sub(correct, text)
    return text

def normalize_keywords(keywords_str):
    """Normalize keyword string: fix spelling, dedupe by exact match, collapse case variants."""
    if not keywords_str:
        return keywords_str
    raw = keywords_str
    if ',' in raw:
        kw_list = [k.strip() for k in raw.split(',')]
    else:
        kw_list = re.split(r'[\s;|]+', raw)
    kw_list = [normalize_text(k) for k in kw_list if k.strip()]
    # Case-insensitive dedupe — keep first occurrence (preserve original casing from authoritative source)
    seen_lower = set()
    deduped = []
    for kw in kw_list:
        if kw.lower() not in seen_lower:
            seen_lower.add(kw.lower())
            deduped.append(kw)
    return ', '.join(deduped)

def normalize_location_name(loc):
    """Normalize location name."""
    return normalize_text(loc)

def normalize_species_name(name):
    """Normalize species common name — keep capitalization for proper species."""
    if not name:
        return name
    # Title-case the common name unless it's a known proper noun or acronym
    normalized = normalize_text(name)
    # Keep scientific names as-is
    if normalized and normalized[0].isupper() and ' ' in normalized:
        # Likely a proper species name — ensure title case
        words = normalized.split()
        corrected = []
        for w in words:
            w_lower = w.lower()
            if w_lower in ['macaw', 'toucan', 'quetzal', 'motmot', 'heron', 'hawk', 'owl',
                            'eagle', 'hummingbird', 'flycatcher', 'vireo', 'tanager',
                            'warbler', 'cardinal', 'grosbeak', 'oriole', 'robin']:
                corrected.append(w_lower.capitalize())
            else:
                corrected.append(w)
        normalized = ' '.join(corrected)
    return normalized

def normalize_gallery_name(name):
    """Normalize gallery/folder name to display title."""
    if not name:
        return name
    normalized = normalize_text(name)
    # Remove common path fragments
    normalized = re.sub(r'^(costa-?rica-?gallery[/\-]?|gallery[/\-]?)', '', normalized, flags=re.IGNORECASE)
    normalized = re.sub(r'[-_]+', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    # Title case
    normalized = normalized.title()
    return normalize_text(normalized)

def fuzzy_match(text, candidates, threshold=FUZZY_STRONG):
    """
    Fuzzy match text against a list of candidate strings.
    Returns (matched_candidate_or_None, score, is_strong)
    """
    if not text or not candidates:
        return None, 0.0, False
    best = None
    best_score = 0.0
    t_lower = text.lower().strip()
    for cand in candidates:
        if not cand:
            continue
        score = SequenceMatcher(None, t_lower, cand.lower().strip()).ratio()
        if score > best_score:
            best_score = score
            best = cand
    return best, best_score, best_score >= threshold

# ── Load DB reference data for fuzzy normalization ─────────────────────────────
def load_db_reference_data():
    """Load authoritative names from DB for fuzzy matching."""
    places = set(r[0] for r in qa("SELECT DISTINCT location_name FROM photos WHERE location_name IS NOT NULL AND location_name != ''") if r[0])
    galleries = set(r[0] for r in qa("SELECT DISTINCT name FROM galleries WHERE name IS NOT NULL AND name != ''") if r[0])
    species = set(r[0] for r in qa("SELECT DISTINCT species_common_name FROM photos WHERE species_common_name IS NOT NULL AND species_common_name != ''") if r[0])
    regions = set(r[0] for r in qa("SELECT DISTINCT region FROM photos WHERE region IS NOT NULL AND region != ''") if r[0])
    return {
        "locations": sorted(places),
        "galleries": sorted(galleries),
        "species": sorted(species),
        "regions": sorted(regions),
    }

# ── Batch normalizer ───────────────────────────────────────────────────────────
def normalize_fields(record):
    """
    Apply spelling normalization to all text fields in a record dict.
    Returns (normalized_record, corrections_log)
    """
    corrections = []
    norm = dict(record)

    for field in ['title', 'description', 'location_name', 'region', 'country',
                   'species_common_name', 'gallery_name', 'seo_title', 'meta_description',
                   'affiliate_blurb', 'keywords']:
        if field in norm and norm[field]:
            original = norm[field]
            corrected = normalize_text(original)
            if corrected != original:
                corrections.append(f"{field}: '{original}' → '{corrected}'")
                norm[field] = corrected

    # Normalize keywords specially
    if norm.get('keywords'):
        original_kw = norm['keywords']
        norm['keywords'] = normalize_keywords(original_kw)
        if norm['keywords'] != original_kw:
            corrections.append(f"keywords (deduped/normalized)")

    return norm, corrections

# ── Main duplicate detection + normalization for a batch ───────────────────────────
def process_batch(items):
    """
    items: list of dicts with keys: source_path, filename, content_hash, gallery_folder, ...
    Returns: (decisions, report)
      decisions: dict mapping item_id → {action, canonical_id, reason, normalization}
      report: dict of batch metrics
    """
    ref = load_db_reference_data()
    decisions = {}
    report = {
        "exact_hash_duplicates_skipped": 0,
        "perceptual_duplicates_skipped": 0,
        "likely_variants_flagged": 0,
        "canonical_records_reused": 0,
        "spelling_corrections_applied": 0,
        "normalized_locations_count": 0,
        "normalized_species_count": 0,
        "normalized_keywords_count": 0,
        "ambiguous_text_variants_flagged": 0,
        "manual_review_due_to_duplicate_uncertainty": 0,
        "spelling_corrections_examples": [],
    }
    spelling_examples = []

    for item in items:
        item_id = item.get("id", item.get("source_path", "?"))
        path = item.get("source_path", "")
        content_hash = item.get("content_hash", "")

        # ── Step 1: Exact hash duplicates ──────────────────────────────────
        exact_matches = find_exact_hash_duplicates(content_hash)
        if exact_matches:
            # Prefer canonical — keep the most complete existing record
            canonical = select_canonical(item, exact_matches)
            if canonical and canonical.get("id") != item_id:
                # New file is duplicate — skip
                report["exact_hash_duplicates_skipped"] += 1
                decisions[item_id] = {
                    "action": "skip_duplicate",
                    "reason": f"exact_hash_match:id={canonical['id']}",
                    "canonical_id": canonical.get("id"),
                }
                continue
            else:
                # New file is better source — replace
                decisions[item_id] = {
                    "action": "replace_older",
                    "reason": f"new_file_is_better_source:id={item_id}",
                    "canonical_id": item_id,
                }
                report["canonical_records_reused"] += 1

        # ── Perceptual + metadata comparison ────────────────────────────────
        new_phash = None
        new_meta = None
        if path and os.path.exists(path):
            new_meta = get_image_metadata(path)
            if new_meta:
                new_phash = compute_phash(path)
                candidates = find_perceptual_duplicates(
                    new_phash,
                    new_meta["width"],
                    new_meta["height"],
                    new_meta["aspect"],
                    limit=15
                )
                if candidates:
                    classification, match_id, reason = classify_duplicate(
                        path, new_phash, new_meta, candidates
                    )
                    if classification == "exact_duplicate":
                        report["perceptual_duplicates_skipped"] += 1
                        decisions[item_id] = {
                            "action": "skip_duplicate",
                            "reason": f"perceptual_match:{reason}",
                            "canonical_id": match_id,
                        }
                        continue
                    elif classification == "likely_same_photo_variant":
                        report["likely_variants_flagged"] += 1
                        decisions[item_id] = {
                            "action": "flag_variant_manual_review",
                            "reason": f"variant:{reason}",
                            "canonical_id": match_id,
                        }
                        report["manual_review_due_to_duplicate_uncertainty"] += 1

        # ── Spelling normalization ─────────────────────────────────────────
        normalized_item, corrections = normalize_fields(item)
        for corr in corrections:
            report["spelling_corrections_applied"] += 1
            if len(spelling_examples) < 10:
                spelling_examples.append(corr)
            for field in ['location_name', 'region']:
                if field in corr.lower():
                    report["normalized_locations_count"] += 1
            for field in ['species']:
                if field in corr.lower():
                    report["normalized_species_count"] += 1
            if 'keyword' in corr.lower():
                report["normalized_keywords_count"] += 1

        decisions[item_id]["normalization"] = corrections

        # ── Fuzzy check against DB references ─────────────────────────────
        for field in ['location_name', 'species_common_name', 'gallery_name']:
            val = normalized_item.get(field)
            if not val:
                continue
            ref_list = ref.get({
                'location_name': 'locations',
                'species_common_name': 'species',
                'gallery_name': 'galleries',
            }.get(field, ''), [])
            if not ref_list:
                continue
            matched, score, is_strong = fuzzy_match(val, ref_list)
            if is_strong and matched and matched != val:
                # Auto-correct
                old_val = normalized_item[field]
                normalized_item[field] = normalize_text(matched)
                decisions[item_id]["normalization"].append(
                    f"fuzzy_match:{field} '{old_val}' → '{matched}' (score={score:.2f})"
                )
                report["spelling_corrections_applied"] += 1
            elif score >= FUZZY_MEDIUM and matched and matched != val:
                # Medium match — flag for review
                decisions[item_id]["ambiguous_variant"] = True
                report["ambiguous_text_variants_flagged"] += 1

        # Distinct photo — process normally
        if item_id not in decisions:
            decisions[item_id] = {"action": "process", "reason": "distinct_photo"}

    report["spelling_corrections_examples"] = spelling_examples[:5]
    return decisions, report

# ── CLI ─────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python3 import_dedup_normalize.py <queue_items.json>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        items = json.load(f)

    decisions, report = process_batch(items)

    print("\n=== DEDUP + NORMALIZATION REPORT ===")
    for k, v in report.items():
        if k != "spelling_corrections_examples":
            print(f"  {k}: {v}")
    print("\n  Spelling correction examples:")
    for ex in report["spelling_corrections_examples"]:
        print(f"    - {ex}")

    print(f"\n  Decisions: {len(decisions)}")
    action_counts = defaultdict(int)
    for d in decisions.values():
        action_counts[d.get("action","?")] += 1
    for action, count in sorted(action_counts.items()):
        print(f"    {action}: {count}")

    # Save decisions
    out_file = "/tmp/dedup_normalize_decisions.json"
    with open(out_file, "w") as f:
        json.dump({"decisions": decisions, "report": report}, f, indent=2, default=str)
    print(f"\n  Decisions → {out_file}")
