#!/usr/bin/env python3
"""
Category Product Matcher - Main API for Integration
This is the intelligent layer that your main project will use
"""

from category_predictor import CategoryPredictor
from typing import Dict, List, Optional
import os

class CategoryProductMatcher:
    """
    Main API for your project integration
    
    Usage:
        matcher = CategoryProductMatcher()
        result = matcher.predict_match(
            product_name="Intel Core i5-11400F Processor",
            category="processor",
            confidence_threshold=0.5
        )
    """
    
    def __init__(self, model_dir: str = '.', db_path: str = '../../final_products.db', load_all: bool = False):
        """
        Initialize the category product matcher
        
        Args:
            model_dir: Directory containing category model folders
            db_path: Path to database (final_products.db or cpu_products.db)
            load_all: If True, load all models at initialization. If False, lazy-load on demand.
        """
        self.model_dir = model_dir
        self.db_path = db_path
        self.predictors = {}
        if load_all:
            self._load_all_models()
    
    def _load_model(self, category: str):
        """Lazy-load a single category model"""
        if category in self.predictors:
            return  # Already loaded
        
        try:
            category_dir = os.path.join(self.model_dir, category)
            if os.path.exists(category_dir):
                self.predictors[category] = CategoryPredictor(
                    category=category,
                    model_dir=self.model_dir,
                    db_path=self.db_path
                )
            else:
                raise FileNotFoundError(f"Model directory not found for category: {category}")
        except Exception as e:
            print(f"[ERROR] Failed to load {category} model: {e}", flush=True)
            raise
    
    def _load_all_models(self):
        """Load all category models (only used when load_all=True)"""
        categories = [
            'processor', 'ram', 'ssd', 'graphics-card',
            'motherboard', 'power-supply', 'cpu-cooler'
        ]
        
        print("Loading category models...", flush=True)
        for category in categories:
            try:
                category_dir = os.path.join(self.model_dir, category)
                if os.path.exists(category_dir):
                    self.predictors[category] = CategoryPredictor(
                        category=category,
                        model_dir=self.model_dir,
                        db_path=self.db_path
                    )
                    print(f"  [OK] Loaded {category} model", flush=True)
                else:
                    print(f"  [WARNING] Model not found for {category}", flush=True)
            except Exception as e:
                print(f"  [ERROR] Failed to load {category} model: {e}", flush=True)
        
        print(f"Loaded {len(self.predictors)} category models", flush=True)
    
    def predict_match(self, product_name: str, category: str, 
                     confidence_threshold: float = 0.5) -> Dict:
        """
        Predict if a product name matches a standard name
        
        This is the main method your project will call when simple matching fails.
        
        Args:
            product_name: Scraped product name (e.g., "Intel Core i5-11400F Processor")
            category: Product category (already identified by your project)
            confidence_threshold: Minimum confidence to consider a match (default: 0.5)
        
        Returns:
            {
                'matched': bool,              # True if a prediction was made
                'standard_name': str or None, # Predicted standard name
                'confidence': float,           # Confidence score (0-1)
                'is_match': bool,             # True if confidence >= threshold
                'vendor_count': int,          # Number of vendors for this product
                'price_range': [min, max],    # Price range across vendors
                'error': str or None          # Error message if any
            }
        """
        # Lazy-load the category model if not already loaded
        if category not in self.predictors:
            try:
                self._load_model(category)
            except Exception as e:
                return {
                    'matched': False,
                    'standard_name': None,
                    'confidence': 0.0,
                    'is_match': False,
                    'vendor_count': 0,
                    'price_range': [0, 0],
                    'error': f'Failed to load model for category: {category} - {str(e)}'
                }
        
        # Get category predictor
        predictor = self.predictors[category]
        
        # Predict
        result = predictor.predict_product(product_name)
        
        # Apply confidence threshold
        is_match = result['confidence'] >= confidence_threshold
        
        return {
            'matched': result['matched'],
            'standard_name': result['standard_name'] if is_match else None,
            'confidence': result['confidence'],
            'is_match': is_match,
            'vendor_count': result.get('vendor_count', 0),
            'price_range': result.get('price_range', [0, 0]),
            'error': result.get('error')
        }
    
    def batch_predict(self, product_names: List[str], categories: List[str],
                     confidence_threshold: float = 0.5) -> List[Dict]:
        """
        Predict matches for multiple products
        
        Args:
            product_names: List of scraped product names
            categories: List of categories (must match length of product_names)
            confidence_threshold: Minimum confidence threshold
        
        Returns:
            List of prediction results
        """
        if len(product_names) != len(categories):
            raise ValueError("product_names and categories must have same length")
        
        results = []
        for product_name, category in zip(product_names, categories):
            result = self.predict_match(
                product_name=product_name,
                category=category,
                confidence_threshold=confidence_threshold
            )
            results.append(result)
        
        return results
    
    def get_available_categories(self) -> List[str]:
        """Get list of categories with loaded models"""
        return list(self.predictors.keys())
    
    def is_category_available(self, category: str) -> bool:
        """Check if a category model is available"""
        return category in self.predictors

def main():
    """Demo the category matcher"""
    print("="*60)
    print("CATEGORY PRODUCT MATCHER DEMO")
    print("="*60)
    
    # Initialize matcher
    matcher = CategoryProductMatcher()
    
    # Test examples
    test_cases = [
        ("Intel Core i5-11400F 11th Gen Processor", "processor", 0.5),
        ("Corsair Vengeance LPX 16GB DDR4 3200MHz", "ram", 0.5),
        ("Samsung 970 EVO Plus 500GB NVMe M.2 SSD", "ssd", 0.5),
    ]
    
    print("\nTesting product matching:")
    print("-" * 60)
    
    for product_name, category, threshold in test_cases:
        result = matcher.predict_match(
            product_name=product_name,
            category=category,
            confidence_threshold=threshold
        )
        
        print(f"\nProduct: {product_name}")
        print(f"Category: {category}")
        print(f"Matched: {result['matched']}")
        print(f"Standard Name: {result['standard_name']}")
        print(f"Confidence: {result['confidence']:.3f}")
        print(f"Is Match: {result['is_match']}")
        if result['vendor_count'] > 0:
            print(f"Vendors: {result['vendor_count']}")
            print(f"Price Range: {result['price_range'][0]} - {result['price_range'][1]} BDT")
        if result.get('error'):
            print(f"Error: {result['error']}")
    
    print("\n" + "="*60)
    print("DEMO COMPLETED!")
    print("="*60)

if __name__ == "__main__":
    main()

