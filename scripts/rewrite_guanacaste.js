#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'guanacaste-beaches-travel-guide';
const content = `Guanacaste province covers the northwestern corner of Costa Rica, stretching from the Pacific coast at the Nicaragua border down to the Nicoya Peninsula. The region occupies the drier Pacific slope of the country — the tempisque climate zone — where the dry season runs longer and more pronounced than in the Central Valley or the Caribbean slope. The landscape reflects this: dry forest trees shed their leaves in January and February, the hills turn golden, and the light takes on the warm amber quality that photographers prize.

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
Playa Flamingo and the Papagayo Peninsula offer the most dramatic scenery. Playas del Coco works best for wildlife and marine life subjects. Tamarindo is the best base for exploring multiple beaches.

**How do I get around Guanacaste without a car?**
A rental car is strongly recommended — the beaches are spread along coastal roads that are not well served by public transport. A 4x4 opens up more remote beaches and the mountain roads.

**Are there good wildlife photography opportunities in Guanacaste?**
Yes — howler monkeys near the beach forest edges, wading birds in the mangroves near the tempisque Gulf, and marine life around the offshore islands and reefs. The dry forest wildlife is different from the rainforest species but equally compelling.

**Is Guanacaste safe for tourists?**
Generally yes. The resort corridor is heavily touristed and well-policed. Normal urban precautions apply in Liberia and the larger towns. Beach safety means paying attention to surf conditions, which can change quickly.`;
const title = 'Guanacaste Beaches, Costa Rica: The Complete Travel and Photography Guide for 2026';
const excerpt = 'Guanacaste\'s Pacific beaches range from developed resort strips to quiet fishing villages. Complete travel guide covering the best beaches, wildlife, photography tips, and where to stay.';
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
