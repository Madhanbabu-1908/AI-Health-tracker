from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import UserProfile, FoodEntry, AIRequest, DateRange, NutritionGoal
from .database import Database
from .orchestrator import AgenticOrchestrator
from datetime import datetime
import uuid

app = FastAPI(title="AI Health Tracker API")
orchestrator = AgenticOrchestrator()
db = Database()

# Enable CORS for frontend and mobile app
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
    return {"message": "AI Health Tracker API", "status": "active", "version": "3.0"}

# Profile Management
@app.post("/profile/init")
async def init_profile(nickname: str, height: float, weight: float):
    """Initialize user profile with nickname, height, weight, and calculate BMI"""
    bmi = weight / ((height / 100) ** 2)
    profile = UserProfile(
        nickname=nickname,
        height=height,
        weight=weight,
        bmi=bmi
    )
    db.save_profile(profile)
    return {"success": True, "profile": profile.dict(), "bmi": bmi}

@app.get("/profile")
async def get_profile():
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found. Please initialize first.")
    return profile.dict()

@app.get("/nutrition-goals")
async def get_nutrition_goals():
    return db.get_nutrition_goals().dict()

@app.post("/nutrition-goals")
async def update_nutrition_goals(goals: NutritionGoal):
    db.update_nutrition_goals(goals)
    return {"success": True}

# Food Management
@app.post("/food/add")
async def add_food(name: str, cost: float, unit: str = "serving"):
    """Add new food with AI-predicted nutrition"""
    result = await orchestrator.add_new_food(name, cost, unit)
    return result

@app.get("/food/search")
async def search_food(query: str):
    """Search for food in database"""
    foods = db.get_food_items()
    results = [f for f in foods if query.lower() in f.name.lower()]
    return {"results": [f.dict() for f in results], "count": len(results)}

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

# Analytics and Reports
@app.get("/nutrition/analysis")
async def get_nutrition_analysis(date_range: str = "week"):
    """Get nutrition analysis for date range (week, weeks, weeks3, month)"""
    return await orchestrator.get_nutrition_analysis(date_range)

@app.get("/entries/range")
async def get_entries_by_range(start_date: str, end_date: str):
    """Get food entries for date range"""
    entries = db.get_entries_by_date_range(start_date, end_date)
    return entries

@app.post("/report/generate")
async def generate_report(start_date: str, end_date: str):
    """Generate CSV report and auto-delete old data"""
    result = await orchestrator.generate_report(start_date, end_date)
    return result

# AI Features
@app.post("/ai/chat")
async def ai_chat(request: AIRequest):
    """AI chat with caching and personal info filtering"""
    profile = db.get_profile()
    if not profile:
        raise HTTPException(status_code=400, detail="Please initialize profile first")
    
    goals = db.get_nutrition_goals()
    today_entries = db.get_entries_by_date_range(
        datetime.now().strftime("%Y-%m-%d"),
        datetime.now().strftime("%Y-%m-%d")
    )
    
    today_totals = {"protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0}
    for entries in today_entries.values():
        for entry in entries:
            today_totals["protein"] += entry.get("protein", 0)
            today_totals["carbs"] += entry.get("carbs", 0)
            today_totals["cholesterol"] += entry.get("cholesterol", 0)
            today_totals["iron"] += entry.get("iron", 0)
            today_totals["calories"] += entry.get("calories", 0)
    
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

@app.get("/today")
async def get_today():
    """Get today's totals"""
    today = datetime.now().strftime("%Y-%m-%d")
    entries = db.get_entries_by_date_range(today, today)
    
    totals = {"protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
    for daily_entries in entries.values():
        for entry in daily_entries:
            totals["protein"] += entry.get("protein", 0)
            totals["carbs"] += entry.get("carbs", 0)
            totals["cholesterol"] += entry.get("cholesterol", 0)
            totals["iron"] += entry.get("iron", 0)
            totals["calories"] += entry.get("calories", 0)
            totals["cost"] += entry.get("cost", 0)
    
    return totals

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
