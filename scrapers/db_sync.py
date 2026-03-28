from __future__ import annotations

import os
import sqlite3
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .utils import (
    clean_text,
    extract_brand,
    normalize_key,
    normalize_url,
    now_iso,
    tokenize_name,
)
from .tokenize_extract import extract_tokenized_name, standardize_name

# Try to import psycopg2 for PostgreSQL support
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


@dataclass
class SyncEvent:
    action: str  # "insert" | "update" | "skip"
    raw_name: str
    category: str
    product_url: Optional[str]
    price_bdt: Optional[float]
    availability_status: str
    price_changed: Optional[bool] = None
    availability_changed: Optional[bool] = None
    skip_reason: Optional[str] = None  # Reason why product was skipped

    def to_dict(self) -> Dict[str, Any]:
        return {
            "action": self.action,
            "raw_name": self.raw_name,
            "category": self.category,
            "product_url": self.product_url,
            "price_bdt": self.price_bdt,
            "availability_status": self.availability_status,
            "price_changed": self.price_changed,
            "availability_changed": self.availability_changed,
            "skip_reason": self.skip_reason,
        }


@dataclass
class SyncStats:
    vendor_name: str
    total_scraped: int = 0
    updated: int = 0
    inserted: int = 0
    skipped: int = 0
    events: List[SyncEvent] = field(default_factory=list)

    def __str__(self) -> str:
        return (
            f"{self.vendor_name}: scraped={self.total_scraped}, "
            f"updated={self.updated}, inserted={self.inserted}, skipped={self.skipped}"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "vendor_name": self.vendor_name,
            "total_scraped": self.total_scraped,
            "updated": self.updated,
            "inserted": self.inserted,
            "skipped": self.skipped,
            "events": [event.to_dict() for event in self.events],
        }


class ProductSynchronizer:
    """
    Synchronize scraped rows with the all_products table.
    Matching priority: product_url (per vendor) -> (category, raw_name).
    Supports both SQLite and PostgreSQL.
    """

    def __init__(self, db_path: str = "final_products.db", database_url: Optional[str] = None) -> None:
        # Force SQLite usage - PostgreSQL support removed
        self.is_postgres = False
        self.db_path = db_path
        
        # Always use SQLite
        self.conn = sqlite3.connect(db_path, timeout=30.0)
        self.conn.row_factory = sqlite3.Row
        # Enable WAL mode for better concurrent access
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA busy_timeout=30000")  # 30 second timeout

    def close(self) -> None:
        if self.conn:
            self.conn.close()
    
    def cleanup_null_ids(self) -> Dict[str, int]:
        """
        Remove products with NULL IDs from the database.
        These products were likely inserted incorrectly and need to be re-scraped.
        Returns the count of deleted products.
        """
        try:
            # First count how many products have NULL IDs
            cursor = self._execute("SELECT COUNT(*) as count FROM all_products WHERE id IS NULL")
            result = self._fetchone(cursor)
            null_count = result["count"] if result else 0
            
            if null_count > 0:
                print(f"[Cleanup] Found {null_count} products with NULL IDs, deleting...", flush=True)
                self._execute("DELETE FROM all_products WHERE id IS NULL")
                self.conn.commit()
                print(f"[Cleanup] Deleted {null_count} products with NULL IDs", flush=True)
            else:
                print("[Cleanup] No products with NULL IDs found", flush=True)
            
            return {"deleted": null_count}
        except Exception as e:
            print(f"[Cleanup] Error cleaning up NULL IDs: {e}", flush=True)
            return {"deleted": 0, "error": str(e)}

    def _execute(self, sql: str, params: Tuple = ()) -> Any:
        """Execute SQL query with proper parameter placeholders for SQLite/PostgreSQL."""
        if self.is_postgres:
            # Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
            # Replace in reverse order to avoid replacing already-replaced placeholders
            param_count = len(params)
            converted_sql = sql
            for i in range(param_count, 0, -1):
                # Replace last occurrence of ? with $i
                last_index = converted_sql.rfind("?")
                if last_index != -1:
                    converted_sql = converted_sql[:last_index] + f"${i}" + converted_sql[last_index + 1:]
            cursor = self.conn.cursor()
            cursor.execute(converted_sql, params)
            return cursor
        else:
            return self.conn.execute(sql, params)

    def _fetchall(self, cursor: Any) -> List[Any]:
        """Fetch all results from cursor."""
        if self.is_postgres:
            return cursor.fetchall()
        else:
            return cursor.fetchall()

    def _fetchone(self, cursor: Any) -> Optional[Any]:
        """Fetch one result from cursor."""
        if self.is_postgres:
            return cursor.fetchone()
        else:
            return cursor.fetchone()

    def _get_lastrowid(self, cursor: Any) -> Optional[int]:
        """Get last inserted row ID. For PostgreSQL, must use RETURNING id in INSERT."""
        if self.is_postgres:
            # For PostgreSQL, we use RETURNING id in INSERT statements
            result = cursor.fetchone()
            return result["id"] if result else None
        else:
            return cursor.lastrowid

    def sync_vendor_rows(
        self,
        vendor_name: str,
        rows: Iterable[Dict[str, Any]],
    ) -> SyncStats:
        stats = SyncStats(vendor_name=vendor_name)
        url_map, raw_map, existing_rows = self._load_existing_maps(vendor_name)

        for row in rows:
            stats.total_scraped += 1
            # Print progress every 100 items
            if stats.total_scraped % 100 == 0:
                print(f"Processing item {stats.total_scraped}...", flush=True)
            prepared = self._prepare_row(row)
            if not prepared:
                stats.skipped += 1
                # Determine skip reason
                skip_reason = "Unknown"
                raw_name = row.get("raw_name")
                category = row.get("category")
                price = row.get("price_bdt")
                
                if not raw_name or not raw_name.strip():
                    skip_reason = "Missing product name"
                elif not category or not category.strip():
                    skip_reason = "Missing category"
                elif price is None:
                    skip_reason = "Missing price"
                else:
                    try:
                        float(price)
                    except (TypeError, ValueError):
                        skip_reason = "Invalid price format"
                
                stats.events.append(
                    SyncEvent(
                        action="skip",
                        raw_name=raw_name or "Unknown",
                        category=category or "Unknown",
                        product_url=row.get("product_url"),
                        price_bdt=None,
                        availability_status="unknown",
                        skip_reason=skip_reason,
                    )
                )
                continue

            category_key = prepared["_category_key"]
            raw_key = prepared["_raw_key"]
            normalized_url = prepared["_normalized_url"]

            product_id = None
            if normalized_url:
                product_id = url_map.get(normalized_url)
            if product_id is None and category_key and raw_key:
                product_id = raw_map.get((category_key, raw_key))
            
            # Priority 2: ML fallback matching for unmatched products
            # This helps find existing products and standardize names
            # Works for both page_visit and bulk scrapes (for new products)
            if product_id is None:
                try:
                    import sys
                    import os
                    # Add lib/ai to path
                    script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                    category_models_dir = os.path.join(script_dir, 'lib', 'ai', 'category_models')
                    if os.path.exists(category_models_dir):
                        sys.path.insert(0, category_models_dir)
                        from category_matcher import CategoryProductMatcher
                        
                        # Initialize matcher (reuse if available)
                        if not hasattr(self, '_ml_matcher'):
                            matcher = CategoryProductMatcher(
                                model_dir=category_models_dir,
                                db_path=self.db_path
                            )
                            self._ml_matcher = matcher
                        else:
                            matcher = self._ml_matcher
                        
                        # Predict with very high confidence threshold (0.75 for safety)
                        ml_result = matcher.predict_match(
                            product_name=prepared["raw_name"],
                            category=prepared["category"],
                            confidence_threshold=0.75
                        )
                        
                        if ml_result.get('is_match') and ml_result.get('standard_name'):
                            ml_confidence = ml_result.get('confidence', 0.0)
                            ml_standard_name = ml_result['standard_name']
                            
                            # Find existing product by predicted standard_name
                            cursor = self._execute(
                                """
                                SELECT id FROM all_products 
                                WHERE standard_name = ? AND category = ? AND vendor_name = ?
                                LIMIT 1
                                """,
                                (ml_standard_name, prepared["category"], vendor_name)
                            )
                            match = self._fetchone(cursor)
                            if match:
                                product_id = match["id"]
                                print(
                                    f"[ML Match] Matched '{prepared['raw_name']}' -> "
                                    f"'{ml_standard_name}' (confidence: {ml_confidence:.2f}, "
                                    f"product_id: {product_id})",
                                    flush=True
                                )
                            else:
                                # No existing match, but still use ML standard_name for new product
                                print(
                                    f"[ML Standardize] New product '{prepared['raw_name']}' -> "
                                    f"'{ml_standard_name}' (confidence: {ml_confidence:.2f})",
                                    flush=True
                                )
                            
                            # Always update prepared data with ML-standardized name
                            prepared["standard_name"] = ml_standard_name
                            prepared["tokenized_name"] = extract_tokenized_name(ml_standard_name, prepared["category"])
                            scrape_source = prepared.get("scrape_source", "bulk")
                            prepared["standard_name_source"] = f"ml_{scrape_source}"
                            prepared["ml_confidence"] = ml_confidence
                except Exception as e:
                    # Fail silently - continue as new product
                    if "No module named" not in str(e) and "not found" not in str(e).lower():
                        print(f"[ML Match] Error: {e}", flush=True)

            if product_id is not None:
                existing = existing_rows.get(product_id)
                
                # Skip updating if the existing product was scraped via page_visit AND new scrape is bulk
                # Rule: page_visit can overwrite bulk and itself, bulk can overwrite bulk but not page_visit
                if (existing is not None 
                    and existing.get("scrape_source") == "page_visit"
                    and prepared.get("scrape_source") == "bulk"):
                    stats.skipped += 1
                    stats.events.append(
                        SyncEvent(
                            action="skip",
                            raw_name=prepared["raw_name"],
                            category=prepared["category"],
                            product_url=prepared["product_url"],
                            price_bdt=prepared["price_bdt"],
                            availability_status=prepared["availability_status"],
                            skip_reason="Product was scraped via page_visit, skipping bulk update",
                        )
                    )
                    continue
                
                price_changed = False
                availability_changed = False
                if existing is not None:
                    old_price = self._to_float(existing.get("price_bdt"))
                    new_price = prepared["price_bdt"]
                    if old_price is not None and new_price is not None:
                        price_changed = abs(old_price - new_price) > 0.01
                    elif old_price is None and new_price is not None:
                        price_changed = True  # Price was added
                    elif old_price is not None and new_price is None:
                        price_changed = True  # Price was removed
                    
                    old_availability = clean_text(existing.get("availability_status"))
                    new_availability = prepared["availability_status"]
                    if old_availability and new_availability:
                        availability_changed = old_availability.lower() != new_availability.lower()
                    elif old_availability != new_availability:
                        availability_changed = True
                
                # Only update if something actually changed, or if we need to update scraped_at
                # For now, we'll always update to refresh scraped_at, but track what changed
                # For page visit scrapes, also update standard_name if ML changed it
                # IMPORTANT: Always update scrape_source to reflect the latest scrape method
                self._update_product(product_id, prepared)
                stats.updated += 1
                stats.events.append(
                    SyncEvent(
                        action="update",
                        raw_name=prepared["raw_name"],
                        category=prepared["category"],
                        product_url=prepared["product_url"],
                        price_bdt=prepared["price_bdt"],
                        availability_status=prepared["availability_status"],
                        price_changed=price_changed if existing is not None else None,
                        availability_changed=availability_changed if existing is not None else None,
                    )
                )
                existing_rows[product_id] = {
                    "id": product_id,
                    "category": prepared["category"],
                    "raw_name": prepared["raw_name"],
                    "product_url": prepared["product_url"],
                    "price_bdt": prepared["price_bdt"],
                    "availability_status": prepared["availability_status"],
                    "scrape_source": prepared.get("scrape_source", "bulk"),
                }
            else:
                new_id = self._insert_product(vendor_name, prepared)
                stats.inserted += 1
                stats.events.append(
                    SyncEvent(
                        action="insert",
                        raw_name=prepared["raw_name"],
                        category=prepared["category"],
                        product_url=prepared["product_url"],
                        price_bdt=prepared["price_bdt"],
                        availability_status=prepared["availability_status"],
                    )
                )
                # Update maps so subsequent duplicates in the same run reuse the new record
                if normalized_url:
                    url_map[normalized_url] = new_id
                if category_key and raw_key:
                    raw_map[(category_key, raw_key)] = new_id
                existing_rows[new_id] = {
                    "id": new_id,
                    "category": prepared["category"],
                    "raw_name": prepared["raw_name"],
                    "product_url": prepared["product_url"],
                    "price_bdt": prepared["price_bdt"],
                    "availability_status": prepared["availability_status"],
                    "scrape_source": prepared.get("scrape_source", "bulk"),
                }

        # Commit with retry logic for database locks
        max_retries = 3
        for attempt in range(max_retries):
            try:
                self.conn.commit()
                break
            except Exception as e:
                error_str = str(e).lower()
                if ("locked" in error_str or "could not obtain lock" in error_str) and attempt < max_retries - 1:
                    time.sleep(0.5 * (attempt + 1))  # Exponential backoff
                    continue
                raise
        return stats

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _load_existing_maps(
        self, vendor_name: str
    ) -> Tuple[Dict[str, int], Dict[Tuple[str, str], int], Dict[int, Dict[str, Any]]]:
        url_map: Dict[str, int] = {}
        raw_map: Dict[Tuple[str, str], int] = {}
        existing_rows: Dict[int, Dict[str, Any]] = {}
        max_retries = 3
        for attempt in range(max_retries):
            try:
                cursor = self._execute(
                    """
                    SELECT id, category, raw_name, product_url, price_bdt, availability_status, scrape_source
                    FROM all_products
                    WHERE vendor_name = ?
                    """,
                    (vendor_name,),
                )
                break
            except Exception as e:
                error_str = str(e).lower()
                if ("locked" in error_str or "could not obtain lock" in error_str) and attempt < max_retries - 1:
                    time.sleep(0.2 * (attempt + 1))
                    continue
                raise
        for row in self._fetchall(cursor):
            normalized_url = normalize_url(row["product_url"])
            if normalized_url:
                url_map[normalized_url] = row["id"]
            category_key = normalize_key(row["category"])
            raw_key = normalize_key(row["raw_name"])
            if category_key and raw_key:
                raw_map[(category_key, raw_key)] = row["id"]
            existing_rows[row["id"]] = {
                "id": row["id"],
                "category": row["category"],
                "raw_name": row["raw_name"],
                "product_url": row["product_url"],
                "price_bdt": row["price_bdt"],
                "availability_status": row["availability_status"],
                "scrape_source": row["scrape_source"],
            }
        return url_map, raw_map, existing_rows

    def _prepare_row(self, row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        raw_name = clean_text(row.get("raw_name"))
        category = clean_text(row.get("category"))
        price = row.get("price_bdt")
        availability_status_raw = row.get("availability_status")

        if not raw_name or not category:
            return None
        
        # Get availability status first
        availability = clean_text(availability_status_raw or "unknown") or "unknown"
        
        # Convert price to float, or None if missing/invalid
        # IMPORTANT: Allow None price for out_of_stock/upcoming products
        price_value = None
        if price is not None:
            try:
                price_value = float(price)
                # If price is 0, treat as None (unavailable)
                if price_value == 0:
                    price_value = None
            except (TypeError, ValueError):
                price_value = None
        
        # IMPORTANT: If product is out of stock or upcoming, clear the price
        # This ensures we don't display stale prices for unavailable products
        if (availability == "out_of_stock" or availability == "upcoming") and price_value is not None:
            print(f"[Prepare Row] Clearing price for {availability} product: {row.get('raw_name')} (was {price_value} BDT)", flush=True)
            price_value = None
        
        # Allow products with None price if they're out of stock or upcoming
        # Previously we would skip these, but we need to update them to clear the price
        if price_value is None and availability not in ["out_of_stock", "upcoming"]:
            return None
        product_url = clean_text(row.get("product_url"))
        normalized_url = normalize_url(product_url)
        image_url = clean_text(row.get("image_url")) or None
        description = row.get("description")
        currency = clean_text(row.get("currency") or "BDT") or "BDT"
        scraped_at = clean_text(row.get("scraped_at")) or now_iso()

        # Get standard_name from row (may be set by ML in page visit scraping)
        # For bulk scrapes, generate a standardized name from raw_name
        standard_name = row.get("standard_name")
        if not standard_name or standard_name == raw_name:
            # No ML-provided standard_name, generate one by cleaning the raw_name
            standard_name = standardize_name(raw_name, category)
        
        # Tokenized name is the cleaned standard_name split into words
        tokenized_name = extract_tokenized_name(standard_name, category)
        
        brand = extract_brand(raw_name)
        
        # Get scrape source - default to 'bulk' if not specified
        scrape_source = row.get("scrape_source", "bulk")
        standard_name_source = row.get("standard_name_source", "bulk")
        ml_confidence = row.get("ml_confidence")

        return {
            "raw_name": raw_name,
            "category": category,
            "price_bdt": price_value,
            "availability_status": availability,
            "product_url": product_url or None,
            "image_url": image_url,
            "currency": currency,
            "description": description,
            "scraped_at": scraped_at,
            "standard_name": standard_name,
            "tokenized_name": tokenized_name,
            "brand": brand,
            "scrape_source": scrape_source,
            "standard_name_source": standard_name_source,
            "ml_confidence": ml_confidence,
            "_category_key": normalize_key(category),
            "_raw_key": normalize_key(raw_name),
            "_normalized_url": normalized_url,
        }

    def _update_product(self, product_id: int, data: Dict[str, Any]) -> None:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Update image_url if a new value is provided (not None/empty)
                # Always update description if provided
                # For page visit scrapes, update standard_name if ML changed it
                update_sql = """
                    UPDATE all_products
                    SET price_bdt = ?,
                        availability_status = ?,
                        scraped_at = ?,
                        updated_at = ?,
                        description = COALESCE(?, description),
                        currency = ?,
                        scrape_source = ?
                """
                # Ensure price_bdt is None for out_of_stock, upcoming, or zero-price products
                price_bdt_value = data["price_bdt"]
                availability_status = data.get("availability_status")
                if (availability_status == "out_of_stock" or availability_status == "upcoming") and price_bdt_value is not None:
                    price_bdt_value = None
                    print(f"[DB Update] Setting price_bdt to None for {availability_status} product (id: {product_id})", flush=True)
                elif price_bdt_value is not None and price_bdt_value == 0:
                    # Price of 0 means unavailable
                    price_bdt_value = None
                    if availability_status == "unknown":
                        availability_status = "out_of_stock"
                        data["availability_status"] = "out_of_stock"
                    print(f"[DB Update] Setting price_bdt to None for zero-price product (id: {product_id})", flush=True)
                
                update_params = [
                    price_bdt_value,
                    availability_status,
                    data["scraped_at"],
                    data["scraped_at"],
                    data["description"],
                    data["currency"],
                    data.get("scrape_source", "bulk"),
                ]
                
                # Only update image_url if a new value is provided (not None/empty)
                if data.get("image_url"):
                    update_sql += ", image_url = ?"
                    update_params.append(data["image_url"])
                
                # For page visit scrapes, update standard_name_source and related fields
                if data.get("scrape_source") == "page_visit":
                    # Always update standard_name_source for page visit scrapes
                    update_sql += ", standard_name_source = ?"
                    update_params.append(data.get("standard_name_source", "page_visit"))
                    
                    # If ML changed standard_name, also update standard_name, ml_confidence, and tokenized_name
                    if data.get("standard_name_source") == "ml_page_visit":
                        update_sql += ", standard_name = ?, ml_confidence = ?, tokenized_name = ?"
                        update_params.extend([
                            data["standard_name"],
                            data.get("ml_confidence"),
                            data["tokenized_name"],
                        ])
                    else:
                        # For page visit scrapes, always update tokenized_name if provided
                        if data.get("tokenized_name"):
                            update_sql += ", tokenized_name = ?"
                            update_params.append(data["tokenized_name"])
                
                update_sql += " WHERE id = ?"
                update_params.append(product_id)
                
                self._execute(update_sql, tuple(update_params))
                break
            except Exception as e:
                error_str = str(e).lower()
                if ("locked" in error_str or "could not obtain lock" in error_str) and attempt < max_retries - 1:
                    time.sleep(0.2 * (attempt + 1))
                    continue
                raise

    def _insert_product(self, vendor_name: str, data: Dict[str, Any]) -> int:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                if self.is_postgres:
                    # PostgreSQL: Use RETURNING id
                    insert_sql = """
                        INSERT INTO all_products (
                            vendor_name,
                            category,
                            raw_name,
                            price_bdt,
                            availability_status,
                            product_url,
                            image_url,
                            currency,
                            description,
                            scraped_at,
                            created_at,
                            updated_at,
                            standard_name,
                            brand,
                            tokenized_name,
                            scrape_source,
                            standard_name_source,
                            ml_confidence
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        RETURNING id
                    """
                else:
                    # SQLite: Standard INSERT
                    insert_sql = """
                        INSERT INTO all_products (
                            vendor_name,
                            category,
                            raw_name,
                            price_bdt,
                            availability_status,
                            product_url,
                            image_url,
                            currency,
                            description,
                            scraped_at,
                            created_at,
                            updated_at,
                            standard_name,
                            brand,
                            tokenized_name,
                            scrape_source,
                            standard_name_source,
                            ml_confidence
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """
                
                params = (
                    vendor_name,
                    data["category"],
                    data["raw_name"],
                    data["price_bdt"],
                    data["availability_status"],
                    data["product_url"],
                    data["image_url"],
                    data["currency"],
                    data["description"],
                    data["scraped_at"],
                    data["scraped_at"],
                    data["scraped_at"],
                    data["standard_name"],
                    data["brand"],
                    data["tokenized_name"],
                    data.get("scrape_source", "bulk"),
                    data.get("standard_name_source", "bulk"),
                    data.get("ml_confidence"),
                )
                
                cursor = self._execute(insert_sql, params)
                return self._get_lastrowid(cursor)
            except Exception as e:
                error_str = str(e).lower()
                if ("locked" in error_str or "could not obtain lock" in error_str) and attempt < max_retries - 1:
                    time.sleep(0.2 * (attempt + 1))
                    continue
                raise

    def _to_float(self, value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            return float(value)
        except (TypeError, ValueError):
            return None


def sync_rows_into_db(
    vendor_name: str,
    rows: Iterable[Dict[str, Any]],
    db_path: str = "final_products.db",
    database_url: Optional[str] = None,
) -> SyncStats:
    syncer = ProductSynchronizer(db_path=db_path, database_url=database_url)
    try:
        return syncer.sync_vendor_rows(vendor_name, rows)
    finally:
        syncer.close()
