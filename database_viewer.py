#!/usr/bin/env python3
"""
Comprehensive database viewer for BuySmarter PC Parts
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

class DatabaseViewer:
    """Database viewer for BuySmarter PC Parts"""
    
    def __init__(self, db_path="buysmarter.db"):
        self.db_path = db_path
        self.conn = None
    
    def connect(self):
        """Connect to database"""
        try:
            self.conn = sqlite3.connect(self.db_path)
            self.conn.row_factory = sqlite3.Row  # Enable column access by name
            return True
        except Exception as e:
            print(f"Error connecting to database: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from database"""
        if self.conn:
            self.conn.close()
    
    def show_database_info(self):
        """Show database information"""
        print("BuySmarter PC Parts - Database Viewer")
        print("=" * 60)
        
        if not Path(self.db_path).exists():
            print(f"Database file not found: {self.db_path}")
            return
        
        file_size = Path(self.db_path).stat().st_size
        print(f"Database file: {Path(self.db_path).absolute()}")
        print(f"File size: {file_size:,} bytes ({file_size/1024:.1f} KB)")
        print(f"Last modified: {datetime.fromtimestamp(Path(self.db_path).stat().st_mtime)}")
        
        if not self.connect():
            return
        
        # Get table information
        cursor = self.conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        
        print(f"\nTables: {len(tables)}")
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            print(f"  - {table_name}: {count:,} rows")
        
        self.disconnect()
    
    def show_vendors(self):
        """Show all vendors"""
        if not self.connect():
            return
        
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM vendors ORDER BY name")
        vendors = cursor.fetchall()
        
        print(f"\nVendors ({len(vendors)}):")
        print("-" * 50)
        for vendor in vendors:
            status = "Active" if vendor['isActive'] else "Inactive"
            print(f"ID: {vendor['vendorId']}")
            print(f"Name: {vendor['name']}")
            print(f"Website: {vendor['website']}")
            print(f"Status: {status}")
            print(f"Created: {vendor['createdAt']}")
            print()
        
        self.disconnect()
    
    def show_master_products(self, limit=10):
        """Show master products"""
        if not self.connect():
            return
        
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT * FROM master_products ORDER BY productId LIMIT {limit}")
        products = cursor.fetchall()
        
        print(f"\nMaster Products (showing {len(products)} of total):")
        print("-" * 60)
        for product in products:
            print(f"ID: {product['productId']}")
            print(f"Name: {product['standardName']}")
            print(f"Category: {product['category']}")
            print(f"Brand: {product['brand']}")
            print(f"Price: BDT {product['currentCheapestPrice']:,}" if product['currentCheapestPrice'] else "Price: Not set")
            
            # Show specs if available
            if product['keySpecsJson']:
                try:
                    specs = json.loads(product['keySpecsJson'])
                    print(f"Specs: {specs}")
                except:
                    print(f"Specs: {product['keySpecsJson']}")
            
            print(f"Created: {product['createdAt']}")
            print()
        
        self.disconnect()
    
    def show_price_entries(self, limit=10):
        """Show price entries"""
        if not self.connect():
            return
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT pe.*, mp.standardName, v.name as vendorName 
            FROM price_entries pe
            JOIN master_products mp ON pe.masterProductId = mp.productId
            JOIN vendors v ON pe.vendorId = v.vendorId
            ORDER BY pe.scrapedTimestamp DESC
            LIMIT ?
        """, (limit,))
        
        entries = cursor.fetchall()
        
        print(f"\nPrice Entries (showing {len(entries)} of total):")
        print("-" * 70)
        for entry in entries:
            print(f"ID: {entry['id']}")
            print(f"Product: {entry['standardName']}")
            print(f"Vendor: {entry['vendorName']}")
            print(f"Price: BDT {entry['scrapedPrice']:,}")
            print(f"Status: {entry['availabilityStatus']}")
            print(f"Scraped: {entry['scrapedTimestamp']}")
            if entry['productUrl']:
                print(f"URL: {entry['productUrl']}")
            print()
        
        self.disconnect()
    
    def show_statistics(self):
        """Show database statistics"""
        if not self.connect():
            return
        
        cursor = self.conn.cursor()
        
        print("\nDatabase Statistics:")
        print("-" * 40)
        
        # Count records
        cursor.execute("SELECT COUNT(*) FROM vendors")
        vendor_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM master_products")
        product_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM price_entries")
        price_count = cursor.fetchone()[0]
        
        print(f"Vendors: {vendor_count:,}")
        print(f"Master Products: {product_count:,}")
        print(f"Price Entries: {price_count:,}")
        
        # Category breakdown
        cursor.execute("SELECT category, COUNT(*) FROM master_products GROUP BY category ORDER BY COUNT(*) DESC")
        categories = cursor.fetchall()
        
        print(f"\nProducts by Category:")
        for category in categories:
            print(f"  {category[0]}: {category[1]:,}")
        
        # Price statistics
        cursor.execute("SELECT MIN(scrapedPrice), MAX(scrapedPrice), AVG(scrapedPrice) FROM price_entries WHERE scrapedPrice > 0")
        price_stats = cursor.fetchone()
        
        if price_stats[0]:
            print(f"\nPrice Statistics:")
            print(f"  Lowest: BDT {price_stats[0]:,.0f}")
            print(f"  Highest: BDT {price_stats[1]:,.0f}")
            print(f"  Average: BDT {price_stats[2]:,.0f}")
        
        self.disconnect()
    
    def search_products(self, query):
        """Search for products"""
        if not self.connect():
            return
        
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM master_products 
            WHERE standardName LIKE ? OR brand LIKE ? OR category LIKE ?
            ORDER BY standardName
            LIMIT 20
        """, (f"%{query}%", f"%{query}%", f"%{query}%"))
        
        products = cursor.fetchall()
        
        print(f"\nSearch Results for '{query}' ({len(products)} found):")
        print("-" * 60)
        
        if not products:
            print("No products found.")
        else:
            for product in products:
                print(f"ID: {product['productId']} | {product['standardName']} | {product['brand']} | {product['category']}")
        
        self.disconnect()

def main():
    """Main function"""
    viewer = DatabaseViewer()
    
    # Show database info
    viewer.show_database_info()
    
    # Show statistics
    viewer.show_statistics()
    
    # Show sample data
    viewer.show_vendors()
    viewer.show_master_products(5)
    viewer.show_price_entries(5)
    
    print("\n" + "=" * 60)
    print("Database Viewer Commands:")
    print("=" * 60)
    print("To view more data, you can use these methods:")
    print("- viewer.show_vendors()")
    print("- viewer.show_master_products(limit=20)")
    print("- viewer.show_price_entries(limit=20)")
    print("- viewer.search_products('AMD')")
    print("- viewer.show_statistics()")

if __name__ == "__main__":
    main()
