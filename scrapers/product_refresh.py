"""
Real-time product refresh: Scrape a single product from all vendors in parallel.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from typing import Dict, List, Optional, Tuple
from importlib import import_module
from urllib.parse import urljoin, urlparse

from .db_sync import sync_rows_into_db
from .utils import clean_text, extract_brand, tokenize_name, now_iso
from .tokenize_extract import extract_tokenized_name


def normalize_image_url(image_url: Optional[str], product_url: str) -> Optional[str]:
    """Convert relative image URLs to absolute URLs."""
    if not image_url:
        return None
    
    cleaned = clean_text(image_url)
    if not cleaned:
        return None
    
    # If already absolute URL, return as is
    parsed = urlparse(cleaned)
    if parsed.scheme and parsed.netloc:
        return cleaned
    
    # Convert relative URL to absolute using product_url as base
    return urljoin(product_url, cleaned)


def scrape_single_product(vendor_slug: str, product_url: str, category: str) -> Optional[Dict[str, object]]:
    """Scrape a single product from a vendor's product detail page.
    
    Returns product data dict or None if scraping failed.
    """
    try:
        # Import vendor-specific modules
        module_name = f"scrapers.{vendor_slug}.scrape_{vendor_slug}"
        parser_module = import_module(f"scrapers.{vendor_slug}.parser")
        client_module = import_module(f"scrapers.{vendor_slug}.client")
        
        # Fetch the product page
        html = client_module.fetch(product_url, timeout=10)
        if not html:
            return None
        
        # Parse the product detail page
        if not hasattr(parser_module, 'parse_product_detail'):
            return None
        
        parsed = parser_module.parse_product_detail(html, product_url)
        if not parsed:
            return None
        
        # Normalize the data - import vendor-specific normalize module
        normalize_module = import_module(f"scrapers.{vendor_slug}.normalize")
        price_bdt, currency = normalize_module.parse_price_bdt(parsed.get("price_text"))
        availability_text_raw = parsed.get("availability_text", "")
        availability_status = normalize_module.normalize_availability(availability_text_raw)
        
        # Check raw availability text for out-of-stock indicators (before normalization)
        # Some vendors might not normalize correctly, so check the raw text too
        availability_text_lower = (availability_text_raw or "").lower()
        is_out_of_stock_raw = any(phrase in availability_text_lower for phrase in [
            "out of stock", "stock out", "sold out", "out-of-stock", 
            "out of stock", "not available", "unavailable"
        ])
        is_upcoming_raw = any(phrase in availability_text_lower for phrase in [
            "up coming", "upcoming", "coming soon"
        ])
        
        # Clear price for out-of-stock, upcoming, or zero-price products
        # Vendors may show stale reference prices even when unavailable
        if (availability_status == "out_of_stock" or is_out_of_stock_raw or 
            availability_status == "upcoming" or is_upcoming_raw):
            if price_bdt is not None:
                print(f"[{availability_status or 'out_of_stock'}] Clearing price for {vendor_slug}: was {price_bdt} BDT, now None (raw text: '{availability_text_raw}')", flush=True)
            price_bdt = None
            currency = None
            # Ensure status is set correctly
            if is_out_of_stock_raw:
                availability_status = "out_of_stock"
            elif is_upcoming_raw:
                availability_status = "upcoming"
        elif price_bdt is not None and price_bdt == 0:
            # Price of 0 typically means unavailable
            if availability_status == "unknown":
                availability_status = "out_of_stock"
            print(f"[Zero Price] Clearing price for {vendor_slug}: was 0 BDT, now None", flush=True)
            price_bdt = None
            currency = None
        
        # Get vendor name
        scrape_module = import_module(module_name)
        vendor_name = getattr(scrape_module, 'VENDOR_NAME', vendor_slug)
        
        scraped_at = now_iso()
        raw_name = clean_text(parsed.get("raw_name"))
        
        if not raw_name:
            return None
        
        # Priority 1: Use ML to predict standard_name for page visit scraping
        # This is ONLY called from page visit scraping, so it's safe to use ML here
        standard_name = raw_name  # Default fallback
        standard_name_source = "page_visit"  # Default if ML fails
        ml_confidence = None
        
        try:
            # Import ML matcher
            import sys
            import os
            # Add lib/ai to path
            script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            category_models_dir = os.path.join(script_dir, 'lib', 'ai', 'category_models')
            if os.path.exists(category_models_dir):
                sys.path.insert(0, category_models_dir)
                from category_matcher import CategoryProductMatcher
                
                # Initialize matcher (will be reused if called multiple times)
                # Use load_all=False to only load the category model we need
                if not hasattr(scrape_single_product, '_matcher'):
                    matcher = CategoryProductMatcher(
                        model_dir=category_models_dir,
                        db_path=os.path.join(script_dir, 'final_products.db'),
                        load_all=False  # Lazy-load only the category we need
                    )
                    scrape_single_product._matcher = matcher
                else:
                    matcher = scrape_single_product._matcher
                
                # Predict standard_name with high confidence threshold (0.7 for safety)
                ml_result = matcher.predict_match(
                    product_name=raw_name,
                    category=category,
                    confidence_threshold=0.7
                )
                
                if ml_result.get('is_match') and ml_result.get('standard_name'):
                    standard_name = ml_result['standard_name']
                    ml_confidence = ml_result.get('confidence', 0.0)
                    standard_name_source = "ml_page_visit"
                    print(f"[ML] Standard name updated: '{raw_name}' -> '{standard_name}' (confidence: {ml_confidence:.2f})", flush=True)
                else:
                    # ML didn't find a match, use raw_name
                    standard_name_source = "page_visit"
        except Exception as e:
            # Fail silently - use raw_name as fallback
            standard_name_source = "page_visit"
            ml_confidence = None
            # Only log if it's not an import error (models might not exist yet)
            if "No module named" not in str(e) and "not found" not in str(e).lower():
                print(f"[ML] Error predicting standard_name: {e}", flush=True)
        
        # Tokenized name is the same as standard_name, just split into words
        tokenized_name = extract_tokenized_name(standard_name, category)
        brand = extract_brand(raw_name)
        
        # Normalize image URL to absolute URL
        raw_image_url = parsed.get("image_url")
        normalized_image_url = None
        if raw_image_url:
            normalized_image_url = normalize_image_url(raw_image_url, product_url)
        
        return {
            "vendor_name": vendor_name,
            "category": category,
            "raw_name": raw_name,
            "price_bdt": price_bdt,
            "availability_status": availability_status,
            "product_url": product_url,
            "image_url": normalized_image_url,
            "currency": currency,
            "description": parsed.get("description"),
            "scraped_at": scraped_at,
            "created_at": scraped_at,
            "updated_at": None,
            "standard_name": standard_name,
            "brand": brand,
            "tokenized_name": tokenized_name,
            "scrape_source": "page_visit",  # NEW: Mark as page visit scrape
            "standard_name_source": standard_name_source,  # NEW: Track how standard_name was determined
            "ml_confidence": ml_confidence,  # NEW: ML confidence score if used
        }
    except Exception as e:
        print(f"Error scraping {vendor_slug}: {e}", flush=True)
        return None


def refresh_product_from_all_vendors(
    product_urls: Dict[str, str],  # {vendor_slug: product_url}
    category: str,
    db_path: str = "final_products.db",
    timeout: int = 10,
    database_url: Optional[str] = None,
) -> List[Dict[str, object]]:
    """Scrape a single product from multiple vendors in parallel.
    
    Args:
        product_urls: Dict mapping vendor slugs to their product URLs
        category: Product category
        db_path: Path to database (for SQLite)
        timeout: Timeout per vendor in seconds
        database_url: PostgreSQL connection URL (if using PostgreSQL)
    
    Returns:
        List of successfully scraped product data dicts
    """
    results: List[Dict[str, object]] = []
    
    def scrape_with_timeout(vendor_slug: str, url: str) -> Optional[Dict[str, object]]:
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(scrape_single_product, vendor_slug, url, category)
                return future.result(timeout=timeout)
        except FutureTimeoutError:
            print(f"Timeout scraping {vendor_slug}", flush=True)
            return None
        except Exception as e:
            print(f"Error scraping {vendor_slug}: {e}", flush=True)
            return None
    
    # Scrape all vendors in parallel
    with ThreadPoolExecutor(max_workers=len(product_urls)) as executor:
        futures = {
            executor.submit(scrape_with_timeout, vendor_slug, url): vendor_slug
            for vendor_slug, url in product_urls.items()
        }
        
        for future in futures:
            result = future.result()
            if result:
                results.append(result)
    
    # Sync results to database
    if results:
        for result in results:
            vendor_name = result["vendor_name"]
            rows = [result]
            sync_rows_into_db(vendor_name, rows, db_path=db_path, database_url=database_url)
    
    return results

