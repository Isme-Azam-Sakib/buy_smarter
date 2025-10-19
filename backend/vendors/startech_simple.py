#!/usr/bin/env python3
"""
Star Tech Scraper - Simple version without .env dependency
"""

import asyncio
import json
import os
import sys
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from scrapers.startech_scraper import StarTechScraper

class StarTechSimple:
    """Simple Star Tech scraper without database dependencies"""
    
    def __init__(self):
        self.scraper = StarTechScraper()
        self.vendor_name = "Star Tech"
        self.vendor_website = "https://www.startech.com.bd"
        self.vendor_logo_url = "https://www.startech.com.bd/image/catalog/logo.png"
        self.db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prisma', 'buysmarter.db')

    async def scrape_and_save(self) -> Dict[str, Any]:
        """Scrape products and save to JSON"""
        print("=" * 60)
        print("STAR TECH SCRAPER")
        print("=" * 60)
        
        start_time = datetime.now()
        
        # Scrape products
        print("Scraping products from Star Tech...")
        products = await self.scraper.scrape_all_products()
        print(f"Scraped {len(products)} products")
        
        if not products:
            return {"success": False, "message": "No products scraped"}
        
        # Save to JSON
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_filename = f"startech_products_{timestamp}.json"
        json_path = os.path.join(os.path.dirname(__file__), json_filename)
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        # Show sample products
        print(f"\nSample products:")
        for i, product in enumerate(products[:5], 1):
            print(f"{i}. {product['name']} - {product['price']:,.0f} BDT ({product['category']})")
        
        return {
            "success": True,
            "scraped": len(products),
            "duration": str(duration),
            "file": json_filename,
            "path": json_path
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get basic statistics from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get vendor ID
            cursor.execute("SELECT vendorId FROM vendors WHERE name = ?", (self.vendor_name,))
            vendor_result = cursor.fetchone()
            
            if not vendor_result:
                return {"error": "Star Tech vendor not found"}
            
            vendor_id = vendor_result[0]
            
            # Get statistics
            cursor.execute("""
                SELECT COUNT(*) FROM master_products mp
                JOIN price_entries pe ON mp.productId = pe.masterProductId
                WHERE pe.vendorId = ?
            """, (vendor_id,))
            total_products = cursor.fetchone()[0]
            
            cursor.execute("SELECT COUNT(*) FROM price_entries WHERE vendorId = ?", (vendor_id,))
            total_prices = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT category, COUNT(*) as count
                FROM master_products mp
                JOIN price_entries pe ON mp.productId = pe.masterProductId
                WHERE pe.vendorId = ?
                GROUP BY category
                ORDER BY count DESC
            """, (vendor_id,))
            categories = cursor.fetchall()
            
            return {
                "vendor": self.vendor_name,
                "total_products": total_products,
                "total_prices": total_prices,
                "categories": [{"category": cat[0], "count": cat[1]} for cat in categories]
            }
            
        except Exception as e:
            return {"error": str(e)}
        finally:
            if 'conn' in locals():
                conn.close()

# CLI Interface
async def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Star Tech Simple Scraper')
    parser.add_argument('action', choices=['scrape', 'stats'], 
                       help='Action to perform')
    
    args = parser.parse_args()
    
    scraper = StarTechSimple()
    
    if args.action == 'scrape':
        result = await scraper.scrape_and_save()
        if result['success']:
            print(f"\nSUCCESS!")
            print(f"   Scraped: {result['scraped']} products")
            print(f"   Duration: {result['duration']}")
            print(f"   Saved to: {result['file']}")
        else:
            print(f"\nERROR: {result['message']}")
            
    elif args.action == 'stats':
        stats = scraper.get_stats()
        if 'error' in stats:
            print(f"ERROR: {stats['error']}")
        else:
            print(f"\nStar Tech Statistics:")
            print(f"Total Products: {stats['total_products']}")
            print(f"Total Prices: {stats['total_prices']}")
            print(f"Categories: {len(stats['categories'])}")
            for cat in stats['categories']:
                print(f"  • {cat['category'].upper()}: {cat['count']} products")

if __name__ == "__main__":
    asyncio.run(main())
