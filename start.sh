#!/usr/bin/env bash

# Resolve project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "========================================================"
echo " Starting D&M Finance"
echo " Project: $PROJECT_DIR"
echo "========================================================"

# Function to clean up background processes on Ctrl+C / exit
cleanup() {
    echo ""
    echo "Stopping servers..."
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start FastAPI Backend (Port 8000)
echo "Starting Python FastAPI backend on http://127.0.0.1:8000..."
cd "$BACKEND_DIR" || exit 1
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait 2 seconds for backend to start up
sleep 2

# 2. Start Vite React Frontend (Port 3000)
echo "Starting React frontend on http://localhost:3000..."
cd "$FRONTEND_DIR" || exit 1
npm run dev &
FRONTEND_PID=$!

# 3. Automatically open in default browser on Mac
sleep 2
echo "Opening http://localhost:3000 in your browser..."
open "http://localhost:3000" 2>/dev/null || true

echo ""
echo "D&M Finance is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://127.0.0.1:8000"
echo "Press Ctrl+C to stop both servers."
echo ""

# Keep running until Ctrl+C
wait
