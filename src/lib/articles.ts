/**
 * Travel Guide Content Generator for WildPhotography
 * 
 * Generates travel guide articles from photo library
 */

const GALLERY_CONTEXT: Record<string, { 
  title: string;
  description: string;
  keywords: string[];
  sections: string[];
}> = {
  'arenal-volcano': {
    title: "Arenal Volcano Costa Rica - Complete Travel Guide",
    description: "Discover Arenal Volcano, Costa Rica's most iconic destination. Find the best tours, places to stay, and when to visit.",
    keywords: ["arenal volcano", "la fortuna", "hot springs", "hanging bridges", "costa rica travel"],
    sections: [
      "Getting to Arenal",
      "Best Things to Do",
      "Where to Stay",
      "When to Visit",
      "Photography Tips"
    ]
  },
  'monteverde': {
    title: "Monteverde Cloud Forest - Complete Travel Guide",
    description: "Explore the Monteverde Cloud Forest in Costa Rica. Discover wildlife, birdwatching, and the famous zip lines.",
    keywords: ["monteverde", "cloud forest", "birdwatching", "zip lines", "costa rica eco tourism"],
    sections: [
      "About Monteverde",
      "Wildlife & Birding",
      "Adventure Activities",
      "Where to Stay",
      "Best Time to Visit"
    ]
  },
  'birds': {
    title: "Birdwatching in Costa Rica - Ultimate Guide",
    description: "Costa Rica is a bird paradise with 900+ species. Find the best birding spots, tours, and photography tips.",
    keywords: ["birdwatching costa rica", "birds", "quetzal", "macaw", "toucan", "bird photography"],
    sections: [
      "Why Costa Rica for Birds",
      "Top Birding Locations",
      "Best Birds to See",
      "Birding Tours",
      "Photography Tips"
    ]
  },
  'beaches': {
    title: "Best Beaches in Costa Rica - 2026 Guide",
    description: "Discover the most beautiful beaches in Costa Rica. From Pacific surf spots to Caribbean coves, find your perfect beach.",
    keywords: ["costa rica beaches", "best beaches", "surf", "beach vacation", "guanacaste"],
    sections: [
      "Top Pacific Beaches",
      "Caribbean Beaches",
      "Beach Activities",
      "Where to Stay",
      "Beach Safety"
    ]
  },
  'jaco-beach': {
    title: "Jaco Beach Costa Rica - Complete Guide",
    description: "Jaco Beach is Costa Rica's closest beach to San José. Find surf schools, nightlife, and things to do.",
    keywords: ["jaco beach", "jaco costa rica", "surfing", "pacifica surf"],
    sections: [
      "Getting to Jaco",
      "Surfing in Jaco",
      "Things to Do",
      "Where to Stay",
      "Nightlife"
    ]
  }
};

// Get sample photos for a gallery
export async function getSamplePhotos(gallerySlug: string, count = 4) {
  // This would query the DB in production
  return [];
}

// Generate article HTML with embedded photos
export function generateTravelArticle(gallerySlug: string, photos: any[]): string {
  const ctx = GALLERY_CONTEXT[gallerySlug] || {
    title: `${gallerySlug} Costa Rica - Travel Guide`,
    description: `Discover ${gallerySlug} in Costa Rica. Beautiful photography and travel tips.`,
    keywords: [gallerySlug, "costa rica", "travel"],
    sections: ["Overview", "Getting There", "What to See", "Where to Stay"]
  };
  
  const photoBlocks = photos.map(p => `
    <figure class="article-photo">
      <img src="${p.url}" alt="${p.title}" loading="lazy">
      <figcaption>${p.caption}</figcaption>
    </figure>
  `).join('');
  
  const sectionsHtml = ctx.sections.map(section => `
    <h2>${section}</h2>
    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
  `).join('');
  
  return `
    <article class="travel-guide">
      <header>
        <h1>${ctx.title}</h1>
        <p class="lead">${ctx.description}</p>
      </header>
      
      <div class="photo-gallery">
        ${photoBlocks}
      </div>
      
      <div class="content">
        ${sectionsHtml}
      </div>
      
      <aside class="booking-widget">
        <h3>Book Tours & Activities</h3>
        <div data-gyg-widget="auto" data-gyg-partner-id="6ZV7KMH" data-gyg-cmp="wildphoto-article"></div>
      </aside>
    </article>
  `;
}

// Article CSS
export const articleCss = `
  .travel-guide { max-width: 800px; margin: 0 auto; padding: 2rem; }
  .travel-guide h1 { font-size: 2.5rem; margin-bottom: 1rem; }
  .travel-guide .lead { font-size: 1.2rem; color: #666; }
  .photo-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin: 2rem 0; }
  .article-photo img { width: 100%; height: auto; border-radius: 8px; }
  .article-photo figcaption { font-size: 0.9rem; color: #666; margin-top: 0.5rem; }
  .booking-widget { background: #f5f5f5; padding: 1.5rem; border-radius: 8px; margin-top: 2rem; }
`;
