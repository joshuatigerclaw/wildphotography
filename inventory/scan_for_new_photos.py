#!/usr/bin/env python3
"""
Scan all Costa-Rica-Gallery folders for unindexed photos.
Does full SHA256 scan of disk files vs all hashes in Neon.
Picks 5 folders with most new photos.
"""
import os
import json
import hashlib
import psycopg2

BASE = '/Volumes/ADATA SC740/Smugmug Backup/Galleries'
QUEUE_PATH = '/Users/joshuatenbrink/.openclaw/workspace/wildphotography/inventory/fresh_batch_next_5.json'
NEON_CONN = "postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require"

EXTENSIONS = ('.jpg', '.jpeg', '.png', '.heic')

GALLERY_MAP = {
    # === EXPANDED 2026-06-06: 93 entries (was 51) ===
    # Original 51 entries
    "Costa-Rica-Gallery/Boats-in-Costa-Rica": (21, "boats-in-costa-rica"),
    "Costa-Rica-Gallery/Butterflies": (22, "butterflies"),
    "Costa-Rica-Gallery/Cartago": (23, "cartago"),
    "Costa-Rica-Gallery/Coyol-de-Alajuela": (29, "coyol-de-alajuela"),
    "Costa-Rica-Gallery/Crocodiles": (30, "crocodiles"),
    "Costa-Rica-Gallery/Guanacaste-Costa-Rica-Travel-and-Tourism": (40, "guanacaste-costa-rica-travel-and-tourism"),
    "Costa-Rica-Gallery/Isla-Tortuga": (47, "isla-tortuga"),
    "Costa-Rica-Gallery/Jaco-Beach": (48, "jaco-beach"),
    "Costa-Rica-Gallery/Limon-Puerto-Viejo-Cocles-Playa-Chiquita-y-Punta-Uva": (57, "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"),
    "Costa-Rica-Gallery/Marine-Life-of-Costa-Rica": (58, "marine-life-of-costa-rica"),
    "Costa-Rica-Gallery/Montezuma-Costa-Rica": (60, "montezuma-costa-rica"),
    "Costa-Rica-Gallery/Peninsula-Papagayo": (65, "peninsula-papagayo"),
    "Costa-Rica-Gallery/Punta-Leona": (80, "punta-leona"),
    "Costa-Rica-Gallery/Sunrise-Sunset": (93, "sunrise-sunset"),
    "Costa-Rica-Gallery/Tambor-Nicoya-Peninsula-Costa-Rica": (95, "tambor-nicoya-peninsula-costa-rica"),
    "Costa-Rica-Gallery/Alajuela": (15, "alajuela"),
    "Costa-Rica-Gallery/Flamingo-Beach": (33, "flamingo-beach"),
    "Costa-Rica-Gallery/Food-": (37, "food"),
    "Costa-Rica-Gallery/Nauyaca-Waterfalls": (62, "nauyaca-waterfalls"),
    "Costa-Rica-Gallery/Birds": (5, "birds"),
    "Costa-Rica-Gallery/Escazu-Costa-Rica": (32, "escazu-costa-rica"),
    "Costa-Rica-Gallery/Dominical-and-Uvita": (31, "dominical-and-uvita"),
    "Costa-Rica-Gallery/Best-of-Costa-Rica": (19, "best-of-costa-rica"),
    "Costa-Rica-Gallery/Costa-Rica": (25, "costa-rica"),
    "Costa-Rica-Gallery/Flowers-plants-trees": (35, "flowers-plants-trees"),
    "Costa-Rica-Gallery/Samara-Playa-Carillo": (87, "samara-playa-carillo"),
    "Costa-Rica-Gallery/San-Jose-Costa-Rica": (88, "san-jose-costa-rica"),
    "Costa-Rica-Gallery/La-Sabana-Estadio-Nacional-Costa-Rica-San-Jose": (50, "la-sabana-estadio-nacional-costa-rica-san-jose"),
    "Costa-Rica-Gallery/Playa-Hermosa-Guanacaste": (70, "playa-hermosa-guanacaste"),
    "Costa-Rica-Gallery/Tamarindo-Guanacaste-Costa-Rica": (94, "tamarindo-guanacaste-costa-rica"),
    "Costa-Rica-Gallery/Puerto-Caldera-Puntarenas-Port": (78, "puerto-caldera-puntarenas-port"),
    "Costa-Rica-Gallery/Beaches": (18, "beaches"),
    "Costa-Rica-Gallery/Peninsula-de-Osa": (67, "peninsula-de-osa"),
    "Costa-Rica-Gallery/Santa-Teresa-Malpais": (91, "santa-teresa-malpais"),
    "Costa-Rica-Gallery/Puntarenas-Costa-Rica": (81, "puntarenas-costa-rica"),
    "Costa-Rica-Gallery/Golfo-de-Nicoya": (39, "golfo-de-nicoya"),
    "Costa-Rica-Gallery/Playas-del-Coco": (73, "playas-del-coco"),
    "Costa-Rica-Gallery/Waterfalls-in-Costa-Rica": (100, "waterfalls-in-costa-rica"),
    "Costa-Rica-Gallery/Landscape": (54, "landscape"),
    "Costa-Rica-Gallery/Wildlife": (6, "wildlife"),
    "Costa-Rica-Gallery/Insects-and-Butterflies": (44, "insects-and-butterflies"),
    "Costa-Rica-Gallery/Monkeys": (59, "monkeys"),
    "Costa-Rica-Gallery/Turtles": (12, "turtles"),
    "Costa-Rica-Gallery/Birds-Macaws-Lapas": (20, "birds-macaws-lapas"),
    "Costa-Rica-Gallery/Volcan-Irazu": (14, "volcan-irazu"),
    "Costa-Rica-Gallery/Poas-Volcano-Costa-Rica": (74, "poas-volcano-costa-rica"),
    "Costa-Rica-Gallery/Arenal-Volcano": (16, "arenal-volcano"),
    "Costa-Rica-Gallery/Rincon-de-La-Vieja": (83, "rincon-de-la-vieja"),
    "Costa-Rica-Gallery/Forests-of-Costa-Rica": (38, "forests-of-costa-rica"),
    "Costa-Rica-Gallery/Rivers": (13, "rivers"),
    "Costa-Rica-Gallery/Food": (37, "food"),
    # New entries 2026-06-06: 42 unmapped folders with verified Neon galleries
    "Costa-Rica-Gallery/Bajos-del-Toro-Costa-Rica": (17, "bajos-del-toro-costa-rica"),
    "Costa-Rica-Gallery/Conchal-Guanacaste": (24, "conchal-guanacaste"),
    "Costa-Rica-Gallery/Costa-Rica-Buildings": (26, "costa-rica-buildings"),
    "Costa-Rica-Gallery/Costa-Rica-Travel-Tourism": (27, "costa-rica-travel-tourism"),
    "Costa-Rica-Gallery/Flora-Fauna": (34, "flora-fauna"),
    "Costa-Rica-Gallery/Flying-in-Costa-Rica": (36, "flying-in-costa-rica"),
    "Costa-Rica-Gallery/Heredia-Costa-Rica": (41, "heredia-costa-rica"),
    "Costa-Rica-Gallery/Hotels-of-Costa-Rica": (42, "hotels-of-costa-rica"),
    "Costa-Rica-Gallery/Industrial-Costa-Rica": (43, "industrial-costa-rica"),
    "Costa-Rica-Gallery/Inspirational-Quotes": (45, "inspirational-quotes"),
    "Costa-Rica-Gallery/Isla-San-Lucas-Puntarenas-Costa-Rica": (46, "isla-san-lucas-puntarenas-costa-rica"),
    "Costa-Rica-Gallery/Juan-Santamaria-San-Jose-Airport-SJO-": (49, "juan-santamaria-san-jose-airport-sjo"),
    "Costa-Rica-Gallery/Lakes": (51, "lakes"),
    "Costa-Rica-Gallery/Land-Animals": (52, "land-animals"),
    "Costa-Rica-Gallery/Landmarks": (53, "landmarks"),
    "Costa-Rica-Gallery/Las-Catalinas-Guanacaste": (55, "las-catalinas-guanacaste"),
    "Costa-Rica-Gallery/Lifestyle": (56, "lifestyle"),
    "Costa-Rica-Gallery/Moon": (61, "moon"),
    "Costa-Rica-Gallery/Night-Photography": (63, "night-photography"),
    "Costa-Rica-Gallery/Papagayo-Bahia-Culebra": (64, "papagayo-bahia-culebra"),
    "Costa-Rica-Gallery/Peninsula-de-Nicoya": (66, "peninsula-de-nicoya"),
    "Costa-Rica-Gallery/People-Watching": (68, "people-watching"),
    "Costa-Rica-Gallery/Perez-Zeledon-San-Isidro-del-General": (69, "perez-zeledon-san-isidro-del-general"),
    "Costa-Rica-Gallery/Playa-Hermosa-Jaco-Garabito": (71, "playa-hermosa-jaco-garabito"),
    "Costa-Rica-Gallery/Playa-Real-Roble-Guanacaste-Costa-Rica": (72, "playa-real-roble-guanacaste-costa-rica"),
    "Costa-Rica-Gallery/Potrero-Beach-Guanacaste": (75, "potrero-beach-guanacaste"),
    "Costa-Rica-Gallery/Power-of-Nature": (76, "power-of-nature"),
    "Costa-Rica-Gallery/Puenta-de-la-Amistad-Tempisque": (77, "puenta-de-la-amistad-tempisque"),
    "Costa-Rica-Gallery/Punta-Cacique-Guancaste": (79, "punta-cacique-guancaste"),
    "Costa-Rica-Gallery/Random-Places-of-Costa-Rica": (82, "random-places-of-costa-rica"),
    "Costa-Rica-Gallery/Rio-Savagre-Costa-Rica": (84, "rio-savagre-costa-rica"),
    "Costa-Rica-Gallery/Roads-Bridges-and-Infrastructure": (85, "roads-bridges-and-infrastructure"),
    "Costa-Rica-Gallery/Rural-Costa-Rica": (86, "rural-costa-rica"),
    "Costa-Rica-Gallery/San-Rafael-de-Alajuela": (89, "san-rafael-de-alajuela"),
    "Costa-Rica-Gallery/Santa-Ana-Costa-Rica": (90, "santa-ana-costa-rica"),
    "Costa-Rica-Gallery/Sports-and-Adventure": (92, "sports-and-adventure"),
    "Costa-Rica-Gallery/Surfing-Costa-Rica": (10, "surfing-costa-rica"),
    "Costa-Rica-Gallery/Tambor-Photos": (96, "tambor-photos"),
    "Costa-Rica-Gallery/Tarcoles-": (97, "tarcoles"),
    "Costa-Rica-Gallery/The-Environment-": (98, "the-environment"),
    "Costa-Rica-Gallery/The-Ocean": (99, "the-ocean"),
    "Costa-Rica-Gallery/Water-Sports-and-Surfing": (9, "water-sports-and-surfing"),
}

print("Loading existing content hashes from Neon...")
conn = psycopg2.connect(NEON_CONN)
cur = conn.cursor()
cur.execute("SELECT content_hash FROM photos WHERE content_hash IS NOT NULL")
existing_hashes = set(row[0] for row in cur.fetchall())
cur.close()
conn.close()
print(f"  Existing hashes in DB: {len(existing_hashes)}")

cr_gallery_path = os.path.join(BASE, 'Costa-Rica-Gallery')
if not os.path.isdir(cr_gallery_path):
    print(f" Costa-Rica-Gallery folder not found at {cr_gallery_path}")
    exit(1)

folder_stats = []
all_subfolders = sorted([d for d in os.listdir(cr_gallery_path) if os.path.isdir(os.path.join(cr_gallery_path, d))])

print(f"\nScanning {len(all_subfolders)} subfolders for new photos...")
for subfolder in all_subfolders:
    folder_key = f"Costa-Rica-Gallery/{subfolder}"
    if folder_key not in GALLERY_MAP:
        continue
    
    folder_path = os.path.join(cr_gallery_path, subfolder)
    image_files = sorted([
        f for f in os.listdir(folder_path)
        if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
    ])
    
    new_count = 0
    for filename in image_files:
        source_path = os.path.join(folder_path, filename)
        if not os.path.exists(source_path):
            continue
        with open(source_path, 'rb') as f:
            h = hashlib.md5(f.read()).hexdigest()
        if h not in existing_hashes:
            new_count += 1
    
    if new_count > 0:
        folder_stats.append((new_count, len(image_files), subfolder, folder_key))
        print(f"  {subfolder}: {new_count} new / {len(image_files)} total")

folder_stats.sort(reverse=True)
print(f"\nTop folders by new photos:")
for new, total, subfolder, folder_key in folder_stats[:15]:
    print(f"  {subfolder}: {new} new")

if not folder_stats:
    print("\n No new photos found in any mapped gallery folder.")
    exit(0)

top5 = folder_stats[:5]
print(f"\nBuilding batch from top 5:")
for new, total, subfolder, folder_key in top5:
    print(f"  {subfolder}: {new} new")

gallery_id, gallery_slug = GALLERY_MAP[top5[0][3]]
print(f"\nNote: Only using first folder ({top5[0][2]}) to avoid exceeding gallery_id mapping")
print(f"Building batch for just {top5[0][2]} as a test...")

items = []
folder_key = top5[0][3]
gallery_id, gallery_slug = GALLERY_MAP[folder_key]
folder_path = os.path.join(cr_gallery_path, top5[0][2])

image_files = sorted([
    f for f in os.listdir(folder_path)
    if f.lower().endswith(EXTENSIONS) and not f.startswith('._')
])

new_count = 0
for filename in image_files:
    source_path = os.path.join(folder_path, filename)
    if not os.path.exists(source_path):
        continue
    with open(source_path, 'rb') as f:
        h = hashlib.md5(f.read()).hexdigest()
    if h not in existing_hashes:
        item = {
            'id': f'ext_{folder_key.replace("/","_")}_{h[:16]}',
            'type': 'photo',
            'source_path': source_path,
            'gallery_folder': folder_key,
            'gallery_id': gallery_id,
            'gallery_slug': gallery_slug,
            'filename': filename,
            'content_hash': h,
            'size': os.path.getsize(source_path),
            'approved': True,
            'priority': 50,
            'attempt_count': 0,
            'status': 'pending'
        }
        items.append(item)
        new_count += 1

print(f"Batch: {new_count} new items for {top5[0][2]}")

with open(QUEUE_PATH, 'w') as f:
    json.dump(items, f, indent=2)
print(f"Saved {len(items)} items to {QUEUE_PATH}")