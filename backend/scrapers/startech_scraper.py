import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from typing import List, Dict, Any, Optional
import re
from urllib.parse import urljoin, urlparse
import time
import random
import json

class StarTechScraper:
    """Scraper for Star Tech BD (https://www.startech.com.bd/)"""
    
    def __init__(self):
        self.base_url = "https://www.startech.com.bd"
        self.session = None
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # Category mappings for Star Tech - trying different URL patterns
        self.categories = {
            'cpu': 'component/processor',
            'gpu': 'component/graphics-card',
            'ram': 'component/ram',
            'motherboard': 'component/motherboard',
            'psu': 'component/power-supply',
            'storage': 'component/storage',
            'case': 'component/casing',
            'cooling': 'component/cooling'
        }
        
        # Alternative category mappings if the above don't work
        self.alternative_categories = {
            'cpu': 'computer-component/processor',
            'gpu': 'computer-component/graphics-card',
            'ram': 'computer-component/ram',
            'motherboard': 'computer-component/motherboard',
            'psu': 'computer-component/power-supply',
            'storage': 'computer-component/storage',
            'case': 'computer-component/casing',
            'cooling': 'computer-component/cooling'
        }
        
        # Enhanced brand list with more specific patterns
        self.brands = [
            'AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock',
            'Corsair', 'G.Skill', 'Kingston', 'Samsung', 'Crucial', 'WD',
            'Seagate', 'EVGA', 'Cooler Master', 'Noctua', 'Thermaltake',
            'Fractal Design', 'Lian Li', 'NZXT', 'Antec', 'Silverstone',
            'HyperX', 'Logitech', 'Razer', 'SteelSeries', 'BenQ', 'AOC',
            'XFX', 'Sapphire', 'PowerColor', 'Zotac', 'PNY', 'Galax',
            'TeamGroup', 'Patriot', 'ADATA', 'Lexar', 'SanDisk'
        ]

    async def test_main_page(self) -> bool:
        """Test if we can access the main Star Tech page"""
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(self.base_url) as response:
                    if response.status == 200:
                        print(f"[SUCCESS] Successfully accessed Star Tech main page: {self.base_url}")
                        return True
                    else:
                        print(f"[ERROR] Failed to access Star Tech main page: {response.status}")
                        return False
        except Exception as e:
            print(f"[ERROR] Error accessing Star Tech main page: {e}")
            return False

    async def scrape_all_products(self) -> List[Dict[str, Any]]:
        """Scrape all products from Star Tech BD"""
        all_products = []
        
        # Test main page first
        if not await self.test_main_page():
            print("Cannot access Star Tech website. Please check the URL and try again.")
            return all_products
        
        async with aiohttp.ClientSession(headers=self.headers) as session:
            self.session = session
            
            # Scrape each category
            for category, category_path in self.categories.items():
                print(f"Scraping {category} from Star Tech BD...")
                try:
                    products = await self.scrape_category(category, category_path)
                    all_products.extend(products)
                    print(f"Found {len(products)} products in {category}")
                    
                    # Add delay between categories
                    await asyncio.sleep(random.uniform(2, 4))
                    
                except Exception as e:
                    print(f"Error scraping {category}: {e}")
                    continue
        
        print(f"Total products scraped from Star Tech BD: {len(all_products)}")
        return all_products

    async def scrape_category(self, category: str, category_path: str) -> List[Dict[str, Any]]:
        """Scrape products from a specific category with improved pagination"""
        products = []
        page = 1
        max_pages = 50  # Safety limit to prevent infinite loops
        consecutive_empty_pages = 0
        
        while page <= max_pages:
            try:
                # Construct category URL with different pagination patterns
                category_url = f"{self.base_url}/{category_path}"
                if page > 1:
                    # Try different pagination patterns
                    if '?' in category_path:
                        category_url += f"&page={page}"
                    else:
                        category_url += f"?page={page}"
                
                print(f"Scraping page {page} of {category}")
                
                async with self.session.get(category_url) as response:
                    if response.status != 200:
                        print(f"Failed to fetch {category_url}: {response.status}")
                        break
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Find product containers - Star Tech specific selectors
                    product_containers = (soup.find_all('div', class_='p-item') or
                                       soup.find_all('div', class_='product-item') or
                                       soup.find_all('div', class_='product') or
                                       soup.find_all('div', class_='item') or
                                       soup.find_all('div', class_='product-layout') or
                                       soup.find_all('div', class_='product-thumb'))
                    
                    if not product_containers:
                        print(f"No products found on page {page} of {category}")
                        consecutive_empty_pages += 1
                        if consecutive_empty_pages >= 2:  # Stop after 2 consecutive empty pages
                            print(f"Stopping after {consecutive_empty_pages} consecutive empty pages")
                            break
                        page += 1
                        continue
                    
                    consecutive_empty_pages = 0  # Reset counter
                    page_products = 0
                    
                    # Extract product information
                    for container in product_containers:
                        try:
                            product = await self.extract_product_info(container, category)
                            if product:
                                products.append(product)
                                page_products += 1
                        except Exception as e:
                            # Don't print Unicode errors, just continue
                            if 'charmap' not in str(e):
                                print(f"Error extracting product: {e}")
                            continue
                    
                    print(f"Found {page_products} products on page {page}")
                    
                    # Improved pagination detection
                    has_next_page = False
                    
                    # Look for pagination links
                    pagination_selectors = [
                        'a[class*="next"]',
                        'a[class*="page"]',
                        'a[href*="page"]',
                        '.pagination a',
                        '.pager a',
                        'a:contains("Next")',
                        'a:contains("»")',
                        'a:contains(">")'
                    ]
                    
                    for selector in pagination_selectors:
                        next_links = soup.select(selector)
                        for link in next_links:
                            href = link.get('href', '')
                            link_text = link.get_text(strip=True).lower()
                            
                            # Check if this is a next page link
                            if (('next' in link_text or '»' in link_text or '>' in link_text) or
                                ('page' in href and str(page + 1) in href) or
                                (link_text.isdigit() and int(link_text) == page + 1)):
                                has_next_page = True
                                break
                        
                        if has_next_page:
                            break
                    
                    # Also check if there are more page numbers visible
                    if not has_next_page:
                        page_numbers = soup.find_all('a', href=lambda x: x and 'page' in x)
                        for page_link in page_numbers:
                            try:
                                page_num = int(page_link.get_text(strip=True))
                                if page_num > page:
                                    has_next_page = True
                                    break
                            except ValueError:
                                continue
                    
                    if not has_next_page:
                        print(f"No more pages found for {category}")
                        break
                    
                    page += 1
                    
                    # Add delay between pages
                    await asyncio.sleep(random.uniform(1, 3))
                    
            except Exception as e:
                print(f"Error scraping page {page} of {category}: {e}")
                break
        
        print(f"Completed scraping {category}: {len(products)} total products from {page-1} pages")
        return products

    async def extract_product_info(self, container, category: str) -> Dict[str, Any]:
        """Extract product information from a product container"""
        try:
            # Product name - try multiple selectors
            name_element = (container.find('h4', class_='p-item-name') or
                          container.find('h3', class_='product-title') or
                          container.find('h4', class_='product-title') or
                          container.find('a', class_='product-title') or
                          container.find('h3') or
                          container.find('h4'))
            
            if not name_element:
                return None
            
            name = name_element.get_text(strip=True)
            
            # Product URL
            link_element = container.find('a', href=True)
            if not link_element:
                return None
            
            product_url = urljoin(self.base_url, link_element['href'])
            
            # Price - try multiple selectors
            price_element = (container.find('div', class_='p-item-price') or
                           container.find('span', class_='price') or
                           container.find('div', class_='price') or
                           container.find('span', class_='amount') or
                           container.find('div', class_='amount'))
            
            if not price_element:
                return None
            
            price_text = price_element.get_text(strip=True)
            price = self.extract_price(price_text)
            
            if price is None:
                return None
            
            # Image URL
            img_element = container.find('img')
            image_url = None
            if img_element and img_element.get('src'):
                image_url = urljoin(self.base_url, img_element['src'])
            elif img_element and img_element.get('data-src'):
                image_url = urljoin(self.base_url, img_element['data-src'])
            
            # Brand extraction with enhanced logic
            brand = self.extract_brand(name)
            
            # Availability
            availability = "in_stock"
            stock_element = (container.find('span', class_='stock-status') or
                           container.find('div', class_='stock-status') or
                           container.find('span', class_='availability') or
                           container.find('div', class_='availability'))
            
            if stock_element:
                stock_text = stock_element.get_text(strip=True).lower()
                if any(word in stock_text for word in ['out', 'unavailable', 'sold', 'stock out']):
                    availability = "out_of_stock"
            
            # Validate product name and category
            if not self.validate_product_name(name, category, brand):
                print(f"Product validation failed: {name} (Category: {category}, Brand: {brand})")
                return None
            
            # Scrape detailed product information
            details = await self.scrape_product_details(product_url, category)
            
            # Extract category-specific specifications
            specs = self.extract_category_specs(details, category)
            
            return {
                'name': name,
                'brand': brand,
                'category': category,
                'price': price,
                'currency': 'BDT',
                'availability': availability,
                'url': product_url,
                'image_url': image_url,
                'vendor': 'Star Tech BD',
                'scraped_at': time.time(),
                'specifications': specs,
                'description': details.get('description', ''),
                'raw_specs': details.get('specifications', {})
            }
            
        except Exception as e:
            # Don't print Unicode errors, just continue
            if 'charmap' not in str(e):
                print(f"Error extracting product info: {e}")
            return None

    def extract_price(self, price_text: str) -> float:
        """Extract numeric price from price text"""
        try:
            if not price_text:
                return None
                
            # Remove Bengali currency symbol (৳) and other currency symbols
            price_clean = re.sub(r'[৳$€£¥₹]', '', price_text)
            
            # Remove common text like "BDT", "Taka", "Price", etc.
            price_clean = re.sub(r'(BDT|Taka|Price|TK|tk)', '', price_clean, flags=re.IGNORECASE)
            
            # Remove extra whitespace
            price_clean = price_clean.strip()
            
            # Handle cases where there might be multiple prices (e.g., "11,200৳ (was 12,000৳)")
            # Take the first price (current price)
            if '(' in price_clean:
                price_clean = price_clean.split('(')[0].strip()
            
            # Remove commas and other non-numeric characters except decimal point
            price_clean = re.sub(r'[^\d.]', '', price_clean)
            
            if price_clean and price_clean.replace('.', '').isdigit():
                price_value = float(price_clean)
                # Sanity check: prices should be reasonable (between 100 and 1,000,000 BDT)
                if 100 <= price_value <= 1000000:
                    return price_value
                else:
                    print(f"Warning: Unusual price detected: {price_value} from '{price_text}'")
                    return None
        except Exception as e:
            print(f"Error extracting price from '{price_text}': {e}")
        return None

    def extract_brand(self, product_name: str) -> str:
        """Extract brand from product name with enhanced logic"""
        product_name_upper = product_name.upper()
        
        # Check for exact brand matches first
        for brand in self.brands:
            if brand.upper() in product_name_upper:
                return brand
        
        # Check for partial matches and common variations
        brand_variations = {
            'AMD': ['AMD', 'RADEON'],
            'NVIDIA': ['NVIDIA', 'GEFORCE', 'RTX', 'GTX'],
            'INTEL': ['INTEL', 'CORE'],
            'ASUS': ['ASUS', 'ROG', 'TUF'],
            'MSI': ['MSI', 'GAMING'],
            'GIGABYTE': ['GIGABYTE', 'AORUS'],
            'CORSAIR': ['CORSAIR', 'VENGEANCE'],
            'G.SKILL': ['G.SKILL', 'G.SKILL', 'TRIDENT'],
            'KINGSTON': ['KINGSTON', 'HYPERX'],
            'SAMSUNG': ['SAMSUNG', 'EVO', 'PRO'],
            'CRUCIAL': ['CRUCIAL', 'BALLISTIX'],
            'WD': ['WESTERN DIGITAL', 'WD'],
            'SEAGATE': ['SEAGATE', 'BARRACUDA'],
            'COOLER MASTER': ['COOLER MASTER', 'MASTERBOX'],
            'NOCTUA': ['NOCTUA'],
            'THERMALTAKE': ['THERMALTAKE', 'TOUGHPOWER'],
            'FRACTAL DESIGN': ['FRACTAL DESIGN', 'MESHIFY'],
            'LIAN LI': ['LIAN LI', 'LANCOOL'],
            'NZXT': ['NZXT', 'KRAKEN'],
            'ANTEC': ['ANTEC', 'EARTHWATTS'],
            'SILVERSTONE': ['SILVERSTONE', 'STRIDER']
        }
        
        for brand, variations in brand_variations.items():
            for variation in variations:
                if variation in product_name_upper:
                    return brand
        
        return 'Unknown'

    def validate_product_name(self, name: str, category: str, brand: str) -> bool:
        """Validate product name to ensure correct identification"""
        name_upper = name.upper()
        
        # Brand-category validation
        if brand == 'NVIDIA' and category != 'gpu':
            return False
        if brand == 'AMD' and category not in ['cpu', 'gpu']:
            return False
        if brand == 'Intel' and category != 'cpu':
            return False
        
        # Category-specific validation
        if category == 'cpu':
            # Should contain CPU-related terms
            cpu_terms = ['PROCESSOR', 'CPU', 'CORE', 'RYZEN', 'INTEL', 'THREADRIPPER']
            if not any(term in name_upper for term in cpu_terms):
                return False
            # Should not contain GPU terms
            gpu_terms = ['GRAPHICS', 'GPU', 'VIDEO', 'RTX', 'GTX', 'RADEON']
            if any(term in name_upper for term in gpu_terms):
                return False
                
        elif category == 'gpu':
            # Should contain GPU-related terms
            gpu_terms = ['GRAPHICS', 'GPU', 'VIDEO', 'RTX', 'GTX', 'RADEON', 'GEFORCE']
            if not any(term in name_upper for term in gpu_terms):
                return False
            # Should not contain CPU terms
            cpu_terms = ['PROCESSOR', 'CPU', 'CORE', 'RYZEN', 'INTEL']
            if any(term in name_upper for term in cpu_terms):
                return False
        
        # Model number validation for common misidentifications
        if '7700' in name_upper:
            if category == 'cpu' and 'XT' in name_upper:
                return False  # 7700XT is a GPU, not CPU
            if category == 'gpu' and 'X' in name_upper and 'XT' not in name_upper:
                return False  # 7700X is a CPU, not GPU
        
        return True

    async def scrape_product_details(self, product_url: str, category: str) -> Dict[str, Any]:
        """Scrape detailed product information from product page"""
        try:
            async with self.session.get(product_url) as response:
                if response.status != 200:
                    return {}
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                details = {}
                
                # Extract specifications - try multiple selectors
                spec_table = (soup.find('table', class_='table') or
                            soup.find('table', class_='specifications') or
                            soup.find('table', class_='specs') or
                            soup.find('div', class_='specifications') or
                            soup.find('div', class_='product-specs'))
                
                if spec_table:
                    specs = {}
                    if spec_table.name == 'table':
                        rows = spec_table.find_all('tr')
                        for row in rows:
                            cells = row.find_all(['td', 'th'])
                            if len(cells) == 2:
                                key = cells[0].get_text(strip=True)
                                value = cells[1].get_text(strip=True)
                                specs[key] = value
                    else:
                        # Handle div-based specifications
                        spec_items = spec_table.find_all(['div', 'p', 'li'])
                        for item in spec_items:
                            text = item.get_text(strip=True)
                            if ':' in text:
                                key, value = text.split(':', 1)
                                specs[key.strip()] = value.strip()
                    
                    details['specifications'] = specs
                
                # Extract description
                description_element = (soup.find('div', class_='product-description') or
                                    soup.find('div', class_='description') or
                                    soup.find('div', class_='product-details') or
                                    soup.find('div', class_='product-info'))
                
                if description_element:
                    details['description'] = description_element.get_text(strip=True)
                
                return details
                
        except Exception as e:
            print(f"Error scraping product details from {product_url}: {e}")
            return {}

    def extract_category_specs(self, details: Dict[str, Any], category: str) -> Dict[str, Any]:
        """Extract category-specific specifications"""
        specs = details.get('specifications', {})
        
        if category == 'cpu':
            return self.extract_cpu_specs(specs)
        elif category == 'gpu':
            return self.extract_gpu_specs(specs)
        elif category == 'ram':
            return self.extract_ram_specs(specs)
        elif category == 'motherboard':
            return self.extract_motherboard_specs(specs)
        elif category == 'psu':
            return self.extract_psu_specs(specs)
        elif category == 'storage':
            return self.extract_storage_specs(specs)
        elif category == 'case':
            return self.extract_case_specs(specs)
        else:
            return {}

    def extract_cpu_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract CPU specifications"""
        cpu_specs = {}
        
        # Socket type
        socket_keys = ['socket', 'socket type', 'cpu socket', 'processor socket']
        for key in socket_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cpu_specs['socket_type'] = self._get_value_by_key(specs, key)
                break
        
        # TDP
        tdp_keys = ['tdp', 'thermal design power', 'power consumption', 'max tdp']
        for key in tdp_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                tdp_value = self._extract_number(self._get_value_by_key(specs, key))
                if tdp_value:
                    cpu_specs['tdp_watts'] = tdp_value
                break
        
        # Core count
        core_keys = ['cores', 'core count', 'number of cores', 'cpu cores']
        for key in core_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                core_value = self._extract_number(self._get_value_by_key(specs, key))
                if core_value:
                    cpu_specs['core_count'] = core_value
                break
        
        # Thread count
        thread_keys = ['threads', 'thread count', 'number of threads', 'cpu threads']
        for key in thread_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                thread_value = self._extract_number(self._get_value_by_key(specs, key))
                if thread_value:
                    cpu_specs['thread_count'] = thread_value
                break
        
        # Base clock
        base_clock_keys = ['base clock', 'base frequency', 'cpu base clock', 'processor base clock']
        for key in base_clock_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                clock_value = self._extract_clock(self._get_value_by_key(specs, key))
                if clock_value:
                    cpu_specs['base_clock'] = clock_value
                break
        
        # Boost clock
        boost_clock_keys = ['boost clock', 'max boost clock', 'turbo boost', 'max frequency']
        for key in boost_clock_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                clock_value = self._extract_clock(self._get_value_by_key(specs, key))
                if clock_value:
                    cpu_specs['boost_clock'] = clock_value
                break
        
        # L3 Cache
        cache_keys = ['l3 cache', 'cache', 'cpu cache', 'processor cache']
        for key in cache_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cache_value = self._extract_cache(self._get_value_by_key(specs, key))
                if cache_value:
                    cpu_specs['cache_l3'] = cache_value
                break
        
        # Integrated Graphics
        igpu_keys = ['integrated graphics', 'igpu', 'built-in graphics', 'onboard graphics']
        for key in igpu_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cpu_specs['integrated_graphics'] = self._get_value_by_key(specs, key)
                break
        
        return cpu_specs

    def extract_gpu_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract GPU specifications"""
        gpu_specs = {}
        
        # Memory size
        memory_keys = ['memory', 'vram', 'video memory', 'gpu memory', 'memory size']
        for key in memory_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                memory_value = self._extract_memory_size(self._get_value_by_key(specs, key))
                if memory_value:
                    gpu_specs['memory_size'] = memory_value
                break
        
        # Memory type
        memory_type_keys = ['memory type', 'vram type', 'memory technology', 'gpu memory type']
        for key in memory_type_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                gpu_specs['memory_type'] = self._get_value_by_key(specs, key)
                break
        
        # Base clock
        base_clock_keys = ['base clock', 'gpu base clock', 'core clock', 'base frequency']
        for key in base_clock_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                clock_value = self._extract_clock(self._get_value_by_key(specs, key))
                if clock_value:
                    gpu_specs['base_clock'] = clock_value
                break
        
        # Boost clock
        boost_clock_keys = ['boost clock', 'gpu boost clock', 'boost frequency', 'max boost clock']
        for key in boost_clock_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                clock_value = self._extract_clock(self._get_value_by_key(specs, key))
                if clock_value:
                    gpu_specs['boost_clock'] = clock_value
                break
        
        # TDP
        tdp_keys = ['tdp', 'thermal design power', 'power consumption', 'max power']
        for key in tdp_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                tdp_value = self._extract_number(self._get_value_by_key(specs, key))
                if tdp_value:
                    gpu_specs['tdp_watts'] = tdp_value
                break
        
        # Memory bus width
        bus_keys = ['memory bus', 'bus width', 'memory bus width', 'memory interface']
        for key in bus_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                bus_value = self._extract_number(self._get_value_by_key(specs, key))
                if bus_value:
                    gpu_specs['memory_bus_width'] = bus_value
                break
        
        # CUDA cores
        cuda_keys = ['cuda cores', 'cuda', 'stream processors', 'shader units']
        for key in cuda_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cuda_value = self._extract_number(self._get_value_by_key(specs, key))
                if cuda_value:
                    gpu_specs['cuda_cores'] = cuda_value
                break
        
        return gpu_specs

    def extract_ram_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract RAM specifications"""
        ram_specs = {}
        
        # Capacity
        capacity_keys = ['capacity', 'memory size', 'ram size', 'memory capacity']
        for key in capacity_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                capacity_value = self._extract_memory_size(self._get_value_by_key(specs, key))
                if capacity_value:
                    ram_specs['capacity'] = capacity_value
                break
        
        # Speed
        speed_keys = ['speed', 'frequency', 'mhz', 'memory speed', 'ram speed']
        for key in speed_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                speed_value = self._extract_number(self._get_value_by_key(specs, key))
                if speed_value:
                    ram_specs['speed'] = speed_value
                break
        
        # Type
        type_keys = ['type', 'memory type', 'ddr type', 'ram type']
        for key in type_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                ram_specs['type'] = self._get_value_by_key(specs, key)
                break
        
        # CAS Latency
        cas_keys = ['cas latency', 'cl', 'cas', 'latency']
        for key in cas_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cas_value = self._extract_number(self._get_value_by_key(specs, key))
                if cas_value:
                    ram_specs['cas_latency'] = cas_value
                break
        
        # Voltage
        voltage_keys = ['voltage', 'v', 'memory voltage', 'ram voltage']
        for key in voltage_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                voltage_value = self._extract_voltage(self._get_value_by_key(specs, key))
                if voltage_value:
                    ram_specs['voltage'] = voltage_value
                break
        
        # Form factor
        form_factor_keys = ['form factor', 'size', 'dimensions']
        for key in form_factor_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                ram_specs['form_factor'] = self._get_value_by_key(specs, key)
                break
        
        return ram_specs

    def extract_motherboard_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract Motherboard specifications"""
        mobo_specs = {}
        
        # Socket type
        socket_keys = ['socket', 'cpu socket', 'processor socket', 'socket type']
        for key in socket_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                mobo_specs['socket_type'] = self._get_value_by_key(specs, key)
                break
        
        # Chipset
        chipset_keys = ['chipset', 'chipset type', 'platform']
        for key in chipset_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                mobo_specs['chipset'] = self._get_value_by_key(specs, key)
                break
        
        # Form factor
        form_factor_keys = ['form factor', 'size', 'dimensions', 'form factor size']
        for key in form_factor_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                mobo_specs['form_factor'] = self._get_value_by_key(specs, key)
                break
        
        # Memory slots
        memory_slots_keys = ['memory slots', 'ram slots', 'dimm slots', 'memory channels']
        for key in memory_slots_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                slots_value = self._extract_number(self._get_value_by_key(specs, key))
                if slots_value:
                    mobo_specs['memory_slots'] = slots_value
                break
        
        # Memory type
        memory_type_keys = ['memory type', 'ram type', 'ddr type', 'supported memory']
        for key in memory_type_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                mobo_specs['memory_type'] = self._get_value_by_key(specs, key)
                break
        
        # Max memory
        max_memory_keys = ['max memory', 'maximum memory', 'max ram', 'memory capacity']
        for key in max_memory_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                max_mem_value = self._extract_memory_size(self._get_value_by_key(specs, key))
                if max_mem_value:
                    mobo_specs['max_memory'] = max_mem_value
                break
        
        # PCIe slots
        pcie_keys = ['pcie slots', 'pci express slots', 'expansion slots', 'pcie']
        for key in pcie_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                pcie_value = self._extract_number(self._get_value_by_key(specs, key))
                if pcie_value:
                    mobo_specs['pcie_slots'] = pcie_value
                break
        
        # SATA ports
        sata_keys = ['sata ports', 'sata connectors', 'sata', 'sata 6gb']
        for key in sata_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                sata_value = self._extract_number(self._get_value_by_key(specs, key))
                if sata_value:
                    mobo_specs['sata_ports'] = sata_value
                break
        
        # M.2 slots
        m2_keys = ['m.2 slots', 'm2 slots', 'm.2', 'nvme slots']
        for key in m2_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                m2_value = self._extract_number(self._get_value_by_key(specs, key))
                if m2_value:
                    mobo_specs['m2_slots'] = m2_value
                break
        
        # USB ports
        usb_keys = ['usb ports', 'usb connectors', 'usb', 'usb headers']
        for key in usb_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                usb_value = self._extract_number(self._get_value_by_key(specs, key))
                if usb_value:
                    mobo_specs['usb_ports'] = usb_value
                break
        
        return mobo_specs

    def extract_psu_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract PSU specifications"""
        psu_specs = {}
        
        # Wattage
        wattage_keys = ['wattage', 'power', 'w', 'watts', 'power output']
        for key in wattage_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                wattage_value = self._extract_number(self._get_value_by_key(specs, key))
                if wattage_value:
                    psu_specs['wattage'] = wattage_value
                break
        
        # Efficiency
        efficiency_keys = ['efficiency', '80 plus', '80+', 'efficiency rating']
        for key in efficiency_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                psu_specs['efficiency'] = self._get_value_by_key(specs, key)
                break
        
        # Modularity
        modularity_keys = ['modularity', 'modular', 'cable management', 'cable type']
        for key in modularity_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                psu_specs['modularity'] = self._get_value_by_key(specs, key)
                break
        
        # Form factor
        form_factor_keys = ['form factor', 'size', 'dimensions', 'psu size']
        for key in form_factor_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                psu_specs['form_factor'] = self._get_value_by_key(specs, key)
                break
        
        # PCIe connectors
        pcie_keys = ['pcie connectors', 'pci express', '6+2 pin', '8 pin pcie']
        for key in pcie_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                pcie_value = self._extract_number(self._get_value_by_key(specs, key))
                if pcie_value:
                    psu_specs['pcie_connectors'] = pcie_value
                break
        
        # SATA connectors
        sata_keys = ['sata connectors', 'sata power', 'sata cables']
        for key in sata_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                sata_value = self._extract_number(self._get_value_by_key(specs, key))
                if sata_value:
                    psu_specs['sata_connectors'] = sata_value
                break
        
        # Molex connectors
        molex_keys = ['molex connectors', '4 pin molex', 'peripheral connectors']
        for key in molex_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                molex_value = self._extract_number(self._get_value_by_key(specs, key))
                if molex_value:
                    psu_specs['molex_connectors'] = molex_value
                break
        
        return psu_specs

    def extract_storage_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract Storage specifications (SSD/HDD)"""
        storage_specs = {}
        
        # Capacity
        capacity_keys = ['capacity', 'storage size', 'size', 'memory size']
        for key in capacity_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                capacity_value = self._extract_storage_capacity(self._get_value_by_key(specs, key))
                if capacity_value:
                    storage_specs['capacity'] = capacity_value
                break
        
        # Interface
        interface_keys = ['interface', 'connection', 'connector', 'interface type']
        for key in interface_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                storage_specs['interface'] = self._get_value_by_key(specs, key)
                break
        
        # Form factor
        form_factor_keys = ['form factor', 'size', 'dimensions', 'drive size']
        for key in form_factor_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                storage_specs['form_factor'] = self._get_value_by_key(specs, key)
                break
        
        # Read speed (SSD)
        read_speed_keys = ['read speed', 'sequential read', 'read performance', 'max read']
        for key in read_speed_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                read_value = self._extract_number(self._get_value_by_key(specs, key))
                if read_value:
                    storage_specs['read_speed'] = read_value
                break
        
        # Write speed (SSD)
        write_speed_keys = ['write speed', 'sequential write', 'write performance', 'max write']
        for key in write_speed_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                write_value = self._extract_number(self._get_value_by_key(specs, key))
                if write_value:
                    storage_specs['write_speed'] = write_value
                break
        
        # TBW (SSD)
        tbw_keys = ['tbw', 'total bytes written', 'endurance', 'write endurance']
        for key in tbw_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                tbw_value = self._extract_number(self._get_value_by_key(specs, key))
                if tbw_value:
                    storage_specs['tbw'] = tbw_value
                break
        
        # RPM (HDD)
        rpm_keys = ['rpm', 'rotations per minute', 'spindle speed']
        for key in rpm_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                rpm_value = self._extract_number(self._get_value_by_key(specs, key))
                if rpm_value:
                    storage_specs['rpm'] = rpm_value
                break
        
        # Cache (HDD)
        cache_keys = ['cache', 'buffer', 'cache size', 'buffer size']
        for key in cache_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cache_value = self._extract_number(self._get_value_by_key(specs, key))
                if cache_value:
                    storage_specs['cache'] = cache_value
                break
        
        return storage_specs

    def extract_case_specs(self, specs: Dict[str, str]) -> Dict[str, Any]:
        """Extract Case specifications"""
        case_specs = {}
        
        # Form factor
        form_factor_keys = ['form factor', 'size', 'dimensions', 'case size', 'chassis size']
        for key in form_factor_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                case_specs['form_factor'] = self._get_value_by_key(specs, key)
                break
        
        # Max GPU length
        gpu_length_keys = ['max gpu length', 'gpu clearance', 'video card length', 'gpu support']
        for key in gpu_length_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                gpu_length_value = self._extract_number(self._get_value_by_key(specs, key))
                if gpu_length_value:
                    case_specs['max_gpu_length'] = gpu_length_value
                break
        
        # Max CPU height
        cpu_height_keys = ['max cpu height', 'cpu cooler height', 'cpu clearance', 'cooler support']
        for key in cpu_height_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                cpu_height_value = self._extract_number(self._get_value_by_key(specs, key))
                if cpu_height_value:
                    case_specs['max_cpu_height'] = cpu_height_value
                break
        
        # Drive bays
        drive_bay_keys = ['drive bays', 'storage bays', 'hdd bays', 'ssd bays']
        for key in drive_bay_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                bay_value = self._extract_number(self._get_value_by_key(specs, key))
                if bay_value:
                    case_specs['drive_bays'] = bay_value
                break
        
        # Fan mounts
        fan_keys = ['fan mounts', 'fan support', 'fans', 'fan slots']
        for key in fan_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                fan_value = self._extract_number(self._get_value_by_key(specs, key))
                if fan_value:
                    case_specs['fan_mounts'] = fan_value
                break
        
        # USB ports
        usb_keys = ['usb ports', 'usb connectors', 'front usb', 'usb']
        for key in usb_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                usb_value = self._extract_number(self._get_value_by_key(specs, key))
                if usb_value:
                    case_specs['usb_ports'] = usb_value
                break
        
        # RGB support
        rgb_keys = ['rgb', 'led', 'lighting', 'rgb support', 'led support']
        for key in rgb_keys:
            if key.lower() in [k.lower() for k in specs.keys()]:
                rgb_text = self._get_value_by_key(specs, key).lower()
                case_specs['rgb_support'] = any(word in rgb_text for word in ['yes', 'true', 'support', 'rgb', 'led'])
                break
        
        return case_specs

    # Helper methods for data extraction
    def _get_value_by_key(self, specs: Dict[str, str], key: str) -> str:
        """Get value by case-insensitive key matching"""
        for k, v in specs.items():
            if k.lower() == key.lower():
                return v
        return ""

    def _extract_number(self, text: str) -> Optional[int]:
        """Extract number from text"""
        if not text:
            return None
        numbers = re.findall(r'\d+', text)
        return int(numbers[0]) if numbers else None

    def _extract_clock(self, text: str) -> Optional[float]:
        """Extract clock frequency from text"""
        if not text:
            return None
        # Look for GHz or MHz patterns
        ghz_match = re.search(r'(\d+\.?\d*)\s*ghz', text, re.IGNORECASE)
        if ghz_match:
            return float(ghz_match.group(1))
        
        mhz_match = re.search(r'(\d+\.?\d*)\s*mhz', text, re.IGNORECASE)
        if mhz_match:
            return float(mhz_match.group(1)) / 1000  # Convert MHz to GHz
        
        return None

    def _extract_memory_size(self, text: str) -> Optional[int]:
        """Extract memory size in MB"""
        if not text:
            return None
        
        # Look for GB patterns
        gb_match = re.search(r'(\d+)\s*gb', text, re.IGNORECASE)
        if gb_match:
            return int(gb_match.group(1)) * 1024  # Convert GB to MB
        
        # Look for MB patterns
        mb_match = re.search(r'(\d+)\s*mb', text, re.IGNORECASE)
        if mb_match:
            return int(mb_match.group(1))
        
        return None

    def _extract_storage_capacity(self, text: str) -> Optional[int]:
        """Extract storage capacity in GB"""
        if not text:
            return None
        
        # Look for TB patterns
        tb_match = re.search(r'(\d+)\s*tb', text, re.IGNORECASE)
        if tb_match:
            return int(tb_match.group(1)) * 1024  # Convert TB to GB
        
        # Look for GB patterns
        gb_match = re.search(r'(\d+)\s*gb', text, re.IGNORECASE)
        if gb_match:
            return int(gb_match.group(1))
        
        return None

    def _extract_cache(self, text: str) -> Optional[int]:
        """Extract cache size in MB"""
        if not text:
            return None
        
        # Look for MB patterns
        mb_match = re.search(r'(\d+)\s*mb', text, re.IGNORECASE)
        if mb_match:
            return int(mb_match.group(1))
        
        # Look for KB patterns
        kb_match = re.search(r'(\d+)\s*kb', text, re.IGNORECASE)
        if kb_match:
            return int(kb_match.group(1)) // 1024  # Convert KB to MB
        
        return None

    def _extract_voltage(self, text: str) -> Optional[float]:
        """Extract voltage from text"""
        if not text:
            return None
        
        voltage_match = re.search(r'(\d+\.?\d*)\s*v', text, re.IGNORECASE)
        if voltage_match:
            return float(voltage_match.group(1))
        
        return None

# Example usage
async def main():
    scraper = StarTechScraper()
    products = await scraper.scrape_all_products()
    
    print(f"Scraped {len(products)} products")
    for product in products[:5]:  # Show first 5 products
        print(f"- {product['name']} - ৳{product['price']}")
        if product['specifications']:
            print(f"  Specs: {product['specifications']}")

if __name__ == "__main__":
    asyncio.run(main())
