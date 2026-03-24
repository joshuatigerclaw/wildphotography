#!/usr/bin/env python3
"""
Species and Location Page Generator

Generates species and location pages with affiliate monetization blocks.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Any

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))


# Costa Rica wildlife destinations
DESTINATIONS = {
    'monteverde': {
        'name': 'Monteverde Cloud Forest',
        'description': 'Famous for its cloud forests, hanging bridges, and incredible biodiversity.',
        'species': ['Quetzal', 'Three-Wattled Bellbird', 'Bare-necked Umbrellabird', 'Owl', 'Tapir'],
        'activities': ['Night Walk', 'Birdwatching', 'Hanging Bridges', 'Zip Lining', 'Butterfly Garden']
    },
    'tortuguero': {
        'name': 'Tortuguero',
        'description': 'Known for its canal system, jungle lodges, and sea turtle nesting.',
        'species': ['Green Macaw', 'Jesus Christ Lizard', 'Caiman', 'Sloth', 'Howler Monkey'],
        'activities': ['Canal Tour', 'Wildlife Boat Tour', 'Night Walk', 'Turtle Tour', 'Jungle Hike']
    },
    'corcovado': {
        'name': 'Corcovado National Park',
        'description': 'One of the most biodiverse places on Earth, offering pristine rainforest.',
        'species': ['Tapir', 'Jaguar', 'Puma', 'Scarlet Macaw', 'Harpy Eagle'],
        'activities': ['Guided Hike', 'Wildlife Spotting', 'Birdwatching', 'Photography Tour', 'Overnight Camping']
    },
    'arenal': {
        'name': 'Arenal Volcano Area',
        'description': 'Home to Arenal Volcano, hot springs, and adventure activities.',
        'species': ['Toucan', 'Sloth', 'Howler Monkey', 'Coati', 'Basilisk'],
        'activities': ['Hot Springs', 'Hanging Bridges', 'Canyoning', 'Horseback Riding', 'Nature Walk']
    },
    'carara': {
        'name': 'Carara National Park',
        'description': 'Famous for its large population of Scarlet Macaws and easy access from San José.',
        'species': ['Scarlet Macaw', 'Collared Aracari', 'Tropical Kingbird', 'Wood Stork', 'Roseate Spoonbill'],
        'activities': ['Birdwatching', 'Photography Tour', 'Crocodile Watching', 'Nature Walk', 'Scarlet Macaw Tour']
    },
    'manuel-antonio': {
        'name': 'Manuel Antonio',
        'description': 'Beach destination with nearby national park famous for sloths and beaches.',
        'species': ['Sloth', 'White-Faced Capuchin', 'Squirrel Monkey', 'Toucan', 'Iguana'],
        'activities': ['National Park Tour', 'Catamaran', 'Snorkeling', 'Whale Watching', 'Beach Day']
    }
}


def generate_species_page_content(species_name: str, context: Dict[str, Any]) -> str:
    """Generate content for a species page."""
    
    # Get destination context
    destination = context.get('destination', 'costa-rica')
    dest_info = DESTINATIONS.get(destination, DESTINATIONS['monteverde'])
    
    content = f"""<h1>{species_name} in Costa Rica</h1>

<p>The {species_name} is one of the remarkable wildlife species you can encounter in Costa Rica's diverse ecosystems.</p>

<h2>Where to See {species_name}</h2>
<p>Your best chance to spot {species_name} is in {dest_info['name']}, where guided tours offer excellent opportunities for wildlife observation.</p>

<h2>Best Tours for {species_name}</h2>
<p>Join expert guides who know the best locations and times to find {species_name}.</p>

<h2>Photography Tips</h2>
<p>For photographing {species_name}, consider these recommendations:</p>
<ul>
<li>Use a telephoto lens (200mm or longer recommended)</li>
<li>Patience is key - wildlife photography requires waiting</li>
<li>Early morning and late afternoon offer the best light</li>
<li>Support your camera with a tripod or monopod</li>
</ul>

<h2>Best Places to Stay</h2>
<p>Near {dest_info['name']}, there are excellent lodges and hotels that offer access to wildlife areas.</p>
"""
    return content


def generate_location_page_content(location_slug: str, context: Dict[str, Any]) -> str:
    """Generate content for a location page."""
    
    dest_info = DESTINATIONS.get(location_slug, {
        'name': location_slug.title().replace('-', ' '),
        'description': 'A beautiful destination in Costa Rica.',
        'species': [],
        'activities': []
    })
    
    photo_count = context.get('photo_count', 0)
    
    content = f"""<h1>{dest_info['name']}, Costa Rica</h1>

<p>{dest_info['description']}</p>

<h2>Wildlife in {dest_info['name']}</h2>
<p>This area is home to incredible biodiversity including:</p>
<ul>
"""
    
    for species in dest_info['species'][:5]:
        content += f"<li><a href='/species/{species.lower().replace(' ', '-')}'>{species}</a></li>\n"
    
    content += """</ul>

<h2>Things to Do</h2>
<p>Popular activities in this area include:</p>
<ul>
"""
    
    for activity in dest_info['activities']:
        content += f"<li>{activity}</li>\n"
    
    content += f"""</ul>

<h2>Photos from {dest_info['name']}</h2>
<p>Browse our collection of {photo_count} photos from this location.</p>

<h2>Best Tours in {dest_info['name']}</h2>
<p>Expert-guided tours help you make the most of your visit.</p>

<h2>Where to Stay</h2>
<p>From eco-lodges to luxury resorts, find the perfect accommodation for your trip.</p>
"""
    return content


def get_location_context(location_slug: str) -> Dict[str, Any]:
    """Get context for a location from database."""
    import psycopg2
    
    conn = psycopg2.connect(os.environ.get('NEON_CONNECTION_STRING', ''))
    cur = conn.cursor()
    
    cur.execute("""
        SELECT COUNT(*) 
        FROM photos 
        WHERE gallery_slug = %s 
          AND ready_for_public_render = true
    """, (location_slug,))
    photo_count = cur.fetchone()[0] or 0
    
    conn.close()
    
    return {
        'photo_count': photo_count,
        'destination': location_slug
    }


if __name__ == "__main__":
    print("=== Species/Location Page Generator ===")
    print("\nAvailable destinations:")
    for slug, info in DESTINATIONS.items():
        print(f"  - {slug}: {info['name']}")
