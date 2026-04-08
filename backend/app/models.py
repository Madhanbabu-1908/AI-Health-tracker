from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────────────────

class HealthGoal(str, Enum):
    LOSE_WEIGHT       = "lose_weight"
    MAINTAIN_WEIGHT   = "maintain_weight"
    GAIN_MUSCLE       = "gain_muscle"
    IMPROVE_ENDURANCE = "improve_endurance"
    LOWER_CHOLESTEROL = "lower_cholesterol"
    INCREASE_IRON     = "increase_iron"

class ActivityLevel(str, Enum):
    SEDENTARY  = "sedentary"
    LIGHT      = "light"
    MODERATE   = "moderate"
    ACTIVE     = "active"
    VERY_ACTIVE = "very_active"

class Gender(str, Enum):
    MALE   = "male"
    FEMALE = "female"
    OTHER  = "other"


# ─── User / Profile ───────────────────────────────────────────────────────────

class UserProfile(BaseModel):
    session_id:     str
    nickname:       str
    height:         float           # cm
    weight:         float           # kg
    bmi:            Optional[float] = None
    age:            int             = 25
    gender:         str             = "male"
    primary_goal:   Optional[str]   = None
    activity_level: Optional[str]   = None
    currency:       str             = "₹"
    created_at:     str             = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at:     str             = Field(default_factory=lambda: datetime.now().isoformat())


class ProfileSetupRequest(BaseModel):
    session_id:      str
    nickname:        str
    height:          float
    weight:          float
    age:             int
    gender:          str             = "male"
    primary_goal:    str             = "maintain_weight"
    activity_level:  str             = "moderate"
    secondary_goals: List[str]       = []
    currency:        str             = "₹"


# ─── Nutrition Goals ──────────────────────────────────────────────────────────

class PersonalizedNutritionGoals(BaseModel):
    session_id:       str
    protein_goal:     float
    calorie_goal:     float
    carb_goal:        float
    fat_goal:         float
    fiber_goal:       float
    cholesterol_limit: float
    iron_goal:        float
    calcium_goal:     float
    vitamin_d_goal:   float
    water_goal:       float          # litres
    explanation:      str


# ─── Food Models ──────────────────────────────────────────────────────────────

class FoodItem(BaseModel):
    id:                  str
    session_id:          str
    name:                str
    protein_per_unit:    float = 0
    carbs_per_unit:      float = 0
    fat_per_unit:        float = 0
    cholesterol_per_unit: float = 0
    iron_per_unit:       float = 0
    fiber_per_unit:      float = 0
    calories_per_unit:   float = 0
    cost_per_unit:       float = 0
    default_unit:        str   = "serving"
    usage_count:         int   = 0
    created_at:          str   = Field(default_factory=lambda: datetime.now().isoformat())


class FoodEntry(BaseModel):
    id:          str
    session_id:  str
    name:        str
    protein:     float = 0
    carbs:       float = 0
    fat:         float = 0
    cholesterol: float = 0
    iron:        float = 0
    fiber:       float = 0
    calories:    float = 0
    cost:        float = 0
    quantity:    float = 1.0
    unit:        str   = "serving"
    logged_at:   str   = Field(default_factory=lambda: datetime.now().isoformat())


class WaterLog(BaseModel):
    id:         str
    session_id: str
    amount_ml:  float
    logged_at:  str = Field(default_factory=lambda: datetime.now().isoformat())


# ─── AI / Chat ────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: str
    query:      str
    context:    Optional[Dict[str, Any]] = None


class NutritionPredictRequest(BaseModel):
    food_name:  str
    quantity:   Optional[float] = 100.0
    unit:       Optional[str]   = "g"


# ─── Response Helpers ─────────────────────────────────────────────────────────

class NutritionPrediction(BaseModel):
    protein:     float = 0
    carbs:       float = 0
    fat:         float = 0
    cholesterol: float = 0
    iron:        float = 0
    fiber:       float = 0
    calories:    float = 0
    source:      str   = "ai_prediction"
    confidence:  str   = "medium"
