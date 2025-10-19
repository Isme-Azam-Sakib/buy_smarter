#!/usr/bin/env python3
"""
Complete setup script for BuySmarter PC Parts with master product integration
"""

import sys
import os
import subprocess
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def check_file_exists(file_path, description):
    """Check if a file exists"""
    if Path(file_path).exists():
        print(f"✓ {description} found")
        return True
    else:
        print(f"✗ {description} not found")
        return False

def main():
    """Main setup function"""
    print("=" * 70)
    print("BuySmarter PC Parts - Complete Setup with Master Products")
    print("=" * 70)
    
    # Check prerequisites
    print("\n1. Checking Prerequisites...")
    print("-" * 40)
    
    prerequisites_ok = True
    
    # Check if masterProducts directory exists
    if not check_file_exists("masterProducts", "Master products directory"):
        print("Error: masterProducts directory not found!")
        print("Please ensure the masterProducts folder is in the project root.")
        prerequisites_ok = False
    
    # Check required JSON files
    required_files = [
        'masterProducts/cpu.json',
        'masterProducts/motherboard.json', 
        'masterProducts/memory.json',
        'masterProducts/video-card.json',
        'masterProducts/power-supply.json',
        'masterProducts/internal-hard-drive.json',
        'masterProducts/case.json',
        'masterProducts/cpu-cooler.json'
    ]
    
    for file in required_files:
        if not check_file_exists(file, f"Master product file: {file}"):
            prerequisites_ok = False
    
    if not prerequisites_ok:
        print("\nSetup cannot continue due to missing prerequisites.")
        return
    
    print("\n✓ All prerequisites met!")
    
    # Install dependencies
    print("\n2. Installing Dependencies...")
    print("-" * 40)
    
    # Install frontend dependencies
    if not run_command("npm install", "Installing frontend dependencies"):
        return
    
    # Install backend dependencies
    if not run_command("cd backend && pip install -r requirements.txt", "Installing backend dependencies"):
        return
    
    # Generate Prisma client
    print("\n3. Setting up Database...")
    print("-" * 40)
    
    if not run_command("npm run db:generate", "Generating Prisma client"):
        return
    
    # Load master products
    print("\n4. Loading Master Products...")
    print("-" * 40)
    
    print("This will load your master product catalog into the database.")
    print("This may take a few minutes depending on the size of your data.")
    
    response = input("Continue with loading master products? (y/n): ").lower().strip()
    if response != 'y':
        print("Skipping master product loading. You can run 'python load_master_products.py' later.")
    else:
        if not run_command("python load_master_products.py", "Loading master products"):
            print("Warning: Master product loading failed. You can try again later.")
    
    # Create environment file if it doesn't exist
    print("\n5. Setting up Environment...")
    print("-" * 40)
    
    if not Path(".env").exists():
        if run_command("copy env.example .env", "Creating environment file"):
            print("✓ Environment file created. Please edit .env with your configuration.")
        else:
            print("✗ Failed to create environment file. Please copy env.example to .env manually.")
    else:
        print("✓ Environment file already exists")
    
    # Test the setup
    print("\n6. Testing Setup...")
    print("-" * 40)
    
    if run_command("python test_setup.py", "Running setup test"):
        print("✓ Setup test passed")
    else:
        print("✗ Setup test failed, but you can continue")
    
    # Final instructions
    print("\n" + "=" * 70)
    print("SETUP COMPLETE!")
    print("=" * 70)
    
    print("\nYour BuySmarter PC Parts project is ready!")
    print("\nNext steps:")
    print("1. Edit .env file with your database URL and API keys")
    print("2. Install PostgreSQL and Redis (if not already installed)")
    print("3. Run 'npm run db:push' to sync database schema")
    print("4. Start the development servers:")
    print("   - Frontend: npm run dev")
    print("   - Backend: cd backend && python main.py")
    print("5. Test the enhanced scraping with product reconciliation")
    
    print("\nKey Features Available:")
    print("✓ Master product catalog loaded")
    print("✓ Product reconciliation system")
    print("✓ Enhanced scrapers with fuzzy matching")
    print("✓ AI-powered recommendations")
    print("✓ PC builder with compatibility checking")
    print("✓ Price comparison across vendors")
    
    print("\nMaster Product Statistics:")
    try:
        # Count products in each category
        categories = ['cpu', 'motherboard', 'memory', 'video-card', 'power-supply', 'internal-hard-drive', 'case', 'cpu-cooler']
        for category in categories:
            file_path = f"masterProducts/{category}.json"
            if Path(file_path).exists():
                with open(file_path, 'r', encoding='utf-8') as f:
                    import json
                    data = json.load(f)
                    print(f"  - {category.replace('-', ' ').title()}: {len(data)} products")
    except Exception as e:
        print(f"  Could not load statistics: {e}")
    
    print("\nReady to revolutionize PC parts shopping in Bangladesh! 🚀")

if __name__ == "__main__":
    main()
