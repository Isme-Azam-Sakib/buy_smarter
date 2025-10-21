#!/usr/bin/env python3
"""
Simple CPU Product Predictor
Use trained scikit-learn models for CPU product recognition
"""

import pickle
import numpy as np
import pandas as pd
import sqlite3
from typing import Dict, List, Optional
import re
import json

class SimpleCPUPredictor:
    """Predict CPU products using trained scikit-learn models"""
    
    def __init__(self, 
                 classifier_path: str = "cpu_classifier.pkl",
                 vectorizer_path: str = "cpu_vectorizer.pkl",
                 db_path: str = "../cpu_products.db"):
        
        self.classifier_path = classifier_path
        self.vectorizer_path = vectorizer_path
        self.db_path = db_path
        
        # Load models
        self.classifier = None
        self.vectorizer = None
        self.price_mapping = None
        
        self.load_models()
        self.load_price_mapping()
    
    def load_models(self):
        """Load trained models"""
        print("Loading trained models...")
        
        try:
            # Load classifier
            with open(self.classifier_path, 'rb') as f:
                self.classifier = pickle.load(f)
            print("[OK] Random Forest classifier loaded")
            
            # Load vectorizer
            with open(self.vectorizer_path, 'rb') as f:
                self.vectorizer = pickle.load(f)
            print("[OK] TF-IDF vectorizer loaded")
            
        except Exception as e:
            print(f"Error loading models: {e}")
            raise
    
    def load_price_mapping(self):
        """Load price mapping from database"""
        print("Loading price mapping...")
        
        conn = sqlite3.connect(self.db_path)
        query = """
        SELECT 
            standard_name, vendor_name, raw_name, 
            price_bdt, availability_status
        FROM cpu_products 
        WHERE price_bdt IS NOT NULL AND price_bdt > 0
        ORDER BY standard_name, vendor_name
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        # Create price mapping
        self.price_mapping = {}
        for _, row in df.iterrows():
            standard_name = row['standard_name']
            if standard_name not in self.price_mapping:
                self.price_mapping[standard_name] = []
            
            self.price_mapping[standard_name].append({
                'vendor': row['vendor_name'],
                'raw_name': row['raw_name'],
                'price': row['price_bdt'],
                'availability': row['availability_status']
            })
        
        print(f"[OK] Loaded price mapping for {len(self.price_mapping)} products")
    
    def extract_text_features(self, text: str) -> Dict:
        """Extract enhanced features from text (same as training)"""
        text_lower = text.lower()
        
        # Basic features
        features = {
            'length': len(text),
            'word_count': len(text.split()),
            'char_count': len(text.replace(' ', '')),
            'has_intel': 'intel' in text_lower,
            'has_amd': 'amd' in text_lower,
            'has_core': 'core' in text_lower,
            'has_ryzen': 'ryzen' in text_lower,
            'has_threadripper': 'threadripper' in text_lower,
            'has_pentium': 'pentium' in text_lower,
            'has_athlon': 'athlon' in text_lower,
            'has_celeron': 'celeron' in text_lower,
            'has_ghz': 'ghz' in text_lower,
            'has_mhz': 'mhz' in text_lower,
            'has_core_count': bool(re.search(r'\d+\s*core', text_lower)),
            'has_thread_count': bool(re.search(r'\d+\s*thread', text_lower)),
            'has_generation': bool(re.search(r'\d+(?:st|nd|rd|th)\s*gen', text_lower)),
            'has_model_number': bool(re.search(r'\d{4,}', text_lower)),
            'has_k_suffix': text_lower.endswith('k'),
            'has_f_suffix': text_lower.endswith('f'),
            'has_x_suffix': text_lower.endswith('x'),
            'has_g_suffix': text_lower.endswith('g'),
            'has_ultra': 'ultra' in text_lower,
            'has_threadripper_pro': 'threadripper pro' in text_lower,
            'has_processor': 'processor' in text_lower,
            'has_cpu': 'cpu' in text_lower,
        }
        
        # Extract numeric features with more detail
        numbers = re.findall(r'\d+\.?\d*', text)
        features['num_count'] = len(numbers)
        features['has_decimal'] = any('.' in num for num in numbers)
        features['max_number'] = max([float(n) for n in numbers]) if numbers else 0
        features['min_number'] = min([float(n) for n in numbers]) if numbers else 0
        
        # Enhanced pattern matching
        features['has_4_digit_model'] = bool(re.search(r'\b\d{4}[a-z]?\b', text_lower))
        features['has_3_digit_model'] = bool(re.search(r'\b\d{3}[a-z]?\b', text_lower))
        features['has_2_digit_model'] = bool(re.search(r'\b\d{2}[a-z]?\b', text_lower))
        
        # Generation patterns
        features['has_11th_gen'] = '11th' in text_lower or '11th gen' in text_lower
        features['has_12th_gen'] = '12th' in text_lower or '12th gen' in text_lower
        features['has_13th_gen'] = '13th' in text_lower or '13th gen' in text_lower
        features['has_14th_gen'] = '14th' in text_lower or '14th gen' in text_lower
        
        # Specific CPU series
        features['has_i3'] = 'i3' in text_lower or 'core i3' in text_lower
        features['has_i5'] = 'i5' in text_lower or 'core i5' in text_lower
        features['has_i7'] = 'i7' in text_lower or 'core i7' in text_lower
        features['has_i9'] = 'i9' in text_lower or 'core i9' in text_lower
        features['has_ryzen_3'] = 'ryzen 3' in text_lower
        features['has_ryzen_5'] = 'ryzen 5' in text_lower
        features['has_ryzen_7'] = 'ryzen 7' in text_lower
        features['has_ryzen_9'] = 'ryzen 9' in text_lower
        
        # Clock speed patterns
        clock_speeds = re.findall(r'(\d+\.?\d*)\s*ghz', text_lower)
        features['clock_speed_count'] = len(clock_speeds)
        features['max_clock_speed'] = max([float(s) for s in clock_speeds]) if clock_speeds else 0
        features['min_clock_speed'] = min([float(s) for s in clock_speeds]) if clock_speeds else 0
        
        # Core/thread patterns
        core_match = re.search(r'(\d+)\s*core', text_lower)
        features['core_count'] = int(core_match.group(1)) if core_match else 0
        
        thread_match = re.search(r'(\d+)\s*thread', text_lower)
        features['thread_count'] = int(thread_match.group(1)) if thread_match else 0
        
        # Cache patterns
        features['has_cache'] = 'cache' in text_lower
        features['has_l3_cache'] = 'l3' in text_lower or 'l3 cache' in text_lower
        
        # Architecture patterns
        features['has_comet_lake'] = 'comet lake' in text_lower
        features['has_rocket_lake'] = 'rocket lake' in text_lower
        features['has_alder_lake'] = 'alder lake' in text_lower
        features['has_raptor_lake'] = 'raptor lake' in text_lower
        features['has_zen'] = 'zen' in text_lower
        features['has_zen2'] = 'zen 2' in text_lower
        features['has_zen3'] = 'zen 3' in text_lower
        features['has_zen4'] = 'zen 4' in text_lower
        
        return features
    
    def predict_product(self, raw_name: str) -> Dict:
        """Predict the standard product name for a raw name"""
        try:
            # Extract features
            features = self.extract_text_features(raw_name)
            
            # Preprocess text (same as training)
            def preprocess_text(text):
                text = re.sub(r'\b(processor|cpu|chip|unit)\b', '', text.lower())
                text = re.sub(r'\s+', ' ', text)
                return text.strip()
            
            # Prepare features for classification
            X_text = self.vectorizer.transform([preprocess_text(raw_name)])
            X_features = np.array([[features[key] for key in features.keys()]])
            X_combined = np.hstack([X_text.toarray(), X_features])
            
            # Predict
            prediction = self.classifier.predict(X_combined)[0]
            confidence = np.max(self.classifier.predict_proba(X_combined))
            
            # Get price information
            price_info = self.price_mapping.get(prediction, [])
            
            return {
                'raw_name': raw_name,
                'predicted_standard_name': prediction,
                'confidence': float(confidence),
                'features': features,
                'price_info': price_info,
                'vendor_count': len(price_info),
                'price_range': [min(p['price'] for p in price_info), 
                               max(p['price'] for p in price_info)] if price_info else [0, 0]
            }
            
        except Exception as e:
            return {
                'raw_name': raw_name,
                'error': str(e),
                'predicted_standard_name': None,
                'confidence': 0.0
            }
    
    def batch_predict(self, raw_names: List[str]) -> List[Dict]:
        """Predict multiple products at once"""
        results = []
        for raw_name in raw_names:
            result = self.predict_product(raw_name)
            results.append(result)
        return results
    
    def find_similar_products(self, query: str, top_k: int = 5) -> List[Dict]:
        """Find similar products based on query"""
        # Get all standard names
        all_products = list(self.price_mapping.keys())
        
        # Predict for the query
        query_result = self.predict_product(query)
        
        # Calculate similarity scores
        similarities = []
        for product in all_products:
            # Simple similarity based on common words
            query_words = set(query.lower().split())
            product_words = set(product.lower().split())
            
            if query_words and product_words:
                similarity = len(query_words.intersection(product_words)) / len(query_words.union(product_words))
                similarities.append((product, similarity))
        
        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        # Return top results with price info
        results = []
        for product, similarity in similarities[:top_k]:
            price_info = self.price_mapping.get(product, [])
            results.append({
                'standard_name': product,
                'similarity': similarity,
                'price_info': price_info,
                'vendor_count': len(price_info),
                'price_range': [min(p['price'] for p in price_info), 
                               max(p['price'] for p in price_info)] if price_info else [0, 0]
            })
        
        return results
    
    def get_market_analysis(self, product_name: str) -> Dict:
        """Get detailed market analysis for a product"""
        price_info = self.price_mapping.get(product_name, [])
        
        if not price_info:
            return {'error': 'Product not found'}
        
        prices = [p['price'] for p in price_info]
        vendors = [p['vendor'] for p in price_info]
        
        analysis = {
            'product_name': product_name,
            'total_vendors': len(set(vendors)),
            'total_listings': len(price_info),
            'price_statistics': {
                'min': min(prices),
                'max': max(prices),
                'avg': np.mean(prices),
                'median': np.median(prices)
            },
            'vendor_breakdown': {},
            'availability_status': {}
        }
        
        # Vendor breakdown
        for vendor in set(vendors):
            vendor_prices = [p['price'] for p in price_info if p['vendor'] == vendor]
            analysis['vendor_breakdown'][vendor] = {
                'count': len(vendor_prices),
                'min_price': min(vendor_prices),
                'max_price': max(vendor_prices),
                'avg_price': np.mean(vendor_prices)
            }
        
        # Availability status
        for status in set(p['availability'] for p in price_info):
            status_count = len([p for p in price_info if p['availability'] == status])
            analysis['availability_status'][status] = status_count
        
        return analysis

def main():
    """Demo the predictor"""
    print("="*60)
    print("SIMPLE CPU PRODUCT PREDICTOR DEMO")
    print("="*60)
    
    # Initialize predictor
    predictor = SimpleCPUPredictor()
    
    # Test examples
    test_queries = [
        "Intel Core i5-11400F 11th Gen Processor",
        "AMD Ryzen 5 5600G Processor with Graphics",
        "Intel Core i7-12700K 12th Gen Alder Lake",
        "AMD Ryzen 9 5900X 12-Core Processor",
        "Intel Core i3-12100F 12th Gen Processor"
    ]
    
    print("\nTesting product recognition:")
    print("-" * 40)
    
    for query in test_queries:
        result = predictor.predict_product(query)
        print(f"\nQuery: {query}")
        print(f"Predicted: {result['predicted_standard_name']}")
        print(f"Confidence: {result['confidence']:.3f}")
        print(f"Vendors: {result['vendor_count']}")
        if result['price_range'] != [0, 0]:
            print(f"Price Range: {result['price_range'][0]} - {result['price_range'][1]} BDT")
    
    print("\n" + "="*60)
    print("DEMO COMPLETED!")
    print("="*60)

if __name__ == "__main__":
    main()
