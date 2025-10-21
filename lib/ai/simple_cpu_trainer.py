#!/usr/bin/env python3
"""
Simple CPU Product Recognition Trainer
Focus on classification model with scikit-learn (without spaCy NER for now)
"""

import sqlite3
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from sklearn.feature_extraction.text import TfidfVectorizer
from typing import List, Dict, Tuple, Optional
import re
import os
import pickle
import json

class SimpleCPUTrainer:
    """Train simple CPU product recognition model using scikit-learn"""
    
    def __init__(self, db_path: str = '../cpu_products.db'):
        self.db_path = db_path
        self.classifier = None
        self.vectorizer = None
        self.training_data = []
        self.label_encoder = None
        
    def load_and_prepare_data(self):
        """Load data from database and prepare for training"""
        print("Loading data from database...")
        
        conn = sqlite3.connect(self.db_path)
        query = """
        SELECT 
            raw_name, standard_name, brand, 
            price_bdt, vendor_name
        FROM cpu_products 
        WHERE price_bdt IS NOT NULL AND price_bdt > 0
        AND raw_name IS NOT NULL AND standard_name IS NOT NULL
        ORDER BY standard_name
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        print(f"Loaded {len(df)} products for training")
        
        # Prepare training data
        self.prepare_training_data(df)
        
        return df
    
    def prepare_training_data(self, df: pd.DataFrame):
        """Prepare data for classification training"""
        print("Preparing training data...")
        
        # Group by standard name to get unique products
        grouped = df.groupby('standard_name').agg({
            'raw_name': list,
            'brand': 'first',
            'price_bdt': list
        }).reset_index()
        
        training_examples = []
        
        for _, group in grouped.iterrows():
            standard_name = group['standard_name']
            raw_names = group['raw_name']
            brand = group['brand']
            prices = group['price_bdt']
            
            for raw_name in raw_names:
                # Extract features
                features = self.extract_text_features(raw_name)
                
                training_example = {
                    'raw_name': raw_name,
                    'standard_name': standard_name,
                    'brand': brand,
                    'features': features,
                    'avg_price': np.mean(prices) if prices else 0
                }
                
                training_examples.append(training_example)
        
        self.training_data = training_examples
        print(f"Prepared {len(training_examples)} training examples")
    
    def extract_text_features(self, text: str) -> Dict:
        """Extract enhanced features from text for classification"""
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
    
    def train_classification_model(self):
        """Train scikit-learn classification model"""
        print("Training classification model...")
        
        # Prepare features and labels
        X_text = [item['raw_name'] for item in self.training_data]
        X_features = [item['features'] for item in self.training_data]
        y = [item['standard_name'] for item in self.training_data]
        
        # Enhanced text preprocessing
        def preprocess_text(text):
            # Remove common words that don't help with classification
            text = re.sub(r'\b(processor|cpu|chip|unit)\b', '', text.lower())
            # Normalize spacing
            text = re.sub(r'\s+', ' ', text)
            return text.strip()
        
        X_text_processed = [preprocess_text(text) for text in X_text]
        
        # Enhanced text vectorization
        self.vectorizer = TfidfVectorizer(
            max_features=3000,
            ngram_range=(1, 4),  # Increased to 4-grams
            stop_words='english',
            lowercase=True,
            min_df=1,  # Include all terms
            max_df=0.95,  # Remove very common terms
            sublinear_tf=True,  # Use sublinear scaling
            norm='l2'  # L2 normalization
        )
        X_text_vect = self.vectorizer.fit_transform(X_text_processed)
        
        # Combine text and custom features
        X_features_array = np.array([[f[key] for key in self.training_data[0]['features'].keys()] 
                                   for f in X_features])
        
        # Combine text vectors with custom features
        X_combined = np.hstack([X_text_vect.toarray(), X_features_array])
        
        # Split data (removed stratification due to single-sample classes)
        X_train, X_test, y_train, y_test = train_test_split(
            X_combined, y, test_size=0.2, random_state=42
        )
        
        # Enhanced classifier with better parameters
        self.classifier = RandomForestClassifier(
            n_estimators=500,  # More trees
            random_state=42,
            max_depth=30,  # Deeper trees
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight='balanced',
            max_features='sqrt',  # Better feature selection
            bootstrap=True,
            oob_score=True,  # Out-of-bag scoring
            n_jobs=-1  # Use all cores
        )
        
        self.classifier.fit(X_train, y_train)
        
        # Evaluate
        y_pred = self.classifier.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"Classification accuracy: {accuracy:.4f}")
        print(f"Training samples: {len(X_train)}")
        print(f"Test samples: {len(X_test)}")
        
        # Print classification report for top classes
        report = classification_report(y_test, y_pred, output_dict=True)
        print(f"\nTop 10 classes by support:")
        sorted_classes = sorted(report.items(), key=lambda x: x[1].get('support', 0) if isinstance(x[1], dict) else 0, reverse=True)
        for class_name, metrics in sorted_classes[:10]:
            if isinstance(metrics, dict) and 'precision' in metrics:
                print(f"  {class_name}: precision={metrics['precision']:.3f}, recall={metrics['recall']:.3f}, support={metrics['support']}")
        
        # Save models
        with open('cpu_classifier.pkl', 'wb') as f:
            pickle.dump(self.classifier, f)
        
        with open('cpu_vectorizer.pkl', 'wb') as f:
            pickle.dump(self.vectorizer, f)
        
        print("\n[OK] Classification model saved!")
        
        return accuracy
    
    def train_complete_model(self):
        """Train the complete model pipeline"""
        print("="*60)
        print("TRAINING SIMPLE CPU RECOGNITION MODEL")
        print("="*60)
        
        # Load and prepare data
        self.load_and_prepare_data()
        
        # Train classification model
        accuracy = self.train_classification_model()
        
        print("\n" + "="*60)
        print("TRAINING COMPLETED SUCCESSFULLY!")
        print("="*60)
        print(f"Final accuracy: {accuracy:.4f}")
        print("Models saved:")
        print("- cpu_classifier.pkl (Random Forest classifier)")
        print("- cpu_vectorizer.pkl (TF-IDF vectorizer)")

if __name__ == "__main__":
    trainer = SimpleCPUTrainer()
    trainer.train_complete_model()
