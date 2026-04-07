import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from .models import UserProfile, FoodEntry, FoodItem, NutritionGoal

class Database:
    def __init__(self):
        self.data_path = "data/"
        os.makedirs(self.data_path, exist_ok=True)
        self._init_files()
    
    def _init_files(self):
        files = {
            "profile.json": None,
            "food_entries.json": {},
            "food_items.json": {},
            "nutrition_goals.json": {"protein_goal": 100, "cholesterol_limit": 300, "calorie_goal": 2500, "carb_limit": 300, "iron_goal": 15},
            "ai_cache.json": {}
        }
        for filename, default_data in files.items():
            filepath = os.path.join(self.data_path, filename)
            if not os.path.exists(filepath) and default_data is not None:
                with open(filepath, 'w') as f:
                    json.dump(default_data, f)
    
    def _read_json(self, filename):
        filepath = os.path.join(self.data_path, filename)
        with open(filepath, 'r') as f:
            return json.load(f)
    
    def _write_json(self, filename, data):
        filepath = os.path.join(self.data_path, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2, default=str)
    
    # Profile methods
    def get_profile(self) -> Optional[UserProfile]:
        data = self._read_json("profile.json")
        if data:
            return UserProfile(**data)
        return None
    
    def save_profile(self, profile: UserProfile):
        self._write_json("profile.json", profile.dict())
    
    def get_nutrition_goals(self) -> NutritionGoal:
        data = self._read_json("nutrition_goals.json")
        return NutritionGoal(**data)
    
    def update_nutrition_goals(self, goals: NutritionGoal):
        self._write_json("nutrition_goals.json", goals.dict())
    
    # Food entry methods
    def add_food_entry(self, entry: FoodEntry):
        entries = self._read_json("food_entries.json")
        date = entry.timestamp.strftime("%Y-%m-%d")
        
        if date not in entries:
            entries[date] = []
        
        entries[date].append(entry.dict())
        self._write_json("food_entries.json", entries)
        
        # Update usage count for food item
        self._update_food_usage(entry.name)
    
    def get_entries_by_date_range(self, start_date: str, end_date: str) -> Dict:
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
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        return self.get_entries_by_date_range(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
    
    def delete_entries_older_than(self, days: int = 30):
        entries = self._read_json("food_entries.json")
        cutoff = datetime.now() - timedelta(days=days)
        
        to_delete = []
        for date_str in entries.keys():
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            if date_obj < cutoff:
                to_delete.append(date_str)
        
        for date_str in to_delete:
            del entries[date_str]
        
        self._write_json("food_entries.json", entries)
        return to_delete
    
    # Food items methods
    def get_food_items(self) -> List[FoodItem]:
        items = self._read_json("food_items.json")
        return [FoodItem(**item) for item in items.values()]
    
    def get_food_item(self, name: str) -> Optional[FoodItem]:
        items = self._read_json("food_items.json")
        for item_id, item in items.items():
            if item["name"].lower() == name.lower():
                return FoodItem(**item)
        return None
    
    def add_food_item(self, item: FoodItem):
        items = self._read_json("food_items.json")
        items[item.id] = item.dict()
        self._write_json("food_items.json", items)
    
    def _update_food_usage(self, food_name: str):
        items = self._read_json("food_items.json")
        for item_id, item in items.items():
            if item["name"].lower() == food_name.lower():
                item["usage_count"] = item.get("usage_count", 0) + 1
                self._write_json("food_items.json", items)
                break
    
    # AI Cache methods
    def get_cached_ai_response(self, query: str) -> Optional[str]:
        cache = self._read_json("ai_cache.json")
        query_hash = str(hash(query.lower().strip()))
        if query_hash in cache:
            return cache[query_hash]
        return None
    
    def cache_ai_response(self, query: str, response: str):
        cache = self._read_json("ai_cache.json")
        query_hash = str(hash(query.lower().strip()))
        cache[query_hash] = {
            "query": query,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }
        # Keep only last 1000 responses
        if len(cache) > 1000:
            oldest_key = min(cache.keys(), key=lambda k: cache[k]["timestamp"])
            del cache[oldest_key]
        self._write_json("ai_cache.json", cache)
