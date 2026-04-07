import httpx
import json
import os
from typing import List, Dict
from duckduckgo_search import DDGS
from bs4 import BeautifulSoup

class MCPTools:
    """Model Context Protocol tools for external services"""
    
    @staticmethod
    async def web_search(query: str, num_results: int = 3) -> List[Dict]:
        """Search the web using DuckDuckGo (free, no API key)"""
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(
                    f"nutrition {query} protein cholesterol calories",
                    max_results=num_results
                ))
                return [{
                    "title": r["title"],
                    "snippet": r["body"],
                    "link": r["href"]
                } for r in results]
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    @staticmethod
    async def get_nutrition_from_web(food_name: str) -> Dict:
        """Fetch nutrition information from web sources"""
        query = f"{food_name} nutrition facts protein per 100g"
        results = await MCPTools.web_search(query, num_results=2)
        
        return {
            "food": food_name,
            "web_results": results,
            "source": "duckduckgo"
        }
    
    @staticmethod
    async def update_json_file(data: dict, filename: str) -> bool:
        """Update local JSON file with new data"""
        filepath = f"data/{filename}"
        os.makedirs("data", exist_ok=True)
        
        try:
            with open(filepath, 'r') as f:
                existing = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            existing = {}
        
        existing.update(data)
        
        with open(filepath, 'w') as f:
            json.dump(existing, f, indent=2)
        return True
    
    @staticmethod
    async def read_json_file(filename: str) -> Dict:
        """Read data from JSON file"""
        filepath = f"data/{filename}"
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
