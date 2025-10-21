#!/usr/bin/env python3
"""
Clean Database Spacing - Remove extra spaces from product names in the database
"""

import sqlite3
import re

def clean_text(text):
    """Clean text by removing extra spaces and hyphens"""
    if not isinstance(text, str):
        return text
    
    # Remove multiple consecutive spaces and replace with single space
    cleaned = re.sub(r'\s+', ' ', text)
    
    # Remove hyphens and replace with spaces
    cleaned = cleaned.replace('-', ' ')
    
    # Remove multiple consecutive spaces again after hyphen removal
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # Remove leading and trailing spaces
    cleaned = cleaned.strip()
    
    return cleaned

def clean_database(db_path='../cpu_products.db'):
    """Clean the database by removing extra spaces from product names"""
    
    print(f"Connecting to database: {db_path}")
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    conn.text_factory = str
    cursor = conn.cursor()
    
    # Get all products
    cursor.execute("SELECT id, raw_name, standard_name FROM cpu_products")
    products = cursor.fetchall()
    
    print(f"Found {len(products)} products in database")
    
    changes_made = 0
    
    for product_id, raw_name, standard_name in products:
        # Clean the names
        cleaned_raw_name = clean_text(raw_name)
        cleaned_standard_name = clean_text(standard_name)
        
        # Check if cleaning is needed
        if cleaned_raw_name != raw_name or cleaned_standard_name != standard_name:
            changes_made += 1
            
            if cleaned_raw_name != raw_name:
                print(f"Cleaned raw_name: '{raw_name}' -> '{cleaned_raw_name}'")
            
            if cleaned_standard_name != standard_name:
                print(f"Cleaned standard_name: '{standard_name}' -> '{cleaned_standard_name}'")
            
            # Update the database
            cursor.execute("""
                UPDATE cpu_products 
                SET raw_name = ?, standard_name = ?
                WHERE id = ?
            """, (cleaned_raw_name, cleaned_standard_name, product_id))
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f"\nDatabase cleaning completed!")
    print(f"Changes made: {changes_made} product names cleaned")
    
    return changes_made

def main():
    """Main function"""
    print("="*60)
    print("CLEANING DATABASE - REMOVING EXTRA SPACES")
    print("="*60)
    
    # Clean the database
    changes = clean_database()
    
    print("\n" + "="*60)
    print("DATABASE CLEANING COMPLETED!")
    print("="*60)
    print(f"Cleaned {changes} product names in the database")
    print("Future exports will now have clean spacing!")

if __name__ == "__main__":
    main()
