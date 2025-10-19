#!/usr/bin/env python3
"""
One-off StarTech raw scraper: collects raw name, price, url, image per category.
No reconciliation, no fuzzy matching, minimal processing, no description/spec scrape.
Stores into raw_vendor_products with (vendor_name, product_url) de-dup at insert time.
"""

import asyncio
import os
import sys
from collections import defaultdict
from datetime import datetime

# Ensure backend package is importable
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from scrapers.startech_scraper import StarTechScraper
from database import SessionLocal, engine
from models import Base, RawVendorProduct


async def scrape_startech_raw():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    scraper = StarTechScraper()

    # We will reuse category traversal but skip details/specs by short-circuiting
    # via a lightweight extraction that only reads from the list page container.

    all_raw = []

    # Monkey-patch: wrap extract_product_info to avoid product page fetch and validation
    async def extract_raw(container, category: str):
        try:
            # Name
            name_element = (container.find('h4', class_='p-item-name') or
                            container.find('h3', class_='product-title') or
                            container.find('h4', class_='product-title') or
                            container.find('a', class_='product-title') or
                            container.find('h3') or
                            container.find('h4'))
            if not name_element:
                return None
            raw_name = name_element.get_text(strip=True)

            # URL
            link = container.find('a', href=True)
            if not link:
                return None
            from urllib.parse import urljoin
            product_url = urljoin(scraper.base_url, link['href'])

            # Price
            price_element = (container.find('div', class_='p-item-price') or
                             container.find('span', class_='price') or
                             container.find('div', class_='price') or
                             container.find('span', class_='amount') or
                             container.find('div', class_='amount'))
            if not price_element:
                return None
            price_text = price_element.get_text(strip=True)
            price_bdt = scraper.extract_price(price_text)
            if price_bdt is None:
                return None

            # Image
            img = container.find('img')
            image_url = None
            if img and img.get('src'):
                image_url = urljoin(scraper.base_url, img['src'])
            elif img and img.get('data-src'):
                image_url = urljoin(scraper.base_url, img['data-src'])

            # Availability (best-effort from card)
            availability = "in_stock"
            stock_element = (container.find('span', class_='stock-status') or
                             container.find('div', class_='stock-status') or
                             container.find('span', class_='availability') or
                             container.find('div', class_='availability'))
            if stock_element:
                text = stock_element.get_text(strip=True).lower()
                if any(word in text for word in ['out', 'unavailable', 'sold', 'stock out']):
                    availability = 'out_of_stock'

            return {
                'vendor_name': 'Star Tech',
                'category': category,
                'raw_name': raw_name,
                'price_bdt': price_bdt,
                'availability_status': availability,
                'product_url': product_url,
                'image_url': image_url,
                'currency': 'BDT',
            }
        except Exception:
            return None

    # Patch the scraper's method usage within scrape_category loop by duplicating minimal logic here
    import random
    from bs4 import BeautifulSoup
    async with __import__('aiohttp').client.ClientSession(headers=scraper.headers) as session:
        scraper.session = session

        for category, primary_path in scraper.categories.items():
            paths_to_try = [primary_path]
            alt_path = scraper.alternative_categories.get(category)
            if alt_path and alt_path not in paths_to_try:
                paths_to_try.append(alt_path)

            seen_urls_for_category = set()

            for category_path in paths_to_try:
                page = 1
                max_pages = 200
                while page <= max_pages:
                    if '?' in category_path:
                        url = f"{scraper.base_url}/{category_path}{'&' if page>1 else ''}page={page if page>1 else ''}"
                        url = url.rstrip('=&')
                    else:
                        url = f"{scraper.base_url}/{category_path}{'?page='+str(page) if page>1 else ''}"

                    async with session.get(url) as resp:
                        if resp.status != 200:
                            break
                        html = await resp.text()
                        soup = BeautifulSoup(html, 'html.parser')

                        containers = (soup.find_all('div', class_='p-item') or
                                      soup.find_all('div', class_='product-item') or
                                      soup.find_all('div', class_='product') or
                                      soup.find_all('div', class_='item') or
                                      soup.find_all('div', class_='product-layout') or
                                      soup.find_all('div', class_='product-thumb'))

                        for c in containers:
                            raw = await extract_raw(c, category)
                            if raw and raw['product_url'] not in seen_urls_for_category:
                                seen_urls_for_category.add(raw['product_url'])
                                all_raw.append(raw)

                        # Next page detection similar to the full scraper
                        has_next = False
                        pagination_selectors = [
                            'a[class*="next"]',
                            'a[class*="page"]',
                            'a[href*="page"]',
                            '.pagination a',
                            '.pager a'
                        ]
                        for sel in pagination_selectors:
                            for link in soup.select(sel):
                                href = link.get('href', '')
                                text = link.get_text(strip=True).lower()
                                if (('next' in text) or ('»' in text) or ('>' in text) or
                                    ('page' in href and str(page + 1) in href) or
                                    (text.isdigit() and int(text) == page + 1)):
                                    has_next = True
                                    break
                            if has_next:
                                break

                        if not has_next:
                            # Fallback: look for any page numbers greater than current
                            for a in soup.find_all('a', href=lambda x: x and 'page' in x):
                                try:
                                    n = int(a.get_text(strip=True))
                                    if n > page:
                                        has_next = True
                                        break
                                except ValueError:
                                    continue

                        if not has_next:
                            break

                    page += 1
                    await asyncio.sleep(random.uniform(0.5, 1.5))

    # Store results with de-dup (vendor_name + product_url)
    session = SessionLocal()
    try:
        # Build existing index for fast dedup
        existing = {
            (row.vendor_name, row.product_url)
            for row in session.query(RawVendorProduct.vendor_name, RawVendorProduct.product_url).all()
        }

        inserted = 0
        per_category = defaultdict(int)
        for item in all_raw:
            key = (item['vendor_name'], item['product_url'])
            if key in existing:
                continue
            session.add(RawVendorProduct(
                vendor_name=item['vendor_name'],
                category=item['category'],
                raw_name=item['raw_name'],
                price_bdt=item['price_bdt'],
                availability_status=item['availability_status'],
                product_url=item['product_url'],
                image_url=item['image_url'],
                currency=item['currency'],
            ))
            inserted += 1
            per_category[item['category']] += 1

        session.commit()

        return {
            'success': True,
            'inserted': inserted,
            'total_scraped': len(all_raw),
            'per_category': dict(per_category),
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
    finally:
        session.close()


async def main():
    print("StarTech raw scrape starting...")
    res = await scrape_startech_raw()
    if res['success']:
        print(f"Inserted {res['inserted']} out of {res['total_scraped']} scraped.")
        for cat, cnt in sorted(res['per_category'].items()):
            print(f"  {cat}: {cnt}")
    else:
        print("Scrape failed")


if __name__ == '__main__':
    asyncio.run(main())


