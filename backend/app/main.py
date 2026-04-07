from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import UserProfile, FoodEntry, AIRequest, HealthGoal, ActivityLevel, PersonalizedNutritionGoals
from .database import Database
from .orchestrator import AgenticOrchestrator
from .goal_calculator import GoalCalculator
from .models import UserGoals
from datetime import datetime
import uuid

app = FastAPI(title="Madhan Health Tracker API")
orchestrator = AgenticOrchestrator()
db = Database()
goal_calculator = GoalCalculator()

# Enable CORS for frontend and mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Health Check ==========

@app.get("/")
async def root():
    return {"message": "Madhan Health Tracker API", "status": "active", "version": "3.0"}

# ========== User Profile & Goals ==========

@app.post("/user/setup-goals")
async def setup_user_goals(
    nickname: str,
    height: float,
    weight: float,
    age: int,
    gender: str,
    primary_goal: HealthGoal,
    activity_level: ActivityLevel,
    secondary_goals: str = "",
    target_weight: float = None,
    weekly_weight_change: float = 0.5
):
    """Initialize user with health goals and get personalized nutrition targets"""
    
    # Parse secondary goals
    secondary_list = []
    if secondary_goals:
        for goal in secondary_goals.split(","):
            try:
                secondary_list.append(HealthGoal(goal.strip()))
            except ValueError:
                pass
    
    # Create user goals object
    user_goals = UserGoals(
        primary_goal=primary_goal,
        secondary_goals=secondary_list,
        activity_level=activity_level,
        target_weight=target_weight,
        weekly_weight_change=weekly_weight_change if primary_goal in [HealthGoal.LOSE_WEIGHT, HealthGoal.GAIN_MUSCLE] else 0
    )
    
    # Calculate personalized nutrition goals
    nutrition_goals = GoalCalculator.calculate_nutrition_goals(
        weight_kg=weight,
        height_cm=height,
        age=age,
        gender=gender,
        user_goals=user_goals
    )
    
    # Calculate BMI
    bmi = weight / ((height / 100) ** 2) 
    
    # Save profile
    profile = UserProfile(
        nickname=nickname,
        height=height,
        weight=weight,
        bmi=bmi,
        age=age,
        gender=gender,
        primary_goal=primary_goal.value,
        activity_level=activity_level.value
    )
    db.save_profile(profile)
    
    # Save nutrition goals
    db.update_nutrition_goals(nutrition_goals)
    
    # Save user goals separately
    db._write_json("user_goals.json", user_goals.dict())
    
    # Get BMI category
    bmi_category = "Normal weight"
    if bmi < 18.5:
        bmi_category = "Underweight"
    elif bmi < 25:
        bmi_category = "Normal weight"
    elif bmi < 30:
        bmi_category = "Overweight"
    else:
        bmi_category = "Obese"
    
    return {
        "success": True,
        "profile": profile.dict(),
        "nutrition_goals": nutrition_goals.dict(),
        "bmi": round(bmi, 1),
        "bmi_category": bmi_category,
        "message": nutrition_goals.explanation
    }

@app.get("/profile")
async def get_profile():
    """Get user profile"""
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Please setup goals first.")
    return profile.dict()

@app.get("/nutrition-goals")
async def get_nutrition_goals():
    """Get personalized nutrition goals"""
    goals = db.get_nutrition_goals()
    return goals.dict()

@app.post("/nutrition-goals")
async def update_nutrition_goals(goals: PersonalizedNutritionGoals):
    """Update nutrition goals manually"""
    db.update_nutrition_goals(goals)
    return {"success": True}

@app.get("/user/goals")
async def get_user_goals():
    """Get current user goals and nutrition targets"""
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    nutrition_goals = db.get_nutrition_goals()
    user_goals = db._read_json("user_goals.json")
    
    return {
        "profile": profile.dict(),
        "nutrition_goals": nutrition_goals.dict(),
        "health_goals": user_goals
    }

@app.post("/user/update-goals")
async def update_user_goals(
    primary_goal: HealthGoal = None,
    activity_level: ActivityLevel = None,
    target_weight: float = None
):
    """Update user goals and recalculate nutrition targets"""
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    user_goals_data = db._read_json("user_goals.json")
    user_goals = UserGoals(**user_goals_data)
    
    # Update goals if provided
    if primary_goal:
        user_goals.primary_goal = primary_goal
    if activity_level:
        user_goals.activity_level = activity_level
    if target_weight:
        user_goals.target_weight = target_weight
    
    # Recalculate nutrition goals
    nutrition_goals = GoalCalculator.calculate_nutrition_goals(
        weight_kg=profile.weight,
        height_cm=profile.height,
        age=profile.age,
        gender=profile.gender,
        user_goals=user_goals
    )
    
    # Save updated goals
    db.update_nutrition_goals(nutrition_goals)
    db._write_json("user_goals.json", user_goals.dict())
    
    return {
        "success": True,
        "nutrition_goals": nutrition_goals.dict(),
        "health_goals": user_goals.dict(),
        "message": nutrition_goals.explanation
    }

# ========== Food Management ==========

@app.post("/food/add")
async def add_food(name: str, cost: float, unit: str = "serving"):
    """Add new food with AI-predicted nutrition"""
    result = await orchestrator.add_new_food(name, cost, unit)
    return result

@app.get("/food/list")
async def list_foods():
    """Get all available foods"""
    foods = db.get_food_items()
    return {"foods": [f.dict() for f in foods]}

@app.post("/food/log")
async def log_food(name: str, quantity: float = 1.0, unit: str = "serving", cost: float = None):
    """Log a food entry"""
    result = await orchestrator.log_food(name, quantity, unit, cost)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.get("/today")
async def get_today():
    """Get today's totals"""
    totals = db.get_today_totals()
    goals = db.get_nutrition_goals()
    
    # Calculate percentages
    return {
        "totals": totals,
        "percentages": {
            "protein": round((totals["protein"] / goals.protein_goal) * 100, 1) if goals.protein_goal > 0 else 0,
            "calories": round((totals["calories"] / goals.calorie_goal) * 100, 1) if goals.calorie_goal > 0 else 0,
            "cholesterol": round((totals["cholesterol"] / goals.cholesterol_limit) * 100, 1) if goals.cholesterol_limit > 0 else 0,
            "iron": round((totals["iron"] / goals.iron_goal) * 100, 1) if goals.iron_goal > 0 else 0
        }
    }

# ========== Analytics ==========

@app.get("/nutrition/analysis")
async def get_nutrition_analysis(date_range: str = "week"):
    """Get nutrition analysis for date range (week, weeks, weeks3, month)"""
    return await orchestrator.get_nutrition_analysis(date_range)

@app.post("/report/generate")
async def generate_report(start_date: str, end_date: str):
    """Generate CSV report and auto-delete old data"""
    result = await orchestrator.generate_report(start_date, end_date)
    return result

# ========== AI Features ==========

@app.post("/ai/chat")
async def ai_chat(request: AIRequest):
    """AI chat with personalized context"""
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=400, detail="Please setup your goals first")
    
    goals = db.get_nutrition_goals()
    today_totals = db.get_today_totals()
    
    context = {
        "profile": profile.dict(),
        "today": today_totals,
        "goals": goals.dict()
    }
    
    result = await orchestrator.process_ai_query(request.query, context)
    return result

@app.get("/ai/token-usage")
async def get_token_usage():
    """Get current token usage across all AI models"""
    usage = orchestrator.ai_agent.get_token_usage_summary()
    return usage

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
