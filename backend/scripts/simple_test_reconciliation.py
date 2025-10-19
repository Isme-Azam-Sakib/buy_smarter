#!/usr/bin/env python3
"""
Simple test for the complete product reconciliation system
Bypasses .env loading issues
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Set up database connection directly
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Direct database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Create engine and session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_master_catalog_loading():
    """Test loading master catalog"""
    print("=" * 80)
    print("TESTING MASTER CATALOG LOADING")
    print("=" * 80)
    
    try:
        # Import and run the simple master catalog loader
        from scripts.simple_load_master_catalog import load_master_catalog
        
        results = load_master_catalog()
        
        print(f"\nMaster catalog loading results:")
        for category, count in results.items():
            print(f"  {category}: {count} products")
        
        total_loaded = sum(results.values())
        print(f"\nTotal products loaded: {total_loaded}")
        
        # Verify in database
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM master_products")
        total_in_db = cursor.fetchone()[0]
        print(f"Total products in database: {total_in_db}")
        conn.close()
        
        return total_loaded > 0
        
    except Exception as e:
        print(f"Error loading master catalog: {e}")
        return False

def test_clear_star_tech_data():
    """Test clearing Star Tech data"""
    print("\n" + "=" * 80)
    print("TESTING STAR TECH DATA CLEARING")
    print("=" * 80)
    
    try:
        # Import and run the simple clear script
        from scripts.simple_clear_star_tech import clear_star_tech_data
        
        clear_star_tech_data()
        
        # Verify data is cleared
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM vendors WHERE name = 'Star Tech'")
        vendor_count = cursor.fetchone()[0]
        
        if vendor_count > 0:
            print("ERROR: Star Tech vendor still exists after clearing")
            return False
        
        cursor.execute("SELECT COUNT(*) FROM price_entries")
        price_entries = cursor.fetchone()[0]
        print(f"Price entries remaining: {price_entries}")
        
        conn.close()
        print("Star Tech data cleared successfully")
        return True
        
    except Exception as e:
        print(f"Error clearing Star Tech data: {e}")
        return False

async def test_enhanced_scraping():
    """Test enhanced scraping with reconciliation"""
    print("\n" + "=" * 80)
    print("TESTING ENHANCED SCRAPING WITH RECONCILIATION")
    print("=" * 80)
    
    try:
        # Import the simple enhanced scraper
        from scripts.simple_startech_enhanced import SimpleStarTechEnhanced
        
        scraper = SimpleStarTechEnhanced()
        result = await scraper.scrape_and_store()
        
        if result['success']:
            print("Enhanced scraping completed successfully!")
            stats = result['stats']
            print(f"Duration: {result['duration']}")
            print(f"Products processed: {stats.get('matched_products', 0)}")
            return True
        else:
            print(f"Enhanced scraping failed: {result['message']}")
            return False
            
    except Exception as e:
        print(f"Error in enhanced scraping: {e}")
        return False

def test_database_verification():
    """Verify the final database state"""
    print("\n" + "=" * 80)
    print("DATABASE VERIFICATION")
    print("=" * 80)
    
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # Check master products
        cursor.execute("SELECT COUNT(*) FROM master_products")
        total_master_products = cursor.fetchone()[0]
        print(f"Total master products: {total_master_products}")
        
        # Check vendors
        cursor.execute("SELECT name, website FROM vendors")
        vendors = cursor.fetchall()
        print(f"Total vendors: {len(vendors)}")
        for name, website in vendors:
            print(f"  - {name}: {website}")
        
        # Check price entries
        cursor.execute("SELECT COUNT(*) FROM price_entries")
        total_price_entries = cursor.fetchone()[0]
        print(f"Total price entries: {total_price_entries}")
        
        # Check Star Tech specific data
        cursor.execute("SELECT vendorId FROM vendors WHERE name = 'Star Tech'")
        star_tech_vendor = cursor.fetchone()
        
        if star_tech_vendor:
            vendor_id = star_tech_vendor[0]
            
            cursor.execute("""
                SELECT COUNT(DISTINCT mp.productId) 
                FROM master_products mp 
                JOIN price_entries pe ON mp.productId = pe.masterProductId 
                WHERE pe.vendorId = ?
            """, (vendor_id,))
            star_tech_products = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM price_entries WHERE vendorId = ?", (vendor_id,))
            star_tech_prices = cursor.fetchone()[0]
            
            print(f"Star Tech products: {star_tech_products}")
            print(f"Star Tech price entries: {star_tech_prices}")
            
            # Category breakdown
            cursor.execute("""
                SELECT mp.category, COUNT(DISTINCT mp.productId) 
                FROM master_products mp 
                JOIN price_entries pe ON mp.productId = pe.masterProductId 
                WHERE pe.vendorId = ?
                GROUP BY mp.category
            """, (vendor_id,))
            category_counts = cursor.fetchall()
            
            print("Star Tech categories:")
            for category, count in category_counts:
                print(f"  - {category}: {count} products")
        else:
            print("Star Tech vendor not found")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error verifying database: {e}")
        return False

async def main():
    """Run all tests"""
    print("=" * 80)
    print("PRODUCT RECONCILIATION SYSTEM TEST")
    print("=" * 80)
    print(f"Started at: {datetime.now()}")
    
    test_results = []
    
    # Test 1: Load master catalog
    print("\n1. Testing master catalog loading...")
    result1 = test_master_catalog_loading()
    test_results.append(("Master Catalog Loading", result1))
    
    # Test 2: Clear Star Tech data
    print("\n2. Testing Star Tech data clearing...")
    result2 = test_clear_star_tech_data()
    test_results.append(("Star Tech Data Clearing", result2))
    
    # Test 3: Enhanced scraping
    print("\n3. Testing enhanced scraping with reconciliation...")
    result3 = await test_enhanced_scraping()
    test_results.append(("Enhanced Scraping", result3))
    
    # Test 4: Database verification
    print("\n4. Testing database verification...")
    result4 = test_database_verification()
    test_results.append(("Database Verification", result4))
    
    # Print final results
    print("\n" + "=" * 80)
    print("TEST RESULTS SUMMARY")
    print("=" * 80)
    
    all_passed = True
    for test_name, passed in test_results:
        status = "PASS" if passed else "FAIL"
        print(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    print(f"\nOverall Result: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print(f"Completed at: {datetime.now()}")
    print("=" * 80)
    
    return all_passed

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
