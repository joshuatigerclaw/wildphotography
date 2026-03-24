#!/usr/bin/env node
/**
 * WildPhotography SEO Article Generator v2
 * Generates substantive SEO articles using real photo data from Neon.
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const OUTPUT_DIR = path.join(__dirname, '../runtime/article_outputs');

async function qPhotos(client, topics, limit = 20) {
  if (!topics || !topics.length) return [];
  const ph = topics.map((_, i) => `$${i + 1}`).join(',');
  const r = await client.query(
    `SELECT id,slug,title,thumb_url,description,location_name,region,species_common_name
     FROM photos WHERE search_ready=true AND ready_for_public_render=true
     AND location_name IN (${ph}) LIMIT ${limit}`, topics);
  return r.rows;
}

async function qSpecies(client, species, limit = 10) {
  if (!species || !species.length) return [];
  const ph = species.map((_, i) => `$${i + 1}`).join(',');
  const r = await client.query(
    `SELECT id,slug,title,thumb_url,description,location_name,species_common_name
     FROM photos WHERE search_ready=true AND ready_for_public_render=true
     AND species_common_name IN (${ph}) LIMIT ${limit}`, species);
  return r.rows;
}

async function upsert(client, article) {
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,$3,$4,$5,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,
     content=EXCLUDED.content,updated_at=NOW() RETURNING id,slug,status`,
    [article.title, article.slug, article.article_type, article.excerpt, article.content]);
  return r.rows[0];
}

// ─── Article content map ─────────────────────────────────────────────────────

const ARTICLES = {

  'best-beaches-in-costa-rica': {
    title: 'Best Beaches in Costa Rica: The Complete 2026 Guide for Travelers and Photographers',
    excerpt: 'Costa Rica\'s best beaches span the Pacific\'s golden Guanacaste shores to the Caribbean\'s volcanic black-sand strands. Expert guide with photography tips, travel advice, and must-visit beaches.',
    content: `Costa Rica's Pacific coast stretches for more than 1,200 kilometers, and the variety surprises most first-time visitors. You won't find the manicured resort strips here that you'll encounter in Mexico or the Dominican Republic. Instead, Costa Rica's beaches tend to be wilder, flanked by mangrove forests or backed by steep jungle hills, with howler monkeys often audible from the sand. Guanacaste province, in the northwest, concentrates the country's most iconic beach scenes — long crescents of golden-brown sand backed by dry tropical forest, with frigatebirds circling overhead and pelicans working the shallows at dawn.

The country's two coasts offer genuinely different experiences. The Pacific side delivers consistent surf, dramatic sunsets, and easy access from San Jose. The Guanacaste corridor between Liberia and Tamarindo has become the most developed stretch, yet places like Playa Flamingo and Playa Conchal have retained their character despite the growth, with turquoise water that genuinely looks like it belongs in the Caribbean.

Playas del Coco and Playa Hermosa offer a more grounded beach-town atmosphere, with local fishing boats pulling up on the sand each morning and restaurants serving fresh catch by the plate. Further south, the Nicoya Peninsula transitions toward genuinely remote — Montezuma and Santa Teresa draw a backpacker and yogi crowd, with fewer amenities but a rawer, more intimate relationship between beach and jungle.

The Caribbean coast moves to a slower rhythm entirely. Puerto Viejo de Talamanca sits at the end of a road that seems to go nowhere in particular, flanked by banana plantations and then suddenly opening onto a beach of black volcanic sand. The water is rougher here, the vibe more laid-back, the cuisine shaped by the Afro-Caribbean community that has shaped this region for generations. Cahuita National Park protects a gorgeous stretch of reef-lined shore.

Timing matters on both coasts. The Pacific side sits in the dry season corridor — November through April brings sunny days and calm seas, making it the high season. The Guanacaste beaches in particular see almost no rain from December through March. Summer months (April through May) can be brutally hot inland but surprisingly pleasant at the coast. The Caribbean side has its own logic — driest months are September and October.

Most Costa Rica beach photography happens in the first two hours after sunrise or the last hour before sunset. Midday light on the Pacific coast tends to be flat and contrasty, washing out the very blues that make the water so striking in early morning shots. The one exception is overcast mornings during the green season, which can produce unexpectedly moody, magazine-quality images. Sunset at Tamarindo or Playa Flamingo reliably produces the kind of warm, backlit beach scenes that travel well on social media and stock platforms.

---

Book a guided beach and wildlife tour to make the most of your Costa Rica beach time: [GetYourGuide Tours](/go/gyg/tours)

## Frequently Asked Questions

**What is the best time to visit Costa Rica's beaches?**
The Pacific beaches are best from December through April during the dry season. The Caribbean coast is driest from September through November. Avoid late August and early September when both coasts can see heavy rain simultaneously.

**Is it safe to swim at Costa Rica's beaches?**
Generally yes, though conditions vary. Pacific beaches in Guanacaste usually have calm water in dry season. The Caribbean coast near Puerto Viejo has stronger currents — always ask locals about conditions before entering the water.

**Which Costa Rica beach is best for surfing?**
Tamarindo and Santa Teresa on the Pacific side offer consistent waves for intermediate and advanced surfers. Beginners tend to do well at Jaco Beach with its gentler breaks and established surf schools.

**How do I get to Costa Rica's beaches from San Jose?**
Most Pacific beaches are 2 to 5 hours by car from San Jose via the Interamerican Highway. Shuttle services and domestic flights to Liberia (for Guanacaste) are popular options. A 4x4 is recommended for accessing more remote beaches.

**Are there beaches in Costa Rica suitable for families with young children?**
Playa Flamingo, Playa Conchal, and Playas del Coco in Guanacaste are well-suited for families with calm water in dry season and good infrastructure nearby.

**Can I see wildlife at Costa Rica's beaches?**
Yes — howler monkeys are common near beach forest edges, especially near Manuel Antonio and the Nicoya Peninsula. Scarlet macaws frequent the beaches around the Osa Peninsula. Sea turtles nest on Caribbean beaches from August to February.

**What is the difference between the Pacific and Caribbean coasts in Costa Rica?**
The Pacific coast is more developed, has consistent surf, and is drier during high season. The Caribbean coast is more laid-back, culturally distinct, and receives more rain even during the December through April high season.`,
    article_type: 'theme_roundup',
    topics: ['Guanacaste Beaches','Tamarindo','Papagayo Peninsula','Jaco Beach','Playa Hermosa','Puerto Viejo, Limon','Isla Tortuga'],
    species: []
  },

  'costa-rica-wildlife-photography-guide': {
    title: 'Costa Rica Wildlife Photography Guide: Tips, Locations, and Species for 2026',
    excerpt: 'A practical wildlife photography guide to Costa Rica — covering the best locations, essential gear, top species to photograph, and timing tips from a resident photographer.',
    content: `Costa Rica occupies less than 0.03 percent of Earth's land surface yet contains roughly 5 percent of the world's biodiversity. That ratio — compressed into a country the size of West Virginia — is what makes it the most rewarding wildlife photography destination in the Americas. A single morning in any of the country's national parks will deliver more photographic opportunities than most photographers see in a year of shooting closer to home. The combination of protected corridors, altitude gradients from sea level to cloud forest, and a culture that has long valued conservation means animals here are accustomed to a certain level of human presence, making close encounters genuinely possible.

The camera gear you bring matters less than you might think. The country's legendary misty mornings in the cloud forests and the deep green forest understory mean you'll frequently be shooting in low light — but those same conditions are what produce the atmospheric, moody wildlife images that stand out. A telephoto zoom in the 100 to 400mm range covers most situations, from hummingbirds at feeders to distant macaw flyovers. A fast wide-angle (16 to 35mm) becomes essential for showing environmental context around large animals like tapirs or peccaries. A sturdy tripod or gimbal head handles the slow shutter speeds you'll often need in forest interiors.

Monteverde sits at roughly 1,500 meters elevation in the Tilaran mountain range, where the cloud forest generates its own weather systems. This is quetzal country — the resplendent quetzal, arguably Central America's most sought-after bird, breeds here from March to June and can be photographed at relatively close range in the wild avocado trees it favors. The forest also hosts ocelots, kinkajous, and coatis, though these are harder to predict and reward the patient photographer.

The Osa Peninsula and Corcovado National Park represent the other end of the intensity spectrum — wild, remote, and loaded with wildlife. Photographers here encounter tapirs on the beach trails at dawn, all four Costa Rica monkey species in a single day, and the chance of encountering Baird's tapirs and harpy eagles. The challenge is logistics: Corcovado requires permits, local guides, and a reasonable fitness level. The photographic rewards are proportional.

Arenal Volcano and its surrounding landscape offer one of the country's most reliably productive setups. The volcano itself is a spectacular subject at sunrise or during occasional Strombolian eruptions that light up the night sky. The forest trails around La Fortuna Waterfall and Arenal Volcano National Park host coatis, toucans, and sloths with a predictability that makes them ideal subjects for photographers building species portfolios.

The wet season from May to November is often dismissed by first-time visitors but is actively preferred by many experienced wildlife photographers working in Costa Rica. The forest is lusher, waterfalls run at full force, and the overcast skies produce soft, even light ideal for forest interior work. Birds are often more active as they exploit fruiting trees. The main trade-off is logistics — some rural roads become difficult to navigate and some remote lodges close for the season.

Guided photography expeditions add significant value in Costa Rica. The best local guides know specific trees where toucans congregate, spots along rivers where crocodiles surface reliably, and the calls of the rare great green macaw. Several specialized wildlife photography tours operate out of lodges near Tortuguero, the Osa Peninsula, and the Sarapiqui region, with photographers' blinds positioned near waterholes and fruit trees that attract target species.

---

Book a guided wildlife photography tour in Costa Rica: [GetYourGuide Tours](/go/gyg/tours)

## Frequently Asked Questions

**What is the best time of year for wildlife photography in Costa Rica?**
November through March brings North American migrants and dry-season wildlife concentration around water sources. The wet season (May through November) produces lusher conditions and overcast light ideal for forest photography.

**What gear do I need for Costa Rica wildlife photography?**
A telephoto zoom (100 to 400mm), wide-angle for environmental context, fast prime for hummingbirds, tripod or gimbal for low-light forest work, and rain covers for everything.

**Where can I photograph sloths in Costa Rica?**
Arenal (near La Fortuna), Manuel Antonio, and the Puerto Viejo de Talamanca area on the Caribbean coast are the most reliable locations for photographing both two-toed and Hoffmann's two-toed sloths.

**Is Costa Rica good for bird photography?**
Yes — 900+ species including resplendent quetzals, scarlet macaws, and 50+ hummingbird species make Costa Rica one of the world's top bird photography destinations.

**Can beginners do wildlife photography in Costa Rica?**
Absolutely. Lodges with wildlife photography blinds and well-established species populations (sloths in Arenal, macaws at Carara) provide excellent subjects without requiring expert field craft.`,
    article_type: 'photography_guide',
    topics: ['Wildlife','Arenal Volcano','Birds of Costa Rica'],
    species: ['Scarlet Macaw','Resplendent Quetzal','Rufous-tailed Hummingbird','Anhinga']
  },

  'birds-of-costa-rica': {
    title: 'Birds of Costa Rica: A Complete Guide to Costa Rica\'s Most Spectacular Avian Life',
    excerpt: 'Costa Rica hosts 900+ bird species across diverse habitats. This guide covers the best places to bird, top species to photograph, and practical tips from a resident photographer.',
    content: `Costa Rica holds an extraordinary concentration of bird life for a country of its size — more than 900 species recorded in an area smaller than West Virginia. That figure includes resident species, migrants from North America that winter here, and rare vagrants that turn up in unexpected places. For birdwatchers and wildlife photographers, the country functions as a greatest-hits album of Neotropical birds: quetzals, macaws, toucans, antbirds, manakins, and hummingbirds filling every habitat from mangrove swamps to cloud forest peaks.

The geography does much of the work. Costa Rica sits at the narrowest section of the Central American isthmus, where North and South American bird families meet and mingle. The country also spans a dramatic altitudinal range — from sea level to over 3,800 meters at Cerro Chirripo — which multiplies the number of distinct habitats available within a short drive. A birder based near San Jose can reach cloud forest, dry forest, and wetland habitats within three hours.

The resplendent quetzal draws more visiting birders to Costa Rica than any other single species. The male's extraordinary tail streamers, which can exceed 60 centimeters in length, make it one of the most distinctive birds in the world. Costa Rica offers two primary quetzal regions: the cloud forests around Monteverde and Santa Elena in the north, and the higher elevations of San Gerardo de Dota in the Talamanca range south of Cartago. The Monteverde area is more accessible and better equipped for visitors; San Gerardo de Dota is quieter, more remote, and often produces more intimate encounters.

Scarlet macaws are among the most photographed birds in Costa Rica, their brilliant red, yellow, and blue plumage impossible to miss against any background. The Pacific coast populations have recovered significantly thanks to conservation work at Carara National Park and the Osa Peninsula, where flock sizes of 20 or more birds are regularly encountered near clay licks and rivers. The screeching call carries long distances at dawn — most photographers locate them by ear before getting eyes on.

Hummingbirds offer the most accessible and consistently productive bird photography in Costa Rica. The country hosts more than 50 species, many of which visit feeders maintained at lodges and research stations throughout the country. The gardens at Monteverde and La Selva Biological Station have feeding stations where green-crowned brilliants, violet-crowned woodnymphs, and stripe-throated hermits pose at close range within minutes of setting up a camera.

The best time for bird photography in Costa Rica depends on what you are after. November through March brings large numbers of North American migrants — warblers, tanagers, vireos, and flycatchers join the resident species and are often more conspicuous as they establish winter territories. The dry season (December through April) concentrates birds around water sources, making forest rivers and lake margins productive. The wet season brings breeding activity and the chance to photograph nests and dependent young.

Organized birding tours with knowledgeable local guides add enormous value. The difference between a self-guided visit and one with a guide who knows the area's birding spots is measured in species count and the quality of encounters. Several Costa Rica-based operators specialize in photography-focused birding tours, with guides who maintain relationships with specific animals and know the reliable feeding trees and territorial spots.

---

Book a guided birding tour in Costa Rica: [GetYourGuide Tours](/go/gyg/tours)

## Frequently Asked Questions

**What is the best time to see quetzals in Costa Rica?**
March through June is the peak breeding season when quetzals are most active and visible. They are present year-round but more dispersed outside breeding season.

**Where can I photograph hummingbirds in Costa Rica?**
Monteverde Cloud Forest Gardens, La Selva Biological Station, and the Wilson Botanical Garden near San Vito all have established feeding stations that reliably attract multiple species.

**How many bird species can I see in a week in Costa Rica?**
A focused week with a good local guide can yield 250 to 350 species. A month of dedicated birding could push toward 500.

**Is Costa Rica safe for self-guided birding?**
Yes, generally. The main practical concern is road access during the wet season. Hiring a local guide for at least a few days is strongly recommended for serious birding.

**What is the rarest bird in Costa Rica?**
The Cocle's antwren and black-capped petrel are extremely rare. For most visitors, the Baird's tapir-associated birds are harder to find than the quetzal.

**Are there tours specifically for bird photography?**
Yes — several Costa Rica operators offer photography-focused tours with photographers' blinds, meal schedules that align with peak activity, and guides who know specific territorial spots for target species.`,
    article_type: 'theme_roundup',
    topics: ['Birds of Costa Rica'],
    species: ['Resplendent Quetzal','Scarlet Macaw','Rufous-tailed Hummingbird','Anhinga','Brown Pelican']
  },

  'manuel-antonio-travel-wildlife-guide': {
    title: 'Manuel Antonio, Costa Rica: The Complete Travel and Wildlife Guide for 2026',
    excerpt: 'Manuel Antonio National Park delivers coastal rainforest, white-sand beaches, and accessible wildlife including sloths and capuchins. Complete travel and wildlife guide with photography tips.',
    content: `Manuel Antonio National Park is small by Costa Rica's standards — just 1,983 hectares — but what it delivers is disproportionate to its size. The park encompasses coastal rainforest that drops directly onto white-sand beaches, a granite point that creates natural tidal pools, and a marine zone that shelters dolphins and migrating humpback whales. On any given morning, a visitor might photograph a two-toed sloth in the trees overhead, a white-faced capuchin checking for dropped food at the picnic tables, and a spectacular sunset over the Pacific — all before lunch.

The wildlife in Manuel Antonio operates on its own schedule and tends to be surprisingly habituated to human presence. The two-toed sloths that live in the trees along the main trail between the park entrance and Espadilla Beach have been studied for decades, and their territories are well known to local guides. White-faced capuchins patrol the same routes with the confidence of animals that have learned humans are a source of tolerance if not food. The raccoon-like coatis that approach visitors for snacks are equally predictable.

Getting to Manuel Antonio requires a drive from San Jose — roughly 156 kilometers and about three hours in reasonable traffic. The route descends from the Central Valley through the towns of Atenas and Quepos, with the final approach along the coast. Many visitors choose to stay overnight near the park rather than attempting the round trip from San Jose in a single day.

The park is open daily with a strict visitor cap. Arrive early — before 8am on weekends and holidays — to secure entry and experience the trail system before it becomes crowded. The main trail loop through the forest takes two to three hours at a leisurely pace with photography stops. The beach at Manuel Antonio sits inside the park boundary and is considered one of the most beautiful in the country.

Photographing Manuel Antonio's wildlife rewards patience over speed. The sloths are easiest in the trees along the main trail — look for the recognizable round head and do not expect rapid movement. Capuchins are more mobile and often better photographed at the beach area where they interact with the environment actively. Titi monkeys (Squirrel Monkeys) are harder to find — they prefer the forest interior and are most active in early morning.

Beyond Manuel Antonio itself, the surrounding Quepos area offers Kayak fishing trips, sport fishing charters, and mangrove tours in the Sierpe estuary. The Damas Island mangrove system just south of Quepos is one of the most productive estuary ecosystems on the Pacific coast and supports crocodiles, monkeys, and a rich diversity of wading birds. Several photography-focused operators run early morning tours that produce excellent results.

Where to stay near Manuel Antonio ranges from budget hostels in Quepos to boutique properties perched on the hillside overlooking the park. The ridge road above the park hosts several mid-range hotels with balconies overlooking the ocean — waking up to a view of the Pacific and the forested point below is part of the experience and worth the premium for photographers who want flexibility in shooting times.

---

Book a guided Manuel Antonio wildlife tour: [GetYourGuide Tours](/go/gyg/manuel-antonio)

## Frequently Asked Questions

**How do I get to Manuel Antonio from San Jose?**
The most common route is a 2.5 to 3 hour drive via the Costanera (Highway 34) along the Pacific coast. Public buses run daily from San Jose. Shuttle services are also available.

**What wildlife can I see in Manuel Antonio National Park?**
Two-toed sloths, white-faced capuchins, coatis, agoutis, and over 350 bird species including toucans, motmots, and tanagers. Marine life offshore includes dolphins and (seasonally) migrating whales.

**Is Manuel Antonio worth visiting if I am not a wildlife enthusiast?**
Yes — the beach itself is consistently ranked among Costa Rica's finest, and the coastal views from the ridge hotels are spectacular. The park's wildlife is a bonus that most visitors find unexpectedly compelling.

**When is the best time to visit Manuel Antonio?**
December through April offers the best weather. The park is less crowded on weekday mornings. Wildlife is generally easier to see during the dry season when animals concentrate near water sources.

**Can I do a day trip to Manuel Antonio from San Jose?**
Yes, but it is rushed. The drive each way takes 3 hours, leaving limited park time. Staying overnight in Quepos or the park area is strongly recommended for anyone serious about wildlife photography.

**Are there good photography spots outside the national park?**
Yes — the mangroves around Damas Island, the estuary near Quepos, and the viewpoint at the ridge road above the park offer excellent photography opportunities without park entry fees or crowds.`,
    article_type: 'location_guide',
    topics: ['Manuel Antonio'],
    species: []
  },

  'arenal-volcano-travel-photography-guide': {
    title: 'Arenal Volcano, Costa Rica: The Complete Photography and Travel Guide for 2026',
    excerpt: 'Arenal Volcano dominates northern Costa Rica\'s landscape. Complete guide to the best photography spots, thermal springs, wildlife, and practical travel tips from a resident.',
    content: `Arenal Volcano dominates the northern Costa Rica landscape at 1,657 meters, a near-perfect conical stratovolcano that was in nearly continuous low-level eruption from 1968 until 2010. For nearly 50 years, it produced multiple daily explosions of gas and ash, lit up the night sky with molten ejecta, and fed the natural thermal streams that made the area below it a natural spa. That eruptive period ended abruptly in 2010, and the volcano now sits quietly — but its slopes remain lush with recovery forest, its base is ringed with thermal springs, and the surrounding landscape remains one of Costa Rica's most compelling photographic environments.

The best views of Arenal itself come from the western side, particularly from the areas near Tabacon and the Termales Balneario. Early morning offers the best chance of clear views before the afternoon clouds build — Costa Rica's afternoon cloud formation is predictable enough that serious volcano photographers set alarms for 5:30am. The classic Arenal shot — the symmetrical cone reflected in Lake Arenal or framed through the forest canopy — requires patience and a bit of luck with cloud cover. The volcano has been photographed from every possible angle, but the best images still come from photographers who spend multiple mornings waiting for the right light.

The geology around Arenal tells an ongoing story. The 1968 eruption buried several square kilometers of farmland and redirected river channels. The recovery has been remarkable — the volcanic soil produces lush, dense forest on the lower slopes within 30 years, and the area now supports healthy populations of tapirs, jaguars, and the unusual scarlet macaw population that thrives in the transitional forest between the lake and the volcano slopes.

The thermal springs below Arenal have been a draw since before the volcano became famous. The Tabacon River runs hot from geothermal activity underground, and several resorts have built pools and bathing facilities that use the naturally heated water. Photography at the springs works best in early morning or at dusk, when steam rising from the pools against the dark forest creates atmospheric images. Several operators offer after-dark photography sessions at the springs, where the combination of warm water, cool evening air, and volcanic steam produces striking results.

Wildlife photography around Arenal benefits from the mosaic of habitats — lake, forest, farmland, and thermal wetlands — within a small area. The lake itself hosts American crocodiles, cormorants, and osprey. The forest trails around the volcano park protect populations of peccaries, coatis, and the elusive ocelot, though the latter is difficult to encounter. Sloths are reliably present in the fig trees along the road between La Fortuna and the volcano. Toucans and motmots are common along the forest edge.

The town of La Fortuna sits at the eastern base of the volcano and serves as the practical base for exploring the area. The La Fortuna Waterfall — a 70-meter cascade set in a steep-walled canyon about six kilometers from town — is one of the most dramatic natural features in northern Costa Rica and a must-visit for photographers. The trail descends 500 steps to a viewing platform at the base, which is typically enveloped in spray and backlit by the hole in the forest canopy above.

Getting to Arenal and La Fortuna requires a drive of about three hours from San Jose, most of which descends from the Central Valley through the Juan Castro Blanco Protected Area. The road is in good condition year-round. Domestic flights to the small airport near Arenal are available but limited.

---

Book an Arenal Volcano and thermal springs tour: [Viator Hotels](/go/viator/arenal)

## Frequently Asked Questions

**Is Arenal Volcano still active?**
Arenal erupted nearly continuously from 1968 to 2010. It has been quiet since 2010 but is still considered active by volcanologists. Steam and gas emissions are visible from the summit on cool mornings.

**What is the best viewpoint for Arenal Volcano?**
The Arenal Observatory Lodge area and the viewing platforms near Tabacon consistently offer the clearest views. Early morning (before 7am) has the best chance of cloud-free summit views.

**Can I photograph wildlife near Arenal?**
Yes — sloths, toucans, coatis, and cormorants are regularly encountered. The Arenal Volcano National Park trail system and the area around La Fortuna Waterfall are the most reliable spots.

**Is Arenal worth visiting if the volcano is not erupting?**
Absolutely. The area's thermal springs, lake, waterfall, and wildlife make it one of Costa Rica's best all-around destinations regardless of volcanic activity.

**How many days should I spend in Arenal?**
Two to three nights is ideal — enough time to do the park trails, visit the waterfall, spend an evening at the thermal springs, and wait for a clear summit morning.`,
    article_type: 'location_guide',
    topics: ['Arenal Volcano'],
    species: []
  },

  'monteverde-cloud-forest-wildlife-guide': {
    title: 'Monteverde Cloud Forest, Costa Rica: The Complete Wildlife and Travel Guide for 2026',
    excerpt: 'Monteverde Cloud Forest draws photographers for quetzals, misty trails, and extraordinary biodiversity. Complete guide covering wildlife, photography tips, quetzal viewing, and travel logistics.',
    content: `Monteverde sits at 1,500 meters in the Tilaran mountain range, where the trade winds off the Caribbean push moisture-laden clouds up the western slopes and produce a near-constant mist that gives the cloud forest its name. The effect on the landscape is remarkable — every surface covered in mosses and ferns, bromeliads and orchids growing from tree branches, the air thick with moisture and the calls of birds that are often heard but not seen in the dim interior light. This is one of the most genuinely atmospheric environments I know of for nature photography.

The cloud forest's defining species is the resplendent quetzal. Costa Rica holds two main quetzal regions — Monteverde and the higher elevations around San Gerardo de Dota — but Monteverde's accessibility and established infrastructure make it the default choice for most visitors. Quetzals are present year-round but most reliably photographed during the breeding season from March through June, when males display their extraordinary tail streamers in the canopy and descend to feed on the fruits of wild avocado trees. The Monteverde Cloud Forest Biological Reserve and the adjacent Santa Elena Reserve together protect more than 25 square kilometers of this habitat.

Photographing quetzals requires early starts and local knowledge. The birds move between feeding territories that experienced guides have mapped over years of observation. The best encounters happen in the first two hours after dawn, when the males feed actively before retreating to more sheltered perches. I have sat for four hours before a male quetzal descended to feed within ten meters of the observation blind. When it happens, it is among the most rewarding subjects in bird photography anywhere in the world.

Beyond quetzals, Monteverde's bird list exceeds 400 species and includes several species that are difficult or impossible to encounter elsewhere in Costa Rica. The three-wattled bellbird, with its bizarre vocalizations that carry through the forest like something from a science fiction film, is present in the Monteverde area. Golden-browed chlorophonia, emerald toucanets, and the endemic bare-shanked screech-owl round out a target list that would take a week of dedicated birding to work through.

The cloud forest presents specific photographic challenges. The perpetually overcast conditions eliminate harsh shadows but also reduce light levels significantly — shutter speeds drop, and tripod use becomes essential for anything but the most cooperative subjects at the feeding stations. The high humidity is corrosive to equipment over extended periods. Fog and condensation on lenses is a constant challenge, requiring constant attention during a shoot.

Night walks in Monteverde reveal an entirely different fauna. The cloud forest comes alive after dark with owls, potoos, kinkajous, and a variety of amphibians that are among the most beautifully colored creatures in the tropics. Guided night walks in the reserve properly encounter wild species in their natural habitat.

The higher elevations of San Gerardo de Dota, accessible via a rough road south of the main Monteverde area, represent the next level of quetzal photography. The cloud forest here is at higher altitude, with shorter trees and denser understory, which means closer encounters and better photographic angles. The trade-off is access — the road requires a 4x4 vehicle and the area is genuinely remote. But for photographers serious about quetzals, the extra effort is worth it.

---

Book a guided Monteverde cloud forest tour: [GetYourGuide Tours](/go/gyg/monteverde)

## Frequently Asked Questions

**How do I get to Monteverde from San Jose?**
The standard route is a 3 to 4 hour drive, much of it on unpaved mountain roads. A 4x4 is strongly recommended, especially during the wet season. Shuttle vans run daily from San Jose.

**What is the best time to see quetzals in Monteverde?**
March through June is peak breeding season. Early morning (before 7am) at the feeding trees in the Monteverde or Santa Elena reserves offers the best chance of close encounters.

**Is Monteverde suitable for beginner wildlife photographers?**
Yes — the hummingbird and flower feeders at Monteverde Gardens and the nearby lodges offer consistently close subjects with no special skill required. Forest interior photography requires more patience and gear.

**What should I bring to Monteverde?**
Rain layers (multiple), dried silica packets for your camera bag, a tripod, fast primes for low-light forest work, and waterproof boots. Everything gets damp here.

**How many days should I spend in Monteverde?**
Two full days minimum — one for quetzal photography at dawn and general forest exploration, one for the other wildlife and the excellent nighttime walks. Three days allows for a visit to Santa Elena Reserve as well.`,
    article_type: 'location_guide',
    topics: ['Monteverde'],
    species: ['Resplendent Quetzal']
  },

  'guanacaste-beaches-travel-guide': {
    title: 'Guanacaste Beaches, Costa Rica: The Complete Travel and Photography Guide for 2026',
    excerpt: 'Guanacaste\'s Pacific beaches range from developed resort strips to quiet fishing villages. Complete travel guide covering the best beaches, wildlife, photography tips, and where to stay.',
    content: `Guanacaste province covers the northwestern corner of Costa Rica, stretching from the Pacific coast at the Nicaragua border down to the Nicoya Peninsula. The region occupies the drier Pacific slope of the country — the tempisque climate zone — where the dry season runs longer and more pronounced than in the Central Valley or the Caribbean slope. The landscape reflects this: dry forest trees shed their leaves in January and February, the hills turn golden, and the light takes on the warm amber quality that photographers prize.

The beaches of Guanacaste have driven the region's tourism development for the past three decades. Liberia's airport, which now receives direct international flights from the United States and Canada, made Guanacaste accessible to visitors who previously had to endure the five-hour drive from San Jose. The resort corridor that developed along the Pacific coast between Tamarindo and Playas del Coco attracted investment that has produced both high-end tourism infrastructure and a growing expat community.

Tamarindo has become the region's most recognizable beach town. The surf is consistent — intermediate and advanced surfers find reliable waves, while beginners have gentler conditions in the bay near the estuary. The town's infrastructure has expanded to match its popularity, with restaurants, boutique hotels, and surf shops lining the beachfront road. For photographers, Tamarindo works best as a base for exploring the surrounding area rather than as a subject in itself.

Playa Flamingo and Playa Conchal, to the north of Tamarindo, retain more of the Guanacaste coast's original character. Flamingo has a small permanent population of Costa Rican families alongside the resort developments, and the beach itself is one of the prettiest in the region — a wide crescent of white sand backed by cliffs that catch the sunset light dramatically. The Marina Flamingo has brought increased boat traffic, but the surrounding coastline remains beautiful.

The Papagayo Peninsula further north represents Guanacaste's premium end of the market — large all-inclusive resorts, private villas, and a growing reputation among sport fishing and diving operators. Four Seasons and Andaz have established the peninsula as a luxury destination. The beaches here are spectacular and uncrowded by comparison with Tamarindo. Papagayo's marine life is one of the region's underappreciated assets — the underwater visibility rivals the Caribbean side, and healthy reef systems support populations of reef fish, sea turtles, and large pelagics.

Playas del Coco anchors the Guanacaste coast's local community — a working fishing town that has developed a small but thriving tourism scene without losing its identity. The dive shops and sport fishing operators based in Playas del Coco are well-established and offer good value. The nearby Ocotal Beach offers better swimming conditions and hosts a small but consistent population of brown pelicans that fish the point each morning.

Most Guanacaste beach photography happens in the first two hours after sunrise or the last hour before sunset. Midday light flattens the very blues that make the Pacific water so striking in early morning. The one consistent exception is overcast mornings, common during the green season, which produce unexpectedly moody images. Sunset at Tamarindo, Playa Flamingo, or the Papagayo Peninsula reliably produces warm, backlit scenes.

---

Book a Guanacaste beach and wildlife tour: [GetYourGuide Tours](/go/gyg/guanacaste)

## Frequently Asked Questions

**What is the best time to visit Guanacaste's beaches?**
December through April is peak dry season — sunny, warm, and ideal for beach activities. September and October tend to be very wet inland though the coast remains more manageable.

**Which Guanacaste beach is best for photography?**
Pl