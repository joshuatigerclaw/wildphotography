-- SEO Location Derivation SQL — 1,689 photos across 20 geo-specific gallery slugs
-- Safe updates: gallery_slug maps unambiguously to a Costa Rica location
-- Requires manual approval before running

BEGIN;

-- puntarenas-costa-rica → Puntarenas, Costa Rica (200 photos)
UPDATE photos SET location_name = 'Puntarenas, Costa Rica'
WHERE gallery_slug = 'puntarenas-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- alajuela → Alajuela, Costa Rica (148 photos)
UPDATE photos SET location_name = 'Alajuela, Costa Rica'
WHERE gallery_slug = 'alajuela' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- san-jose-costa-rica → San Jose, Costa Rica (128 photos)
UPDATE photos SET location_name = 'San Jose, Costa Rica'
WHERE gallery_slug = 'san-jose-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- tamarindo-guanacaste-costa-rica → Tamarindo, Guanacaste, Costa Rica (118 photos)
UPDATE photos SET location_name = 'Tamarindo, Guanacaste, Costa Rica'
WHERE gallery_slug = 'tamarindo-guanacaste-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- playa-hermosa-guanacaste → Playa Hermosa, Guanacaste, Costa Rica (104 photos)
UPDATE photos SET location_name = 'Playa Hermosa, Guanacaste, Costa Rica'
WHERE gallery_slug = 'playa-hermosa-guanacaste' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- waterfalls-in-costa-rica → Costa Rica (99 photos — generic but valid)
UPDATE photos SET location_name = 'Costa Rica'
WHERE gallery_slug = 'waterfalls-in-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- samara-playa-carillo → Samara, Costa Rica (97 photos)
UPDATE photos SET location_name = 'Samara, Costa Rica'
WHERE gallery_slug = 'samara-playa-carillo' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- puerto-caldera-puntarenas-port → Puerto Caldera, Puntarenas, Costa Rica (97 photos)
UPDATE photos SET location_name = 'Puerto Caldera, Puntarenas, Costa Rica'
WHERE gallery_slug = 'puerto-caldera-puntarenas-port' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- las-catalinas-guanacaste → Las Catalinas, Guanacaste, Costa Rica (90 photos)
UPDATE photos SET location_name = 'Las Catalinas, Guanacaste, Costa Rica'
WHERE gallery_slug = 'las-catalinas-guanacaste' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- punta-cacique-guancaste → Punta Cacique, Guanacaste, Costa Rica (84 photos)
UPDATE photos SET location_name = 'Punta Cacique, Guanacaste, Costa Rica'
WHERE gallery_slug = 'punta-cacique-guancaste' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- rincon-de-la-vieja → Rincon de la Vieja, Costa Rica (81 photos)
UPDATE photos SET location_name = 'Rincon de la Vieja, Costa Rica'
WHERE gallery_slug = 'rincon-de-la-vieja' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- playa-real-roble-guanacaste-costa-rica → Playa Real Roble, Guanacaste, Costa Rica (77 photos)
UPDATE photos SET location_name = 'Playa Real Roble, Guanacaste, Costa Rica'
WHERE gallery_slug = 'playa-real-roble-guanacaste-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- tambor-photos → Tambor, Costa Rica (72 photos)
UPDATE photos SET location_name = 'Tambor, Costa Rica'
WHERE gallery_slug = 'tambor-photos' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- volcan-irazu → Volcan Irazu, Costa Rica (69 photos)
UPDATE photos SET location_name = 'Volcan Irazu, Costa Rica'
WHERE gallery_slug = 'volcan-irazu' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- arenal-volcano → Arenal Volcano, Costa Rica (67 photos)
UPDATE photos SET location_name = 'Arenal Volcano, Costa Rica'
WHERE gallery_slug = 'arenal-volcano' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- dominical-and-uvita → Dominical and Uvita, Costa Rica (50 photos)
UPDATE photos SET location_name = 'Dominical and Uvita, Costa Rica'
WHERE gallery_slug = 'dominical-and-uvita' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- flamingo-beach → Flamingo Beach, Costa Rica (39 photos)
UPDATE photos SET location_name = 'Flamingo Beach, Costa Rica'
WHERE gallery_slug = 'flamingo-beach' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- crocodiles → Tarcoles, Costa Rica (37 photos — known for crocodile bridge)
UPDATE photos SET location_name = 'Tarcoles, Costa Rica'
WHERE gallery_slug = 'crocodiles' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- cartago → Cartago, Costa Rica (21 photos)
UPDATE photos SET location_name = 'Cartago, Costa Rica'
WHERE gallery_slug = 'cartago' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

-- heredia-costa-rica → Heredia, Costa Rica (11 photos)
UPDATE photos SET location_name = 'Heredia, Costa Rica'
WHERE gallery_slug = 'heredia-costa-rica' AND location_name IS NULL
  AND search_ready = true AND ready_for_public_render = true;

COMMIT;
