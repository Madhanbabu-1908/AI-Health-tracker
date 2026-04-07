import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from .models import UserProfile, FoodEntry, FoodItem, NutritionGoal, PersonalizedNutritionGoals

class Database:
    def __init__(self):
        self.data_path = "data/"
        os.makedirs(self.data_path, exist_ok=True)
        self._init_files()
    
    def _init_files(self):
        """Initialize all data files with default content if they don't exist"""
        files = {
            "profile.json": {
                "nickname": "", 
                "height": 0, 
                "weight": 0, 
                "bmi": None, 
                "age": 30,
                "gender": "male",
                "primary_goal": None,
                "activity_level": None,
                "created_at": "2026-04-07T00:00:00", 
                "updated_at": "2026-04-07T00:00:00"
            },
            "food_entries.json": {},
            "food_items.json": {},
            "nutrition_goals.json": {
                "protein_goal": 100, 
                "cholesterol_limit": 300, 
                "calorie_goal": 2500, 
                "carb_limit": 300, 
                "iron_goal": 15,
                "fat_goal": 70,
                "fiber_goal": 25,
                "calcium_goal": 1000,
                "vitamin_d_goal": 600,
                "water_goal": 2.5,
                "explanation": "Default goals - please setup your profile for personalized goals"
            },
            "user_goals.json": {
                "primary_goal": "maintain_weight",
                "secondary_goals": [],
                "activity_level": "moderate",
                "target_weight": None,
                "weekly_weight_change": 0.5
            },
            "ai_cache.json": {}
        }
        
        for filename, default_data in files.items():
            filepath = os.path.join(self.data_path, filename)
            if not os.path.exists(filepath):
                with open(filepath, 'w') as f:
                    json.dump(default_data, f, indent=2)
    
    def _read_json(self, filename: str) -> dict:
        """Read data from a JSON file"""
        filepath = os.path.join(self.data_path, filename)
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}
    
    def _write_json(self, filename: str, data: dict):
        """Write data to a JSON file"""
        filepath = os.path.join(self.data_path, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    # ========== Profile Methods ==========
    
    def get_profile(self) -> Optional[UserProfile]:
        """Get user profile"""
        data = self._read_json("profile.json")
        if data and data.get("nickname"):
            return UserProfile(**data)
        return None
    
    def save_profile(self, profile: UserProfile):
        """Save user profile"""
        self._write_json("profile.json", profile.dict())
    
    def get_nutrition_goals(self) -> PersonalizedNutritionGoals:
        """Get personalized nutrition goals"""
        data = self._read_json("nutrition_goals.json")
        return PersonalizedNutritionGoals(**data)
    
    def update_nutrition_goals(self, goals: PersonalizedNutritionGoals):
        """Update nutrition goals"""
        self._write_json("nutrition_goals.json", goals.dict())
    
    # ========== Food Entry Methods ==========
    
    def add_food_entry(self, entry: FoodEntry):
        """Add a food entry to history"""
        entries = self._read_json("food_entries.json")
        date = entry.timestamp.strftime("%Y-%m-%d")
        
        if date not in entries:
            entries[date] = []
        
        entries[date].append(entry.dict())
        self._write_json("food_entries.json", entries)
        
        # Update usage count for food item
        self._update_food_usage(entry.name)
    
    def get_entries_by_date_range(self, start_date: str, end_date: str) -> Dict:
        """Get food entries for a date range"""
        entries = self._read_json("food_entries.json")
        result = {}
        
        current = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            if date_str in entries:
                result[date_str] = entries[date_str]
            current += timedelta(days=1)
        
        return result
    
    def get_last_n_days_entries(self, days: int = 30) -> Dict:
        """Get entries from last N days"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        return self.get_entries_by_date_range(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
    
    def get_today_totals(self) -> Dict:
        """Get today's totals"""
        today = datetime.now().strftime("%Y-%m-%d")
        entries = self.get_entries_by_date_range(today, today)
        
        totals = {
            "protein": 0, "carbs": 0, "cholesterol": 0, 
            "iron": 0, "calories": 0, "cost": 0
        }
        
        for daily_entries in entries.values():
            for entry in daily_entries:
                totals["protein"] += entry.get("protein", 0)
                totals["carbs"] += entry.get("carbs", 0)
                totals["cholesterol"] += entry.get("cholesterol", 0)
                totals["iron"] += entry.get("iron", 0)
                totals["calories"] += entry.get("calories", 0)
                totals["cost"] += entry.get("cost", 0)
        
        return totals
    
    def delete_entries_older_than(self, days: int = 30):
        """Delete entries older than specified days"""
        entries = self._read_json("food_entries.json")
        cutoff = datetime.now() - timedelta(days=days)
        
        to_delete = []
        for date_str in entries.keys():
            try:
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                if date_obj < cutoff:
                    to_delete.append(date_str)
            except ValueError:
                pass
        
        for date_str in to_delete:
            del entries[date_str]
        
        self._write_json("food_entries.json", entries)
        return to_delete
    
    # ========== Food Items Methods ==========
    
    def get_food_items(self) -> List[FoodItem]:
        """Get all custom food items"""
        items = self._read_json("food_items.json")
        return [FoodItem(**item) for item in items.values()]
    
    def get_food_item(self, name: str) -> Optional[FoodItem]:
        """Get food item by name"""
        items = self._read_json("food_items.json")
        for item_id, item in items.items():
            if item["name"].lower() == name.lower():
                return FoodItem(**item)
        return None
    
    def add_food_item(self, item: FoodItem):
        """Add a new food item"""
        items = self._read_json("food_items.json")
        items[item.id] = item.dict()
        self._write_json("food_items.json", items)
    
    def _update_food_usage(self, food_name: str):
        """Update usage count for a food item"""
        items = self._read_json("food_items.json")
        for item_id, item in items.items():
            if item["name"].lower() == food_name.lower():
                item["usage_count"] = item.get("usage_count", 0) + 1
                self._write_json("food_items.json", items)
                break
    
    # ========== AI Cache Methods ==========
    
    def get_cached_ai_response(self, query: str) -> Optional[str]:
        """Get cached AI response for a query"""
        cache = self._read_json("ai_cache.json")
        query_hash = str(hash(query.lower().strip()))
        if query_hash in cache:
            return cache[query_hash].get("response")
        return None
    
    def cache_ai_response(self, query: str, response: str):
        """Cache an AI response"""
        cache = self._read_json("ai_cache.json")
        query_hash = str(hash(query.lower().strip()))
        cache[query_hash] = {
            "query": query,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
        
        # Keep only last 500 responses
        if len(cache) > 500:
            oldest_key = min(cache.keys(), key=lambda k: cache[k]["timestamp"])
            del cache[oldest_key]
        
        self._write_json("ai_cache.json", cache)
