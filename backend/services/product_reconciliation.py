"""
Product reconciliation service for matching scraped products with master catalog
Implements two-tier matching: Level 1 (RapidFuzz) and Level 2 (Gemini Pro AI)
"""

import json
from typing import List, Dict, Any, Optional, Tuple
from rapidfuzz import fuzz, process
from sqlalchemy.orm import Session
from models import MasterProduct
import re
import os

class ProductReconciliationService:
    """Service for reconciling scraped products with master product catalog"""
    
    def __init__(self, db: Session, ai_service=None):
        self.db = db
        self.ai_service = ai_service  # Optional AI service for Level 2 matching
        self.master_products_cache = {}
        self._load_master_products_cache()
    
    def _load_master_products_cache(self):
        """Load master products into cache for faster matching"""
        print("Loading master products cache...")
        
        # Load by category for better performance
        categories = ['CPU', 'GPU', 'RAM', 'Motherboard', 'PSU', 'Storage', 'Case', 'Cooling']
        
        for category in categories:
            products = self.db.query(MasterProduct).filter(
                MasterProduct.category == category
            ).all()
            
            self.master_products_cache[category] = []
            for product in products:
                self.master_products_cache[category].append({
                    'id': product.product_id,
                    'name': product.standard_name,
                    'brand': product.brand,
                    'specs': product.key_specs_json or {}
                })
        
        total_products = sum(len(products) for products in self.master_products_cache.values())
        print(f"Loaded {total_products} master products into cache")
    
    def reconcile_product(self, scraped_product: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Reconcile a scraped product with master catalog using two-tier matching
        
        Level 1: RapidFuzz fuzzy matching (≥95% confidence)
        Level 2: Gemini Pro AI matching (if Level 1 fails)
        
        Returns:
            Dict with master_product_id and confidence score, or None if no match
        """
        category = self._normalize_category(scraped_product.get('category', ''))
        
        if category not in self.master_products_cache:
            return None
        
        # Level 1: Fast fuzzy matching with RapidFuzz
        match_result = self._fuzzy_match(scraped_product, category)
        
        if match_result and match_result['confidence'] >= 95:
            print(f"Level 1 match: {match_result['matched_name']} ({match_result['confidence']:.1f}%)")
            return match_result
        
        # Level 2: Gemini Pro AI matching
        if self.ai_service:
            ai_match = self._ai_match(scraped_product, category)
            if ai_match:
                print(f"Level 2 AI match: {ai_match['matched_name']} ({ai_match['confidence']:.1f}%)")
                return ai_match
        
        # Fallback: Advanced matching with specifications
        advanced_match = self._advanced_match(scraped_product, category)
        
        if advanced_match and advanced_match['confidence'] >= 85:
            print(f"Advanced match: {advanced_match['matched_name']} ({advanced_match['confidence']:.1f}%)")
            return advanced_match
        
        # Final fallback: Brand + partial name matching
        brand_match = self._brand_match(scraped_product, category)
        
        if brand_match and brand_match['confidence'] >= 75:
            print(f"Brand match: {brand_match['matched_name']} ({brand_match['confidence']:.1f}%)")
            return brand_match
        
        print(f"No match found for: {scraped_product.get('name', 'Unknown')}")
        return None
    
    def _fuzzy_match(self, scraped_product: Dict[str, Any], category: str) -> Optional[Dict[str, Any]]:
        """Fast fuzzy matching using RapidFuzz"""
        scraped_name = scraped_product.get('name', '')
        scraped_brand = scraped_product.get('brand', '')
        
        if not scraped_name:
            return None
        
        # Get candidate products
        candidates = self.master_products_cache[category]
        
        # Create search strings
        search_strings = [
            scraped_name,
            f"{scraped_brand} {scraped_name}" if scraped_brand else scraped_name,
            self._clean_product_name(scraped_name)
        ]
        
        best_match = None
        best_score = 0
        
        for search_string in search_strings:
            if not search_string:
                continue
                
            # Use process.extractOne for best match
            result = process.extractOne(
                search_string,
                [p['name'] for p in candidates],
                scorer=fuzz.WRatio,
                score_cutoff=80
            )
            
            if result and result[1] > best_score:
                best_score = result[1]
                best_match = result[0]
        
        if best_match and best_score >= 95:
            # Find the matched product
            matched_product = next(
                (p for p in candidates if p['name'] == best_match),
                None
            )
            
            if matched_product:
                return {
                    'master_product_id': matched_product['id'],
                    'confidence': best_score,
                    'method': 'fuzzy_match',
                    'matched_name': matched_product['name']
                }
        
        return None
    
    def _ai_match(self, scraped_product: Dict[str, Any], category: str) -> Optional[Dict[str, Any]]:
        """Level 2: AI-powered matching using Gemini Pro"""
        if not self.ai_service:
            return None
        
        try:
            # Get top 5-10 potential matches by category and brand
            candidates = self._get_ai_candidates(scraped_product, category)
            
            if not candidates:
                return None
            
            # Use AI service to match
            ai_result = self.ai_service.match_product_with_candidates(
                scraped_product, candidates
            )
            
            if ai_result and ai_result.get('confidence', 0) >= 80:
                return {
                    'master_product_id': ai_result['master_product_id'],
                    'confidence': ai_result['confidence'],
                    'method': 'ai_match',
                    'matched_name': ai_result['matched_name']
                }
            
        except Exception as e:
            print(f"AI matching error: {e}")
        
        return None
    
    def _get_ai_candidates(self, scraped_product: Dict[str, Any], category: str) -> List[Dict[str, Any]]:
        """Get top candidates for AI matching"""
        candidates = self.master_products_cache[category]
        scraped_brand = scraped_product.get('brand', '').lower()
        
        # Filter by brand first if available
        if scraped_brand:
            brand_candidates = [
                c for c in candidates 
                if scraped_brand in c['brand'].lower()
            ]
            if brand_candidates:
                candidates = brand_candidates
        
        # Sort by name similarity and take top 10
        scraped_name = scraped_product.get('name', '')
        if scraped_name:
            candidates_with_scores = []
            for candidate in candidates:
                score = fuzz.WRatio(scraped_name, candidate['name'])
                candidates_with_scores.append((candidate, score))
            
            # Sort by score and take top 10
            candidates_with_scores.sort(key=lambda x: x[1], reverse=True)
            candidates = [c[0] for c in candidates_with_scores[:10]]
        
        return candidates[:10]  # Limit to 10 candidates for AI processing
    
    def _advanced_match(self, scraped_product: Dict[str, Any], category: str) -> Optional[Dict[str, Any]]:
        """Advanced matching using specifications and multiple criteria"""
        scraped_name = scraped_product.get('name', '')
        scraped_brand = scraped_product.get('brand', '')
        scraped_price = scraped_product.get('price', 0)
        
        if not scraped_name or not scraped_brand:
            return None
        
        candidates = self.master_products_cache[category]
        
        best_match = None
        best_score = 0
        
        for candidate in candidates:
            score = self._calculate_advanced_score(
                scraped_product, candidate, scraped_price
            )
            
            if score > best_score:
                best_score = score
                best_match = candidate
        
        if best_match and best_score >= 85:
            return {
                'master_product_id': best_match['id'],
                'confidence': best_score,
                'method': 'advanced_match',
                'matched_name': best_match['name']
            }
        
        return None
    
    def _brand_match(self, scraped_product: Dict[str, Any], category: str) -> Optional[Dict[str, Any]]:
        """Match by brand and partial name similarity"""
        scraped_name = scraped_product.get('name', '')
        scraped_brand = scraped_product.get('brand', '')
        
        if not scraped_name or not scraped_brand:
            return None
        
        candidates = [
            p for p in self.master_products_cache[category]
            if p['brand'].lower() == scraped_brand.lower()
        ]
        
        if not candidates:
            return None
        
        # Extract key terms from scraped name
        scraped_terms = self._extract_key_terms(scraped_name)
        
        best_match = None
        best_score = 0
        
        for candidate in candidates:
            candidate_terms = self._extract_key_terms(candidate['name'])
            
            # Calculate term overlap
            common_terms = set(scraped_terms) & set(candidate_terms)
            if common_terms:
                score = len(common_terms) / max(len(scraped_terms), len(candidate_terms)) * 100
                
                if score > best_score:
                    best_score = score
                    best_match = candidate
        
        if best_match and best_score >= 75:
            return {
                'master_product_id': best_match['id'],
                'confidence': best_score,
                'method': 'brand_match',
                'matched_name': best_match['name']
            }
        
        return None
    
    def _calculate_advanced_score(self, scraped: Dict[str, Any], candidate: Dict[str, Any], scraped_price: float) -> float:
        """Calculate advanced matching score based on multiple criteria"""
        score = 0
        
        # Brand match (40% weight)
        if scraped.get('brand', '').lower() == candidate['brand'].lower():
            score += 40
        
        # Name similarity (30% weight)
        name_similarity = fuzz.WRatio(
            scraped.get('name', ''),
            candidate['name']
        )
        score += (name_similarity * 0.3)
        
        # Price similarity (20% weight)
        if scraped_price > 0 and candidate['specs'].get('price'):
            candidate_price = candidate['specs']['price'] * 110  # Convert USD to BDT
            price_diff = abs(scraped_price - candidate_price) / max(scraped_price, candidate_price)
            price_score = max(0, 100 - (price_diff * 100))
            score += (price_score * 0.2)
        
        # Specification matching (10% weight)
        spec_score = self._match_specifications(scraped, candidate['specs'])
        score += (spec_score * 0.1)
        
        return min(score, 100)
    
    def _match_specifications(self, scraped: Dict[str, Any], candidate_specs: Dict[str, Any]) -> float:
        """Match product specifications"""
        # This would be implemented based on specific category requirements
        # For now, return a base score
        return 50
    
    def _extract_key_terms(self, name: str) -> List[str]:
        """Extract key terms from product name for matching"""
        # Remove common words and extract meaningful terms
        common_words = {'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by'}
        
        # Clean and split the name
        cleaned = re.sub(r'[^\w\s]', ' ', name.lower())
        terms = [term for term in cleaned.split() if term not in common_words and len(term) > 2]
        
        return terms
    
    def _clean_product_name(self, name: str) -> str:
        """Clean product name for better matching"""
        # Remove common suffixes and clean up
        cleaned = re.sub(r'\s+(OC|Gaming|Pro|Plus|Max|Ultra|X|Ti|Super)\s*$', '', name, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s+[0-9]+GB\s*$', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s+[0-9]+TB\s*$', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned.strip()
    
    def _normalize_category(self, category: str) -> str:
        """Normalize category names"""
        category_mapping = {
            'cpu': 'CPU',
            'processor': 'CPU',
            'gpu': 'GPU',
            'graphics': 'GPU',
            'video card': 'GPU',
            'ram': 'RAM',
            'memory': 'RAM',
            'motherboard': 'Motherboard',
            'mobo': 'Motherboard',
            'psu': 'PSU',
            'power supply': 'PSU',
            'storage': 'Storage',
            'ssd': 'Storage',
            'hdd': 'Storage',
            'hard drive': 'Storage',
            'case': 'Case',
            'casing': 'Case',
            'cooling': 'Cooling',
            'cooler': 'Cooling',
            'fan': 'Cooling'
        }
        
        return category_mapping.get(category.lower(), category)
    
    def get_master_product_by_id(self, product_id: int) -> Optional[MasterProduct]:
        """Get master product by ID"""
        return self.db.query(MasterProduct).filter(
            MasterProduct.product_id == product_id
        ).first()
    
    def get_similar_products(self, product_id: int, limit: int = 5) -> List[MasterProduct]:
        """Get similar products based on master product ID"""
        master_product = self.get_master_product_by_id(product_id)
        if not master_product:
            return []
        
        # Find products in the same category
        similar = self.db.query(MasterProduct).filter(
            MasterProduct.category == master_product.category,
            MasterProduct.product_id != product_id
        ).limit(limit).all()
        
        return similar

# Example usage and testing
def test_reconciliation():
    """Test the product reconciliation service"""
    from database import SessionLocal
    
    db = SessionLocal()
    reconciliation_service = ProductReconciliationService(db)
    
    # Test scraped product
    test_product = {
        'name': 'AMD Ryzen 7 7700X',
        'brand': 'AMD',
        'category': 'CPU',
        'price': 25000,
        'vendor': 'TechLand BD'
    }
    
    result = reconciliation_service.reconcile_product(test_product)
    
    if result:
        print(f"Match found: {result}")
        master_product = reconciliation_service.get_master_product_by_id(result['master_product_id'])
        print(f"Master product: {master_product.standard_name if master_product else 'Not found'}")
    else:
        print("No match found")
    
    db.close()

if __name__ == "__main__":
    test_reconciliation()
