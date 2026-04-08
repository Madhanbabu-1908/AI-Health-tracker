from .models import PersonalizedNutritionGoals


ACTIVITY_MULTIPLIERS = {
    "sedentary":   1.2,
    "light":       1.375,
    "moderate":    1.55,
    "active":      1.725,
    "very_active": 1.9,
}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
    """Mifflin-St Jeor equation."""
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    return base - 161 if gender == "female" else base + 5


def calculate_all_goals(profile: dict, user_goals: dict, session_id: str) -> PersonalizedNutritionGoals:
    weight         = float(profile.get("weight", 70))
    height         = float(profile.get("height", 170))
    age            = int(profile.get("age", 25))
    gender         = profile.get("gender", "male")
    primary_goal   = user_goals.get("primary_goal", "maintain_weight")
    activity_level = user_goals.get("activity_level", "moderate")

    # ── Calories ──────────────────────────────────────────────────────────────
    bmr  = calculate_bmr(weight, height, age, gender)
    tdee = bmr * ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)

    calorie_adjustments = {
        "lose_weight":       0.85,
        "gain_muscle":       1.10,
        "maintain_weight":   1.00,
        "improve_endurance": 1.05,
        "lower_cholesterol": 0.95,
        "increase_iron":     1.00,
    }
    calorie_goal = max(round(tdee * calorie_adjustments.get(primary_goal, 1.0)), 1400)

    # ── Protein ───────────────────────────────────────────────────────────────
    protein_g_per_kg = {
        "lose_weight":       1.8,
        "gain_muscle":       2.2,
        "maintain_weight":   1.4,
        "improve_endurance": 1.6,
        "lower_cholesterol": 1.3,
        "increase_iron":     1.5,
    }
    activity_protein_bonus = {
        "sedentary": 0.0, "light": 0.1, "moderate": 0.2, "active": 0.3, "very_active": 0.4
    }
    protein_goal = round(
        weight * (protein_g_per_kg.get(primary_goal, 1.4) + activity_protein_bonus.get(activity_level, 0))
    )

    # ── Carbs ─────────────────────────────────────────────────────────────────
    carb_pct = {
        "lose_weight": 0.38, "gain_muscle": 0.50, "maintain_weight": 0.48,
        "improve_endurance": 0.62, "lower_cholesterol": 0.45, "increase_iron": 0.50,
    }
    carb_goal = round((calorie_goal * carb_pct.get(primary_goal, 0.48)) / 4)

    # ── Fat ───────────────────────────────────────────────────────────────────
    fat_pct = {
        "lose_weight": 0.28, "gain_muscle": 0.28, "maintain_weight": 0.28,
        "improve_endurance": 0.22, "lower_cholesterol": 0.20, "increase_iron": 0.25,
    }
    fat_goal = round((calorie_goal * fat_pct.get(primary_goal, 0.28)) / 9)

    # ── Fibre ─────────────────────────────────────────────────────────────────
    fiber_goal = max(round((calorie_goal / 1000) * 14), 25)

    # ── Cholesterol ───────────────────────────────────────────────────────────
    cholesterol_limit = 200 if primary_goal == "lower_cholesterol" else 300

    # ── Iron ──────────────────────────────────────────────────────────────────
    base_iron = 18 if gender == "female" else 8
    if primary_goal == "increase_iron":
        base_iron = round(base_iron * 1.5)
    iron_goal = base_iron

    # ── Calcium ───────────────────────────────────────────────────────────────
    if age >= 50 and gender == "female":
        calcium_goal = 1200
    elif age >= 70:
        calcium_goal = 1200
    else:
        calcium_goal = 1000

    # ── Vitamin D ─────────────────────────────────────────────────────────────
    vitamin_d_goal = 800 if age >= 70 else 600

    # ── Water ─────────────────────────────────────────────────────────────────
    act_water = {"sedentary": 1.0, "light": 1.1, "moderate": 1.2, "active": 1.35, "very_active": 1.5}
    water_goal = round(weight * 0.033 * act_water.get(activity_level, 1.2), 1)

    # ── Explanation ───────────────────────────────────────────────────────────
    goal_labels = {
        "lose_weight": "weight loss (−15% calories)",
        "gain_muscle": "muscle gain (+10% calories)",
        "maintain_weight": "weight maintenance",
        "improve_endurance": "endurance training",
        "lower_cholesterol": "cholesterol management",
        "increase_iron": "iron replenishment",
    }
    explanation = (
        f"Goals calculated for {gender}, {age}y, {weight}kg, {height}cm, "
        f"{activity_level} activity, targeting {goal_labels.get(primary_goal, primary_goal)}. "
        f"Daily targets: {calorie_goal} kcal, {protein_goal}g protein, "
        f"{carb_goal}g carbs, {fat_goal}g fat, {water_goal}L water."
    )

    return PersonalizedNutritionGoals(
        session_id        = session_id,
        protein_goal      = protein_goal,
        calorie_goal      = calorie_goal,
        carb_goal         = carb_goal,
        fat_goal          = fat_goal,
        fiber_goal        = fiber_goal,
        cholesterol_limit = cholesterol_limit,
        iron_goal         = iron_goal,
        calcium_goal      = calcium_goal,
        vitamin_d_goal    = vitamin_d_goal,
        water_goal        = water_goal,
        explanation       = explanation,
    )
