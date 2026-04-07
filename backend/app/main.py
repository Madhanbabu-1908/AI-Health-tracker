from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import FoodEntry, HealthProfile, AIRequest, CustomFood
from .database import Database
from .orchestrator import AgenticOrchestrator
from .food_service import FoodService
from typing import List, Optional

app = FastAPI(title="Madhan Health Tracker API")
orchestrator = AgenticOrchestrator()
db = Database()
food_service = FoodService(db)

# CORS for mobile app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/")
async def root():
    return {"message": "Madhan Health Tracker API", "status": "active", "version": "2.0"}

# Food Management
@app.post("/log_food")
async def log_food(name: str, quantity: float = 1.0, unit: str = "serving", notes: Optional[str] = None):
    """Log a food entry with AI advice"""
    result = await orchestrator.log_and_advise(name, quantity, unit, notes)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result["error"])
    return result

@app.post("/add_food")
async def add_food(name: str, protein: float, cholesterol: float, calories: float, unit: str = "serving"):
    """Add a new custom food to database"""
    if protein < 0 or cholesterol < 0 or calories < 0:
        raise HTTPException(status_code=400, detail="Nutrition values must be positive")
    
    result = await orchestrator.add_new_food(name, protein, cholesterol, calories, unit)
    return result

@app.get("/search_foods")
async def search_foods(query: str):
    """Search for foods in database"""
    results = food_service.search_foods(query)
    return {"results": results, "count": len(results)}

@app.get("/my_foods")
async def get_my_foods():
    """Get all custom foods added by user"""
    foods = db.get_custom_foods()
    return {"foods": [f.dict() for f in foods]}

@app.delete("/food/{food_id}")
async def delete_food(food_id: str):
    """Delete a custom food"""
    success = db.delete_custom_food(food_id)
    if not success:
        raise HTTPException(status_code=404, detail="Food not found")
    return {"success": True, "message": "Food deleted"}

@app.get("/food_suggestions")
async def get_food_suggestions(limit: int = 10):
    """Get frequently used food suggestions"""
    suggestions = food_service.get_food_suggestions(limit)
    return {"suggestions": suggestions}

# History & Stats
@app.get("/history/{days}")
async def get_history(days: int = 7):
    """Get historical data for last N days"""
    if days > 30:
        days = 30
    history = db.get_history(days)
    return {date: totals.dict() for date, totals in history.items()}

@app.get("/today")
async def get_today():
    """Get today's totals"""
    today = db.get_today()
    return today.dict()

# Profile Management
@app.get("/profile")
async def get_profile():
    return db.get_profile().dict()

@app.post("/profile")
async def update_profile(profile: HealthProfile):
    success = db.update_profile(profile)
    return {"success": success, "profile": profile.dict()}

# AI Features
@app.post("/ai_query")
def ai_query(request: AIRequest):
    today = db.get_today()
    profile = db.get_profile()
    remaining_protein = max(0, profile["goal_protein"] - today["protein"])
    remaining_cholesterol = max(0, profile["cholesterol_limit"] - today["cholesterol"])
    
    query_lower = request.query.lower()
    
    # Simple rule-based responses (works without API key)
    if "protein" in query_lower:
        if remaining_protein > 50:
            response = f"You need {remaining_protein}g more protein. Try Beef Chukka (40g) + 2 eggs (12g) = 52g protein."
        elif remaining_protein > 20:
            response = f"You need {remaining_protein}g more protein. Chickpeas (15g) + 1 egg (6g) would work well."
        elif remaining_protein > 0:
            response = f"Only {remaining_protein}g more protein needed! A small snack like 1 egg (6g) or chickpeas (15g) will get you there."
        else:
            response = "Great job! You've met your protein goal. Focus on recovery and hydration."
    
    elif "cholesterol" in query_lower:
        if remaining_cholesterol < 50:
            response = f"⚠️ Your cholesterol budget is almost used ({today['cholesterol']}mg/{profile['cholesterol_limit']}mg). Choose plant-based proteins like chickpeas or lentils."
        elif remaining_cholesterol < 150:
            response = f"You have {remaining_cholesterol}mg cholesterol left. Eggs are fine in moderation (120mg each)."
        else:
            response = f"Your cholesterol is at {today['cholesterol']}mg. You have {remaining_cholesterol}mg remaining today."
    
    elif "beef" in query_lower or "chukka" in query_lower:
        response = "Beef Chukka is excellent for muscle recovery with 40g protein per serving. However, it contains 150mg cholesterol, so limit to once daily if managing LDL."
    
    elif "egg" in query_lower:
        response = "Country eggs have 6g protein and 120mg cholesterol each. They're nutrient-dense with Omega-3s. For cholesterol management, limit to 2-3 per day."
    
    elif "chickpea" in query_lower:
        response = "Chickpeas are perfect for cholesterol management - 15g protein and ZERO cholesterol! They're also high in fiber which helps flush out excess cholesterol."
    
    elif "meal" in query_lower or "eat" in query_lower:
        if remaining_protein > 0:
            response = f"Suggested meal: Beef Chukka (40g protein) + Chickpeas (15g) = 55g protein. That would meet your remaining {remaining_protein}g goal!"
        else:
            response = "You've met your protein goal! Focus on vegetables and healthy fats for recovery."
    
    else:
        response = f"Today you've had {today['protein']}g protein and {today['cholesterol']}mg cholesterol. Need {remaining_protein}g more protein. Try Beef Chukka (40g), Chickpeas (15g), or Country Eggs (6g each)."
    
    return {"ai_response": response}

@app.get("/ai_insights")
async def get_ai_insights():
    """Get AI analysis of trends"""
    history = db.get_history(7)
    insights = await orchestrator.ai_agent.analyze_trends(history)
    return insights

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
