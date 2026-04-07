from .ai_agent import AIHealthAgent
from .mcp_tools import MCPTools
from .database import Database
from .food_service import FoodService
from typing import Dict, Any, List

class AgenticOrchestrator:
    """Centralized orchestration for all AI agents and tools"""
    
    def __init__(self):
        self.ai_agent = AIHealthAgent()
        self.mcp = MCPTools()
        self.db = Database()
        self.food_service = FoodService(self.db)
    
    async def process_query(self, query: str, user_context: Dict) -> Dict[str, Any]:
        """Orchestrate multiple agents to answer user query"""
        results = {
            "ai_response": None,
            "web_search": None,
            "food_suggestions": None,
            "action_taken": None
        }
        
        # Step 1: Get AI recommendation
        results["ai_response"] = await self.ai_agent.get_recommendation(query, user_context)
        
        # Step 2: Check if query asks for external info
        search_keywords = ["what is", "tell me about", "research", "study", "benefits", "side effects"]
        if any(keyword in query.lower() for keyword in search_keywords):
            results["web_search"] = await self.mcp.web_search(query)
        
        # Step 3: Check if user wants to add a new food
        add_keywords = ["add food", "create food", "new food", "save food"]
        if any(keyword in query.lower() for keyword in add_keywords):
            # Extract food name from query (simplified)
            words = query.split()
            for i, word in enumerate(words):
                if word.lower() in ["food", "item"] and i+1 < len(words):
                    potential_food = " ".join(words[i+1:i+3])
                    results["food_suggestions"] = await self.food_service.search_foods(potential_food)
                    break
        
        return results
    
    async def log_and_advise(self, food_name: str, quantity: float, unit: str = "serving", 
                             notes: str = None) -> Dict:
        """Log food and get real-time advice"""
        # Log the food
        entry = await self.food_service.log_food(food_name, quantity, unit, notes)
        
        if not entry:
            return {
                "success": False,
                "error": f"Food '{food_name}' not found. Please add it first.",
                "suggestions": await self.food_service.search_foods(food_name)
            }
        
        # Get today's totals
        today = self.db.get_today()
        profile = self.db.get_profile()
        
        # Generate advice based on remaining budget
        remaining_protein = max(0, profile.goal_protein - today.protein)
        remaining_cholesterol = max(0, profile.cholesterol_limit - today.cholesterol)
        remaining_calories = max(0, profile.calorie_goal - today.calories)
        
        # Get food suggestions for remaining budget
        available_foods = self.food_service.get_food_suggestions(limit=5)
        meal_suggestions = await self.ai_agent.suggest_meal(
            remaining_protein, remaining_cholesterol, remaining_calories, available_foods
        )
        
        # Determine advice message
        if remaining_protein <= 0:
            advice = "🎉 Protein goal met! Great job. Focus on recovery and hydration."
        elif remaining_cholesterol <= 0:
            advice = "⚠️ Cholesterol limit reached. Choose plant-based proteins (chickpeas, lentils) for the rest of the day."
        elif remaining_calories <= 0:
            advice = "📊 Calorie budget used. Consider lighter protein sources like egg whites."
        else:
            advice = f"💪 Need {remaining_protein:.1f}g more protein. {meal_suggestions[0] if meal_suggestions else 'Check your food list for options.'}"
        
        return {
            "success": True,
            "logged": {
                "name": entry.name,
                "quantity": entry.quantity,
                "protein": entry.protein * entry.quantity,
                "cholesterol": entry.cholesterol * entry.quantity,
                "calories": entry.calories * entry.quantity
            },
            "totals": {
                "protein": today.protein,
                "cholesterol": today.cholesterol,
                "calories": today.calories
            },
            "advice": advice,
            "meal_suggestions": meal_suggestions[:2],
            "remaining": {
                "protein": remaining_protein,
                "cholesterol": remaining_cholesterol,
                "calories": remaining_calories
            }
        }
    
    async def add_new_food(self, name: str, protein: float, cholesterol: float, 
                           calories: float, unit: str = "serving") -> Dict:
        """Add a new custom food to database"""
        food = self.food_service.create_custom_food(name, protein, cholesterol, calories, unit)
        
        # Also search web for verification (optional)
        web_info = await self.mcp.get_nutrition_from_web(name)
        
        return {
            "success": True,
            "food": {
                "name": food.name,
                "protein": food.protein_per_unit,
                "cholesterol": food.cholesterol_per_unit,
                "calories": food.calories_per_unit,
                "unit": food.default_unit
            },
            "web_verification": web_info if web_info.get("web_results") else None,
            "message": f"✅ Added '{name}' to your food database!"
                               }
