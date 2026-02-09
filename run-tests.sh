#!/bin/bash
# Run full test suite. Backend must be running on :8000.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT/backend"

echo "Cloudignite — run-tests"
echo "======================="

if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/healthz 2>/dev/null | grep -q 200; then
  echo "❌ Backend not reachable at http://localhost:8000. Start it with: ./start-all.sh"
  exit 1
fi

npm run test:all
