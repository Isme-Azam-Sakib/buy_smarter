#!/usr/bin/env python3
"""
Migration script to add scrape_source, standard_name_source, and ml_confidence columns
to all_products table.
"""

import sqlite3
import sys
import os

def migrate_database(db_path: str = "final_products.db"):
    """Add new columns for tracking scrape source and ML usage."""
    
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(all_products)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Add scrape_source column if it doesn't exist
        if 'scrape_source' not in columns:
            print("Adding scrape_source column...")
            cursor.execute("""
                ALTER TABLE all_products 
                ADD COLUMN scrape_source TEXT DEFAULT 'bulk'
            """)
            # Set all existing rows to 'bulk'
            cursor.execute("""
                UPDATE all_products 
                SET scrape_source = 'bulk' 
                WHERE scrape_source IS NULL
            """)
            print("[OK] Added scrape_source column")
        else:
            print("[OK] scrape_source column already exists")
        
        # Add standard_name_source column if it doesn't exist
        if 'standard_name_source' not in columns:
            print("Adding standard_name_source column...")
            cursor.execute("""
                ALTER TABLE all_products 
                ADD COLUMN standard_name_source TEXT DEFAULT 'bulk'
            """)
            # Set all existing rows to 'bulk'
            cursor.execute("""
                UPDATE all_products 
                SET standard_name_source = 'bulk' 
                WHERE standard_name_source IS NULL
            """)
            print("[OK] Added standard_name_source column")
        else:
            print("[OK] standard_name_source column already exists")
        
        # Add ml_confidence column if it doesn't exist
        if 'ml_confidence' not in columns:
            print("Adding ml_confidence column...")
            cursor.execute("""
                ALTER TABLE all_products 
                ADD COLUMN ml_confidence REAL
            """)
            print("[OK] Added ml_confidence column")
        else:
            print("[OK] ml_confidence column already exists")
        
        conn.commit()
        print("\n[SUCCESS] Migration completed successfully!")
        return True
        
    except sqlite3.Error as e:
        print(f"[ERROR] Database error: {e}")
        conn.rollback()
        return False
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    db_path = sys.argv[1] if len(sys.argv) > 1 else "final_products.db"
    success = migrate_database(db_path)
    sys.exit(0 if success else 1)

