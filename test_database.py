#!/usr/bin/env python3
"""
Test database connection and create sample data
"""

import os
import sqlite3
from pathlib import Path

def test_database_connection():
    """Test database connection and create sample data"""
    print("Testing database connection...")
    
    # Database file path
    db_path = "buysmarter.db"
    
    try:
        # Create database connection
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print(f"[OK] Database created: {db_path}")
        print(f"[OK] File size: {Path(db_path).stat().st_size} bytes")
        
        # Create tables manually
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vendors (
                vendorId INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                website TEXT,
                logoUrl TEXT,
                isActive BOOLEAN DEFAULT 1,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS master_products (
                productId INTEGER PRIMARY KEY AUTOINCREMENT,
                standardName TEXT,
                category TEXT,
                brand TEXT,
                currentCheapestPrice REAL,
                keySpecsJson TEXT,
                imageUrls TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS price_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                masterProductId INTEGER,
                vendorId INTEGER,
                scrapedPrice REAL,
                availabilityStatus TEXT DEFAULT 'in_stock',
                scrapedTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                productUrl TEXT,
                FOREIGN KEY (masterProductId) REFERENCES master_products(productId),
                FOREIGN KEY (vendorId) REFERENCES vendors(vendorId)
            )
        """)
        
        print("[OK] Tables created successfully")
        
        # Insert sample data
        cursor.execute("""
            INSERT OR IGNORE INTO vendors (name, website, isActive) 
            VALUES ('TechLand BD', 'https://www.techlandbd.com', 1)
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO vendors (name, website, isActive) 
            VALUES ('Skyland Computer BD', 'https://www.skyland.com.bd', 1)
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO master_products 
            (standardName, category, brand, currentCheapestPrice, keySpecsJson, imageUrls) 
            VALUES ('AMD Ryzen 7 7700X', 'CPU', 'AMD', 28500, '{"cores": 8, "threads": 16, "tdp": 105}', '[]')
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO master_products 
            (standardName, category, brand, currentCheapestPrice, keySpecsJson, imageUrls) 
            VALUES ('NVIDIA GeForce RTX 4070', 'GPU', 'NVIDIA', 65000, '{"memory": 12, "tdp": 200}', '[]')
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO price_entries 
            (masterProductId, vendorId, scrapedPrice, availabilityStatus, productUrl) 
            VALUES (1, 1, 28500, 'in_stock', 'https://www.techlandbd.com/amd-ryzen-7-7700x')
        """)
        
        cursor.execute("""
            INSERT OR IGNORE INTO price_entries 
            (masterProductId, vendorId, scrapedPrice, availabilityStatus, productUrl) 
            VALUES (2, 1, 65000, 'in_stock', 'https://www.techlandbd.com/rtx-4070')
        """)
        
        conn.commit()
        print("[OK] Sample data inserted")
        
        # Show database contents
        print("\nDatabase Contents:")
        print("-" * 40)
        
        # Show vendors
        cursor.execute("SELECT * FROM vendors")
        vendors = cursor.fetchall()
        print(f"Vendors ({len(vendors)}):")
        for vendor in vendors:
            print(f"  {vendor[0]}: {vendor[1]} - {vendor[2]}")
        
        # Show master products
        cursor.execute("SELECT * FROM master_products")
        products = cursor.fetchall()
        print(f"\nMaster Products ({len(products)}):")
        for product in products:
            print(f"  {product[0]}: {product[1]} ({product[2]}) - BDT {product[4]}")
        
        # Show price entries
        cursor.execute("SELECT * FROM price_entries")
        prices = cursor.fetchall()
        print(f"\nPrice Entries ({len(prices)}):")
        for price in prices:
            print(f"  Product {price[1]} at Vendor {price[2]}: BDT {price[3]}")
        
        conn.close()
        
        print(f"\n[OK] Database test completed successfully!")
        print(f"[OK] Database file: {Path(db_path).absolute()}")
        
    except Exception as e:
        print(f"[ERROR] Database test failed: {e}")

if __name__ == "__main__":
    test_database_connection()
