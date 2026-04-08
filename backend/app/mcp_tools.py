"""
MCP Tools — web search via DuckDuckGo to fetch real nutrition data.
Used by the AI agent to auto-fill food nutrition without storing static values.
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


# ─── Nutrition extraction helpers ────────────────────────────────────────────

_PATTERNS = {
    "calories":    [r"(\d+(?:\.\d+)?)\s*(?:k?cal(?:ories?)?)", r"energy[:\s]+(\d+(?:\.\d+)?)"],
    "protein":     [r"protein[:\s]+(\d+(?:\.\d+)?)\s*g", r"(\d+(?:\.\d+)?)\s*g\s+protein"],
    "carbs":       [r"carb(?:ohydrate)?s?[:\s]+(\d+(?:\.\d+)?)\s*g", r"(\d+(?:\.\d+)?)\s*g\s+carb"],
    "fat":         [r"(?:total\s+)?fat[:\s]+(\d+(?:\.\d+)?)\s*g", r"(\d+(?:\.\d+)?)\s*g\s+fat"],
    "fiber":       [r"(?:dietary\s+)?fi(?:b|re)(?:re|er)?[:\s]+(\d+(?:\.\d+)?)\s*g"],
    "cholesterol": [r"cholesterol[:\s]+(\d+(?:\.\d+)?)\s*mg", r"(\d+(?:\.\d+)?)\s*mg\s+cholesterol"],
    "iron":        [r"iron[:\s]+(\d+(?:\.\d+)?)\s*mg", r"(\d+(?:\.\d+)?)\s*mg\s+iron"],
}


def _extract_nutrition_from_text(text: str) -> Dict[str, float]:
    text = text.lower()
    result: Dict[str, float] = {}
    for nutrient, patterns in _PATTERNS.items():
        for pat in patterns:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    result[nutrient] = float(m.group(1))
                    break
                except ValueError:
                    pass
    return result


def _merge_nutrition(*dicts: Dict[str, float]) -> Dict[str, float]:
    """Merge multiple extraction results, preferring non-zero values."""
    merged = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0,
              "fiber": 0, "cholesterol": 0, "iron": 0}
    for d in dicts:
        for k, v in d.items():
            if k in merged and v > 0 and merged[k] == 0:
                merged[k] = v
    return merged


# ─── DuckDuckGo search ───────────────────────────────────────────────────────

async def ddg_search(query: str, max_results: int = 5) -> List[Dict]:
    """Run DuckDuckGo search in thread executor to avoid blocking."""
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


async def get_nutrition_from_web(food_name: str, quantity_g: float = 100) -> Dict:
    """
    Main entry point: search DuckDuckGo for nutrition facts,
    parse all snippets and merge best values.
    Returns dict with keys: calories, protein, carbs, fat, fiber, cholesterol, iron.
    All values are per the requested quantity.
    """
    queries = [
        f"{food_name} nutrition facts per 100g calories protein carbs",
        f"{food_name} nutritional value macros",
    ]

    all_extractions: List[Dict[str, float]] = []

    for q in queries:
        results = await ddg_search(q, max_results=4)
        for r in results:
            combined = (r.get("title", "") + " " + r.get("body", "")).strip()
            extracted = _extract_nutrition_from_text(combined)
            if extracted:
                all_extractions.append(extracted)

    merged = _merge_nutrition(*all_extractions)

    # Scale from 100g to requested quantity
    if quantity_g != 100 and quantity_g > 0:
        scale = quantity_g / 100
        merged = {k: round(v * scale, 2) for k, v in merged.items()}

    # Determine confidence
    filled = sum(1 for v in merged.values() if v > 0)
    confidence = "high" if filled >= 4 else ("medium" if filled >= 2 else "low")

    return {**merged, "source": "web_search", "confidence": confidence}


async def search_health_info(query: str) -> List[Dict]:
    """
    General health/nutrition web search for AI chat context.
    Returns list of {title, snippet, url}.
    """
    results = await ddg_search(f"health nutrition {query}", max_results=3)
    return [
        {"title": r.get("title", ""), "snippet": r.get("body", "")[:300], "url": r.get("href", "")}
        for r in results
    ]
