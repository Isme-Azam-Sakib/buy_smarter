from __future__ import annotations
from typing import Dict, List, Iterable
from urllib.parse import urljoin

from .client import fetch
from .parser import parse_listing, parse_next_page_url
from .normalize import parse_price_bdt, normalize_availability, now_iso

VENDOR_NAME = "Star Tech"

CATEGORIES = {
    "power-supply": "https://www.startech.com.bd/component/power-supply",
    "casing": "https://www.startech.com.bd/component/casing",
    "ssd": "https://www.startech.com.bd/ssd",
    "ram": "https://www.startech.com.bd/component/ram",
    "processor": "https://www.startech.com.bd/component/processor",
    "cpu-cooler": "https://www.startech.com.bd/component/CPU-Cooler",
    "motherboard": "https://www.startech.com.bd/component/motherboard",
    "graphics-card": "https://www.startech.com.bd/component/graphics-card",
}


def scrape_category(category_key: str, base_url: str) -> Iterable[Dict[str, object]]:
    scraped_at = now_iso()
    url = base_url
    seen_pages = set()

    while url and url not in seen_pages:
        seen_pages.add(url)
        html = fetch(url)
        if not html:
            break
        for item in parse_listing(html):
            price_bdt, currency = parse_price_bdt(item.get("price_text"))
            availability_status = normalize_availability(item.get("availability_text"))
            
            # Clear price for out-of-stock, upcoming, or zero-price products
            # Vendors may show stale reference prices even when unavailable
            if availability_status == "out_of_stock" or availability_status == "upcoming":
                price_bdt = None
                currency = None
            elif price_bdt is not None and price_bdt == 0:
                # Price of 0 typically means unavailable
                price_bdt = None
                currency = None
                if availability_status == "unknown":
                    availability_status = "out_of_stock"
            
            yield {
                "vendor_name": VENDOR_NAME,
                "category": category_key,
                "raw_name": item.get("raw_name"),
                "price_bdt": price_bdt,
                "availability_status": availability_status,
                "product_url": item.get("product_url"),
                "image_url": item.get("image_url"),
                "currency": currency,
                "description": item.get("description"),
                "scraped_at": scraped_at,
                "created_at": scraped_at,
                "updated_at": None,
                "scrape_source": "bulk",  # Mark as bulk scrape
                "standard_name_source": "bulk",  # Bulk scrapes don't use ML
            }
        next_rel = parse_next_page_url(html, url)
        url = urljoin(url, next_rel) if next_rel else None


def scrape_all_categories() -> List[Dict[str, object]]:
    rows: List[Dict[str, object]] = []
    total_categories = len(CATEGORIES)
    for idx, (key, url) in enumerate(CATEGORIES.items(), 1):
        print(f"  [{idx}/{total_categories}] Scraping category: {key}...", flush=True)
        category_count = 0
        for row in scrape_category(key, url):
            rows.append(row)
            category_count += 1
        print(f"  [{idx}/{total_categories}] Category {key} complete: {category_count} products", flush=True)
    return rows
