import requests
from bs4 import BeautifulSoup
import asyncio
import aiohttp
from typing import List, Dict, Any
import re
from urllib.parse import urljoin, urlparse
import time
import random

class SkylandScraper:
    """Scraper for Skyland Computer BD (https://www.skyland.com.bd/)"""
    
    def __init__(self):
        self.base_url = "https://www.skyland.com.bd"
        self.session = None
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        }
        
        # Category mappings for Skyland
        self.categories = {
            'cpu': 'processor',
            'gpu': 'graphics-card',
            'ram': 'ram',
            'motherboard': 'motherboard',
            'psu': 'power-supply',
            'storage': 'storage',
            'case': 'casing',
            'cooling': 'cooling'
        }

    async def scrape_all_products(self) -> List[Dict[str, Any]]:
        """Scrape all products from Skyland Computer BD"""
        all_products = []
        
        async with aiohttp.ClientSession(headers=self.headers) as session:
            self.session = session
            
            # Scrape each category
            for category, category_path in self.categories.items():
                print(f"Scraping {category} from Skyland Computer BD...")
                try:
                    products = await self.scrape_category(category, category_path)
                    all_products.extend(products)
                    print(f"Found {len(products)} products in {category}")
                    
                    # Add delay between categories
                    await asyncio.sleep(random.uniform(2, 4))
                    
                except Exception as e:
                    print(f"Error scraping {category}: {e}")
                    continue
        
        print(f"Total products scraped from Skyland Computer BD: {len(all_products)}")
        return all_products

    async def scrape_category(self, category: str, category_path: str) -> List[Dict[str, Any]]:
        """Scrape products from a specific category"""
        products = []
        page = 1
        
        while True:
            try:
                # Construct category URL
                category_url = f"{self.base_url}/category/{category_path}"
                if page > 1:
                    category_url += f"?page={page}"
                
                print(f"Scraping page {page} of {category}")
                
                async with self.session.get(category_url) as response:
                    if response.status != 200:
                        print(f"Failed to fetch {category_url}: {response.status}")
                        break
                    
                    html = await response.text()
                    soup = BeautifulSoup(html, 'html.parser')
                    
                    # Find product containers - Skyland uses different class names
                    product_containers = soup.find_all('div', class_='product-item') or \
                                       soup.find_all('div', class_='product') or \
                                       soup.find_all('div', class_='item')
                    
                    if not product_containers:
                        print(f"No products found on page {page} of {category}")
                        break
                    
                    # Extract product information
                    for container in product_containers:
                        try:
                            product = await self.extract_product_info(container, category)
                            if product:
                                products.append(product)
                        except Exception as e:
                            print(f"Error extracting product: {e}")
                            continue
                    
                    # Check if there's a next page
                    next_page = soup.find('a', class_='next') or soup.find('a', string='Next')
                    if not next_page:
                        break
                    
                    page += 1
                    
                    # Add delay between pages
                    await asyncio.sleep(random.uniform(1, 2))
                    
            except Exception as e:
                print(f"Error scraping page {page} of {category}: {e}")
                break
        
        return products

    async def extract_product_info(self, container, category: str) -> Dict[str, Any]:
        """Extract product information from a product container"""
        try:
            # Product name - try multiple selectors
            name_element = (container.find('h3', class_='product-title') or 
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
            price_element = (container.find('span', class_='price') or 
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
            
            # Brand extraction
            brand = self.extract_brand(name)
            
            # Availability
            availability = "in_stock"
            stock_element = (container.find('span', class_='stock-status') or
                           container.find('div', class_='stock-status') or
                           container.find('span', class_='availability'))
            
            if stock_element:
                stock_text = stock_element.get_text(strip=True).lower()
                if 'out' in stock_text or 'unavailable' in stock_text or 'sold' in stock_text:
                    availability = "out_of_stock"
            
            return {
                'name': name,
                'brand': brand,
                'category': category,
                'price': price,
                'currency': 'BDT',
                'availability': availability,
                'url': product_url,
                'image_url': image_url,
                'vendor': 'Skyland Computer BD',
                'scraped_at': time.time()
            }
            
        except Exception as e:
            print(f"Error extracting product info: {e}")
            return None

    def extract_price(self, price_text: str) -> float:
        """Extract numeric price from price text"""
        try:
            # Remove currency symbols and commas
            price_clean = re.sub(r'[^\d.]', '', price_text)
            if price_clean:
                return float(price_clean)
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
            'Fractal Design', 'Lian Li', 'NZXT', 'Antec', 'Silverstone',
            'HyperX', 'Logitech', 'Razer', 'SteelSeries', 'BenQ', 'AOC'
        ]
        
        product_name_upper = product_name.upper()
        for brand in brands:
            if brand.upper() in product_name_upper:
                return brand
        
        return 'Unknown'

    async def scrape_product_details(self, product_url: str) -> Dict[str, Any]:
        """Scrape detailed product information from product page"""
        try:
            async with self.session.get(product_url) as response:
                if response.status != 200:
                    return {}
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                details = {}
                
                # Extract specifications - try multiple selectors
                spec_table = (soup.find('table', class_='specifications') or
                            soup.find('table', class_='specs') or
                            soup.find('div', class_='specifications'))
                
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
                        spec_items = spec_table.find_all(['div', 'p'])
                        for item in spec_items:
                            text = item.get_text(strip=True)
                            if ':' in text:
                                key, value = text.split(':', 1)
                                specs[key.strip()] = value.strip()
                    
                    details['specifications'] = specs
                
                # Extract description
                description_element = (soup.find('div', class_='product-description') or
                                    soup.find('div', class_='description') or
                                    soup.find('div', class_='product-details'))
                
                if description_element:
                    details['description'] = description_element.get_text(strip=True)
                
                return details
                
        except Exception as e:
            print(f"Error scraping product details from {product_url}: {e}")
            return {}

# Example usage
async def main():
    scraper = SkylandScraper()
    products = await scraper.scrape_all_products()
    
    print(f"Scraped {len(products)} products")
    for product in products[:5]:  # Show first 5 products
        print(f"- {product['name']} - ৳{product['price']}")

if __name__ == "__main__":
    asyncio.run(main())
