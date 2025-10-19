#!/usr/bin/env python3
"""
Test the complete product reconciliation system
This script tests the full pipeline: master catalog loading, clearing data, and enhanced scraping
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal, engine, Base
from models import MasterProduct, Vendor, PriceEntry
from vendors.startech_enhanced import StarTechEnhanced

def test_master_catalog_loading():
    """Test loading master catalog"""
    print("=" * 80)
    print("TESTING MASTER CATALOG LOADING")
    print("=" * 80)
    
    try:
        # Import and run the master catalog loader
        from scripts.load_master_catalog import MasterCatalogLoader
        
        loader = MasterCatalogLoader()
        results = loader.load_all_categories()
        
        print(f"\nMaster catalog loading results:")
        for category, count in results.items():
            print(f"  {category}: {count} products")
        
        total_loaded = sum(results.values())
        print(f"\nTotal products loaded: {total_loaded}")
        
        # Verify in database
        db = SessionLocal()
        total_in_db = db.query(MasterProduct).count()
        print(f"Total products in database: {total_in_db}")
        db.close()
        
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
        # Import and run the clear script
        from scripts.clear_star_tech_data import clear_star_tech_data
        
        clear_star_tech_data()
        
        # Verify data is cleared
        db = SessionLocal()
        vendor = db.query(Vendor).filter(Vendor.name == "Star Tech").first()
        
        if vendor:
            print("ERROR: Star Tech vendor still exists after clearing")
            return False
        
        price_entries = db.query(PriceEntry).count()
        print(f"Price entries remaining: {price_entries}")
        
        db.close()
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
        scraper = StarTechEnhanced()
        result = await scraper.scrape_and_store()
        
        if result['success']:
            print("Enhanced scraping completed successfully!")
            stats = result['stats']
            print(f"Duration: {result['duration']}")
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
        db = SessionLocal()
        
        # Check master products
        total_master_products = db.query(MasterProduct).count()
        print(f"Total master products: {total_master_products}")
        
        # Check vendors
        vendors = db.query(Vendor).all()
        print(f"Total vendors: {len(vendors)}")
        for vendor in vendors:
            print(f"  - {vendor.name}: {vendor.website}")
        
        # Check price entries
        total_price_entries = db.query(PriceEntry).count()
        print(f"Total price entries: {total_price_entries}")
        
        # Check Star Tech specific data
        star_tech_vendor = db.query(Vendor).filter(Vendor.name == "Star Tech").first()
        if star_tech_vendor:
            star_tech_products = db.query(MasterProduct).join(PriceEntry).filter(
                PriceEntry.vendor_id == star_tech_vendor.vendor_id
            ).distinct().count()
            
            star_tech_prices = db.query(PriceEntry).filter(
                PriceEntry.vendor_id == star_tech_vendor.vendor_id
            ).count()
            
            print(f"Star Tech products: {star_tech_products}")
            print(f"Star Tech price entries: {star_tech_prices}")
            
            # Category breakdown
            category_counts = db.query(MasterProduct.category, db.func.count(MasterProduct.product_id)).join(
                PriceEntry
            ).filter(PriceEntry.vendor_id == star_tech_vendor.vendor_id).group_by(
                MasterProduct.category
            ).all()
            
            print("Star Tech categories:")
            for category, count in category_counts:
                print(f"  - {category}: {count} products")
        else:
            print("Star Tech vendor not found")
        
        db.close()
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
    
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
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
