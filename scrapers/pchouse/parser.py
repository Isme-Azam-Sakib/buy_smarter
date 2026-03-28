from __future__ import annotations
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import json


def parse_listing(html: str) -> List[Dict[str, Optional[str]]]:
    soup = BeautifulSoup(html, "html.parser")
    items: List[Dict[str, Optional[str]]] = []

    # PC House uses .single-product-item within .col-lg-3
    for card in soup.select(".single-product-item"):
        # Name and URL
        name_link = card.select_one("h4 a")
        name = name_link.get_text(strip=True) if name_link else None
        url = name_link.get("href") if name_link else None

        # Image
        img = card.select_one("img")
        image_url = img.get("src") if img else None

        # Price - prefer special-price, fallback to regular-price
        price_el = card.select_one(".special-price") or card.select_one(".regular-price")
        price_text = price_el.get_text(" ", strip=True) if price_el else None

        # Availability - assume in stock if buy button is present
        availability_text = None
        buy_btn = card.select_one(".buy-btn")
        if buy_btn:
            availability_text = "In Stock"

        # Description - empty for now as PC House doesn't show features in listing
        description_json = None

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


def parse_product_detail(html: str, product_url: str) -> Optional[Dict[str, Optional[str]]]:
    """Parse a single product detail page.
    
    Returns dict with: raw_name, price_text, availability_text, product_url, image_url, description
    """
    soup = BeautifulSoup(html, "html.parser")
    
    # Product name - PC House uses: <h1 class="product-name">
    name_el = (
        soup.select_one("h1.product-name") or
        soup.select_one("h1") or
        soup.select_one(".product-title")
    )
    name = name_el.get_text(strip=True) if name_el else None
    
    # High-resolution image - PC House uses: <img class="main-img"> or thumbnail href
    image_url = None
    main_img = soup.select_one("img.main-img")
    if main_img:
        # Try to get high-res from thumbnail href first
        thumbnail_link = main_img.find_parent("a", class_="thumbnail")
        if thumbnail_link and thumbnail_link.get("href"):
            image_url = thumbnail_link.get("href")
        else:
            # Fallback to img src
            image_url = main_img.get("src") or main_img.get("data-src")
    
    # Price - PC House uses: <span class="value">9,000৳ <del>9,290৳</del></span>
    # Or in payment options: <span class="price">9,000৳</span> with <del>9,290৳</del>
    # Special case: "Up Coming" products may have price in EMI section
    price_text = None
    
    # Strategy 1: Look in product-info-badges for price value
    # Check all info-items to find the one with "Price:" label
    for info_item in soup.select(".product-info-badges .info-item"):
        label = info_item.select_one("span.label")
        if label and "Price:" in label.get_text():
            value_span = info_item.select_one("span.value")
            if value_span:
                # Remove <del> tags to get only the new price
                for del_tag in value_span.select("del"):
                    del_tag.decompose()
                price_text = value_span.get_text(strip=True)
                # If price is "Up Coming" or "Out Of Stock", don't use it
                if price_text:
                    price_lower = price_text.lower()
                    if "up coming" in price_lower or "upcoming" in price_lower:
                        price_text = None  # Reset to try other strategies
                    elif "out of stock" in price_lower or "stock out" in price_lower:
                        price_text = None  # Don't extract price for out of stock
                    else:
                        break  # Found valid price
    
    # Strategy 2: Look in payment options for cash price (avoid EMI)
    # Check the first cash-payment option (usually the cash discount price)
    if not price_text or (price_text and "up coming" in price_text.lower()):
        cash_payments = soup.select(".p-wrap.cash-payment, label.cash-payment")
        for cash_payment in cash_payments:
            # Skip if it's the EMI option (has input value="1")
            emi_input = cash_payment.select_one('input[name="enable_emi"][value="1"]')
            if emi_input:
                continue
            price_span = cash_payment.select_one("span.price")
            if price_span:
                price_text = price_span.get_text(strip=True)
                # If still "Up Coming", try to extract from EMI regular price
                if price_text and "up coming" in price_text.lower():
                    # Look for "Regular Price: X৳" in the EMI option
                    emi_payment = soup.select_one('label.p-wrap.cash-payment input[value="1"]')
                    if emi_payment:
                        emi_label = emi_payment.find_parent("label")
                        if emi_label:
                            # Look for "Regular Price: X৳" text
                            import re
                            emi_text = emi_label.get_text()
                            regular_price_match = re.search(r'Regular Price:\s*([\d,]+(?:\.\d+)?)\s*৳', emi_text)
                            if regular_price_match:
                                price_text = regular_price_match.group(1) + "৳"
                                break
                    price_text = None  # Reset if no valid price found
                else:
                    break  # Found valid price
    
    # Strategy 3: Fallback - look for any price element but avoid old prices and "Up Coming"
    if not price_text:
        for el in soup.select(".price, .value, [class*='price']"):
            # Skip if it contains del/old price
            if el.select_one("del, .old-price, .price-old"):
                continue
            text = el.get_text(strip=True)
            # Skip "Up Coming" text
            if "up coming" in text.lower() or "upcoming" in text.lower():
                continue
            if "৳" in text and "/month" not in text.lower():
                # Extract just the price number
                import re
                price_match = re.search(r'([\d,]+(?:\.\d+)?)\s*৳', text)
                if price_match:
                    price_text = price_match.group(1) + "৳"
                    break
    
    # Availability - PC House uses: <div class="info-item"><span class="label">Status:</span><span class="value">In Stock</span></div>
    availability_text = None
    # Find info-item with "Status:" label
    for info_item in soup.select(".product-info-badges .info-item, .info-item"):
        label = info_item.select_one("span.label")
        if label and "Status:" in label.get_text():
            value = info_item.select_one("span.value")
            if value:
                availability_text = value.get_text(strip=True)
                break
    
    # Check if price shows "Out Of Stock" or "Price: Out Of Stock"
    if not availability_text:
        price_info_item = None
        for info_item in soup.select(".product-info-badges .info-item, .info-item"):
            label = info_item.select_one("span.label")
            if label and "Price:" in label.get_text():
                value = info_item.select_one("span.value")
                if value:
                    value_text = value.get_text(strip=True).lower()
                    if "out of stock" in value_text:
                        availability_text = "Out Of Stock"
                        break
    
    # Fallback 1: Check if buy button is disabled with "Up Coming" or "Out Of Stock" text
    if not availability_text:
        buy_button = soup.select_one("#button-cart, .buy-now, button[data-loading-text], button.btn-cart")
        if buy_button:
            button_text = buy_button.get_text(strip=True)
            is_disabled = buy_button.has_attr("disabled") or "disabled" in buy_button.get("class", [])
            button_text_lower = button_text.lower()
            if "out of stock" in button_text_lower or "stock out" in button_text_lower:
                availability_text = "Out Of Stock"
            elif "up coming" in button_text_lower or "upcoming" in button_text_lower:
                availability_text = "Up Coming"
            elif is_disabled and button_text:
                # If disabled but not "Up Coming", might be out of stock
                availability_text = button_text
            elif not is_disabled:
                # Button is enabled, likely in stock
                availability_text = "In Stock"
    
    # Fallback 2: Check payment options section for "Out Of Stock" text
    if not availability_text:
        payment_section = soup.select_one(".payment-options, .p-wrap")
        if payment_section:
            payment_text = payment_section.get_text().lower()
            if "out of stock" in payment_text:
                availability_text = "Out Of Stock"
    
    # Fallback 3: look for stock indicators
    if not availability_text:
        stock_indicators = soup.select(".stock, .availability, [class*='stock'], [class*='status']")
        for indicator in stock_indicators:
            text = indicator.get_text(strip=True).lower()
            if any(word in text for word in ["stock", "available", "in stock", "out of stock", "up coming", "upcoming"]):
                availability_text = indicator.get_text(strip=True)
                break
    
    # IMPORTANT: If price is 0 or None, and availability is still unknown, treat as out of stock
    if not availability_text and (not price_text or price_text == "0" or price_text == "৳0" or price_text == "0৳"):
        availability_text = "Out Of Stock"
    
    # Specifications ONLY (skip description and other unnecessary info)
    description_parts = []
    spec_section = soup.select_one("#specification, .specification-tab")
    
    if spec_section:
        # Extract from specification table
        spec_table = spec_section.select_one("table.data-table, table")
        if spec_table:
            # Skip header rows (thead with heading-row)
            for row in spec_table.select("tbody tr"):
                cells = row.select("td")
                # Skip header rows (heading-row class or in thead)
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


def parse_next_page_url(html: str, current_url: str) -> Optional[str]:
    soup = BeautifulSoup(html, "html.parser")
    # Look for pagination links
    for a in soup.select(".pagination a, .pager a"):
        txt = a.get_text(strip=True).lower()
        if txt in {"next", ">", ">>", "›"} and a.get("href"):
            return a.get("href")
    # Look for numbered pagination
    active = soup.select_one(".pagination .active, .pagination .current")
    if active:
        li = active.find_parent("li")
        if li and li.find_next_sibling("li"):
            nxt = li.find_next_sibling("li").find("a")
            if nxt and nxt.get("href"):
                return nxt.get("href")
    return None
