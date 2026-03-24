#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'best-beaches-in-costa-rica';

const content = `Costa Rica's Pacific coast stretches for more than 1,200 kilometers, and the variety surprises most first-time visitors. You won't find the manicured resort strips here that you will encounter in Mexico or the Dominican Republic. Instead, Costa Rica's beaches tend to be wilder, flanked by mangrove forests or backed by steep jungle hills, with howler monkeys often audible from the sand. Guanacaste province, in the northwest, concentrates the country's most iconic beach scenes — long crescents of golden-brown sand backed by dry tropical forest, with frigatebirds circling overhead and pelicans working the shallows at dawn.

The country's two coasts offer genuinely different experiences. The Pacific side delivers consistent surf, dramatic sunsets, and easy access from San Jose. The Guanacaste corridor between Liberia and Tamarindo has become the most developed stretch, yet places like Playa Flamingo and Playa Conchal have retained their character despite the growth, with turquoise water that genuinely looks like it belongs in the Caribbean.

Playas del Coco and Playa Hermosa offer a more grounded beach-town atmosphere, with local fishing boats pulling up on the sand each morning and restaurants serving fresh catch by the plate. Further south, the Nicoya Peninsula transitions toward genuinely remote — Montezuma and Santa Teresa draw a backpacker and yogi crowd, with fewer amenities but a rawer, more intimate relationship between beach and jungle.

The Caribbean coast moves to a slower rhythm entirely. Puerto Viejo de Talamanca sits at the end of a road that seems to go nowhere in particular, flanked by banana plantations and then suddenly opening onto a beach of black volcanic sand. The water is rougher here, the vibe more laid-back, the cuisine shaped by the Afro-Caribbean community that has defined this region for generations. Cahuita National Park protects a gorgeous stretch of reef-lined shore.

Timing matters on both coasts. The Pacific side sits in the dry season corridor — November through April brings sunny days and calm seas, making it the high season. The Guanacaste beaches in particular see almost no rain from December through March. Summer months (April through May) can be brutally hot inland but surprisingly pleasant at the coast. The Caribbean side has its own logic — driest months are September and October.

Most Costa Rica beach photography happens in the first two hours after sunrise or the last hour before sunset. Midday light on the Pacific coast tends to be flat and contrasty, washing out the very blues that make the water so striking in early morning shots. The one exception is overcast mornings during the green season, which can produce unexpectedly moody, magazine-quality images. Sunset at Tamarindo or Playa Flamingo reliably produces the kind of warm, backlit beach scenes that travel well on social media and stock platforms.

Where to stay near Costa Rica's best beaches depends on your priorities. Guanacaste works well as a base for exploring multiple beaches if you have a rental car — the distances are manageable and each beach has its own character at different times of day. All-inclusive resorts work well here for first-time visitors who want convenience, while boutique hotels in Playa Flamingo and Las Catalinas cater to a more discerning crowd. Puerto Viejo is best approached as a destination in itself rather than a base — spend three or four nights there and really absorb the rhythms of the place.

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
The Pacific coast is more developed, has consistent surf, and is drier during high season. The Caribbean coast is more laid-back, culturally distinct, and receives more rain even during the December through April high season.`;

const title = 'Best Beaches in Costa Rica: The Complete 2026 Guide for Travelers and Photographers';
const excerpt = 'Costa Rica\'s best beaches span the Pacific\'s golden Guanacaste shores to the Caribbean\'s volcanic black-sand strands. Expert guide with photography tips, travel advice, and must-visit beaches.';

async function main() {
  await client.connect();
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,'theme_roundup',$3,$4,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,content=EXCLUDED.content,updated_at=NOW()
     RETURNING id,slug,status`,
    [title, slug, excerpt, content]);
  console.log(`[${slug}] Saved: id=${r.rows[0].id}, status=${r.rows[0].status}, words=${content.split(/\s+/).length}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
