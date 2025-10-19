#!/usr/bin/env python3
"""
Database Explorer - View tables like phpMyAdmin
"""

import sqlite3
import os
import json
from tabulate import tabulate

def explore_database():
    """Explore database tables and data like phpMyAdmin"""
    
    # Database path
    db_path = os.path.join('prisma', 'buysmarter.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at: {db_path}")
        return
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        print("=" * 80)
        print("DATABASE EXPLORER - BuySmarter Database")
        print("=" * 80)
        
        # Show all tables
        print("\nDATABASE TABLES:")
        print("-" * 40)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        for i, table in enumerate(tables, 1):
            table_name = table['name']
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            count = cursor.fetchone()['count']
            print(f"{i}. {table_name} ({count} records)")
        
        # Show table schemas
        print("\n" + "=" * 80)
        print("TABLE SCHEMAS:")
        print("=" * 80)
        
        for table in tables:
            table_name = table['name']
            print(f"\nTABLE: {table_name}")
            print("-" * 50)
            
            # Get column info
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()
            
            print("Columns:")
            for col in columns:
                nullable = "NULL" if col['notnull'] == 0 else "NOT NULL"
                default = f" DEFAULT {col['dflt_value']}" if col['dflt_value'] is not None else ""
                print(f"  {col['name']} ({col['type']}) {nullable}{default}")
            
            # Show sample data
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 5")
            sample_data = cursor.fetchall()
            
            if sample_data:
                print(f"\nSample Data (first 5 rows):")
                
                # Convert to list of lists for tabulate
                headers = [col['name'] for col in columns]
                rows = []
                
                for row in sample_data:
                    row_data = []
                    for col in columns:
                        value = row[col['name']]
                        if value is None:
                            row_data.append("NULL")
                        elif isinstance(value, str) and len(value) > 50:
                            row_data.append(value[:47] + "...")
                        else:
                            row_data.append(str(value))
                    rows.append(row_data)
                
                print(tabulate(rows, headers=headers, tablefmt="grid"))
            else:
                print("No data in this table")
        
        # Show relationships
        print("\n" + "=" * 80)
        print("TABLE RELATIONSHIPS:")
        print("=" * 80)
        
        # Check for foreign keys
        cursor.execute("PRAGMA foreign_key_list(master_products)")
        fk_master = cursor.fetchall()
        if fk_master:
            print("\nmaster_products foreign keys:")
            for fk in fk_master:
                print(f"  {fk['from']} -> {fk['table']}.{fk['to']}")
        
        cursor.execute("PRAGMA foreign_key_list(price_entries)")
        fk_prices = cursor.fetchall()
        if fk_prices:
            print("\nprice_entries foreign keys:")
            for fk in fk_prices:
                print(f"  {fk['from']} -> {fk['table']}.{fk['to']}")
        
        # Show statistics
        print("\n" + "=" * 80)
        print("DATABASE STATISTICS:")
        print("=" * 80)
        
        for table in tables:
            table_name = table['name']
            cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
            count = cursor.fetchone()['count']
            print(f"{table_name}: {count:,} records")
        
        # Show some specific queries
        print("\n" + "=" * 80)
        print("SAMPLE QUERIES:")
        print("=" * 80)
        
        # Top 5 most expensive products
        print("\nTop 5 Most Expensive Products:")
        cursor.execute("""
            SELECT standardName, brand, currentCheapestPrice, category
            FROM master_products 
            ORDER BY currentCheapestPrice DESC 
            LIMIT 5
        """)
        expensive = cursor.fetchall()
        for product in expensive:
            print(f"  {product['standardName']} - {product['currentCheapestPrice']:,} BDT ({product['category']})")
        
        # Products by category
        print("\nProducts by Category:")
        cursor.execute("""
            SELECT category, COUNT(*) as count, AVG(currentCheapestPrice) as avg_price
            FROM master_products 
            GROUP BY category 
            ORDER BY count DESC
        """)
        categories = cursor.fetchall()
        for cat in categories:
            print(f"  {cat['category']}: {cat['count']} products (avg: {cat['avg_price']:,.0f} BDT)")
        
        # Recent price entries
        print("\nRecent Price Entries:")
        cursor.execute("""
            SELECT mp.standardName, pe.scrapedPrice, pe.scrapedTimestamp
            FROM price_entries pe
            JOIN master_products mp ON pe.masterProductId = mp.productId
            ORDER BY pe.scrapedTimestamp DESC
            LIMIT 5
        """)
        recent = cursor.fetchall()
        for entry in recent:
            print(f"  {entry['standardName']} - {entry['scrapedPrice']:,} BDT ({entry['scrapedTimestamp']})")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    explore_database()
