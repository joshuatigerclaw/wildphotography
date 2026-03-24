#!/usr/bin/env node
/**
 * WildPhotography Article Dispatcher
 * Dispatches generation of top-10 priority SEO articles to subagents.
 * Each subagent generates one article and upserts into Neon content_articles.
 */
const { spawn } = require('child_process');
const path = require('path');

const ARTICLES = [
  {
    id: 1,
    slug: 'best-beaches-in-costa-rica',
    target_keyword: 'best beaches in costa rica',
    article_type: 'theme_roundup',
    region: 'costa-rica',
    theme: 'beaches',
    notes: 'Flagship pillar — 1500–2200 words, affiliate block required',
    photo_topics: ['Guanacaste Beaches', 'Tambor', 'Jacó Beach', 'Papagayo Peninsula', 'Playa Hermosa', 'Tamarindo', 'Isla Tortuga', 'Costa Rica Beaches'],
    species_photos: [],
    affiliate_intent: 'high'
  },
  {
    id: 2,
    slug: 'costa-rica-wildlife-photography-guide',
    target_keyword: 'costa rica wildlife photography guide',
    article_type: 'photography_guide',
    region: 'costa-rica',
    theme: 'wildlife photography',
    notes: 'Flagship pillar — 1500–2200 words, affiliate block required',
    photo_topics: ['Wildlife', 'Birds of Costa Rica'],
    species_photos: ['Scarlet Macaw', 'Resplendent Quetzal', 'Rufous-tailed Hummingbird', 'Anhinga', 'Brown Pelican'],
    affiliate_intent: 'high'
  },
  {
    id: 3,
    slug: 'birds-of-costa-rica',
    target_keyword: 'birds of costa rica',
    article_type: 'theme_roundup',
    region: 'costa-rica',
    theme: 'birds',
    notes: 'High photo inventory — use strongest bird images',
    photo_topics: ['Birds of Costa Rica'],
    species_photos: ['Rufous-tailed Hummingbird', 'Resplendent Quetzal', 'Scarlet Macaw', 'Anhinga', 'Brown Pelican', 'Great Kiskadee', 'Keel-billed Toucan'],
    affiliate_intent: 'medium'
  },
  {
    id: 4,
    slug: 'manuel-antonio-travel-wildlife-guide',
    target_keyword: 'manuel antonio costa rica wildlife',
    article_type: 'location_guide',
    region: 'central-pacific',
    location_name: 'Manuel Antonio',
    notes: 'Strong affiliate intent — include tours block',
    photo_topics: ['Manuel Antonio'],
    species_photos: [],
    affiliate_intent: 'high'
  },
  {
    id: 5,
    slug: 'arenal-volcano-travel-photography-guide',
    target_keyword: 'arenal volcano costa rica photography',
    article_type: 'location_guide',
    region: 'northern-zone',
    location_name: 'Arenal Volcano',
    notes: 'Draft exists at article_arenal.md — use as reference but rewrite to spec',
    photo_topics: ['Arenal Volcano'],
    species_photos: [],
    affiliate_intent: 'high'
  },
  {
    id: 6,
    slug: 'monteverde-cloud-forest-wildlife-guide',
    target_keyword: 'monteverde cloud forest wildlife',
    article_type: 'location_guide',
    region: 'central-valley',
    location_name: 'Monteverde',
    notes: 'Include quetzal angle — strong species link opportunity',
    photo_topics: ['Monteverde'],
    species_photos: ['Resplendent Quetzal'],
    affiliate_intent: 'high'
  },
  {
    id: 7,
    slug: 'guanacaste-beaches-travel-guide',
    target_keyword: 'best beaches in guanacaste costa rica',
    article_type: 'location_guide',
    region: 'guanacaste',
    location_name: 'Guanacaste',
    notes: 'Affiliate block required — strong tour and activity intent',
    photo_topics: ['Guanacaste', 'Guanacaste Beaches', 'Tamarindo', 'Papagayo Peninsula', 'Playas del Coco', 'Playa Hermosa'],
    species_photos: [],
    affiliate_intent: 'high'
  },
  {
    id: 8,
    slug: 'scarlet-macaw-costa-rica',
    target_keyword: 'scarlet macaw in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Scarlet Macaw',
    notes: 'Draft exists — rewrite to full spec',
    photo_topics: [],
    species_photos: ['Scarlet Macaw'],
    affiliate_intent: 'medium'
  },
  {
    id: 9,
    slug: 'resplendent-quetzal-costa-rica',
    target_keyword: 'resplendent quetzal in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Resplendent Quetzal',
    notes: 'Link to Monteverde and San Gerardo de Dota location pages',
    photo_topics: [],
    species_photos: ['Resplendent Quetzal'],
    affiliate_intent: 'medium'
  },
  {
    id: 10,
    slug: 'where-to-see-sloths-costa-rica',
    target_keyword: 'where to see sloths in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Sloth',
    notes: 'Draft exists at article_sloth.md — rewrite to full spec',
    photo_topics: [],
    species_photos: [],
    affiliate_intent: 'medium'
  }
];

const OUTPUT_DIR = path.join(__dirname, '../runtime/article_outputs');

// Ensure output dir exists
const fs = require('fs');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`Dispatching ${ARTICLES.length} article generation tasks...`);
ARTICLES.forEach((article, i) => {
  const outputFile = path.join(OUTPUT_DIR, `${article.slug}.json`);
  console.log(`[${i + 1}/${ARTICLES.length}] ${article.slug} → ${outputFile}`);
});

module.exports = { ARTICLES, OUTPUT_DIR };
