from __future__ import annotations

import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional


def _normalize_unicode(value: str) -> str:
    """Normalize unicode text (NFKC) and trim surrounding whitespace."""
    normalized = unicodedata.normalize("NFKC", value)
    return normalized.strip()


def collapse_whitespace(value: str) -> str:
    """Collapse consecutive whitespace characters into a single space."""
    return re.sub(r"\s+", " ", value)


def clean_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return collapse_whitespace(_normalize_unicode(value))


def normalize_key(value: Optional[str]) -> str:
    """Lowercase key used for matching (raw_name/category)."""
    return clean_text(value).lower()


def normalize_url(url: Optional[str]) -> str:
    if not url:
        return ""
    trimmed = url.strip()
    # Remove trailing slash for consistency
    if trimmed.endswith("/"):
        trimmed = trimmed.rstrip("/")
    return trimmed


def tokenize_name(value: str) -> str:
    """
    Generate a slug/tokenized version of the provided name.
    Example: "AMD Ryzen 5 5600G" -> "amd-ryzen-5-5600g".
    """
    cleaned = clean_text(value).lower()
    cleaned = unicodedata.normalize("NFKD", cleaned)
    cleaned = "".join(ch for ch in cleaned if not unicodedata.combining(ch))
    cleaned = re.sub(r"[^a-z0-9\s-]", "", cleaned)
    cleaned = re.sub(r"\s+", "-", cleaned).strip("-")
    return cleaned or "unknown"


def extract_brand(raw_name: str) -> str:
    """
    Extract the brand from the vendor's raw product name.
    The first token usually represents the brand (e.g., AMD, MSI, ASUS).
    """
    cleaned = clean_text(raw_name)
    if not cleaned:
        return "UNKNOWN"
    first_token = cleaned.split(" ")[0]
    brand = re.sub(r"[^A-Za-z0-9-]", "", first_token).upper()
    return brand or "UNKNOWN"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")

