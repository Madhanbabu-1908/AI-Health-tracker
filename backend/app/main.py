"""
AI Health & Wealth Tracker — FastAPI Backend
─────────────────────────────────────────────
All endpoints are session-scoped. No auth needed — session_id is generated
client-side (UUID4) and stored in localStorage. Clearing cache deletes data.
"""

import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import database as db
from .models import (
    ProfileSetupRequest, FoodItem, FoodEntry,
    WaterLog, ChatRequest,
)
from .goal_calculator import calculate_all_goals
from .ai_agent import get_agent

# ─── App setup ───────────────────────────────────────────────────────────────

app = FastAPI(title="Nalamudan | நலமுடன் API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db.init_db()


# ─── Health check ────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "app": "Nalamudan | நலமுடன்", "version": "4.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# ─── Profile / Session ───────────────────────────────────────────────────────

@app.post("/profile/setup")
async def setup_profile(req: ProfileSetupRequest):
    """Create or update user profile and auto-calculate all nutrition goals."""
    if not req.nickname.strip():
        raise HTTPException(400, "nickname is required")
    if not (50 <= req.height <= 250):
        raise HTTPException(400, "height must be between 50 and 250 cm")
    if not (20 <= req.weight <= 300):
        raise HTTPException(400, "weight must be between 20 and 300 kg")
    if not (10 <= req.age <= 120):
        raise HTTPException(400, "age must be between 10 and 120")

    bmi = round(req.weight / ((req.height / 100) ** 2), 1)
    bmi_categories = [(18.5, "Underweight"), (25, "Normal"), (30, "Overweight")]
    bmi_category = "Obese"
    for threshold, label in bmi_categories:
        if bmi < threshold:
            bmi_category = label
            break

    from .models import UserProfile
    profile = UserProfile(
        session_id     = req.session_id,
        nickname       = req.nickname.strip(),
        height         = req.height,
        weight         = req.weight,
        bmi            = bmi,
        age            = req.age,
        gender         = req.gender,
        primary_goal   = req.primary_goal,
        activity_level = req.activity_level,
        currency       = req.currency,
        created_at     = datetime.now().isoformat(),
        updated_at     = datetime.now().isoformat(),
    )
    db.save_profile(profile)

    goals = calculate_all_goals(
        profile.model_dump(),
        {"primary_goal": req.primary_goal, "activity_level": req.activity_level, "secondary_goals": req.secondary_goals},
        req.session_id,
    )
    db.save_nutrition_goals(goals)

    return {
        "success":      True,
        "profile":      profile.model_dump(),
        "goals":        goals.model_dump(),
        "bmi":          bmi,
        "bmi_category": bmi_category,
        "message":      goals.explanation,
    }


@app.get("/profile/{session_id}")
async def get_profile(session_id: str):
    profile = db.get_profile(session_id)
    if not profile:
        raise HTTPException(404, "Profile not found")
    return profile


@app.get("/goals/{session_id}")
async def get_goals(session_id: str):
    goals = db.get_nutrition_goals(session_id)
    if not goals:
        raise HTTPException(404, "Goals not found")
    return goals


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete all user data for this session."""
    db.delete_session(session_id)
    return {"success": True, "message": "All data deleted"}


# ─── Food Items ───────────────────────────────────────────────────────────────

@app.get("/foods/{session_id}")
async def list_foods(session_id: str):
    return {"foods": db.get_food_items(session_id)}


@app.post("/foods/{session_id}")
async def add_food(session_id: str, item: dict):
    """Add a new food item to user's database."""
    food = FoodItem(
        id                   = str(uuid.uuid4())[:8],
        session_id           = session_id,
        name                 = item.get("name", "").strip(),
        protein_per_unit     = float(item.get("protein_per_unit", 0)),
        carbs_per_unit       = float(item.get("carbs_per_unit", 0)),
        fat_per_unit         = float(item.get("fat_per_unit", 0)),
        cholesterol_per_unit = float(item.get("cholesterol_per_unit", 0)),
        iron_per_unit        = float(item.get("iron_per_unit", 0)),
        fiber_per_unit       = float(item.get("fiber_per_unit", 0)),
        calories_per_unit    = float(item.get("calories_per_unit", 0)),
        cost_per_unit        = float(item.get("cost_per_unit", 0)),
        default_unit         = item.get("default_unit", "serving"),
        created_at           = datetime.now().isoformat(),
    )
    if not food.name:
        raise HTTPException(400, "Food name is required")
    db.add_food_item(food)
    return {"success": True, "food": food.model_dump()}


@app.delete("/foods/{session_id}/{food_id}")
async def delete_food(session_id: str, food_id: str):
    db.delete_food_item(session_id, food_id)
    return {"success": True}


# ─── Food Logging ────────────────────────────────────────────────────────────

@app.post("/log/{session_id}")
async def log_food(session_id: str, body: dict):
    """Log a food entry by food_id + quantity."""
    food_id  = body.get("food_id")
    quantity = float(body.get("quantity", 1.0))

    food = db.get_food_item_by_id(session_id, food_id)
    if not food:
        raise HTTPException(404, f"Food item not found")

    entry = FoodEntry(
        id          = str(uuid.uuid4())[:10],
        session_id  = session_id,
        name        = food["name"],
        protein     = round(food["protein_per_unit"] * quantity, 2),
        carbs       = round(food["carbs_per_unit"] * quantity, 2),
        fat         = round(food["fat_per_unit"] * quantity, 2),
        cholesterol = round(food["cholesterol_per_unit"] * quantity, 2),
        iron        = round(food["iron_per_unit"] * quantity, 2),
        fiber       = round(food["fiber_per_unit"] * quantity, 2),
        calories    = round(food["calories_per_unit"] * quantity, 2),
        cost        = round(food["cost_per_unit"] * quantity, 2),
        quantity    = quantity,
        unit        = food["default_unit"],
        logged_at   = datetime.now().isoformat(),
    )
    db.add_food_entry(entry)
    return {"success": True, "entry": entry.model_dump()}


@app.delete("/log/{session_id}/{entry_id}")
async def delete_log_entry(session_id: str, entry_id: str):
    db.delete_food_entry(session_id, entry_id)
    return {"success": True}


@app.get("/log/{session_id}/today")
async def today(session_id: str):
    """Today's totals + per-goal percentages."""
    totals = db.get_today_totals(session_id)
    goals  = db.get_nutrition_goals(session_id) or {}
    water_ml = db.get_today_water_ml(session_id)

    def pct(val, goal):
        return round((val / goal) * 100, 1) if goal else 0

    return {
        "totals":    totals,
        "water_ml":  water_ml,
        "water_l":   round(water_ml / 1000, 2),
        "percentages": {
            "calories":    pct(totals["calories"],    goals.get("calorie_goal", 2000)),
            "protein":     pct(totals["protein"],     goals.get("protein_goal", 100)),
            "carbs":       pct(totals["carbs"],       goals.get("carb_goal", 250)),
            "fat":         pct(totals["fat"],         goals.get("fat_goal", 65)),
            "cholesterol": pct(totals["cholesterol"], goals.get("cholesterol_limit", 300)),
            "iron":        pct(totals["iron"],        goals.get("iron_goal", 8)),
            "fiber":       pct(totals["fiber"],       goals.get("fiber_goal", 25)),
            "water":       pct(water_ml / 1000,       goals.get("water_goal", 2.5)),
        },
        "entries": db.get_entries_for_date(session_id, datetime.now().strftime("%Y-%m-%d")),
    }


@app.get("/log/{session_id}/history")
async def history(session_id: str, days: int = Query(default=7, ge=1, le=90)):
    food_history  = db.get_history(session_id, days)
    water_history = db.get_water_history(session_id, days)

    # Merge water into food history by date
    water_by_date = {w["date"]: w["total_ml"] for w in water_history}
    for day in food_history:
        day["water_ml"] = water_by_date.get(day["date"], 0)
        day["water_l"]  = round(day["water_ml"] / 1000, 2)

    return food_history


# ─── Water Logging ────────────────────────────────────────────────────────────

@app.post("/water/{session_id}")
async def log_water(session_id: str, body: dict):
    """Log water intake in ml."""
    amount_ml = float(body.get("amount_ml", 0))
    if amount_ml <= 0:
        raise HTTPException(400, "amount_ml must be > 0")

    log = WaterLog(
        id         = str(uuid.uuid4())[:10],
        session_id = session_id,
        amount_ml  = amount_ml,
        logged_at  = datetime.now().isoformat(),
    )
    db.add_water_log(log)
    total_ml = db.get_today_water_ml(session_id)
    return {"success": True, "logged_ml": amount_ml, "total_today_ml": total_ml}


@app.get("/water/{session_id}/today")
async def water_today(session_id: str):
    total_ml = db.get_today_water_ml(session_id)
    goals    = db.get_nutrition_goals(session_id) or {}
    goal_l   = goals.get("water_goal", 2.5)
    return {
        "total_ml":   total_ml,
        "total_l":    round(total_ml / 1000, 2),
        "goal_l":     goal_l,
        "percentage": round((total_ml / 1000 / goal_l) * 100, 1) if goal_l else 0,
    }


# ─── AI Endpoints ─────────────────────────────────────────────────────────────

@app.get("/ai/nutrition")
async def predict_nutrition_with_serving(
    self, 
    food_name: str, 
    quantity: float = 1, 
    unit: str = "serving"
) -> Dict:
    """Predict nutrition with dynamic serving size - NO HARDCODING"""
    
    # Use dynamic serving calculation
    result = await get_nutrition_with_serving(food_name, quantity, unit)
    
    # If confidence is low and Groq is available, enhance with AI
    if result.get("confidence") == "low" and self._client:
        try:
            prompt = f"""Return ONLY JSON for nutrition of {quantity} {unit} of {food_name} (approx {result.get('serving_grams', 150)}g):
{{"calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"cholesterol":0,"iron":0}}
Use realistic values based on standard nutrition databases. Return ONLY JSON."""
            
            loop = asyncio.get_event_loop()
            text, _ = await loop.run_in_executor(
                None,
                lambda: self._call_groq(
                    [{"role": "user", "content": prompt}],
                    max_tokens=200,
                )
            )
            start, end = text.find("{"), text.rfind("}") + 1
            if start != -1 and end:
                import json
                ai_data = json.loads(text[start:end])
                for key in ["calories", "protein", "carbs", "fat", "fiber", "cholesterol", "iron"]:
                    if result.get(key, 0) == 0 and ai_data.get(key, 0) > 0:
                        result[key] = float(ai_data[key])
                result["source"] = "web_search+ai"
                result["confidence"] = "medium"
        except Exception as e:
            print(f"[AI] serving prediction error: {e}")
    
    return result

@app.post("/ai/chat")
async def ai_chat(req: ChatRequest):
    """Multi-model AI health coach with MCP web search context."""
    profile  = db.get_profile(req.session_id) or {}
    goals    = db.get_nutrition_goals(req.session_id) or {}
    today    = db.get_today_totals(req.session_id)
    water_ml = db.get_today_water_ml(req.session_id)

    context = {
        "profile":  profile,
        "goals":    goals,
        "today":    today,
        "water_ml": water_ml,
        **(req.context or {}),
    }

    agent  = get_agent()
    result = await agent.chat(req.query, context)
    return result
