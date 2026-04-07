import httpx
from duckduckgo_search import DDGS
from typing import List, Dict

class MCPTools:
    """Model Context Protocol tools for external services"""
    
    @staticmethod
    async def web_search(query: str, num_results: int = 3) -> List[Dict]:
        """Search the web for nutrition information"""
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(
                    f"nutrition facts {query} protein carbs cholesterol iron",
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
    async def analyze_sentiment(text: str) -> Dict:
        """Analyze sentiment of user query"""
        positive_words = ["good", "great", "excellent", "healthy", "fit", "strong", "happy"]
        negative_words = ["bad", "tired", "weak", "unhealthy", "sick", "pain", "difficult"]
        
        text_lower = text.lower()
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            sentiment = "positive"
            score = positive_count / (positive_count + negative_count + 1)
        elif negative_count > positive_count:
            sentiment = "negative"
            score = -negative_count / (positive_count + negative_count + 1)
        else:
            sentiment = "neutral"
            score = 0
        
        return {"sentiment": sentiment, "score": score}
    
    @staticmethod
    async def get_nutrition_from_api(food_name: str) -> Dict:
        """Get nutrition information from web"""
        results = await MCPTools.web_search(f"{food_name} nutrition per 100g", 2)
        
        # Extract nutrition info from search results (simplified)
        nutrition = {
            "protein": 0,
            "carbs": 0,
            "cholesterol": 0,
            "iron": 0,
            "calories": 0
        }
        
        for result in results:
            snippet = result["snippet"].lower()
            if "protein" in snippet:
                # Try to extract numbers (simplified extraction)
                import re
                protein_match = re.search(r'protein\s*(\d+(?:\.\d+)?)\s*g', snippet)
                if protein_match:
                    nutrition["protein"] = float(protein_match.group(1))
            
            if "calories" in snippet:
                cal_match = re.search(r'calories?\s*(\d+)', snippet)
                if cal_match:
                    nutrition["calories"] = float(cal_match.group(1))
        
        return nutrition
