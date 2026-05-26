#!/usr/bin/env python3
"""
Phase 2 — Internal Linking Audit & Injector

Audit findings for species/[slug]/page.tsx and location/[slug]/page.tsx, plus
DB injection to expand page_links beyond current junction data.
"""

import psycopg2
import time
from datetime import datetime

DATABASE_URL = (
    "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech"
    "/wildphotography?sslmode=require&channel_binding=require"
)

BATCH_SIZE = 50
SLEEP_MS = 300
LOG_FILE = "/Users/joshuatenbrink/wildphotography_cloudflare_src/reports/internal_linking_log.txt"


def log(msg):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


# ─────────────────────────────────────────────
# AUDIT
# ─────────────────────────────────────────────

def audit_species_page():
    log("\n=== SPECIES PAGE AUDIT ===")
    log("Sections in species/[slug]/page.tsx:")
    log("  [EXISTING] Breadcrumb → /, /species (hardcoded Link)")
    log("  [EXISTING] Featured Photos — VirtualizedGallery (0 outbound links)")
    log("  [EXISTING] Where to See → up to 10 location links from page_links WHERE target_type='location'")
    log("  [EXISTING] Galleries Featuring → up to 6 gallery links from page_links WHERE target_type='gallery'")
    log("  [EXISTING] Related Species → up to 6 species links from page_links WHERE target_type='species'")
    log("  [EXISTING] Travel Guides → up to 3 article links from page_links WHERE target_type='article'")
    log("  [EXISTING] Tours CTA → hardcoded /location/{slug}, not via page_links")
    log("  [EXISTING] All Photos — VirtualizedGallery (0 outbound links)")
    log("")
    log("  [MISSING] Photo Map link — static Next.js page with no DB entity, no 'page' target_type available")
    log("  [MISSING] Licensing link — same situation")
    log("  [LOW] Related Species UI cap at 6; DB has no limit — more available via region match")
    log("  [LOW] Locations UI cap at 10; DB has more locations per region")
    log("")
    log("  Current outbound link budget: ~36 junction-driven links max")
    log("  Recommended injection: expand species→species, species→location beyond UI caps")


def audit_location_page():
    log("\n=== LOCATION PAGE AUDIT ===")
    log("Sections in location/[slug]/page.tsx:")
    log("  [EXISTING] Breadcrumb → /, /location (hardcoded)")
    log("  [EXISTING] Overview text — metadata-driven (0 outbound links)")
    log("  [EXISTING] Highlights list (0 outbound links)")
    log("  [EXISTING] Info panel → inline chips for species, not linked")
    log("  [EXISTING] Gallery Links → from metadata JSON (up to 10, not DB-driven)")
    log("  [EXISTING] Species Links → from metadata JSON (up to 16, not DB-driven)")
    log("  [EXISTING] Nearby Locations → same-region filter, hardcoded slice of 6")
    log("  [EXISTING] Book a Tour → affiliate blocks")
    log("  [EXISTING] Photo Gallery — VirtualizedGallery (0 outbound links)")
    log("")
    log("  [MISSING] Photo Map link — static page, no 'page' target_type in page_links")
    log("  [MISSING] Licensing link — same")
    log("  [MISSING] Breadcrumb region link")
    log("  [LOW] Nearby Locations hardcoded at 6; DB may have more same-region locations")
    log("  [LOW] Gallery links from metadata JSON — risk of stale/missing vs DB-driven page_links")
    log("  [LOW] Species links from metadata JSON — same")
    log("")
    log("  Recommended injection: expand location→location (same region) and location→gallery")


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    return conn, conn.cursor()


def link_exists(cur, st, sid, tt, tid):
    cur.execute(
        "SELECT 1 FROM page_links WHERE source_type=%s AND source_id=%s AND target_type=%s AND target_id=%s LIMIT 1",
        (st, sid, tt, tid),
    )
    return cur.fetchone() is not None


def insert_link(cur, st, sid, tt, tid, weight=50, link_type="contextual", anchor_text=None):
    if link_exists(cur, st, sid, tt, tid):
        return False
    cur.execute(
        "INSERT INTO page_links (source_type, source_id, target_type, target_id, weight, link_type, anchor_text) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (st, sid, tt, tid, weight, link_type, anchor_text),
    )
    return True


# ─────────────────────────────────────────────
# SPECIES INJECTOR
# ─────────────────────────────────────────────

def inject_species_links(conn, cur):
    """
    Strategy:
    - species→species: find species that share at least one location in common
      (via photo_species → photos → photo_locations → locations), not already linked
    - species→location: find locations that have photos of this species,
      not already linked
    - species→gallery: find galleries whose cover photo contains this species,
      not already linked
    """
    log("\n=== INJECTING SPECIES INTERNAL LINKS ===")

    cur.execute("SELECT id, slug, common_name FROM species WHERE is_public = true ORDER BY id")
    all_species = cur.fetchall()
    log(f"  Found {len(all_species)} public species")

    total = 0

    for sp_id, sp_slug, sp_name in all_species:
        injected = 0

        # --- species → species (same region via location sharing) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='species' AND source_id=%s AND target_type='species'
        """, (sp_id,))
        existing_sp = {row[0] for row in cur.fetchall()}

        # Find species that share at least one location with this species
        cur.execute("""
            SELECT DISTINCT s.id, s.slug, s.common_name
            FROM species s
            JOIN photo_species ps1 ON ps1.species_id = %s
            JOIN photo_locations pl1 ON pl1.photo_id = ps1.photo_id
            JOIN photo_species ps2 ON ps2.photo_id = pl1.photo_id AND ps2.species_id = s.id
            WHERE s.id != %s AND s.is_public = true
            LIMIT 12
        """, (sp_id, sp_id))
        candidates = cur.fetchall()

        for rank, (rel_id, rel_slug, rel_name) in enumerate(candidates):
            if rel_id in existing_sp:
                continue
            if len(existing_sp) + injected >= 12:
                break
            w = max(20, 50 - rank * 3)
            if insert_link(cur, "species", sp_id, "species", rel_id, weight=w):
                existing_sp.add(rel_id)
                injected += 1

        # --- species → location (locations with photos of this species) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='species' AND source_id=%s AND target_type='location'
        """, (sp_id,))
        existing_loc = {row[0] for row in cur.fetchall()}

        cur.execute("""
            SELECT DISTINCT l.id, l.slug, l.name
            FROM locations l
            JOIN photo_locations pl ON pl.location_id = l.id
            JOIN photo_species ps ON ps.photo_id = pl.photo_id
            WHERE ps.species_id = %s AND l.is_public = true
            LIMIT 20
        """, (sp_id,))
        loc_candidates = cur.fetchall()

        for rank, (loc_id, loc_slug, loc_name) in enumerate(loc_candidates):
            if loc_id in existing_loc:
                continue
            if len(existing_loc) + injected >= 12:
                break
            w = max(15, 40 - rank * 2)
            if insert_link(cur, "species", sp_id, "location", loc_id, weight=w):
                existing_loc.add(loc_id)
                injected += 1

        # --- species → gallery (galleries whose cover photo features this species) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='species' AND source_id=%s AND target_type='gallery'
        """, (sp_id,))
        existing_gal = {row[0] for row in cur.fetchall()}

        cur.execute("""
            SELECT DISTINCT g.id, g.slug, g.name
            FROM galleries g
            JOIN photos p ON p.id = g.cover_photo_id::integer
            JOIN photo_species ps ON ps.photo_id = p.id
            WHERE ps.species_id = %s AND g.is_active = true
            LIMIT 6
        """, (sp_id,))
        gal_candidates = cur.fetchall()

        for rank, (gal_id, gal_slug, gal_name) in enumerate(gal_candidates):
            if gal_id in existing_gal:
                continue
            w = max(15, 35 - rank * 3)
            if insert_link(cur, "species", sp_id, "gallery", gal_id, weight=w):
                existing_gal.add(gal_id)
                injected += 1

        if injected > 0:
            total += injected
            conn.commit()

    log(f"  Species page_links injected (total): {total}")
    return total


# ─────────────────────────────────────────────
# LOCATION INJECTOR
# ─────────────────────────────────────────────

def inject_location_links(conn, cur):
    """
    Strategy:
    - location→location: same region, not self, not already linked
    - location→gallery: galleries whose cover photo is from this location
    - location→species: species photographed at this location (ranked by photo count)
    """
    log("\n=== INJECTING LOCATION INTERNAL LINKS ===")

    cur.execute("SELECT id, slug, name, region FROM locations WHERE is_public = true ORDER BY id")
    all_locations = cur.fetchall()
    log(f"  Found {len(all_locations)} public locations")

    total = 0

    for loc_id, loc_slug, loc_name, loc_region in all_locations:
        injected = 0

        # --- location → location (same region) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='location' AND source_id=%s AND target_type='location'
        """, (loc_id,))
        existing_near = {row[0] for row in cur.fetchall()}

        cur.execute("""
            SELECT l.id, l.slug, l.name
            FROM locations l
            WHERE l.region = %s AND l.id != %s AND l.is_public = true
            LIMIT 20
        """, (loc_region or "", loc_id))
        near_candidates = cur.fetchall()

        for rank, (near_id, near_slug, near_name) in enumerate(near_candidates):
            if near_id in existing_near:
                continue
            w = max(15, 50 - rank * 2)
            if insert_link(cur, "location", loc_id, "location", near_id, weight=w):
                existing_near.add(near_id)
                injected += 1

        # --- location → gallery (cover photo from this location) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='location' AND source_id=%s AND target_type='gallery'
        """, (loc_id,))
        existing_gals = {row[0] for row in cur.fetchall()}

        cur.execute("""
            SELECT DISTINCT g.id, g.slug, g.name
            FROM galleries g
            JOIN photos p ON p.id = g.cover_photo_id::integer
            JOIN photo_locations pl ON pl.photo_id = p.id
            WHERE pl.location_id = %s AND g.is_active = true
            LIMIT 12
        """, (loc_id,))
        gal_candidates = cur.fetchall()

        for rank, (gal_id, gal_slug, gal_name) in enumerate(gal_candidates):
            if gal_id in existing_gals:
                continue
            w = max(15, 40 - rank * 2)
            if insert_link(cur, "location", loc_id, "gallery", gal_id, weight=w):
                existing_gals.add(gal_id)
                injected += 1

        # --- location → species (species photographed at this location, ranked by count) ---
        cur.execute("""
            SELECT target_id FROM page_links
            WHERE source_type='location' AND source_id=%s AND target_type='species'
        """, (loc_id,))
        existing_spec = {row[0] for row in cur.fetchall()}

        cur.execute("""
            SELECT s.id, s.slug, s.common_name
            FROM species s
            JOIN photo_species ps ON ps.species_id = s.id
            JOIN photo_locations pl ON pl.photo_id = ps.photo_id
            WHERE pl.location_id = %s AND s.is_public = true
            GROUP BY s.id
            ORDER BY COUNT(ps.photo_id) DESC
            LIMIT 16
        """, (loc_id,))
        spec_candidates = cur.fetchall()

        for rank, (sp_id, sp_slug, sp_name) in enumerate(spec_candidates):
            if sp_id in existing_spec:
                continue
            w = max(15, 45 - rank * 2)
            if insert_link(cur, "location", loc_id, "species", sp_id, weight=w):
                existing_spec.add(sp_id)
                injected += 1

        if injected > 0:
            total += injected
            conn.commit()

    log(f"  Location page_links injected (total): {total}")
    return total


def count_links(cur):
    cur.execute(
        "SELECT source_type, target_type, COUNT(*) FROM page_links GROUP BY source_type, target_type ORDER BY source_type, target_type"
    )
    return cur.fetchall()


def main():
    with open(LOG_FILE, "w") as f:
        f.write("")

    log("=== PHASE 2: INTERNAL LINKING AUDIT + INJECTION ===\n")

    audit_species_page()
    audit_location_page()

    # Pre-inject snapshot
    conn, cur = get_db()
    log("\n=== PAGE_LINKS (pre-injection) ===")
    for row in count_links(cur):
        log(f"  {row[0]} → {row[1]}: {row[2]}")
    cur.close()
    conn.close()

    # Inject species
    time.sleep(SLEEP_MS / 1000)
    conn, cur = get_db()
    sp_injected = inject_species_links(conn, cur)
    cur.close()
    conn.close()

    # Inject locations
    time.sleep(SLEEP_MS / 1000)
    conn, cur = get_db()
    loc_injected = inject_location_links(conn, cur)
    cur.close()
    conn.close()

    # Post-inject snapshot
    conn, cur = get_db()
    log("\n=== PAGE_LINKS (post-injection) ===")
    for row in count_links(cur):
        log(f"  {row[0]} → {row[1]}: {row[2]}")
    cur.close()
    conn.close()

    log("\n=== PHASE 2 COMPLETE ===")
    log(f"Species rows added: {sp_injected}")
    log(f"Location rows added: {loc_injected}")
    print("\nDONE.")


if __name__ == "__main__":
    main()
