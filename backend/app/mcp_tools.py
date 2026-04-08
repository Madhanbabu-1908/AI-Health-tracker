"""
MCP Tools — Multi-source nutrition lookup for maximum accuracy.

Priority order:
  1. Open Food Facts API  — free, structured JSON, no API key needed
  2. Full page fetch from nutritionvalue.org via DDG
  3. DuckDuckGo snippet extraction (3 targeted queries)

All values are per-100g internally, then scaled to the requested quantity.
"""

import re
import asyncio
from typing import Dict, List
import httpx

try:
    from duckduckgo_search import DDGS
    DDG_AVAILABLE = True
except ImportError:
    DDG_AVAILABLE = False


# ─── Nutrient patterns ───────────────────────────────────────────────────────

_PATTERNS = {
    "calories": [
        r"(?:energy|calories?)[^\d]{0,10}(\d{2,4}(?:\.\d+)?)\s*(?:kcal|cal)?",
        r"(\d{2,4}(?:\.\d+)?)\s*(?:kcal|cal(?:ories?)?)",
        r"kcal[^\d]{0,5}(\d{2,4}(?:\.\d+)?)",
    ],
    "protein": [
        r"protein[^\d]{0,8}(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+protein",
    ],
    "carbs": [
        r"carbohydrates?[^\d]{0,8}(\d+(?:\.\d+)?)\s*g",
        r"carbs?[^\d]{0,5}(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+carb",
    ],
    "fat": [
        r"(?:total\s+)?fat[^\d]{0,8}(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+(?:total\s+)?fat",
    ],
    "fiber": [
        r"(?:dietary\s+)?fib(?:er|re)[^\d]{0,8}(\d+(?:\.\d+)?)\s*g",
        r"(\d+(?:\.\d+)?)\s*g\s+fib(?:er|re)",
    ],
    "cholesterol": [
        r"cholesterol[^\d]{0,8}(\d+(?:\.\d+)?)\s*mg",
        r"(\d+(?:\.\d+)?)\s*mg\s+cholesterol",
    ],
    "iron": [
        r"iron[^\d]{0,8}(\d+(?:\.\d+)?)\s*mg",
        r"(\d+(?:\.\d+)?)\s*mg\s+iron",
    ],
}

_RANGES = {
    "calories":    (5,   900),
    "protein":     (0,   100),
    "carbs":       (0,   100),
    "fat":         (0,   100),
    "fiber":       (0,    50),
    "cholesterol": (0,  2000),
    "iron":        (0,    50),
}

EMPTY_NUT = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0,
             "fiber": 0, "cholesterol": 0, "iron": 0}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _extract(text: str) -> Dict[str, float]:
    text = text.lower()
    out = {}
    for nutrient, pats in _PATTERNS.items():
        for pat in pats:
            m = re.search(pat, text, re.IGNORECASE)
            if m:
                try:
                    v = float(m.group(1))
                    lo, hi = _RANGES.get(nutrient, (0, 10000))
                    if lo <= v <= hi:
                        out[nutrient] = v
                        break
                except ValueError:
                    pass
    return out


def _merge(*dicts: Dict) -> Dict[str, float]:
    out = dict(EMPTY_NUT)
    for d in dicts:
        for k in out:
            if out[k] == 0 and isinstance(d, dict) and d.get(k, 0) > 0:
                out[k] = d[k]
    return out


def _filled(d: Dict) -> int:
    return sum(1 for k in EMPTY_NUT if d.get(k, 0) > 0)


def _scale(d: Dict, grams: float) -> Dict:
    if grams == 100:
        return d
    s = grams / 100
    return {k: round(v * s, 2) if k in EMPTY_NUT else v for k, v in d.items()}


# ─── Source 1: Open Food Facts ───────────────────────────────────────────────

async def _openfoodfacts(food_name: str) -> Dict[str, float]:
    url = "https://world.openfoodfacts.org/cgi/search.pl"
    params = {
        "search_terms": food_name,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": 5,
        "fields": "product_name,nutriments",
    }
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url, params=params)
        products = resp.json().get("products", [])

        best: Dict[str, float] = {}
        best_filled = 0

        for p in products:
            n = p.get("nutriments", {})
            chol_g = float(n.get("cholesterol_100g", 0) or 0)
            iron_g = float(n.get("iron_100g", 0) or 0)
            candidate = {
                "calories":    float(n.get("energy-kcal_100g") or n.get("energy_100g", 0) or 0),
                "protein":     float(n.get("proteins_100g", 0) or 0),
                "carbs":       float(n.get("carbohydrates_100g", 0) or 0),
                "fat":         float(n.get("fat_100g", 0) or 0),
                "fiber":       float(n.get("fiber_100g", 0) or 0),
                "cholesterol": round(chol_g * 1000, 2),   # g → mg
                "iron":        round(iron_g * 1000, 2),    # g → mg
            }
            valid = {k: (v if _RANGES.get(k, (0,9999))[0] <= v <= _RANGES.get(k, (0,9999))[1] else 0)
                     for k, v in candidate.items()}
            f = _filled(valid)
            if f > best_filled:
                best = valid
                best_filled = f

        return best
    except Exception as e:
        print(f"[OFF] {e}")
        return {}


# ─── Source 2: DDG search + snippet extraction ───────────────────────────────

async def ddg_search(query: str, max_results: int = 6) -> List[Dict]:
    if not DDG_AVAILABLE:
        return []
    loop = asyncio.get_event_loop()
    def _run():
        try:
            with DDGS() as ddgs:
                return list(ddgs.text(query, max_results=max_results))
        except Exception as e:
            print(f"[DDG] {e}")
            return []
    return await loop.run_in_executor(None, _run)


async def _ddg_nutrition(food_name: str) -> Dict[str, float]:
    queries = [
        f"{food_name} nutrition facts per 100g calories protein carbs fat",
        f"{food_name} nutritional value 100g macros",
        f"{food_name} calories protein carbs fat fiber cholesterol 100 grams",
    ]
    extractions = []
    seen = set()
    for q in queries:
        results = await ddg_search(q, max_results=5)
        for r in results:
            url = r.get("href", "")
            if url in seen:
                continue
            seen.add(url)
            text = f"{r.get('title', '')} {r.get('body', '')}"
            ex = _extract(text)
            if _filled(ex) > 0:
                extractions.append(ex)
    return _merge(*extractions) if extractions else dict(EMPTY_NUT)


# ─── Source 3: Full page fetch ───────────────────────────────────────────────

async def _fetch_page(food_name: str) -> Dict[str, float]:
    try:
        results = await ddg_search(
            f"{food_name} nutrition site:nutritionvalue.org", max_results=2
        )
        if not results:
            return {}
        url = results[0].get("href", "")
        if not url:
            return {}
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.get(url)
        return _extract(resp.text[:8000])
    except Exception as e:
        print(f"[PAGE] {e}")
        return {}


# ─── Main API ─────────────────────────────────────────────────────────────────

async def get_nutrition_from_web(food_name: str, quantity_g: float = 100) -> Dict:
    """
    Concurrent multi-source lookup. Returns values per requested quantity.
    OFF > page fetch > DDG snippets. First non-zero per nutrient wins.
    """
    food_name = food_name.strip()

    off_task, ddg_task, page_task = await asyncio.gather(
        _openfoodfacts(food_name),
        _ddg_nutrition(food_name),
        _fetch_page(food_name),
        return_exceptions=True,
    )

    off  = off_task  if isinstance(off_task,  dict) else {}
    ddg  = ddg_task  if isinstance(ddg_task,  dict) else {}
    page = page_task if isinstance(page_task, dict) else {}

    merged = _merge(off, page, ddg)
    filled = _filled(merged)

    source = (
        "openfoodfacts"  if _filled(off) >= 4  else
        "web_page"       if _filled(page) >= 4 else
        "web_search_high" if filled >= 5       else
        "web_search_med"  if filled >= 3       else
        "web_search_low"
    )
    confidence = "high" if filled >= 5 else "medium" if filled >= 3 else "low"

    result = _scale(merged, quantity_g)
    result.update({"source": source, "confidence": confidence,
                   "food_name": food_name, "per_grams": quantity_g})
    return result


async def get_nutrition_with_serving(
    food_name: str, quantity: float = 1, unit: str = "serving"
) -> Dict:
    grams = await _resolve_grams(food_name, quantity, unit)
    result = await get_nutrition_from_web(food_name, grams)
    result.update({"serving_quantity": quantity,
                   "serving_unit": unit,
                   "serving_grams": grams})
    return result


async def _resolve_grams(food_name: str, quantity: float, unit: str) -> float:
    u = unit.lower().strip()
    if u in ("g", "gram", "grams"):          return quantity
    if u in ("kg", "kilo", "kilogram"):       return quantity * 1000
    if u in ("oz", "ounce", "ounces"):        return quantity * 28.35
    if u in ("lb", "lbs", "pound", "pounds"): return quantity * 453.6
    if u in ("ml", "milliliter", "millilitre"):
        return quantity * await _get_density(food_name)
    if u in ("l", "liter", "litre"):
        return quantity * 1000 * await _get_density(food_name)
    if u in ("cup", "cups"):
        return quantity * 240 * await _get_density(food_name)
    if u in ("tbsp", "tablespoon", "tablespoons"):
        return quantity * 15 * await _get_density(food_name)
    if u in ("tsp", "teaspoon", "teaspoons"):
        return quantity * 5 * await _get_density(food_name)

    # DDG lookup for piece / serving weights
    results = await ddg_search(
        f"how many grams is one {unit} of {food_name}", max_results=4
    )
    for r in results:
        text = f"{r.get('title','')} {r.get('body','')}".lower()
        for pat in [
            r"(\d+(?:\.\d+)?)\s*g(?:rams?)?",
            r"weigh[st]?\s+(?:about\s+)?(\d+(?:\.\d+)?)\s*g",
            r"approx(?:imately)?\s+(\d+(?:\.\d+)?)\s*g",
        ]:
            m = re.search(pat, text)
            if m:
                v = float(m.group(1))
                if 5 < v < 3000:
                    return v * quantity

    meal_units  = {"serving", "plate", "bowl", "portion", "meal"}
    snack_units = {"piece", "slice", "biscuit", "cracker", "cookie", "each"}
    if u in meal_units:  return 200 * quantity
    if u in snack_units: return 30  * quantity
    return 150 * quantity


async def _get_density(food_name: str) -> float:
    results = await ddg_search(f"{food_name} density g per ml", max_results=2)
    for r in results:
        text = f"{r.get('title','')} {r.get('body','')}".lower()
        m = re.search(r"(\d+(?:\.\d+)?)\s*g/ml", text)
        if m:
            v = float(m.group(1))
            if 0.1 < v < 5:
                return v
    return 1.0


async def search_health_info(query: str) -> List[Dict]:
    results = await ddg_search(f"health nutrition {query}", max_results=3)
    return [{"title": r.get("title",""), "snippet": r.get("body","")[:400],
             "url": r.get("href","")} for r in results]
