#!/usr/bin/env python3
"""
Model Evaluation Script
Evaluate the performance of the trained CPU recognition model
"""

import sqlite3
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
from typing import Dict, List, Tuple
import json
from spacy_cpu_predictor import SpacyCPUPredictor

class ModelEvaluator:
    """Evaluate the trained CPU recognition model"""
    
    def __init__(self, db_path: str = "../cpu_products.db"):
        self.db_path = db_path
        self.predictor = None
        self.test_data = None
        
    def load_test_data(self):
        """Load test data from database"""
        print("Loading test data...")
        
        conn = sqlite3.connect(self.db_path)
        query = """
        SELECT 
            raw_name, standard_name, brand, 
            price_bdt, vendor_name
        FROM cpu_products 
        WHERE price_bdt IS NOT NULL AND price_bdt > 0
        AND raw_name IS NOT NULL AND standard_name IS NOT NULL
        ORDER BY RANDOM()
        """
        
        df = pd.read_sql_query(query, conn)
        conn.close()
        
        # Use 20% for testing
        test_size = int(len(df) * 0.2)
        self.test_data = df.head(test_size)
        
        print(f"Loaded {len(self.test_data)} test samples")
        return self.test_data
    
    def load_predictor(self):
        """Load the trained predictor"""
        print("Loading trained predictor...")
        try:
            self.predictor = SpacyCPUPredictor()
            print("✓ Predictor loaded successfully")
            return True
        except Exception as e:
            print(f"✗ Failed to load predictor: {e}")
            return False
    
    def evaluate_accuracy(self) -> Dict:
        """Evaluate model accuracy"""
        print("\nEvaluating model accuracy...")
        
        if not self.predictor or self.test_data is None:
            print("Please load predictor and test data first")
            return {}
        
        predictions = []
        true_labels = []
        confidences = []
        
        for _, row in self.test_data.iterrows():
            raw_name = row['raw_name']
            true_standard_name = row['standard_name']
            
            result = self.predictor.predict_product(raw_name)
            predicted_name = result['predicted_standard_name']
            confidence = result['confidence']
            
            predictions.append(predicted_name)
            true_labels.append(true_standard_name)
            confidences.append(confidence)
        
        # Calculate accuracy
        accuracy = accuracy_score(true_labels, predictions)
        
        # Calculate per-class metrics
        report = classification_report(true_labels, predictions, output_dict=True)
        
        # Calculate confidence statistics
        confidence_stats = {
            'mean': np.mean(confidences),
            'std': np.std(confidences),
            'min': np.min(confidences),
            'max': np.max(confidences),
            'high_confidence_count': sum(1 for c in confidences if c > 0.8),
            'low_confidence_count': sum(1 for c in confidences if c < 0.5)
        }
        
        results = {
            'overall_accuracy': accuracy,
            'classification_report': report,
            'confidence_stats': confidence_stats,
            'total_samples': len(predictions),
            'correct_predictions': sum(1 for p, t in zip(predictions, true_labels) if p == t)
        }
        
        print(f"Overall Accuracy: {accuracy:.4f}")
        print(f"Correct Predictions: {results['correct_predictions']}/{results['total_samples']}")
        print(f"Mean Confidence: {confidence_stats['mean']:.4f}")
        
        return results
    
    def analyze_errors(self) -> List[Dict]:
        """Analyze prediction errors"""
        print("\nAnalyzing prediction errors...")
        
        errors = []
        
        for _, row in self.test_data.iterrows():
            raw_name = row['raw_name']
            true_standard_name = row['standard_name']
            
            result = self.predictor.predict_product(raw_name)
            predicted_name = result['predicted_standard_name']
            confidence = result['confidence']
            
            if predicted_name != true_standard_name:
                errors.append({
                    'raw_name': raw_name,
                    'true_name': true_standard_name,
                    'predicted_name': predicted_name,
                    'confidence': confidence,
                    'entities': result.get('entities', {}),
                    'features': result.get('features', {})
                })
        
        print(f"Found {len(errors)} prediction errors")
        
        # Analyze error patterns
        error_analysis = {
            'total_errors': len(errors),
            'high_confidence_errors': sum(1 for e in errors if e['confidence'] > 0.8),
            'low_confidence_errors': sum(1 for e in errors if e['confidence'] < 0.5),
            'common_error_patterns': self.find_common_error_patterns(errors)
        }
        
        return errors, error_analysis
    
    def find_common_error_patterns(self, errors: List[Dict]) -> Dict:
        """Find common patterns in prediction errors"""
        patterns = {
            'brand_mismatches': 0,
            'model_number_mismatches': 0,
            'generation_mismatches': 0,
            'suffix_mismatches': 0,
            'length_differences': 0
        }
        
        for error in errors:
            true_name = error['true_name'].lower()
            predicted_name = error['predicted_name'].lower()
            
            # Check for brand mismatches
            if any(brand in true_name for brand in ['intel', 'amd']) and \
               any(brand in predicted_name for brand in ['intel', 'amd']):
                if not any(brand in true_name for brand in ['intel', 'amd'] if brand in predicted_name):
                    patterns['brand_mismatches'] += 1
            
            # Check for model number differences
            true_numbers = set(re.findall(r'\d+', true_name))
            pred_numbers = set(re.findall(r'\d+', predicted_name))
            if true_numbers != pred_numbers:
                patterns['model_number_mismatches'] += 1
            
            # Check for generation differences
            if 'gen' in true_name or 'gen' in predicted_name:
                if 'gen' in true_name != 'gen' in predicted_name:
                    patterns['generation_mismatches'] += 1
            
            # Check for suffix differences
            true_suffixes = set(re.findall(r'[a-z]$', true_name))
            pred_suffixes = set(re.findall(r'[a-z]$', predicted_name))
            if true_suffixes != pred_suffixes:
                patterns['suffix_mismatches'] += 1
            
            # Check for length differences
            if abs(len(true_name) - len(predicted_name)) > 10:
                patterns['length_differences'] += 1
        
        return patterns
    
    def evaluate_entity_extraction(self) -> Dict:
        """Evaluate NER entity extraction performance"""
        print("\nEvaluating entity extraction...")
        
        entity_results = {
            'brand': {'correct': 0, 'total': 0, 'precision': 0, 'recall': 0},
            'cpu_model': {'correct': 0, 'total': 0, 'precision': 0, 'recall': 0},
            'generation': {'correct': 0, 'total': 0, 'precision': 0, 'recall': 0},
            'clock_speed': {'correct': 0, 'total': 0, 'precision': 0, 'recall': 0},
            'core_count': {'correct': 0, 'total': 0, 'precision': 0, 'recall': 0}
        }
        
        for _, row in self.test_data.iterrows():
            raw_name = row['raw_name']
            result = self.predictor.predict_product(raw_name)
            entities = result.get('entities', {})
            
            # Simple evaluation - check if expected entities are present
            text_lower = raw_name.lower()
            
            # Brand evaluation
            if any(brand in text_lower for brand in ['intel', 'amd']):
                entity_results['brand']['total'] += 1
                if entities['brand']:
                    entity_results['brand']['correct'] += 1
            
            # CPU model evaluation
            if any(pattern in text_lower for pattern in ['core i', 'ryzen', 'threadripper']):
                entity_results['cpu_model']['total'] += 1
                if entities['cpu_model']:
                    entity_results['cpu_model']['correct'] += 1
            
            # Generation evaluation
            if re.search(r'\d+(?:st|nd|rd|th)\s*gen', text_lower):
                entity_results['generation']['total'] += 1
                if entities['generation']:
                    entity_results['generation']['correct'] += 1
            
            # Clock speed evaluation
            if 'ghz' in text_lower:
                entity_results['clock_speed']['total'] += 1
                if entities['clock_speed']:
                    entity_results['clock_speed']['correct'] += 1
            
            # Core count evaluation
            if re.search(r'\d+\s*core', text_lower):
                entity_results['core_count']['total'] += 1
                if entities['core_count']:
                    entity_results['core_count']['correct'] += 1
        
        # Calculate precision and recall
        for entity_type in entity_results:
            if entity_results[entity_type]['total'] > 0:
                entity_results[entity_type]['recall'] = entity_results[entity_type]['correct'] / entity_results[entity_type]['total']
            else:
                entity_results[entity_type]['recall'] = 0
        
        return entity_results
    
    def generate_evaluation_report(self) -> Dict:
        """Generate comprehensive evaluation report"""
        print("\n" + "="*60)
        print("GENERATING EVALUATION REPORT")
        print("="*60)
        
        # Load data and predictor
        self.load_test_data()
        if not self.load_predictor():
            return {}
        
        # Run evaluations
        accuracy_results = self.evaluate_accuracy()
        errors, error_analysis = self.analyze_errors()
        entity_results = self.evaluate_entity_extraction()
        
        # Compile report
        report = {
            'evaluation_timestamp': pd.Timestamp.now().isoformat(),
            'test_data_size': len(self.test_data),
            'accuracy_results': accuracy_results,
            'error_analysis': error_analysis,
            'entity_extraction_results': entity_results,
            'model_performance': {
                'overall_accuracy': accuracy_results.get('overall_accuracy', 0),
                'mean_confidence': accuracy_results.get('confidence_stats', {}).get('mean', 0),
                'error_rate': len(errors) / len(self.test_data) if self.test_data is not None else 0
            }
        }
        
        # Save report
        with open('evaluation_report.json', 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"\n✓ Evaluation report saved to evaluation_report.json")
        
        # Print summary
        print("\n" + "="*60)
        print("EVALUATION SUMMARY")
        print("="*60)
        print(f"Overall Accuracy: {report['model_performance']['overall_accuracy']:.4f}")
        print(f"Mean Confidence: {report['model_performance']['mean_confidence']:.4f}")
        print(f"Error Rate: {report['model_performance']['error_rate']:.4f}")
        print(f"Total Test Samples: {report['test_data_size']}")
        print(f"Prediction Errors: {len(errors)}")
        
        return report

def main():
    """Run model evaluation"""
    evaluator = ModelEvaluator()
    report = evaluator.generate_evaluation_report()
    
    if report:
        print("\n✓ Model evaluation completed successfully!")
    else:
        print("\n✗ Model evaluation failed!")

if __name__ == "__main__":
    main()
