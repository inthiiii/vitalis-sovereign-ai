#!/bin/bash

# Define colors for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}       VITALIS SOVEREIGN AI SYSTEM       ${NC}"
echo -e "${BLUE}=========================================${NC}"

# 1. Check for Ollama
if ! pgrep -x "ollama" > /dev/null
then
    echo "Starting Ollama..."
    ollama serve &
    sleep 2
else
    echo -e "${GREEN}✔ Ollama is running${NC}"
fi

# 2. Start Backend
echo "Starting Vitalis Brain (Backend)..."
cd backend
source venv/bin/activate
# Run in background & save PID
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# 3. Start Frontend
echo "Starting Vitalis Interface (Frontend)..."
cd frontend
# Run in background & save PID, suppress some output
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}✔ Systems Online${NC}"
echo -e "OPEN THIS URL: ${BLUE}http://localhost:3000${NC}"
echo "Press CTRL+C to stop Vitalis."

# 4. Cleanup Function (Kill processes on exit)
cleanup() {
    echo -e "\nShutting down Vitalis..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap Keyboard Interrupt (Ctrl+C)
trap cleanup SIGINT

# Keep script running
wait