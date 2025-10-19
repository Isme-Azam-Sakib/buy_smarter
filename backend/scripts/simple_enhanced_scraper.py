#!/usr/bin/env python3
"""
Simple enhanced scraper that bypasses .env loading
"""

import asyncio
import os
import sys
import json
from datetime import datetime

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Direct database path
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'buysmarter.db')

async def run_enhanced_scraping():
    """Run enhanced scraping with reconciliation"""
    print("Running enhanced scraping...")
    
    try:
        # Import the enhanced scraper
        from vendors.startech_enhanced import StarTechEnhanced
        
        scraper = StarTechEnhanced()
        result = await scraper.scrape_and_store()
        
        if result['success']:
            print("Enhanced scraping completed successfully!")
            stats = result['stats']
            print(f"Duration: {result['duration']}")
            print(f"Products processed: {stats.get('total_processed', 0)}")
            print(f"Products matched: {stats.get('matched_products', 0)}")
            print(f"Products created: {stats.get('created_products', 0)}")
            return True
        else:
            print(f"Enhanced scraping failed: {result['message']}")
            return False
            
    except Exception as e:
        print(f"Error in enhanced scraping: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(run_enhanced_scraping())
    sys.exit(0 if success else 1)
