#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'where-to-see-sloths-costa-rica';
const content = `Costa Rica is one of the best places in the world to see sloths in the wild — both the two-toed sloth and the smaller, rounder Hoffmann's two-toed sloth. The country's extensive protected forest areas, combined with a guiding culture that has developed over decades around wildlife tourism, means that encounters with sloths are genuinely achievable for visitors who make even minimal effort. Unlike many wildlife targets that require early alarms and uncomfortable field craft, sloths often appear on the most accessible trails with little effort beyond knowing where to look.

The two-toed sloth (Choloepus hoffmanni) is the larger of Costa Rica's two species, with a longer snout and a more active reputation than its cousin. They are primarily nocturnal, but in practice are frequently encountered dozing in the same fig tree or Cecropia at midday as they were at dawn. The sloths' low metabolism — they have the slowest digestion of any mammal, sometimes taking up to a month to process a single leaf — means they move rarely and slowly, making them ideal photographic subjects when you do find them in an accessible position.

Hoffmann's two-toed sloth is the slightly smaller, rounder species most commonly associated with the classic sloth image. They are found primarily in the higher-elevation forests of both the Pacific and Caribbean slopes. Their distribution in Costa Rica follows the forest type rather than the coast — they are absent from the dry Guanacaste lowlands but common in the wet forests of the Osa Peninsula, Tortuguero, and the elevated areas around Arenal and Monteverde.

The best locations for sloth photography in Costa Rica tend to be places with well-established habituated populations, good canopy that brings sloths to eye level, and guides who know specific trees. The Arenal Volcano area — particularly the roadsides between La Fortuna and the volcano — hosts a reliable population of two-toed sloths in the Cecropia and fig trees that line the route. The sloths here have been monitored for years and their locations are well known to local guides.

Manuel Antonio National Park is another excellent sloth location, with both two-toed and Hoffmann's sloths present in the trees along the main trail. The advantage of Manuel Antonio is that the forest is coastal — lower than the mountain forests — which means better light conditions for photography for more months of the year. The sloths here have been studied for decades and their territories are well established.

The Caribbean coast around Puerto Viejo de Talamanca and Cahuita offers excellent sloth viewing with a different forest character. The wet, lush forests here support healthy sloth populations, and the presence of the Jaguarundi and other mammals adds wildlife interest to a sloth-focused visit. The Cahuita National Park trail is particularly productive for sloth encounters.

Sloth photography rewards patience and the willingness to wait. Most sloths are found by scanning the canopy of Cecropia and fig trees from below, looking for the distinctive round shape and, at closer range, the pale face with dark patches around the eyes. Once found, a sloth is unlikely to move quickly — though they do occasionally descend to the forest floor to defecate, an event that takes 15 to 20 minutes and is considered a highlight by serious wildlife photographers. The best photographs come from positioning yourself at eye level or slightly above, which is easier said than done given the height of most forest canopies.

Ethical sloth viewing is an increasing concern in Costa Rica's popular wildlife tourism areas. Sloths that are frequently approached by tourists and used as photo props can experience chronic stress that affects their health and reproduction. Choose operators who maintain appropriate distances, who do not use sloths retrieved from the wild for display purposes, and who prioritize the animal's welfare over the photo opportunity.

---

Book a guided sloth and wildlife tour in Costa Rica: [GetYourGuide Tours](/go/gyg/sloths)

## Frequently Asked Questions

**What is the difference between two-toed and Hoffmann's sloths in Costa Rica?**
Two-toed sloths are larger with a longer snout and more nocturnal habits. Hoffmann's sloths are smaller and rounder, found at higher elevations. Both are commonly encountered with local guides.

**Where is the best place to photograph sloths in Costa Rica?**
The Arenal area, Manuel Antonio, and the Puerto Viejo de Talamanca coast are the three most reliable locations. A local guide dramatically increases your odds of finding sloths in any of these areas.

**Are sloths endangered in Costa Rica?**
Both Costa Rican sloth species are classified as species of least concern by the IUCN, though habitat loss pressures their populations. Tourism-related stress is a growing welfare concern.

**Can I see sloths on a day trip from San Jose?**
Yes — the Arenal area is 3 hours from San Jose, making it feasible as a long day trip, though overnight stays near La Fortuna produce better results.

**What time of day is best for sloth photography?**
Sloths are most active around dawn and dusk, but can be found sleeping in the same spot throughout the day. Mid-morning offers the best light conditions for photography.`;
const title = 'Where to See Sloths in Costa Rica: The Complete Guide for 2026';
const excerpt = 'Where to find and photograph sloths in Costa Rica — the complete guide covering both species, best locations, timing, and ethical wildlife viewing practices.';
async function main() {
  await client.connect();
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,'species_guide',$3,$4,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,content=EXCLUDED.content,updated_at=NOW()
     RETURNING id,slug,status`,
    [title, slug, excerpt, content]);
  console.log(`[${slug}] Saved: id=${r.rows[0].id}, words=${content.split(/\s+/).length}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
