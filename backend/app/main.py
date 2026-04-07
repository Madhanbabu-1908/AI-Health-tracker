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
async def ai_query(request: AIRequest):
    """Process AI query with orchestration"""
    profile = db.get_profile()
    today = db.get_today()
    recent_foods = [entry.name for entry in today.entries[-5:]] if today.entries else []
    
    context = {
        "today_protein": today.protein,
        "today_cholesterol": today.cholesterol,
        "today_calories": today.calories,
        "goal_protein": profile.goal_protein,
        "cholesterol_limit": profile.cholesterol_limit,
        "calorie_goal": profile.calorie_goal,
        "weight": profile.weight,
        "height": profile.height,
        "activity_level": profile.activity_level,
        "recent_foods": recent_foods
    }
    
    result = await orchestrator.process_query(request.query, context)
    return result

@app.get("/ai_insights")
async def get_ai_insights():
    """Get AI analysis of trends"""
    history = db.get_history(7)
    insights = await orchestrator.ai_agent.analyze_trends(history)
    return insights

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
