#!/usr/bin/env python3
"""
Master Catalog Loader
Loads masterProducts JSON files into the database as the master product catalog.
This serves as the reference for product reconciliation during scraping.
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

# Add the backend directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from database import SessionLocal, engine, Base
from models import (
    MasterProduct, CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, 
    PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs
)

class MasterCatalogLoader:
    """Loads master product catalog from JSON files into database"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.master_products_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'masterProducts')
        self.category_mapping = {
            'cpu.json': 'cpu',
            'video-card.json': 'gpu', 
            'memory.json': 'ram',
            'motherboard.json': 'motherboard',
            'power-supply.json': 'psu',
            'internal-hard-drive.json': 'storage',
            'case.json': 'case',
            'cpu-cooler.json': 'cooling'
        }
        
    def load_all_categories(self) -> Dict[str, int]:
        """Load all master product categories from JSON files"""
        results = {}
        total_loaded = 0
        
        print("=" * 80)
        print("MASTER CATALOG LOADER")
        print("=" * 80)
        
        # Clear existing master products first
        print("Clearing existing master products...")
        self._clear_master_products()
        
        for json_file, category in self.category_mapping.items():
            json_path = os.path.join(self.master_products_dir, json_file)
            if os.path.exists(json_path):
                print(f"\nLoading {category} from {json_file}...")
                count = self._load_category(json_path, category)
                results[category] = count
                total_loaded += count
                print(f"Loaded {count} {category} products")
            else:
                print(f"Warning: {json_file} not found, skipping {category}")
                results[category] = 0
        
        print(f"\n" + "=" * 80)
        print(f"MASTER CATALOG LOADING COMPLETE")
        print(f"Total products loaded: {total_loaded}")
        print("=" * 80)
        
        return results
    
    def _clear_master_products(self):
        """Clear all existing master products and their specs"""
        try:
            # Delete all spec tables first (foreign key constraints)
            spec_tables = [CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, 
                          PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs]
            
            for spec_table in spec_tables:
                deleted_specs = self.db.query(spec_table).delete()
                print(f"Deleted {deleted_specs} {spec_table.__tablename__} records")
            
            # Delete all master products
            deleted_products = self.db.query(MasterProduct).delete()
            print(f"Deleted {deleted_products} master products")
            
            self.db.commit()
            print("Master products cleared successfully")
            
        except Exception as e:
            self.db.rollback()
            print(f"Error clearing master products: {e}")
            raise
    
    def _load_category(self, json_path: str, category: str) -> int:
        """Load products from a specific category JSON file"""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                products = json.load(f)
            
            if not isinstance(products, list):
                print(f"Error: {json_path} does not contain a list of products")
                return 0
            
            loaded_count = 0
            for product_data in products:
                try:
                    master_product = self._create_master_product(product_data, category)
                    if master_product:
                        self.db.add(master_product)
                        self.db.flush()  # Get the product_id
                        
                        # Create category-specific specs
                        self._create_specs(master_product, product_data, category)
                        loaded_count += 1
                        
                        if loaded_count % 100 == 0:
                            print(f"  Processed {loaded_count} products...")
                            
                except Exception as e:
                    print(f"  Error processing product {product_data.get('name', 'Unknown')}: {e}")
                    continue
            
            self.db.commit()
            return loaded_count
            
        except Exception as e:
            self.db.rollback()
            print(f"Error loading {category}: {e}")
            return 0
    
    def _create_master_product(self, product_data: Dict[str, Any], category: str) -> Optional[MasterProduct]:
        """Create a MasterProduct from JSON data"""
        try:
            name = product_data.get('name', '').strip()
            if not name:
                return None
            
            # Extract brand from name (first word typically)
            brand = self._extract_brand(name)
            
            # Create key specs JSON
            key_specs = self._extract_key_specs(product_data, category)
            
            return MasterProduct(
                standard_name=name,
                category=category,
                brand=brand,
                current_cheapest_price=None,  # No BDT prices in master catalog
                key_specs_json=json.dumps(key_specs),
                image_urls=json.dumps([]),  # No images in master catalog
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            
        except Exception as e:
            print(f"Error creating master product: {e}")
            return None
    
    def _extract_brand(self, name: str) -> str:
        """Extract brand from product name"""
        # Common brand patterns
        brand_patterns = [
            'Intel', 'AMD', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'EVGA', 'Corsair',
            'G.Skill', 'Kingston', 'Samsung', 'Western Digital', 'Seagate', 'Crucial',
            'Thermaltake', 'Cooler Master', 'Noctua', 'be quiet!', 'Fractal Design',
            'NZXT', 'Antec', 'Silverstone', 'Lian Li', 'Phanteks', 'Rosewill',
            'PowerColor', 'Sapphire', 'XFX', 'HIS', 'Zotac', 'PNY', 'Galaxy',
            'Club 3D', 'VisionTek', 'Diamond', 'Gainward', 'Palit', 'Inno3D',
            'KFA2', 'GALAX', 'Biostar', 'Acer', 'Lexar', 'GeIL', 'Silicon Power',
            'TEAMGROUP', 'Klevv', 'ADATA', 'OLOy', 'Biwin'
        ]
        
        name_upper = name.upper()
        for brand in brand_patterns:
            if brand.upper() in name_upper:
                return brand
        
        # If no brand found, use first word
        return name.split()[0] if name.split() else 'Unknown'
    
    def _extract_key_specs(self, product_data: Dict[str, Any], category: str) -> Dict[str, Any]:
        """Extract key specifications based on category"""
        specs = {}
        
        if category == 'cpu':
            specs = {
                'cores': product_data.get('core_count'),
                'base_clock': product_data.get('core_clock'),
                'boost_clock': product_data.get('boost_clock'),
                'tdp': product_data.get('tdp'),
                'microarchitecture': product_data.get('microarchitecture'),
                'graphics': product_data.get('graphics')
            }
        elif category == 'gpu':
            specs = {
                'chipset': product_data.get('chipset'),
                'memory': product_data.get('memory'),
                'core_clock': product_data.get('core_clock'),
                'boost_clock': product_data.get('boost_clock'),
                'color': product_data.get('color'),
                'length': product_data.get('length')
            }
        elif category == 'ram':
            specs = {
                'speed': product_data.get('speed'),
                'modules': product_data.get('modules'),
                'cas_latency': product_data.get('cas_latency'),
                'first_word_latency': product_data.get('first_word_latency'),
                'color': product_data.get('color')
            }
        elif category == 'motherboard':
            specs = {
                'socket': product_data.get('socket'),
                'form_factor': product_data.get('form_factor'),
                'memory_slots': product_data.get('memory_slots'),
                'max_memory': product_data.get('max_memory'),
                'chipset': product_data.get('chipset')
            }
        elif category == 'psu':
            specs = {
                'wattage': product_data.get('wattage'),
                'efficiency': product_data.get('efficiency'),
                'modular': product_data.get('modular'),
                'form_factor': product_data.get('form_factor')
            }
        elif category == 'storage':
            specs = {
                'capacity': product_data.get('capacity'),
                'type': product_data.get('type'),
                'interface': product_data.get('interface'),
                'form_factor': product_data.get('form_factor'),
                'cache': product_data.get('cache')
            }
        elif category == 'case':
            specs = {
                'form_factor': product_data.get('form_factor'),
                'color': product_data.get('color'),
                'side_panel': product_data.get('side_panel'),
                'power_supply': product_data.get('power_supply')
            }
        elif category == 'cooling':
            specs = {
                'type': product_data.get('type'),
                'compatibility': product_data.get('compatibility'),
                'noise_level': product_data.get('noise_level'),
                'rpm': product_data.get('rpm')
            }
        
        # Remove None values
        return {k: v for k, v in specs.items() if v is not None}
    
    def _create_specs(self, master_product: MasterProduct, product_data: Dict[str, Any], category: str):
        """Create category-specific spec records"""
        try:
            if category == 'cpu':
                specs = CpuSpecs(
                    master_product_id=master_product.product_id,
                    cores=product_data.get('core_count'),
                    base_clock=product_data.get('core_clock'),
                    boost_clock=product_data.get('boost_clock'),
                    tdp=product_data.get('tdp'),
                    microarchitecture=product_data.get('microarchitecture'),
                    graphics=product_data.get('graphics')
                )
                self.db.add(specs)
                
            elif category == 'gpu':
                specs = GpuSpecs(
                    master_product_id=master_product.product_id,
                    chipset=product_data.get('chipset'),
                    memory=product_data.get('memory'),
                    core_clock=product_data.get('core_clock'),
                    boost_clock=product_data.get('boost_clock'),
                    color=product_data.get('color'),
                    length=product_data.get('length')
                )
                self.db.add(specs)
                
            elif category == 'ram':
                speed_data = product_data.get('speed', [])
                modules_data = product_data.get('modules', [])
                
                specs = RamSpecs(
                    master_product_id=master_product.product_id,
                    capacity=modules_data[1] if len(modules_data) > 1 else None,
                    speed=speed_data[1] if len(speed_data) > 1 else None,
                    type=f"DDR{speed_data[0]}" if len(speed_data) > 0 else None,
                    cas_latency=product_data.get('cas_latency'),
                    voltage=None,  # Not available in master data
                    first_word_latency=product_data.get('first_word_latency')
                )
                self.db.add(specs)
                
            elif category == 'motherboard':
                specs = MotherboardSpecs(
                    master_product_id=master_product.product_id,
                    socket=product_data.get('socket'),
                    form_factor=product_data.get('form_factor'),
                    memory_slots=product_data.get('memory_slots'),
                    max_memory=product_data.get('max_memory'),
                    chipset=product_data.get('chipset')
                )
                self.db.add(specs)
                
            elif category == 'psu':
                specs = PsuSpecs(
                    master_product_id=master_product.product_id,
                    wattage=product_data.get('wattage'),
                    efficiency=product_data.get('efficiency'),
                    modular=product_data.get('modular'),
                    form_factor=product_data.get('form_factor')
                )
                self.db.add(specs)
                
            elif category == 'storage':
                specs_type = 'ssd' if product_data.get('type', '').lower() in ['ssd', 'nvme', 'm.2'] else 'hdd'
                
                if specs_type == 'ssd':
                    specs = SsdSpecs(
                        master_product_id=master_product.product_id,
                        capacity=product_data.get('capacity'),
                        type=product_data.get('type'),
                        interface=product_data.get('interface'),
                        form_factor=product_data.get('form_factor'),
                        cache=product_data.get('cache')
                    )
                else:
                    specs = HddSpecs(
                        master_product_id=master_product.product_id,
                        capacity=product_data.get('capacity'),
                        type=product_data.get('type'),
                        interface=product_data.get('interface'),
                        form_factor=product_data.get('form_factor'),
                        cache=product_data.get('cache')
                    )
                self.db.add(specs)
                
            elif category == 'case':
                specs = CaseSpecs(
                    master_product_id=master_product.product_id,
                    form_factor=product_data.get('form_factor'),
                    color=product_data.get('color'),
                    side_panel=product_data.get('side_panel'),
                    power_supply=product_data.get('power_supply')
                )
                self.db.add(specs)
                
        except Exception as e:
            print(f"Error creating {category} specs: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about loaded master products"""
        try:
            total_products = self.db.query(MasterProduct).count()
            
            category_counts = {}
            for category in self.category_mapping.values():
                count = self.db.query(MasterProduct).filter(MasterProduct.category == category).count()
                category_counts[category] = count
            
            return {
                'total_products': total_products,
                'category_counts': category_counts
            }
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {}
    
    def close(self):
        """Close database connection"""
        self.db.close()

def main():
    """Main function to load master catalog"""
    try:
        # Ensure tables exist
        Base.metadata.create_all(bind=engine)
        
        loader = MasterCatalogLoader()
        results = loader.load_all_catalog()
        
        # Print final statistics
        stats = loader.get_stats()
        print(f"\nFinal Statistics:")
        print(f"Total master products: {stats.get('total_products', 0)}")
        for category, count in stats.get('category_counts', {}).items():
            print(f"  {category}: {count} products")
        
        loader.close()
        
    except Exception as e:
        print(f"Error loading master catalog: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
