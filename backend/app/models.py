from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict

class UserProfile(BaseModel):
    nickname: str
    height: float  # cm
    weight: float  # kg
    bmi: Optional[float] = None
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

class FoodEntry(BaseModel):
    id: str
    name: str
    protein: float  # grams
    carbs: float  # grams
    cholesterol: float  # mg
    iron: float  # mg
    calories: float
    cost: float  # in local currency
    quantity: float = 1.0
    unit: str = "serving"
    timestamp: datetime = datetime.now()

class FoodItem(BaseModel):
    id: str
    name: str
    protein: float
    carbs: float
    cholesterol: float
    iron: float
    calories: float
    cost: float
    default_unit: str = "serving"
    usage_count: int = 0
    created_at: datetime = datetime.now()

class NutritionGoal(BaseModel):
    protein_goal: float = 100
    cholesterol_limit: float = 300
    calorie_goal: float = 2500
    carb_limit: float = 300
    iron_goal: float = 15

class AIRequest(BaseModel):
    query: str
    context: Optional[Dict] = None

class DateRange(BaseModel):
    start_date: str
    end_date: str
