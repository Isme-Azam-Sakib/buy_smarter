from __future__ import annotations

import argparse
import json
from typing import Any, Iterable

from . import AVAILABLE_VENDORS, sync_all_vendors, sync_vendor_to_db


def _print_stats(results: Iterable[Any]) -> None:
    for stats in results:
        print(str(stats), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run scrapers and sync with final_products.db")
    parser.add_argument(
        "--vendor",
        help="Vendor slug to scrape (defaults to all vendors)",
        choices=sorted(AVAILABLE_VENDORS.keys()),
    )
    parser.add_argument(
        "--db",
        default="final_products.db",
        help="Path to SQLite database (default: final_products.db)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output JSON payload instead of plain text",
    )
    args = parser.parse_args()

    if args.vendor:
        stats = sync_vendor_to_db(args.vendor, db_path=args.db)
        results = [stats]
    else:
        results = sync_all_vendors(db_path=args.db)

    if args.json:
        payload = [stat.to_dict() for stat in results]
        print(json.dumps(payload))
    else:
        _print_stats(results)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

