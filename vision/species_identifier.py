#!/usr/bin/env python3
"""
Gemini Vision Species Identification

Uses Gemini to identify wildlife species in images and generate metadata.
"""

import base64
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

# Try to import Gemini
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    print("Warning: google-genai not installed. Run: pip install google-genai")


SPECIES_PROMPT = """You are a wildlife identification assistant for Costa Rica photography.

Analyze the image and return a cautious biological classification.

Rules:
- Output valid JSON only.
- Prefer accuracy over specificity.
- If species is uncertain, use genus/group level.
- Use location as plausibility context, not proof.
- Include alternative candidates when relevant.
- Never fabricate confidence.

Return exactly this JSON structure:
{
  "common_name": "",
  "scientific_name": "",
  "taxon_rank": "",
  "animal_group": "",
  "confidence": 0.0,
  "alternative_candidates": [],
  "needs_review": false,
  "reasoning": ""
}

Confidence thresholds:
- >= 0.92: Publish species-level
- 0.75-0.91: Soft species-level, may need review
- < 0.75: Downgrade to group-level, mark needs_review=true
"""


def encode_image_to_base64(image_path: Path) -> str:
    """Encode image to base64 for Gemini API."""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def identify_species(
    image_path: Path,
    api_key: str,
    model_name: str = "gemini-2.0-flash",
    max_retries: int = 3
) -> Optional[Dict[str, Any]]:
    """
    Use Gemini Vision to identify species in an image.
    
    Returns:
        Dict with species info or None if failed
    """
    if not GEMINI_AVAILABLE:
        print("Error: google-genai not installed")
        return None
    
    client = genai.Client(api_key=api_key)
    
    # Encode image
    image_data = encode_image_to_base64(image_path)
    
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    types.Part(
                        inline_data=types.Blob(
                            data=image_data,
                            mime_type="image/jpeg"
                        )
                    ),
                    SPECIES_PROMPT
                ],
                config={
                    'response_mime_type': 'application/json',
                    'temperature': 0.1,
                }
            )
            
            # Parse response
            result_text = response.text
            
            # Try to extract JSON from response
            try:
                result = json.loads(result_text)
            except json.JSONDecodeError:
                # Try to extract JSON from markdown
                import re
                json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                else:
                    print(f"Failed to parse JSON from response: {result_text[:200]}")
                    return None
            
            # Apply confidence thresholds
            confidence = result.get('confidence', 0.0)
            
            if confidence < 0.75:
                # Downgrade to group level
                result['needs_review'] = True
                result['common_name'] = result.get('animal_group', 'Unknown')
                result['scientific_name'] = ''
                result['taxon_rank'] = 'group'
            
            print(f"  Species: {result.get('common_name')} (confidence: {confidence:.2f})")
            return result
            
        except Exception as e:
            print(f"  Attempt {attempt + 1} failed: {e}")
            if attempt == max_retries - 1:
                return None
    
    return None


def generate_metadata(
    image_path: Path,
    api_key: str,
    existing_metadata: Dict[str, Any] = None,
    model_name: str = "gemini-2.0-flash"
) -> Optional[Dict[str, Any]]:
    """
    Generate metadata for an image using Gemini.
    
    Uses existing metadata as context if provided.
    """
    if not GEMINI_AVAILABLE:
        return None
    
    client = genai.Client(api_key=api_key)
    
    # Build context from existing metadata
    context = ""
    if existing_metadata:
        context_parts = []
        if existing_metadata.get('gallery_name'):
            context_parts.append(f"Gallery: {existing_metadata['gallery_name']}")
        if existing_metadata.get('location'):
            context_parts.append(f"Location: {existing_metadata['location']}")
        if existing_metadata.get('filename'):
            context_parts.append(f"Filename: {existing_metadata['filename']}")
        if context_parts:
            context = "Context: " + ", ".join(context_parts) + "\n"
    
    prompt = f"""You are generating production metadata for WildPhotography.

{context}
Rules:
- Output valid JSON only.
- Never use the raw filename as the final public title.
- Prefer natural language titles.
- Do not hallucinate exact species identity.
- If uncertain, use broader wildlife grouping.
- Include location only if confidence is high.
- Keywords must be clean, useful, and non-repetitive.
- Prefer Costa Rica wildlife/travel phrasing when supported by the image and geodata.

Return exactly this JSON structure:
{{
  "title": "",
  "description": "",
  "keywords": [],
  "subjects": [],
  "scene_type": "",
  "confidence": 0.0,
  "tour_intent_tags": [],
  "shopping_intent_tags": [],
  "hotel_intent_tags": []
}}
"""
    
    # Encode image
    image_data = encode_image_to_base64(image_path)
    
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=[
                types.Part(
                    inline_data=types.Blob(
                        data=image_data,
                        mime_type="image/jpeg"
                    )
                ),
                prompt
            ],
            config={
                'response_mime_type': 'application/json',
                'temperature': 0.3,
            }
        )
        
        result_text = response.text
        
        # Try to parse JSON
        try:
            result = json.loads(result_text)
            print(f"  Generated: {result.get('title', 'N/A')[:50]}")
            return result
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return None
            
    except Exception as e:
        print(f"  Metadata generation failed: {e}")
        return None


def should_run_vision(
    csv_row: Dict[str, Any],
    force: bool = False
) -> Tuple[bool, str]:
    """
    Determine if vision should run for a given CSV row.
    
    Returns:
        (should_run, reason)
    """
    if force:
        return True, "force=true"
    
    # Check if we already have usable species data
    species = csv_row.get('SpeciesCommonName', '')
    if species and len(species) > 2:
        return False, "species already identified"
    
    # Check if confidence is already high enough
    confidence = csv_row.get('AIConfidence', '')
    if confidence:
        try:
            conf_float = float(confidence)
            if conf_float >= 0.92:
                return False, f"confidence already high ({conf_float})"
        except (ValueError, TypeError):
            pass
    
    # Check if we have usable title/description
    title = csv_row.get('Title', '')
    if not title or len(title) < 3:
        return True, "missing title"
    
    return True, "no species data"


# Example usage
if __name__ == "__main__":
    import sys
    
    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        print("Error: GEMINI_API_KEY not set")
        sys.exit(1)
    
    # Test with a sample image
    test_image = Path("/Volumes/ADATA SC740/Smugmug Backup/Galleries/Costa-Rica-Gallery/Birds/img-1234.jpg")
    
    if test_image.exists():
        result = identify_species(test_image, api_key)
        print(json.dumps(result, indent=2))
    else:
        print(f"Test image not found: {test_image}")
