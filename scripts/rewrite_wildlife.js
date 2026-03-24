#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'costa-rica-wildlife-photography-guide';

const content = `Costa Rica occupies less than 0.03 percent of Earth's land surface yet contains roughly 5 percent of the world's biodiversity. That ratio — compressed into a country the size of West Virginia — is what makes it the most rewarding wildlife photography destination in the Americas. A single morning in any of the country's national parks will deliver more photographic opportunities than most photographers see in a year of shooting closer to home. The combination of protected corridors, altitude gradients from sea level to cloud forest, and a culture that has long valued conservation means animals here are accustomed to a certain level of human presence, making close encounters genuinely possible.

The camera gear you bring matters less than you might think. The country's legendary misty mornings in the cloud forests and the deep green forest understory mean you will frequently be shooting in low light — but those same conditions are what produce the atmospheric, moody wildlife images that stand out. A telephoto zoom in the 100 to 400mm range covers most situations, from hummingbirds at feeders to distant macaw flyovers. A fast wide-angle (16 to 35mm) becomes essential for showing environmental context around large animals like tapirs or peccaries. A sturdy tripod or gimbal head handles the slow shutter speeds you will often need in forest interiors.

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
Absolutely. Lodges with wildlife photography blinds and well-established species populations (sloths in Arenal, macaws at Carara) provide excellent subjects without requiring expert field craft.`;

const title = 'Costa Rica Wildlife Photography Guide: Tips, Locations, and Species for 2026';
const excerpt = 'A practical wildlife photography guide to Costa Rica — covering the best locations, essential gear, top species to photograph, and timing tips from a resident photographer.';

async function main() {
  await client.connect();
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,'photography_guide',$3,$4,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,content=EXCLUDED.content,updated_at=NOW()
     RETURNING id,slug,status`,
    [title, slug, excerpt, content]);
  console.log(`[${slug}] Saved: id=${r.rows[0].id}, status=${r.rows[0].status}, words=${content.split(/\s+/).length}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
