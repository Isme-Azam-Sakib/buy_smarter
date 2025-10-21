#!/usr/bin/env python3
"""
Complete CPU Model Training Pipeline
Train spaCy + Scikit-learn models for CPU product recognition
"""

import os
import sys
import subprocess
import json
import time
from pathlib import Path

def install_requirements():
    """Install required packages"""
    print("Installing required packages...")
    
    requirements = [
        "spacy>=3.7.0",
        "scikit-learn>=1.3.0",
        "pandas>=1.5.0",
        "numpy>=1.24.0",
        "matplotlib>=3.7.0",
        "seaborn>=0.12.0",
        "tqdm>=4.65.0"
    ]
    
    for req in requirements:
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", req])
            print(f"[OK] Installed {req}")
        except subprocess.CalledProcessError as e:
            print(f"[ERROR] Failed to install {req}: {e}")
    
    # Download spaCy English model
    print("Downloading spaCy English model...")
    try:
        subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
        print("[OK] Downloaded en_core_web_sm")
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] Failed to download spaCy model: {e}")

def check_database():
    """Check if database exists and is accessible"""
    db_path = "../cpu_products.db"
    if not os.path.exists(db_path):
        print(f"[ERROR] Database not found at {db_path}")
        return False
    
    try:
        import sqlite3
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cpu_products")
        count = cursor.fetchone()[0]
        conn.close()
        print(f"[OK] Database found with {count} products")
        return True
    except Exception as e:
        print(f"[ERROR] Database error: {e}")
        return False

def run_training():
    """Run the complete training pipeline"""
    print("\n" + "="*60)
    print("STARTING CPU MODEL TRAINING")
    print("="*60)
    
    # Import and run trainer
    try:
        from simple_cpu_trainer import SimpleCPUTrainer
        
        trainer = SimpleCPUTrainer()
        trainer.train_complete_model()
        
        print("\n[OK] Training completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Training failed: {e}")
        return False

def test_model():
    """Test the trained model"""
    print("\n" + "="*60)
    print("TESTING TRAINED MODEL")
    print("="*60)
    
    try:
        from simple_cpu_predictor import SimpleCPUPredictor
        
        predictor = SimpleCPUPredictor()
        
        # Test queries
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
        
        print("\n[OK] Model testing completed!")
        return True
        
    except Exception as e:
        print(f"\n[ERROR] Model testing failed: {e}")
        return False

def create_model_info():
    """Create model information file"""
    model_info = {
        "model_type": "spaCy + Scikit-learn",
        "components": [
            "spaCy NER model (cpu_ner_model/)",
            "Random Forest classifier (cpu_classifier.pkl)",
            "TF-IDF vectorizer (cpu_vectorizer.pkl)"
        ],
        "features": [
            "Named Entity Recognition for CPU components",
            "Text classification for product mapping",
            "Price mapping and vendor analysis",
            "Confidence scoring"
        ],
        "trained_on": "CPU products database",
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "usage": {
            "predictor_class": "SpacyCPUPredictor",
            "main_methods": [
                "predict_product(raw_name)",
                "batch_predict(raw_names)",
                "find_similar_products(query, top_k)",
                "get_market_analysis(product_name)"
            ]
        }
    }
    
    with open("model_info.json", "w") as f:
        json.dump(model_info, f, indent=2)
    
    print("[OK] Model information saved to model_info.json")

def main():
    """Main training pipeline"""
    print("="*60)
    print("CPU AI MODEL TRAINING PIPELINE")
    print("="*60)
    
    # Step 1: Install requirements
    print("\nStep 1: Installing requirements...")
    install_requirements()
    
    # Step 2: Check database
    print("\nStep 2: Checking database...")
    if not check_database():
        print("Please ensure the database exists and is accessible.")
        return False
    
    # Step 3: Run training
    print("\nStep 3: Training models...")
    if not run_training():
        print("Training failed. Please check the error messages.")
        return False
    
    # Step 4: Test model
    print("\nStep 4: Testing model...")
    if not test_model():
        print("Model testing failed. Please check the error messages.")
        return False
    
    # Step 5: Create model info
    print("\nStep 5: Creating model information...")
    create_model_info()
    
    print("\n" + "="*60)
    print("TRAINING PIPELINE COMPLETED SUCCESSFULLY!")
    print("="*60)
    print("\nYour trained models are ready to use:")
    print("- cpu_ner_model/ (spaCy NER model)")
    print("- cpu_classifier.pkl (Random Forest classifier)")
    print("- cpu_vectorizer.pkl (TF-IDF vectorizer)")
    print("- model_info.json (Model information)")
    
    print("\nTo use the model:")
    print("from spacy_cpu_predictor import SpacyCPUPredictor")
    print("predictor = SpacyCPUPredictor()")
    print("result = predictor.predict_product('Intel Core i5-11400F')")
    
    return True

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)
