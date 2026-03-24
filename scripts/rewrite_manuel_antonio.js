#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'manuel-antonio-travel-wildlife-guide';
const content = `Manuel Antonio National Park is small by Costa Rica's standards — just 1,983 hectares — but what it delivers is disproportionate to its size. The park encompasses coastal rainforest that drops directly onto white-sand beaches, a granite point that creates natural tidal pools, and a marine zone that shelters dolphins and migrating humpback whales. On any given morning, a visitor might photograph a two-toed sloth in the trees overhead, a white-faced capuchin checking for dropped food at the picnic tables, and a spectacular sunset over the Pacific — all before lunch.

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
Yes — the mangroves around Damas Island, the estuary near Quepos, and the viewpoint at the ridge road above the park offer excellent photography opportunities without park entry fees or crowds.`;
const title = 'Manuel Antonio, Costa Rica: The Complete Travel and Wildlife Guide for 2026';
const excerpt = 'Manuel Antonio National Park delivers coastal rainforest, white-sand beaches, and accessible wildlife including sloths and capuchins. Complete travel and wildlife guide with photography tips.';
async function main() {
  await client.connect();
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,'location_guide',$3,$4,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,content=EXCLUDED.content,updated_at=NOW()
     RETURNING id,slug,status`,
    [title, slug, excerpt, content]);
  console.log(`[${slug}] Saved: id=${r.rows[0].id}, words=${content.split(/\s+/).length}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
