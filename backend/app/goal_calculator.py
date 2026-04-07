import math
from typing import Dict, Tuple, List
from .models import UserGoals, HealthGoal, ActivityLevel, PersonalizedNutritionGoals

class GoalCalculator:
    """Calculates personalized nutrition goals based on user's health objectives"""
    
    # Activity multipliers for BMR (Basal Metabolic Rate)
    ACTIVITY_MULTIPLIERS = {
        ActivityLevel.SEDENTARY: 1.2,
        ActivityLevel.LIGHT: 1.375,
        ActivityLevel.MODERATE: 1.55,
        ActivityLevel.ACTIVE: 1.725,
        ActivityLevel.VERY_ACTIVE: 1.9
    }
    
    # Protein multipliers (g per kg body weight) - CORRECTED VALUES
    PROTEIN_MULTIPLIERS = {
        HealthGoal.LOSE_WEIGHT: 1.6,      # Higher protein to preserve muscle (112g for 70kg)
        HealthGoal.MAINTAIN_WEIGHT: 1.2,   # Standard maintenance (84g for 70kg)
        HealthGoal.GAIN_MUSCLE: 1.8,       # Higher for muscle growth (126g for 70kg)
        HealthGoal.IMPROVE_ENDURANCE: 1.4, # Moderate for endurance (98g for 70kg)
        HealthGoal.LOWER_CHOLESTEROL: 1.2, # Standard with plant focus (84g for 70kg)
        HealthGoal.INCREASE_IRON: 1.3      # Slightly higher (91g for 70kg)
    }
    
    # Carb multipliers (g per kg body weight) - CORRECTED
    CARB_MULTIPLIERS = {
        HealthGoal.LOSE_WEIGHT: 3.0,       # 210g for 70kg
        HealthGoal.MAINTAIN_WEIGHT: 4.0,   # 280g for 70kg
        HealthGoal.GAIN_MUSCLE: 5.0,       # 350g for 70kg
        HealthGoal.IMPROVE_ENDURANCE: 6.0, # 420g for 70kg
        HealthGoal.LOWER_CHOLESTEROL: 3.5, # 245g for 70kg
        HealthGoal.INCREASE_IRON: 4.0      # 280g for 70kg
    }
    
    # Fat multipliers (g per kg body weight) - CORRECTED
    FAT_MULTIPLIERS = {
        HealthGoal.LOSE_WEIGHT: 0.8,       # 56g for 70kg
        HealthGoal.MAINTAIN_WEIGHT: 1.0,   # 70g for 70kg
        HealthGoal.GAIN_MUSCLE: 1.2,       # 84g for 70kg
        HealthGoal.IMPROVE_ENDURANCE: 1.1, # 77g for 70kg
        HealthGoal.LOWER_CHOLESTEROL: 0.7, # 49g for 70kg - Lower saturated fat
        HealthGoal.INCREASE_IRON: 1.0      # 70g for 70kg
    }
    
    @staticmethod
    def calculate_bmr(weight_kg: float, height_cm: float, age: int, gender: str = "male") -> float:
        """Calculate Basal Metabolic Rate using Mifflin-St Jeor equation"""
        if gender.lower() == "female":
            return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
        else:
            return (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
    
    @staticmethod
    def calculate_tdee(bmr: float, activity_level: ActivityLevel) -> float:
        """Calculate Total Daily Energy Expenditure"""
        return bmr * GoalCalculator.ACTIVITY_MULTIPLIERS[activity_level]
    
    @staticmethod
    def calculate_adjusted_calories(tdee: float, goal: HealthGoal, target_weight_change: float = 0.5) -> float:
        """Adjust calories based on health goal"""
        # 1 kg of body fat ≈ 7700 calories
        weekly_calorie_adjustment = target_weight_change * 7700
        daily_adjustment = weekly_calorie_adjustment / 7
        
        if goal == HealthGoal.LOSE_WEIGHT:
            return max(tdee - daily_adjustment, 1500)  # Never go below 1500 calories for men, 1200 for women
        elif goal == HealthGoal.GAIN_MUSCLE:
            return tdee + daily_adjustment
        else:
            return tdee
    
    @staticmethod
    def _get_bmi_category(bmi: float) -> str:
        """Get BMI category description"""
        if bmi < 18.5:
            return "Underweight"
        elif bmi < 25:
            return "Normal weight"
        elif bmi < 30:
            return "Overweight"
        else:
            return "Obese"
    
    @staticmethod
    def calculate_nutrition_goals(
        weight_kg: float,
        height_cm: float,
        age: int,
        gender: str,
        user_goals: UserGoals
    ) -> PersonalizedNutritionGoals:
        """Calculate complete personalized nutrition goals"""
        
        # Validate weight - should be in kg (typically 40-200kg range)
        if weight_kg < 20 or weight_kg > 300:
            # If weight seems off (maybe in lbs), assume it's kg but flag
            print(f"Warning: Weight {weight_kg}kg seems unusual")
        
        # Calculate BMR and TDEE
        bmr = GoalCalculator.calculate_bmr(weight_kg, height_cm, age, gender)
        tdee = GoalCalculator.calculate_tdee(bmr, user_goals.activity_level)
        calories = GoalCalculator.calculate_adjusted_calories(
            tdee, 
            user_goals.primary_goal,
            user_goals.weekly_weight_change if user_goals.primary_goal in [HealthGoal.LOSE_WEIGHT, HealthGoal.GAIN_MUSCLE] else 0
        )
        
        # Calculate macros based on goals - USING KG CORRECTLY
        protein_mult = GoalCalculator.PROTEIN_MULTIPLIERS[user_goals.primary_goal]
        carb_mult = GoalCalculator.CARB_MULTIPLIERS[user_goals.primary_goal]
        fat_mult = GoalCalculator.FAT_MULTIPLIERS[user_goals.primary_goal]
        
        protein_goal = weight_kg * protein_mult
        carb_goal = weight_kg * carb_mult
        fat_goal = weight_kg * fat_mult
        
        # Safety caps - never exceed these maximums
        max_protein = weight_kg * 2.2  # Absolute max 2.2g per kg
        max_carbs = weight_kg * 8.0    # Absolute max 8g per kg
        max_fat = weight_kg * 1.5      # Absolute max 1.5g per kg
        
        protein_goal = min(protein_goal, max_protein)
        carb_goal = min(carb_goal, max_carbs)
        fat_goal = min(fat_goal, max_fat)
        
        # Adjust for secondary goals
        cholesterol_limit = 300
        if HealthGoal.LOWER_CHOLESTEROL in user_goals.secondary_goals:
            fat_goal = min(fat_goal, weight_kg * 0.7)  # Lower fat for cholesterol
            cholesterol_limit = 200  # Stricter limit
        
        # Iron goals based on gender and secondary goals
        if HealthGoal.INCREASE_IRON in user_goals.secondary_goals:
            iron_goal = 18 if gender.lower() == "female" else 12
        else:
            iron_goal = 15 if gender.lower() == "female" else 10
        
        # Calculate fiber (0.3g per kg, minimum 25g, maximum 40g)
        fiber_goal = min(max(weight_kg * 0.3, 25), 40)
        
        # Calculate water (33ml per kg, minimum 2L, maximum 4L)
        water_goal = min(max(weight_kg * 0.033, 2.0), 4.0)
        
        # Generate explanation
        explanation = GoalCalculator._generate_explanation(
            user_goals.primary_goal,
            user_goals.secondary_goals,
            weight_kg,
            calories,
            protein_goal,
            carb_goal,
            fat_goal
        )
        
        return PersonalizedNutritionGoals(
            protein_goal=round(protein_goal, 1),
            calorie_goal=round(calories, 0),
            carb_goal=round(carb_goal, 1),
            fat_goal=round(fat_goal, 1),
            fiber_goal=round(fiber_goal, 1),
            cholesterol_limit=cholesterol_limit,
            iron_goal=round(iron_goal, 1),
            calcium_goal=1000,
            vitamin_d_goal=600,
            water_goal=round(water_goal, 1),
            explanation=explanation
        )
    
    @staticmethod
    def _generate_explanation(primary_goal: HealthGoal, secondary_goals: List[HealthGoal], 
                              weight: float, calories: float, protein: float, carbs: float, fat: float) -> str:
        """Generate human-readable explanation of goals"""
        
        goal_messages = {
            HealthGoal.LOSE_WEIGHT: f"Based on your weight loss goal, we've created a calorie deficit. This should help you lose about 0.5kg per week while preserving muscle mass.",
            HealthGoal.MAINTAIN_WEIGHT: f"Your calorie target maintains your current weight while supporting your activity level.",
            HealthGoal.GAIN_MUSCLE: f"To build muscle, we've added a slight calorie surplus. Combined with adequate protein ({protein:.0f}g), this supports muscle growth.",
            HealthGoal.IMPROVE_ENDURANCE: f"For endurance training, we've prioritized carbohydrates ({carbs:.0f}g) to fuel your workouts while maintaining adequate protein for recovery.",
            HealthGoal.LOWER_CHOLESTEROL: f"Your goals focus on heart health with lower fat limits ({fat:.0f}g) and increased fiber from whole grains and vegetables.",
            HealthGoal.INCREASE_IRON: f"We've increased your iron target to support healthy blood cells. Pair iron-rich foods with vitamin C for better absorption."
        }
        
        base = goal_messages.get(primary_goal, "Your personalized nutrition plan is based on your health goals.")
        
        # Add secondary goal notes
        secondary_note = ""
        if HealthGoal.LOWER_CHOLESTEROL in secondary_goals:
            secondary_note = " To lower cholesterol, focus on unsaturated fats and avoid trans fats."
        if HealthGoal.INCREASE_IRON in secondary_goals:
            secondary_note += " For iron absorption, pair iron-rich foods with vitamin C (citrus fruits, bell peppers)."
        
        return f"{base}{secondary_note} Your daily targets: {calories:.0f} calories, {protein:.0f}g protein, {carbs:.0f}g carbs, {fat:.0f}g fat."
    
    @staticmethod
    def get_recommended_ranges(weight_kg: float, goal: HealthGoal) -> Dict:
        """Get recommended nutrition ranges for display"""
        protein_mult = GoalCalculator.PROTEIN_MULTIPLIERS[goal]
        carb_mult = GoalCalculator.CARB_MULTIPLIERS[goal]
        fat_mult = GoalCalculator.FAT_MULTIPLIERS[goal]
        
        return {
            "protein": {
                "min": round(weight_kg * (protein_mult - 0.2), 1),
                "max": round(weight_kg * (protein_mult + 0.2), 1),
                "unit": "g"
            },
            "carbs": {
                "min": round(weight_kg * (carb_mult - 0.5), 1),
                "max": round(weight_kg * (carb_mult + 0.5), 1),
                "unit": "g"
            },
            "fat": {
                "min": round(weight_kg * (fat_mult - 0.2), 1),
                "max": round(weight_kg * (fat_mult + 0.2), 1),
                "unit": "g"
            }
        }
