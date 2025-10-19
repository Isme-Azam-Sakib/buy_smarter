#!/usr/bin/env python3
"""
Star Tech Enhanced Scraper with Product Reconciliation
Uses two-tier matching: RapidFuzz + Gemini Pro AI
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from scrapers.startech_scraper import StarTechScraper
from database import SessionLocal, engine, Base
from models import MasterProduct, Vendor, PriceEntry, CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs
from services.product_reconciliation import ProductReconciliationService
from services.ai_service import AIService

class StarTechEnhanced:
    """Enhanced Star Tech scraper with product reconciliation"""
    
    def __init__(self):
        self.scraper = StarTechScraper()
        self.vendor_name = "Star Tech"
        self.vendor_website = "https://www.startech.com.bd"
        self.vendor_logo_url = "https://www.startech.com.bd/image/catalog/logo.png"
        self.db = SessionLocal()
        
        # Initialize AI service
        self.ai_service = AIService()
        
        # Initialize reconciliation service
        self.reconciliation_service = ProductReconciliationService(self.db, self.ai_service)
        
        # Statistics tracking
        self.stats = {
            'total_scraped': 0,
            'level1_matches': 0,
            'level2_matches': 0,
            'new_products_created': 0,
            'failed_matches': 0,
            'errors': 0
        }

    async def scrape_and_store(self) -> Dict[str, Any]:
        """Scrape products and store with reconciliation"""
        print("=" * 80)
        print("STAR TECH ENHANCED SCRAPER WITH RECONCILIATION")
        print("=" * 80)
        
        start_time = datetime.now()
        
        try:
            # Step 1: Scrape products
            print("Step 1: Scraping products from Star Tech...")
            scraped_products = await self.scraper.scrape_all_products()
            print(f"Scraped {len(scraped_products)} products")
            
            if not scraped_products:
                return {"success": False, "message": "No products scraped"}
            
            self.stats['total_scraped'] = len(scraped_products)
            
            # Step 2: Set up vendor
            print("\nStep 2: Setting up Star Tech vendor...")
            vendor = await self._get_or_create_vendor()
            
            # Step 3: Process each product with reconciliation
            print("\nStep 3: Processing products with reconciliation...")
            processed_count = 0
            
            for i, product_data in enumerate(scraped_products, 1):
                try:
                    print(f"\nProcessing product {i}/{len(scraped_products)}: {product_data.get('name', 'Unknown')}")
                    
                    # Try to reconcile with master catalog
                    match_result = self.reconciliation_service.reconcile_product(product_data)
                    
                    if match_result:
                        # Product matched - create price entry only
                        await self._create_price_entry(vendor.vendor_id, match_result['master_product_id'], product_data)
                        
                        if match_result['method'] == 'fuzzy_match':
                            self.stats['level1_matches'] += 1
                        elif match_result['method'] == 'ai_match':
                            self.stats['level2_matches'] += 1
                        else:
                            self.stats['level1_matches'] += 1  # Fallback methods
                        
                        print(f"  ✓ Matched: {match_result['matched_name']} ({match_result['confidence']:.1f}%)")
                        
                    else:
                        # No match found - create new master product with AI validation
                        print(f"  ⚠ No match found, creating new product...")
                        
                        # Use AI to validate and enrich the product data
                        enriched_data = self.ai_service.validate_and_enrich_product(product_data)
                        
                        if enriched_data and enriched_data.get('is_valid', False):
                            master_product = await self._create_master_product(enriched_data)
                            if master_product:
                                await self._create_price_entry(vendor.vendor_id, master_product.product_id, product_data)
                                await self._create_specs(master_product, enriched_data)
                                self.stats['new_products_created'] += 1
                                print(f"  ✓ Created new product: {enriched_data['standard_name']}")
                            else:
                                self.stats['errors'] += 1
                                print(f"  ✗ Failed to create master product")
                        else:
                            self.stats['failed_matches'] += 1
                            print(f"  ✗ AI validation failed or product invalid")
                    
                    processed_count += 1
                    
                    # Commit every 10 products
                    if processed_count % 10 == 0:
                        self.db.commit()
                        print(f"  Committed {processed_count} products...")
                
                except Exception as e:
                    self.stats['errors'] += 1
                    print(f"  ✗ Error processing product: {e}")
                    continue
            
            # Final commit
            self.db.commit()
            
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
            self.db.rollback()
            print(f"Error in scrape_and_store: {e}")
            return {"success": False, "message": str(e)}
        finally:
            self.db.close()

    async def _get_or_create_vendor(self) -> Vendor:
        """Get or create the Star Tech vendor"""
        vendor = self.db.query(Vendor).filter(Vendor.name == self.vendor_name).first()
        
        if not vendor:
            vendor = Vendor(
                name=self.vendor_name,
                website=self.vendor_website,
                logo_url=self.vendor_logo_url,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            self.db.add(vendor)
            self.db.commit()
            self.db.refresh(vendor)
            print(f"Created new vendor: {vendor.name}")
        else:
            print(f"Using existing vendor: {vendor.name}")
        
        return vendor

    async def _create_price_entry(self, vendor_id: int, master_product_id: int, product_data: Dict[str, Any]):
        """Create a price entry for the product"""
        price_entry = PriceEntry(
            master_product_id=master_product_id,
            vendor_id=vendor_id,
            scraped_price=product_data.get('price', 0),
            availability_status=product_data.get('availability', 'in_stock'),
            product_url=product_data.get('url', ''),
            scraped_timestamp=datetime.now()
        )
        self.db.add(price_entry)

    async def _create_master_product(self, enriched_data: Dict[str, Any]) -> Optional[MasterProduct]:
        """Create a new master product from enriched data"""
        try:
            # Ensure imageUrls is a list
            image_urls = enriched_data.get('image_urls', [])
            if isinstance(image_urls, str):
                image_urls = [image_urls]
            
            master_product = MasterProduct(
                standard_name=enriched_data['standard_name'],
                category=enriched_data['category'],
                brand=enriched_data['brand'],
                current_cheapest_price=enriched_data.get('price', 0),
                key_specs_json=json.dumps(enriched_data.get('key_specs', {})),
                image_urls=json.dumps(image_urls),
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
            self.db.add(master_product)
            self.db.flush()  # Get the product_id
            return master_product
            
        except Exception as e:
            print(f"Error creating master product: {e}")
            return None

    async def _create_specs(self, master_product: MasterProduct, enriched_data: Dict[str, Any]):
        """Create category-specific specs"""
        try:
            category = master_product.category.lower()
            key_specs = enriched_data.get('key_specs', {})
            
            if category == 'cpu':
                specs = CpuSpecs(
                    master_product_id=master_product.product_id,
                    cores=key_specs.get('cores'),
                    base_clock=key_specs.get('base_clock'),
                    boost_clock=key_specs.get('boost_clock'),
                    tdp=key_specs.get('tdp'),
                    microarchitecture=key_specs.get('microarchitecture'),
                    graphics=key_specs.get('graphics')
                )
                self.db.add(specs)
                
            elif category == 'gpu':
                specs = GpuSpecs(
                    master_product_id=master_product.product_id,
                    chipset=key_specs.get('chipset'),
                    memory=key_specs.get('memory'),
                    core_clock=key_specs.get('core_clock'),
                    boost_clock=key_specs.get('boost_clock'),
                    color=key_specs.get('color'),
                    length=key_specs.get('length')
                )
                self.db.add(specs)
                
            elif category == 'ram':
                specs = RamSpecs(
                    master_product_id=master_product.product_id,
                    capacity=key_specs.get('capacity'),
                    speed=key_specs.get('speed'),
                    type=key_specs.get('type'),
                    cas_latency=key_specs.get('cas_latency'),
                    voltage=key_specs.get('voltage'),
                    first_word_latency=key_specs.get('first_word_latency')
                )
                self.db.add(specs)
                
            # Add other categories as needed...
            
        except Exception as e:
            print(f"Error creating specs: {e}")

    def _print_final_stats(self, duration):
        """Print final statistics"""
        print("\n" + "=" * 80)
        print("FINAL STATISTICS")
        print("=" * 80)
        print(f"Total Products Scraped: {self.stats['total_scraped']}")
        print(f"Level 1 Matches (RapidFuzz): {self.stats['level1_matches']}")
        print(f"Level 2 Matches (AI): {self.stats['level2_matches']}")
        print(f"New Products Created: {self.stats['new_products_created']}")
        print(f"Failed Matches: {self.stats['failed_matches']}")
        print(f"Errors: {self.stats['errors']}")
        print(f"Duration: {duration}")
        
        # Calculate percentages
        total_processed = self.stats['level1_matches'] + self.stats['level2_matches'] + self.stats['new_products_created']
        if total_processed > 0:
            print(f"\nMatch Rates:")
            print(f"  Level 1 (Fuzzy): {(self.stats['level1_matches'] / total_processed * 100):.1f}%")
            print(f"  Level 2 (AI): {(self.stats['level2_matches'] / total_processed * 100):.1f}%")
            print(f"  New Products: {(self.stats['new_products_created'] / total_processed * 100):.1f}%")
        print("=" * 80)

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics from database"""
        try:
            db = SessionLocal()
            
            # Get vendor
            vendor = db.query(Vendor).filter(Vendor.name == self.vendor_name).first()
            if not vendor:
                return {"error": "Star Tech vendor not found"}
            
            # Get counts
            total_products = db.query(MasterProduct).join(PriceEntry).filter(
                PriceEntry.vendor_id == vendor.vendor_id
            ).distinct().count()
            
            total_prices = db.query(PriceEntry).filter(
                PriceEntry.vendor_id == vendor.vendor_id
            ).count()
            
            # Get category breakdown
            category_counts = db.query(MasterProduct.category, db.func.count(MasterProduct.product_id)).join(
                PriceEntry
            ).filter(PriceEntry.vendor_id == vendor.vendor_id).group_by(
                MasterProduct.category
            ).all()
            
            db.close()
            
            return {
                "vendor": self.vendor_name,
                "total_products": total_products,
                "total_prices": total_prices,
                "categories": [{"category": cat, "count": count} for cat, count in category_counts]
            }
            
        except Exception as e:
            return {"error": str(e)}

# CLI Interface
async def main():
    """Command line interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Star Tech Enhanced Scraper with Reconciliation')
    parser.add_argument('action', choices=['scrape', 'stats'], 
                       help='Action to perform')
    
    args = parser.parse_args()
    
    scraper = StarTechEnhanced()
    
    if args.action == 'scrape':
        result = await scraper.scrape_and_store()
        if result['success']:
            print(f"\nSUCCESS! Scraping completed with reconciliation.")
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
