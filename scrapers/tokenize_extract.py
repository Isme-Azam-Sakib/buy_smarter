"""
Extract tokenized_name from raw_name based on category-specific rules.
This matches the TypeScript implementation in lib/tokenize-name.ts

Returns tokenized_name as a JSON array string, e.g., '["geforce", "rtx", "5090", "32g", "gaming", "trio", "oc"]'
"""
import json

# Category-specific unnecessary words
CPU_UNNECESSARY_WORDS = [
    'processor', 'cpu', 'with', 'rebox', 'radeon', 'graphics', 'gaming', 'am4', 'am5', '1700',
    'desktop', 'bundle', 'gen', 'generation', 'raptor', 'alder', 'pc', '4th', '5th', '6th',
    '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', 'vega 3', 'socket',
    'vega 11', 'rx', 'lga', 'tray', 'eration', 'threads', 'cores', 'full', 'bulk', 'lga1155',
    '-', 'cooler', 'Quad-Core', 'thread'
]

GPU_UNNECESSARY_WORDS = [
    'display', 'pcie', 'vga', 'hdmi', 'pci', 'express', 'video', 'output', 'port', 'ports',
    'fan', 'fans', 'cooled', 'cooling', 'memory', 'graphics', 'card', 
    'overclocked', 'factory', 'rgb', 'argb', 'led', 'lighting',
    'triple', 'dual', 'single', 'double', 'quad',
]

COOLER_UNNECESSARY_WORDS = [
    'cooler', 'cpu', 'processor', 'liquid', 'all', 'in', 'one', 'sync', 'icue', 'fan', 'led',
    'water', 'high-performance', 'all-in-one', 'link', 'gaming', '-', 'low-profile'
]

RAM_UNNECESSARY_WORDS = [
    'ram', 'desktop', 'gaming', 'u-dimm', 'heatsink', 'with', 'signature', 'line', 'udimm'
]

POWER_SUPPLY_UNNECESSARY_WORDS = [
    'power', 'supply', 'psu', 'unit', 'watt', 'watts', 'smart', 'real', 'warranty', 'premium',
    'lownoise', 'output', 'certified', 'efficiency', 'certification', 'fan', 'silent', 'cooling',
    'active', 'pfc', 'hydraulic', 'bearing', 'protection', 'ovp', 'opp', 'uvp', 'scp', 'ocp',
    'otp', 'gaming', 'high', 'performance', 'grade', 'series', 'edition', 'model', 'cable',
    'flat', 'rail', 'single', 'dual', 'with', 'for'
]

SSD_UNNECESSARY_WORDS = [
    'ssd', 'solid', 'state', 'drive', 'disk', 'hard', 'gaming', 'drive', 'portable', 'cache',
    'internal', 'with', 'gaming', 'performance', 'pro', 'ultra', 'lite', 'extreme', 'max',
    'series', 'edition', 'model', 'dram', 'internal', 'external', 'desktop', 'laptop', 'notebook',
    'flash', 'nand', '3d', 'tlc', 'qlc', 'mlc', 'slc', 'heatsink', 'heat', 'shield', 'spreader',
    'rgb', 'argb', 'led', 'lighting', 'save', 'offer', 'bundle', 'promo', 'discount', 'with',
    'for', 'plus'
]

MOTHERBOARD_UNNECESSARY_WORDS = [
    'motherboard', 'mainboard', 'mobo', 'board', 'gaming', 'workstation', 'server',
    'wifi', 'wi-fi', 'bluetooth', 'bt', 'lan', 'ethernet', 'usb', 'type-c',
    'rgb', 'argb', 'aura', 'sync', 'mystic', 'light', 'led', 'lighting',
]

CASING_UNNECESSARY_WORDS = [
    'casing', 'case', 'chassis', 'tower', 'cabinet', 'enclosure', 'housing',
    'gaming', 'mid', 'full', 'mini', 'compact', 'mesh', 'tempered', 'glass',
    'rgb', 'argb', 'led', 'lighting', 'fan', 'fans', 'included', 'pre-installed',
    'airflow', 'ventilation', 'side', 'panel', 'window', 'transparent', 'acrylic',
]

DESKTOP_RAM_UNNECESSARY_WORDS = [
    'ram', 'desktop', 'gaming', 'u-dimm', 'heatsink', 'with', 'signature', 'line', 'udimm',
    'memory', 'module', 'kit', 'pack', 'set', 'pc', 'computer',
]

# Map category to unnecessary words
CATEGORY_UNNECESSARY_WORDS = {
    'processor': CPU_UNNECESSARY_WORDS,
    'cpu': CPU_UNNECESSARY_WORDS,
    'graphics-card': GPU_UNNECESSARY_WORDS,
    'gpu': GPU_UNNECESSARY_WORDS,
    'cpu-cooler': COOLER_UNNECESSARY_WORDS,
    'cooler': COOLER_UNNECESSARY_WORDS,
    'ram': RAM_UNNECESSARY_WORDS,
    'desktop-ram': DESKTOP_RAM_UNNECESSARY_WORDS,
    'power-supply': POWER_SUPPLY_UNNECESSARY_WORDS,
    'psu': POWER_SUPPLY_UNNECESSARY_WORDS,
    'ssd': SSD_UNNECESSARY_WORDS,
    'internal-ssd': SSD_UNNECESSARY_WORDS,
    'storage': SSD_UNNECESSARY_WORDS,
    'motherboard': MOTHERBOARD_UNNECESSARY_WORDS,
    'casing': CASING_UNNECESSARY_WORDS,
}


def standardize_name(raw_name: str, category: str = None) -> str:
    """
    Generate a standardized product name from raw vendor name.
    
    This removes:
    - The first word (brand name)
    - Unnecessary words based on category
    - Common marketing/generic words
    
    Args:
        raw_name: The raw product name from vendor
        category: Product category for category-specific cleaning
        
    Returns:
        Cleaned, standardized product name (without brand)
    """
    import re
    
    if not raw_name or not raw_name.strip():
        return raw_name or ''
    
    text = raw_name.strip()
    
    # Get category-specific unnecessary words
    unnecessary = set()
    if category:
        category_lower = category.lower()
        if category_lower in CATEGORY_UNNECESSARY_WORDS:
            unnecessary = set(w.lower() for w in CATEGORY_UNNECESSARY_WORDS[category_lower])
    
    # Common unnecessary words across all categories
    common_unnecessary = {
        'new', 'original', 'genuine', 'authentic', 'official', 'warranty',
        'free', 'shipping', 'hot', 'sale', 'promo', 'discount', 'offer',
        'best', 'quality', 'premium', 'professional', 'special', 'limited',
        'edition', 'version', 'latest', 'brand', 'boxed', 'sealed', 'retail',
        '-', '/', '|', '–', '—', 'years', 'year', 'bd', 'bangladesh',
        'triple', 'dual', 'single', 'double', 'overclocked', 'factory',
    }
    unnecessary.update(common_unnecessary)
    
    # Split into words
    words = text.split()
    
    # Skip the first word (brand name) if there are multiple words
    if len(words) > 1:
        words = words[1:]
    
    # Filter words
    cleaned_words = []
    for word in words:
        word_lower = word.lower().strip('.,;:!?()[]{}')
        
        # Skip empty or very short words (except model numbers like "i5", "X3")
        if not word_lower or (len(word_lower) < 2 and not word_lower.isdigit()):
            continue
        
        # Skip if in unnecessary words
        if word_lower in unnecessary:
            continue
        
        # Skip generic marketing phrases (but keep for GPUs and motherboards where they're model names)
        if category and category.lower() not in ['graphics-card', 'motherboard', 'gpu']:
            if any(phrase in word_lower for phrase in ['gamer', 'elite', 'extreme']):
                continue
        
        cleaned_words.append(word)
    
    # Rejoin and clean up spacing
    result = ' '.join(cleaned_words)
    
    # Remove extra whitespace
    result = re.sub(r'\s+', ' ', result).strip()
    
    # If result is too short, fall back to original (minus obvious junk)
    if len(result) < 10 and len(raw_name) > len(result) * 2:
        # Just do basic cleanup
        result = re.sub(r'\s+', ' ', raw_name).strip()
    
    return result


def extract_tokenized_name(standard_name: str, category: str = None) -> str:
    """
    Extract tokenized_name from standard_name.
    
    Tokenized name is the cleaned standard_name split into words as a JSON array,
    with unnecessary words removed based on category.
    
    Args:
        standard_name: The standard product name
        category: Product category for category-specific filtering
        
    Returns:
        Tokenized name as JSON array string, e.g., '["geforce", "rtx", "4070", "ti", "super", "16gb"]'
    """
    if not standard_name or not standard_name.strip():
        return ''
    
    # Get category-specific unnecessary words
    unnecessary = set()
    if category:
        category_lower = category.lower()
        if category_lower in CATEGORY_UNNECESSARY_WORDS:
            unnecessary = set(w.lower() for w in CATEGORY_UNNECESSARY_WORDS[category_lower])
    
    # Split standard_name into words and convert to lowercase
    words = standard_name.strip().split()
    
    # Filter and clean words
    cleaned_words = []
    for word in words:
        word_lower = word.lower().strip('.,;:!?()[]{}')
        
        # Skip empty words
        if not word_lower:
            continue
        
        # Skip unnecessary words
        if word_lower in unnecessary:
            continue
            
        cleaned_words.append(word_lower)
    
    if not cleaned_words:
        # Fallback: just split the original
        cleaned_words = [w.lower() for w in standard_name.strip().split() if w]
    
    # Return as JSON array string
    return json.dumps(cleaned_words)

