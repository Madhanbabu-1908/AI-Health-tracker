import math
from typing import Dict, List
from .models import UserGoals, HealthGoal, ActivityLevel, PersonalizedNutritionGoals

class GoalCalculator:
    """Dynamically calculates ALL nutrition goals based on user profile - NO HARDCODING"""
    
    ACTIVITY_MULTIPLIERS = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    @staticmethod
    def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str) -> float:
        """Calculate Basal Metabolic Rate using Mifflin-St Jeor equation"""
        if gender == "female":
            return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
        else:
            return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    
    @staticmethod
    def calculate_tdee(bmr: float, activity_level: str) -> float:
        """Calculate Total Daily Energy Expenditure"""
        return bmr * GoalCalculator.ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    
    @staticmethod
    def calculate_adjusted_calories(tdee: float, primary_goal: str, weight_kg: float) -> float:
        """Dynamically adjust calories based on goal"""
        if primary_goal == "lose_weight":
            # 15% calorie deficit (safe and effective)
            return max(round(tdee * 0.85, 0), 1500)  # Never go below 1500
        elif primary_goal == "gain_muscle":
            # 10% calorie surplus
            return round(tdee * 1.10, 0)
        else:
            return round(tdee, 0)
    
    @staticmethod
    def calculate_protein_goal(weight_kg: float, primary_goal: str, activity_level: str) -> float:
        """Dynamically calculate protein based on goal and activity"""
        # Base protein: 1.2g per kg
        base_protein = weight_kg * 1.2
        
        # Goal multipliers
        goal_multipliers = {
            "lose_weight": 1.6,      # Higher protein to preserve muscle
            "gain_muscle": 1.8,      # Higher for muscle growth
            "improve_endurance": 1.5,
            "lower_cholesterol": 1.2,
            "increase_iron": 1.3,
            "maintain_weight": 1.2
        }
        multiplier = goal_multipliers.get(primary_goal, 1.2)
        
        # Activity multipliers
        activity_multipliers = {
            "sedentary": 1.0,
            "light": 1.1,
            "moderate": 1.2,
            "active": 1.3,
            "very_active": 1.4
        }
        activity_mult = activity_multipliers.get(activity_level, 1.0)
        
        return round(base_protein * multiplier * activity_mult, 0)
    
    @staticmethod
    def calculate_carb_goal(calorie_goal: float, primary_goal: str, activity_level: str) -> float:
        """Dynamically calculate carbs based on calorie goal (4 cal per gram)"""
        # Carb percentage based on goal
        carb_percentages = {
            "improve_endurance": 0.60,  # 60% for endurance athletes
            "gain_muscle": 0.50,        # 50% for muscle gain
            "lose_weight": 0.40,        # 40% for weight loss
            "lower_cholesterol": 0.45,
            "increase_iron": 0.50,
            "maintain_weight": 0.50
        }
        percentage = carb_percentages.get(primary_goal, 0.50)
        
        # Activity adjustment
        activity_adjustments = {
            "sedentary": 0.9,
            "light": 1.0,
            "moderate": 1.05,
            "active": 1.1,
            "very_active": 1.15
        }
        activity_adj = activity_adjustments.get(activity_level, 1.0)
        
        carbs_calories = calorie_goal * percentage * activity_adj
        return round(carbs_calories / 4, 0)  # 4 calories per gram of carb
    
    @staticmethod
    def calculate_fat_goal(calorie_goal: float, primary_goal: str) -> float:
        """Dynamically calculate fat based on calorie goal (9 cal per gram)"""
        # Fat percentage based on goal
        fat_percentages = {
            "lower_cholesterol": 0.20,   # Lower fat for cholesterol
            "lose_weight": 0.25,
            "gain_muscle": 0.30,
            "improve_endurance": 0.25,
            "increase_iron": 0.25,
            "maintain_weight": 0.25
        }
        percentage = fat_percentages.get(primary_goal, 0.25)
        
        fat_calories = calorie_goal * percentage
        return round(fat_calories / 9, 0)  # 9 calories per gram of fat
    
    @staticmethod
    def calculate_fiber_goal(weight_kg: float, calorie_goal: float) -> float:
        """Dynamically calculate fiber: 14g per 1000 calories or 0.3g per kg (whichever is higher)"""
        fiber_by_calories = (calorie_goal / 1000) * 14
        fiber_by_weight = weight_kg * 0.3
        return round(max(fiber_by_calories, fiber_by_weight, 25), 0)
    
    @staticmethod
    def calculate_cholesterol_limit(primary_goal: str, weight_kg: float) -> float:
        """Dynamically set cholesterol limit based on goals"""
        if primary_goal == "lower_cholesterol":
            return 200  # Stricter limit for heart health
        else:
            return 300  # Standard limit
    
    @staticmethod
    def calculate_iron_goal(gender: str, weight_kg: float, primary_goal: str) -> float:
        """Dynamically calculate iron needs based on gender, weight, and goals"""
        # Base iron: 1mg per 10kg
        base_iron = weight_kg / 10
        
        # Gender adjustment
        if gender == "female":
            base_iron = base_iron * 1.5  # Women need more iron due to menstruation
        
        # Goal adjustment
        if primary_goal == "increase_iron":
            base_iron = base_iron * 1.3
        
        # Ensure minimum values
        min_iron = 12 if gender == "female" else 8
        return round(max(base_iron, min_iron), 0)
    
    @staticmethod
    def calculate_calcium_goal(age: int, gender: str) -> float:
        """Dynamically calculate calcium needs based on age and gender"""
        if age < 50:
            return 1000
        elif gender == "female" and age >= 50:
            return 1200  # Post-menopausal women need more calcium
        else:
            return 1000
    
    @staticmethod
    def calculate_vitamin_d_goal(age: int, activity_level: str) -> float:
        """Dynamically calculate Vitamin D needs based on age and activity"""
        base = 600
        if age > 70:
            base = 800
        if activity_level in ["active", "very_active"]:
            base = base + 200  # Active people may need more
        return base
    
    @staticmethod
    def calculate_water_goal(weight_kg: float, activity_level: str, calorie_goal: float) -> float:
        """Dynamically calculate water needs (30-40ml per kg)"""
        base_water = weight_kg * 0.033  # 33ml per kg
        
        # Activity adjustment
        activity_multipliers = {
            "sedentary": 1.0,
            "light": 1.1,
            "moderate": 1.2,
            "active": 1.3,
            "very_active": 1.4
        }
        activity_mult = activity_multipliers.get(activity_level, 1.0)
        
        return round(base_water * activity_mult, 1)
    
    @staticmethod
    def generate_explanation(primary_goal: str, weight: float, calories: float, 
                            protein: float, carbs: float, fat: float, fiber: float) -> str:
        """Generate personalized explanation based on actual calculated values"""
        
        explanations = {
            "lose_weight": f"Based on your weight loss goal, we've created a 15% calorie deficit ({calories:.0f} calories/day). Your protein is set at {protein:.0f}g to preserve muscle mass while losing fat. Carbs at {carbs:.0f}g and fat at {fat:.0f}g provide balanced energy.",
            
            "gain_muscle": f"To build muscle, we've added a 10% calorie surplus ({calories:.0f} calories/day). High protein ({protein:.0f}g) supports muscle repair and growth. Carbs ({carbs:.0f}g) fuel your workouts, and fats ({fat:.0f}g) support hormone production.",
            
            "maintain_weight": f"Your maintenance calories are {calories:.0f} calories/day with balanced macros: {protein:.0f}g protein, {carbs:.0f}g carbs, {fat:.0f}g fat. This supports your current weight and activity level.",
            
            "improve_endurance": f"Prioritizing carbohydrates ({carbs:.0f}g) to fuel your endurance training, with {protein:.0f}g protein for muscle recovery. Total calories: {calories:.0f}.",
            
            "lower_cholesterol": f"Lower fat intake ({fat:.0f}g) and increased fiber ({fiber:.0f}g) to support heart health. Protein at {protein:.0f}g helps maintain muscle.",
            
            "increase_iron": f"Elevated iron target to support healthy blood cells. Balanced macros: {protein:.0f}g protein, {carbs:.0f}g carbs, {fat:.0f}g fat."
        }
        
        return explanations.get(primary_goal, f"Personalized plan: {calories:.0f} calories, {protein:.0f}g protein, {carbs:.0f}g carbs, {fat:.0f}g fat.")
    
    @staticmethod
    def calculate_all_goals(profile: dict, user_goals: dict) -> PersonalizedNutritionGoals:
        """Calculate ALL nutrition goals dynamically from profile - NO HARDCODING"""
        
        # Extract profile data
        weight = profile.get("weight", 70)
        height = profile.get("height", 170)
        age = profile.get("age", 30)
        gender = profile.get("gender", "male")
        primary_goal = user_goals.get("primary_goal", "maintain_weight")
        activity_level = user_goals.get("activity_level", "moderate")
        
        # Calculate BMR and TDEE
        bmr = GoalCalculator.calculate_bmr(weight, height, age, gender)
        tdee = GoalCalculator.calculate_tdee(bmr, activity_level)
        calorie_goal = GoalCalculator.calculate_adjusted_calories(tdee, primary_goal, weight)
        
        # Calculate all macros
        protein_goal = GoalCalculator.calculate_protein_goal(weight, primary_goal, activity_level)
        carb_goal = GoalCalculator.calculate_carb_goal(calorie_goal, primary_goal, activity_level)
        fat_goal = GoalCalculator.calculate_fat_goal(calorie_goal, primary_goal)
        
        # Calculate micronutrients
        fiber_goal = GoalCalculator.calculate_fiber_goal(weight, calorie_goal)
        cholesterol_limit = GoalCalculator.calculate_cholesterol_limit(primary_goal, weight)
        iron_goal = GoalCalculator.calculate_iron_goal(gender, weight, primary_goal)
        calcium_goal = GoalCalculator.calculate_calcium_goal(age, gender)
        vitamin_d_goal = GoalCalculator.calculate_vitamin_d_goal(age, activity_level)
        water_goal = GoalCalculator.calculate_water_goal(weight, activity_level, calorie_goal)
        
        # Generate explanation
        explanation = GoalCalculator.generate_explanation(
            primary_goal, weight, calorie_goal, protein_goal, carb_goal, fat_goal, fiber_goal
        )
        
        return PersonalizedNutritionGoals(
            protein_goal=protein_goal,
            calorie_goal=calorie_goal,
            carb_goal=carb_goal,
            fat_goal=fat_goal,
            fiber_goal=fiber_goal,
            cholesterol_limit=cholesterol_limit,
            iron_goal=iron_goal,
            calcium_goal=calcium_goal,
            vitamin_d_goal=vitamin_d_goal,
            water_goal=water_goal,
            explanation=explanation
        )
