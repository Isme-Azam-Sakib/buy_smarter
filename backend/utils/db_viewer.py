#!/usr/bin/env python3
"""
Database Viewer - Clean utility for viewing scraped data
"""

import sqlite3
import json
import os
import sys
from typing import Dict, Any, List, Optional

class DatabaseViewer:
    """Clean database viewer utility"""
    
    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            # Default to the main database
            self.db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prisma', 'buysmarter.db')
        else:
            self.db_path = db_path

    def get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def get_overview(self) -> Dict[str, Any]:
        """Get database overview statistics"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Basic counts
            cursor.execute("SELECT COUNT(*) FROM vendors")
            total_vendors = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM master_products")
            total_products = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM price_entries")
            total_prices = cursor.fetchone()[0]
            
            # Vendors
            cursor.execute("SELECT name, website, isActive FROM vendors")
            vendors = [{"name": row[0], "website": row[1], "active": bool(row[2])} for row in cursor.fetchall()]
            
            # Products by category
            cursor.execute("""
                SELECT category, COUNT(*) as count 
                FROM master_products 
                GROUP BY category 
                ORDER BY count DESC
            """)
            categories = [{"category": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # Top brands
            cursor.execute("""
                SELECT brand, COUNT(*) as count 
                FROM master_products 
                GROUP BY brand 
                ORDER BY count DESC 
                LIMIT 10
            """)
            brands = [{"brand": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            return {
                "total_vendors": total_vendors,
                "total_products": total_products,
                "total_prices": total_prices,
                "vendors": vendors,
                "categories": categories,
                "top_brands": brands
            }
            
        finally:
            conn.close()

    def get_products(self, limit: int = 20, offset: int = 0, 
                    category: Optional[str] = None, brand: Optional[str] = None,
                    search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get products with optional filtering"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Build query
            where_conditions = []
            params = []
            
            if category:
                where_conditions.append("mp.category = ?")
                params.append(category)
            
            if brand:
                where_conditions.append("mp.brand = ?")
                params.append(brand)
            
            if search:
                where_conditions.append("(mp.standardName LIKE ? OR mp.brand LIKE ?)")
                search_term = f"%{search}%"
                params.extend([search_term, search_term])
            
            where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
            
            query = f"""
                SELECT 
                    mp.productId,
                    mp.standardName,
                    mp.category,
                    mp.brand,
                    mp.currentCheapestPrice,
                    mp.keySpecsJson,
                    mp.imageUrls,
                    mp.createdAt,
                    mp.updatedAt
                FROM master_products mp
                {where_clause}
                ORDER BY mp.standardName
                LIMIT ? OFFSET ?
            """
            
            params.extend([limit, offset])
            cursor.execute(query, params)
            
            products = []
            for row in cursor.fetchall():
                product = {
                    "productId": row[0],
                    "standardName": row[1],
                    "category": row[2],
                    "brand": row[3],
                    "currentCheapestPrice": row[4],
                    "keySpecsJson": json.loads(row[5]) if row[5] else {},
                    "imageUrls": json.loads(row[6]) if row[6] else [],
                    "createdAt": row[7],
                    "updatedAt": row[8]
                }
                products.append(product)
            
            return products
            
        finally:
            conn.close()

    def get_vendor_products(self, vendor_name: str) -> List[Dict[str, Any]]:
        """Get products for a specific vendor"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT 
                    mp.productId,
                    mp.standardName,
                    mp.category,
                    mp.brand,
                    mp.currentCheapestPrice,
                    pe.scrapedPrice,
                    pe.availabilityStatus,
                    pe.productUrl,
                    pe.scrapedTimestamp
                FROM master_products mp
                JOIN price_entries pe ON mp.productId = pe.masterProductId
                JOIN vendors v ON pe.vendorId = v.vendorId
                WHERE v.name = ?
                ORDER BY mp.standardName
            """
            
            cursor.execute(query, (vendor_name,))
            
            products = []
            for row in cursor.fetchall():
                product = {
                    "productId": row[0],
                    "standardName": row[1],
                    "category": row[2],
                    "brand": row[3],
                    "currentCheapestPrice": row[4],
                    "scrapedPrice": row[5],
                    "availabilityStatus": row[6],
                    "productUrl": row[7],
                    "scrapedTimestamp": row[8]
                }
                products.append(product)
            
            return products
            
        finally:
            conn.close()

    def print_overview(self):
        """Print database overview"""
        overview = self.get_overview()
        
        print("=" * 60)
        print("DATABASE OVERVIEW")
        print("=" * 60)
        print(f"Total Vendors: {overview['total_vendors']}")
        print(f"Total Products: {overview['total_products']}")
        print(f"Total Price Entries: {overview['total_prices']}")
        
        print(f"\nVENDORS:")
        for vendor in overview['vendors']:
            status = "Active" if vendor['active'] else "Inactive"
            print(f"  • {vendor['name']} - {vendor['website']} ({status})")
        
        print(f"\nPRODUCTS BY CATEGORY:")
        for cat in overview['categories']:
            print(f"  • {cat['category'].upper()}: {cat['count']} products")
        
        print(f"\nTOP BRANDS:")
        for brand in overview['top_brands']:
            print(f"  • {brand['brand']}: {brand['count']} products")

    def print_products(self, limit: int = 10, category: Optional[str] = None, 
                      brand: Optional[str] = None, search: Optional[str] = None):
        """Print products with optional filtering"""
        products = self.get_products(limit=limit, category=category, brand=brand, search=search)
        
        print("=" * 60)
        print("PRODUCTS")
        print("=" * 60)
        
        for i, product in enumerate(products, 1):
            print(f"{i}. {product['standardName']}")
            print(f"   Category: {product['category']} | Brand: {product['brand']}")
            print(f"   Price: {product['currentCheapestPrice']:,.0f} BDT")
            print(f"   Images: {len(product['imageUrls'])} available")
            if product['keySpecsJson']:
                print(f"   Specs: {len(product['keySpecsJson'])} fields")
            print()

# CLI Interface
def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Database Viewer')
    parser.add_argument('action', choices=['overview', 'products', 'vendor'], 
                       help='Action to perform')
    parser.add_argument('--limit', type=int, default=10, 
                       help='Number of products to show')
    parser.add_argument('--category', help='Filter by category')
    parser.add_argument('--brand', help='Filter by brand')
    parser.add_argument('--search', help='Search in product names')
    parser.add_argument('--vendor-name', help='Vendor name for vendor action')
    
    args = parser.parse_args()
    
    viewer = DatabaseViewer()
    
    if args.action == 'overview':
        viewer.print_overview()
        
    elif args.action == 'products':
        viewer.print_products(
            limit=args.limit,
            category=args.category,
            brand=args.brand,
            search=args.search
        )
        
    elif args.action == 'vendor':
        if not args.vendor_name:
            print("ERROR: --vendor-name is required for vendor action")
            return
        
        products = viewer.get_vendor_products(args.vendor_name)
        print(f"\nProducts from {args.vendor_name}:")
        for i, product in enumerate(products[:args.limit], 1):
            print(f"{i}. {product['standardName']} - {product['scrapedPrice']:,.0f} BDT")

if __name__ == "__main__":
    main()
