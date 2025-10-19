#!/usr/bin/env python3
"""
Enhanced Techland Scraper with Product Reconciliation
Integrates with the reconciliation system for multi-vendor price comparison
"""

import asyncio
import json
import sqlite3
import sys
import os
from datetime import datetime
from typing import Dict, Any, List

# Set environment variable for Gemini API key
os.environ['GEMINI_API_KEY'] = 'AIzaSyCf5CWqC77F6BTTa0xkwlKlEYp4JJSP_pc'

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from scrapers.techland_scraper import TechLandScraper
from services.product_reconciliation import ProductReconciliationService
from services.ai_service import AIService

class TechlandEnhanced:
    """Enhanced Techland scraper with reconciliation integration"""
    
    def __init__(self):
        self.vendor_name = "TechLand"
        self.vendor_website = "https://www.techlandbd.com"
        self.vendor_logo_url = "https://www.techlandbd.com/favicon.ico"
        
        # Statistics tracking
        self.stats = {
            'total_scraped': 0,
            'matched_products': 0,
            'new_products': 0,
            'failed_matches': 0,
            'errors': 0
        }
        
        # Database configuration
        self.database_path = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')
        
        # Initialize services
        self.scraper = TechLandScraper()
        self.reconciliation_service = None
        self.ai_service = None
        
    def setup_services(self):
        """Initialize reconciliation and AI services"""
        try:
            # For now, we'll use a simplified approach without reconciliation
            # This will create new products for all Techland items
            self.reconciliation_service = None
            
            # Initialize AI service (it reads API key from environment)
            self.ai_service = AIService()
            
            print("[OK] Services initialized successfully")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to initialize services: {e}")
            return False
    
    def setup_vendor(self) -> int:
        """Setup or get TechLand vendor in database"""
        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()
        
        try:
            # Check if vendor exists
            cursor.execute("SELECT vendorId FROM vendors WHERE name = ?", (self.vendor_name,))
            result = cursor.fetchone()
            
            if result:
                vendor_id = result[0]
                print(f"Found existing vendor: {self.vendor_name} (ID: {vendor_id})")
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
            
        except Exception as e:
            print(f"[ERROR] Failed to setup vendor: {e}")
            conn.rollback()
            return None
        finally:
            conn.close()
    
    async def scrape_and_store(self) -> bool:
        """Main method to scrape TechLand and store with reconciliation"""
        print("=" * 80)
        print("ENHANCED TECHLAND SCRAPER WITH RECONCILIATION")
        print("=" * 80)
        
        # Setup services
        if not self.setup_services():
            return False
        
        # Setup vendor
        vendor_id = self.setup_vendor()
        if not vendor_id:
            return False
        
        try:
            # Step 1: Scrape products
            print("\nStep 1: Scraping products from TechLand...")
            scraped_products = await self.scraper.scrape_all_products()
            self.stats['total_scraped'] = len(scraped_products)
            print(f"Scraped {len(scraped_products)} products")
            
            if not scraped_products:
                print("[WARNING] No products scraped")
                return False
            
            # Step 2: Process products with reconciliation
            print(f"\nStep 2: Processing products with reconciliation...")
            await self.process_products(scraped_products, vendor_id)
            
            # Step 3: Print final statistics
            self.print_final_stats()
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Scraping failed: {e}")
            self.stats['errors'] += 1
            return False
    
    async def process_products(self, products: List[Dict[str, Any]], vendor_id: int):
        """Process scraped products with reconciliation"""
        conn = sqlite3.connect(self.database_path)
        cursor = conn.cursor()
        
        try:
            for i, product_data in enumerate(products, 1):
                try:
                    print(f"\nProcessing product {i}/{len(products)}: {product_data['name']}")
                    
                    # Try to reconcile with existing products
                    matched_product_id = await self.reconcile_product(product_data)
                    
                    if matched_product_id:
                        # Product matched - create price entry only
                        self.create_price_entry(cursor, matched_product_id, vendor_id, product_data)
                        self.stats['matched_products'] += 1
                        print(f"  [MATCHED] Linked to existing product ID: {matched_product_id}")
                    else:
                        # Product not matched - create new product with AI validation
                        new_product_id = await self.create_new_product(cursor, product_data)
                        if new_product_id:
                            self.create_price_entry(cursor, new_product_id, vendor_id, product_data)
                            self.stats['new_products'] += 1
                            print(f"  [NEW] Created new product ID: {new_product_id}")
                        else:
                            self.stats['failed_matches'] += 1
                            print(f"  [FAILED] Could not process product")
                    
                    # Commit every 10 products
                    if i % 10 == 0:
                        conn.commit()
                        print(f"  Committed {i} products...")
                        
                except Exception as e:
                    print(f"  [ERROR] Failed to process product: {e}")
                    self.stats['errors'] += 1
                    continue
            
            # Final commit
            conn.commit()
            print(f"\n[SUCCESS] Processed {len(products)} products")
            
        except Exception as e:
            print(f"[ERROR] Processing failed: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    async def reconcile_product(self, product_data: Dict[str, Any]) -> int:
        """Try to reconcile product with existing master products"""
        # For now, skip reconciliation and create new products
        # This ensures we get Techland products in the database
        return None
    
    async def create_new_product(self, cursor, product_data: Dict[str, Any]) -> int:
        """Create new product without AI validation for now"""
        try:
            # Create master product directly from scraped data
            cursor.execute("""
                INSERT INTO master_products (
                    standardName, category, brand, currentCheapestPrice, 
                    keySpecsJson, imageUrls, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                product_data['name'],
                product_data['category'],
                product_data.get('brand', 'Unknown'),
                product_data.get('price', 0),
                json.dumps(product_data.get('specs', {})),
                json.dumps([product_data.get('image_url')] if product_data.get('image_url') else []),
                datetime.now(),
                datetime.now()
            ))
            
            return cursor.lastrowid
            
        except Exception as e:
            print(f"    [ERROR] Failed to create new product: {e}")
            return None
    
    def create_price_entry(self, cursor, product_id: int, vendor_id: int, product_data: Dict[str, Any]):
        """Create price entry for product"""
        try:
            cursor.execute("""
                INSERT INTO price_entries (
                    masterProductId, vendorId, scrapedPrice, availabilityStatus, 
                    productUrl, scrapedTimestamp
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                product_id,
                vendor_id,
                product_data.get('price', 0),
                product_data.get('availability', 'in_stock'),
                product_data.get('url', ''),
                datetime.now()
            ))
        except Exception as e:
            print(f"    [ERROR] Failed to create price entry: {e}")
            raise
    
    def print_final_stats(self):
        """Print final statistics"""
        print("\n" + "=" * 80)
        print("FINAL STATISTICS")
        print("=" * 80)
        print(f"Total Products Scraped: {self.stats['total_scraped']}")
        print(f"Products Matched: {self.stats['matched_products']}")
        print(f"New Products Created: {self.stats['new_products']}")
        print(f"Failed Matches: {self.stats['failed_matches']}")
        print(f"Errors: {self.stats['errors']}")
        print("=" * 80)

async def main():
    """Main execution function"""
    scraper = TechlandEnhanced()
    success = await scraper.scrape_and_store()
    
    if success:
        print("\n[SUCCESS] TechLand scraping completed successfully!")
    else:
        print("\n[FAILED] TechLand scraping failed!")

if __name__ == "__main__":
    asyncio.run(main())
