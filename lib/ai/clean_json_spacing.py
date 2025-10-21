#!/usr/bin/env python3
"""
Clean JSON Spacing - Remove extra spaces from product names in CPU analysis JSON
"""

import json
import re

def clean_product_name(name):
    """Clean product name by removing extra spaces and hyphens"""
    if not isinstance(name, str):
        return name
    
    # Remove multiple consecutive spaces and replace with single space
    cleaned = re.sub(r'\s+', ' ', name)
    
    # Remove hyphens and replace with spaces
    cleaned = cleaned.replace('-', ' ')
    
    # Remove multiple consecutive spaces again after hyphen removal
    cleaned = re.sub(r'\s+', ' ', cleaned)
    
    # Remove leading and trailing spaces
    cleaned = cleaned.strip()
    
    return cleaned

def clean_cpu_analysis_json(input_file='cpu_analysis.json', output_file='cpu_analysis_cleaned.json'):
    """Clean the CPU analysis JSON file"""
    
    print(f"Loading {input_file}...")
    
    # Load the JSON file
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Original data loaded with {len(data.get('price_mapping', {}))} products")
    
    # Clean the price mapping
    cleaned_price_mapping = {}
    changes_made = 0
    
    for product_name, price_data in data.get('price_mapping', {}).items():
        # Clean the product name
        cleaned_name = clean_product_name(product_name)
        
        if cleaned_name != product_name:
            changes_made += 1
            print(f"Cleaned: '{product_name}' -> '{cleaned_name}'")
        
        # Clean raw names in the price data
        cleaned_price_data = []
        for price_info in price_data:
            cleaned_price_info = price_info.copy()
            cleaned_price_info['raw_name'] = clean_product_name(price_info.get('raw_name', ''))
            cleaned_price_data.append(cleaned_price_info)
        
        cleaned_price_mapping[cleaned_name] = cleaned_price_data
    
    # Update the data
    data['price_mapping'] = cleaned_price_mapping
    
    # Clean market summary if it exists
    if 'market_summary' in data:
        # Clean vendor analysis
        if 'vendor_analysis' in data['market_summary']:
            cleaned_vendor_analysis = {}
            for vendor, stats in data['market_summary']['vendor_analysis'].items():
                cleaned_vendor = clean_product_name(vendor)
                cleaned_vendor_analysis[cleaned_vendor] = stats
            data['market_summary']['vendor_analysis'] = cleaned_vendor_analysis
        
        # Clean brand analysis
        if 'brand_analysis' in data['market_summary']:
            cleaned_brand_analysis = {}
            for brand, stats in data['market_summary']['brand_analysis'].items():
                cleaned_brand = clean_product_name(brand)
                cleaned_brand_analysis[cleaned_brand] = stats
            data['market_summary']['brand_analysis'] = cleaned_brand_analysis
    
    # Save the cleaned data
    print(f"\nSaving cleaned data to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Cleaning completed!")
    print(f"Changes made: {changes_made} product names cleaned")
    print(f"Cleaned file saved as: {output_file}")
    
    return data

def main():
    """Main function"""
    print("="*60)
    print("CLEANING CPU ANALYSIS JSON - REMOVING EXTRA SPACES")
    print("="*60)
    
    # Clean the JSON file
    cleaned_data = clean_cpu_analysis_json()
    
    print("\n" + "="*60)
    print("CLEANING COMPLETED!")
    print("="*60)
    print("\nThe cleaned file has been saved as 'cpu_analysis_cleaned.json'")
    print("You can now use this cleaned version for your AI model training.")

if __name__ == "__main__":
    main()
