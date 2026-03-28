from __future__ import annotations
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json

ListItem = Dict[str, Optional[str]]


def parse_listing(html: str) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "html.parser")
    items: List[Dict[str, Optional[str]]] = []

    # Each product card appears as div.product-layout > div.product-thumb
    for card in soup.select("div.product-layout div.product-thumb"):
        # name and url: Prefer caption name text; fallback to image link title/data-title
        name_link_caption = card.select_one(".caption .name a")
        name = name_link_caption.get_text(strip=True) if name_link_caption else None
        url = name_link_caption.get("href") if name_link_caption else None

        if not name:
            image_a = card.select_one(".image a")
            if image_a:
                name = image_a.get("data-title") or image_a.get("title")
                url = url or image_a.get("href")

        # image
        img = card.select_one(".image img")
        image_url = None
        if img:
            image_url = img.get("src") or img.get("data-src")

        # price - Skyland listing pages might use different structure
        # Try to find price elements, avoiding old prices
        price_el = None
        price_text = None
        
        # Strategy 1: Look for price-new specifically
        price_el = card.select_one(".price .price-new") or card.select_one(".price-new")
        
        # Strategy 2: If not found, look in .price container but avoid old prices
        if not price_el:
            price_container = card.select_one(".price")
            if price_container:
                # Get all spans/divs within price container
                for child in price_container.select("span, div"):
                    classes = str(child.get("class", [])).lower()
                    # Skip old prices
                    if not any(cls in classes for cls in ["old", "cross", "strike", "line-through", "price-old", "faded"]):
                        text = child.get_text(strip=True)
                        # Check if it looks like a price (contains numbers)
                        if text and any(c.isdigit() for c in text):
                            price_el = child
                            break
                
                # If still nothing, use container but extract carefully
                if not price_el:
                    # Get direct text, but be careful about concatenation
                    price_el = price_container
        
        if price_el:
            price_text = price_el.get_text(" ", strip=True)
            # Clean up - extract just the first number sequence if there's extra text
            import re
            price_match = re.search(r'[\d,]+(?:\.\d+)?', price_text)
            if price_match:
                price_text = price_match.group(0)

        # availability: look for stock status using multiple strategies
        availability_text = None
        
        # Strategy 1: Look for explicit stock/availability elements
        avail_el = card.select_one(".stock, .availability, .stock-status, .inventory")
        if avail_el:
            availability_text = avail_el.get_text(strip=True)
        
        # Strategy 2: Search through all elements for stock-related keywords
        if not availability_text:
            for el in card.select("p, span, div, small"):
                text = el.get_text(strip=True).lower()
                if any(keyword in text for keyword in ["in stock", "out of stock", "pre order", "pre-order", "preorder", "available", "sold out", "stock out"]):
                    availability_text = el.get_text(strip=True)
                    break
        
        # Strategy 3: Check for buy buttons as availability indicator
        if not availability_text:
            buy_buttons = card.select('button, .btn, [class*="buy"], [class*="cart"], [class*="purchase"], [class*="add"]')
            buy_text = ' '.join([btn.get_text(strip=True).lower() for btn in buy_buttons])
            if any(word in buy_text for word in ['buy', 'add to cart', 'purchase', 'order', 'add']):
                availability_text = "In Stock"

        # key features list into JSON array
        features = []
        for li in card.select(".key-features li"):
            t = li.get_text(" ", strip=True)
            if t:
                features.append(t)
        description_json = json.dumps(features, ensure_ascii=False) if features else None

        items.append(
            {
                "raw_name": name,
                "price_text": price_text,
                "availability_text": availability_text,
                "product_url": url,
                "image_url": image_url,
                "description": description_json,
            }
        )

    return items


def parse_next_page_url(html: str, current_url: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    # Skyland uses pagination with numbers and next arrows
    rel_next = soup.select_one(".pagination a[rel=next]")
    if rel_next and rel_next.get("href"):
        return rel_next.get("href")
    for a in soup.select(".pagination a"):
        txt = a.get_text(strip=True)
        if txt in {">", ">>", "›", "Next"} and a.get("href"):
            return a.get("href")
    # fall back by selecting current active page and choosing next sibling link
    active = soup.select_one(".pagination .active span, .pagination .active a")
    if active:
        li = active.find_parent("li")
        if li and li.find_next_sibling("li"):
            nxt = li.find_next_sibling("li").find("a")
            if nxt and nxt.get("href"):
                return nxt.get("href")
    return None


def parse_product_detail(html: str, product_url: str) -> Optional[Dict[str, Optional[str]]]:
    """Parse a single product detail page."""
    soup = BeautifulSoup(html, "html.parser")
    
    # Product name - Skyland uses: <div class="title page-title">
    name_el = (
        soup.select_one(".title.page-title") or
        soup.select_one("div.title.page-title") or
        soup.select_one("h1") or
        soup.select_one(".product-name")
    )
    name = name_el.get_text(strip=True) if name_el else None
    
    # High-resolution image - need to check actual structure, but try common selectors
    image_url = None
    main_img = (
        soup.select_one(".product-image img") or
        soup.select_one("#product-image img") or
        soup.select_one(".image img") or
        soup.select_one("img[data-zoom-image]") or
        soup.select_one(".product-images img") or
        soup.select_one(".product-details img")
    )
    if main_img:
        image_url = main_img.get("data-zoom-image") or main_img.get("src") or main_img.get("data-src")
    
    # Price - Skyland uses various structures depending on page template
    # Try multiple selectors in order of preference
    price_text = None
    import re
    
    # Strategy 1: Specific IDs for offer/cash/regular price
    price_el = (
        soup.select_one("#offer-price-display") or
        soup.select_one("#cash-price-display") or
        soup.select_one("#regular-price-display")
    )
    
    if price_el:
        # For cash-price-display, it may contain both new and old price
        if price_el.get("id") == "cash-price-display":
            faded_old = price_el.select_one(".fadedOldPrice")
            if faded_old:
                faded_old.decompose()
            price_text = price_el.get_text(strip=True)
        else:
            price_text = price_el.get_text(strip=True)
    
    # Strategy 2: Look for price in product-info or price-info areas
    if not price_text:
        # Look for price containers with various class patterns
        price_containers = soup.select(
            ".price-info, .product-price, .price-box, .price-display, "
            "[class*='price'], .product-info li, .product-data"
        )
        for container in price_containers:
            text = container.get_text(strip=True)
            # Look for BDT price pattern (৳ followed by numbers)
            match = re.search(r'[৳₿]?\s*([\d,]+)', text)
            if match:
                # Skip if this looks like an old/crossed out price
                classes_str = str(container.get("class", [])).lower()
                if any(x in classes_str for x in ["old", "strike", "cross", "faded", "regular"]):
                    continue
                # Skip if text mentions "regular" price (often the crossed-out one)
                if "regular" in text.lower() and "cash" not in text.lower():
                    continue
                price_text = match.group(1).replace(",", "")
                break
    
    # Strategy 3: Look for "Cash Discount Price" or similar labels
    if not price_text:
        for el in soup.select("div, span, p, li"):
            text = el.get_text(strip=True).lower()
            if "cash discount" in text or "offer price" in text or "special price" in text:
                # Get the price from this element or nearby
                match = re.search(r'[৳₿]?\s*([\d,]+)', el.get_text(strip=True))
                if match:
                    price_text = match.group(1).replace(",", "")
                    break
    
    # Strategy 4: Look for price in table/list format (Price: ৳X,XXX)
    if not price_text:
        for el in soup.select("tr, li, div"):
            text = el.get_text(" ", strip=True)
            if re.match(r'^Price[:\s]', text, re.I):
                match = re.search(r'[৳₿]?\s*([\d,]+)', text)
                if match:
                    price_text = match.group(1).replace(",", "")
                    break
    
    # Availability - Skyland uses: <li class="product-data"> with <span class="label">Stock:</span>
    availability_text = None
    # Find the product-data li that has "Stock:" label
    for li in soup.select("li.product-data"):
        label = li.select_one(".label")
        if label and "Stock:" in label.get_text():
            value = li.select_one(".value")
            if value:
                availability_text = value.get_text(strip=True)
                break
    
    # Check if price shows 0 or "৳0" - this indicates out of stock
    if not availability_text and price_text:
        price_text_lower = price_text.lower().replace(",", "").replace(" ", "")
        if price_text_lower == "0" or price_text_lower == "৳0" or price_text_lower == "0৳":
            availability_text = "Out Of Stock"
    
    # Fallback: check for add to cart button
    if not availability_text:
        cart_button = soup.select_one("#button-cart, .btn-cart, [id*='cart']")
        if cart_button:
            button_text = cart_button.get_text(strip=True).lower()
            if "out of stock" in button_text or "stock out" in button_text:
                availability_text = "Out Of Stock"
            else:
                availability_text = "In Stock"
    
    # IMPORTANT: If price is 0 or None, and availability is still unknown, treat as out of stock
    if not availability_text and (not price_text or price_text == "0" or price_text == "৳0" or price_text == "0৳"):
        availability_text = "Out Of Stock"
    
    # Full description - Skyland has key-features and specifications
    description_parts = []
    
    # Key Features
    key_features = soup.select_one(".key-features ul")
    if key_features:
        for li in key_features.select("li"):
            text = li.get_text(strip=True)
            if text:
                description_parts.append(text)
    
    # Specifications table
    spec_table = soup.select_one("#tab-specification table, .table.table-bordered")
    if spec_table:
        for row in spec_table.select("tbody tr"):
            cells = row.select("td")
            if len(cells) >= 2:
                # Format as "Key: Value"
                key = cells[0].get_text(strip=True)
                value = cells[1].get_text(strip=True)
                if key and value:
                    description_parts.append(f"{key}: {value}")
    
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