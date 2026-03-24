# wild_pinterest_board_rules

## Board Assignment Logic

Use these rules to assign each pin to a board. Apply the **first matching rule** top-to-bottom.

---

## Core Boards

### Costa Rica Beaches
**Assign when any of the following match:**
- `primary_keyword` contains: beach, coast, coastline, shore, bay, playa, cove, surf
- `page_type` is `location` and location is coastal (Jacó, Manuel Antonio, Tamarindo, Sámara, Nosara, Dominical, Santa Teresa, Montezuma, Mal País, Puntarenas, Herradura, Esterillos, Playa Hermosa, Guanacaste beaches)
- `title` contains: beach, beaches, coastal, coast, bay, playa

### Costa Rica Wildlife
**Assign when any of the following match:**
- `page_type` is `species`
- `primary_keyword` contains: wildlife, animal, bird, monkey, sloth, jaguar, crocodile, turtle, iguana, frog, reptile, mammal, amphibian, butterfly, insect
- `title` contains: wildlife, animals, birds, species, monkey, sloth, macaw, toucan, hummingbird, quetzal, scarlet macaw

### Costa Rica Photography
**Assign when any of the following match:**
- `page_type` is `gallery`
- `primary_keyword` contains: photography, photo, photographer, camera, aerial, shoot, capture, image
- `title` contains: photography, photos, gallery, photographer, images, aerial

### Arenal Volcano Costa Rica
**Assign when any of the following match:**
- `location_slug` contains: arenal
- `title` or `primary_keyword` contains: arenal, la fortuna

### Manuel Antonio Costa Rica
**Assign when any of the following match:**
- `location_slug` contains: manuel-antonio
- `title` or `primary_keyword` contains: manuel antonio

### Monteverde Costa Rica
**Assign when any of the following match:**
- `location_slug` contains: monteverde, santa-elena
- `title` or `primary_keyword` contains: monteverde, cloud forest, santa elena

### Guanacaste Costa Rica
**Assign when any of the following match:**
- `region_slug` contains: guanacaste
- `title` or `primary_keyword` contains: guanacaste, nicoya, liberia, tamarindo, nosara, sámara, samara

### Tortuguero Costa Rica
**Assign when any of the following match:**
- `location_slug` contains: tortuguero
- `title` or `primary_keyword` contains: tortuguero, turtle nesting, sea turtle

### Osa Peninsula Costa Rica
**Assign when any of the following match:**
- `location_slug` contains: osa, corcovado, puerto-jimenez, bahia-drake
- `title` or `primary_keyword` contains: osa peninsula, corcovado, drake bay, puerto jimenez

---

## SEO Boards (Broad Keyword Boards)

### Best Beaches in Costa Rica
**Assign when:**
- Content is a best-of beach roundup article
- `page_type` is `article` AND `primary_keyword` contains: best beaches

### Costa Rica Travel Guide
**Assign when:**
- `page_type` is `article` AND content is a general travel guide (not species-specific)
- `primary_keyword` contains: travel guide, trip, visit, itinerary, things to do, vacation

### Wildlife in Costa Rica
**Assign when:**
- `page_type` is `article` AND content covers multiple wildlife species or wildlife watching in general
- `primary_keyword` contains: wildlife watching, wildlife guide, animals in costa rica

### Tropical Destinations
**Assign when:**
- Content covers Costa Rica as a destination broadly
- No more specific board matched above

---

## Default Fallback Board

### Costa Rica Travel
**Assign when:**
- None of the rules above match
- Use this as the catch-all for any Costa Rica content

---

## Board Assignment Output

Return `board_name` as the **exact string** matching one of the board names listed above. Do not invent new board names.

Valid board names (exact strings):
- `Costa Rica Beaches`
- `Costa Rica Wildlife`
- `Costa Rica Photography`
- `Arenal Volcano Costa Rica`
- `Manuel Antonio Costa Rica`
- `Monteverde Costa Rica`
- `Guanacaste Costa Rica`
- `Tortuguero Costa Rica`
- `Osa Peninsula Costa Rica`
- `Best Beaches in Costa Rica`
- `Costa Rica Travel Guide`
- `Wildlife in Costa Rica`
- `Tropical Destinations`
- `Costa Rica Travel`

---

## Multi-Board Strategy (Advanced)

When a pin is highly relevant to more than one board, generate **separate pin variations** targeting each board — one pin per board, with slightly different copy tailored to each board's audience. Do not post identical pins to multiple boards.

Example:
- A Scarlet Macaw article → generate one pin for `Costa Rica Wildlife`, one for `Costa Rica Photography`
- A Manuel Antonio beach article → generate one pin for `Manuel Antonio Costa Rica`, one for `Costa Rica Beaches`
