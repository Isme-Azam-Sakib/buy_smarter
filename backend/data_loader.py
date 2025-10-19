#!/usr/bin/env python3
"""
Data loader for importing master product catalogs into the database
"""

import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Base, MasterProduct, CpuSpecs, GpuSpecs, RamSpecs, MotherboardSpecs, PsuSpecs, SsdSpecs, HddSpecs, CaseSpecs

class MasterProductLoader:
    """Loads master product data from JSON files into the database"""
    
    def __init__(self):
        self.session = SessionLocal()
        self.master_products_dir = Path("masterProducts")
        
        # Category mappings
        self.category_mappings = {
            'cpu.json': 'CPU',
            'motherboard.json': 'Motherboard', 
            'memory.json': 'RAM',
            'video-card.json': 'GPU',
            'power-supply.json': 'PSU',
            'internal-hard-drive.json': 'Storage',
            'case.json': 'Case',
            'cpu-cooler.json': 'Cooling'
        }
    
    def load_all_products(self):
        """Load all master products from JSON files"""
        print("Loading master product catalog...")
        
        # Create database tables
        Base.metadata.create_all(bind=engine)
        
        total_loaded = 0
        
        for filename, category in self.category_mappings.items():
            file_path = self.master_products_dir / filename
            if file_path.exists():
                print(f"\nLoading {category} products from {filename}...")
                count = self.load_category_products(file_path, category)
                total_loaded += count
                print(f"Loaded {count} {category} products")
            else:
                print(f"Warning: {filename} not found")
        
        print(f"\nTotal products loaded: {total_loaded}")
        return total_loaded
    
    def load_category_products(self, file_path: Path, category: str) -> int:
        """Load products from a specific category file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                products = json.load(f)
            
            count = 0
            for product_data in products:
                try:
                    # Create master product
                    master_product = self.create_master_product(product_data, category)
                    self.session.add(master_product)
                    self.session.flush()  # Get the ID
                    
                    # Create specific specs based on category
                    self.create_specific_specs(master_product.product_id, product_data, category)
                    
                    count += 1
                    
                    if count % 100 == 0:
                        print(f"  Processed {count} products...")
                        
                except Exception as e:
                    print(f"Error processing product {product_data.get('name', 'Unknown')}: {e}")
                    continue
            
            self.session.commit()
            return count
            
        except Exception as e:
            print(f"Error loading {file_path}: {e}")
            self.session.rollback()
            return 0
    
    def create_master_product(self, product_data: Dict[str, Any], category: str) -> MasterProduct:
        """Create a MasterProduct from product data"""
        # Extract brand from name (first word)
        name = product_data.get('name', '')
        brand = name.split()[0] if name else 'Unknown'
        
        # Convert price to BDT (assuming USD prices, 1 USD = 110 BDT)
        usd_price = product_data.get('price', 0)
        bdt_price = usd_price * 110 if usd_price else None
        
        return MasterProduct(
            standard_name=name,
            category=category,
            brand=brand,
            current_cheapest_price=bdt_price,
            key_specs_json=product_data,
            image_urls=[]  # Will be populated by scrapers
        )
    
    def create_specific_specs(self, product_id: int, product_data: Dict[str, Any], category: str):
        """Create specific specification records based on category"""
        
        if category == 'CPU':
            self.create_cpu_specs(product_id, product_data)
        elif category == 'GPU':
            self.create_gpu_specs(product_id, product_data)
        elif category == 'RAM':
            self.create_ram_specs(product_id, product_data)
        elif category == 'Motherboard':
            self.create_motherboard_specs(product_id, product_data)
        elif category == 'PSU':
            self.create_psu_specs(product_id, product_data)
        elif category == 'Storage':
            self.create_storage_specs(product_id, product_data)
        elif category == 'Case':
            self.create_case_specs(product_id, product_data)
        elif category == 'Cooling':
            self.create_cooling_specs(product_id, product_data)
    
    def create_cpu_specs(self, product_id: int, data: Dict[str, Any]):
        """Create CPU specifications"""
        specs = CpuSpecs(
            product_id=product_id,
            socket_type=self.extract_socket_type(data.get('name', '')),
            tdp_watts=data.get('tdp', 0),
            core_count=data.get('core_count', 0),
            thread_count=data.get('core_count', 0) * 2,  # Estimate threads
            base_clock=data.get('core_clock', 0.0),
            boost_clock=data.get('boost_clock', 0.0),
            integrated_graphics=data.get('graphics', 'None')
        )
        self.session.add(specs)
    
    def create_gpu_specs(self, product_id: int, data: Dict[str, Any]):
        """Create GPU specifications"""
        specs = GpuSpecs(
            product_id=product_id,
            memory_size=data.get('memory', 0),
            memory_type='GDDR6',  # Default, could be extracted from name
            base_clock=data.get('core_clock', 0.0),
            boost_clock=data.get('boost_clock', 0.0),
            tdp_watts=200,  # Estimate, not in data
            memory_bus_width=256,  # Estimate
            cuda_cores=0  # Would need to be calculated
        )
        self.session.add(specs)
    
    def create_ram_specs(self, product_id: int, data: Dict[str, Any]):
        """Create RAM specifications"""
        speed_data = data.get('speed', [0, 0])
        speed = speed_data[1] if len(speed_data) > 1 else speed_data[0]
        
        modules_data = data.get('modules', [0, 0])
        capacity = modules_data[1] if len(modules_data) > 1 else modules_data[0]
        
        specs = RamSpecs(
            product_id=product_id,
            capacity=capacity,
            speed=speed,
            type='DDR4' if speed < 5000 else 'DDR5',
            cas_latency=data.get('cas_latency', 16),
            voltage=1.35,  # Default
            form_factor='DIMM'
        )
        self.session.add(specs)
    
    def create_motherboard_specs(self, product_id: int, data: Dict[str, Any]):
        """Create Motherboard specifications"""
        specs = MotherboardSpecs(
            product_id=product_id,
            socket_type=data.get('socket', ''),
            chipset=self.extract_chipset(data.get('name', '')),
            form_factor=data.get('form_factor', 'ATX'),
            memory_slots=data.get('memory_slots', 4),
            memory_type='DDR4',  # Could be extracted from name
            max_memory=data.get('max_memory', 128),
            pcie_slots=3,  # Estimate
            sata_ports=6,  # Estimate
            m2_slots=2,  # Estimate
            usb_ports=8  # Estimate
        )
        self.session.add(specs)
    
    def create_psu_specs(self, product_id: int, data: Dict[str, Any]):
        """Create PSU specifications"""
        # Extract wattage from name or use price as estimate
        wattage = self.extract_wattage(data.get('name', ''))
        if not wattage:
            wattage = int(data.get('price', 0) * 2)  # Rough estimate
        
        specs = PsuSpecs(
            product_id=product_id,
            wattage=wattage,
            efficiency='80+ Gold',  # Default
            modularity='Semi-Modular',  # Default
            form_factor='ATX',
            pcie_connectors=2,
            sata_connectors=6,
            molex_connectors=4
        )
        self.session.add(specs)
    
    def create_storage_specs(self, product_id: int, data: Dict[str, Any]):
        """Create Storage specifications (SSD/HDD)"""
        name = data.get('name', '').lower()
        
        if 'ssd' in name or 'nvme' in name:
            specs = SsdSpecs(
                product_id=product_id,
                capacity=self.extract_capacity(data.get('name', '')),
                interface='NVMe' if 'nvme' in name else 'SATA',
                form_factor='M.2' if 'nvme' in name else '2.5"',
                read_speed=3000,  # Estimate
                write_speed=2500,  # Estimate
                tbw=600,  # Estimate
                endurance='High'  # Default
            )
        else:
            specs = HddSpecs(
                product_id=product_id,
                capacity=self.extract_capacity(data.get('name', '')),
                rpm=7200,  # Default
                interface='SATA',
                cache=64,  # Default
                form_factor='3.5"'
            )
        
        self.session.add(specs)
    
    def create_case_specs(self, product_id: int, data: Dict[str, Any]):
        """Create Case specifications"""
        specs = CaseSpecs(
            product_id=product_id,
            form_factor='ATX',  # Default
            max_gpu_length=350,  # Default
            max_cpu_height=160,  # Default
            drive_bays=4,  # Default
            fan_mounts=6,  # Default
            usb_ports=4,  # Default
            rgb_support='rgb' in data.get('name', '').lower()
        )
        self.session.add(specs)
    
    def create_cooling_specs(self, product_id: int, data: Dict[str, Any]):
        """Create Cooling specifications (placeholder)"""
        # For now, we'll just store basic info in key_specs_json
        pass
    
    def extract_socket_type(self, name: str) -> str:
        """Extract socket type from product name"""
        name_upper = name.upper()
        if 'AM5' in name_upper:
            return 'AM5'
        elif 'AM4' in name_upper:
            return 'AM4'
        elif 'LGA1700' in name_upper:
            return 'LGA1700'
        elif 'LGA1200' in name_upper:
            return 'LGA1200'
        else:
            return 'Unknown'
    
    def extract_chipset(self, name: str) -> str:
        """Extract chipset from motherboard name"""
        name_upper = name.upper()
        if 'B650' in name_upper:
            return 'B650'
        elif 'X670' in name_upper:
            return 'X670'
        elif 'B550' in name_upper:
            return 'B550'
        elif 'X570' in name_upper:
            return 'X570'
        else:
            return 'Unknown'
    
    def extract_wattage(self, name: str) -> int:
        """Extract wattage from PSU name"""
        import re
        match = re.search(r'(\d+)w', name.lower())
        if match:
            return int(match.group(1))
        return 0
    
    def extract_capacity(self, name: str) -> int:
        """Extract capacity in GB from product name"""
        import re
        # Look for patterns like "1TB", "500GB", "2TB", etc.
        match = re.search(r'(\d+)\s*(TB|GB)', name.upper())
        if match:
            value = int(match.group(1))
            unit = match.group(2)
            return value * 1000 if unit == 'TB' else value
        return 0
    
    def close(self):
        """Close database session"""
        self.session.close()

def main():
    """Main function to load master products"""
    loader = MasterProductLoader()
    try:
        total_loaded = loader.load_all_products()
        print(f"\nSuccessfully loaded {total_loaded} master products!")
    except Exception as e:
        print(f"Error loading master products: {e}")
    finally:
        loader.close()

if __name__ == "__main__":
    main()
