from __future__ import annotations
import re
from datetime import datetime, timezone
from typing import Optional, Tuple

BDT_SYMBOLS = ["৳", "Tk", "BDT", "tk", "টাকা"]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def parse_price_bdt(price_text: Optional[str]) -> Tuple[Optional[float], str]:
    if not price_text:
        return None, "BDT"
    cleaned = price_text
    for sym in BDT_SYMBOLS:
        cleaned = cleaned.replace(sym, " ")
    cleaned = cleaned.replace(",", "")
    nums = re.findall(r"\d+(?:\.\d+)?", cleaned)
    if not nums:
        return None, "BDT"
    try:
        return float(nums[0]), "BDT"
    except ValueError:
        return None, "BDT"


def normalize_availability(text: Optional[str]) -> str:
    if not text:
        return "unknown"
    t = text.strip().lower()
    if any(k in t for k in ["in stock", "available"]):
        return "in_stock"
    if any(k in t for k in ["up coming", "upcoming", "coming soon"]):
        return "upcoming"
    if any(k in t for k in ["pre order", "pre-order", "preorder"]):
        return "pre_order"
    if any(k in t for k in ["out of stock", "sold out", "stock out"]):
        return "out_of_stock"
    return "unknown"
