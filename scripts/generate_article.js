#!/usr/bin/env node
/**
 * WildPhotography SEO Article Generator
 * Generates a single SEO article using validated photo inventory.
 * Usage: node generate_article.js <article_slug>
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PG = 'postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require&channel_binding=require';
const OUTPUT_DIR = path.join(__dirname, '../runtime/article_outputs');
const SLUG = process.argv[2];

if (!SLUG) { console.error('Usage: node generate_article.js <slug>'); process.exit(1); }

const ARTICLE_SPECS = {
  'best-beaches-in-costa-rica': {
    title: 'Best Beaches in Costa Rica: The Complete 2026 Guide for Travelers and Photographers',
    target_keyword: 'best beaches in costa rica',
    article_type: 'theme_roundup',
    region: 'costa-rica',
    theme: 'beaches',
    word_count_target: 1800,
    h2_sections: ['Why Costa Rica Has Some of Central America\'s Best Beaches', 'The Pacific Coast: Guanacaste\'s Golden Sand Paradise', 'Manuel Antonio: Where Rainforest Meets the Sea', 'The Caribbean Coast: Puerto Viejo and Beyond', 'Best Time to Visit Costa Rica\'s Beaches', 'Beach Photography Tips for Costa Rica', 'Where to Stay Near Costa Rica\'s Best Beaches'],
    faq_count: 6,
    affiliate_intent: 'high',
    photo_topics: ['Guanacaste Beaches', 'Jacó Beach', 'Tambor', 'Papagayo Peninsula', 'Tamarindo', 'Isla Tortuga', 'Puerto Viejo', 'Playa Hermosa'],
    internal_links: ['guanacaste-beaches-travel-guide', 'manuel-antonio-travel-wildlife-guide', 'costa-rica-beaches-guide'],
    affiliate_block: { type: 'tours', placement: 'mid-article' }
  },
  'costa-rica-wildlife-photography-guide': {
    title: 'Costa Rica Wildlife Photography Guide: Tips, Locations, and Species for 2026',
    target_keyword: 'costa rica wildlife photography guide',
    article_type: 'photography_guide',
    region: 'costa-rica',
    theme: 'wildlife photography',
    word_count_target: 1600,
    h2_sections: ['Why Costa Rica Is a Wildlife Photographer\'s Dream', 'Essential Gear for Costa Rica Wildlife Photography', 'Best Locations for Wildlife Photography', 'Top Species to Photograph in Costa Rica', 'Timing Your Shoots: Seasons and Light', 'Ethical Wildlife Photography Practices', 'Photography Tours and Guides in Costa Rica'],
    faq_count: 5,
    affiliate_intent: 'high',
    photo_topics: ['Wildlife', 'Birds of Costa Rica', 'Arenal Volcano'],
    species_photos: ['Scarlet Macaw', 'Resplendent Quetzal', 'Rufous-tailed Hummingbird', 'American Crocodile', 'Anhinga'],
    internal_links: ['birds-of-costa-rica', 'best-national-parks-costa-rica-wildlife', 'arenal-volcano-travel-photography-guide'],
    affiliate_block: { type: 'tours', placement: 'mid-article' }
  },
  'birds-of-costa-rica': {
    title: 'Birds of Costa Rica: A Complete Guide to Costa Rica\'s Most Spectacular Avian Life',
    target_keyword: 'birds of costa rica',
    article_type: 'theme_roundup',
    region: 'costa-rica',
    theme: 'birds',
    word_count_target: 1500,
    h2_sections: ['Costa Rica\'s Birding Paradise: Why 900+ Species Call This Country Home', 'Iconic Birds Every Visitor Hopes to See', 'Where to Find Costa Rica\'s Best Birds', 'Best Time of Year for Birdwatching in Costa Rica', 'Bird Photography Tips for Costa Rica', 'Birding Tours and Guides'],
    faq_count: 6,
    affiliate_intent: 'medium',
    photo_topics: ['Birds of Costa Rica'],
    species_photos: ['Resplendent Quetzal', 'Scarlet Macaw', 'Rufous-tailed Hummingbird', 'Keel-billed Toucan', 'Great Kiskadee', 'Brown Pelican', 'Anhinga'],
    internal_links: ['resplendent-quetzal-costa-rica', 'scarlet-macaw-costa-rica', 'monteverde-cloud-forest-wildlife-guide', 'best-places-tropical-birds-costa-rica'],
    affiliate_block: { type: 'tours', placement: 'end-article' }
  },
  'manuel-antonio-travel-wildlife-guide': {
    title: 'Manuel Antonio, Costa Rica: The Complete Travel and Wildlife Guide for 2026',
    target_keyword: 'manuel antonio costa rica wildlife',
    article_type: 'location_guide',
    region: 'central-pacific',
    location_name: 'Manuel Antonio',
    word_count_target: 1400,
    h2_sections: ['Why Manuel Antonio Is Costa Rica\'s Most Visited National Park', 'Wildlife in Manuel Antonio: What You\'re Likely to See', 'Best Time to Visit Manuel Antonio', 'Getting to Manuel Antonio', 'Wildlife Photography Tips for Manuel Antonio', 'Where to Stay Near Manuel Antonio', 'Things to Do Beyond the Beach'],
    faq_count: 5,
    affiliate_intent: 'high',
    photo_topics: ['Manuel Antonio'],
    internal_links: ['things-to-do-manuel-antonio', 'best-beaches-in-costa-rica', 'jaco-beach-costa-rica-guide'],
    affiliate_block: { type: 'tours', placement: 'after-wildlife-section' }
  },
  'arenal-volcano-travel-photography-guide': {
    title: 'Arenal Volcano, Costa Rica: The Complete Photography and Travel Guide for 2026',
    target_keyword: 'arenal volcano costa rica photography',
    article_type: 'location_guide',
    region: 'northern-zone',
    location_name: 'Arenal Volcano',
    word_count_target: 1500,
    h2_sections: ['Arenal Volcano: Costa Rica\'s Most Iconic Landmark', 'Understanding Arenal\'s Geology and History', 'Best Photography Spots for Arenal Volcano', 'Wildlife Around Arenal Volcano', 'Hot Springs Near Arenal: Relaxing After a Day of Photography', 'When to Photograph Arenal', 'Getting to Arenal and La Fortuna'],
    faq_count: 6,
    affiliate_intent: 'high',
    photo_topics: ['Arenal Volcano'],
    internal_links: ['la-fortuna-travel-photography-guide', 'costa-rica-volcano-photography-guide', 'best-national-parks-costa-rica-wildlife'],
    affiliate_block: { type: 'hotels', placement: 'mid-article' }
  },
  'monteverde-cloud-forest-wildlife-guide': {
    title: 'Monteverde Cloud Forest, Costa Rica: The Complete Wildlife and Travel Guide for 2026',
    target_keyword: 'monteverde cloud forest wildlife',
    article_type: 'location_guide',
    region: 'central-valley',
    location_name: 'Monteverde',
    word_count_target: 1500,
    h2_sections: ['Monteverde Cloud Forest: Where the Clouds Meet the Canopy', 'The Quetzal Connection: Why Monteverde Is Legendary Among Birders', 'Other Wildlife Highlights of Monteverde', 'Photography in the Cloud Forest: Challenges and Rewards', 'When to Visit Monteverde', 'Getting to Monteverde: Practical Tips', 'Where to Stay in Monteverde'],
    faq_count: 6,
    affiliate_intent: 'high',
    photo_topics: ['Monteverde'],
    species_photos: ['Resplendent Quetzal'],
    internal_links: ['resplendent-quetzal-costa-rica', 'best-rainforest-destinations-costa-rica', 'guanacaste-beaches-travel-guide'],
    affiliate_block: { type: 'tours', placement: 'mid-article' }
  },
  'guanacaste-beaches-travel-guide': {
    title: 'Guanacaste Beaches, Costa Rica: The Complete Travel and Photography Guide for 2026',
    target_keyword: 'best beaches in guanacaste costa rica',
    article_type: 'location_guide',
    region: 'guanacaste',
    location_name: 'Guanacaste',
    word_count_target: 1500,
    h2_sections: ['Guanacaste: Costa Rica\'s Beach Paradise', 'Top Guanacaste Beaches Worth Visiting', 'Wildlife Along Guanacaste\'s Coastline', 'Best Time to Visit Guanacaste Beaches', 'Photography Tips for Guanacaste', 'Getting to Guanacaste', 'Where to Stay on Guanacaste\'s Beaches'],
    faq_count: 6,
    affiliate_intent: 'high',
    photo_topics: ['Guanacaste', 'Guanacaste Beaches', 'Tamarindo', 'Papagayo Peninsula', 'Playas del Coco', 'Playa Hermosa'],
    internal_links: ['best-beaches-in-costa-rica', 'tamarindo-guanacaste-beach-guide', 'guanacaste-costa-rica-photography-guide'],
    affiliate_block: { type: 'tours', placement: 'mid-article' }
  },
  'scarlet-macaw-costa-rica': {
    title: 'Scarlet Macaw in Costa Rica: The Complete Photography and Birding Guide for 2026',
    target_keyword: 'scarlet macaw in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Scarlet Macaw',
    word_count_target: 1300,
    h2_sections: ['The Scarlet Macaw: Costa Rica\'s Most Colorful Bird', 'Where to See Scarlet Macaws in Costa Rica', 'Best Time and Locations for Photography', 'Understanding Scarlet Macaw Behavior', 'Conservation Status and Responsible Viewing', 'Scarlet Macaw Photography Tips'],
    faq_count: 5,
    affiliate_intent: 'medium',
    species_photos: ['Scarlet Macaw'],
    internal_links: ['birds-of-costa-rica', 'best-places-tropical-birds-costa-rica', 'corcovado-national-park-costa-rica'],
    affiliate_block: { type: 'tours', placement: 'end-article' }
  },
  'resplendent-quetzal-costa-rica': {
    title: 'Resplendent Quetzal in Costa Rica: The Complete Guide to Seeing and Photographing Costa Rica\'s Most Elusive Bird',
    target_keyword: 'resplendent quetzal in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Resplendent Quetzal',
    word_count_target: 1400,
    h2_sections: ['The Resplendent Quetzal: A Bird Worth Traveling For', 'Best Places to See the Quetzal in Costa Rica', 'Monteverde: The Quetzal Gateway', 'San Gerardo de Dota: The Quetzal\'s Best-Kept Secret', 'When to See Quetzals in Costa Rica', 'Quetzal Photography: Tips from the Field', 'Conservation: Protecting the Quetzal\'s Cloud Forest Home'],
    faq_count: 6,
    affiliate_intent: 'medium',
    species_photos: ['Resplendent Quetzal'],
    internal_links: ['monteverde-cloud-forest-wildlife-guide', 'birds-of-costa-rica', 'best-places-tropical-birds-costa-rica'],
    affiliate_block: { type: 'tours', placement: 'mid-article' }
  },
  'where-to-see-sloths-costa-rica': {
    title: 'Where to See Sloths in Costa Rica: The Complete Guide for 2026',
    target_keyword: 'where to see sloths in costa rica',
    article_type: 'species_guide',
    region: 'costa-rica',
    species_name: 'Sloth',
    word_count_target: 1300,
    h2_sections: ['Costa Rica\'s Beloved Sloths: Two Species, One Unforgettable Experience', 'Best Places to See Sloths in Costa Rica', 'Guanacaste and the Pacific Coast', 'The Caribbean Side: Puerto Viejo and Cahuita', 'Best Time of Day to Spot Sloths', 'Sloth Photography Tips', 'Responsible Wildlife Viewing'],
    faq_count: 5,
    affiliate_intent: 'medium',
    internal_links: ['guanacaste-beaches-travel-guide', 'puerto-viejo-costa-rica-guide', 'costa-rica-wildlife-photography-guide'],
    affiliate_block: { type: 'tours', placement: 'end-article' }
  }
};

async function queryPhotos(client, topics) {
  if (!topics || topics.length === 0) return [];
  const placeholders = topics.map((_, i) => `$${i + 1}`).join(', ');
  const result = await client.query(
    `SELECT id, slug, title, thumb_url, small_url, medium_url, location_name, region, species_common_name, keywords
     FROM photos
     WHERE search_ready = true
       AND ready_for_public_render = true
       AND (location_name IN (${placeholders}) OR region IN (${placeholders}))
     LIMIT 20`,
    topics
  );
  return result.rows;
}

async function querySpeciesPhotos(client, species) {
  const placeholders = species.map((_, i) => `$${i + 1}`).join(', ');
  const result = await client.query(
    `SELECT id, slug, title, thumb_url, small_url, medium_url, location_name, species_common_name
     FROM photos
     WHERE search_ready = true
       AND ready_for_public_render = true
       AND species_common_name IN (${placeholders})
     LIMIT 10`,
    species
  );
  return result.rows;
}

async function upsertArticle(client, article) {
  const result = await client.query(
    `INSERT INTO content_articles (title, slug, article_type, excerpt, content, status, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       article_type = EXCLUDED.article_type,
       excerpt = EXCLUDED.excerpt,
       content = EXCLUDED.content,
       updated_at = NOW()
     RETURNING id, slug, status`,
    [article.title, article.slug, article.article_type, article.excerpt, article.content, 'draft']
  );
  return result.rows[0];
}

function buildArticleContent(spec, photos, speciesPhotos) {
  // Build intro paragraph
  const intro = `Costa Rica draws photographers and wildlife enthusiasts from around the world, and for good reason. ${spec.target_keyword.replace(/^\w/, c => c.toUpperCase())} — this guide covers everything you need to know to make the most of your trip, whether you're a first-time visitor or a seasoned traveler returning for another look.`;

  // Build body sections
  const body = spec.h2_sections.map((section, i) => {
    let content = '';
    if (i === 0) {
      content = `This section sets the stage for everything that follows. `;
    } else if (i === 1) {
      content = `Here's what you need to know about this aspect of the topic. `;
    } else if (i === spec.h2_sections.length - 1) {
      content = `A few final considerations before you go. `;
    } else {
      content = `This area deserves careful attention when planning your trip. `;
    }
    return { heading: section, content };
  });

  // Build FAQ
  const faqs = [];
  const faqTemplates = {
    5: ['What is the best time to visit?', 'How do I get there?', 'Is it safe for photographers?', 'What should I bring?', 'Are there guided tours available?'],
    6: ['What is the best time to visit?', 'How do I get there?', 'Is it safe for photographers?', 'What should I bring?', 'Are there guided tours available?', 'Can I see wildlife year-round?'],
  };
  (faqTemplates[spec.faq_count] || faqTemplates[5]).forEach(q => {
    faqs.push({ question: q, answer: 'Detailed answer would go here based on research and validated content.' });
  });

  // Build affiliate CTA
  const affiliateCTAs = {
    tours: 'Book a guided tour to make the most of your visit: [GetYourGuide Tours](/go/gyg/tours)',
    hotels: 'Find the best accommodation near this location: [Viator Hotels](/go/viator/hotels)',
    activity: 'Check available activities and tours: [GetYourGuide](/go/gyg/activity)'
  };
  const affiliate_cta = affiliateCTAs[spec.affiliate_block.type] || affiliateCTAs.tours;

  return { intro, body, faqs, affiliate_cta };
}

async function main() {
  const spec = ARTICLE_SPECS[SLUG];
  if (!spec) {
    console.error(`Unknown slug: ${SLUG}`);
    process.exit(1);
  }

  console.log(`[${SLUG}] Starting article generation...`);

  const client = new Client({ connectionString: PG });
  await client.connect();

  try {
    // Query photos
    const photoTopics = spec.photo_topics || [];
    const speciesTopics = spec.species_photos || [];
    
    let photos = [];
    let speciesPhotos = [];

    if (photoTopics.length > 0) {
      photos = await queryPhotos(client, photoTopics);
      console.log(`[${SLUG}] Found ${photos.length} location photos`);
    }

    if (speciesTopics.length > 0) {
      speciesPhotos = await querySpeciesPhotos(client, speciesTopics);
      console.log(`[${SLUG}] Found ${speciesPhotos.length} species photos`);
    }

    // Build article structure
    const content = buildArticleContent(spec, photos, speciesPhotos);

    // Build excerpt
    const excerpt = `${spec.title.split(':')[1] || spec.title}. Expert photography tips, travel advice, and the best locations for capturing ${spec.target_keyword}.`;

    // Combine full content
    let fullContent = content.intro + '\n\n';
    content.body.forEach(section => {
      fullContent += `## ${section.heading}\n\n${section.content}\n\n`;
    });
    fullContent += `\n---\n\n${content.affiliate_cta}\n\n`;
    fullContent += `## Frequently Asked Questions\n\n`;
    content.faqs.forEach(faq => {
      fullContent += `**${faq.question}** ${faq.answer}\n\n`;
    });

    const article = {
      slug: SLUG,
      title: spec.title,
      article_type: spec.article_type,
      excerpt,
      content: fullContent,
      target_keyword: spec.target_keyword,
      region: spec.region,
      location_name: spec.location_name || null,
      species_name: spec.species_name || null,
      theme: spec.theme || null,
      internal_links: spec.internal_links,
      photos_selected: photos.length + speciesPhotos.length,
      photo_ids: [...photos.map(p => p.id), ...speciesPhotos.map(p => p.id)].slice(0, 10),
      generated_at: new Date().toISOString()
    };

    // Upsert to Neon
    const dbResult = await upsertArticle(client, {
      title: spec.title,
      slug: SLUG,
      article_type: spec.article_type,
      excerpt,
      content: fullContent
    });
    console.log(`[${SLUG}] Saved to Neon: id=${dbResult.id}, status=${dbResult.status}`);

    // Write output JSON
    const outputPath = path.join(OUTPUT_DIR, `${SLUG}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(article, null, 2));
    console.log(`[${SLUG}] Written to ${outputPath}`);

    await client.end();
    process.exit(0);
  } catch (err) {
    console.error(`[${SLUG}] Error:`, err.message);
    await client.end();
    process.exit(1);
  }
}

main();
