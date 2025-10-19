#!/usr/bin/env python3
"""
Test script to verify BuySmarter PC Parts setup
"""

import sys
import subprocess
import os
from pathlib import Path

def check_command(command, description):
    """Check if a command is available"""
    try:
        # On Windows, try both the command and command.cmd
        commands_to_try = [command, f"{command}.cmd"]
        for cmd in commands_to_try:
            try:
                subprocess.run([cmd, '--version'], capture_output=True, check=True, shell=True)
                print(f"[OK] {description} is installed")
                return True
            except (subprocess.CalledProcessError, FileNotFoundError):
                continue
        print(f"[X] {description} is not installed")
        return False
    except Exception:
        print(f"[X] {description} is not installed")
        return False

def check_file(file_path, description):
    """Check if a file exists"""
    if Path(file_path).exists():
        print(f"[OK] {description} exists")
        return True
    else:
        print(f"[X] {description} not found")
        return False

def main():
    print("Checking BuySmarter PC Parts setup...")
    print("=" * 50)
    
    # Check prerequisites
    print("\nChecking Prerequisites:")
    node_ok = check_command('node', 'Node.js')
    npm_ok = check_command('npm', 'npm')
    python_ok = check_command('python', 'Python 3')
    psql_ok = check_command('psql', 'PostgreSQL')
    redis_ok = check_command('redis-server', 'Redis')
    
    # Check project files
    print("\nChecking Project Files:")
    package_json_ok = check_file('package.json', 'package.json')
    prisma_schema_ok = check_file('prisma/schema.prisma', 'Prisma schema')
    backend_main_ok = check_file('backend/main.py', 'Backend main.py')
    env_example_ok = check_file('env.example', 'Environment example')
    
    # Check if .env exists
    env_ok = check_file('.env', 'Environment file (.env)')
    if not env_ok:
        print("[!] .env file not found. Please copy env.example to .env and configure it.")
    
    # Check if node_modules exists
    node_modules_ok = check_file('node_modules', 'Node modules')
    if not node_modules_ok:
        print("[!] Node modules not installed. Run 'npm install' to install dependencies.")
    
    # Summary
    print("\nSetup Summary:")
    print("=" * 50)
    
    # Core prerequisites (required)
    core_prerequisites_ok = all([node_ok, npm_ok, python_ok])
    # Optional prerequisites (for full functionality)
    optional_prerequisites_ok = all([psql_ok, redis_ok])
    files_ok = all([package_json_ok, prisma_schema_ok, backend_main_ok, env_example_ok])
    
    if core_prerequisites_ok and files_ok:
        print("[OK] Basic setup looks good!")
        if not optional_prerequisites_ok:
            print("\nNote: PostgreSQL and Redis are not installed.")
            print("For full functionality, install them:")
            print("- PostgreSQL: https://www.postgresql.org/download/windows/")
            print("- Redis: https://github.com/microsoftarchive/redis/releases")
        print("\nNext steps:")
        print("1. Configure .env file with your database and API keys")
        print("2. Install PostgreSQL and Redis (optional for now)")
        print("3. Run 'npm run db:push' to set up the database")
        print("4. Run 'npm run dev' to start the frontend")
        print("5. Run 'cd backend && python main.py' to start the backend")
    else:
        print("[X] Setup incomplete. Please fix the issues above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
