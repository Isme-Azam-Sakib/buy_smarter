from __future__ import annotations
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json


def parse_listing(html: str) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "html.parser")
    items: List[Dict[str, Optional[str]]] = []

    for card in soup.select("div.product-layout div.product-thumb"):
        # Name and URL - prioritize caption name text
        name_link = card.select_one(".caption .name a")
        name = name_link.get_text(strip=True) if name_link else None
        url = name_link.get("href") if name_link else None
        
        # Fallback to image link if caption is empty
        if not name:
            image_link = card.select_one(".image a.product-img")
            if image_link:
                name = image_link.get("title") or image_link.get("data-title")
                url = url or image_link.get("href")

        # Image
        img = card.select_one(".image img")
        image_url = img.get("src") if img else None

        # Price (prefer price-new)
        price_el = card.select_one(".price .price-new") or card.select_one(".price")
        price_text = price_el.get_text(" ", strip=True) if price_el else None

        # Availability - check for stock indicators
        availability_text = None
        # Look for stock status indicators
        stock_indicators = card.select(".stock, .availability, .in-stock, .out-of-stock, .product-labels")
        for indicator in stock_indicators:
            text = indicator.get_text(strip=True).lower()
            if any(word in text for word in ["in stock", "available", "stock", "out of stock", "sold out"]):
                availability_text = indicator.get_text(strip=True)
                break
        
        # If no explicit stock indicator, assume in stock if product has price
        if not availability_text and price_text:
            availability_text = "In Stock"

        # Description: nested ULs under .module-features-description
        features: List[str] = []
        for li in card.select(".module-features-description li"):
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
    # Ultratech uses pagination with numbers and next arrows
    rel_next = soup.select_one(".pagination a[rel=next]")
    if rel_next and rel_next.get("href"):
        return rel_next.get("href")
    for a in soup.select(".pagination a"):
        txt = a.get_text(strip=True).lower()
        if txt in {"next", ">", ">>", "›"} and a.get("href"):
            return a.get("href")
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
    
    # Product name - Ultra Tech uses: <div class="title page-title">
    name_el = (
        soup.select_one(".title.page-title") or
        soup.select_one("div.title.page-title") or
        soup.select_one("h1") or
        soup.select_one(".product-name")
    )
    name = name_el.get_text(strip=True) if name_el else None
    
    # High-resolution image - Ultra Tech uses: <img data-largeimg="...">
    image_url = None
    main_img = (
        soup.select_one("img[data-largeimg]") or
        soup.select_one(".swiper-slide img") or
        soup.select_one(".product-image img")
    )
    if main_img:
        # Prefer data-largeimg for high-res
        image_url = (
            main_img.get("data-largeimg") or
            main_img.get("data-zoom-image") or
            main_img.get("src") or
            main_img.get("data-src")
        )
    
    # Price - Ultra Tech uses: <div class="product-price-new">35,000৳</div>
    # Avoid: <div class="product-price-old">36,800৳</div>
    price_text = None
    price_new = soup.select_one(".product-price-new")
    if price_new:
        price_text = price_new.get_text(strip=True)
    
    # Fallback: look for price elements but avoid old prices
    if not price_text:
        for el in soup.select(".price, .product-price, [class*='price']"):
            # Skip if it's an old price
            if "price-old" in str(el.get("class", [])).lower() or el.select_one(".price-old, .old-price"):
                continue
            text = el.get_text(strip=True)
            if "৳" in text:
                price_text = text
                break
    
    # Availability - Ultra Tech uses: <li class="product-stock in-stock"><b>Stock:</b> <span>In Stock</span></li>
    availability_text = None
    stock_li = soup.select_one("li.product-stock, li.in-stock, li.out-of-stock")
    if stock_li:
        # Extract from the span inside
        stock_span = stock_li.select_one("span")
        if stock_span:
            availability_text = stock_span.get_text(strip=True)
        else:
            # Fallback to full text
            text = stock_li.get_text(strip=True)
            # Extract text after "Stock:" if present
            if "Stock:" in text:
                parts = text.split("Stock:", 1)
                if len(parts) > 1:
                    availability_text = parts[1].strip()
            else:
                availability_text = text
    
    # Fallback: look for stock indicators
    if not availability_text:
        stock_indicators = soup.select(".stock, .availability, [class*='stock']")
        for indicator in stock_indicators:
            text = indicator.get_text(strip=True).lower()
            if any(word in text for word in ["stock", "available", "in stock", "out of stock"]):
                availability_text = indicator.get_text(strip=True)
                break
    
    # Specifications ONLY (skip "Key Features" and other unnecessary info)
    description_parts = []
    spec_tab = soup.select_one("#tab-specification")
    
    if spec_tab:
        # Extract from specification table
        spec_table = spec_tab.select_one("table.table.table-bordered, table.table, table")
        if spec_table:
            # Skip header rows (thead with colspan="2")
            for row in spec_table.select("tbody tr"):
                cells = row.select("td")
                # Skip header rows (colspan="2" or in thead)
                if len(cells) >= 2:
                    # Check if it's a header row (usually has colspan or strong tag)
                    is_header = any(
                        cell.get("colspan") or 
                        cell.select_one("strong") or
                        "heading" in str(cell.get("class", [])).lower()
                        for cell in cells
                    )
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