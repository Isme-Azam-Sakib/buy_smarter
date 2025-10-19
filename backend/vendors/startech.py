#!/usr/bin/env python3
"""
Star Tech Scraper - Complete Solution
Handles scraping, storing, and managing Star Tech products
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
from database import SessionLocal
from models import MasterProduct, Vendor, PriceEntry

class StarTechManager:
    """Complete Star Tech management system"""
    
    def __init__(self):
        self.scraper = StarTechScraper()
        self.vendor_name = "Star Tech"
        self.vendor_website = "https://www.startech.com.bd"
        self.vendor_logo_url = "https://www.startech.com.bd/image/catalog/logo.png"
        self.db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'prisma', 'buysmarter.db')

    async def scrape_products(self, save_json: bool = True) -> List[Dict[str, Any]]:
        """Scrape products from Star Tech"""
        print("=" * 60)
        print("STAR TECH PRODUCT SCRAPING")
        print("=" * 60)
        
        print("Starting product scraping...")
        products = await self.scraper.scrape_all_products()
        print(f"Scraped {len(products)} products from Star Tech")
        
        if save_json and products:
            # Save to JSON for backup
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_filename = f"startech_products_{timestamp}.json"
            json_path = os.path.join(os.path.dirname(__file__), json_filename)
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(products, f, ensure_ascii=False, indent=2)
            print(f"Saved scraped data to {json_filename}")
        
        return products

    def clear_existing_data(self):
        """Clear existing Star Tech data from database"""
        print("\nClearing existing Star Tech data...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Get Star Tech vendor ID
            cursor.execute("SELECT vendorId FROM vendors WHERE name = ?", (self.vendor_name,))
            vendor_result = cursor.fetchone()
            
            if vendor_result:
                vendor_id = vendor_result[0]
                
                # Delete price entries for Star Tech
                cursor.execute("DELETE FROM price_entries WHERE vendorId = ?", (vendor_id,))
                deleted_prices = cursor.rowcount
                print(f"Deleted {deleted_prices} price entries")
                
                # Delete products that only have Star Tech prices
                cursor.execute("""
                    DELETE FROM master_products 
                    WHERE productId NOT IN (
                        SELECT DISTINCT masterProductId 
                        FROM price_entries 
                        WHERE vendorId != ?
                    )
                """, (vendor_id,))
                deleted_products = cursor.rowcount
                print(f"Deleted {deleted_products} products")
                
                # Delete Star Tech vendor
                cursor.execute("DELETE FROM vendors WHERE vendorId = ?", (vendor_id,))
                print("Deleted Star Tech vendor")
                
                conn.commit()
                print("SUCCESS: Existing Star Tech data cleared!")
            else:
                print("No existing Star Tech data found")
                
        except Exception as e:
            print(f"Error clearing data: {e}")
            conn.rollback()
        finally:
            conn.close()

    def store_products(self, products: List[Dict[str, Any]]) -> int:
        """Store products in database"""
        print("\nStoring products in database...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        stored_count = 0
        
        try:
            # Create Star Tech vendor
            cursor.execute("""
                INSERT INTO vendors (name, website, logoUrl, isActive, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                self.vendor_name,
                self.vendor_website,
                self.vendor_logo_url,
                True,
                datetime.now().isoformat(),
                datetime.now().isoformat()
            ))
            vendor_id = cursor.lastrowid
            print(f"Created vendor: {self.vendor_name} (ID: {vendor_id})")
            
            # Store products
            for i, product_data in enumerate(products):
                try:
                    # Create master product
                    cursor.execute("""
                        INSERT INTO master_products 
                        (standardName, category, brand, currentCheapestPrice, keySpecsJson, imageUrls, createdAt, updatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        product_data['name'],
                        product_data['category'],
                        product_data['brand'],
                        product_data['price'],
                        json.dumps(product_data.get('specifications', {})),
                        json.dumps(product_data.get('image_url', [])),
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    ))
                    product_id = cursor.lastrowid
                    
                    # Create price entry
                    cursor.execute("""
                        INSERT INTO price_entries 
                        (masterProductId, vendorId, scrapedPrice, availabilityStatus, productUrl, scrapedTimestamp)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        product_id,
                        vendor_id,
                        product_data['price'],
                        product_data.get('availability', 'in_stock'),
                        product_data['url'],
                        datetime.now().isoformat()
                    ))
                    
                    stored_count += 1
                    if stored_count % 10 == 0:
                        print(f"Stored {stored_count} products...")
                        
                except Exception as e:
                    print(f"Error storing product {product_data.get('name')}: {e}")
                    continue
            
            conn.commit()
            print(f"SUCCESS: Stored {stored_count} products in database!")
                    
        except Exception as e:
            print(f"Database error: {e}")
            conn.rollback()
        finally:
            conn.close()
            
        return stored_count

    def get_stats(self) -> Dict[str, Any]:
        """Get Star Tech statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
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
            
            cursor.execute("""
                SELECT brand, COUNT(*) as count
                FROM master_products mp
                JOIN price_entries pe ON mp.productId = pe.masterProductId
                WHERE pe.vendorId = ?
                GROUP BY brand
                ORDER BY count DESC
                LIMIT 10
            """, (vendor_id,))
            brands = cursor.fetchall()
            
            return {
                "vendor": self.vendor_name,
                "total_products": total_products,
                "total_prices": total_prices,
                "categories": [{"category": cat[0], "count": cat[1]} for cat in categories],
                "top_brands": [{"brand": brand[0], "count": brand[1]} for brand in brands]
            }
            
        except Exception as e:
            return {"error": str(e)}
        finally:
            conn.close()

    async def full_sync(self, clear_existing: bool = True) -> Dict[str, Any]:
        """Complete sync: clear, scrape, and store"""
        print("=" * 60)
        print("STAR TECH FULL SYNC")
        print("=" * 60)
        
        start_time = datetime.now()
        
        # Step 1: Clear existing data
        if clear_existing:
            self.clear_existing_data()
        
        # Step 2: Scrape products
        products = await self.scrape_products()
        
        if not products:
            return {"success": False, "message": "No products scraped"}
        
        # Step 3: Store products
        stored_count = self.store_products(products)
        
        end_time = datetime.now()
        duration = end_time - start_time
        
        # Step 4: Get statistics
        stats = self.get_stats()
        
        return {
            "success": True,
            "scraped": len(products),
            "stored": stored_count,
            "duration": str(duration),
            "stats": stats
        }

# CLI Interface
async def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Star Tech Scraper')
    parser.add_argument('action', choices=['scrape', 'sync', 'stats', 'clear'], 
                       help='Action to perform')
    parser.add_argument('--no-clear', action='store_true', 
                       help='Skip clearing existing data during sync')
    
    args = parser.parse_args()
    
    manager = StarTechManager()
    
    if args.action == 'scrape':
        products = await manager.scrape_products()
        print(f"\nScraped {len(products)} products")
        
    elif args.action == 'sync':
        result = await manager.full_sync(clear_existing=not args.no_clear)
        if result['success']:
            print(f"\nSUCCESS: {result['stored']} products synced in {result['duration']}")
            print(f"Categories: {len(result['stats']['categories'])}")
            print(f"Top brands: {len(result['stats']['top_brands'])}")
        else:
            print(f"\nERROR: {result['message']}")
            
    elif args.action == 'stats':
        stats = manager.get_stats()
        if 'error' in stats:
            print(f"ERROR: {stats['error']}")
        else:
            print(f"\nStar Tech Statistics:")
            print(f"Total Products: {stats['total_products']}")
            print(f"Total Prices: {stats['total_prices']}")
            print(f"Categories: {len(stats['categories'])}")
            print(f"Top Brands: {len(stats['top_brands'])}")
            
    elif args.action == 'clear':
        manager.clear_existing_data()

if __name__ == "__main__":
    asyncio.run(main())
