from groq import Groq
import os
import json
from typing import Dict, List
from dotenv import load_dotenv

load_dotenv()

class AIHealthAgent:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            print("Warning: GROQ_API_KEY not set. AI features will be limited.")
            self.client = None
        else:
            self.client = Groq(api_key=api_key)
        self.model = "mixtral-8x7b-32768"
    
    async def get_recommendation(self, query: str, context: Dict) -> str:
        """Get AI recommendation based on user context"""
        if not self.client:
            return "AI features unavailable. Please set GROQ_API_KEY."
        
        prompt = f"""You are a health AI for an athlete managing protein intake and cholesterol.

Current Status:
- Today's Protein: {context.get('today_protein', 0)}/{context.get('goal_protein', 100)}g
- Today's Cholesterol: {context.get('today_cholesterol', 0)}/{context.get('cholesterol_limit', 300)}mg
- Today's Calories: {context.get('today_calories', 0)}/{context.get('calorie_goal', 2500)} cal
- Weight: {context.get('weight', 70)}kg
- Height: {context.get('height', 175)}cm
- Activity Level: {context.get('activity_level', 'moderate')}

Recent Foods: {context.get('recent_foods', [])}

User Query: {query}

Provide a personalized, actionable response (2-3 sentences). Include specific food suggestions with protein/cholesterol values if relevant."""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=300
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"AI Error: {str(e)}"
    
    async def suggest_meal(self, remaining_protein: float, remaining_cholesterol: float, 
                          remaining_calories: float, available_foods: List[Dict]) -> List[str]:
        """Generate meal suggestions based on remaining budget and available foods"""
        if not self.client:
            return ["Add your foods to get AI suggestions"]
        
        foods_str = "\n".join([f"- {f['name']}: {f.get('protein', 0)}g protein, {f.get('cholesterol', 0)}mg cholesterol" 
                               for f in available_foods[:10]])
        
        prompt = f"""Suggest 3 quick meals using these available foods:
{foods_str}

Requirements:
- Need {remaining_protein}g more protein
- Cholesterol budget: {remaining_cholesterol}mg remaining
- Calorie budget: {remaining_calories}cal remaining

Return as JSON array of strings, each string being a meal suggestion."""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=200
            )
            
            # Parse JSON response
            content = response.choices[0].message.content
            # Extract JSON array
            start = content.find('[')
            end = content.rfind(']') + 1
            if start != -1 and end != 0:
                return json.loads(content[start:end])
            else:
                return ["Log more foods to get personalized suggestions"]
        except:
            return ["Check your food database for meal ideas"]
    
    async def analyze_trends(self, history: Dict) -> Dict:
        """Analyze historical data for patterns"""
        if not self.client:
            return {"insight": "Add GROQ_API_KEY for AI analysis"}
        
        # Summarize history
        dates = list(history.keys())[-7:]
        protein_avg = sum(history[d].protein for d in dates) / len(dates) if dates else 0
        protein_goal_met = sum(1 for d in dates if history[d].protein >= 100) if dates else 0
        
        prompt = f"""Analyze this athlete's 7-day nutrition data:
- Average protein: {protein_avg:.1f}g
- Days meeting protein goal (100g): {protein_goal_met}/7
- Recent trend: {'increasing' if protein_avg > 90 else 'needs improvement'}

Provide 1 sentence insight and 1 actionable recommendation."""
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
                max_tokens=150
            )
            return {
                "insight": response.choices[0].message.content,
                "protein_avg": protein_avg,
                "goal_consistency": f"{protein_goal_met}/7"
            }
        except:
            return {"insight": "Complete more days for AI analysis", "protein_avg": protein_avg}
