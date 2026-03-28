"""
Category-Specific Product Recognition Models

This package provides category-specific models for product recognition.
Each category (processor, ram, ssd, etc.) has its own trained model.

Main API:
    from category_models import CategoryProductMatcher
    
    matcher = CategoryProductMatcher()
    result = matcher.predict_match(
        product_name="Intel Core i5-11400F",
        category="processor",
        confidence_threshold=0.5
    )
"""

from category_matcher import CategoryProductMatcher
from category_predictor import CategoryPredictor
from category_trainer import CategoryTrainer

__all__ = [
    'CategoryProductMatcher',
    'CategoryPredictor',
    'CategoryTrainer'
]

