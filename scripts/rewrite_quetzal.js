#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'resplendent-quetzal-costa-rica';
const content = `The resplendent quetzal occupies an unusual position in the birding world — it is simultaneously one of the most well-known birds in the Americas and one of the least reliably seen by casual visitors. The male's extraordinary tail streamers, which can exceed 60 centimeters in length, make it one of the most distinctive birds anywhere. Yet the quetzal lives in cloud forests that are inherently difficult to navigate, moves through a large territorial range, and is most active in the early morning when most visitors are still waking up. Seeing a quetzal well requires patience, local knowledge, and often more than one early start.

Costa Rica holds two main populations of resplendent quetzals, and understanding the distinction is important for serious photographers. The Monteverde area in the Tilaran range hosts a relatively accessible population that has been studied and photographed for decades. The higher elevations of the Talamanca range around San Gerardo de Dota, Cerro de la Muerte, and the Tapanti area hold a separate population that is less visited and, many would argue, more reliably photographed due to lower visitor pressure.

Monteverde's quetzal population is present year-round but most reliably seen during the breeding season from March through June. During this period, males display in the canopy and descend to feed on the fruits of wild avocado trees (Phoebe) with a regularity that experienced guides have mapped into predictable territories. The Monteverde Cloud Forest Biological Reserve and the adjacent Santa Elena Reserve together protect enough habitat to sustain a healthy population, though the birds' large territories mean that even in the reserve, encounters are not guaranteed without a guide who knows the current feeding trees.

San Gerardo de Dota sits at roughly 2,200 meters in the Talamanca range south of Cartago, accessed via a rough road that is as challenging as it is rewarding. The savegre hotel and surrounding private properties have invested in quetzal conservation for decades, and their guides know the local territories intimately. The higher altitude here means shorter trees and denser forest understory than Monteverde — frustrating for landscape photography but excellent for close encounters with quetzals feeding at eye level or below.

Photographing quetzals is as much about fieldcraft as camera settings. The birds' territories are large, and they move through them in predictable patterns tied to the fruiting schedules of specific trees. A guide who has been watching the same territories for years knows which trees are currently active and can position you before the bird arrives. The best encounters happen in the first 90 minutes after dawn. After that, the birds retreat to more interior forest perches that are difficult to photograph.

The physical challenge of cloud forest photography is real. The altitude at Monteverde (1,500m) and especially San Gerardo de Dota (2,200m) means your cardiovascular capacity is reduced when hiking uphill with camera gear. The humidity and mist require constant attention to lens fog and camera moisture — carry multiple lens cloths and change silica packets frequently. Tripods sink into the soft forest floor. The rewards, when everything comes together, are among the finest wildlife photographs possible anywhere in the world.

Conservation of the quetzal is tied to the preservation of cloud forest habitat throughout its range, which extends through Guatemala, Honduras, and Panama as well as Costa Rica. Costa Rica has been relatively successful at protecting its cloud forest — the Monteverde and Talamanca reserves are well-established — but forest fragmentation and climate change pressures on high-altitude species remain long-term concerns.

---

Book a guided quetzal photography tour in Costa Rica: [GetYourGuide Tours](/go/gyg/quetzal)

## Frequently Asked Questions

**What is the best time to see quetzals in Costa Rica?**
March through June is the most reliable period, coinciding with breeding season when males are most visible and active at feeding territories.

**Monteverde or San Gerardo de Dota for quetzals?**
Monteverde is more accessible with better infrastructure. San Gerardo de Dota is more remote, less crowded, and often produces closer encounters due to lower visitor pressure.

**How much does a quetzal photography tour cost?**
Full-day guided tours from Monteverde typically run 80 to 150 USD per person. Specialized photography tours with extended blind time can run 200 to 400 USD. Accommodations near San Gerardo de Dota with guided quetzal walks are typically 100 to 200 USD per night.

**Can I see quetzals without a guide?**
Possible at Monteverde during breeding season, but the odds are significantly lower. A guide's knowledge of specific feeding trees and current territories transforms the odds.

**What gear do I need for quetzal photography?**
A 400mm or longer telephoto for canopy and distant birds. A 100 to 400mm zoom for closer encounters at feeding trees. Tripod or monopod for stability in low light. Rain covers for everything.`;
const title = 'Resplendent Quetzal in Costa Rica: The Complete Guide to Seeing and Photographing Costa Rica\'s Most Elusive Bird';
const excerpt = 'The resplendent quetzal is Central America\'s most sought-after bird. This guide covers the best Costa Rica locations, timing tips, and photography advice from a resident birder.';
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
