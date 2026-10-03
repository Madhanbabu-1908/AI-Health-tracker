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


# ─── Health Connect Models ────────────────────────────────────────────────────

class HealthMetric(BaseModel):
    """Normalized health metric from any provider."""
    provider:    str                      # e.g. "health_connect"
    source:      Optional[str]  = None    # e.g. "fitbit", "samsung_health"
    device:      Optional[str]  = None    # e.g. "fitbit_air"
    metric_type: str                      # e.g. "steps", "heart_rate"
    value:       Optional[float] = None
    unit:        Optional[str]  = None
    start_time:  str
    end_time:    Optional[str]  = None
    source_id:   Optional[str]  = None    # deduplication key from HC
    metadata:    Optional[Dict[str, Any]] = None


class SleepSession(BaseModel):
    provider:              str
    source:                Optional[str]  = None
    device:                Optional[str]  = None
    start_time:            str
    end_time:              str
    duration_minutes:      Optional[float] = None
    awake_minutes:         Optional[float] = None
    light_sleep_minutes:   Optional[float] = None
    deep_sleep_minutes:    Optional[float] = None
    rem_sleep_minutes:     Optional[float] = None
    source_id:             Optional[str]  = None


class Workout(BaseModel):
    provider:         str
    source:           Optional[str]  = None
    device:           Optional[str]  = None
    exercise_type:    Optional[str]  = None
    start_time:       str
    end_time:         str
    duration_minutes: Optional[float] = None
    active_calories:  Optional[float] = None
    distance_km:      Optional[float] = None
    avg_heart_rate:   Optional[float] = None
    source_id:        Optional[str]  = None


class DailyHealthSummary(BaseModel):
    date:                    str
    steps:                   Optional[float] = None
    distance_km:             Optional[float] = None
    active_calories:         Optional[float] = None
    total_calories:          Optional[float] = None
    active_minutes:          Optional[float] = None
    resting_heart_rate:      Optional[float] = None
    average_heart_rate:      Optional[float] = None
    hrv:                     Optional[float] = None
    oxygen_saturation:       Optional[float] = None
    respiratory_rate:        Optional[float] = None
    sleep_duration_minutes:  Optional[float] = None
    vo2_max:                 Optional[float] = None
    skin_temperature:        Optional[float] = None


class HealthSyncRequest(BaseModel):
    session_id:  str
    provider:    str = "health_connect"
    metrics:     List[HealthMetric]       = []
    sleep:       List[SleepSession]       = []
    workouts:    List[Workout]            = []
    sync_time:   Optional[str]            = None  # ISO timestamp of this sync


class HealthSyncState(BaseModel):
    session_id:          str
    provider:            str
    last_sync_at:        Optional[str] = None
    last_sync_status:    str           = "never"
    permissions_granted: Optional[str] = None  # JSON list of granted permissions
