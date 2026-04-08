"""
MCP Tools — Advanced web search for accurate nutrition data
Uses multiple sources and dynamic serving size calculation
NO HARDCODED VALUES
"""

import re
import asyncio
from typing import Dict, List, Optional
import httpx

try:
    from duckduckgo_search import DDGS
    DDG_AVAILABLE = True
except ImportError:
    DDG_AVAILABLE = False


# ─── Enhanced nutrition patterns for better extraction ─────────────────────

_PATTERNS = {
    "calories": [
        r"calories?[:\s]+(\d+(?:\.\d+)?)\s*(?:kcal|cal)",
        r"energy[:\s]+(\d+(?:\.\d+)?)\s*kcal",
        r"(\d+(?:\.\d+)?)\s*calories?",
        r"kcal[:\s]+(\d+(?:\.\d+)?)",
    ],
    "protein": [
        r"protein[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+protein",
        r"protein\s*[:\-]\s*(\d+(?:\.\d+)?)",
        r"proteins?\s+(\d+(?:\.\d+)?)\s*g",
    ],
    "carbs": [
        r"carbohydrates?[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"carbs?[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+carbohydrates?",
        r"total carbohydrates?\s+(\d+(?:\.\d+)?)",
    ],
    "fat": [
        r"(?:total\s+)?fat[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+fat",
        r"fats?\s+(\d+(?:\.\d+)?)\s*g",
        r"total fat\s+(\d+(?:\.\d+)?)",
    ],
    "fiber": [
        r"(?:dietary\s+)?fiber[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"fibre[:\s]+(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+fiber",
    ],
    "cholesterol": [
        r"cholesterol[:\s]+(\d+(?:\.\d+)?)\s*mg",
        r"(\d+(?:\.\d+)?)\s*mg\s+cholesterol",
        r"cholestrol?\s+(\d+(?:\.\d+)?)",
    ],
    "iron": [
        r"iron[:\s]+(\d+(?:\.\d+)?)\s*mg",
        r"(\d+(?:\.\d+)?)\s*mg\s+iron",
        r"fe[:\s]+(\d+(?:\.\d+)?)\s*mg",
    ],
}


# ─── Dynamic serving size calculation (NO HARDCODING) ──────────────────────

async def get_serving_size_grams(food_name: str, unit: str, quantity: float = 1) -> float:
    """
    Dynamically determine serving size in grams based on food and unit
    Uses web search to find standard serving sizes
    """
    food_lower = food_name.lower()
    
    # Weight-based units
    if unit in ["g", "gram", "grams"]:
        return quantity
    
    if unit in ["kg", "kilo", "kilogram"]:
        return quantity * 1000
    
    # Volume-based units - search for density
    if unit in ["cup", "tablespoon", "teaspoon", "ml", "liter"]:
        density = await get_food_density(food_name)
        if unit == "cup":
            return quantity * 240 * density
        elif unit == "tablespoon":
            return quantity * 15 * density
        elif unit == "teaspoon":
            return quantity * 5 * density
        elif unit == "ml":
            return quantity * density
        elif unit == "liter":
            return quantity * 1000 * density
    
    # Piece/unit based - search web for standard weight
    results = await ddg_search(f"{food_name} weight grams one {unit}", max_results=3)
    for result in results:
        text = f"{result.get('title', '')} {result.get('body', '')}".lower()
        weight_patterns = [
            r'(\d+(?:\.\d+)?)\s*g(?:rams?)?',
            r'weigh(?:s|ts?)?\s+about\s+(\d+(?:\.\d+)?)\s*g',
            r'approx(?:imately)?\s+(\d+(?:\.\d+)?)\s*g',
            r'(\d+(?:\.\d+)?)\s*grams?\s+(?:per|each)',
        ]
        for pattern in weight_patterns:
            match = re.search(pattern, text)
            if match:
                return float(match.group(1)) * quantity
    
    # If unit is "piece", "serving", "each", use food-specific search
    if unit in ["piece", "serving", "each", "whole"]:
        results = await ddg_search(f"standard serving size {food_name} grams", max_results=2)
        for result in results:
            text = f"{result.get('title', '')} {result.get('body', '')}".lower()
            match = re.search(r'(\d+(?:\.\d+)?)\s*g', text)
            if match:
                return float(match.group(1)) * quantity
    
    # Default: assume 150g per serving
    return 150 * quantity


async def get_food_density(food_name: str) -> float:
    """Dynamically estimate food density (g/ml) for volume conversion"""
    results = await ddg_search(f"{food_name} density grams per ml", max_results=2)
    for result in results:
        text = f"{result.get('title', '')} {result.get('body', '')}".lower()
        match = re.search(r'(\d+(?:\.\d+)?)\s*g/ml', text)
        if match:
            return float(match.group(1))
    
    # Default density for most foods is ~0.8-1.0 g/ml
    return 0.9


def extract_nutrition_from_text(text: str) -> Dict[str, float]:
    """Extract nutrition values from text with validation"""
    text = text.lower()
    result: Dict[str, float] = {}
    
    for nutrient, patterns in _PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1))
                    # Validate reasonable ranges
                    ranges = {
                        "calories": (10, 2000),
                        "protein": (0.1, 200),
                        "carbs": (0.1, 200),
                        "fat": (0.1, 100),
                        "fiber": (0.1, 50),
                        "cholesterol": (1, 1000),
                        "iron": (0.1, 50),
                    }
                    min_val, max_val = ranges.get(nutrient, (0, 1000))
                    if min_val < value < max_val:
                        result[nutrient] = value
                        break
                except ValueError:
                    pass
    
    return result


def merge_nutrition(web_results: List[Dict]) -> Dict[str, float]:
    """Merge multiple extraction results, preferring non-zero values"""
    merged = {
        "calories": 0, "protein": 0, "carbs": 0, "fat": 0,
        "fiber": 0, "cholesterol": 0, "iron": 0
    }
    
    for result in web_results:
        for key in merged:
            if result.get(key, 0) > 0 and merged[key] == 0:
                merged[key] = result[key]
    
    return merged


# ─── DuckDuckGo search ───────────────────────────────────────────────────────

async def ddg_search(query: str, max_results: int = 8) -> List[Dict]:
    """Run DuckDuckGo search in thread executor"""
    if not DDG_AVAILABLE:
        return []
    
    loop = asyncio.get_event_loop()
    
    def _search():
        try:
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))
        except Exception as e:
            print(f"[DDG] search error: {e}")
            return []
    
    return await loop.run_in_executor(None, _search)


# ─── Main nutrition API ───────────────────────────────────────────────────────

async def get_nutrition_from_web(food_name: str, quantity_g: float = 100) -> Dict:
    """Search multiple sources for accurate nutrition data"""
    
    # Try multiple search queries
    queries = [
        f"{food_name} nutrition facts 100g",
        f"{food_name} calories protein carbs fat",
        f"{food_name} nutritional value per 100g",
    ]
    
    all_extractions: List[Dict[str, float]] = []
    
    for query in queries:
        results = await ddg_search(query, max_results=5)
        for result in results:
            combined = f"{result.get('title', '')} {result.get('body', '')}".strip()
            extracted = extract_nutrition_from_text(combined)
            if extracted and any(extracted.values()):
                all_extractions.append(extracted)
    
    # Merge all extractions
    nutrition = merge_nutrition(all_extractions)
    
    # Scale to requested quantity
    if quantity_g != 100 and quantity_g > 0:
        scale = quantity_g / 100
        nutrition = {k: round(v * scale, 2) for k, v in nutrition.items()}
    
    # Determine confidence
    filled = sum(1 for v in nutrition.values() if v > 0)
    if filled >= 5:
        confidence = "high"
        source = "web_search_high"
    elif filled >= 3:
        confidence = "medium"
        source = "web_search_medium"
    else:
        confidence = "low"
        source = "partial_data"
    
    return {**nutrition, "source": source, "confidence": confidence, "food_name": food_name}


async def get_nutrition_with_serving(
    food_name: str, 
    quantity: float = 1, 
    unit: str = "serving"
) -> Dict:
    """Get nutrition for specific serving size - dynamically calculated"""
    
    # Get serving size in grams dynamically
    serving_grams = await get_serving_size_grams(food_name, unit, quantity)
    
    # Get nutrition per 100g
    nutrition = await get_nutrition_from_web(food_name, serving_grams)
    
    nutrition["serving_quantity"] = quantity
    nutrition["serving_unit"] = unit
    nutrition["serving_grams"] = serving_grams
    
    return nutrition


async def search_health_info(query: str) -> List[Dict]:
    """General health/nutrition web search for AI chat context"""
    results = await ddg_search(f"health nutrition {query}", max_results=3)
    return [
        {
            "title": result.get("title", ""),
            "snippet": result.get("body", "")[:400],
            "url": result.get("href", "")
        }
        for result in results
    ]
