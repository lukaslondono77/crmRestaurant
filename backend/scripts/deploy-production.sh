#!/bin/bash

# Cloudignite Backend — Production Deployment
# Usage: ./scripts/deploy-production.sh
# Optional: API_URL=https://api.yourdomain.com ./scripts/deploy-production.sh
# Optional: SKIP_GIT_PULL=1 to skip "git pull" (e.g. when deploying from CI).
# Optional: GIT_BRANCH=main (default) to choose branch to pull.
#
# Requires: .env.production or .env, node, npm. PM2 recommended.

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Config
ENV_FILE=".env.production"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env"
fi
if [ ! -f "$ENV_FILE" ]; then
  err "No $ENV_FILE or .env found. Create from .env.example."
fi

set -a
source "$ENV_FILE"
set +a

DATABASE_PATH="${DATABASE_PATH:-./database/restaurant_cost.db}"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
BACKUP_DIR="${BACKUP_ROOT}/$(date +%Y%m%d_%H%M%S)"
API_URL="${API_URL:-http://localhost:8000}"
LOG_FILE="deploy-$(date +%Y%m%d_%H%M%S).log"
GIT_BRANCH="${GIT_BRANCH:-main}"

log "🚀 Cloudignite Backend — Production Deployment"
echo "=========================================="

log "📦 Step 1: Backup..."
mkdir -p "$BACKUP_DIR"
if [ -f "$DATABASE_PATH" ]; then
  cp "$DATABASE_PATH" "$BACKUP_DIR/restaurant_cost.db" || err "Backup copy failed"
  log "   DB backed up to $BACKUP_DIR"
else
  warn "   No DB at $DATABASE_PATH; skipping backup."
fi

if [ "${SKIP_GIT_PULL}" != "1" ] && git rev-parse --git-dir &>/dev/null; then
  log "🔄 Step 2: Pull latest code..."
  git pull origin "$GIT_BRANCH" || warn "   Git pull failed; continuing."
else
  log "🔄 Step 2: Skip git pull${SKIP_GIT_PULL:+ (SKIP_GIT_PULL=1)}"
fi

log "📦 Step 3: Install dependencies..."
npm ci --omit=dev 2>/dev/null || npm ci --only=production 2>/dev/null || npm install --production || err "npm install failed"

log "🗄️ Step 4: Migrations..."
npm run migrate || err "Migrations failed"

log "🔐 Step 5: Permissions..."
mkdir -p uploads/invoices uploads/pos uploads/waste
chmod 755 uploads 2>/dev/null || true
chmod 755 uploads/invoices uploads/pos uploads/waste 2>/dev/null || true
[ -f "$DATABASE_PATH" ] && chmod 644 "$DATABASE_PATH" || true

log "🚀 Step 5: Restart service..."
if command -v pm2 &>/dev/null; then
  if pm2 describe cloudignite-api &>/dev/null; then
    pm2 restart cloudignite-api || err "PM2 restart failed"
  else
    pm2 start src/server.js --name cloudignite-api || err "PM2 start failed"
  fi
  log "   PM2: cloudignite-api"
else
  warn "   PM2 not found. Restart app manually (e.g. systemd, node src/server.js)."
fi

log "⏳ Step 7: Waiting for service..."
sleep 10

log "✅ Step 8: Deployment verification..."
node scripts/verify-deployment.js "$API_URL" >> "$LOG_FILE" 2>&1 || {
  warn "   Verification had failures. See $LOG_FILE"
}

log "📊 Step 9: Logging..."
echo "$(date -Iseconds): Deployment completed (API_URL=$API_URL)" >> deployments.log 2>/dev/null || true

log "✨ Deployment completed."
echo ""
echo "Next:"
echo "  1. Verify frontend → API connectivity"
echo "  2. pm2 logs cloudignite-api"
echo "  3. node scripts/monitor-production.js $API_URL [token]"
echo ""
