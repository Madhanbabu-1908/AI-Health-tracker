from .ai_agent import AIHealthAgent
from .mcp_tools import MCPTools
from .database import Database
from typing import Dict, Any, List
from datetime import datetime, timedelta
import csv
import io

class AgenticOrchestrator:
    """Centralized orchestration for all AI agents and tools"""
    
    def __init__(self):
        self.ai_agent = AIHealthAgent()
        self.mcp = MCPTools()
        self.db = Database()
    
    async def process_ai_query(self, query: str, user_context: Dict) -> Dict:
        """Process AI query with orchestration"""
        result = await self.ai_agent.get_response(query, user_context)
        return result
    
    async def generate_report(self, start_date: str, end_date: str) -> Dict:
        """Generate CSV report for date range"""
        entries = self.db.get_entries_by_date_range(start_date, end_date)
        
        # Calculate totals per day
        daily_totals = []
        for date, daily_entries in entries.items():
            total = {"date": date, "protein": 0, "carbs": 0, "cholesterol": 0, "iron": 0, "calories": 0, "cost": 0}
            for entry in daily_entries:
                total["protein"] += entry.get("protein", 0)
                total["carbs"] += entry.get("carbs", 0)
                total["cholesterol"] += entry.get("cholesterol", 0)
                total["iron"] += entry.get("iron", 0)
                total["calories"] += entry.get("calories", 0)
                total["cost"] += entry.get("cost", 0)
            daily_totals.append(total)
        
        # Generate CSV
        output = io.StringIO()
        if daily_totals:
            writer = csv.DictWriter(output, fieldnames=["date", "protein", "carbs", "cholesterol", "iron", "calories", "cost"])
            writer.writeheader()
            writer.writerows(daily_totals)
        
        # Delete old entries (older than 30 days)
        deleted = self.db.delete_entries_older_than(30)
        
        return {
            "csv_content": output.getvalue(),
            "days_count": len(daily_totals),
            "deleted_entries_count": len(deleted),
            "report_period": f"{start_date} to {end_date}"
        }
    
    async def log_food(self, food_name: str, quantity: float, unit: str = "serving", cost: float = None) -> Dict:
        """Log a food entry"""
        food_item = self.db.get_food_item(food_name)
        
        if not food_item:
            return {
                "success": False,
                "error": f"Food '{food_name}' not found. Please add it first in Add Food section.",
                "suggestions": [f.name for f in self.db.get_food_items()[:5]]
            }
        
        actual_cost = cost if cost is not None else food_item.cost * quantity
        
        entry = FoodEntry(
            id=str(uuid.uuid4())[:8],
            name=food_name,
            protein=food_item.protein * quantity,
            carbs=food_item.carbs * quantity,
            cholesterol=food_item.cholesterol * quantity,
            iron=food_item.iron * quantity,
            calories=food_item.calories * quantity,
            cost=actual_cost,
            quantity=quantity,
            unit=unit
        )
        
        self.db.add_food_entry(entry)
        
        return {
            "success": True,
            "entry": entry.dict(),
            "message": f"✅ Logged {quantity} × {food_name}"
        }
    
    async def add_new_food(self, name: str, cost: float, unit: str = "serving") -> Dict:
        """Add new food with AI-predicted nutrition"""
        # Get nutrition prediction from AI
        nutrition = await self.ai_agent.get_nutrition_prediction(name)
        
        food_item = FoodItem(
            id=str(uuid.uuid4())[:8],
            name=name,
            protein=nutrition.get("protein", 0),
            carbs=nutrition.get("carbs", 0),
            cholesterol=nutrition.get("cholesterol", 0),
            iron=nutrition.get("iron", 0),
            calories=nutrition.get("calories", 0),
            cost=cost,
            default_unit=unit
        )
        
        self.db.add_food_item(food_item)
        
        return {
            "success": True,
            "food": food_item.dict(),
            "nutrition_predicted": nutrition,
            "message": f"✅ Added '{name}' to your food database!"
        }
    
    async def get_nutrition_analysis(self, date_range: str = "week") -> Dict:
        """Get nutrition analysis for a date range"""
        days = {"week": 7, "weeks": 14, "weeks3": 21, "month": 30}.get(date_range, 7)
        
        entries = self.db.get_last_n_days_entries(days)
        goals = self.db.get_nutrition_goals()
        
        # Calculate daily averages
        daily_protein = []
        daily_cholesterol = []
        daily_carbs = []
        daily_iron = []
        
        for date, daily_entries in entries.items():
            day_protein = sum(e.get("protein", 0) for e in daily_entries)
            day_cholesterol = sum(e.get("cholesterol", 0) for e in daily_entries)
            day_carbs = sum(e.get("carbs", 0) for e in daily_entries)
            day_iron = sum(e.get("iron", 0) for e in daily_entries)
            
            daily_protein.append(day_protein)
            daily_cholesterol.append(day_cholesterol)
            daily_carbs.append(day_carbs)
            daily_iron.append(day_iron)
        
        return {
            "date_range": f"Last {days} days",
            "protein": {
                "average": sum(daily_protein) / len(daily_protein) if daily_protein else 0,
                "goal": goals.protein_goal,
                "goal_hit_percentage": sum(1 for p in daily_protein if p >= goals.protein_goal) / len(daily_protein) * 100 if daily_protein else 0
            },
            "cholesterol": {
                "average": sum(daily_cholesterol) / len(daily_cholesterol) if daily_cholesterol else 0,
                "limit": goals.cholesterol_limit,
                "within_limit_percentage": sum(1 for c in daily_cholesterol if c <= goals.cholesterol_limit) / len(daily_cholesterol) * 100 if daily_cholesterol else 0
            },
            "carbs": {
                "average": sum(daily_carbs) / len(daily_carbs) if daily_carbs else 0,
                "limit": goals.carb_limit
            },
            "iron": {
                "average": sum(daily_iron) / len(daily_iron) if daily_iron else 0,
                "goal": goals.iron_goal
            },
            "daily_data": {
                "dates": list(entries.keys()),
                "protein": daily_protein,
                "cholesterol": daily_cholesterol,
                "carbs": daily_carbs,
                "iron": daily_iron
            }
        }
