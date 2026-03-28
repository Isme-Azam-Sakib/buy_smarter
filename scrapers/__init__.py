from __future__ import annotations

from importlib import import_module
from typing import Dict, Iterable, List, Tuple

from .db_sync import SyncStats, sync_rows_into_db

AVAILABLE_VENDORS: Dict[str, str] = {
    "pchouse": "PC House",
    "skyland": "Skyland Computer BD",
    "startech": "Star Tech",
    "techland": "Techland BD",
    "ultratech": "Ultratech",
}

__all__ = [
    "AVAILABLE_VENDORS",
    "list_vendors",
    "scrape_vendor",
    "sync_vendor_to_db",
    "sync_all_vendors",
]


def list_vendors() -> List[Tuple[str, str]]:
    """Return (slug, friendly name) pairs."""
    return list(AVAILABLE_VENDORS.items())


def _normalize_vendor(vendor: str) -> str:
    key = vendor.lower().strip()
    if key not in AVAILABLE_VENDORS:
        raise ValueError(f"Unknown vendor '{vendor}'. Available: {', '.join(AVAILABLE_VENDORS)}")
    return key


def scrape_vendor(vendor: str) -> Iterable[Dict[str, object]]:
    """Scrape every category for the vendor and return in-memory rows."""
    key = _normalize_vendor(vendor)
    module = import_module(f"{__name__}.{key}.scrape_{key}")
    
    # Check if scrape_all_categories returns a generator or list
    result = module.scrape_all_categories()  # type: ignore[attr-defined]
    
    # If it's a list, convert to generator with progress
    if isinstance(result, list):
        for row in result:
            yield row
    else:
        # It's already a generator/iterable
        for row in result:
            yield row


def sync_vendor_to_db(vendor: str, *, db_path: str = "final_products.db") -> SyncStats:
    """
    Scrape the requested vendor and synchronize the data with final_products.db.
    """
    key = _normalize_vendor(vendor)
    vendor_name = AVAILABLE_VENDORS[key]
    print(f"Starting scrape for {vendor_name}...", flush=True)
    
    # Scrape with progress updates
    rows = []
    row_count = 0
    for row in scrape_vendor(key):
        rows.append(row)
        row_count += 1
        if row_count % 50 == 0:
            print(f"Scraped {row_count} products so far...", flush=True)
    
    print(f"Scraping complete. Found {row_count} products. Syncing to database...", flush=True)
    result = sync_rows_into_db(vendor_name, rows, db_path=db_path)
    print(f"Sync complete: {result}", flush=True)
    return result


def sync_all_vendors(*, db_path: str = "final_products.db") -> List[SyncStats]:
    """Scrape + sync every vendor sequentially."""
    results: List[SyncStats] = []
    total_vendors = len(AVAILABLE_VENDORS)
    for idx, slug in enumerate(AVAILABLE_VENDORS, 1):
        print(f"\n[{idx}/{total_vendors}] Processing {AVAILABLE_VENDORS[slug]}...", flush=True)
        results.append(sync_vendor_to_db(slug, db_path=db_path))
    print("\nAll vendors processed.", flush=True)
    return results

