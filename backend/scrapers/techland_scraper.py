import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from typing import List, Dict, Any
import re
from urllib.parse import urljoin, urlparse
import time
import random

class TechLandScraper:
    """Scraper for TechLand BD (https://www.techlandbd.com/)"""
    
    def __init__(self):
        self.base_url = "https://www.techlandbd.com"
        self.session = None
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # Category mappings - updated with correct Techland URLs
        self.categories = {
            'cpu': 'pc-components/processor',
            'gpu': 'pc-components/graphics-card',
            'ram': 'pc-components/shop-desktop-ram',
            'motherboard': 'pc-components/motherboard',
            'psu': 'pc-components/power-supply',
            'storage': 'pc-components/solid-state-drive',
            'case': 'pc-components/computer-case',
            'cooling': 'pc-components/cpu-cooler'
        }

    async def scrape_all_products(self) -> List[Dict[str, Any]]:
        """Scrape all products from TechLand BD"""
        all_products = []
        
        async with aiohttp.ClientSession(headers=self.headers) as session:
            self.session = session
            
            # Scrape each category
            for category, category_path in self.categories.items():
                print(f"Scraping {category} from TechLand BD...")
                try:
                    products = await self.scrape_category(category, category_path)
                    all_products.extend(products)
                    print(f"Found {len(products)} products in {category}")
                    
                    # Add delay between categories
                    await asyncio.sleep(random.uniform(2, 4))
                    
                except Exception as e:
                    print(f"Error scraping {category}: {e}")
                    continue
        
        print(f"Total products scraped from TechLand BD: {len(all_products)}")
        return all_products

    async def scrape_category(self, category: str, category_path: str) -> List[Dict[str, Any]]:
        """Scrape products from a specific category"""
        products = []
        page = 1
        max_pages = 50  # Safety limit
        consecutive_empty_pages = 0
        
        while page <= max_pages:
            try:
                # Construct category URL
                category_url = f"{self.base_url}/{category_path}"
                if page > 1:
                    category_url += f"?page={page}"
                
                print(f"Scraping page {page} of {category}")
                
                async with self.session.get(category_url) as response:
                    if response.status != 200:
                        print(f"Failed to fetch {category_url}: {response.status}")
                        break
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Find product containers - updated for new HTML structure
                    product_containers = soup.find_all('article', class_='products-list__item')
                    
                    if not product_containers:
                        print(f"No products found on page {page} of {category}")
                        consecutive_empty_pages += 1
                        if consecutive_empty_pages >= 3:
                            print(f"Stopping after {consecutive_empty_pages} consecutive empty pages")
                            break
                        page += 1
                        continue
                    
                    consecutive_empty_pages = 0
                    print(f"Found {len(product_containers)} products on page {page}")
                    
                    # Extract product information
                    for container in product_containers:
                        try:
                            product = await self.extract_product_info(container, category)
                            if product:
                                products.append(product)
                        except Exception as e:
                            print(f"Error extracting product: {e}")
                            continue
                    
                    # Check if there's a next page - look for pagination
                    has_next_page = False
                    pagination = soup.find('nav', class_='pagination') or soup.find('div', class_='pagination')
                    if pagination:
                        next_links = pagination.find_all('a', href=True)
                        for link in next_links:
                            if 'next' in link.get_text(strip=True).lower() or '>' in link.get_text(strip=True):
                                has_next_page = True
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
            # Product name - updated for new HTML structure
            name_element = (container.find('p', class_='text-sm font-semibold text-gray-800') or
                          container.find('a', class_='focus-enhanced') or
                          container.find('a', href=True))
            
            if not name_element:
                return None
            
            name = name_element.get_text(strip=True)
            
            # Product URL
            link_element = container.find('a', href=True)
            if not link_element:
                return None
            
            product_url = urljoin(self.base_url, link_element['href'])
            
            # Price - updated for new HTML structure
            price_element = container.find('span', class_='text-base font-bold text-gray-800')
            if not price_element:
                return None
            
            price_text = price_element.get_text(strip=True)
            price = self.extract_price(price_text)
            
            if price is None:
                return None
            
            # Image URL - updated for new HTML structure
            img_element = container.find('img', class_='product-image-optimized')
            image_url = None
            if img_element and img_element.get('src'):
                image_url = urljoin(self.base_url, img_element['src'])
            elif img_element and img_element.get('data-src'):
                image_url = urljoin(self.base_url, img_element['data-src'])
            
            # Brand extraction
            brand = self.extract_brand(name)
            
            # Availability - updated for new HTML structure
            availability = "in_stock"
            stock_element = container.find('p', class_='text-xs text-green-700 font-medium')
            if stock_element:
                stock_text = stock_element.get_text(strip=True).lower()
                if 'out' in stock_text or 'unavailable' in stock_text or 'not' in stock_text:
                    availability = "out_of_stock"
            
            # Extract specifications from product name for basic specs
            specs = self.extract_specs_from_name(name, category)
            
            return {
                'name': name,
                'brand': brand,
                'category': category,
                'price': price,
                'currency': 'BDT',
                'availability': availability,
                'url': product_url,
                'image_url': image_url,
                'vendor': 'TechLand BD',
                'scraped_at': time.time(),
                'specs': specs
            }
            
        except Exception as e:
            print(f"Error extracting product info: {e}")
            return None

    def extract_price(self, price_text: str) -> float:
        """Extract numeric price from price text"""
        try:
            # Remove currency symbols, commas, and extra text
            price_clean = re.sub(r'[^\d.]', '', price_text)
            if price_clean:
                price = float(price_clean)
                # Sanity check for reasonable price range
                if 100 <= price <= 1000000:  # 100 BDT to 1M BDT
                    return price
        except:
            pass
        return None

    def extract_brand(self, product_name: str) -> str:
        """Extract brand from product name"""
        # Common PC component brands
        brands = [
            'AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock',
            'Corsair', 'G.Skill', 'Kingston', 'Samsung', 'Crucial', 'WD',
            'Seagate', 'EVGA', 'Cooler Master', 'Noctua', 'Thermaltake',
            'Fractal Design', 'Lian Li', 'NZXT', 'Antec', 'Silverstone'
        ]
        
        product_name_upper = product_name.upper()
        for brand in brands:
            if brand.upper() in product_name_upper:
                return brand
        
        return 'Unknown'

    def extract_specs_from_name(self, product_name: str, category: str) -> Dict[str, Any]:
        """Extract basic specifications from product name"""
        specs = {}
        name_upper = product_name.upper()
        
        if category == 'cpu':
            # Extract core count
            core_match = re.search(r'(\d+)\s*CORE', name_upper)
            if core_match:
                specs['cores'] = int(core_match.group(1))
            
            # Extract thread count
            thread_match = re.search(r'(\d+)\s*THREAD', name_upper)
            if thread_match:
                specs['threads'] = int(thread_match.group(1))
            
            # Extract base clock
            clock_match = re.search(r'(\d+\.?\d*)\s*GHZ', name_upper)
            if clock_match:
                specs['base_clock'] = float(clock_match.group(1))
        
        elif category == 'gpu':
            # Extract memory
            memory_match = re.search(r'(\d+)\s*GB', name_upper)
            if memory_match:
                specs['memory'] = int(memory_match.group(1))
            
            # Extract memory type
            if 'GDDR6' in name_upper:
                specs['memory_type'] = 'GDDR6'
            elif 'GDDR5' in name_upper:
                specs['memory_type'] = 'GDDR5'
            elif 'GDDR7' in name_upper:
                specs['memory_type'] = 'GDDR7'
        
        elif category == 'ram':
            # Extract capacity
            capacity_match = re.search(r'(\d+)\s*GB', name_upper)
            if capacity_match:
                specs['capacity'] = int(capacity_match.group(1))
            
            # Extract speed
            speed_match = re.search(r'(\d+)\s*MHZ', name_upper)
            if speed_match:
                specs['speed'] = int(speed_match.group(1))
            
            # Extract DDR type
            if 'DDR5' in name_upper:
                specs['type'] = 'DDR5'
            elif 'DDR4' in name_upper:
                specs['type'] = 'DDR4'
        
        elif category == 'storage':
            # Extract capacity
            capacity_match = re.search(r'(\d+)\s*GB', name_upper)
            if capacity_match:
                specs['capacity'] = int(capacity_match.group(1))
            elif 'TB' in name_upper:
                tb_match = re.search(r'(\d+)\s*TB', name_upper)
                if tb_match:
                    specs['capacity'] = int(tb_match.group(1)) * 1024  # Convert TB to GB
            
            # Extract type
            if 'SSD' in name_upper:
                specs['type'] = 'SSD'
            elif 'HDD' in name_upper:
                specs['type'] = 'HDD'
        
        return specs

    async def scrape_product_details(self, product_url: str) -> Dict[str, Any]:
        """Scrape detailed product information from product page"""
        try:
            async with self.session.get(product_url) as response:
                if response.status != 200:
                    return {}
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                details = {}
                
                # Extract specifications
                spec_table = soup.find('table', class_='specifications')
                if spec_table:
                    specs = {}
                    rows = spec_table.find_all('tr')
                    for row in rows:
                        cells = row.find_all('td')
                        if len(cells) == 2:
                            key = cells[0].get_text(strip=True)
                            value = cells[1].get_text(strip=True)
                            specs[key] = value
                    details['specifications'] = specs
                
                # Extract description
                description_element = soup.find('div', class_='product-description')
                if description_element:
                    details['description'] = description_element.get_text(strip=True)
                
                return details
                
        except Exception as e:
            print(f"Error scraping product details from {product_url}: {e}")
            return {}

# Example usage
async def main():
    scraper = TechLandScraper()
    products = await scraper.scrape_all_products()
    
    print(f"Scraped {len(products)} products")
    for product in products[:5]:  # Show first 5 products
        print(f"- {product['name']} - ৳{product['price']}")

if __name__ == "__main__":
    asyncio.run(main())
