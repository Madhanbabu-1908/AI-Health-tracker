from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from datetime import datetime
import json
import os

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

PROFILE_FILE = os.path.join(DATA_DIR, "profile.json")
GOALS_FILE = os.path.join(DATA_DIR, "goals.json")
FOOD_ENTRIES_FILE = os.path.join(DATA_DIR, "food_entries.json")
USER_FOODS_FILE = os.path.join(DATA_DIR, "user_foods.json")

# Initialize files
if not os.path.exists(PROFILE_FILE):
    with open(PROFILE_FILE, "w") as f:
        json.dump(None, f)

if not os.path.exists(GOALS_FILE):
    with open(GOALS_FILE, "w") as f:
        json.dump({
            "protein_goal": 100,
            "calorie_goal": 2500,
            "cholesterol_limit": 300
        }, f)

if not os.path.exists(FOOD_ENTRIES_FILE):
    with open(FOOD_ENTRIES_FILE, "w") as f:
        json.dump({}, f)

if not os.path.exists(USER_FOODS_FILE):
    with open(USER_FOODS_FILE, "w") as f:
        json.dump({}, f)

# Helper functions
def read_json(filepath):
    with open(filepath, "r") as f:
        return json.load(f)

def write_json(filepath, data):
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

def calculate_bmi(height_cm, weight_kg):
    height_m = height_cm / 100
    return round(weight_kg / (height_m * height_m), 1)

# ========== API Endpoints ==========

@app.get("/")
async def root():
    return {"message": "AI Health Tracker API", "status": "active", "version": "3.0"}

@app.post("/user/setup-goals")
async def setup_user_goals(request: Request):
    """Initialize user with health goals - accepts both query params and JSON"""
    
    try:
        # Try to get from query params first
        if request.query_params:
            nickname = request.query_params.get("nickname")
            height = float(request.query_params.get("height", 0))
            weight = float(request.query_params.get("weight", 0))
            age = int(request.query_params.get("age", 0))
            gender = request.query_params.get("gender", "male")
            primary_goal = request.query_params.get("primary_goal", "maintain_weight")
            activity_level = request.query_params.get("activity_level", "moderate")
        else:
            # Try to get from JSON body
            body = await request.json()
            nickname = body.get("nickname")
            height = float(body.get("height", 0))
            weight = float(body.get("weight", 0))
            age = int(body.get("age", 0))
            gender = body.get("gender", "male")
            primary_goal = body.get("primary_goal", "maintain_weight")
            activity_level = body.get("activity_level", "moderate")
        
        # Validate
        if not nickname:
            return {"success": False, "message": "Nickname is required"}
        
        if height < 50 or height > 250:
            return {"success": False, "message": "Height must be between 50cm and 250cm"}
        
        if weight < 20 or weight > 300:
            return {"success": False, "message": "Weight must be between 20kg and 300kg"}
        
        # Calculate
        bmi = calculate_bmi(height, weight)
        
        # Calculate protein goal based on goal
        if primary_goal == "lose_weight":
            protein_goal = round(weight * 1.6, 1)
            calorie_goal = 2200
        elif primary_goal == "gain_muscle":
            protein_goal = round(weight * 1.8, 1)
            calorie_goal = 2800
        else:
            protein_goal = round(weight * 1.2, 1)
            calorie_goal = 2500
        
        # Save profile
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
        
        # Save goals
        nutrition_goals = {
            "protein_goal": protein_goal,
            "calorie_goal": calorie_goal,
            "cholesterol_limit": 300,
            "carb_goal": round(weight * 4, 1),
            "fat_goal": round(weight * 1, 1),
            "iron_goal": 15,
            "explanation": f"Based on your {primary_goal.replace('_', ' ')} goal"
        }
        write_json(GOALS_FILE, nutrition_goals)
        
        # BMI category
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
        return {"success": False, "message": str(e)}

@app.get("/profile")
async def get_profile():
    profile = read_json(PROFILE_FILE)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@app.get("/nutrition-goals")
async def get_nutrition_goals():
    return read_json(GOALS_FILE)

@app.delete("/clear-profile")
async def clear_profile():
    with open(PROFILE_FILE, "w") as f:
        json.dump(None, f)
    return {"success": True, "message": "Profile cleared"}

@app.get("/food/list")
async def list_foods():
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
    foods = read_json(USER_FOODS_FILE)
    
    import uuid
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
        "usage_count": 0
    }
    
    foods[food_id] = new_food
    write_json(USER_FOODS_FILE, foods)
    return {"success": True, "food": new_food}

@app.post("/food/log")
async def log_food(name: str, quantity: float = 1.0):
    foods = read_json(USER_FOODS_FILE)
    
    food_item = None
    for item in foods.values():
        if item["name"].lower() == name.lower():
            food_item = item
            break
    
    if not food_item:
        raise HTTPException(status_code=404, detail=f"Food '{name}' not found")
    
    entry = {
        "name": food_item["name"],
        "protein": food_item["protein_per_unit"] * quantity,
        "carbs": food_item["carbs_per_unit"] * quantity,
        "cholesterol": food_item["cholesterol_per_unit"] * quantity,
        "iron": food_item["iron_per_unit"] * quantity,
        "calories": food_item["calories_per_unit"] * quantity,
        "cost": food_item["cost"] * quantity,
        "quantity": quantity,
        "timestamp": datetime.now().isoformat()
    }
    
    entries = read_json(FOOD_ENTRIES_FILE)
    today = datetime.now().strftime("%Y-%m-%d")
    
    if today not in entries:
        entries[today] = []
    
    entries[today].append(entry)
    write_json(FOOD_ENTRIES_FILE, entries)
    
    return {"success": True, "message": f"Logged {quantity} × {food_item['name']}"}

@app.get("/today")
async def get_today():
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
            "protein": round((totals["protein"] / goals["protein_goal"]) * 100, 1) if goals["protein_goal"] > 0 else 0
        }
    }

@app.post("/ai/chat")
async def ai_chat(request: dict):
    query = request.get("query", "")
    return {"response": f"AI Coach: How can I help with '{query}'? Try adding foods first!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
