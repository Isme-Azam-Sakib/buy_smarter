#!/usr/bin/env python3
"""
Clear Star Tech Data
Clears all existing Star Tech products and price entries from the database.
This prepares the database for fresh scraping with reconciliation.
"""

import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal, engine, Base
from models import MasterProduct, Vendor, PriceEntry, CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs

def clear_star_tech_data():
    """Clear all Star Tech related data from the database"""
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("CLEARING STAR TECH DATA")
        print("=" * 80)
        
        # Find Star Tech vendor
        vendor = db.query(Vendor).filter(Vendor.name == "Star Tech").first()
        
        if not vendor:
            print("Star Tech vendor not found. No data to clear.")
            return
        
        print(f"Found Star Tech vendor (ID: {vendor.vendor_id})")
        
        # Get all price entries for Star Tech
        price_entries = db.query(PriceEntry).filter(PriceEntry.vendor_id == vendor.vendor_id).all()
        print(f"Found {len(price_entries)} price entries for Star Tech")
        
        # Get all master products that have Star Tech price entries
        master_product_ids = [pe.master_product_id for pe in price_entries]
        master_products = db.query(MasterProduct).filter(MasterProduct.product_id.in_(master_product_ids)).all()
        print(f"Found {len(master_products)} master products linked to Star Tech")
        
        # Delete price entries first (foreign key constraint)
        deleted_price_entries = db.query(PriceEntry).filter(PriceEntry.vendor_id == vendor.vendor_id).delete()
        print(f"Deleted {deleted_price_entries} price entries")
        
        # Delete specs for master products that are only linked to Star Tech
        deleted_specs = 0
        for master_product in master_products:
            # Check if this master product has any other price entries
            other_price_entries = db.query(PriceEntry).filter(
                PriceEntry.master_product_id == master_product.product_id,
                PriceEntry.vendor_id != vendor.vendor_id
            ).count()
            
            if other_price_entries == 0:
                # This master product is only linked to Star Tech, delete its specs
                spec_tables = [CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs]
                for spec_table in spec_tables:
                    deleted = db.query(spec_table).filter(spec_table.master_product_id == master_product.product_id).delete()
                    deleted_specs += deleted
        
        print(f"Deleted {deleted_specs} spec records")
        
        # Delete master products that are only linked to Star Tech
        deleted_master_products = 0
        for master_product in master_products:
            # Check if this master product has any other price entries
            other_price_entries = db.query(PriceEntry).filter(
                PriceEntry.master_product_id == master_product.product_id,
                PriceEntry.vendor_id != vendor.vendor_id
            ).count()
            
            if other_price_entries == 0:
                db.delete(master_product)
                deleted_master_products += 1
        
        print(f"Deleted {deleted_master_products} master products")
        
        # Delete Star Tech vendor
        db.delete(vendor)
        print("Deleted Star Tech vendor")
        
        # Commit all changes
        db.commit()
        
        print("\n" + "=" * 80)
        print("STAR TECH DATA CLEARED SUCCESSFULLY")
        print("=" * 80)
        print(f"Deleted:")
        print(f"  - {deleted_price_entries} price entries")
        print(f"  - {deleted_specs} spec records")
        print(f"  - {deleted_master_products} master products")
        print(f"  - 1 vendor (Star Tech)")
        print("=" * 80)
        
    except Exception as e:
        db.rollback()
        print(f"Error clearing Star Tech data: {e}")
        raise
    finally:
        db.close()

def main():
    """Main function"""
    try:
        # Ensure tables exist
        Base.metadata.create_all(bind=engine)
        
        clear_star_tech_data()
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
