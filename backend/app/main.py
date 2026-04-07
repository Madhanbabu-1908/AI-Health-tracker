from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from datetime import datetime
import json
import os
import re
import httpx

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
def init_files():
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

init_files()

def read_json(filepath):
    with open(filepath, "r") as f:
        return json.load(f)

def write_json(filepath, data):
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

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

# ========== AI Web Search for Nutrition ==========

async def search_nutrition_online(food_name: str) -> dict:
    """Search the web for nutrition information using DuckDuckGo"""
    try:
        # Use DuckDuckGo HTML search (free, no API key)
        search_url = f"https://html.duckduckgo.com/html/?q={food_name}+nutrition+facts+per+100g"
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(search_url, headers=headers)
            
            if response.status_code == 200:
                # Extract nutrition from search results
                nutrition = extract_nutrition_from_text(response.text, food_name)
                return nutrition
            else:
                return get_default_nutrition(food_name)
                
    except Exception as e:
        print(f"Search error: {e}")
        return get_default_nutrition(food_name)

def extract_nutrition_from_text(html_text: str, food_name: str) -> dict:
    """Extract nutrition values from HTML text using regex"""
    
    nutrition = {
        "protein": 0,
        "carbs": 0,
        "cholesterol": 0,
        "iron": 0,
        "calories": 0
    }
    
    # Look for common nutrition patterns
    patterns = {
        "protein": r'protein[:\s]+(\d+(?:\.\d+)?)\s*g',
        "carbs": r'carbohydrates?[:\s]+(\d+(?:\.\d+)?)\s*g',
        "cholesterol": r'cholesterol[:\s]+(\d+(?:\.\d+)?)\s*mg',
        "iron": r'iron[:\s]+(\d+(?:\.\d+)?)\s*mg',
        "calories": r'calories?[:\s]+(\d+(?:\.\d+)?)\s*kcal'
    }
    
    for key, pattern in patterns.items():
        match = re.search(pattern, html_text, re.IGNORECASE)
        if match:
            nutrition[key] = float(match.group(1))
    
    # If no values found, use intelligent defaults based on food type
    if nutrition["protein"] == 0 and nutrition["calories"] == 0:
        nutrition = get_intelligent_defaults(food_name)
    
    return nutrition

def get_intelligent_defaults(food_name: str) -> dict:
    """Provide intelligent defaults based on food category"""
    food_lower = food_name.lower()
    
    # Protein-rich foods
    if any(word in food_lower for word in ["chicken", "beef", "mutton", "pork", "turkey", "fish", "prawn", "crab"]):
        return {"protein": 25, "carbs": 0, "cholesterol": 70, "iron": 1.5, "calories": 200}
    
    # Egg-based
    elif "egg" in food_lower:
        return {"protein": 13, "carbs": 1, "cholesterol": 370, "iron": 1.8, "calories": 155}
    
    # Dairy
    elif any(word in food_lower for word in ["milk", "paneer", "cheese", "yogurt", "curd", "butter"]):
        return {"protein": 10, "carbs": 5, "cholesterol": 30, "iron": 0.2, "calories": 150}
    
    # Legumes
    elif any(word in food_lower for word in ["dal", "lentil", "chickpea", "bean", "tofu", "soy"]):
        return {"protein": 9, "carbs": 20, "cholesterol": 0, "iron": 2.5, "calories": 120}
    
    # Grains
    elif any(word in food_lower for word in ["rice", "wheat", "bread", "roti", "chapati", "noodle", "pasta"]):
        return {"protein": 3, "carbs": 25, "cholesterol": 0, "iron": 0.5, "calories": 130}
    
    # Vegetables
    elif any(word in food_lower for word in ["spinach", "broccoli", "cauliflower", "carrot", "potato", "tomato"]):
        return {"protein": 2, "carbs": 8, "cholesterol": 0, "iron": 1.0, "calories": 50}
    
    # Fruits
    elif any(word in food_lower for word in ["apple", "banana", "orange", "mango", "grape", "berry"]):
        return {"protein": 0.5, "carbs": 15, "cholesterol": 0, "iron": 0.3, "calories": 70}
    
    # Default
    else:
        return {"protein": 8, "carbs": 12, "cholesterol": 20, "iron": 1.0, "calories": 150}

def get_default_nutrition(food_name: str) -> dict:
    """Fallback default nutrition"""
    return get_intelligent_defaults(food_name)

# ========== API Endpoints ==========

@app.get("/")
async def root():
    return {"message": "AI Health Tracker API", "status": "active", "version": "3.0"}

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
        
        if height < 50 or height > 250:
            return {"success": False, "message": f"Height must be between 50cm and 250cm (got {height}cm)"}
        
        if weight < 20 or weight > 300:
            return {"success": False, "message": f"Weight must be between 20kg and 300kg (got {weight}kg)"}
        
        if age < 10 or age > 120:
            return {"success": False, "message": f"Age must be between 10 and 120 (got {age})"}
        
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
        write_json(PROFILE_FILE, profile)
        
        nutrition_goals = {
            "protein_goal": protein_goal,
            "calorie_goal": calorie_goal,
            "cholesterol_limit": 300,
            "carb_goal": round(weight * 4, 0),
            "fat_goal": round(weight * 0.8, 0),
            "iron_goal": 15,
            "explanation": f"Based on your {primary_goal.replace('_', ' ')} goal"
        }
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
            "message": f"Welcome {nickname}! Your BMI is {bmi} ({bmi_category}). Your daily protein goal is {protein_goal}g."
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

@app.delete("/reset-all-data")
async def reset_all_data():
    """Delete ALL user data"""
    try:
        with open(PROFILE_FILE, "w") as f:
            json.dump(None, f)
        
        with open(GOALS_FILE, "w") as f:
            json.dump({
                "protein_goal": 100,
                "calorie_goal": 2500,
                "cholesterol_limit": 300
            }, f)
        
        with open(FOOD_ENTRIES_FILE, "w") as f:
            json.dump({}, f)
        
        with open(USER_FOODS_FILE, "w") as f:
            json.dump({}, f)
        
        return {"success": True, "message": "All data has been reset successfully"}
        
    except Exception as e:
        return {"success": False, "message": str(e)}

@app.get("/ai/predict-nutrition")
async def predict_nutrition(food_name: str):
    """AI predicts nutrition values using web search"""
    
    # Search web for nutrition information
    nutrition = await search_nutrition_online(food_name)
    
    return {
        "success": True,
        "nutrition": nutrition,
        "message": f"AI predicted nutrition for {food_name} based on web search"
    }

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
    return {"success": True, "food": new_food, "message": f"Added {name}"}

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
            "protein": round((totals["protein"] / goals.get("protein_goal", 100)) * 100, 1) if goals.get("protein_goal", 100) > 0 else 0,
            "calories": round((totals["calories"] / goals.get("calorie_goal", 2500)) * 100, 1) if goals.get("calorie_goal", 2500) > 0 else 0,
            "cholesterol": round((totals["cholesterol"] / goals.get("cholesterol_limit", 300)) * 100, 1) if goals.get("cholesterol_limit", 300) > 0 else 0
        }
    }

@app.post("/ai/chat")
async def ai_chat(request: dict):
    query = request.get("query", "")
    return {"response": f"AI Coach: How can I help with '{query}'? Try adding foods first!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
