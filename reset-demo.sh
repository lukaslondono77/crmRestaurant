#!/bin/bash
# Reset demo: create test user + seed Apps/Pages.
# Backend must be running. Run from project root.

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "Cloudignite — reset-demo"
echo "========================"

echo "Creating test user..."
(cd backend && node scripts/create-test-user.js)

echo "Seeding Apps/Pages (todos, calendar, contacts)..."
(cd backend && npm run seed:modules)

echo ""
echo "✅ Demo reset done."
echo "   Login: admin@test.com / admin123"
echo "   Dashboard seed runs automatically when metrics are empty."
