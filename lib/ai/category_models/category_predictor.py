#!/usr/bin/env python3
"""
Category-Specific Product Predictor
Predicts standard product names for a specific category
"""

import pickle
import numpy as np
import pandas as pd
import sqlite3
from typing import Dict, List, Optional
import re
import json
import os

class CategoryPredictor:
    """Predict products for a specific category using trained model"""
    
    def __init__(self, category: str, 
                 model_dir: str = '.',
                 db_path: str = '../../final_products.db'):
        
        self.category = category
        self.model_dir = model_dir
        self.db_path = db_path
        
        # Model components
        self.classifier = None
        self.vectorizer = None
        self.feature_keys = None
        self.price_mapping = None
        
        # Load models
        self.load_models()
        self.load_price_mapping()
    
    def load_models(self):
        """Load trained models for this category"""
        category_dir = os.path.join(self.model_dir, self.category)
        
        # Load classifier
        classifier_path = os.path.join(category_dir, f'{self.category}_classifier.pkl')
        if not os.path.exists(classifier_path):
            raise FileNotFoundError(f"Model not found: {classifier_path}")
        
        with open(classifier_path, 'rb') as f:
            self.classifier = pickle.load(f)
        
        # Load vectorizer
        vectorizer_path = os.path.join(category_dir, f'{self.category}_vectorizer.pkl')
        with open(vectorizer_path, 'rb') as f:
            self.vectorizer = pickle.load(f)
        
        # Load feature keys
        feature_keys_path = os.path.join(category_dir, 'feature_keys.json')
        if os.path.exists(feature_keys_path):
            with open(feature_keys_path, 'r') as f:
                self.feature_keys = json.load(f)
        else:
            self.feature_keys = None
    
    def load_price_mapping(self):
        """Load price mapping from database for this category"""
        conn = sqlite3.connect(self.db_path)
        
        # Try all_products table first (for category models), fall back to cpu_products
        try:
            query = """
            SELECT 
                standard_name, vendor_name, raw_name, 
                price_bdt, availability_status
            FROM all_products 
            WHERE category = ?
            AND price_bdt IS NOT NULL AND price_bdt > 0
            ORDER BY standard_name, vendor_name
            """
            df = pd.read_sql_query(query, conn, params=(self.category,))
        except:
            # Fall back to cpu_products table (for backward compatibility)
            # Only load if category is 'processor'
            if self.category == 'processor':
                query = """
                SELECT 
                    standard_name, vendor_name, raw_name, 
                    price_bdt, availability_status
                FROM cpu_products 
                WHERE price_bdt IS NOT NULL AND price_bdt > 0
                ORDER BY standard_name, vendor_name
                """
                df = pd.read_sql_query(query, conn)
            else:
                df = pd.DataFrame()  # Empty dataframe for non-processor categories
        
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
    
    def extract_text_features(self, text: str) -> Dict:
        """Extract features from text (same as training)"""
        text_lower = text.lower()
        tokens = text_lower.split()  # Simulate tokenized_name tokens
        
        # Basic features
        features = {
            'length': len(text),
            'word_count': len(text.split()),
            'char_count': len(text.replace(' ', '')),
            'has_numbers': bool(re.search(r'\d', text)),
            'has_special_chars': bool(re.search(r'[^a-zA-Z0-9\s]', text)),
            'has_tokenized_name': False,  # We don't have tokenized_name during prediction
            'tokenized_length': len(tokens),
        }
        
        # Brand features
        features['has_intel'] = 'intel' in text_lower
        features['has_amd'] = 'amd' in text_lower
        features['has_corsair'] = 'corsair' in text_lower
        features['has_kingston'] = 'kingston' in text_lower
        features['has_samsung'] = 'samsung' in text_lower
        features['has_western_digital'] = 'western digital' in text_lower or 'wd' in text_lower
        features['has_nvidia'] = 'nvidia' in text_lower
        features['has_asus'] = 'asus' in text_lower
        features['has_msi'] = 'msi' in text_lower
        features['has_gigabyte'] = 'gigabyte' in text_lower
        
        # Extract tokenized-like features from raw text (mimicking tokenized_name)
        # Initialize tokenized features to False
        tokenized_features = {
            'has_oc': False, 'has_super': False, 'has_ti': False,
            'has_gddr6': False, 'has_gddr6x': False, 'has_gddr5': False, 'has_gddr3': False,
            'has_ddr3': False, 'has_ddr4': False, 'has_ddr5': False,
            'has_k': False, 'has_f': False, 'has_g': False, 'has_x': False, 'has_gt': False,
            'has_rgb_tokenized': False, 'has_argb_tokenized': False,
            'has_nvme_tokenized': False, 'has_sata_tokenized': False, 'has_m2_tokenized': False,
            'tokenized_model_count': 0, 'has_4_digit_tokenized': False,
            'has_capacity_tokenized': False, 'has_speed_tokenized': False
        }
        # Extract similar features from raw text
        tokenized_features.update(self._extract_tokenized_features(text_lower, tokens))
        features.update(tokenized_features)
        
        # Category-specific features
        if self.category == 'processor':
            features.update(self._extract_processor_features(text_lower))
        elif self.category == 'ram':
            features.update(self._extract_ram_features(text_lower))
        elif self.category == 'ssd':
            features.update(self._extract_ssd_features(text_lower))
        elif self.category == 'graphics-card':
            features.update(self._extract_graphics_card_features(text_lower))
        elif self.category == 'motherboard':
            features.update(self._extract_motherboard_features(text_lower))
        elif self.category == 'power-supply':
            features.update(self._extract_power_supply_features(text_lower))
        elif self.category == 'cpu-cooler':
            features.update(self._extract_cpu_cooler_features(text_lower))
        
        # Extract numeric features
        numbers = re.findall(r'\d+\.?\d*', text)
        features['num_count'] = len(numbers)
        features['has_decimal'] = any('.' in num for num in numbers)
        features['max_number'] = max([float(n) for n in numbers]) if numbers else 0
        features['min_number'] = min([float(n) for n in numbers]) if numbers else 0
        
        # Model number patterns
        features['has_4_digit_model'] = bool(re.search(r'\b\d{4}[a-z]?\b', text_lower))
        features['has_3_digit_model'] = bool(re.search(r'\b\d{3}[a-z]?\b', text_lower))
        features['has_2_digit_model'] = bool(re.search(r'\b\d{2}[a-z]?\b', text_lower))
        
        return features
    
    def _extract_tokenized_features(self, text_lower: str, tokens: List[str]) -> Dict:
        """Extract tokenized-like features from text (matching trainer)"""
        features = {}
        tokens_lower = [t.lower() for t in tokens]
        
        # Variant detection (critical for distinguishing products)
        # Graphics Cards
        features['has_oc'] = 'oc' in text_lower
        features['has_super'] = 'super' in text_lower
        features['has_ti'] = 'ti' in text_lower
        features['has_gddr6'] = 'gddr6' in text_lower
        features['has_gddr6x'] = 'gddr6x' in text_lower or 'gddr6 x' in text_lower
        features['has_gddr5'] = 'gddr5' in text_lower
        features['has_gddr3'] = 'gddr3' in text_lower
        features['has_ddr3'] = 'ddr3' in text_lower
        features['has_ddr4'] = 'ddr4' in text_lower
        features['has_ddr5'] = 'ddr5' in text_lower
        
        # Processors
        features['has_k'] = any(t.endswith('k') for t in tokens_lower)
        features['has_f'] = any(t.endswith('f') for t in tokens_lower)
        features['has_g'] = any(t.endswith('g') for t in tokens_lower)
        features['has_x'] = any(t.endswith('x') for t in tokens_lower)
        features['has_gt'] = 'gt' in text_lower
        
        # RAM
        features['has_rgb_tokenized'] = 'rgb' in text_lower
        features['has_argb_tokenized'] = 'argb' in text_lower
        
        # SSD
        features['has_nvme_tokenized'] = 'nvme' in text_lower
        features['has_sata_tokenized'] = 'sata' in text_lower
        features['has_m2_tokenized'] = 'm.2' in text_lower or 'm2' in text_lower
        
        # Extract model numbers from tokens (more reliable)
        model_numbers = [t for t in tokens_lower if re.search(r'^\d{3,}', t)]
        features['tokenized_model_count'] = len(model_numbers)
        # Extract 4-digit model numbers (e.g., RTX 4070, Ryzen 5600)
        four_digit = [t for t in tokens_lower if re.search(r'^\d{4}', t)]
        features['has_4_digit_tokenized'] = len(four_digit) > 0
        
        # Memory capacity patterns (for GPU, RAM, SSD)
        gb_patterns = [t for t in tokens_lower if 'gb' in t or re.search(r'^\d+gb', t)]
        features['has_capacity_tokenized'] = len(gb_patterns) > 0
        
        # Speed patterns (for RAM)
        mhz_patterns = [t for t in tokens_lower if 'mhz' in t]
        features['has_speed_tokenized'] = len(mhz_patterns) > 0
        
        return features
    
    def _extract_processor_features(self, text_lower: str) -> Dict:
        """Extract processor-specific features"""
        return {
            'has_core': 'core' in text_lower,
            'has_ryzen': 'ryzen' in text_lower,
            'has_threadripper': 'threadripper' in text_lower,
            'has_pentium': 'pentium' in text_lower,
            'has_athlon': 'athlon' in text_lower,
            'has_celeron': 'celeron' in text_lower,
            'has_ghz': 'ghz' in text_lower,
            'has_core_count': bool(re.search(r'\d+\s*core', text_lower)),
            'has_thread_count': bool(re.search(r'\d+\s*thread', text_lower)),
            'has_generation': bool(re.search(r'\d+(?:st|nd|rd|th)\s*gen', text_lower)),
            'has_i3': 'i3' in text_lower or 'core i3' in text_lower,
            'has_i5': 'i5' in text_lower or 'core i5' in text_lower,
            'has_i7': 'i7' in text_lower or 'core i7' in text_lower,
            'has_i9': 'i9' in text_lower or 'core i9' in text_lower,
            'has_ryzen_3': 'ryzen 3' in text_lower,
            'has_ryzen_5': 'ryzen 5' in text_lower,
            'has_ryzen_7': 'ryzen 7' in text_lower,
            'has_ryzen_9': 'ryzen 9' in text_lower,
        }
    
    def _extract_ram_features(self, text_lower: str) -> Dict:
        """Extract RAM-specific features"""
        return {
            'has_ddr': 'ddr' in text_lower,
            'has_ddr3': 'ddr3' in text_lower,
            'has_ddr4': 'ddr4' in text_lower,
            'has_ddr5': 'ddr5' in text_lower,
            'has_gb': 'gb' in text_lower,
            'has_mhz': bool(re.search(r'\d+\s*mhz', text_lower)),
        }
    
    def _extract_ssd_features(self, text_lower: str) -> Dict:
        """Extract SSD-specific features"""
        return {
            'has_nvme': 'nvme' in text_lower,
            'has_sata': 'sata' in text_lower,
            'has_m2': 'm.2' in text_lower or 'm2' in text_lower,
            'has_tb': 'tb' in text_lower,
            'has_gb': 'gb' in text_lower,
        }
    
    def _extract_graphics_card_features(self, text_lower: str) -> Dict:
        """Extract graphics card-specific features"""
        return {
            'has_rtx': 'rtx' in text_lower,
            'has_gtx': 'gtx' in text_lower,
            'has_rx': 'rx' in text_lower,
            'has_gb': 'gb' in text_lower,
        }
    
    def _extract_motherboard_features(self, text_lower: str) -> Dict:
        """Extract motherboard-specific features"""
        return {
            'has_atx': 'atx' in text_lower,
            'has_micro_atx': 'micro atx' in text_lower or 'matx' in text_lower,
            'has_mini_itx': 'mini itx' in text_lower,
            'has_socket': 'socket' in text_lower,
        }
    
    def _extract_power_supply_features(self, text_lower: str) -> Dict:
        """Extract power supply-specific features"""
        return {
            'has_watt': 'w' in text_lower or 'watt' in text_lower,
            'has_80_plus': '80+' in text_lower or '80 plus' in text_lower,
        }
    
    def _extract_cpu_cooler_features(self, text_lower: str) -> Dict:
        """Extract CPU cooler-specific features"""
        return {
            'has_aio': 'aio' in text_lower or 'all in one' in text_lower,
            'has_air': 'air' in text_lower,
            'has_liquid': 'liquid' in text_lower,
            'has_rgb': 'rgb' in text_lower,
            'has_argb': 'argb' in text_lower,
        }
    
    def predict_product(self, product_name: str) -> Dict:
        """
        Predict the standard product name for a given product name
        
        Args:
            product_name: Raw product name from scraping
        
        Returns:
            {
                'matched': bool,
                'standard_name': str or None,
                'confidence': float,
                'is_match': bool,  # True if confidence >= threshold
                'price_info': list,
                'vendor_count': int
            }
        """
        try:
            # Extract features
            features = self.extract_text_features(product_name)
            
            # Category-specific text preprocessing (minimal, matching trainer)
            def preprocess_text(text):
                # Minimal preprocessing (matching trainer's approach)
                text = text.lower()
                # Normalize spacing
                text = re.sub(r'\s+', ' ', text)
                return text.strip()
            
            # Prepare features for classification
            X_text = self.vectorizer.transform([preprocess_text(product_name)])
            
            # Use feature_keys if available
            if self.feature_keys:
                X_features = np.array([[features.get(key, 0) for key in self.feature_keys]])
            else:
                X_features = np.array([[features[key] for key in sorted(features.keys())]])
            
            X_combined = np.hstack([X_text.toarray(), X_features])
            
            # Predict
            prediction = self.classifier.predict(X_combined)[0]
            confidence = np.max(self.classifier.predict_proba(X_combined))
            
            # Get price information
            price_info = self.price_mapping.get(prediction, [])
            
            return {
                'matched': prediction is not None,
                'standard_name': prediction,
                'confidence': float(confidence),
                'is_match': True,  # Will be filtered by threshold in wrapper
                'price_info': price_info,
                'vendor_count': len(price_info),
                'price_range': [min(p['price'] for p in price_info), 
                               max(p['price'] for p in price_info)] if price_info else [0, 0]
            }
            
        except Exception as e:
            return {
                'matched': False,
                'standard_name': None,
                'confidence': 0.0,
                'is_match': False,
                'error': str(e)
            }

