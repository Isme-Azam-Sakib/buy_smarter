#!/usr/bin/env python3
"""
Star Tech Scraper - Simple wrapper for the main Star Tech manager
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from vendors.startech import StarTechManager

async def main():
    """Main function - simple wrapper"""
    manager = StarTechManager()
    
    print("Star Tech Scraper - Quick Start")
    print("=" * 40)
    print("1. Scraping products...")
    
    # Run full sync
    result = await manager.full_sync()
    
    if result['success']:
        print(f"\n SUCCESS!")
        print(f"   Scraped: {result['scraped']} products")
        print(f"   Stored: {result['stored']} products")
        print(f"   Duration: {result['duration']}")
        print(f"   Categories: {len(result['stats']['categories'])}")
        print(f"   Top brands: {len(result['stats']['top_brands'])}")
        print(f"\nView products at: http://localhost:3000/products")
    else:
        print(f"\n ERROR: {result['message']}")

if __name__ == "__main__":
    asyncio.run(main())