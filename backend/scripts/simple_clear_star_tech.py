#!/usr/bin/env python3
"""
Simple Star Tech data clearer that bypasses .env loading
"""

import os
import sys
import sqlite3

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Direct database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')

def clear_star_tech_data():
    """Clear all Star Tech related data"""
    print("Clearing Star Tech data...")
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Get Star Tech vendor ID
        cursor.execute("SELECT vendorId FROM vendors WHERE name = 'Star Tech'")
        star_tech_vendor = cursor.fetchone()
        
        if star_tech_vendor:
            vendor_id = star_tech_vendor[0]
            print(f"Found Star Tech vendor with ID: {vendor_id}")
            
            # Delete price entries
            cursor.execute("DELETE FROM price_entries WHERE vendorId = ?", (vendor_id,))
            deleted_prices = cursor.rowcount
            print(f"Deleted {deleted_prices} price entries")
            
            # Delete vendor
            cursor.execute("DELETE FROM vendors WHERE vendorId = ?", (vendor_id,))
            print("Deleted Star Tech vendor")
            
            # Delete orphaned master products (not referenced by any price entries)
            cursor.execute("""
                DELETE FROM master_products 
                WHERE productId NOT IN (
                    SELECT DISTINCT masterProductId FROM price_entries
                )
            """)
            deleted_products = cursor.rowcount
            print(f"Deleted {deleted_products} orphaned master products")
            
        else:
            print("Star Tech vendor not found")
        
        conn.commit()
        print("Star Tech data cleared successfully")
        
    except Exception as e:
        print(f"Error clearing Star Tech data: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    clear_star_tech_data()
