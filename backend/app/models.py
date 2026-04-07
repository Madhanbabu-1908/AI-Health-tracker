from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict
from enum import Enum

# ========== Enums for Goals ==========

class HealthGoal(str, Enum):
    LOSE_WEIGHT = "lose_weight"
    MAINTAIN_WEIGHT = "maintain_weight" 
    GAIN_MUSCLE = "gain_muscle"
    IMPROVE_ENDURANCE = "improve_endurance"
    LOWER_CHOLESTEROL = "lower_cholesterol"
    INCREASE_IRON = "increase_iron"

class ActivityLevel(str, Enum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"
    VERY_ACTIVE = "very_active"

# ========== User Models ==========

class UserProfile(BaseModel):
    nickname: str
    height: float  # cm
    weight: float  # kg
    bmi: Optional[float] = None
    age: int = 30
    gender: str = "male"
    primary_goal: Optional[str] = None
    activity_level: Optional[str] = None
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

class UserGoals(BaseModel):
    primary_goal: HealthGoal
    secondary_goals: Optional[List[HealthGoal]] = []
    activity_level: ActivityLevel
    target_weight: Optional[float] = None
    target_date: Optional[str] = None
    weekly_weight_change: float = 0.5

# ========== Nutrition Models ==========

class NutritionGoal(BaseModel):
    """Simple nutrition goals for database storage"""
    protein_goal: float = 100
    calorie_goal: float = 2500
    cholesterol_limit: float = 300

class PersonalizedNutritionGoals(BaseModel):
    protein_goal: float
    calorie_goal: float
    carb_goal: float
    fat_goal: float
    fiber_goal: float
    cholesterol_limit: float
    iron_goal: float
    calcium_goal: float
    vitamin_d_goal: float
    water_goal: float
    explanation: str

# ========== Food Models ==========

class FoodEntry(BaseModel):
    id: Optional[str] = None
    name: str
    protein: float
    carbs: float = 0
    cholesterol: float = 0
    iron: float = 0
    calories: float = 0
    cost: float = 0
    quantity: float = 1.0
    unit: str = "serving"
    timestamp: datetime = datetime.now()

class FoodItem(BaseModel):
    id: str
    name: str
    protein_per_unit: float
    carbs_per_unit: float = 0
    cholesterol_per_unit: float = 0
    iron_per_unit: float = 0
    calories_per_unit: float = 0
    cost: float = 0
    default_unit: str = "serving"
    usage_count: int = 0
    created_at: datetime = datetime.now()

# ========== AI Models ==========

class AIRequest(BaseModel):
    query: str
    context: Optional[Dict] = None
