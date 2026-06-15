#!/usr/bin/env python3
"""
WildPhotography Article Generator - 5 pending articles
"""
import json
import subprocess
import sys

# Article configuration
ARTICLES = [
    {
        "slug": "costa-rica-nature-lovers-guide",
        "keyword": "best places to visit in costa rica for nature lovers",
        "type": "theme_roundup",
        "theme": "nature travel",
        "priority": 20,
    },
    {
        "slug": "costa-rica-beach-photography-guide",
        "keyword": "costa rica beach photography guide",
        "type": "photography_guide",
        "theme": "beach photography",
        "priority": 21,
    },
    {
        "slug": "costa-rica-bird-photography-guide",
        "keyword": "costa rica bird photography guide",
        "type": "photography_guide",
        "theme": "bird photography",
        "priority": 22,
    },
    {
        "slug": "best-tours-wildlife-lovers-costa-rica",
        "keyword": "best tours for wildlife lovers in costa rica",
        "type": "theme_roundup",
        "theme": "wildlife tours",
        "priority": 24,
    },
    {
        "slug": "best-places-photograph-wildlife-costa-rica",
        "keyword": "best places to photograph wildlife in costa rica",
        "type": "photography_guide",
        "theme": "wildlife photography locations",
        "priority": 25,
    },
]

# Load photos
with open("/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/photos_data.json", "r") as f:
    photos = json.load(f)

# Load link targets
with open("/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/link_targets.json", "r") as f:
    link_targets = json.load(f)

AFFILIATE_PARTNER_ID = "6ZV7KMH"
AFFILIATE_CMP = "wildphotography"
AUTHOR = "Joshua ten Brink"
PUBLISHER = "WildPhotography"
CANONICAL_BASE = "https://wildphotography.com"
MIN_PHOTO_COUNT = 6

def build_prompt(article):
    """Build the prompt for a single article."""
    return f"""
You are generating a WildPhotography SEO article.

## Article Configuration
- slug: {article['slug']}
- primary_keyword: {article['keyword']}
- article_type: {article['type']}
- theme: {article['theme']}

## Photos (render-ready, limited to 50 shown for context)
The photo inventory contains hundreds of render-ready photos. Select the BEST 6-10 photos from the full inventory that are most relevant to the article topic.

Available photo metadata fields: id, slug, title, thumb_url, medium_url, location_name, species_common_name, species_scientific_name, location_slug, region, gallery_slug, keywords, description_long

## Link Targets (partial list - use slug matching)
Available pages to link to (sample of 100):
{json.dumps(link_targets[:100], indent=2)}

## Affiliate Config
- partner_id: {AFFILIATE_PARTNER_ID}
- cmp: {AFFILIATE_CMP}
- author: {AUTHOR}
- publisher: {PUBLISHER}
- canonical_base: {CANONICAL_BASE}

## min_photo_count: {MIN_PHOTO_COUNT}

## Instructions
1. Select the BEST 6-10 photos from the inventory that relate to the article topic. Prefer diverse compositions (aerial, beach, wildlife, landscape, etc.)
2. Generate a complete SEO article following the wild_article_generator.md rules
3. Use only link_targets slugs that match the article topic
4. Quality gate: 6+ photos, 5+ internal links, word count ≥900
5. Return a single valid JSON object with all required fields

Return ONLY the JSON object, no markdown code blocks, no explanatory text.
"""
    
def main():
    results = []
    
    for article in ARTICLES:
        print(f"Generating: {article['slug']}", flush=True)
        
        # Build the prompt
        prompt = build_prompt(article)
        
        # Call the LLM
        result = subprocess.run(
            ["openclaw", "llm", "--model", "minimax-portal/MiniMax-M2.7"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        if result.returncode != 0:
            print(f"  ERROR: {result.stderr}", flush=True)
            continue
        
        try:
            # Try to parse JSON from output
            output = result.stdout.strip()
            # Remove markdown code blocks if present
            if output.startswith("```"):
                lines = output.split("\n")
                output = "\n".join(lines[1:-1])
            
            article_data = json.loads(output)
            results.append(article_data)
            
            # Write to output file
            output_path = f"/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/article_outputs/{article['slug']}.json"
            with open(output_path, "w") as f:
                json.dump(article_data, f, indent=2)
            
            print(f"  SUCCESS: {output_path}", flush=True)
            
        except json.JSONDecodeError as e:
            print(f"  JSON PARSE ERROR: {e}", flush=True)
            print(f"  Output: {result.stdout[:500]}", flush=True)
            continue
    
    # Save all results
    with open("/Users/joshuatenbrink/.openclaw/workspace/wildphotography/runtime/article_outputs/all_articles.json", "w") as f:
        json.dump(results, f, indent=2)
    
    print(f"\nGenerated {len(results)} articles", flush=True)

if __name__ == "__main__":
    main()
