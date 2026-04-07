import uuid
from datetime import datetime
from typing import List, Optional, Dict
from .database import Database
from .models import FoodItem, FoodEntry

class FoodService:
    def __init__(self, db: Database):
        self.db = db
    
    def get_all_foods(self) -> List[Dict]:
        """Get all available foods"""
        foods = self.db.get_food_items()
        return [food.dict() for food in foods]
    
    def search_foods(self, query: str) -> List[Dict]:
        """Search foods by name"""
        foods = self.db.get_food_items()
        results = []
        query_lower = query.lower()
        
        for food in foods:
            if query_lower in food.name.lower():
                results.append(food.dict())
        
        return results
    
    def get_food_by_name(self, name: str) -> Optional[Dict]:
        """Get food by exact name"""
        food = self.db.get_food_item(name)
        return food.dict() if food else None
    
    def get_most_used_foods(self, limit: int = 10) -> List[Dict]:
        """Get most frequently used foods"""
        foods = self.db.get_food_items()
        sorted_foods = sorted(foods, key=lambda x: x.usage_count, reverse=True)
        return [food.dict() for food in sorted_foods[:limit]]
    
    def get_today_summary(self) -> Dict:
        """Get today's nutrition and cost summary"""
        today = datetime.now().strftime("%Y-%m-%d")
        entries = self.db.get_entries_by_date_range(today, today)
        
        summary = {
            "protein": 0, "carbs": 0, "cholesterol": 0, 
            "iron": 0, "calories": 0, "cost": 0
        }
        
        for daily_entries in entries.values():
            for entry in daily_entries:
                summary["protein"] += entry.get("protein", 0)
                summary["carbs"] += entry.get("carbs", 0)
                summary["cholesterol"] += entry.get("cholesterol", 0)
                summary["iron"] += entry.get("iron", 0)
                summary["calories"] += entry.get("calories", 0)
                summary["cost"] += entry.get("cost", 0)
        
        return summary
    
    def get_weekly_summary(self) -> Dict:
        """Get last 7 days summary"""
        entries = self.db.get_last_n_days_entries(7)
        daily_data = []
        
        for date, daily_entries in entries.items():
            day_summary = {"date": date, "protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
            for entry in daily_entries:
                day_summary["protein"] += entry.get("protein", 0)
                day_summary["carbs"] += entry.get("carbs", 0)
                day_summary["cholesterol"] += entry.get("cholesterol", 0)
                day_summary["iron"] += entry.get("iron", 0)
                day_summary["calories"] += entry.get("calories", 0)
                day_summary["cost"] += entry.get("cost", 0)
            daily_data.append(day_summary)
        
        return {"daily_data": daily_data, "days": len(daily_data)}
