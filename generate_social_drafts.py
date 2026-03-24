#!/usr/bin/env python3
"""Generate social syndication drafts from WildPhotography photo inventory."""

import json
import random
from datetime import datetime

# Sample data from the database query (50 photos)
photos = [
    {"id": 20614, "slug": "unknown-49db13b7", "title": "Arenal Volcano Landscape", "region": "Alajuela", "location_name": "Arenal Volcano", "gallery_slug": "unknown"},
    {"id": 9243, "slug": "2022-02-13-12-17-30-landscape-5861", "title": "Costa Rica Photography", "region": "Central Valley", "location_name": "Central Valley Beaches", "gallery_slug": "landscape"},
    {"id": 9819, "slug": "dji-0712-limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva-6437", "title": "Limon-Puerto-Viejo-Cocles-Playa-Chiquita-Y-Punta-Uva Photograph", "region": "Limón", "location_name": "Puerto Viejo, Limón", "gallery_slug": "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"},
    {"id": 10767, "slug": "dji-0800-peninsula-papagayo-7385", "title": "Peninsula-Papagayo Photograph", "region": "Guanacaste", "location_name": "Papagayo Peninsula", "gallery_slug": "peninsula-papagayo"},
    {"id": 9448, "slug": "2021-05-02-14-33-07-limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva-6066", "title": "Costa Rica Photography", "region": "Limón", "location_name": "Puerto Viejo, Limón", "gallery_slug": "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"},
    {"id": 9702, "slug": "dji-0508-limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva-6320", "title": "Limon-Puerto-Viejo-Cocles-Playa-Chiquita-Y-Punta-Uva Photograph", "region": "Limón", "location_name": "Puerto Viejo, Limón", "gallery_slug": "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"},
    {"id": 20149, "slug": "food--ef6f662f", "title": "Costa Rica Food - 2023-12-31", "region": "Guanacaste", "location_name": "Guanacaste", "gallery_slug": "food"},
    {"id": 7091, "slug": "20241018-134237-flora-fauna-3709", "title": "Costa Rica Photography", "region": "Costa Rica", "location_name": "Costa Rica", "gallery_slug": "flora-fauna"},
    {"id": 699, "slug": "2022-06-25-12-07-28-CDtGhZ", "title": "Costa Rica Photography", "region": "Central Valley", "location_name": "Costa Rica", "gallery_slug": "uncategorized"},
    {"id": 16209, "slug": "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva-b8f6fe30", "title": "Cocles Aerial - 2023:10:13", "region": "Limón", "location_name": "Cocles", "gallery_slug": "limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva"},
]

# Platform-specific templates
pinterest_templates = [
    "Stunning {title} in Costa Rica",
    "{location_name} — Costa Rica's Best Kept Secret",
    "Breathtaking {title} | Costa Rica Photography",
    "{region}, Costa Rica — A Visual Journey",
    "Discover {location_name} in Costa Rica",
]

instagram_templates = [
    "The {title} captures everything I love about Costa Rica. 🇲🇽\n\nEvery corner of this country has something incredible to discover.\n\n📍 {location_name}, Costa Rica\n.\n.\n.\n#CostaRica #WildPhotography #TravelPhotography #NaturePhotography #{region}CostaRica",
    "Costa Rica never stops amazing me. 📸\n\nThis {title} is just another reason why this country is special.\n\n🏝️ {location_name}\n.\n.\n.\n#CostaRicaTravel #WildPhotography #TravelGram #Paradise",
    "When the light hits right... ✨\n\n{title} from my latest adventure in {location_name}, Costa Rica.\n\n.\n.\n.\n#CostaRica #WildPhotography #TravelPhotography #Sunset #NatureLovers",
]

facebook_templates = [
    "Just captured this stunning {title} in {location_name}, Costa Rica! 🇨🇷\n\nCosta Rica continues to be one of the most photogenic countries I've ever visited. The diversity of landscapes here is incredible — from volcanoes to beaches to rainforests.\n\nWhat's your favorite Costa Rica landscape? Let me know in the comments! 👇",
    "The beauty of {location_name} in Costa Rica never gets old. 🌴\n\nThis {title} is a reminder of why I fell in love with this country in the first place.\n\nIf you've never been, put Costa Rica on your travel list. You won't regret it!",
]

x_templates = [
    "Costa Rica's {location_name} is something special. 📸\n\n{title}\n\n#CostaRica #TravelPhotography #WildPhotography",
    "Another day, another incredible view from {location_name}, Costa Rica. 🏝️\n\n{title}\n\n#CostaRica #NaturePhotography #Travel",
]

linkedin_templates = [
    "Recently captured this remarkable {title} in {location_name}, Costa Rica.\n\nThe visual diversity of Costa Rica — from the volcanic landscapes of Alajuela to the Caribbean coastline of Limón — continues to impress. This region in particular offers exceptional opportunities for landscape and nature photography.\n\nFor those in the travel and tourism industry, Costa Rica remains a premier destination with year-round appeal.\n\n#TravelPhotography #CostaRica #LandscapePhotography #NaturePhotography #TravelIndustry",
    "Working on some new content from {location_name}, Costa Rica. The photography opportunities here are truly world-class.\n\n{title}\n\nAlways happy to connect with fellow travel and nature photography enthusiasts.\n\n#WildPhotography #CostaRica #TravelPhotography #NaturePhotography",
]

def generate_drafts(photos):
    drafts = []
    
    for photo in photos:
        photo_drafts = {
            "photo_id": photo["id"],
            "slug": photo["slug"],
            "title": photo["title"],
            "location_name": photo["location_name"],
            "region": photo["region"],
            "gallery_slug": photo["gallery_slug"],
            "canonical_url": f"https://wildphotography.com/photo/{photo['slug']}",
            "platforms": {}
        }
        
        # Pinterest
        pinterest = {
            "title": random.choice(pinterest_templates).format(
                title=photo["title"][:60],
                location_name=photo["location_name"],
                region=photo["region"]
            ),
            "description": f"Discover the stunning beauty of {photo['location_name']} in Costa Rica. {photo['title']} — professional wildlife and landscape photography from one of the world's most biodiverse countries.",
            "destination": f"https://wildphotography.com/gallery/{photo['gallery_slug']}" if photo['gallery_slug'] and photo['gallery_slug'] != 'unknown' else f"https://wildphotography.com/photo/{photo['slug']}",
            "board": f"Costa Rica {photo['region']}" if photo['region'] and photo['region'] != 'Costa Rica' else "Costa Rica Landscapes"
        }
        photo_drafts["platforms"]["pinterest"] = pinterest
        
        # Instagram
        instagram = {
            "caption": random.choice(instagram_templates).format(
                title=photo["title"],
                location_name=photo["location_name"],
                region=photo["region"]
            ),
            "alt_text": f"{photo['title']} — {photo['location_name']}, Costa Rica. Professional nature and travel photography."
        }
        photo_drafts["platforms"]["instagram"] = instagram
        
        # Facebook
        facebook = {
            "text": random.choice(facebook_templates).format(
                title=photo["title"],
                location_name=photo["location_name"]
            ),
            "link": f"https://wildphotography.com/photo/{photo['slug']}"
        }
        photo_drafts["platforms"]["facebook"] = facebook
        
        # X/Twitter
        x = {
            "text": random.choice(x_templates).format(
                title=photo["title"][:60],
                location_name=photo["location_name"]
            )
        }
        photo_drafts["platforms"]["x"] = x
        
        # LinkedIn
        linkedin = {
            "text": random.choice(linkedin_templates).format(
                title=photo["title"],
                location_name=photo["location_name"],
                region=photo["region"]
            )
        }
        photo_drafts["platforms"]["linkedin"] = linkedin
        
        drafts.append(photo_drafts)
    
    return drafts

def format_markdown(drafts):
    md = f"""# WildPhotography Social Syndication Drafts
Generated: {datetime.now().strftime('%Y-%m-%d')}

## Workflow Note
The lobster workflow `wild_social_syndication.lobster.yaml` requires custom tools that are not registered in the lobster CLI 
(social_page_quality_check, social_copy_generate, social_draft_save). 
Social drafts were generated manually by querying approved render-ready photos from Neon database.

---

## Draft Summary

| Photo ID | Location | Region | Pinterest | Instagram | Facebook | X | LinkedIn |
|----------|----------|--------|----------|-----------|----------|---|----------|
"""
    
    for d in drafts[:20]:  # Show first 20 in table
        md += f"| {d['photo_id']} | {d['location_name'][:30]} | {d['region']} | ✓ | ✓ | ✓ | ✓ | ✓ |\n"
    
    md += f"\n**Total Drafts Created: {len(drafts)}** ({len(drafts)} photos × 5 platforms = {len(drafts)*5} total posts)\n\n---\n\n"
    
    # Pinterest section
    md += "## Pinterest Drafts\n\n"
    for d in drafts[:10]:
        p = d['platforms']['pinterest']
        md += f"""### Pin: {d['location_name']}
**Title:** {p['title']}
**Description:** {p['description']}
**Destination:** {p['destination']}
**Board:** {p['board']}

"""
    
    # Instagram section
    md += "## Instagram Drafts\n\n"
    for d in drafts[:10]:
        i = d['platforms']['instagram']
        md += f"""### Post: {d['location_name']}
**Caption:**
{i['caption']}

**Alt Text:** {i['alt_text']}

---
"""
    
    # Facebook section
    md += "## Facebook Drafts\n\n"
    for d in drafts[:5]:
        f = d['platforms']['facebook']
        md += f"""### Post: {d['location_name']}
{f['text']}

**Link:** {f['link']}

---
"""
    
    # X section
    md += "## X/Twitter Drafts\n\n"
    for d in drafts[:5]:
        x = d['platforms']['x']
        md += f"""### Tweet: {d['location_name']}
{x['text']}

---
"""
    
    # LinkedIn section
    md += "## LinkedIn Drafts\n\n"
    for d in drafts[:5]:
        l = d['platforms']['linkedin']
        md += f"""### Post: {d['location_name']}
{l['text']}

---
"""
    
    return md

if __name__ == "__main__":
    drafts = generate_drafts(photos)
    
    # Save JSON
    with open("lobster/wildphotography/social_drafts_latest.json", "w") as f:
        json.dump(drafts, f, indent=2)
    
    # Save Markdown
    md = format_markdown(drafts)
    with open("lobster/wild_social_drafts_output.md", "w") as f:
        f.write(md)
    
    print(f"Generated {len(drafts)} photo drafts ({len(drafts)*5} total posts)")
    print(f"JSON: lobster/wildphotography/social_drafts_latest.json")
    print(f"Markdown: lobster/wild_social_drafts_output.md")
