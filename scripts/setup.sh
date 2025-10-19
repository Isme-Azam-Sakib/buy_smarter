#!/bin/bash

# BuySmarter PC Parts - Setup Script
echo "🚀 Setting up BuySmarter PC Parts project..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.9+ first."
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install PostgreSQL 13+ first."
    exit 1
fi

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "❌ Redis is not installed. Please install Redis 6+ first."
    exit 1
fi

echo "✅ All prerequisites are installed."

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Set up environment file
echo "⚙️ Setting up environment configuration..."
if [ ! -f .env ]; then
    cp env.example .env
    echo "📝 Created .env file. Please update it with your configuration."
else
    echo "📝 .env file already exists."
fi

# Generate Prisma client
echo "🗄️ Generating Prisma client..."
npm run db:generate

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env file with your database and API keys"
echo "2. Start PostgreSQL and Redis services"
echo "3. Run 'npm run db:push' to set up the database"
echo "4. Run 'npm run dev' to start the frontend"
echo "5. Run 'cd backend && python main.py' to start the backend"
echo ""
echo "Happy coding! 🎉"
