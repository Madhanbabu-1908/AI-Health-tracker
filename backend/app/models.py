from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, Any

class FoodEntry(BaseModel):
    id: Optional[str] = None
    name: str
    protein: float = Field(ge=0)
    cholesterol: float = Field(ge=0)
    calories: float = Field(ge=0)
    quantity: float = Field(default=1.0, ge=0.1)
    unit: str = "serving"
    timestamp: datetime = Field(default_factory=datetime.now)
    notes: Optional[str] = None

class CustomFood(BaseModel):
    id: str
    name: str
    protein_per_unit: float
    cholesterol_per_unit: float
    calories_per_unit: float
    default_unit: str = "serving"
    created_at: datetime = Field(default_factory=datetime.now)
    last_used: Optional[datetime] = None
    usage_count: int = 0

class HealthProfile(BaseModel):
    weight: float = 70.0
    height: float = 175.0
    age: int = 25
    goal_protein: float = 100.0
    cholesterol_limit: float = 300.0
    calorie_goal: float = 2500.0
    activity_level: str = "moderate"  # sedentary, light, moderate, active, very_active

class AIRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None

class DailyTotals(BaseModel):
    date: str
    protein: float = 0
    cholesterol: float = 0
    calories: float = 0
    entries: List[FoodEntry] = []

class AIPrediction(BaseModel):
    recommendation: str
    predicted_impact: Dict[str, float]
    suggested_meals: List[str]
    confidence_score: float = 0.8
