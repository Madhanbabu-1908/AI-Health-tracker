from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from datetime import datetime, timedelta
import json
import os
import uuid
import re

# Import your existing modules
from .models import UserProfile, FoodEntry, AIRequest, HealthGoal, ActivityLevel, PersonalizedNutritionGoals
from .database import Database
from .orchestrator import AgenticOrchestrator
from .goal_calculator import GoalCalculator
from .ai_agent import AIHealthAgent
from .mcp_tools import MCPTools

app = FastAPI(title="AI Health Tracker API with MCP")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
db = Database()
orchestrator = AgenticOrchestrator()
ai_agent = AIHealthAgent()
mcp = MCPTools()
goal_calculator = GoalCalculator()

# ========== Helper Functions ==========

def calculate_bmi(height_cm, weight_kg):
    if height_cm <= 0 or weight_kg <= 0:
        return 0
    height_m = height_cm / 100
    bmi = weight_kg / (height_m * height_m)
    return round(bmi, 1)

def calculate_protein_goal(weight_kg, primary_goal):
    if primary_goal == "lose_weight":
        return round(weight_kg * 1.6, 0)
    elif primary_goal == "gain_muscle":
        return round(weight_kg * 1.8, 0)
    else:
        return round(weight_kg * 1.2, 0)

def calculate_calorie_goal(weight_kg, height_cm, age, gender, activity_level, primary_goal):
    if gender == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    
    activity_mult = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }.get(activity_level, 1.55)
    
    tdee = bmr * activity_mult
    
    if primary_goal == "lose_weight":
        return round(tdee - 500, 0)
    elif primary_goal == "gain_muscle":
        return round(tdee + 300, 0)
    else:
        return round(tdee, 0)

# ========== API Endpoints ==========

@app.get("/")
async def root():
    return {"message": "AI Health Tracker API with MCP", "status": "active", "version": "3.0"}

@app.post("/user/setup-goals")
async def setup_user_goals(request: Request):
    try:
        body = await request.json()
        
        nickname = body.get("nickname")
        height = float(body.get("height", 0))
        weight = float(body.get("weight", 0))
        age = int(body.get("age", 0))
        gender = body.get("gender", "male")
        primary_goal = body.get("primary_goal", "maintain_weight")
        activity_level = body.get("activity_level", "moderate")
        
        if not nickname:
            return {"success": False, "message": "Nickname is required"}
        
        bmi = calculate_bmi(height, weight)
        protein_goal = calculate_protein_goal(weight, primary_goal)
        calorie_goal = calculate_calorie_goal(weight, height, age, gender, activity_level, primary_goal)
        
        profile = {
            "nickname": nickname,
            "height": height,
            "weight": weight,
            "bmi": bmi,
            "age": age,
            "gender": gender,
            "primary_goal": primary_goal,
            "activity_level": activity_level,
            "created_at": datetime.now().isoformat()
        }
        
        # Save using database
        db.save_profile(UserProfile(**profile))
        
        nutrition_goals = {
            "protein_goal": protein_goal,
            "calorie_goal": calorie_goal,
            "cholesterol_limit": 300,
            "carb_goal": round(weight * 4, 0),
            "fat_goal": round(weight * 0.8, 0),
            "iron_goal": 15
        }
        db.update_nutrition_goals(PersonalizedNutritionGoals(**nutrition_goals))
        
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
            "profile": profile,
            "nutrition_goals": nutrition_goals,
            "bmi": bmi,
            "bmi_category": bmi_category,
            "message": f"Welcome {nickname}! Your BMI is {bmi} ({bmi_category})."
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {"success": False, "message": str(e)}

@app.get("/profile")
async def get_profile():
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile.dict()

@app.get("/nutrition-goals")
async def get_nutrition_goals():
    goals = db.get_nutrition_goals()
    return goals.dict()

@app.delete("/reset-all-data")
async def reset_all_data():
    """Delete ALL user data using database methods"""
    try:
        # Clear using database methods
        db.save_profile(None)
        db.update_nutrition_goals(PersonalizedNutritionGoals(
            protein_goal=100, calorie_goal=2500, cholesterol_limit=300,
            carb_goal=250, fat_goal=60, iron_goal=15, fiber_goal=25,
            water_goal=2.5, calcium_goal=1000, vitamin_d_goal=600,
            explanation="Default goals"
        ))
        return {"success": True, "message": "All data reset successfully"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/ai/predict-nutrition")
async def predict_nutrition(food_name: str):
    """Use MCP tools to search for nutrition info"""
    result = await mcp.get_nutrition_from_api(food_name)
    return {"success": True, "nutrition": result}

@app.get("/food/list")
async def list_foods():
    foods = db.get_food_items()
    return {"foods": [f.dict() for f in foods]}

@app.post("/food/add")
async def add_food(
    name: str,
    cost: float,
    protein: float = 0,
    carbs: float = 0,
    cholesterol: float = 0,
    iron: float = 0,
    calories: float = 0,
    unit: str = "serving"
):
    from .models import FoodItem
    food_id = str(uuid.uuid4())[:8]
    new_food = FoodItem(
        id=food_id,
        name=name,
        protein_per_unit=protein,
        carbs_per_unit=carbs,
        cholesterol_per_unit=cholesterol,
        iron_per_unit=iron,
        calories_per_unit=calories,
        cost=cost,
        default_unit=unit
    )
    db.add_food_item(new_food)
    return {"success": True, "food": new_food.dict(), "message": f"Added {name}"}

@app.post("/food/log")
async def log_food(name: str, quantity: float = 1.0):
    from .models import FoodEntry
    foods = db.get_food_items()
    
    food_item = None
    for item in foods:
        if item.name.lower() == name.lower():
            food_item = item
            break
    
    if not food_item:
        raise HTTPException(status_code=404, detail=f"Food '{name}' not found")
    
    entry = FoodEntry(
        id=str(uuid.uuid4())[:8],
        name=food_item.name,
        protein=food_item.protein_per_unit * quantity,
        carbs=food_item.carbs_per_unit * quantity,
        cholesterol=food_item.cholesterol_per_unit * quantity,
        iron=food_item.iron_per_unit * quantity,
        calories=food_item.calories_per_unit * quantity,
        cost=food_item.cost * quantity,
        quantity=quantity,
        unit=food_item.default_unit
    )
    db.add_food_entry(entry)
    
    return {"success": True, "message": f"Logged {quantity} × {food_item.name}"}

@app.get("/today")
async def get_today():
    totals = db.get_today_totals()
    goals = db.get_nutrition_goals()
    
    return {
        "totals": totals,
        "percentages": {
            "protein": round((totals["protein"] / goals.protein_goal) * 100, 1) if goals.protein_goal > 0 else 0,
            "calories": round((totals["calories"] / goals.calorie_goal) * 100, 1) if goals.calorie_goal > 0 else 0,
            "cholesterol": round((totals["cholesterol"] / goals.cholesterol_limit) * 100, 1) if goals.cholesterol_limit > 0 else 0
        }
    }

@app.get("/history")
async def get_history(days: int = 7):
    entries = db.get_last_n_days_entries(days)
    result = []
    
    for date, daily_entries in entries.items():
        day_total = {"date": date, "protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
        for entry in daily_entries:
            day_total["protein"] += entry.get("protein", 0)
            day_total["carbs"] += entry.get("carbs", 0)
            day_total["cholesterol"] += entry.get("cholesterol", 0)
            day_total["iron"] += entry.get("iron", 0)
            day_total["calories"] += entry.get("calories", 0)
            day_total["cost"] += entry.get("cost", 0)
        result.append(day_total)
    
    return result

@app.post("/ai/chat")
async def ai_chat(request: dict):
    """AI chat using orchestrator with MCP tools"""
    query = request.get("query", "")
    
    # Get context
    profile = db.get_profile()
    goals = db.get_nutrition_goals()
    today_totals = db.get_today_totals()
    
    context = {
        "profile": profile.dict() if profile else {},
        "goals": goals.dict(),
        "today": today_totals
    }
    
    # Use orchestrator to process query (this uses ai_agent and mcp_tools)
    result = await orchestrator.process_ai_query(query, context)
    
    return {"response": result.get("response", "I'm here to help!")}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
