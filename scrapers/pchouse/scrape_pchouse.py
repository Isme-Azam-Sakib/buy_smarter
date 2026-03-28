from __future__ import annotations
from typing import Dict, List, Iterable
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

from .client import fetch
from .parser import parse_listing, parse_next_page_url
from .normalize import parse_price_bdt, normalize_availability, now_iso

VENDOR_NAME = "PC House"

CATEGORIES = {
    "motherboard": "https://www.pchouse.com.bd/motherboard",
    "processor": "https://www.pchouse.com.bd/processor",
    "graphics-card": "https://www.pchouse.com.bd/graphics-card",
    "power-supply": "https://www.pchouse.com.bd/power-supply",
    "desktop-ram": "https://www.pchouse.com.bd/desktop-ram",
    "internal-ssd": "https://www.pchouse.com.bd/internal-ssd",
    "cpu-cooler": "https://www.pchouse.com.bd/cpu-cooler",
    "casing": "https://www.pchouse.com.bd/casing",
}


def _with_page(url: str, page: int) -> str:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    qs["page"] = [str(page)]
    new_query = urlencode(qs, doseq=True)
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))


def scrape_category(category_key: str, base_url: str) -> Iterable[Dict[str, object]]:
    scraped_at = now_iso()
    url = base_url
    seen_pages = set()
    page_num = 1

    while url and url not in seen_pages:
        seen_pages.add(url)
        html = fetch(url)
        if not html:
            break
        items = list(parse_listing(html))
        if not items and page_num > 1:
            break
        for item in items:
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
        if next_rel:
            url = urljoin(url, next_rel)
            page_num += 1
            continue
        page_num += 1
        url = _with_page(base_url, page_num)


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
