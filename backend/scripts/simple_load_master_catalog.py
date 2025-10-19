#!/usr/bin/env python3
"""
Simple master catalog loader that bypasses .env loading
"""

import json
import os
import sys
import sqlite3
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Direct database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')

def load_master_catalog():
    """Load master catalog from JSON files"""
    print("Loading master catalog from JSON files...")
    
    master_products_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'masterProducts')
    
    if not os.path.exists(master_products_dir):
        print(f"Master products directory not found: {master_products_dir}")
        return {}
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Clear existing master products
    cursor.execute("DELETE FROM master_products")
    conn.commit()
    
    results = {}
    total_loaded = 0
    
    for filename in os.listdir(master_products_dir):
        if filename.endswith('.json'):
            category = filename.replace('.json', '')
            filepath = os.path.join(master_products_dir, filename)
            
            print(f"Loading {category}...")
            
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    products = json.load(f)
                
                count = 0
                for product in products:
                    try:
                        # Insert master product
                        cursor.execute("""
                            INSERT INTO master_products (
                                productId, standardName, category, brand, 
                                currentCheapestPrice, keySpecsJson, imageUrls,
                                createdAt, updatedAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            product.get('id'),
                            product.get('name', ''),
                            category,
                            product.get('brand', ''),
                            None,  # Ignore USD prices
                            json.dumps(product.get('specs', {})),
                            json.dumps(product.get('images', [])),
                            datetime.now(),
                            datetime.now()
                        ))
                        count += 1
                        
                    except Exception as e:
                        print(f"Error inserting product {product.get('id', 'unknown')}: {e}")
                        continue
                
                conn.commit()
                results[category] = count
                total_loaded += count
                print(f"  Loaded {count} products from {category}")
                
            except Exception as e:
                print(f"Error loading {filename}: {e}")
                results[category] = 0
    
    conn.close()
    print(f"\nTotal products loaded: {total_loaded}")
    return results

if __name__ == "__main__":
    results = load_master_catalog()
    print("\nResults:")
    for category, count in results.items():
        print(f"  {category}: {count} products")
