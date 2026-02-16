#!/bin/bash
# Start frontend (fila) and backend for Cloudignite dev.
# Frontend: http://localhost:3000
# Backend:  http://localhost:8000

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Starting Cloudignite development environment"
echo "============================================="

# Backend
echo "Starting backend on port 8000..."
(cd backend && npm run dev 2>&1) &
BKPID=$!

# Wait for backend to be up
echo "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/healthz 2>/dev/null | grep -q 200; then
    echo "Backend is up."
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo "Backend did not start in time."
    kill $BKPID 2>/dev/null || true
    exit 1
  fi
done

# Frontend
echo "Starting frontend on port 3000..."
(cd fila && python3 server.py 2>&1) &
FEPID=$!

echo ""
echo "✅ Development servers started"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8000"
echo "   Diagnostic: http://localhost:3000/diagnose-connection.html"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $BKPID $FEPID 2>/dev/null; echo 'Stopped.'; exit 0" INT TERM
wait
