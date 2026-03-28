#!/usr/bin/env python3
"""
CLI entry point for refreshing a single product from all vendors.
Usage: python -m scrapers.refresh_product --category <category> --urls <json>
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from .product_refresh import refresh_product_from_all_vendors


def main() -> int:
    try:
        parser = argparse.ArgumentParser(description="Refresh a single product from all vendors")
        parser.add_argument("--category", required=True, help="Product category")
        parser.add_argument("--urls", required=True, help="JSON dict of {vendor_slug: product_url}")
        parser.add_argument("--db", default="final_products.db", help="Database path")
        parser.add_argument("--timeout", type=int, default=10, help="Timeout per vendor in seconds")
        parser.add_argument("--json", action="store_true", help="Output JSON")
        
        args = parser.parse_args()
        
        try:
            product_urls = json.loads(args.urls)
        except json.JSONDecodeError as e:
            if args.json:
                output = {
                    "success": False,
                    "error": f"Error parsing URLs JSON: {e}",
                    "scraped_count": 0,
                    "results": [],
                }
                print(json.dumps(output))
            else:
                print(f"Error parsing URLs JSON: {e}", file=sys.stderr)
            return 0  # Return 0 so JSON can be parsed
        
        # Get DATABASE_URL from environment if available
        database_url = os.environ.get("DATABASE_URL")
        
        try:
            results = refresh_product_from_all_vendors(
                product_urls=product_urls,
                category=args.category,
                db_path=args.db,
                timeout=args.timeout,
                database_url=database_url,
            )
            
            if args.json:
                output = {
                    "success": True,
                    "scraped_count": len(results),
                    "results": results,
                }
                print(json.dumps(output))
            else:
                print(f"Scraped {len(results)} vendors successfully")
                for result in results:
                    print(f"  - {result['vendor_name']}: {result['raw_name']}")
            
            return 0
        except Exception as e:
            error_msg = str(e)
            if args.json:
                output = {
                    "success": False,
                    "error": error_msg,
                    "scraped_count": 0,
                    "results": [],
                }
                print(json.dumps(output))
            else:
                print(f"Error: {error_msg}", file=sys.stderr)
            # Still return 0 so the JSON output is parsed, but success=false indicates failure
            return 0
    except Exception as e:
        # Catch any top-level exceptions (e.g., import errors, argument parsing errors)
        error_msg = str(e)
        try:
            # Try to output JSON if possible
            output = {
                "success": False,
                "error": f"Fatal error: {error_msg}",
                "scraped_count": 0,
                "results": [],
            }
            print(json.dumps(output))
        except:
            # If JSON output fails, output to stderr
            print(f"Fatal error: {error_msg}", file=sys.stderr)
        return 0  # Return 0 so any JSON output can be parsed


if __name__ == "__main__":
    raise SystemExit(main())
