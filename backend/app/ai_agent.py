import os
import json
import re
from groq import Groq
from typing import Dict, List, Optional
from .mcp_tools import MCPTools
from .database import Database

class AIHealthAgent:
    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY")
        self.client = Groq(api_key=api_key) if api_key else None
        self.mcp = MCPTools()
        self.db = Database()
        
        # Model configuration with fallback order
        self.models = {
            "primary": {
                "name": "meta-llama/llama-prompt-guard-2-86m",
                "max_tokens": 86000,  # 86K token limit
                "role": "primary",
                "guard": True  # Has prompt guard built-in
            },
            "secondary": {
                "name": "meta-llama/llama-prompt-guard-2-22m", 
                "max_tokens": 22000,  # 22K token limit
                "role": "secondary",
                "guard": True
            },
            "tertiary": {
                "name": "meta-llama/llama-4-scout-17b-16e-instruct",
                "max_tokens": 16000,  # 16K token limit (16e means 16K)
                "role": "tertiary",
                "guard": False  # No built-in prompt guard
            }
        }
        
        # Track token usage
        self.token_usage = {
            "primary": {"used": 0, "limit": 86000},
            "secondary": {"used": 0, "limit": 22000},
            "tertiary": {"used": 0, "limit": 16000}
        }
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation (4 chars ≈ 1 token)"""
        return len(text) // 4
    
    def _get_model_for_query(self, query: str, context: str) -> Dict:
        """Determine which model to use based on token limit"""
        total_text = query + context
        estimated_tokens = self._estimate_tokens(total_text)
        
        # Check token limits in order
        if estimated_tokens <= self.models["primary"]["max_tokens"]:
            return self.models["primary"]
        elif estimated_tokens <= self.models["secondary"]["max_tokens"]:
            return self.models["secondary"]
        else:
            return self.models["tertiary"]
    
    def _is_personal_info(self, text: str) -> bool:
        """Check if query contains personal information"""
        patterns = [
            r'\b\d{10}\b',  # phone number
            r'\b[\w\.-]+@[\w\.-]+\.\w+\b',  # email
            r'\b\d{6}\b',  # potential pincode
            r'\b(?:whatsapp|phone|mobile|call|text|sms)\s*:?\s*\d{10}\b',  # phone with label
            r'\b(?:email|mail)\s*:?\s*[\w\.-]+@[\w\.-]+\.\w+\b'  # email with label
        ]
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def _has_prompt_injection(self, text: str) -> bool:
        """Detect potential prompt injection attempts"""
        injection_patterns = [
            r'ignore previous instructions',
            r'forget your instructions',
            r'disregard your role',
            r'you are now',
            r'system prompt',
            r'new role:',
            r'pretend you are',
            r'act as if',
            r'break your rules',
            r'bypass your safety',
            r'ignore your guidelines'
        ]
        text_lower = text.lower()
        for pattern in injection_patterns:
            if pattern in text_lower:
                return True
        return False
    
    async def get_response(self, query: str, context: Dict) -> Dict:
        """Get AI response with multi-model fallback and security"""
        
        # Security checks
        if self._is_personal_info(query):
            return {
                "response": "I can't respond to questions containing personal information like phone numbers or email addresses. Please ask about nutrition, fitness, or health goals.",
                "from_cache": False,
                "security_flag": "personal_info",
                "model_used": None
            }
        
        if self._has_prompt_injection(query):
            return {
                "response": "I notice your question contains instructions that I cannot follow. Please ask your nutrition or health question directly.",
                "from_cache": False,
                "security_flag": "prompt_injection",
                "model_used": None
            }
        
        # Check cache first (to save tokens)
        cached = self.db.get_cached_ai_response(query)
        if cached:
            return {
                "response": cached,
                "from_cache": True,
                "security_flag": None,
                "model_used": "cache"
            }
        
        # Prepare context
        profile = context.get("profile", {})
        bmi = profile.get("bmi", 0)
        nickname = profile.get("nickname", "Athlete")
        today = context.get("today", {})
        goals = context.get("goals", {})
        
        prompt = f"""You are a health and nutrition coach for {nickname} (BMI: {bmi:.1f}).

Current Status:
- Today's Protein: {today.get('protein', 0)}/{goals.get('protein_goal', 100)}g
- Today's Cholesterol: {today.get('cholesterol', 0)}/{goals.get('cholesterol_limit', 300)}mg
- Today's Carbs: {today.get('carbs', 0)}/{goals.get('carb_limit', 300)}g
- Today's Iron: {today.get('iron', 0)}/{goals.get('iron_goal', 15)}mg

User Question: {query}

Provide a helpful, encouraging response (2-3 sentences). Focus on nutrition, fitness, and health goals. Be specific with food suggestions and amounts."""
        
        # Get the appropriate model based on token estimation
        model_config = self._get_model_for_query(query, prompt)
        
        try:
            if not self.client:
                # Fallback responses without API
                response = await self._fallback_response(query, context)
                self.db.cache_ai_response(query, response)
                return {
                    "response": response,
                    "from_cache": False,
                    "security_flag": None,
                    "model_used": "fallback"
                }
            
            # Try primary model
            response = await self._call_model(model_config, prompt)
            
            # Cache successful response
            self.db.cache_ai_response(query, response)
            
            # Update token usage tracking
            estimated_used = self._estimate_tokens(prompt + response)
            self.token_usage[model_config["role"]]["used"] += estimated_used
            
            return {
                "response": response,
                "from_cache": False,
                "security_flag": None,
                "model_used": model_config["name"],
                "tokens_estimated": estimated_used,
                "tokens_remaining": self.models[model_config["role"]]["max_tokens"] - self.token_usage[model_config["role"]]["used"]
            }
            
        except Exception as e:
            error_msg = str(e)
            
            # Token limit exceeded - try next model
            if "token" in error_msg.lower() or "context_length" in error_msg.lower():
                # Try secondary model if primary failed
                if model_config["role"] == "primary":
                    secondary_model = self.models["secondary"]
                    try:
                        response = await self._call_model(secondary_model, prompt)
                        self.db.cache_ai_response(query, response)
                        return {
                            "response": response,
                            "from_cache": False,
                            "security_flag": None,
                            "model_used": secondary_model["name"],
                            "fallback": True
                        }
                    except Exception as e2:
                        # Try tertiary model
                        tertiary_model = self.models["tertiary"]
                        try:
                            response = await self._call_model(tertiary_model, prompt)
                            self.db.cache_ai_response(query, response)
                            return {
                                "response": response,
                                "from_cache": False,
                                "security_flag": None,
                                "model_used": tertiary_model["name"],
                                "fallback": True
                            }
                        except Exception as e3:
                            return {
                                "response": "Your question is quite complex. Could you break it down into smaller parts?",
                                "from_cache": False,
                                "error": str(e3),
                                "model_used": None
                            }
                else:
                    return {
                        "response": "I'm having trouble processing that request. Please try rephrasing your question.",
                        "from_cache": False,
                        "error": error_msg,
                        "model_used": None
                    }
            else:
                return {
                    "response": f"I encountered an error: {error_msg[:100]}. Please try again.",
                    "from_cache": False,
                    "error": error_msg,
                    "model_used": None
                }
    
    async def _call_model(self, model_config: Dict, prompt: str) -> str:
        """Call a specific model with the prompt"""
        try:
            # For models with built-in prompt guard
            if model_config.get("guard"):
                # Add guard instruction
                guarded_prompt = f"""[INST] You are a health coach. Provide safe, helpful responses.
                
{prompt}[/INST]"""
                response = self.client.chat.completions.create(
                    model=model_config["name"],
                    messages=[{"role": "user", "content": guarded_prompt}],
                    temperature=0.7,
                    max_tokens=500
                )
            else:
                # Standard call for tertiary model
                response = self.client.chat.completions.create(
                    model=model_config["name"],
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7,
                    max_tokens=500
                )
            
            return response.choices[0].message.content
            
        except Exception as e:
            raise Exception(f"Model {model_config['name']} failed: {str(e)}")
    
    async def _fallback_response(self, query: str, context: Dict) -> str:
        """Fallback responses when Groq API is not available"""
        query_lower = query.lower()
        today = context.get("today", {})
        goals = context.get("goals", {})
        remaining_protein = max(0, goals.get("protein_goal", 100) - today.get("protein", 0))
        remaining_iron = max(0, goals.get("iron_goal", 15) - today.get("iron", 0))
        
        # Iron-specific responses
        if "iron" in query_lower:
            if remaining_iron > 10:
                return f"You need {remaining_iron:.1f}mg more iron today. Great sources: Spinach (6mg/cup), Lentils (3mg/cup), Beef (2.5mg/100g)."
            elif remaining_iron > 5:
                return f"You need {remaining_iron:.1f}mg more iron. Try: 1 cup spinach (6mg) or 100g beef (2.5mg)."
            elif remaining_iron > 0:
                return f"Only {remaining_iron:.1f}mg iron needed! A handful of pumpkin seeds (2mg) or 1 egg (1mg) will help."
            else:
                return "Great job! You've met your iron goal today!"
        
        elif "protein" in query_lower:
            if remaining_protein > 50:
                return f"You need {remaining_protein}g more protein. Try Beef Chukka (40g) + 2 eggs (12g) = 52g protein."
            elif remaining_protein > 20:
                return f"You need {remaining_protein}g more protein. Chickpeas (15g) + 1 egg (6g) would work well."
            elif remaining_protein > 0:
                return f"Only {remaining_protein}g more protein needed! A small snack like 1 egg (6g) will get you there."
            else:
                return "Great job! You've met your protein goal!"
        
        elif "cholesterol" in query_lower:
            remaining_chol = max(0, goals.get("cholesterol_limit", 300) - today.get("cholesterol", 0))
            if remaining_chol < 50:
                return "⚠️ Your cholesterol budget is almost used. Choose plant-based proteins like chickpeas or lentils."
            else:
                return f"You have {remaining_chol}mg cholesterol left today. Eggs (120mg each) are fine in moderation."
        
        elif "meal" in query_lower or "eat" in query_lower:
            if remaining_protein > 0:
                return f"Suggested meal: Beef Chukka (40g protein) + Spinach (6mg iron). That would cover your remaining {remaining_protein}g protein and {remaining_iron:.1f}mg iron!"
            else:
                return "You've met your protein goal! Focus on vegetables and healthy fats for recovery."
        
        elif "bmi" in query_lower:
            bmi = context.get("profile", {}).get("bmi", 0)
            if bmi < 18.5:
                return f"Your BMI is {bmi:.1f} (Underweight). Focus on protein-rich foods and healthy fats like nuts and avocados."
            elif bmi < 25:
                return f"Your BMI is {bmi:.1f} (Normal). Great job maintaining a healthy weight!"
            elif bmi < 30:
                return f"Your BMI is {bmi:.1f} (Overweight). Focus on portion control and regular exercise."
            else:
                return f"Your BMI is {bmi:.1f} (Obese). Consider consulting a nutritionist for a personalized plan."
        
        else:
            return f"Based on your progress, you need {remaining_protein}g more protein and {remaining_iron:.1f}mg more iron today. Try Beef Chukka for protein or Spinach for iron!"
    
    async def get_nutrition_prediction(self, food_name: str) -> Dict:
        """Predict nutrition for a new food item using AI"""
        # Try web search first
        nutrition = await self.mcp.get_nutrition_from_api(food_name)
        
        # If web search didn't find much, use AI
        if nutrition["protein"] == 0 and self.client:
            # Use tertiary model for this (smaller, faster)
            model_config = self.models["tertiary"]
            
            prompt = f"""Return ONLY JSON for nutrition of {food_name} per 100g:
{{
    "protein": grams,
    "carbs": grams,
    "cholesterol": mg,
    "iron": mg,
    "calories": kcal
}}
Use typical values. Return ONLY JSON, no other text."""
            
            try:
                response = self.client.chat.completions.create(
                    model=model_config["name"],
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                    max_tokens=150
                )
                content = response.choices[0].message.content
                # Extract JSON
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != 0:
                    nutrition = json.loads(content[start:end])
            except Exception as e:
                print(f"AI prediction error: {e}")
        
        return nutrition
    
    def get_token_usage_summary(self) -> Dict:
        """Get current token usage across all models"""
        return {
            "primary": {
                "used": self.token_usage["primary"]["used"],
                "limit": self.token_usage["primary"]["limit"],
                "remaining": self.token_usage["primary"]["limit"] - self.token_usage["primary"]["used"],
                "percentage": (self.token_usage["primary"]["used"] / self.token_usage["primary"]["limit"]) * 100
            },
            "secondary": {
                "used": self.token_usage["secondary"]["used"],
                "limit": self.token_usage["secondary"]["limit"],
                "remaining": self.token_usage["secondary"]["limit"] - self.token_usage["secondary"]["used"],
                "percentage": (self.token_usage["secondary"]["used"] / self.token_usage["secondary"]["limit"]) * 100
            },
            "tertiary": {
                "used": self.token_usage["tertiary"]["used"],
                "limit": self.token_usage["tertiary"]["limit"],
                "remaining": self.token_usage["tertiary"]["limit"] - self.token_usage["tertiary"]["used"],
                "percentage": (self.token_usage["tertiary"]["used"] / self.token_usage["tertiary"]["limit"]) * 100
            }
        }
