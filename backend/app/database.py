import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from .models import FoodEntry, HealthProfile, CustomFood, DailyTotals

class Database:
    def __init__(self, data_path: str = "data/"):
        self.data_path = data_path
        os.makedirs(data_path, exist_ok=True)
        
        # Initialize files if they don't exist
        self._init_file("history.json", {})
        self._init_file("profile.json", HealthProfile().dict())
        self._init_file("custom_foods.json", {})
    
    def _init_file(self, filename: str, default_data: dict):
        """Initialize file with default data if not exists"""
        filepath = os.path.join(self.data_path, filename)
        if not os.path.exists(filepath):
            with open(filepath, 'w') as f:
                json.dump(default_data, f, indent=2, default=str)
    
    def _read_json(self, filename: str) -> dict:
        """Read JSON file"""
        filepath = os.path.join(self.data_path, filename)
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _write_json(self, filename: str, data: dict):
        """Write JSON file"""
        filepath = os.path.join(self.data_path, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    # Food Entry Methods
    def add_food_entry(self, entry: FoodEntry) -> bool:
        """Add a food entry to history"""
        history = self._read_json("history.json")
        date = entry.timestamp.strftime("%Y-%m-%d")
        
        if date not in history:
            history[date] = {
                "entries": [],
                "totals": {"protein": 0, "cholesterol": 0, "calories": 0}
            }
        
        entry_dict = entry.dict()
        entry_dict["id"] = entry.id or datetime.now().strftime("%Y%m%d%H%M%S%f")
        
        # Calculate actual values based on quantity
        actual_protein = entry.protein * entry.quantity
        actual_cholesterol = entry.cholesterol * entry.quantity
        actual_calories = entry.calories * entry.quantity
        
        entry_dict["actual_protein"] = actual_protein
        entry_dict["actual_cholesterol"] = actual_cholesterol
        entry_dict["actual_calories"] = actual_calories
        
        history[date]["entries"].append(entry_dict)
        history[date]["totals"]["protein"] += actual_protein
        history[date]["totals"]["cholesterol"] += actual_cholesterol
        history[date]["totals"]["calories"] += actual_calories
        
        self._write_json("history.json", history)
        
        # Update last used for custom food
        self._update_food_usage(entry.name)
        
        return True
    
    def get_history(self, days: int = 7) -> Dict[str, DailyTotals]:
        """Get history for last N days"""
        history = self._read_json("history.json")
        cutoff = datetime.now() - timedelta(days=days)
        
        result = {}
        for date, data in history.items():
            if datetime.strptime(date, "%Y-%m-%d") >= cutoff:
                totals = DailyTotals(
                    date=date,
                    protein=data["totals"]["protein"],
                    cholesterol=data["totals"]["cholesterol"],
                    calories=data["totals"]["calories"],
                    entries=[FoodEntry(**entry) for entry in data["entries"]]
                )
                result[date] = totals
        
        return result
    
    def get_today(self) -> DailyTotals:
        """Get today's totals"""
        today = datetime.now().strftime("%Y-%m-%d")
        history = self._read_json("history.json")
        
        if today in history:
            data = history[today]
            return DailyTotals(
                date=today,
                protein=data["totals"]["protein"],
                cholesterol=data["totals"]["cholesterol"],
                calories=data["totals"]["calories"],
                entries=[FoodEntry(**entry) for entry in data["entries"]]
            )
        
        return DailyTotals(date=today, protein=0, cholesterol=0, calories=0, entries=[])
    
    # Profile Methods
    def get_profile(self) -> HealthProfile:
        """Get user profile"""
        profile_data = self._read_json("profile.json")
        return HealthProfile(**profile_data)
    
    def update_profile(self, profile: HealthProfile) -> bool:
        """Update user profile"""
        self._write_json("profile.json", profile.dict())
        return True
    
    # Custom Food Methods
    def add_custom_food(self, food: CustomFood) -> bool:
        """Add a custom food to database"""
        foods = self._read_json("custom_foods.json")
        foods[food.id] = food.dict()
        self._write_json("custom_foods.json", foods)
        return True
    
    def get_custom_foods(self) -> List[CustomFood]:
        """Get all custom foods"""
        foods = self._read_json("custom_foods.json")
        return [CustomFood(**data) for data in foods.values()]
    
    def get_custom_food(self, name: str) -> Optional[CustomFood]:
        """Get custom food by name"""
        foods = self._read_json("custom_foods.json")
        for food_id, food_data in foods.items():
            if food_data["name"].lower() == name.lower():
                return CustomFood(**food_data)
        return None
    
    def _update_food_usage(self, food_name: str):
        """Update usage count and last used timestamp for custom food"""
        foods = self._read_json("custom_foods.json")
        for food_id, food_data in foods.items():
            if food_data["name"].lower() == food_name.lower():
                food_data["last_used"] = datetime.now()
                food_data["usage_count"] = food_data.get("usage_count", 0) + 1
                self._write_json("custom_foods.json", foods)
                break
    
    def delete_custom_food(self, food_id: str) -> bool:
        """Delete a custom food"""
        foods = self._read_json("custom_foods.json")
        if food_id in foods:
            del foods[food_id]
            self._write_json("custom_foods.json", foods)
            return True
        return False
