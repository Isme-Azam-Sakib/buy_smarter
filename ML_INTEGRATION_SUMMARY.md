# ML Integration Summary - Priority 1 & 2

## Database Schema Changes

Three new columns have been added to `all_products` table:

1. **`scrape_source`** (TEXT, DEFAULT 'bulk')
   - Values: `'bulk'` | `'page_visit'`
   - Tracks how the product was last scraped

2. **`standard_name_source`** (TEXT, DEFAULT 'bulk')
   - Values: `'bulk'` | `'page_visit'` | `'ml_page_visit'`
   - Tracks how `standard_name` was determined

3. **`ml_confidence`** (REAL, NULL)
   - Stores ML confidence score (0.0-1.0) when `standard_name` was set via ML
   - NULL if not set by ML

## Implementation Details

### Priority 1: Page Visit Scraping - Standard Name ML Update

**Location**: `scrapers/product_refresh.py` → `scrape_single_product()`

**What it does**:
- When a product is scraped via page visit (product details page), uses ML to predict a better `standard_name`
- Only runs for page visit scrapes (narrow scope)
- Uses high confidence threshold (0.7) for safety
- Falls back to `raw_name` if ML fails or models don't exist

**How it works**:
1. Scrapes product detail page
2. Gets `raw_name` from vendor
3. Calls ML model to predict `standard_name`
4. If confidence ≥ 0.7, uses ML-predicted `standard_name`
5. Sets `scrape_source = 'page_visit'` and `standard_name_source = 'ml_page_visit'` or `'page_visit'`

**Safety**:
- High confidence threshold (0.7)
- Fails silently if ML models don't exist
- Only affects products viewed on detail pages
- Easy to roll back (just re-scrape)

### Priority 2: Page Visit Scraping - Product Matching Fallback

**Location**: `scrapers/db_sync.py` → `sync_vendor_rows()`

**What it does**:
- When URL and name matching both fail for a page visit scrape, uses ML to find existing product
- Only runs for page visit scrapes (narrow scope)
- Uses very high confidence threshold (0.75) for safety
- Only matches within same vendor and category

**How it works**:
1. Tries URL matching → fails
2. Tries (category, raw_name) matching → fails
3. If `scrape_source == 'page_visit'`, calls ML model
4. If ML finds match with confidence ≥ 0.75, links to existing product
5. Updates that product instead of creating duplicate

**Safety**:
- Very high confidence threshold (0.75)
- Only matches within same vendor and category
- Only affects unmatched products from page visits
- Logs all ML matches for audit

## Bulk Scrapes

All bulk scrapes are explicitly marked:
- `scrape_source = 'bulk'`
- `standard_name_source = 'bulk'`
- ML is **never** used for bulk scrapes

Updated files:
- `scrapers/techland/scrape_techland.py`
- `scrapers/startech/scrape_startech.py`
- `scrapers/skyland/scrape_skyland.py`
- `scrapers/pchouse/scrape_pchouse.py`
- `scrapers/ultratech/scrape_ultratech.py`
- `scrapers/ryans/scrape_ryans.py`

## Database Updates

**Insert**: New products include all three new columns
**Update**: 
- Always updates `scrape_source`
- For page visit scrapes with ML, updates `standard_name`, `standard_name_source`, `ml_confidence`, and `tokenized_name`

## Migration

Run the migration script to add columns to existing database:
```bash
python scripts/migrate_add_scrape_source.py
```

All existing rows are set to:
- `scrape_source = 'bulk'`
- `standard_name_source = 'bulk'`
- `ml_confidence = NULL`

## Testing

To test the integration:

1. **Test Priority 1** (Standard Name ML Update):
   - Visit a product details page
   - Check if `standard_name` was updated via ML
   - Check `standard_name_source` and `ml_confidence` columns

2. **Test Priority 2** (ML Matching Fallback):
   - Visit a product details page for a product that doesn't match by URL or name
   - Check if ML matched it to an existing product
   - Check logs for `[ML Match]` messages

## Monitoring

Look for these log messages:
- `[ML] Standard name updated: '...' -> '...' (confidence: X.XX)` - Priority 1 working
- `[ML Match] Matched '...' -> '...' (confidence: X.XX, product_id: XXX)` - Priority 2 working
- `[ML] Error: ...` - ML errors (non-critical, falls back gracefully)

## Safety Features

1. **High Confidence Thresholds**: 0.7 for standard_name, 0.75 for matching
2. **Narrow Scope**: Only page visit scrapes use ML
3. **Graceful Degradation**: Fails silently if ML models don't exist
4. **Audit Trail**: All ML changes are logged with confidence scores
5. **Bulk Scrapes Protected**: Bulk scrapes never use ML

## Next Steps

1. Monitor ML usage and accuracy
2. Adjust confidence thresholds if needed
3. Consider adding admin tools for manual ML corrections (Priority 3)
4. Consider read-only integrations (Priority 4-5) for search and anomaly detection

