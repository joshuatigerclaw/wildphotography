#!/usr/bin/env python3
"""
Affiliate Matching System

Provides adapters for:
- GetYourGuide
- Viator  
- Amazon Associates
- Expedia

Location resolution priority:
1. explicit page location
2. photo location_name
3. region
4. country
5. nearest destination hub
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


# Destination hub mapping for Costa Rica
DESTINATION_HUBS = {
    'monteverde': {
        'aliases': ['Monteverde', 'Santa Elena', 'Cloud Forest'],
        'likely_tours': ['night walk', 'birdwatching', 'cloud forest', 'hanging bridges', 'zip line'],
        'likely_products': ['binoculars', 'rain jacket', 'field guide', 'camera rain cover', 'hiking boots'],
        'likely_hotels': ['eco lodge', 'cloud forest lodge', 'nature hotel', 'boutique hotel']
    },
    'tortuguero': {
        'aliases': ['Tortuguero', 'Tortuguero National Park'],
        'likely_tours': ['canal wildlife tour', 'boat safari', 'birdwatching', 'turtle tour', 'jungle walk'],
        'likely_products': ['dry bag', 'binoculars', 'telephoto lens accessory', 'bug spray', 'waterproof bag'],
        'likely_hotels': ['jungle lodge', 'canal lodge', 'boat access lodge', 'eco resort']
    },
    'corcovado': {
        'aliases': ['Corcovado', 'Osa', 'Osa Peninsula', 'Drake Bay', 'Puerto Jimenez'],
        'likely_tours': ['Corcovado guided hike', 'wildlife tour', 'birdwatching', 'boat transfer', 'snorkeling'],
        'likely_products': ['hiking boots', 'dry bag', 'telephoto accessories', 'field guide', 'backpack'],
        'likely_hotels': ['eco lodge', 'jungle lodge', 'Drake Bay hotel', 'nature resort']
    },
    'uvita': {
        'aliases': ['Uvita', 'Marino Ballena', 'Ballena', 'Dominical'],
        'likely_tours': ['whale watching', 'boat tour', 'snorkeling', 'nature tour', 'catamaran'],
        'likely_products': ['dry bag', 'waterproof phone pouch', 'binoculars', 'travel backpack', 'sunscreen'],
        'likely_hotels': ['beach hotel', 'eco stay', 'nature lodge', 'boutique hotel']
    },
    'carara': {
        'aliases': ['Carara', 'Tarcoles', 'Jacó'],
        'likely_tours': ['birdwatching', 'crocodile river tour', 'nature walk', 'scarlet macaw tour'],
        'likely_products': ['binoculars', 'field guide', 'long lens support', 'sun protection', 'hat'],
        'likely_hotels': ['nature lodge', 'Tarcoles hotel', 'Carara hotel', 'beach resort']
    },
    'manuel_antonio': {
        'aliases': ['Manuel Antonio', 'Quepos'],
        'likely_tours': ['national park tour', 'sloth tour', 'catamaran', 'nature walk', 'sunset cruise'],
        'likely_products': ['daypack', 'travel binoculars', 'camera strap', 'water bottle', 'hiking shoes'],
        'likely_hotels': ['beach hotel', 'park hotel', 'nature resort', 'boutique hotel']
    },
    'arenal': {
        'aliases': ['Arenal', 'La Fortuna'],
        'likely_tours': ['hanging bridges', 'birdwatching', 'nature walk', 'cano safari', 'hot springs'],
        'likely_products': ['rain protection', 'binoculars', 'waterproof cover', 'hiking shoes', 'camera bag'],
        'likely_hotels': ['volcano view hotel', 'eco lodge', 'Arenal resort', 'hot springs resort']
    },
    'guanacaste': {
        'aliases': ['Guanacaste', 'Liberia', 'Playa Flamingo', 'Playa del Coco'],
        'likely_tours': ['snorkeling', 'volcano tour', 'sunset cruise', 'ATV tour'],
        'likely_products': ['sunscreen', 'sunglasses', 'beach towel', 'snorkel gear', 'hat'],
        'likely_hotels': ['all-inclusive resort', 'beach hotel', 'vacation rental']
    },
    'limon': {
        'aliases': ['Limon', 'Puerto Viejo', 'Cahuita'],
        'likely_tours': ['jungle tour', 'sloth watching', 'indigenous tour', 'boat tour'],
        'likely_products': ['binoculars', 'bug spray', 'rain jacket', 'hiking boots'],
        'likely_hotels': ['caribbean hotel', 'eco lodge', 'beach hostel', 'treehouse']
    },
    'nicoya_peninsula': {
        'aliases': ['Tambor', 'Nicoya', 'Nicoya Peninsula', 'Peninsula de Nicoya'],
        'likely_tours': ['boat tour', 'beach day trip', 'snorkeling', 'wildlife tour', 'fishing tour'],
        'likely_products': ['sunscreen', 'snorkel gear', 'beach towel', 'sunglasses', 'water shoes'],
        'likely_hotels': ['beach resort', 'boutique hotel', 'eco lodge', 'vacation rental']
    },
    'pacifica_beaches': {
        'aliases': ['Montezuma', 'Santa Teresa', 'Malpais', 'Isla Tortuga', 'Cabo Matapalo'],
        'likely_tours': ['surf lesson', 'boat tour', 'snorkeling', 'waterfall hike', 'wildlife tour'],
        'likely_products': ['surfboard wax', 'reef-safe sunscreen', 'dry bag', 'snorkel mask', 'beach sandals'],
        'likely_hotels': ['surf camp', 'beach bungalow', 'eco resort', 'boutique hotel']
    },
    'guanacaste_beaches': {
        'aliases': ['Playas del Coco', 'Papagayo', 'Bahia Culebra', 'Playa Hermosa Guanacaste', 'Tamarindo', 'Flamingo', 'Las Catalinas', 'Punta Cacique', 'Samara', 'Playa Real Roble'],
        'likely_tours': ['snorkeling', 'sunset cruise', 'sport fishing', 'ATV tour', 'golf tour'],
        'likely_products': ['sunscreen', 'sunglasses', 'beach towel', 'snorkel gear', 'hat'],
        'likely_hotels': ['all-inclusive resort', 'beach hotel', 'vacation rental', 'surf camp']
    },
    'carara_birds': {
        'aliases': ['Carara', 'Birds Macaws Lapas', 'Tarcoles', 'Jacó Birds'],
        'likely_tours': ['scarlet macaw tour', 'birdwatching', 'crocodile river tour', 'nature walk'],
        'likely_products': ['binoculars', 'field guide', 'telephoto lens', 'sun protection', 'hat'],
        'likely_hotels': ['nature lodge', 'Carara hotel', 'beach resort', 'eco lodge']
    },
    'central_pacific': {
        'aliases': ['Puntarenas', 'Puntarenas City', 'Puerto Caldera'],
        'likely_tours': ['city tour', 'port excursion', 'boat tour', 'island tour'],
        'likely_products': ['daypack', 'water bottle', 'sun protection', 'camera bag'],
        'likely_hotels': ['city hotel', 'port hotel', 'beach hotel', 'business hotel']
    },
    'waterfalls_cr': {
        'aliases': ['Nauyaca', 'Waterfalls In Costa Rica', 'Waterfall', 'Nauyaca Waterfalls'],
        'likely_tours': ['waterfall hike', ' canyoning', 'nature walk', 'adventure tour'],
        'likely_products': ['hiking boots', 'water shoes', 'dry bag', 'go pro', 'waterproof camera bag'],
        'likely_hotels': ['river lodge', 'eco lodge', 'mountain hotel', 'adventure resort']
    },
    'turtle_nesting': {
        'aliases': ['Turtles', 'Turtle Nesting', 'Tortuguero'],
        'likely_tours': ['turtle nesting tour', 'night tour', 'canal wildlife tour', 'boat safari'],
        'likely_products': ['red flashlight', 'binoculars', 'rain jacket', 'bug spray', 'waterproof bag'],
        'likely_hotels': ['jungle lodge', 'canal lodge', 'eco resort', 'turtle lodge']
    },
    'rincon_volcano': {
        'aliases': ['Rincon de la Vieja', 'Rincon De La Vieja', 'Rincon'],
        'likely_tours': ['volcano hike', 'hot springs', 'horseback riding', 'canopy tour', 'mud volcano'],
        'likely_products': ['hiking boots', 'mud boots', 'towel', 'change of clothes', 'camera bag'],
        'likely_hotels': ['hot springs resort', 'eco lodge', 'ranch hotel', 'nature lodge']
    },
    'poas_irazu': {
        'aliases': ['Poas', 'Poas Volcano', 'Volcan Poas', 'Irazu', 'Irazu Volcano', 'Volcan Irazu'],
        'likely_tours': ['volcano day trip', 'crater viewpoint tour', 'cloud forest walk', 'basilica tour'],
        'likely_products': ['rain jacket', 'hiking boots', 'layers', 'thermos', 'camera bag'],
        'likely_hotels': ['mountain lodge', 'cloud forest hotel', 'highland resort', 'boutique inn']
    },
    'surfing_cr': {
        'aliases': ['Surfing Costa Rica', 'Surfing', 'Surf'],
        'likely_tours': ['surf lesson', 'surf camp', 'board rental', 'surf guide'],
        'likely_products': ['surfboard', 'reef-safe sunscreen', 'rash guard', 'leash', 'wax'],
        'likely_hotels': ['surf camp', 'beach hostel', 'surf resort', 'beach bungalow']
    }
}


@dataclass
class AffiliateOffer:
    """Represents a single affiliate offer."""
    source: str  # 'getyourguide', 'viator', 'amazon', 'expedia'
    offer_id: str
    title: str
    url: str
    category: str  # 'tour', 'hotel', 'product'
    destination: str
    price: Optional[str] = None
    rating: Optional[str] = None
    review_count: Optional[str] = None
    duration: Optional[str] = None
    relevance_score: float = 0.0
    cta_text: str = ""
    label: str = ""


@dataclass  
class AffiliateContext:
    """Context for affiliate matching."""
    species: Optional[str] = None
    location_name: Optional[str] = None
    region: Optional[str] = None
    country: Optional[str] = None
    gallery_name: Optional[str] = None
    page_type: str = "photo"  # 'photo', 'species', 'location', 'article'


class AffiliateProvider(ABC):
    """Base class for affiliate providers."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass
    
    @property
    @abstractmethod
    def enabled(self) -> bool:
        pass
    
    @abstractmethod
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        pass
    
    def resolve_destination(self, context: AffiliateContext) -> str:
        """Resolve the best destination from context."""
        # Priority: explicit location > location_name > region > country > default
        if context.location_name:
            return context.location_name
        if context.region:
            return context.region
        if context.country:
            return context.country
        return "Costa Rica"  # Default


class StubAffiliateProvider(AffiliateProvider):
    """Stub provider that returns empty results."""
    
    @property
    def name(self) -> str:
        return "stub"
    
    @property
    def enabled(self) -> bool:
        return True
    
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        return []


class GetYourGuideProvider(AffiliateProvider):
    """GetYourGuide affiliate adapter."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get('GYG_API_KEY', '')
    
    @property
    def name(self) -> str:
        return "getyourguide"
    
    @property
    def enabled(self) -> bool:
        return bool(self.api_key)
    
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        """Search GetYourGuide tours."""
        if not self.enabled:
            logger.info(f"GetYourGuide not enabled - no API key")
            return []
        
        logger.info(f"[GYG] Search: {query} in {destination}")
        
        # TODO: Implement actual GYG API call
        # For now, return sample offers for testing
        sample_offers = [
            AffiliateOffer(
                source="getyourguide",
                offer_id="gyg-001",
                title=f"{query.title()} Tour in {destination}",
                url=f"https://www.getyourguide.com/search?search={query.replace(' ', '+')}",
                category="tour",
                destination=destination,
                price="$45-85",
                rating="4.8",
                review_count="234",
                duration="3-4 hours",
                relevance_score=0.85,
                cta_text="Book Now",
                label="Top Rated"
            ),
            AffiliateOffer(
                source="getyourguide",
                offer_id="gyg-002",
                title=f"Best {query.title()} Experience",
                url=f"https://www.getyourguide.com/search?search={query.replace(' ', '+')}",
                category="tour",
                destination=destination,
                price="$55-95",
                rating="4.9",
                review_count="156",
                duration="4-5 hours",
                relevance_score=0.80,
                cta_text="View Details",
                label="Popular"
            )
        ]
        return sample_offers[:limit]


class ViatorProvider(AffiliateProvider):
    """Viator affiliate adapter."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get('VIATOR_API_KEY', '')
    
    @property
    def name(self) -> str:
        return "viator"
    
    @property
    def enabled(self) -> bool:
        return bool(self.api_key)
    
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        """Search Viator tours."""
        if not self.enabled:
            logger.info(f"Viator not enabled - no API key")
            return []
        
        logger.info(f"[Viator] Search: {query} in {destination}")
        
        # TODO: Implement actual Viator API call
        sample_offers = [
            AffiliateOffer(
                source="viator",
                offer_id="viator-001",
                title=f"{query.title()} - {destination}",
                url=f"https://www.viator.com/search?search={query.replace(' ', '+')}",
                category="tour",
                destination=destination,
                price="$50-90",
                rating="4.7",
                review_count="189",
                duration="4 hours",
                relevance_score=0.82,
                cta_text="Reserve Now",
                label="Best Seller"
            )
        ]
        return sample_offers[:limit]


class AmazonProvider(AffiliateProvider):
    """Amazon Associates affiliate adapter."""
    
    def __init__(self, api_key: str = None, tracking_id: str = None):
        self.api_key = api_key or os.environ.get('AMAZON_API_KEY', '')
        self.tracking_id = tracking_id or os.environ.get('AMAZON_TRACKING_ID', 'wildphot-20')
    
    @property
    def name(self) -> str:
        return "amazon"
    
    @property
    def enabled(self) -> bool:
        return bool(self.api_key)
    
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        """Search Amazon products."""
        if not self.enabled:
            logger.info(f"Amazon not enabled - no API key")
            return []
        
        logger.info(f"[Amazon] Search: {query} (category: {category})")
        
        # TODO: Implement actual Amazon PA-API call
        sample_offers = [
            AffiliateOffer(
                source="amazon",
                offer_id="amazon-001",
                title=f"{query.title()} for Wildlife Photography",
                url=f"https://www.amazon.com/dp/B08N5WRWNW?tag=wildphotography-20",
                category="product",
                destination=destination,
                price="$149.99",
                rating="4.7",
                review_count="2,341",
                relevance_score=0.78,
                cta_text="View on Amazon",
                label="Amazon Choice"
            ),
            AffiliateOffer(
                source="amazon",
                offer_id="amazon-002",
                title=f"Best {query.title()} for Costa Rica",
                url=f"https://www.amazon.com/dp/B07Y2Z7DSW?tag=wildphotography-20",
                category="product",
                destination=destination,
                price="$79.99",
                rating="4.5",
                review_count="1,892",
                relevance_score=0.72,
                cta_text="Check Price",
                label="Bestseller"
            )
        ]
        return sample_offers[:limit]


class ExpediaProvider(AffiliateProvider):
    """Expedia Travel affiliate adapter."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.environ.get('EXPEDIA_API_KEY', '')
    
    @property
    def name(self) -> str:
        return "expedia"
    
    @property
    def enabled(self) -> bool:
        return bool(self.api_key)
    
    def search(self, query: str, category: str, destination: str, limit: int = 10) -> List[AffiliateOffer]:
        """Search Expedia hotels."""
        if not self.enabled:
            logger.info(f"Expedia not enabled - no API key")
            return []
        
        logger.info(f"[Expedia] Search: {query} in {destination}")
        return []


class AffiliateMatcher:
    """Main affiliate matching service."""
    
    def __init__(self):
        self.providers: Dict[str, AffiliateProvider] = {
            'getyourguide': GetYourGuideProvider(),
            'viator': ViatorProvider(),
            'amazon': AmazonProvider(),
            'expedia': ExpediaProvider(),
        }
    
    def match(self, context: AffiliateContext, limits: Dict[str, int] = None) -> Dict[str, List[AffiliateOffer]]:
        """
        Find relevant offers for the given context.
        
        Returns dict with keys: 'tours', 'shopping', 'hotels'
        """
        if limits is None:
            limits = {'tours': 4, 'shopping': 4, 'hotels': 3}
        
        # Resolve destination hub
        destination = self._resolve_destination(context)
        
        # Determine search queries based on context
        tour_queries = self._get_tour_queries(context, destination)
        shopping_queries = self._get_shopping_queries(context, destination)
        hotel_queries = self._get_hotel_queries(context, destination)
        
        results = {
            'tours': [],
            'shopping': [],
            'hotels': []
        }
        
        # Search tours (GetYourGuide + Viator)
        for query in tour_queries:
            for provider in ['getyourguide', 'viator']:
                offers = self.providers[provider].search(query, 'tour', destination, limits['tours'])
                results['tours'].extend(offers)
        
        # Search shopping (Amazon)
        for query in shopping_queries:
            offers = self.providers['amazon'].search(query, 'product', destination, limits['shopping'])
            results['shopping'].extend(offers)
        
        # Search hotels (Expedia)
        for query in hotel_queries:
            offers = self.providers['expedia'].search(query, 'hotel', destination, limits['hotels'])
            results['hotels'].extend(offers)
        
        # Deduplicate and score
        results['tours'] = self._dedupe_and_score(results['tours'])
        results['shopping'] = self._dedupe_and_score(results['shopping'])
        results['hotels'] = self._dedupe_and_score(results['hotels'])
        
        # Apply limits
        results['tours'] = results['tours'][:limits['tours']]
        results['shopping'] = results['shopping'][:limits['shopping']]
        results['hotels'] = results['hotels'][:limits['hotels']]
        
        return results
    
    def _resolve_destination(self, context: AffiliateContext) -> str:
        """Resolve destination hub from context."""
        # Check explicit location first
        if context.location_name:
            loc_lower = context.location_name.lower()
            for hub, data in DESTINATION_HUBS.items():
                if any(alias.lower() in loc_lower for alias in data['aliases']):
                    return hub
        
        # Check region
        if context.region:
            region_lower = context.region.lower()
            for hub, data in DESTINATION_HUBS.items():
                if any(alias.lower() in region_lower for alias in data['aliases']):
                    return hub
        
        # Check gallery name
        if context.gallery_name:
            gal_lower = context.gallery_name.lower()
            for hub, data in DESTINATION_HUBS.items():
                if any(alias.lower() in gal_lower for alias in data['aliases']):
                    return hub
        
        # Special slug/name mappings for gallery pages
        slug_mappings = {
            'beaches': 'guanacaste_beaches',
            'surfing-costa-rica': 'surfing_cr',
            'surfing': 'surfing_cr',
            'turtles': 'turtle_nesting',
            'waterfalls-in-costa-rica': 'waterfalls_cr',
            'nauyaca-waterfalls': 'waterfalls_cr',
            'waterfalls': 'waterfalls_cr',
            'poas-volcano-costa-rica': 'poas_irazu',
            'volcan-poas': 'poas_irazu',
            'volcan-irazu': 'poas_irazu',
            'volcan irazu': 'poas_irazu',
            'rincon-de-la-vieja': 'rincon_volcano',
            'tambor-nicoya-peninsula-costa-rica': 'nicoya_peninsula',
            'nicoya-peninsula': 'nicoya_peninsula',
            'montezuma-costa-rica': 'pacifica_beaches',
            'montezuma': 'pacifica_beaches',
            'santa-teresa-malpais': 'pacifica_beaches',
            'malpais': 'pacifica_beaches',
            'santa teresa': 'pacifica_beaches',
            'isla-tortuga': 'pacifica_beaches',
            'isla tortuga': 'pacifica_beaches',
            'birds-macaws-lapas': 'carara_birds',
            'carara': 'carara_birds',
            'puntarenas-costa-rica': 'central_pacific',
            'puntarenas': 'central_pacific',
            'limon-puerto-viejo-cocles-playa-chiquita-y-punta-uva': 'limon',
            'playas-del-coco': 'guanacaste_beaches',
            'las-catalinas-guanacaste': 'guanacaste_beaches',
            'papagayo-bahia-culebra': 'guanacaste_beaches',
            'playa-hermosa-guanacaste': 'guanacaste_beaches',
            'tamarindo-guanacaste-costa-rica': 'guanacaste_beaches',
            'tamarindo': 'guanacaste_beaches',
            'flamingo-beach': 'guanacaste_beaches',
            'punta-cacique-guancaste': 'guanacaste_beaches',
            'punta-leona': 'central_pacific',
            'golfo-de-nicoya': 'nicoya_peninsula',
            'peninsula-de-nicoya': 'nicoya_peninsula',
            'dominical-and-uvita': 'uvita',
            'dominical': 'uvita',
            'uvita': 'uvita',
        }
        
        if context.gallery_name:
            gal_slug = context.gallery_name.lower().replace(' ', '-').replace("'", '')
            if gal_slug in slug_mappings:
                return slug_mappings[gal_slug]
        
        return "costa-rica"  # Default
    
    def _get_tour_queries(self, context: AffiliateContext, destination: str) -> List[str]:
        """Generate tour search queries."""
        queries = []
        
        hub = DESTINATION_HUBS.get(destination, DESTINATION_HUBS.get('monteverte', {}))
        
        # Add species-specific tours if known
        if context.species:
            queries.append(f"{context.species} tour Costa Rica")
        
        # Add hub-specific tours
        for tour in hub.get('likely_tours', [])[:3]:
            queries.append(f"{tour} {destination} Costa Rica")
        
        # Add general wildlife tours
        queries.append(f"wildlife tour {destination} Costa Rica")
        
        return queries[:5]
    
    def _get_shopping_queries(self, context: AffiliateContext, destination: str) -> List[str]:
        """Generate shopping search queries."""
        queries = []
        
        hub = DESTINATION_HUBS.get(destination, {})
        
        # Add species-specific products
        if context.species:
            queries.append(f"wildlife photography {context.species}")
        
        # Add hub-specific products
        for product in hub.get('likely_products', [])[:3]:
            queries.append(f"{product} Costa Rica travel")
        
        return queries[:5]
    
    def _get_hotel_queries(self, context: AffiliateContext, destination: str) -> List[str]:
        """Generate hotel search queries."""
        queries = []
        
        hub = DESTINATION_HUBS.get(destination, {})
        
        # Add hub-specific hotels
        for hotel in hub.get('likely_hotels', [])[:2]:
            queries.append(f"{hotel} {destination} Costa Rica")
        
        queries.append(f"hotel near {destination} Costa Rica")
        
        return queries[:3]
    
    def _dedupe_and_score(self, offers: List[AffiliateOffer]) -> List[AffiliateOffer]:
        """Deduplicate and re-score offers."""
        # Simple deduplication by title
        seen = set()
        unique = []
        for offer in offers:
            key = offer.title.lower()[:30]
            if key not in seen:
                seen.add(key)
                unique.append(offer)
        
        # Sort by relevance score
        return sorted(unique, key=lambda x: x.relevance_score, reverse=True)


# Example usage
if __name__ == "__main__":
    matcher = AffiliateMatcher()
    
    # Test with a Costa Rica bird photo context
    context = AffiliateContext(
        species="Scarlet Macaw",
        location_name="Carara",
        region="Central Pacific",
        country="Costa Rica",
        gallery_name="Birds of Costa Rica",
        page_type="photo"
    )
    
    results = matcher.match(context)
    
    print("=== Affiliate Match Results ===")
    print(f"\nTours ({len(results['tours'])}):")
    for t in results['tours'][:3]:
        print(f"  - {t.title} ({t.source})")
    
    print(f"\nShopping ({len(results['shopping'])}):")
    for s in results['shopping'][:3]:
        print(f"  - {s.title} ({s.source})")
    
    print(f"\nHotels ({len(results['hotels'])}):")
    for h in results['hotels'][:3]:
        print(f"  - {h.title} ({h.source})")
