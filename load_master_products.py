#!/usr/bin/env python3
"""
Script to load master products from JSON files into the database
"""

import sys
import os
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from data_loader import MasterProductLoader

def main():
    """Load master products into the database"""
    print("=" * 60)
    print("BuySmarter PC Parts - Master Product Loader")
    print("=" * 60)
    
    # Check if masterProducts directory exists
    master_products_dir = Path("masterProducts")
    if not master_products_dir.exists():
        print("Error: masterProducts directory not found!")
        print("Please ensure the masterProducts folder is in the project root.")
        return
    
    # Check if JSON files exist
    required_files = [
        'cpu.json', 'motherboard.json', 'memory.json', 'video-card.json',
        'power-supply.json', 'internal-hard-drive.json', 'case.json', 'cpu-cooler.json'
    ]
    
    missing_files = []
    for file in required_files:
        if not (master_products_dir / file).exists():
            missing_files.append(file)
    
    if missing_files:
        print(f"Error: Missing required files: {', '.join(missing_files)}")
        return
    
    print("Found all required master product files!")
    print("\nFiles to be loaded:")
    for file in required_files:
        file_path = master_products_dir / file
        size_mb = file_path.stat().st_size / (1024 * 1024)
        print(f"  - {file} ({size_mb:.1f} MB)")
    
    print("\nStarting data load...")
    print("This may take a few minutes depending on the size of your data.")
    
    try:
        loader = MasterProductLoader()
        total_loaded = loader.load_all_products()
        
        print("\n" + "=" * 60)
        print("LOAD COMPLETE!")
        print("=" * 60)
        print(f"Successfully loaded {total_loaded} master products!")
        print("\nNext steps:")
        print("1. Run 'npm run db:push' to sync the database schema")
        print("2. Start the backend: 'cd backend && python main.py'")
        print("3. Start the frontend: 'npm run dev'")
        print("4. Test the scrapers with your master product catalog")
        
    except Exception as e:
        print(f"\nError loading master products: {e}")
        print("Please check your database connection and try again.")
    
    finally:
        loader.close()

if __name__ == "__main__":
    main()
