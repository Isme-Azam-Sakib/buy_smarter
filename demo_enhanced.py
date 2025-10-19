#!/usr/bin/env python3
"""
Enhanced demo script showing BuySmarter PC Parts with master product integration
"""

import sys
import os
import json
from pathlib import Path

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def analyze_master_products():
    """Analyze the master product catalog"""
    print("Master Product Catalog Analysis")
    print("=" * 50)
    
    master_products_dir = Path("masterProducts")
    if not master_products_dir.exists():
        print("Error: masterProducts directory not found!")
        return
    
    categories = {
        'cpu.json': 'CPU',
        'motherboard.json': 'Motherboard',
        'memory.json': 'RAM',
        'video-card.json': 'GPU',
        'power-supply.json': 'PSU',
        'internal-hard-drive.json': 'Storage',
        'case.json': 'Case',
        'cpu-cooler.json': 'Cooling'
    }
    
    total_products = 0
    total_size = 0
    
    print("\nCategory Breakdown:")
    for filename, category in categories.items():
        file_path = master_products_dir / filename
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    products = json.load(f)
                
                file_size = file_path.stat().st_size / (1024 * 1024)  # MB
                total_products += len(products)
                total_size += file_size
                
                print(f"  {category:12}: {len(products):5} products ({file_size:.1f} MB)")
                
                # Show sample product
                if products:
                    sample = products[0]
                    print(f"    Sample: {sample.get('name', 'Unknown')}")
                    
            except Exception as e:
                print(f"  {category:12}: Error reading file - {e}")
        else:
            print(f"  {category:12}: File not found")
    
    print(f"\nTotal: {total_products} products ({total_size:.1f} MB)")
    return total_products

def demo_product_reconciliation():
    """Demo the product reconciliation system"""
    print("\nProduct Reconciliation System")
    print("=" * 50)
    
    print("\nHow it works:")
    print("1. Scraper finds product: 'AMD Ryzen 7 7700X' from TechLand BD")
    print("2. System searches master catalog for matches")
    print("3. Fuzzy matching finds: 'AMD Ryzen 7 7700X' (95% confidence)")
    print("4. Product is reconciled with master catalog")
    print("5. Price entry is created linking vendor price to master product")
    
    print("\nMatching Methods:")
    print("  Level 1: Fast fuzzy matching (95%+ confidence)")
    print("  Level 2: Advanced matching with specs (85%+ confidence)")
    print("  Level 3: Brand + partial name matching (75%+ confidence)")
    
    print("\nBenefits:")
    print("  [OK] Consistent product identification across vendors")
    print("  [OK] Accurate price comparison")
    print("  [OK] Historical price tracking")
    print("  [OK] AI recommendations based on master specs")

def demo_enhanced_features():
    """Demo enhanced features with master products"""
    print("\nEnhanced Features with Master Products")
    print("=" * 50)
    
    print("\n1. Smart Price Comparison:")
    print("   - Compare 'AMD Ryzen 7 7700X' across all vendors")
    print("   - Show price history and trends")
    print("   - AI-powered buy/wait recommendations")
    
    print("\n2. Advanced PC Builder:")
    print("   - Select 'AMD Ryzen 7 7700X' from master catalog")
    print("   - System shows compatible motherboards (AM5 socket)")
    print("   - Suggests optimal RAM (DDR5-6000)")
    print("   - Validates power requirements (105W TDP)")
    
    print("\n3. AI Component Recommendations:")
    print("   - 'You selected AMD Ryzen 7 7700X'")
    print("   - 'Recommended motherboard: ASUS PRIME B650-PLUS WIFI'")
    print("   - 'Reason: AM5 socket, good value, compatible chipset'")
    print("   - 'Price: BDT 17,599 (TechLand BD)'")
    
    print("\n4. Vendor Coverage:")
    print("   - TechLand BD: 1,200+ products")
    print("   - Skyland Computer BD: 800+ products")
    print("   - Star Tech: 1,500+ products")
    print("   - Ryans: 1,000+ products")
    print("   - PC House BD: 600+ products")
    print("   - Ultra Tech BD: 400+ products")

def demo_data_flow():
    """Demo the complete data flow"""
    print("\nComplete Data Flow")
    print("=" * 50)
    
    print("\n1. Master Product Loading:")
    print("   masterProducts/cpu.json -> Database -> MasterProduct table")
    print("   Creates detailed specs: CPU_Specs, GPU_Specs, etc.")
    
    print("\n2. Web Scraping:")
    print("   TechLand BD website -> Scraper -> Raw product data")
    print("   Example: 'AMD Ryzen 7 7700X - BDT 28,500'")
    
    print("\n3. Product Reconciliation:")
    print("   Raw data -> Fuzzy matching -> Master product ID")
    print("   Match: 'AMD Ryzen 7 7700X' -> Master ID: 12345")
    
    print("\n4. Price Entry Creation:")
    print("   Master ID + Vendor + Price -> PriceEntry table")
    print("   Links vendor price to master product")
    
    print("\n5. User Experience:")
    print("   User searches 'Ryzen 7 7700X' -> Shows all vendor prices")
    print("   User builds PC -> Uses master specs for compatibility")
    print("   AI recommends -> Based on master product relationships")

def main():
    """Main demo function"""
    print("BuySmarter PC Parts - Enhanced Demo with Master Products")
    print("=" * 70)
    print("Comprehensive PC parts price comparison with AI-powered features")
    print("Integrated with your master product catalog for accurate matching")
    print("=" * 70)
    
    # Analyze master products
    total_products = analyze_master_products()
    
    if total_products == 0:
        print("\nError: No master products found. Please ensure masterProducts folder exists.")
        return
    
    # Demo reconciliation system
    demo_product_reconciliation()
    
    # Demo enhanced features
    demo_enhanced_features()
    
    # Demo data flow
    demo_data_flow()
    
    print("\nTechnical Architecture")
    print("=" * 50)
    print("Frontend: Next.js 14 + TypeScript + Tailwind CSS")
    print("Backend: Python FastAPI + SQLAlchemy")
    print("Database: PostgreSQL + Prisma ORM")
    print("AI: Google Gemini Pro integration")
    print("Scraping: Async scrapers with product reconciliation")
    print("Matching: RapidFuzz + custom algorithms")
    print("Task Queue: Celery + Redis")
    
    print("\nMaster Product Integration Benefits")
    print("=" * 50)
    print("[OK] Consistent product identification across vendors")
    print("[OK] Accurate price comparison and historical tracking")
    print("[OK] AI recommendations based on comprehensive specs")
    print("[OK] PC builder with real compatibility checking")
    print("[OK] Scalable architecture for adding new vendors")
    print("[OK] Data quality through master catalog validation")
    
    print("\nGetting Started")
    print("=" * 50)
    print("1. Run: python setup_with_master_products.py")
    print("2. Configure .env with your database and API keys")
    print("3. Start development servers")
    print("4. Test enhanced scraping with product reconciliation")
    
    print(f"\nReady to process {total_products} master products across 6+ vendors!")
    print("Revolutionizing PC parts shopping in Bangladesh!")

if __name__ == "__main__":
    main()
