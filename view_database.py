#!/usr/bin/env python3
"""
Simple database viewer for BuySmarter PC Parts
"""

import os
import sqlite3
from pathlib import Path

def check_database():
    """Check if database exists and show its contents"""
    print("BuySmarter PC Parts - Database Viewer")
    print("=" * 50)
    
    # Check for database file
    db_files = list(Path(".").glob("*.db"))
    
    if not db_files:
        print("No database files found in current directory.")
        print("\nLet me check the .env file...")
        
        # Read .env file
        if Path(".env").exists():
            with open(".env", "r") as f:
                env_content = f.read()
                print("Current DATABASE_URL in .env:")
                for line in env_content.split("\n"):
                    if "DATABASE_URL" in line:
                        print(f"  {line}")
        else:
            print("No .env file found!")
        
        return
    
    print(f"Found database file: {db_files[0]}")
    
    try:
        # Connect to database
        conn = sqlite3.connect(str(db_files[0]))
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print(f"\nDatabase contains {len(tables)} tables:")
        for table in tables:
            table_name = table[0]
            print(f"  - {table_name}")
            
            # Get row count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"    Rows: {count}")
            
            # Show sample data for non-empty tables
            if count > 0 and count < 10:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
                rows = cursor.fetchall()
                print(f"    Sample data:")
                for row in rows:
                    print(f"      {row}")
            elif count > 0:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 1")
                row = cursor.fetchone()
                print(f"    Sample row: {row}")
        
        conn.close()
        
    except Exception as e:
        print(f"Error reading database: {e}")

def create_sample_data():
    """Create some sample data for testing"""
    print("\nCreating sample data...")
    
    # Find database file
    db_files = list(Path(".").glob("*.db"))
    if not db_files:
        print("No database file found!")
        return
    
    try:
        conn = sqlite3.connect(str(db_files[0]))
        cursor = conn.cursor()
        
        # Insert sample vendor
        cursor.execute("""
            INSERT OR IGNORE INTO vendors (name, website, isActive) 
            VALUES ('TechLand BD', 'https://www.techlandbd.com', 1)
        """)
        
        # Insert sample master product
        cursor.execute("""
            INSERT OR IGNORE INTO master_products 
            (standardName, category, brand, currentCheapestPrice, keySpecsJson, imageUrls) 
            VALUES ('AMD Ryzen 7 7700X', 'CPU', 'AMD', 28500, '{"cores": 8, "threads": 16}', '[]')
        """)
        
        # Insert sample price entry
        cursor.execute("""
            INSERT OR IGNORE INTO price_entries 
            (masterProductId, vendorId, scrapedPrice, availabilityStatus, productUrl) 
            VALUES (1, 1, 28500, 'in_stock', 'https://example.com')
        """)
        
        conn.commit()
        conn.close()
        
        print("Sample data created!")
        
    except Exception as e:
        print(f"Error creating sample data: {e}")

def main():
    """Main function"""
    check_database()
    
    # Create sample data automatically
    print("\nCreating sample data for testing...")
    create_sample_data()
    print("\nSample data created! Running database check again...")
    check_database()

if __name__ == "__main__":
    main()
