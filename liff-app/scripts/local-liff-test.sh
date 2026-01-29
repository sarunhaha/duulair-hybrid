#!/bin/bash

# LIFF Local Testing Script
# ===========================
# วิธีใช้: ./scripts/local-liff-test.sh

echo "🚀 Starting LIFF Local Testing Setup..."
echo ""

# Step 1: Start Vite dev server in background
echo "1️⃣ Starting Vite dev server on port 3000..."
npm run dev &
VITE_PID=$!
sleep 3

# Step 2: Start ngrok tunnel
echo ""
echo "2️⃣ Starting ngrok tunnel..."
echo ""
echo "⚠️  IMPORTANT: After ngrok starts, you need to:"
echo ""
echo "   1. Copy the ngrok HTTPS URL (e.g., https://xxxx.ngrok-free.app)"
echo ""
echo "   2. Go to LINE Developers Console:"
echo "      https://developers.line.biz/console/"
echo ""
echo "   3. Select your LIFF app → LIFF tab → Edit your LIFF"
echo ""
echo "   4. Update 'Endpoint URL' to:"
echo "      https://xxxx.ngrok-free.app"
echo ""
echo "   5. Open LINE app and test your LIFF"
echo ""
echo "   6. When done, restore Endpoint URL to production:"
echo "      https://duulair-hybrid.vercel.app/liff-v2/"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Trap to kill vite when script exits
trap "kill $VITE_PID 2>/dev/null; exit" SIGINT SIGTERM

# Start ngrok (this will block)
ngrok http 3000

# Cleanup
kill $VITE_PID 2>/dev/null
