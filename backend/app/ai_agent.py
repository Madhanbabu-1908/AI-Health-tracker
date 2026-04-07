from groq import Groq
import os
import json
import re
from typing import Dict, List, Optional
from .mcp_tools import MCPTools
from .database import Database

class AIHealthAgent:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=api_key) if api_key else None
        self.model = "mixtral-8x7b-32768"
        self.mcp = MCPTools()
        self.db = Database()
    
    def _is_personal_info(self, text: str) -> bool:
        """Check if query contains personal information"""
        # Patterns for personal info
        patterns = [
            r'\b\d{10}\b',  # phone number
            r'\b[\w\.-]+@[\w\.-]+\.\w+\b',  # email
            r'\b\d{5,6}\b'  # potential pincode
        ]
        for pattern in patterns:
            if re.search(pattern, text):
                return True
        return False
    
    async def get_response(self, query: str, context: Dict) -> Dict:
        """Get AI response with caching and personal info filtering"""
        
        # Check for personal information
        if self._is_personal_info(query):
            return {
                "response": "I can't respond to questions containing personal information like phone numbers or email addresses. Please ask about nutrition, fitness, or health goals.",
                "from_cache": False,
                "personal_info_detected": True
            }
        
        # Check cache first
        cached = self.db.get_cached_ai_response(query)
        if cached:
            return {
                "response": cached,
                "from_cache": True,
                "personal_info_detected": False
            }
        
        # Analyze sentiment
        sentiment = await self.mcp.analyze_sentiment(query)
        
        # Prepare context
        profile = context.get("profile", {})
        bmi = profile.get("bmi", 0)
        nickname = profile.get("nickname", "Athlete")
        today = context.get("today", {})
        goals = context.get("goals", {})
        
        # Get web search if needed
        web_search_keywords = ["what is", "tell me about", "benefits", "side effects", "research"]
        web_results = None
        if any(keyword in query.lower() for keyword in web_search_keywords):
            web_results = await self.mcp.web_search(query, 2)
        
        prompt = f"""You are a health and nutrition coach for {nickname} (BMI: {bmi:.1f}).

Current Status:
- Today's Protein: {today.get('protein', 0)}/{goals.get('protein_goal', 100)}g
- Today's Cholesterol: {today.get('cholesterol', 0)}/{goals.get('cholesterol_limit', 300)}mg
- Today's Carbs: {today.get('carbs', 0)}/{goals.get('carb_limit', 300)}g
- Today's Iron: {today.get('iron', 0)}/{goals.get('iron_goal', 15)}mg

User Sentiment: {sentiment['sentiment']}

User Question: {query}

{"Web Search Results: " + str(web_results) if web_results else ""}

Provide a helpful, encouraging response (2-3 sentences). Focus on nutrition, fitness, and health goals. Do not ask for or repeat personal information."""
        
        try:
            if self.client:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=300
                )
                ai_response = response.choices[0].message.content
            else:
                # Fallback responses without API key
                ai_response = await self._fallback_response(query, context)
            
            # Cache the response
            self.db.cache_ai_response(query, ai_response)
            
            return {
                "response": ai_response,
                "from_cache": False,
                "personal_info_detected": False,
                "sentiment": sentiment,
                "web_search_used": web_results is not None
            }
        except Exception as e:
            return {
                "response": "I'm having trouble connecting right now. Please try again in a moment.",
                "from_cache": False,
                "error": str(e)
            }
    
    async def _fallback_response(self, query: str, context: Dict) -> str:
        """Fallback responses when Groq API is not available"""
        query_lower = query.lower()
        today = context.get("today", {})
        goals = context.get("goals", {})
        remaining_protein = max(0, goals.get("protein_goal", 100) - today.get("protein", 0))
        
        if "protein" in query_lower:
            if remaining_protein > 50:
                return f"You need {remaining_protein}g more protein. Try Beef Chukka (40g) + 2 eggs (12g)."
            elif remaining_protein > 20:
                return f"You need {remaining_protein}g more protein. Chickpeas (15g) + 1 egg (6g) would work well."
            elif remaining_protein > 0:
                return f"Only {remaining_protein}g more protein needed! A small snack will get you there."
            else:
                return "Great job! You've met your protein goal!"
        
        elif "cholesterol" in query_lower:
            remaining_chol = max(0, goals.get("cholesterol_limit", 300) - today.get("cholesterol", 0))
            if remaining_chol < 50:
                return "⚠️ Your cholesterol budget is almost used. Choose plant-based proteins."
            else:
                return f"You have {remaining_chol}mg cholesterol left today. Eggs (120mg each) are fine in moderation."
        
        elif "meal" in query_lower or "eat" in query_lower:
            return f"Suggested meal: Beef Chukka (40g protein) + Chickpeas (15g). That would cover your remaining {remaining_protein}g protein goal!"
        
        elif "bmi" in query_lower:
            bmi = context.get("profile", {}).get("bmi", 0)
            if bmi < 18.5:
                return f"Your BMI is {bmi:.1f} (Underweight). Focus on protein-rich foods and healthy fats."
            elif bmi < 25:
                return f"Your BMI is {bmi:.1f} (Normal). Great job maintaining a healthy weight!"
            elif bmi < 30:
                return f"Your BMI is {bmi:.1f} (Overweight). Focus on portion control and regular exercise."
            else:
                return f"Your BMI is {bmi:.1f} (Obese). Consider consulting a nutritionist for a personalized plan."
        
        else:
            return f"Based on your progress, you need {remaining_protein}g more protein today. Try Beef Chukka or Chickpeas!"
    
    async def get_nutrition_prediction(self, food_name: str) -> Dict:
        """Predict nutrition for a new food item"""
        # Try web search first
        nutrition = await self.mcp.get_nutrition_from_api(food_name)
        
        # If web search didn't find much, use AI
        if nutrition["protein"] == 0 and self.client:
            prompt = f"""Return ONLY JSON for nutrition of {food_name} per 100g:
            {{
                "protein": grams,
                "carbs": grams,
                "cholesterol": mg,
                "iron": mg,
                "calories": kcal
            }}
            Use typical values. Return ONLY JSON, no other text."""
            
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=150
                )
                content = response.choices[0].message.content
                # Extract JSON
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != 0:
                    nutrition = json.loads(content[start:end])
            except:
                pass
        
        return nutrition
