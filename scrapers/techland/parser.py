from __future__ import annotations
from bs4 import BeautifulSoup
from typing import Iterable, List, Dict, Optional
import json

ListItem = Dict[str, Optional[str]]


def _text_or_none(el) -> Optional[str]:
    return el.get_text(strip=True) if el else None


def parse_listing(html: str) -> List[ListItem]:
    """Parse a category page and return list of product summary dicts.

    Fields: raw_name, price_bdt, availability_status, product_url, image_url
    """
    soup = BeautifulSoup(html, "html.parser")
    items: List[ListItem] = []

    # Techland product card - try multiple selectors to find product cards
    card_selectors = [
        "article.products-list__item",
        ".products-list__item", 
        "article[class*='product']",
        ".product-item",
        ".product-card",
        ".single-product",
        "article.product",
        "[class*='product-item']",
        "[class*='product-card']"
    ]
    
    cards = []
    for selector in card_selectors:
        found = soup.select(selector)
        if found:
            cards = found
            break
    
    # If no cards found with specific selectors, try generic product containers
    if not cards:
        cards = soup.select("article, .item, .card, [class*='item']")
    
    for card in cards:
        # Name and URL - try multiple selectors
        title_link = (
            card.select_one("p a[href]") or 
            card.select_one("a[aria-label][href]") or
            card.select_one("h2 a[href]") or
            card.select_one("h3 a[href]") or
            card.select_one("h4 a[href]") or
            card.select_one(".product-title a[href]") or
            card.select_one(".product-name a[href]") or
            card.select_one("a[href]")
        )
        name = _text_or_none(title_link)
        url = title_link.get("href") if title_link else None
        
        # If still no name, try getting text from the card itself
        if not name:
            # Try to find any heading or title element
            name_el = (
                card.select_one("h2") or
                card.select_one("h3") or
                card.select_one("h4") or
                card.select_one(".product-title") or
                card.select_one(".product-name") or
                card.select_one("p.title") or
                card.select_one("p.name") or
                card.select_one("[class*='title']") or
                card.select_one("[class*='name']")
            )
            name = _text_or_none(name_el)
            
        # Last resort: if we have a URL but no name, skip this item
        # (better to skip than to have "Unknown" products)
        if not name and url:
            # Try extracting from URL as last resort
            import re
            url_parts = url.split('/')
            if url_parts:
                potential_name = url_parts[-1].replace('-', ' ').replace('_', ' ')
                # Only use if it looks reasonable (not just numbers or single chars)
                if len(potential_name) > 3 and not potential_name.isdigit():
                    name = potential_name.title()

        # Image
        image_el = card.select_one("img")
        image = None
        if image_el:
            image = image_el.get("src") or image_el.get("data-src")

        # Price: look for actual price, not "Save" amounts
        price_el = None
        for span in card.select("span"):
            txt = span.get_text(strip=True)
            # Skip "Save" amounts and look for actual prices
            if "৳" in txt and "Save" not in txt and not any(cls in str(span.get("class", [])).lower() for cls in ["old", "cross", "strike", "line-through", "save", "discount"]):
                price_el = span
                break
        
        # If no price found in spans, try other elements
        if not price_el:
            for el in card.select("div, p, a"):
                txt = el.get_text(strip=True)
                if "৳" in txt and "Save" not in txt and len(txt) < 50:  # Reasonable price length
                    price_el = el
                    break
        
        price_text = _text_or_none(price_el)

        # Availability: look for a small text element containing stock state
        avail_el = None
        for small in card.select("p, span, div"):
            t = small.get_text(strip=True).lower()
            if any(k in t for k in ["in stock", "out of stock", "pre order", "pre-order", "preorder"]):
                avail_el = small
                break
        availability = _text_or_none(avail_el)

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

        # Only add items that have a name (required field)
        if name:
            items.append(
                {
                    "raw_name": name,
                    "price_text": price_text,
                    "availability_text": availability,
                    "product_url": url,
                    "image_url": image,
                    "description": description_json,
                }
            )

    # Fallback generic selectors if none found
    if not items:
        for card in soup.select(".product-item, .product-card, .single-product, .item"):
            title_el = card.select_one("h3 a, h4 a, .product-title a, .product-name a, .title a")
            # Prioritize current price over old price
            price_el = card.select_one(".price-new, .current-price, .price") or card.select_one(".price-old, .amount")
            image_el = card.select_one("img")
            stock_el = card.select_one(".stock, .availability, .in-stock, .out-of-stock")

            name = title_el.get_text(strip=True) if title_el else None
            url = title_el.get("href") if title_el else None
            image = image_el.get("src") if image_el and image_el.has_attr("src") else (
                image_el.get("data-src") if image_el and image_el.has_attr("data-src") else None
            )
            price_text = price_el.get_text(" ", strip=True) if price_el else None
            stock = stock_el.get_text(strip=True) if stock_el else None

            # Description for fallback
            features = []
            for li in card.select("li, .feature, .spec, .description"):
                txt = li.get_text(" ", strip=True)
                if txt and len(txt) > 5 and len(txt) < 200:
                    features.append(txt)
            description_json = json.dumps(features, ensure_ascii=False) if features else None

            # Only add items that have a name (required field)
            if name:
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
    for a in soup.select(".pagination a, .pager a, .page-numbers a, nav[aria-label='Pagination'] a"):
        if a.get_text(strip=True).lower() in {"next", ">", ">>", "next page", "›"} and a.get("href"):
            return a["href"]
    # Sometimes pages use ?page=N; compute next by scanning active page
    active = soup.select_one(".pagination .active, .pagination .current, .pager .active")
    if active and active.get_text(strip=True).isdigit():
        current_page = int(active.get_text(strip=True))
        for a in soup.select(".pagination a, .pager a"):
            t = a.get_text(strip=True)
            if t.isdigit() and int(t) == current_page + 1 and a.get("href"):
                return a["href"]
    return None


def parse_product_detail(html: str, product_url: str) -> Optional[Dict[str, Optional[str]]]:
    """Parse a single product detail page."""
    soup = BeautifulSoup(html, "html.parser")
    
    # Product name - Techland uses: <h1 class="text-md sm:text-md lg:text-lg font-bold text-gray-800 break-words">
    name_el = (
        soup.select_one("h1.text-md, h1.font-bold") or
        soup.select_one("h1") or
        soup.select_one(".product-name")
    )
    name = name_el.get_text(strip=True) if name_el else None
    
    # High-resolution image - Techland uses: <img id="main-image" data-desktop-src="...">
    image_url = None
    main_img = (
        soup.select_one("#main-image") or
        soup.select_one("img[data-desktop-src]") or
        soup.select_one("img[data-src]") or
        soup.select_one(".product-image img")
    )
    if main_img:
        # Prefer high-res sources
        image_url = (
            main_img.get("data-desktop-src") or
            main_img.get("data-retina-src") or
            main_img.get("data-src") or
            main_img.get("src")
        )
    
    # Price - Techland structure: JSON-LD structured data is most reliable
    # Also check: "### Product Pricing" -> "#### Discount Price" -> "৳ 36,999 ৳ 39,500"
    import re
    import json
    price_text = None
    
    # Strategy 1: Extract from JSON-LD structured data (most reliable)
    json_ld_scripts = soup.select('script[type="application/ld+json"]')
    for script in json_ld_scripts:
        try:
            # Get script content - try .string first, then .get_text()
            script_content = script.string if script.string else script.get_text()
            if not script_content or not script_content.strip():
                continue
            data = json.loads(script_content)
            # Handle both single objects and arrays
            items_to_check = []
            if isinstance(data, list):
                items_to_check = data
            elif isinstance(data, dict):
                items_to_check = [data]
            
            for item in items_to_check:
                if isinstance(item, dict) and item.get("@type") == "Product":
                    offers = item.get("offers")
                    if not offers:
                        continue
                    
                    # Handle both single offer object and array of offers
                    if isinstance(offers, list) and len(offers) > 0:
                        offer = offers[0]
                    elif isinstance(offers, dict):
                        offer = offers
                    else:
                        continue
                    
                    if "price" in offer:
                        price_value = offer["price"]
                        # Convert to int and format with commas
                        try:
                            price_int = int(float(price_value))
                            price_text = f"{price_int:,}"
                            break
                        except (ValueError, TypeError):
                            continue
            if price_text:
                break
        except (json.JSONDecodeError, ValueError, KeyError, TypeError, AttributeError) as e:
            continue
    
    # Strategy 2: Look for "Product Pricing" or "Discount Price" heading in main product area (not related products)
    if not price_text:
        # Find main product info section to avoid related products
        product_info_section = (
            soup.select_one(".product-info, .product-details, [class*='product-info'], [class*='product-details']") or
            soup.select_one(".lg\\:w-3\\/5, [class*='lg:w-3/5']") or
            soup.select_one("div:has(> h1)")
        )
        
        search_area = product_info_section if product_info_section else soup
        
        for heading in search_area.select("h2, h3, h4, h5"):
            heading_text = heading.get_text(strip=True).lower()
            if "product pricing" in heading_text or "discount price" in heading_text:
                # Look for price in the same section or nearby siblings
                parent = heading.parent
                if parent:
                    text = parent.get_text(" ", strip=True)
                    price_matches = re.findall(r'৳\s*([\d,]+(?:\.\d+)?)', text)
                    if price_matches:
                        price_text = price_matches[0]
                        break
                
                # Also check next siblings
                current = heading.find_next_sibling()
                for _ in range(5):
                    if not current:
                        break
                    text = current.get_text(" ", strip=True)
                    if "৳" in text:
                        price_matches = re.findall(r'৳\s*([\d,]+(?:\.\d+)?)', text)
                        if price_matches:
                            price_text = price_matches[0]
                            break
                    current = current.find_next_sibling()
                
                if price_text:
                    break
    
    # Strategy 3: Look for text containing "Discount Price" in main product area
    if not price_text:
        product_info_section = (
            soup.select_one(".product-info, .product-details, [class*='product-info'], [class*='product-details']") or
            soup.select_one(".lg\\:w-3\\/5, [class*='lg:w-3/5']") or
            soup.select_one("div:has(> h1)")
        )
        
        search_area = product_info_section if product_info_section else soup
        
        for el in search_area.select("div, section, h4, h3"):
            text = el.get_text(" ", strip=True)
            # Make sure it's not in related products section
            if (el.find_parent(class_=re.compile("related|recommend", re.I))):
                continue
            if "discount price" in text.lower() and "৳" in text:
                price_matches = re.findall(r'৳\s*([\d,]+(?:\.\d+)?)', text)
                if price_matches:
                    price_text = price_matches[0]
                    break
    
    # Strategy 4: Fallback - find prices in main product area only, filter out related products
    if not price_text:
        found_prices = []
        # Find main product area (exclude related products sidebar)
        product_info_section = (
            soup.select_one(".product-info, .product-details, [class*='product-info'], [class*='product-details']") or
            soup.select_one(".lg\\:w-3\\/5, [class*='lg:w-3/5']") or
            soup.select_one("div:has(> h1)")
        )
        
        search_area = product_info_section if product_info_section else soup
        
        for el in search_area.select("span, div, p, h1, h2, h3, h4, h5, h6"):
            # Skip if in related products section
            if el.find_parent(class_=re.compile("related|recommend", re.I)):
                continue
            
            txt = el.get_text(strip=True)
            classes = str(el.get("class", [])).lower()
            parent_text = ""
            if el.parent:
                parent_text = el.parent.get_text(" ", strip=True).lower()
            
            # Skip if it's in an EMI section, save badge, or other non-price sections
            if ("৳" in txt and 
                "save" not in txt.lower() and 
                "save" not in classes and
                "emi" not in parent_text and
                "installment" not in parent_text and
                "month" not in parent_text.lower() and
                not any(cls in classes for cls in ["old", "cross", "strike", "line-through", "discount", "badge", "emi", "installment"])):
                price_matches = re.findall(r'৳\s*([\d,]+(?:\.\d+)?)', txt)
                for price_val in price_matches:
                    try:
                        price_num = float(price_val.replace(",", ""))
                        # Reasonable price range for graphics cards (avoid EMI amounts like 1,303)
                        if 10000 <= price_num <= 10000000:
                            found_prices.append((price_num, price_val))
                    except:
                        pass
        
        # Sort by value and take the smallest (likely the discount price)
        if found_prices:
            found_prices.sort(key=lambda x: x[0])
            price_text = found_prices[0][1]
    
    # Availability - Techland uses: <div>Stock : <span class="text-red-700 font-medium">Up Coming</span></div>
    # The stock status is in the main product info section, not in related products
    availability_text = None
    
    # Strategy 1: Look for span with "text-red-700" class that's near "Stock :" text
    # This is the most reliable indicator for Techland
    red_spans = soup.select("span.text-red-700, span[class*='red-700'], span[class*='red']")
    for span in red_spans:
        span_text = span.get_text(strip=True)
        # Check if it's a stock status (not a price - prices contain ৳ or are mostly numbers)
        if "৳" not in span_text and not span_text.replace(",", "").replace(".", "").replace(" ", "").isdigit():
            # Check if parent or nearby contains "Stock"
            parent = span.parent
            if parent:
                parent_text = parent.get_text(" ", strip=True)
                # Look for "Stock :" pattern near this span
                if "Stock" in parent_text and ":" in parent_text:
                    # Extract the span text as the status
                    availability_text = span_text
                    break
                # Also check siblings
                for sibling in parent.find_all(string=True, recursive=False):
                    if "Stock" in str(sibling) and ":" in str(sibling):
                        availability_text = span_text
                        break
                if availability_text:
                    break
    
    # Strategy 2: Look for "Stock :" pattern in the main product info area
    if not availability_text:
        # Find the product info section first to avoid matching related products
        product_info_section = (
            soup.select_one(".product-info, .product-details, [class*='product-info'], [class*='product-details']") or
            soup.select_one("div:has(> h1)")
        )
        
        search_area = product_info_section if product_info_section else soup
        
        # Look for divs containing "Stock :" pattern in the main product area
        for div in search_area.select("div"):
            text = div.get_text(" ", strip=True)
            # More specific check: "Stock :" followed by status
            if "Stock" in text and ":" in text and len(text) < 300:  # Avoid matching large containers
                # Find the span with the actual status (prioritize span text)
                status_span = div.select_one("span")
                if status_span:
                    span_text = status_span.get_text(strip=True)
                    # Make sure it's not a price span (prices contain ৳ or numbers)
                    if "৳" not in span_text and not span_text.replace(",", "").replace(".", "").isdigit():
                        availability_text = span_text
                        break
                else:
                    # If no span, extract text after "Stock :"
                    parts = text.split("Stock", 1)
                    if len(parts) > 1:
                        extracted = parts[1].split(":", 1)[-1].strip()
                        # Make sure it's not a price
                        if "৳" not in extracted and not extracted.replace(",", "").replace(".", "").isdigit():
                            availability_text = extracted
                            break
    
    # Fallback: look for common stock indicators
    if not availability_text:
        stock_indicators = soup.select(".stock-status, .availability, [class*='stock'], [class*='available']")
        for indicator in stock_indicators:
            text = indicator.get_text(strip=True).lower()
            if any(word in text for word in ["stock", "available", "coming", "pre-order"]):
                availability_text = indicator.get_text(strip=True)
                break
    
    # Note: We no longer clear price for upcoming products - user wants to show prices even for upcoming
    
    # Specifications ONLY (user requested only specification, not description)
    description_parts = []
    spec_tab = soup.select_one("#specification-tab")
    
    if spec_tab:
        # Extract from all specification tables
        spec_tables = spec_tab.select("table.w-full.border-collapse, table.border-collapse, table")
        for spec_table in spec_tables:
            # Skip header rows (bg-gray-50)
            for row in spec_table.select("tr"):
                cells = row.select("td")
                # Skip header rows (colspan="2" or bg-gray-50)
                if len(cells) >= 2 and not any("bg-gray" in str(cell.get("class", [])).lower() for cell in cells):
                    key = cells[0].get_text(strip=True)
                    value = cells[1].get_text(strip=True)
                    # Format as "Key: Value"
                    if key and value and key != value:
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
