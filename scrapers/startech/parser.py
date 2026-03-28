from __future__ import annotations
from bs4 import BeautifulSoup
from typing import Iterable, List, Dict, Optional
import json

ListItem = Dict[str, Optional[str]]


def parse_listing(html: str) -> List[ListItem]:
    """Parse a category page and return list of product summary dicts.

    Fields: raw_name, price_bdt, availability_status, product_url, image_url
    """
    soup = BeautifulSoup(html, "html.parser")
    items: List[ListItem] = []

    # Star Tech category grid items
    for card in soup.select(".product-thumb, .p-item, .single-product"):  # different templates
        title_el = card.select_one("h4 a, .caption h4 a, .product-name a")
        image_el = card.select_one("img")
        stock_el = card.select_one(".stock, .availability, .st-product-stock")

        name = title_el.get_text(strip=True) if title_el else None
        url = title_el.get("href") if title_el else None
        image = image_el.get("src") if image_el and image_el.has_attr("src") else (
            image_el.get("data-src") if image_el and image_el.has_attr("data-src") else None
        )
        
        # Availability: check for stock status or purchase buttons
        stock = stock_el.get_text(strip=True) if stock_el else None
        if not stock:
            # Check for "Buy Now" or similar purchase buttons
            buy_buttons = card.select('button, .btn, [class*="buy"], [class*="cart"], [class*="purchase"]')
            buy_text = ' '.join([btn.get_text(strip=True).lower() for btn in buy_buttons])
            if any(word in buy_text for word in ['buy', 'add to cart', 'purchase', 'order']):
                stock = "In Stock"
            else:
                stock = "Unknown"

        # Price: prioritize current price over old price to avoid concatenation
        price_el = card.select_one(".price-new, .current-price") or card.select_one(".price, .p-item-price")
        if not price_el:
            # Fallback: look for any price element but avoid old prices
            for el in card.select(".price, .p-item-price"):
                if not any(cls in str(el.get("class", [])).lower() for cls in ["old", "cross", "strike", "line-through"]):
                    price_el = el
                    break
        price_text = price_el.get_text(" ", strip=True) if price_el else None

        # Description: look for product features or specifications
        features = []
        # Check for any list items or feature descriptions
        for li in card.select("li, .feature, .spec, .description"):
            txt = li.get_text(" ", strip=True)
            if txt and len(txt) > 5 and len(txt) < 200:  # Reasonable feature length
                features.append(txt)
        
        # Also check for any divs that might contain specs
        for div in card.select("div"):
            txt = div.get_text(" ", strip=True)
            if txt and ":" in txt and len(txt) < 100:  # Looks like a spec (key: value)
                features.append(txt)
        
        description_json = json.dumps(features, ensure_ascii=False) if features else None

        items.append(
            {
                "raw_name": name,
                "price_text": price_text,
                "availability_text": stock,
                "product_url": url,
                "image_url": image,
                "description": description_json,
            }
        )

    return items


def parse_next_page_url(html: str, current_url: str) -> Optional[str]:
    """Find the URL for the next pagination page if present."""
    soup = BeautifulSoup(html, "html.parser")
    # Look for pagination 'NEXT' or rel=next
    rel_next = soup.select_one("a[rel=next]")
    if rel_next and rel_next.get("href"):
        return rel_next["href"]
    # Fallback: find 'NEXT' button in pagination
    for a in soup.select(".pagination a, .links a"):
        if a.get_text(strip=True).lower() in {"next", ">", ">>"} and a.get("href"):
            return a["href"]
    # Sometimes pages use ?page=N; compute next by scanning active page
    active = soup.select_one(".pagination .active span, .links b")
    if active and active.get_text(strip=True).isdigit():
        current_page = int(active.get_text(strip=True))
        for a in soup.select(".pagination a"):
            t = a.get_text(strip=True)
            if t.isdigit() and int(t) == current_page + 1 and a.get("href"):
                return a["href"]
    return None


def parse_product_detail(html: str, product_url: str) -> Optional[Dict[str, Optional[str]]]:
    """Parse a single product detail page."""
    soup = BeautifulSoup(html, "html.parser")
    
    # Product name - Star Tech uses: <h1 itemprop="name" class="product-name">
    name_el = (
        soup.select_one("h1.product-name") or
        soup.select_one("h1[itemprop='name']") or
        soup.select_one("h1")
    )
    name = name_el.get_text(strip=True) if name_el else None
    
    # High-resolution image - Star Tech uses: <img class="main-img"> or thumbnail href
    image_url = None
    main_img = (
        soup.select_one("img.main-img") or
        soup.select_one(".product-img-holder img")
    )
    if main_img:
        # Try to get high-res from thumbnail href first
        thumbnail_link = main_img.find_parent("a", class_="thumbnail")
        if thumbnail_link and thumbnail_link.get("href"):
            image_url = thumbnail_link.get("href")
        else:
            # Fallback to img src
            image_url = main_img.get("src") or main_img.get("data-src")
    
    # Price - Star Tech uses: <td class="product-info-data product-price">189,900৳</td>
    # Or: <td class="product-price"><ins>98,900৳</ins><del>108,900৳</del></td>
    # IMPORTANT: Avoid .price-new from related products section - prioritize main product price
    # Also handle "To be announced" cases - treat as out of stock
    price_text = None
    
    # Strategy 0: Check the product info table for "Price" row - handle "To be announced" case
    # This is the most reliable way to get the actual product price from the main table
    is_to_be_announced = False
    product_table = soup.select_one("table")
    if product_table:
        rows = product_table.select("tr")
        for row in rows:
            cells = row.select("td")
            if len(cells) >= 2:
                first_cell_text = cells[0].get_text(strip=True).lower()
                second_cell_text = cells[1].get_text(strip=True)
                if "price" in first_cell_text:
                    # Check if price is "To be announced" or similar
                    if any(phrase in second_cell_text.lower() for phrase in ["to be announced", "tba", "not available", "coming soon"]):
                        # Treat as out of stock - price will be None
                        price_text = None
                        is_to_be_announced = True
                        break
                    elif "৳" in second_cell_text or any(c.isdigit() for c in second_cell_text):
                        # Valid price found
                        price_text = second_cell_text
                        break
    
    # Strategy 1: Look for td.product-price or td.product-info-data.product-price (main product price)
    # This is the most reliable selector for the actual product price
    # Skip if we already determined it's "To be announced"
    if not price_text and not is_to_be_announced:
        price_container = (
            soup.select_one("td.product-price") or
            soup.select_one("td.product-info-data.product-price") or
            soup.select_one(".product-info-data.product-price")
        )
        if price_container:
            container_text = price_container.get_text(strip=True)
            # Check if it's "To be announced" - if so, skip it
            if any(phrase in container_text.lower() for phrase in ["to be announced", "tba", "not available"]):
                price_text = None
            else:
                # Check for <ins> tag first (discount price)
                ins_tag = price_container.select_one("ins")
                if ins_tag:
                    price_text = ins_tag.get_text(strip=True)
                else:
                    # Otherwise use the direct text content
                    price_text = container_text
    
    # Strategy 2: Look for .price-new but ONLY in the main product area (not related products)
    # Check if it's within the product info section, not in related products
    # Skip if we already determined it's "To be announced"
    if not price_text and not is_to_be_announced:
        product_info_section = soup.select_one(".product-info, .product-details, .product-summary")
        if product_info_section:
            price_new = product_info_section.select_one(".price-new")
            if price_new:
                # Make sure it's not in a related product card
                if not price_new.find_parent(".p-item, .related-product, .product-thumb"):
                    price_text = price_new.get_text(strip=True)
    
    # Strategy 3: Look for <ins> tag in .product-price (current/discount price)
    # Skip if we already determined it's "To be announced"
    if not price_text and not is_to_be_announced:
        price_container = soup.select_one(".product-price")
        if price_container:
            ins_tag = price_container.select_one("ins")
            if ins_tag:
                price_text = ins_tag.get_text(strip=True)
    
    # Strategy 4: Fallback - look for .price span but avoid related products
    # Skip if we already determined it's "To be announced"
    if not price_text and not is_to_be_announced:
        product_info_section = soup.select_one(".product-info, .product-details, .product-summary")
        if product_info_section:
            price_span = product_info_section.select_one("span.price")
            if price_span and "৳" in price_span.get_text():
                # Make sure it's not an EMI price (contains "/month")
                text = price_span.get_text(strip=True)
                if "/month" not in text.lower():
                    price_text = text
    
    # Strategy 5: Last resort - extract from any price element but avoid old prices and related products
    # IMPORTANT: Only use this if we haven't found a price yet AND it's not "To be announced"
    if not price_text and not is_to_be_announced:
            for el in soup.select(".price, .product-price, [class*='price']"):
                # Skip if it's in related products section
                if el.find_parent(".p-item, .related-product, .product-thumb, .related-products, .related-product, [class*='related']"):
                    continue
                # Skip if it's in a product card (likely related product)
                if el.find_parent(".product-thumb, .product-item, .p-item"):
                    continue
                # Skip if it contains old price indicators
                if el.select_one("del, .price-old, .old-price"):
                    continue
                # Skip EMI prices
                text = el.get_text(strip=True)
                if "/month" in text.lower():
                    continue
                if "৳" in text:
                    # Extract just the price number
                    import re
                    price_match = re.search(r'([\d,]+(?:\.\d+)?)\s*৳', text)
                    if price_match:
                        price_text = price_match.group(1) + "৳"
                        break
    
    # Availability - Star Tech uses: <td class="product-status">In Stock</td>
    # Also check product info table for "Status" row
    availability_text = None
    
    # Strategy 1: Check the product info table for "Status" row
    if product_table:
        rows = product_table.select("tr")
        for row in rows:
            cells = row.select("td")
            if len(cells) >= 2:
                first_cell_text = cells[0].get_text(strip=True).lower()
                second_cell_text = cells[1].get_text(strip=True)
                if "status" in first_cell_text:
                    availability_text = second_cell_text
                    break
    
    # Strategy 2: Look for status element
    if not availability_text:
        status_el = (
            soup.select_one(".product-status") or
            soup.select_one("td.product-status")
        )
        if status_el:
            availability_text = status_el.get_text(strip=True)
    
    # Strategy 3: Fallback - check for stock indicators
    if not availability_text:
        stock_indicators = soup.select(".stock, .availability, [class*='stock'], [class*='status']")
        for indicator in stock_indicators:
            text = indicator.get_text(strip=True).lower()
            if any(word in text for word in ["stock", "available", "in stock", "out of stock"]):
                availability_text = indicator.get_text(strip=True)
                break
    
    # IMPORTANT: If price is "To be announced" or None, force availability to "Out Of Stock"
    if price_text is None or any(phrase in (price_text or "").lower() for phrase in ["to be announced", "tba", "not available"]):
        availability_text = "Out Of Stock"
        price_text = None
    
    # Specifications ONLY (skip "Key Features" and other unnecessary info)
    description_parts = []
    spec_section = soup.select_one("#specification, .specification-tab, section#specification")
    
    if spec_section:
        # Extract from specification table
        spec_table = spec_section.select_one("table.data-table, table.flex-table, table")
        if spec_table:
            # Skip header rows (heading-row)
            for row in spec_table.select("tr"):
                cells = row.select("td")
                # Skip header rows (heading-row class or colspan)
                if len(cells) >= 2:
                    # Check if it's a header row
                    is_header = any("heading-row" in str(cell.get("class", [])).lower() for cell in cells)
                    if not is_header:
                        name_cell = cells[0] if len(cells) > 0 else None
                        value_cell = cells[1] if len(cells) > 1 else None
                        if name_cell and value_cell:
                            name = name_cell.get_text(strip=True)
                            value = value_cell.get_text(strip=True)
                            # Format as "Key: Value" if both exist and are different
                            if name and value and name != value:
                                description_parts.append(f"{name}: {value}")
    
    description_json = json.dumps(description_parts, ensure_ascii=False) if description_parts else None
    
    if not name:
        return None
    
    return {
        "raw_name": name,
        "price_text": price_text,
        "availability_text": availability_text,
        "product_url": product_url,
        "image_url": image_url,
        "description": description_json,
    }