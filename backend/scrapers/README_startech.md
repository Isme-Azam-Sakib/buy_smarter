# Star Tech Scraper

A robust web scraper for startech.com.bd that extracts PC component information with accurate product identification and detailed specification parsing.

## Features

- **Accurate Product Identification**: Distinguishes between similar products (e.g., Ryzen 7700 vs 7700X vs 7700XT)
- **Category-Specific Spec Extraction**: Extracts specifications according to database schema for each component type
- **Two-Tier Reconciliation**: Integrates with master product catalog using fuzzy matching and AI
- **Enhanced Brand Detection**: Improved brand extraction with common variations
- **Comprehensive Error Handling**: Robust handling of missing elements and malformed data

## Files

- `startech_scraper.py` - Main scraper class with category-specific spec parsers
- `scrape_startech.py` - Integration script with reconciliation service
- `test_startech_scraper.py` - Test suite for validation

## Usage

### Basic Scraping

```python
from scrapers.startech_scraper import StarTechScraper

scraper = StarTechScraper()
products = await scraper.scrape_all_products()
```

### Full Integration with Reconciliation

```bash
cd backend/scripts
python scrape_startech.py
```

### Run Tests

```bash
cd backend/scripts
python test_startech_scraper.py
```

## Supported Categories

- **CPU**: Processors with socket, TDP, cores, threads, clocks, cache specs
- **GPU**: Graphics cards with memory, clocks, TDP, bus width, CUDA cores
- **RAM**: Memory modules with capacity, speed, type, CAS latency, voltage
- **Motherboard**: Motherboards with socket, chipset, form factor, slots
- **PSU**: Power supplies with wattage, efficiency, modularity, connectors
- **Storage**: SSDs/HDDs with capacity, interface, speeds, endurance
- **Case**: Cases with form factor, clearances, bays, fan mounts
- **Cooling**: Cooling solutions (fans, coolers, etc.)

## Product Validation

The scraper includes sophisticated validation to prevent misidentification:

- **Brand-Category Validation**: NVIDIA only makes GPUs, AMD makes both CPUs and GPUs
- **Model Number Validation**: Distinguishes 7700X (CPU) from 7700XT (GPU)
- **Category Cross-Validation**: Ensures product descriptions match assigned categories

## Specification Mapping

Each category extracts specifications that map directly to the database schema:

### CPU Specs
- `socket_type`, `tdp_watts`, `core_count`, `thread_count`
- `base_clock`, `boost_clock`, `cache_l3`, `integrated_graphics`

### GPU Specs
- `memory_size`, `memory_type`, `base_clock`, `boost_clock`
- `tdp_watts`, `memory_bus_width`, `cuda_cores`

### RAM Specs
- `capacity`, `speed`, `type`, `cas_latency`, `voltage`, `form_factor`

### Motherboard Specs
- `socket_type`, `chipset`, `form_factor`, `memory_slots`
- `memory_type`, `max_memory`, `pcie_slots`, `sata_ports`, `m2_slots`, `usb_ports`

### PSU Specs
- `wattage`, `efficiency`, `modularity`, `form_factor`
- `pcie_connectors`, `sata_connectors`, `molex_connectors`

### Storage Specs
- `capacity`, `interface`, `form_factor`, `read_speed`, `write_speed`
- `tbw` (SSD), `rpm` (HDD), `cache` (HDD)

### Case Specs
- `form_factor`, `max_gpu_length`, `max_cpu_height`
- `drive_bays`, `fan_mounts`, `usb_ports`, `rgb_support`

## Error Handling

- Graceful handling of missing product elements
- Network error recovery with retries
- Malformed data validation and filtering
- Comprehensive logging for debugging

## Rate Limiting

- Respectful delays between requests (1-2 seconds)
- Random delays to avoid detection
- Category-level delays (2-4 seconds)

## Dependencies

- `aiohttp` - Async HTTP client
- `beautifulsoup4` - HTML parsing
- `rapidfuzz` - Fuzzy string matching
- `sqlalchemy` - Database ORM
