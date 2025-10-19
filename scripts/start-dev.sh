#!/bin/bash

# BuySmarter PC Parts - Development Start Script
echo "🚀 Starting BuySmarter PC Parts development environment..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup.sh first."
    exit 1
fi

# Start Redis in background
echo "🔴 Starting Redis..."
redis-server --daemonize yes

# Wait a moment for Redis to start
sleep 2

# Start backend in background
echo "🐍 Starting Python backend..."
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "⚛️ Starting Next.js frontend..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Development environment started!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    redis-cli shutdown 2>/dev/null
    echo "✅ All services stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT

# Wait for processes
wait
