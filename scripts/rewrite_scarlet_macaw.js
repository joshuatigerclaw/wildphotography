#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'scarlet-macaw-costa-rica';
const content = `The scarlet macaw is among the most unmistakable birds in the Western Hemisphere — a meter-long parrot dressed in primary red, yellow, blue, and green, with a bare white face patch and a massive curved beak that has evolved to crack the hardest tropical nuts. In flight, a scarlet macaw is loud and conspicuous — their calls carry more than a kilometer through forest air, and a flying flock of six or eight birds moving between roosting and feeding sites is one of the most spectacular sights tropical wildlife photography has to offer.

Costa Rica holds two main populations of scarlet macaws. The Pacific coast population, centered on Carara National Park and the adjacent Osa Peninsula, represents the northern edge of the species' primary range. These birds have been the subject of intensive conservation work over the past two decades, including nest box programs that have significantly boosted nesting success in areas where old-growth tree cavities are scarce. The population has recovered enough that groups of 20 or more are regularly observed near the clay licks that macaws visit to neutralize toxins in their seed-heavy diet.

Carara National Park, about 90 minutes from San Jose on the Pacific coast road, is the most accessible and reliable location for photographing scarlet macaws. The park's forests are less dense than Corcovado, making photography more practical, and the macaw populations here are well habituated to the presence of photographers at established viewing points. Early morning visits to the river clay licks produce the best images — position yourself at a viewing blind before dawn and wait for the birds to arrive.

The Osa Peninsula and Corcovado National Park support the other significant Costa Rica scarlet macaw population. Here the birds are warier, the forest denser, and the logistics of reaching reliable viewing spots more demanding. A local guide is nearly essential — the macaws move between feeding and roosting sites according to seasonal fruit availability, and a guide who knows the current patterns can dramatically improve your chances of a close encounter. The payoffs are proportional: photographing scarlet macaws against the backdrop of Corcovado's wild interior is a qualitatively different experience from a Carara morning.

Photographing macaws requires patience and the right gear. A telephoto lens in the 400 to 600mm range handles most situations — close enough for detail shots at the clay lick, long enough to capture birds in the canopy without disturbing them. Hiding in a ground-level viewing blind is the best approach at clay licks, where macaws are accustomed to the presence of photographers. The best light is early morning, before the forest canopy filters the sun into soft directional beams.

Conservation of the scarlet macaw in Costa Rica has been a genuine success story. The Pacific population was reduced to a few hundred individuals by the 1970s due to hunting and habitat loss. The establishment of Carara National Park in 1978 and decades of nest protection work have brought the Pacific population back to estimated 1,000 to 1,500 individuals. For wildlife photographers, this means that encounters that would have required significant luck 30 years ago are now achievable with reasonable planning.

The best time to photograph scarlet macaws in Costa Rica is from February through May, when breeding activity brings the birds to specific feeding and clay lick sites with greater predictability. The dry season also means clearer skies and better light. Early morning — before 7am — is consistently the most productive window.

---

Book a guided scarlet macaw photography tour in Costa Rica: [GetYourGuide Tours](/go/gyg/scarlet-macaw)

## Frequently Asked Questions

**Where is the best place to photograph scarlet macaws in Costa Rica?**
Carara National Park and the Osa Peninsula offer the most reliable encounters, with Carara being more accessible and the Osa offering a more wild experience.

**What is the best time of year to see scarlet macaws?**
February through May coincides with breeding season and the dry weather, when the birds are most active and visible around clay licks and feeding trees.

**Are scarlet macaws endangered in Costa Rica?**
The Pacific population has recovered significantly thanks to conservation work. They are still classified as endangered nationally, but population trends are positive, which is encouraging.

**Can I see scarlet macaws from a day trip from San Jose?**
Yes — Carara National Park is 90 minutes from San Jose and can be visited as a long day trip. Overnight stays in the Osa or at a lodge near Carara significantly improve your chances of good encounters.

**What lens do I need for macaw photography?**
A 400mm or longer telephoto is ideal for capturing birds at clay licks and canopy feeding trees. A 100 to 400mm zoom handles most situations at close-range viewing blinds.`;
const title = 'Scarlet Macaw in Costa Rica: The Complete Photography and Birding Guide for 2026';
const excerpt = 'Scarlet macaws in Costa Rica — where to find them, how to photograph them, and what makes this species so special. Complete guide from a resident bird photographer.';
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
