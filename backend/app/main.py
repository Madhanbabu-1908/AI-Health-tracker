from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime
import json
import os
import uuid

app = FastAPI(title="AI Health Tracker API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data directory
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# File paths
PROFILE_FILE = os.path.join(DATA_DIR, "profile.json")
GOALS_FILE = os.path.join(DATA_DIR, "nutrition_goals.json")
FOOD_ENTRIES_FILE = os.path.join(DATA_DIR, "food_entries.json")
FOOD_ITEMS_FILE = os.path.join(DATA_DIR, "food_items.json")
USER_FOODS_FILE = os.path.join(DATA_DIR, "user_foods.json")

# Initialize files
def init_files():
    # Profile file
    if not os.path.exists(PROFILE_FILE):
        with open(PROFILE_FILE, "w") as f:
            json.dump(None, f)
    
    # Goals file
    if not os.path.exists(GOALS_FILE):
        with open(GOALS_FILE, "w") as f:
            json.dump({
                "protein_goal": 100,
                "calorie_goal": 2500,
                "cholesterol_limit": 300,
                "carb_limit": 300,
                "iron_goal": 15,
                "fat_goal": 70,
                "fiber_goal": 25,
                "water_goal": 2.5,
                "explanation": "Default goals - setup your profile for personalized goals"
            }, f)
    
    # Food entries (history)
    if not os.path.exists(FOOD_ENTRIES_FILE):
        with open(FOOD_ENTRIES_FILE, "w") as f:
            json.dump({}, f)
    
    # User's custom foods (starts empty - users add their own)
    if not os.path.exists(USER_FOODS_FILE):
        with open(USER_FOODS_FILE, "w") as f:
            json.dump({}, f)  # Empty - no hardcoded foods!

init_files()

# Helper functions
def read_json(filepath):
    with open(filepath, "r") as f:
        return json.load(f)

def write_json(filepath, data):
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)

# ========== BMI Calculation ==========
def calculate_bmi(height_cm, weight_kg):
    """Calculate BMI from height (cm) and weight (kg)"""
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)

# ========== Nutrition Goals Calculator ==========
def calculate_nutrition_goals(weight_kg, primary_goal, activity_level):
    """Calculate personalized nutrition goals"""
    
    # Base BMR (simplified)
    bmr = 10 * weight_kg + 6.25 * 170 - 5 * 30 + 5
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    tdee = bmr * activity_multipliers.get(activity_level, 1.55)
    
    if primary_goal == "lose_weight":
        calories = max(tdee - 500, 1500)
        protein = weight_kg * 1.6
        carbs = weight_kg * 3.0
        fat = weight_kg * 0.8
        explanation = "Based on your weight loss goal, we've created a calorie deficit of 500 calories per day."
    elif primary_goal == "gain_muscle":
        calories = tdee + 300
        protein = weight_kg * 1.8
        carbs = weight_kg * 4.5
        fat = weight_kg * 1.2
        explanation = "To build muscle, we've added a slight calorie surplus."
    elif primary_goal == "improve_endurance":
        calories = tdee + 200
        protein = weight_kg * 1.4
        carbs = weight_kg * 5.0
        fat = weight_kg * 1.1
        explanation = "For endurance training, we've prioritized carbohydrates."
    elif primary_goal == "lower_cholesterol":
        calories = tdee - 200
        protein = weight_kg * 1.2
        carbs = weight_kg * 3.5
        fat = weight_kg * 0.7
        explanation = "Your goals focus on heart health with lower fat limits."
    elif primary_goal == "increase_iron":
        calories = tdee
        protein = weight_kg * 1.3
        carbs = weight_kg * 3.5
        fat = weight_kg * 1.0
        explanation = "We've increased your iron target for healthy blood cells."
    else:
        calories = tdee
        protein = weight_kg * 1.2
        carbs = weight_kg * 4.0
        fat = weight_kg * 1.0
        explanation = "Your calorie target maintains your current weight."
    
    return {
        "protein_goal": round(protein, 1),
        "calorie_goal": round(calories, 0),
        "carb_goal": round(carbs, 1),
        "fat_goal": round(fat, 1),
        "fiber_goal": round(max(weight_kg * 0.3, 25), 1),
        "cholesterol_limit": 300,
        "iron_goal": 15,
        "calcium_goal": 1000,
        "vitamin_d_goal": 600,
        "water_goal": round(max(weight_kg * 0.033, 2.0), 1),
        "explanation": explanation
    }

# ========== API Endpoints ==========

@app.get("/")
async def root():
    return {"message": "AI Health Tracker API", "status": "active", "version": "3.0"}

# ========== User Profile ==========

@app.get("/user/setup-goals")
async def setup_user_goals(
    nickname: str,
    height: float,
    weight: float,
    age: int,
    gender: str,
    primary_goal: str,
    activity_level: str,
    secondary_goals: str = ""
):
    """Initialize user with health goals"""
    
    try:
        if height < 50 or height > 250:
            raise HTTPException(status_code=400, detail="Height must be between 50cm and 250cm")
        if weight < 20 or weight > 300:
            raise HTTPException(status_code=400, detail="Weight must be between 20kg and 300kg")
        if age < 10 or age > 120:
            raise HTTPException(status_code=400, detail="Age must be between 10 and 120")
        
        bmi = calculate_bmi(height, weight)
        nutrition_goals = calculate_nutrition_goals(weight, primary_goal, activity_level)
        
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
        write_json(PROFILE_FILE, profile)
        write_json(GOALS_FILE, nutrition_goals)
        
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
            "message": nutrition_goals["explanation"]
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profile")
async def get_profile():
    profile = read_json(PROFILE_FILE)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.get("/nutrition-goals")
async def get_nutrition_goals():
    return read_json(GOALS_FILE)

# ========== Dynamic Food Management ==========

@app.get("/food/list")
async def list_foods():
    """Get all user's custom foods (empty initially - user adds their own)"""
    foods = read_json(USER_FOODS_FILE)
    return {"foods": list(foods.values())}

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
    """Add a new food to user's database"""
    foods = read_json(USER_FOODS_FILE)
    
    # Check if food already exists
    for key, item in foods.items():
        if item["name"].lower() == name.lower():
            raise HTTPException(status_code=400, detail=f"Food '{name}' already exists")
    
    # Create new food
    food_id = str(uuid.uuid4())[:8]
    new_food = {
        "id": food_id,
        "name": name,
        "protein_per_unit": protein,
        "carbs_per_unit": carbs,
        "cholesterol_per_unit": cholesterol,
        "iron_per_unit": iron,
        "calories_per_unit": calories,
        "cost": cost,
        "default_unit": unit,
        "usage_count": 0,
        "created_at": datetime.now().isoformat()
    }
    
    foods[food_id] = new_food
    write_json(USER_FOODS_FILE, foods)
    
    return {"success": True, "food": new_food, "message": f"✅ Added '{name}' to your foods!"}

@app.delete("/food/{food_id}")
async def delete_food(food_id: str):
    """Delete a food from user's database"""
    foods = read_json(USER_FOODS_FILE)
    
    if food_id not in foods:
        raise HTTPException(status_code=404, detail="Food not found")
    
    food_name = foods[food_id]["name"]
    del foods[food_id]
    write_json(USER_FOODS_FILE, foods)
    
    return {"success": True, "message": f"✅ Deleted '{food_name}'"}

@app.post("/food/log")
async def log_food(name: str, quantity: float = 1.0):
    """Log a food entry"""
    foods = read_json(USER_FOODS_FILE)
    
    # Find the food
    food_item = None
    for key, item in foods.items():
        if item["name"].lower() == name.lower():
            food_item = item
            break
    
    if not food_item:
        raise HTTPException(status_code=404, detail=f"Food '{name}' not found. Please add it first in Add Food section.")
    
    # Create entry
    entry = {
        "id": str(uuid.uuid4())[:8],
        "name": food_item["name"],
        "protein": food_item["protein_per_unit"] * quantity,
        "carbs": food_item["carbs_per_unit"] * quantity,
        "cholesterol": food_item["cholesterol_per_unit"] * quantity,
        "iron": food_item["iron_per_unit"] * quantity,
        "calories": food_item["calories_per_unit"] * quantity,
        "cost": food_item["cost"] * quantity,
        "quantity": quantity,
        "unit": food_item["default_unit"],
        "timestamp": datetime.now().isoformat()
    }
    
    # Update usage count
    food_item["usage_count"] = food_item.get("usage_count", 0) + 1
    write_json(USER_FOODS_FILE, foods)
    
    # Save to history
    entries = read_json(FOOD_ENTRIES_FILE)
    today = datetime.now().strftime("%Y-%m-%d")
    
    if today not in entries:
        entries[today] = []
    
    entries[today].append(entry)
    write_json(FOOD_ENTRIES_FILE, entries)
    
    # Get updated totals
    totals = {"protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
    for e in entries[today]:
        totals["protein"] += e.get("protein", 0)
        totals["carbs"] += e.get("carbs", 0)
        totals["cholesterol"] += e.get("cholesterol", 0)
        totals["iron"] += e.get("iron", 0)
        totals["calories"] += e.get("calories", 0)
        totals["cost"] += e.get("cost", 0)
    
    goals = read_json(GOALS_FILE)
    
    return {
        "success": True,
        "totals": totals,
        "percentages": {
            "protein": round((totals["protein"] / goals["protein_goal"]) * 100, 1) if goals["protein_goal"] > 0 else 0
        },
        "message": f"✅ Logged {quantity} × {food_item['name']}"
    }

@app.get("/today")
async def get_today():
    """Get today's totals"""
    entries = read_json(FOOD_ENTRIES_FILE)
    today = datetime.now().strftime("%Y-%m-%d")
    goals = read_json(GOALS_FILE)
    
    totals = {"protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
    
    if today in entries:
        for entry in entries[today]:
            totals["protein"] += entry.get("protein", 0)
            totals["carbs"] += entry.get("carbs", 0)
            totals["cholesterol"] += entry.get("cholesterol", 0)
            totals["iron"] += entry.get("iron", 0)
            totals["calories"] += entry.get("calories", 0)
            totals["cost"] += entry.get("cost", 0)
    
    return {
        "totals": totals,
        "percentages": {
            "protein": round((totals["protein"] / goals["protein_goal"]) * 100, 1) if goals["protein_goal"] > 0 else 0,
            "calories": round((totals["calories"] / goals["calorie_goal"]) * 100, 1) if goals["calorie_goal"] > 0 else 0,
            "cholesterol": round((totals["cholesterol"] / goals["cholesterol_limit"]) * 100, 1) if goals["cholesterol_limit"] > 0 else 0
        }
    }

@app.get("/history")
async def get_history(days: int = 7):
    """Get history for last N days"""
    entries = read_json(FOOD_ENTRIES_FILE)
    result = []
    
    from datetime import timedelta
    end_date = datetime.now()
    
    for i in range(days):
        date = (end_date - timedelta(days=i)).strftime("%Y-%m-%d")
        if date in entries:
            day_total = {"date": date, "protein": 0, "calories": 0}
            for entry in entries[date]:
                day_total["protein"] += entry.get("protein", 0)
                day_total["calories"] += entry.get("calories", 0)
            result.append(day_total)
    
    return result

# ========== AI Chat ==========

@app.post("/ai/chat")
async def ai_chat(request: dict):
    """AI chat endpoint"""
    query = request.get("query", "")
    query_lower = query.lower()
    
    profile = read_json(PROFILE_FILE)
    goals = read_json(GOALS_FILE)
    today_data = await get_today()
    
    remaining_protein = max(0, goals["protein_goal"] - today_data["totals"]["protein"])
    
    # Simple response logic
    if "protein" in query_lower:
        if remaining_protein > 50:
            response = f"You need {remaining_protein:.0f}g more protein. Add a high-protein food like chicken, beef, or eggs to your food list first."
        elif remaining_protein > 20:
            response = f"You need {remaining_protein:.0f}g more protein. Check your food list for options you've added."
        elif remaining_protein > 0:
            response = f"Only {remaining_protein:.0f}g more protein needed! You're almost there."
        else:
            response = "Great job! You've met your protein goal!"
    
    elif "iron" in query_lower:
        response = "To increase iron, add foods like spinach, lentils, beef, or fortified cereals to your food list, then log them."
    
    elif "cholesterol" in query_lower:
        response = "To manage cholesterol, focus on plant-based proteins. Add foods like chickpeas, lentils, and oats to your food list."
    
    elif "food" in query_lower or "add" in query_lower:
        response = "Go to the 'Add Food' tab to add your own foods with their nutrition values. Once added, you can log them from the 'Log Food' tab."
    
    else:
        response = f"You need {remaining_protein:.0f}g more protein today. Go to 'Add Food' to add your meals, then log them to track your progress!"
    
    return {"response": response}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
