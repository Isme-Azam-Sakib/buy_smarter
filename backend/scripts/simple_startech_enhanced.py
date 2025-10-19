#!/usr/bin/env python3
"""
Simple Star Tech Enhanced Scraper that bypasses .env loading
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

# Direct database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')

class SimpleStarTechEnhanced:
    """Simple enhanced Star Tech scraper with basic reconciliation"""
    
    def __init__(self):
        self.vendor_name = "Star Tech"
        self.vendor_website = "https://www.startech.com.bd"
        self.vendor_logo_url = "https://www.startech.com.bd/image/catalog/logo.png"
        
        # Statistics tracking
        self.stats = {
            'total_scraped': 0,
            'matched_products': 0,
            'created_products': 0,
            'failed_matches': 0,
            'errors': 0
        }

    async def scrape_and_store(self) -> Dict[str, Any]:
        """Scrape products and store with basic reconciliation"""
        print("=" * 80)
        print("SIMPLE STAR TECH ENHANCED SCRAPER")
        print("=" * 80)
        
        start_time = datetime.now()
        
        try:
            # Step 1: Import the scraper
            from scrapers.startech_scraper import StarTechScraper
            scraper = StarTechScraper()
            
            # Step 2: Scrape products
            print("Step 1: Scraping products from Star Tech...")
            scraped_products = await scraper.scrape_all_products()
            print(f"Scraped {len(scraped_products)} products")
            
            if not scraped_products:
                return {"success": False, "message": "No products scraped"}
            
            self.stats['total_scraped'] = len(scraped_products)
            
            # Step 3: Set up vendor
            print("\nStep 2: Setting up Star Tech vendor...")
            vendor_id = await self._get_or_create_vendor()
            
            # Step 4: Process each product with basic reconciliation
            print("\nStep 3: Processing products with basic reconciliation...")
            processed_count = 0
            
            for i, product_data in enumerate(scraped_products, 1):
                try:
                    print(f"\nProcessing product {i}/{len(scraped_products)}: {product_data.get('name', 'Unknown')}")
                    
                    # Try to find existing master product
                    master_product_id = await self._find_or_create_master_product(product_data)
                    
                    if master_product_id:
                        # Create price entry
                        await self._create_price_entry(vendor_id, master_product_id, product_data)
                        self.stats['matched_products'] += 1
                        print(f"  [OK] Processed: {product_data.get('name', 'Unknown')}")
                    else:
                        self.stats['failed_matches'] += 1
                        print(f"  [FAIL] Failed to process: {product_data.get('name', 'Unknown')}")
                    
                    processed_count += 1
                    
                    # Commit every 10 products
                    if processed_count % 10 == 0:
                        print(f"  Committed {processed_count} products...")
                
                except Exception as e:
                    self.stats['errors'] += 1
                    print(f"  [ERROR] Error processing product: {e}")
                    continue
            
            end_time = datetime.now()
            duration = end_time - start_time
            
            # Print final statistics
            self._print_final_stats(duration)
            
            return {
                "success": True,
                "stats": self.stats,
                "duration": str(duration)
            }
            
        except Exception as e:
            print(f"Error in scrape_and_store: {e}")
            return {"success": False, "message": str(e)}

    async def _get_or_create_vendor(self) -> int:
        """Get or create the Star Tech vendor"""
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        try:
            # Check if vendor exists
            cursor.execute("SELECT vendorId FROM vendors WHERE name = ?", (self.vendor_name,))
            vendor = cursor.fetchone()
            
            if vendor:
                vendor_id = vendor[0]
                print(f"Using existing vendor: {self.vendor_name} (ID: {vendor_id})")
            else:
                # Create new vendor
                cursor.execute("""
                    INSERT INTO vendors (name, website, logoUrl, isActive, createdAt, updatedAt)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    self.vendor_name,
                    self.vendor_website,
                    self.vendor_logo_url,
                    True,
                    datetime.now(),
                    datetime.now()
                ))
                vendor_id = cursor.lastrowid
                print(f"Created new vendor: {self.vendor_name} (ID: {vendor_id})")
            
            conn.commit()
            return vendor_id
            
        finally:
            conn.close()

    async def _find_or_create_master_product(self, product_data: Dict[str, Any]) -> Optional[int]:
        """Find existing master product or create new one"""
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        try:
            product_name = product_data.get('name', '')
            category = product_data.get('category', 'unknown')
            
            # Try to find existing product by name similarity
            cursor.execute("""
                SELECT productId FROM master_products 
                WHERE standardName LIKE ? AND category = ?
                LIMIT 1
            """, (f"%{product_name[:20]}%", category))
            
            existing = cursor.fetchone()
            if existing:
                return existing[0]
            
            # Create new master product
            cursor.execute("""
                INSERT INTO master_products (
                    standardName, category, brand, currentCheapestPrice, 
                    keySpecsJson, imageUrls, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                product_name,
                category,
                product_data.get('brand', ''),
                product_data.get('price', 0),
                json.dumps(product_data.get('specs', {})),
                json.dumps([product_data.get('image_url')] if product_data.get('image_url') else []),
                datetime.now(),
                datetime.now()
            ))
            
            product_id = cursor.lastrowid
            conn.commit()
            return product_id
            
        except Exception as e:
            print(f"Error finding/creating master product: {e}")
            return None
        finally:
            conn.close()

    async def _create_price_entry(self, vendor_id: int, master_product_id: int, product_data: Dict[str, Any]):
        """Create a price entry for the product"""
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO price_entries (
                    masterProductId, vendorId, scrapedPrice, 
                    availabilityStatus, productUrl, scrapedTimestamp
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                master_product_id,
                vendor_id,
                product_data.get('price', 0),
                product_data.get('availability', 'in_stock'),
                product_data.get('url', ''),
                datetime.now()
            ))
            conn.commit()
            
        except Exception as e:
            print(f"Error creating price entry: {e}")
        finally:
            conn.close()

    def _print_final_stats(self, duration):
        """Print final statistics"""
        print("\n" + "=" * 80)
        print("FINAL STATISTICS")
        print("=" * 80)
        print(f"Total Products Scraped: {self.stats['total_scraped']}")
        print(f"Products Matched/Created: {self.stats['matched_products']}")
        print(f"Failed Matches: {self.stats['failed_matches']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"Duration: {duration}")
        print("=" * 80)

async def main():
    """Main function"""
    scraper = SimpleStarTechEnhanced()
    result = await scraper.scrape_and_store()
    
    if result['success']:
        print(f"\nSUCCESS! Scraping completed.")
    else:
        print(f"\nERROR: {result['message']}")

if __name__ == "__main__":
    asyncio.run(main())
