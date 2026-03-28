import time
import random
import requests
from typing import Optional

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch(url: str, *, timeout: int = 25, max_retries: int = 3) -> Optional[str]:
    """Fetch a URL with simple retry and return text or None on failure."""
    sleep = 1.0
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
            if resp.status_code == 200 and resp.text:
                return resp.text
            # Retry for transient server/client issues
            if resp.status_code in {403, 429, 500, 502, 503, 504}:
                raise requests.RequestException(f"HTTP {resp.status_code}")
            return None
        except requests.RequestException:
            if attempt == max_retries:
                return None
            # Exponential backoff with jitter
            time.sleep(sleep + random.uniform(0, 0.5))
            sleep *= 1.8
    return None
