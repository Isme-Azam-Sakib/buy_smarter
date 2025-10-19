"""
Enhanced scraper service with product reconciliation
"""

import asyncio
import uuid
from typing import Dict, Any, List
from celery import Celery
import os
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from database import SessionLocal
from services.product_reconciliation import ProductReconciliationService
from models import MasterProduct, PriceEntry, Vendor
from scrapers.techland_scraper import TechLandScraper
from scrapers.skyland_scraper import SkylandScraper

load_dotenv()

# Initialize Celery
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
celery_app = Celery("enhanced_scraper", broker=redis_url, backend=redis_url)

class EnhancedScraperService:
    """Enhanced scraper service with product reconciliation"""
    
    def __init__(self):
        self.active_tasks = {}
        self.db = SessionLocal()
        self.reconciliation_service = ProductReconciliationService(self.db)
        
        # Initialize scrapers
        self.scrapers = {
            'techlandbd': TechLandScraper(),
            'skyland': SkylandScraper(),
            # Add more scrapers as needed
        }
    
    async def start_enhanced_scraping(self) -> str:
        """Start enhanced scraping with product reconciliation"""
        task_id = str(uuid.uuid4())
        
        # Start Celery task
        task = celery_app.send_task(
            "enhanced_scrape_all_vendors",
            args=[task_id],
            task_id=task_id
        )
        
        self.active_tasks[task_id] = {
            "status": "started",
            "progress": 0,
            "message": "Enhanced scraping started with product reconciliation"
        }
        
        return task_id
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get scraping task status"""
        if task_id in self.active_tasks:
            return self.active_tasks[task_id]
        
        # Check Celery task status
        task = celery_app.AsyncResult(task_id)
        
        if task.state == "PENDING":
            return {"status": "pending", "progress": 0, "message": "Task pending"}
        elif task.state == "PROGRESS":
            return {
                "status": "running",
                "progress": task.info.get("progress", 0),
                "message": task.info.get("message", "Scraping in progress")
            }
        elif task.state == "SUCCESS":
            return {
                "status": "completed",
                "progress": 100,
                "message": "Enhanced scraping completed successfully",
                "result": task.result
            }
        elif task.state == "FAILURE":
            return {
                "status": "failed",
                "progress": 0,
                "message": str(task.info)
            }
        else:
            return {"status": "unknown", "progress": 0, "message": "Unknown status"}
    
    async def scrape_and_reconcile_vendor(self, vendor_name: str) -> Dict[str, Any]:
        """Scrape a vendor and reconcile products with master catalog"""
        print(f"Starting enhanced scraping for {vendor_name}...")
        
        if vendor_name not in self.scrapers:
            raise ValueError(f"Scraper for {vendor_name} not found")
        
        scraper = self.scrapers[vendor_name]
        
        # Scrape products
        scraped_products = await scraper.scrape_all_products()
        
        # Reconcile with master catalog
        reconciled_count = 0
        new_products_count = 0
        price_entries_created = 0
        
        for scraped_product in scraped_products:
            try:
                # Try to reconcile with master catalog
                reconciliation_result = self.reconciliation_service.reconcile_product(scraped_product)
                
                if reconciliation_result:
                    # Product found in master catalog
                    master_product_id = reconciliation_result['master_product_id']
                    confidence = reconciliation_result['confidence']
                    
                    print(f"Matched: {scraped_product['name']} -> Master ID: {master_product_id} (Confidence: {confidence:.1f}%)")
                    
                    # Create price entry
                    await self._create_price_entry(master_product_id, scraped_product, vendor_name)
                    price_entries_created += 1
                    reconciled_count += 1
                    
                else:
                    # Product not found in master catalog
                    print(f"New product found: {scraped_product['name']} - needs manual review")
                    new_products_count += 1
                    
            except Exception as e:
                print(f"Error processing {scraped_product.get('name', 'Unknown')}: {e}")
                continue
        
        return {
            'vendor': vendor_name,
            'scraped_products': len(scraped_products),
            'reconciled_products': reconciled_count,
            'new_products': new_products_count,
            'price_entries_created': price_entries_created
        }
    
    async def _create_price_entry(self, master_product_id: int, scraped_product: Dict[str, Any], vendor_name: str):
        """Create a price entry for a reconciled product"""
        try:
            # Get or create vendor
            vendor = self.db.query(Vendor).filter(Vendor.name == vendor_name).first()
            if not vendor:
                vendor = Vendor(
                    name=vendor_name,
                    website=scraped_product.get('url', ''),
                    is_active=True
                )
                self.db.add(vendor)
                self.db.flush()
            
            # Create price entry
            price_entry = PriceEntry(
                master_product_id=master_product_id,
                vendor_id=vendor.vendor_id,
                scraped_price=scraped_product.get('price', 0),
                availability_status=scraped_product.get('availability', 'in_stock'),
                product_url=scraped_product.get('url', '')
            )
            
            self.db.add(price_entry)
            self.db.commit()
            
        except Exception as e:
            print(f"Error creating price entry: {e}")
            self.db.rollback()
    
    def close(self):
        """Close database connection"""
        self.db.close()

# Celery tasks
@celery_app.task(bind=True)
def enhanced_scrape_all_vendors(self, task_id: str):
    """Enhanced scrape all vendors with product reconciliation"""
    try:
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"progress": 0, "message": "Starting enhanced scraping with product reconciliation"}
        )
        
        # Initialize service
        service = EnhancedScraperService()
        
        vendors = ['techlandbd', 'skyland']
        total_vendors = len(vendors)
        results = []
        
        for i, vendor in enumerate(vendors):
            try:
                # Update progress
                progress = int((i / total_vendors) * 100)
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "progress": progress,
                        "message": f"Scraping and reconciling {vendor}..."
                    }
                )
                
                # Scrape and reconcile vendor
                result = asyncio.run(service.scrape_and_reconcile_vendor(vendor))
                results.append(result)
                
            except Exception as e:
                print(f"Error scraping {vendor}: {e}")
                results.append({
                    'vendor': vendor,
                    'error': str(e),
                    'scraped_products': 0,
                    'reconciled_products': 0,
                    'new_products': 0,
                    'price_entries_created': 0
                })
                continue
        
        # Final update
        total_scraped = sum(r.get('scraped_products', 0) for r in results)
        total_reconciled = sum(r.get('reconciled_products', 0) for r in results)
        total_price_entries = sum(r.get('price_entries_created', 0) for r in results)
        
        self.update_state(
            state="SUCCESS",
            meta={
                "progress": 100,
                "message": f"Enhanced scraping completed. Scraped: {total_scraped}, Reconciled: {total_reconciled}, Price entries: {total_price_entries}",
                "results": results,
                "total_scraped": total_scraped,
                "total_reconciled": total_reconciled,
                "total_price_entries": total_price_entries
            }
        )
        
        service.close()
        return {
            "results": results,
            "total_scraped": total_scraped,
            "total_reconciled": total_reconciled,
            "total_price_entries": total_price_entries
        }
        
    except Exception as e:
        self.update_state(
            state="FAILURE",
            meta={"progress": 0, "message": str(e)}
        )
        raise e

# Example usage
async def test_enhanced_scraping():
    """Test the enhanced scraping service"""
    service = EnhancedScraperService()
    
    try:
        # Test scraping one vendor
        result = await service.scrape_and_reconcile_vendor('techlandbd')
        print(f"Test result: {result}")
        
    except Exception as e:
        print(f"Test error: {e}")
    
    finally:
        service.close()

if __name__ == "__main__":
    asyncio.run(test_enhanced_scraping())
