#!/usr/bin/env python3
"""
Simple wrapper script to run Techland scraping
"""

import asyncio
import sys
import os

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from vendors.techland_enhanced import TechlandEnhanced

async def main():
    """Run Techland scraping"""
    print("Starting Techland scraper...")
    
    scraper = TechlandEnhanced()
    success = await scraper.scrape_and_store()
    
    if success:
        print("\n[SUCCESS] Techland scraping completed!")
    else:
        print("\n[FAILED] Techland scraping failed!")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
