#!/bin/bash

# Cloudignite Backend — Rollback to previous deployment
# Usage: ./scripts/rollback.sh [--no-git]
#   --no-git: skip "git revert HEAD"; only restore DB and restart.

set -e

cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

NO_GIT=false
for a in "$@"; do
  [ "$a" = "--no-git" ] && NO_GIT=true
done

if [ -f .env.production ]; then
  set -a; source .env.production; set +a
elif [ -f .env ]; then
  set -a; source .env; set +a
fi
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
DATABASE_PATH="${DATABASE_PATH:-./database/restaurant_cost.db}"

log "🔙 Cloudignite — Rollback"
echo "======================="

LATEST=$(ls -td "$BACKUP_ROOT"/*/ 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  err "No backups found under $BACKUP_ROOT"
fi

DB_BACKUP="$LATEST/restaurant_cost.db"
if [ ! -f "$DB_BACKUP" ]; then
  err "Backup DB not found: $DB_BACKUP"
fi

log "📦 Restoring from $LATEST"

log "🛑 Stopping service..."
if command -v pm2 &>/dev/null && pm2 describe cloudignite-api &>/dev/null; then
  pm2 stop cloudignite-api || true
fi

log "🗄️ Restoring database..."
mkdir -p "$(dirname "$DATABASE_PATH")"
cp "$DB_BACKUP" "$DATABASE_PATH" || err "Restore failed"

if [ "$NO_GIT" = false ] && git rev-parse --git-dir &>/dev/null; then
  log "↩️ Reverting last commit..."
  git revert HEAD --no-edit || warn "Git revert failed; DB was still restored."
else
  [ "$NO_GIT" = true ] && log "   Skipping git revert (--no-git)."
fi

log "🚀 Restarting service..."
if command -v pm2 &>/dev/null && pm2 describe cloudignite-api &>/dev/null; then
  pm2 start cloudignite-api || err "PM2 start failed"
fi

log "✅ Rollback completed."
echo ""
echo "Verify: node scripts/verify-deployment.js \${API_URL:-http://localhost:8000}"
echo ""
