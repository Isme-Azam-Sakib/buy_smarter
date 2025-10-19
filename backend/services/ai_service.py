import google.generativeai as genai
import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models import MasterProduct, PriceEntry
from schemas import (
    ComponentRecommendationResponse, 
    CompatibilityCheckResponse, 
    PriceTrendAnalysisResponse
)
import json
from datetime import datetime, timedelta

class AIService:
    def __init__(self):
        # Initialize Gemini Pro
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            self.model = None
            print("Warning: GEMINI_API_KEY not found. AI features will be disabled.")

    async def recommend_components(
        self, 
        db: Session, 
        current_build: Dict[str, Any],
        budget: Optional[float] = None
    ) -> ComponentRecommendationResponse:
        """Get AI recommendations for next component"""
        if not self.model:
            return self._fallback_recommendations(current_build, budget)
        
        try:
            # Get compatible components from database
            compatible_components = await self._get_compatible_components(db, current_build)
            
            # Prepare prompt for Gemini
            prompt = self._build_recommendation_prompt(current_build, compatible_components, budget)
            
            # Get AI response
            response = self.model.generate_content(prompt)
            
            # Parse response
            recommendations = self._parse_recommendation_response(response.text)
            
            return ComponentRecommendationResponse(
                recommendations=recommendations,
                reasoning=response.text,
                budget_analysis=self._analyze_budget(current_build, budget)
            )
            
        except Exception as e:
            print(f"AI recommendation error: {e}")
            return self._fallback_recommendations(current_build, budget)

    async def check_build_compatibility(
        self, 
        db: Session, 
        build_components: List[Dict[str, Any]]
    ) -> CompatibilityCheckResponse:
        """Check PC build compatibility using AI"""
        if not self.model:
            return self._fallback_compatibility_check(build_components)
        
        try:
            # Get detailed specs for all components
            detailed_components = await self._get_detailed_component_specs(db, build_components)
            
            # Prepare prompt for Gemini
            prompt = self._build_compatibility_prompt(detailed_components)
            
            # Get AI response
            response = self.model.generate_content(prompt)
            
            # Parse response
            analysis = self._parse_compatibility_response(response.text)
            
            return CompatibilityCheckResponse(
                is_compatible=analysis.get("is_compatible", False),
                issues=analysis.get("issues", []),
                suggestions=analysis.get("suggestions", []),
                power_requirement=analysis.get("power_requirement")
            )
            
        except Exception as e:
            print(f"AI compatibility check error: {e}")
            return self._fallback_compatibility_check(build_components)

    async def analyze_price_trend(
        self, 
        db: Session, 
        product_id: int
    ) -> PriceTrendAnalysisResponse:
        """Analyze price trend for a product"""
        if not self.model:
            return self._fallback_price_analysis(product_id)
        
        try:
            # Get price history
            price_history = await self._get_price_history(db, product_id)
            
            if not price_history:
                return PriceTrendAnalysisResponse(
                    current_price=0,
                    price_trend="stable",
                    recommendation="watch",
                    confidence=0.0,
                    analysis="No price history available"
                )
            
            # Prepare prompt for Gemini
            prompt = self._build_price_analysis_prompt(price_history)
            
            # Get AI response
            response = self.model.generate_content(prompt)
            
            # Parse response
            analysis = self._parse_price_analysis_response(response.text, price_history)
            
            return analysis
            
        except Exception as e:
            print(f"AI price analysis error: {e}")
            return self._fallback_price_analysis(product_id)

    def _build_recommendation_prompt(
        self, 
        current_build: Dict[str, Any], 
        compatible_components: List[Dict[str, Any]],
        budget: Optional[float]
    ) -> str:
        """Build prompt for component recommendations"""
        prompt = f"""
        Analyze this PC build and recommend the next best component to add:
        
        Current Build: {json.dumps(current_build, indent=2)}
        Available Components: {json.dumps(compatible_components[:10], indent=2)}
        Budget: {budget if budget else 'No specific budget'}
        
        Please provide:
        1. Top 3 component recommendations with reasoning
        2. Performance impact analysis
        3. Value for money assessment
        4. Any potential bottlenecks to avoid
        
        Format your response as JSON with the following structure:
        {{
            "recommendations": [
                {{
                    "component_id": int,
                    "name": "string",
                    "reasoning": "string",
                    "performance_impact": "string",
                    "value_score": float
                }}
            ],
            "reasoning": "Overall analysis and recommendations"
        }}
        """
        return prompt

    def _build_compatibility_prompt(self, detailed_components: List[Dict[str, Any]]) -> str:
        """Build prompt for compatibility checking"""
        prompt = f"""
        Analyze this PC build for compatibility issues:
        
        Components: {json.dumps(detailed_components, indent=2)}
        
        Check for:
        1. Socket compatibility (CPU-Motherboard)
        2. RAM compatibility (Type, speed, capacity)
        3. Power supply adequacy
        4. Physical fit (GPU length, CPU cooler height)
        5. Any other compatibility issues
        
        Format your response as JSON:
        {{
            "is_compatible": boolean,
            "issues": ["list of compatibility issues"],
            "suggestions": ["list of improvement suggestions"],
            "power_requirement": int,
            "reasoning": "Detailed analysis"
        }}
        """
        return prompt

    def _build_price_analysis_prompt(self, price_history: List[Dict[str, Any]]) -> str:
        """Build prompt for price trend analysis"""
        prompt = f"""
        Analyze the price trend for this product:
        
        Price History: {json.dumps(price_history, indent=2)}
        
        Determine:
        1. Current price trend (up/down/stable)
        2. Whether to buy now or wait
        3. Confidence level in recommendation
        4. Reasoning for the recommendation
        
        Format your response as JSON:
        {{
            "trend": "up/down/stable",
            "recommendation": "buy_now/wait/watch",
            "confidence": float,
            "reasoning": "Detailed analysis"
        }}
        """
        return prompt

    def _parse_recommendation_response(self, response_text: str) -> List[Dict[str, Any]]:
        """Parse AI response for recommendations"""
        try:
            # Extract JSON from response
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            json_str = response_text[start:end]
            data = json.loads(json_str)
            return data.get("recommendations", [])
        except:
            return []

    def _parse_compatibility_response(self, response_text: str) -> Dict[str, Any]:
        """Parse AI response for compatibility check"""
        try:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            json_str = response_text[start:end]
            return json.loads(json_str)
        except:
            return {"is_compatible": False, "issues": ["Unable to analyze"], "suggestions": []}

    def _parse_price_analysis_response(
        self, 
        response_text: str, 
        price_history: List[Dict[str, Any]]
    ) -> PriceTrendAnalysisResponse:
        """Parse AI response for price analysis"""
        try:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            json_str = response_text[start:end]
            data = json.loads(json_str)
            
            current_price = price_history[0]["price"] if price_history else 0
            
            return PriceTrendAnalysisResponse(
                current_price=current_price,
                price_trend=data.get("trend", "stable"),
                recommendation=data.get("recommendation", "watch"),
                confidence=data.get("confidence", 0.5),
                analysis=data.get("reasoning", "Analysis unavailable")
            )
        except:
            return PriceTrendAnalysisResponse(
                current_price=0,
                price_trend="stable",
                recommendation="watch",
                confidence=0.0,
                analysis="Unable to analyze price trend"
            )

    async def _get_compatible_components(
        self, 
        db: Session, 
        current_build: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get compatible components from database"""
        # This would query the database for compatible components
        # For now, return empty list
        return []

    async def _get_detailed_component_specs(
        self, 
        db: Session, 
        build_components: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Get detailed specs for build components"""
        # This would query the database for detailed component specs
        # For now, return the components as-is
        return build_components

    async def _get_price_history(
        self, 
        db: Session, 
        product_id: int
    ) -> List[Dict[str, Any]]:
        """Get price history for a product"""
        prices = db.query(PriceEntry).filter(
            PriceEntry.master_product_id == product_id
        ).order_by(PriceEntry.scraped_timestamp.desc()).limit(30).all()
        
        return [
            {
                "price": price.scraped_price,
                "date": price.scraped_timestamp.isoformat(),
                "vendor": price.vendor.name
            }
            for price in prices
        ]

    def _fallback_recommendations(
        self, 
        current_build: Dict[str, Any], 
        budget: Optional[float]
    ) -> ComponentRecommendationResponse:
        """Fallback recommendations when AI is unavailable"""
        return ComponentRecommendationResponse(
            recommendations=[],
            reasoning="AI service unavailable. Please try again later.",
            budget_analysis=None
        )

    def _fallback_compatibility_check(
        self, 
        build_components: List[Dict[str, Any]]
    ) -> CompatibilityCheckResponse:
        """Fallback compatibility check when AI is unavailable"""
        return CompatibilityCheckResponse(
            is_compatible=True,
            issues=["AI compatibility check unavailable"],
            suggestions=["Please verify compatibility manually"],
            power_requirement=None
        )

    def _fallback_price_analysis(self, product_id: int) -> PriceTrendAnalysisResponse:
        """Fallback price analysis when AI is unavailable"""
        return PriceTrendAnalysisResponse(
            current_price=0,
            price_trend="stable",
            recommendation="watch",
            confidence=0.0,
            analysis="AI price analysis unavailable"
        )

    def _analyze_budget(
        self, 
        current_build: Dict[str, Any], 
        budget: Optional[float]
    ) -> Optional[Dict[str, Any]]:
        """Analyze budget constraints"""
        if not budget:
            return None
        
        current_total = sum(comp.get("price", 0) for comp in current_build.values())
        remaining = budget - current_total
        
        return {
            "total_budget": budget,
            "current_total": current_total,
            "remaining_budget": remaining,
            "budget_utilization": (current_total / budget) * 100 if budget > 0 else 0
        }
    
    # New methods for product reconciliation
    
    def match_product_with_candidates(
        self, 
        scraped_product: Dict[str, Any], 
        candidates: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """
        Use Gemini Pro to match a scraped product with candidate master products
        
        Args:
            scraped_product: The scraped product data
            candidates: List of candidate master products
            
        Returns:
            Dict with match result or None
        """
        if not self.model:
            return None
        
        try:
            prompt = self._build_matching_prompt(scraped_product, candidates)
            response = self.model.generate_content(prompt)
            return self._parse_matching_response(response.text, candidates)
            
        except Exception as e:
            print(f"Error in AI matching: {e}")
            return None
    
    def validate_and_enrich_product(
        self, 
        scraped_product: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Use Gemini Pro to validate and enrich scraped product data
        
        Args:
            scraped_product: Raw scraped product data
            
        Returns:
            Enriched product data or None
        """
        if not self.model:
            return None
        
        try:
            prompt = self._build_validation_prompt(scraped_product)
            response = self.model.generate_content(prompt)
            return self._parse_validation_response(response.text)
            
        except Exception as e:
            print(f"Error in AI validation: {e}")
            return None
    
    def _build_matching_prompt(
        self, 
        scraped_product: Dict[str, Any], 
        candidates: List[Dict[str, Any]]
    ) -> str:
        """Build prompt for product matching"""
        scraped_name = scraped_product.get('name', '')
        scraped_brand = scraped_product.get('brand', '')
        scraped_category = scraped_product.get('category', '')
        scraped_price = scraped_product.get('price', 0)
        
        candidates_text = "\n".join([
            f"{i+1}. {c['name']} (Brand: {c['brand']}, ID: {c['id']})"
            for i, c in enumerate(candidates)
        ])
        
        return f"""
You are a product matching expert. Match the scraped product with the most appropriate master product from the candidates.

SCRAPED PRODUCT:
- Name: {scraped_name}
- Brand: {scraped_brand}
- Category: {scraped_category}
- Price: {scraped_price} BDT

CANDIDATE MASTER PRODUCTS:
{candidates_text}

INSTRUCTIONS:
1. Find the best match for the scraped product
2. Consider name similarity, brand match, and category
3. Return ONLY the candidate number (1-{len(candidates)}) of the best match
4. If no good match exists, return "NO_MATCH"
5. Also provide a confidence score (0-100)

RESPONSE FORMAT:
MATCH: [candidate_number or NO_MATCH]
CONFIDENCE: [0-100]
REASONING: [brief explanation]
"""
    
    def _build_validation_prompt(self, scraped_product: Dict[str, Any]) -> str:
        """Build prompt for product validation and enrichment"""
        scraped_name = scraped_product.get('name', '')
        scraped_brand = scraped_product.get('brand', '')
        scraped_category = scraped_product.get('category', '')
        scraped_price = scraped_product.get('price', 0)
        
        return f"""
You are a product data validation expert. Clean and standardize the scraped product data.

SCRAPED PRODUCT:
- Name: {scraped_name}
- Brand: {scraped_brand}
- Category: {scraped_category}
- Price: {scraped_price} BDT

INSTRUCTIONS:
1. Extract the clean, standardized product name
2. Identify the correct brand name
3. Determine the proper category
4. Validate the price is reasonable for the product type
5. Extract key specifications if mentioned in the name

RESPONSE FORMAT (JSON):
{{
    "standard_name": "Clean product name",
    "brand": "Correct brand name",
    "category": "cpu|gpu|ram|motherboard|psu|storage|case|cooling",
    "price": {scraped_price},
    "key_specs": {{
        "spec1": "value1",
        "spec2": "value2"
    }},
    "is_valid": true,
    "confidence": 85
}}
"""
    
    def _parse_matching_response(
        self, 
        response_text: str, 
        candidates: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Parse AI matching response"""
        try:
            lines = response_text.strip().split('\n')
            match_line = None
            confidence_line = None
            
            for line in lines:
                if line.startswith('MATCH:'):
                    match_line = line
                elif line.startswith('CONFIDENCE:'):
                    confidence_line = line
            
            if not match_line:
                return None
            
            match_text = match_line.split(':', 1)[1].strip()
            
            if match_text == 'NO_MATCH':
                return None
            
            try:
                candidate_index = int(match_text) - 1
                if 0 <= candidate_index < len(candidates):
                    candidate = candidates[candidate_index]
                    confidence = 80  # Default confidence
                    
                    if confidence_line:
                        try:
                            confidence = int(confidence_line.split(':', 1)[1].strip())
                        except:
                            pass
                    
                    return {
                        'master_product_id': candidate['id'],
                        'confidence': confidence,
                        'matched_name': candidate['name']
                    }
            except ValueError:
                return None
                
        except Exception as e:
            print(f"Error parsing matching response: {e}")
            return None
    
    def _parse_validation_response(self, response_text: str) -> Optional[Dict[str, Any]]:
        """Parse AI validation response"""
        try:
            # Try to extract JSON from response
            start_idx = response_text.find('{')
            end_idx = response_text.rfind('}') + 1
            
            if start_idx != -1 and end_idx > start_idx:
                json_text = response_text[start_idx:end_idx]
                return json.loads(json_text)
            
            return None
            
        except Exception as e:
            print(f"Error parsing validation response: {e}")
            return None
