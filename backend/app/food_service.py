from .database import Database
from .models import CustomFood, FoodEntry
import uuid
from datetime import datetime
from typing import List, Optional

class FoodService:
    def __init__(self, db: Database):
        self.db = db
    
    def create_custom_food(self, name: str, protein: float, cholesterol: float, 
                           calories: float, unit: str = "serving") -> CustomFood:
        """Create a new custom food"""
        food_id = str(uuid.uuid4())[:8]
        food = CustomFood(
            id=food_id,
            name=name,
            protein_per_unit=protein,
            cholesterol_per_unit=cholesterol,
            calories_per_unit=calories,
            default_unit=unit,
            created_at=datetime.now(),
            usage_count=0
        )
        self.db.add_custom_food(food)
        return food
    
    def search_foods(self, query: str) -> List[dict]:
        """Search for foods in custom database"""
        custom_foods = self.db.get_custom_foods()
        
        # Filter by query
        results = []
        for food in custom_foods:
            if query.lower() in food.name.lower():
                results.append({
                    "name": food.name,
                    "protein": food.protein_per_unit,
                    "cholesterol": food.cholesterol_per_unit,
                    "calories": food.calories_per_unit,
                    "unit": food.default_unit,
                    "source": "custom"
                })
        
        # Also check common foods if not found
        if not results:
            common_foods = self._get_common_foods()
            for food in common_foods:
                if query.lower() in food["name"].lower():
                    results.append(food)
        
        return results
    
    def _get_common_foods(self) -> List[dict]:
        """Get common foods as fallback"""
        return [
            {"name": "Beef Chukka", "protein": 40, "cholesterol": 150, "calories": 350, "unit": "serving", "source": "common"},
            {"name": "Country Egg", "protein": 6, "cholesterol": 120, "calories": 70, "unit": "egg", "source": "common"},
            {"name": "Broiler Egg", "protein": 7, "cholesterol": 186, "calories": 78, "unit": "egg", "source": "common"},
            {"name": "Chickpeas", "protein": 15, "cholesterol": 0, "calories": 200, "unit": "100g", "source": "common"},
            {"name": "Chappathi", "protein": 3, "cholesterol": 0, "calories": 70, "unit": "piece", "source": "common"},
            {"name": "Chicken Breast", "protein": 31, "cholesterol": 85, "calories": 165, "unit": "100g", "source": "common"},
        ]
    
    def log_food(self, name: str, quantity: float, unit: str = "serving", 
                 notes: str = None) -> Optional[FoodEntry]:
        """Log a food entry"""
        # Search for food details
        foods = self.search_foods(name)
        if not foods:
            return None
        
        food_data = foods[0]
        entry = FoodEntry(
            name=name,
            protein=food_data["protein"],
            cholesterol=food_data["cholesterol"],
            calories=food_data["calories"],
            quantity=quantity,
            unit=unit,
            notes=notes
        )
        
        self.db.add_food_entry(entry)
        return entry
    
    def get_food_suggestions(self, limit: int = 10) -> List[dict]:
        """Get most frequently used foods"""
        custom_foods = self.db.get_custom_foods()
        
        # Sort by usage count
        sorted_foods = sorted(custom_foods, key=lambda x: x.usage_count, reverse=True)
        
        suggestions = []
        for food in sorted_foods[:limit]:
            suggestions.append({
                "name": food.name,
                "protein": food.protein_per_unit,
                "cholesterol": food.cholesterol_per_unit,
                "calories": food.calories_per_unit,
                "unit": food.default_unit,
                "usage_count": food.usage_count
            })
        
        # Add some common foods if not enough suggestions
        if len(suggestions) < 5:
            common = self._get_common_foods()
            for food in common:
                if not any(s["name"] == food["name"] for s in suggestions):
                    suggestions.append(food)
                    if len(suggestions) >= limit:
                        break
        
        return suggestions
