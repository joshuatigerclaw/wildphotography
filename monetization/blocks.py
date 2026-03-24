#!/usr/bin/env python3
"""
Page Monetization Blocks

Renders affiliate blocks for:
- Species pages
- Location pages  
- Article pages
- Photo pages
"""

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class TourBlock:
    """Tour recommendation block."""
    title: str
    button_text: str
    tours: List[Dict[str, Any]]
    cta_template: str


@dataclass
class ShoppingBlock:
    """Shopping recommendation block."""
    title: str
    products: List[Dict[str, Any]]
    cta_template: str


@dataclass  
class HotelBlock:
    """Hotel recommendation block."""
    title: str
    hotels: List[Dict[str, Any]]
    cta_template: str


def render_tour_block(
    tours: List[Dict[str, Any]],
    template: str = "Best tours in {location}",
    button_text: str = "Book Now",
    max_tours: int = 4
) -> str:
    """Render a tour recommendations block."""
    if not tours:
        return ""
    
    tours = tours[:max_tours]
    
    tour_cards = ""
    for tour in tours:
        price = tour.get('price', '')
        rating = tour.get('rating', '')
        reviews = tour.get('review_count', '')
        
        tour_cards += f"""
        <div class="tour-card">
            <h4>{tour.get('title', 'Tour')}</h4>
            <div class="tour-meta">
                {f'<span class="rating">★ {rating}</span>' if rating else ''}
                {f'<span class="reviews">({reviews} reviews)</span>' if reviews else ''}
            </div>
            <div class="tour-footer">
                {f'<span class="price">{price}</span>' if price else ''}
                <a href="{tour.get('url', '#')}" class="tour-btn">{button_text}</a>
            </div>
        </div>
        """
    
    return f"""
    <div class="affiliate-block tours-block">
        <h3>{template}</h3>
        <div class="tour-grid">
            {tour_cards}
        </div>
    </div>
    """


def render_shopping_block(
    products: List[Dict[str, Any]],
    template: str = "Recommended Gear",
    button_text: str = "View on Amazon",
    max_products: int = 4
) -> str:
    """Render a shopping recommendations block."""
    if not products:
        return ""
    
    products = products[:max_products]
    
    product_cards = ""
    for product in products:
        price = product.get('price', '')
        rating = product.get('rating', '')
        
        product_cards += f"""
        <div class="product-card">
            <h4>{product.get('title', 'Product')}</h4>
            {f'<span class="rating">★ {rating}</span>' if rating else ''}
            <div class="product-footer">
                {f'<span class="price">{price}</span>' if price else ''}
                <a href="{product.get('url', '#')}" class="product-btn">{button_text}</a>
            </div>
        </div>
        """
    
    return f"""
    <div class="affiliate-block shopping-block">
        <h3>{template}</h3>
        <div class="product-grid">
            {product_cards}
        </div>
    </div>
    """


def render_hotel_block(
    hotels: List[Dict[str, Any]],
    template: str = "Where to Stay",
    button_text: str = "Book",
    max_hotels: int = 3
) -> str:
    """Render a hotel recommendations block."""
    if not hotels:
        return ""
    
    hotels = hotels[:max_hotels]
    
    hotel_cards = ""
    for hotel in hotels:
        price = hotel.get('price', '')
        rating = hotel.get('rating', '')
        
        hotel_cards += f"""
        <div class="hotel-card">
            <h4>{hotel.get('title', 'Hotel')}</h4>
            {f'<span class="rating">★ {rating}</span>' if rating else ''}
            <div class="hotel-footer">
                {f'<span class="price">{price}</span>' if price else ''}
                <a href="{hotel.get('url', '#')}" class="hotel-btn">{button_text}</a>
            </div>
        </div>
        """
    
    return f"""
    <div class="affiliate-block hotel-block">
        <h3>{template}</h3>
        <div class="hotel-grid">
            {hotel_cards}
        </div>
    </div>
    """


def render_sticky_mobile_cta(
    text: str,
    url: str,
    position: str = "bottom"  # "top" or "bottom"
) -> str:
    """Render a sticky mobile CTA."""
    return f"""
    <div class="sticky-mobile-cta sticky-{position}">
        <a href="{url}" class="sticky-cta-btn">{text}</a>
    </div>
    """


def render_photo_page_monetization(
    photo_data: Dict[str, Any],
    affiliate_results: Dict[str, List[Dict[str, Any]]]
) -> str:
    """Render full monetization blocks for a photo page."""
    
    location = photo_data.get('location_name', photo_data.get('location', ''))
    species = photo_data.get('species_common_name', '')
    
    # Build CTA templates
    tour_cta = f"Where this photo was taken" if location else "Wildlife tours"
    shopping_cta = f"Gear for {species}" if species else "Recommended gear"
    hotel_cta = f"Stay near {location}" if location else "Nearby hotels"
    
    blocks = []
    
    # Tours block
    if affiliate_results.get('tours'):
        blocks.append(render_tour_block(
            affiliate_results['tours'],
            template=tour_cta,
            button_text="View Tour"
        ))
    
    # Shopping block  
    if affiliate_results.get('shopping'):
        blocks.append(render_shopping_block(
            affiliate_results['shopping'],
            template=shopping_cta,
            button_text="View on Amazon"
        ))
    
    # Hotels block
    if affiliate_results.get('hotels'):
        blocks.append(render_hotel_block(
            affiliate_results['hotels'],
            template=hotel_cta,
            button_text="Book Stay"
        ))
    
    return "\n\n".join(blocks)


def render_species_page_monetization(
    species_name: str,
    location: str,
    affiliate_results: Dict[str, List[Dict[str, Any]]]
) -> str:
    """Render full monetization blocks for a species page."""
    
    # Build CTA templates
    tour_cta = f"See {species_name} in Costa Rica"
    shopping_cta = f"Gear for spotting {species_name}"
    hotel_cta = f"Where to stay to see {species_name}"
    
    blocks = []
    
    # Tours block
    if affiliate_results.get('tours'):
        blocks.append(render_tour_block(
            affiliate_results['tours'],
            template=tour_cta,
            button_text="See Species"
        ))
    
    # Shopping block
    if affiliate_results.get('shopping'):
        blocks.append(render_shopping_block(
            affiliate_results['shopping'],
            template=shopping_cta,
            button_text="Get Gear"
        ))
    
    # Hotels block
    if affiliate_results.get('hotels'):
        blocks.append(render_hotel_block(
            affiliate_results['hotels'],
            template=hotel_cta,
            button_text="Find Stay"
        ))
    
    # Add sticky mobile CTA
    if affiliate_results.get('tours'):
        blocks.append(render_sticky_mobile_cta(
            text=f"See {species_name}",
            url=affiliate_results['tours'][0].get('url', '#')
        ))
    
    return "\n\n".join(blocks)


def render_location_page_monetization(
    location_name: str,
    affiliate_results: Dict[str, List[Dict[str, Any]]]
) -> str:
    """Render full monetization blocks for a location page."""
    
    # Build CTA templates
    tour_cta = f"Best wildlife tours in {location_name}"
    shopping_cta = f"Best gear for {location_name}"
    hotel_cta = f"Best stays near {location_name}"
    
    blocks = []
    
    # Tours block
    if affiliate_results.get('tours'):
        blocks.append(render_tour_block(
            affiliate_results['tours'],
            template=tour_cta,
            button_text="Book Tour",
            max_tours=6
        ))
    
    # Shopping block
    if affiliate_results.get('shopping'):
        blocks.append(render_shopping_block(
            affiliate_results['shopping'],
            template=shopping_cta,
            button_text="View on Amazon"
        ))
    
    # Hotels block
    if affiliate_results.get('hotels'):
        blocks.append(render_hotel_block(
            affiliate_results['hotels'],
            template=hotel_cta,
            button_text="Book Stay",
            max_hotels=5
        ))
    
    # Add sticky mobile CTA
    if affiliate_results.get('tours'):
        blocks.append(render_sticky_mobile_cta(
            text=f" tours in {location_name}",
            url=affiliate_results['tours'][0].get('url', '#')
        ))
    
    return "\n\n".join(blocks)


# Example CSS for monetization blocks
MONETIZATION_CSS = """
<style>
.affiliate-block {
    margin: 2rem 0;
    padding: 1.5rem;
    background: #f9f9f9;
    border-radius: 8px;
}
.affiliate-block h3 {
    margin-bottom: 1rem;
    font-size: 1.25rem;
}
.tour-grid, .product-grid, .hotel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}
.tour-card, .product-card, .hotel-card {
    background: white;
    padding: 1rem;
    border-radius: 6px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.tour-card h4, .product-card h4, .hotel-card h4 {
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
}
.tour-meta, .rating {
    color: #666;
    font-size: 0.85rem;
}
.tour-footer, .product-footer, .hotel-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.75rem;
}
.price {
    font-weight: 600;
    color: #2e7d32;
}
.tour-btn, .product-btn, .hotel-btn {
    background: #0066cc;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    text-decoration: none;
    font-size: 0.85rem;
}
.tour-btn:hover, .product-btn:hover, .hotel-btn:hover {
    background: #0052a3;
}
.sticky-mobile-cta {
    display: none;
}
@media (max-width: 768px) {
    .sticky-mobile-cta {
        display: block;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 1rem;
        background: white;
        box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
        text-align: center;
        z-index: 1000;
    }
    .sticky-cta-btn {
        display: inline-block;
        background: #0066cc;
        color: white;
        padding: 0.75rem 2rem;
        border-radius: 25px;
        text-decoration: none;
        font-weight: 500;
    }
}
</style>
"""


if __name__ == "__main__":
    # Test example
    test_photo = {
        'location_name': 'Carara',
        'species_common_name': 'Scarlet Macaw'
    }
    
    test_results = {
        'tours': [
            {'title': 'Scarlet Macaw Tour', 'url': '#', 'price': '$45', 'rating': '4.8', 'review_count': '234'},
            {'title': 'Carara Wildlife Tour', 'url': '#', 'price': '$55', 'rating': '4.9', 'review_count': '156'}
        ],
        'shopping': [
            {'title': 'Canon Binoculars', 'url': '#', 'price': '$199', 'rating': '4.7'}
        ],
        'hotels': [
            {'title': 'Carara Eco Lodge', 'url': '#', 'price': '$120', 'rating': '4.6'}
        ]
    }
    
    print(render_photo_page_monetization(test_photo, test_results))
