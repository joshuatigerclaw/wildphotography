#!/usr/bin/env node
const { Client } = require('pg');
const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const client = new Client({ connectionString: PG });
const slug = 'birds-of-costa-rica';
const content = `Costa Rica holds an extraordinary concentration of bird life for a country of its size — more than 900 species recorded in an area smaller than West Virginia. That figure includes resident species, migrants from North America that winter here, and rare vagrants that turn up in unexpected places. For birdwatchers and wildlife photographers, the country functions as a greatest-hits album of Neotropical birds: quetzals, macaws, toucans, antbirds, manakins, and hummingbirds filling every habitat from mangrove swamps to cloud forest peaks.

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
The Cocle's antwren and black-capped petrel are extremely rare. For most visitors, Baird's tapir-associated birds are harder to find than the quetzal.

**Are there tours specifically for bird photography?**
Yes — several Costa Rica operators offer photography-focused tours with photographers' blinds, meal schedules that align with peak activity, and guides who know specific territorial spots for target species.`;
const title = 'Birds of Costa Rica: A Complete Guide to Costa Rica\'s Most Spectacular Avian Life';
const excerpt = 'Costa Rica hosts 900+ bird species across diverse habitats. This guide covers the best places to bird, top species to photograph, and practical tips from a resident photographer.';
async function main() {
  await client.connect();
  const r = await client.query(
    `INSERT INTO content_articles (title,slug,article_type,excerpt,content,status,updated_at)
     VALUES ($1,$2,'theme_roundup',$3,$4,'draft',NOW())
     ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,content=EXCLUDED.content,updated_at=NOW()
     RETURNING id,slug,status`,
    [title, slug, excerpt, content]);
  console.log(`[${slug}] Saved: id=${r.rows[0].id}, words=${content.split(/\s+/).length}`);
  await client.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
