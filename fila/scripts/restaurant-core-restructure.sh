#!/usr/bin/env bash
# Restaurant cost control restructure: fila/core/ + fila/archive/
# See docs/FILA_RESTAURANT_CORE_PLAN.md

set -e
FILA="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FILA"

# Core restaurant pages only (~40 files)
CORE=(
  sign-in.html sign-up.html logout.html index.html
  change-password.html forgot-password.html reset-password.html confirm-email.html lock-screen.html
  analytics.html reports.html owner-view.html
  inventory-count.html manual-data-entry.html
  invoices.html invoice-details.html
  orders.html order-details.html create-order.html order-tracking.html
  products-list.html products-grid.html product-details.html create-product.html edit-product.html
  categories.html create-category.html edit-category.html
  cart.html checkout.html wallet-balance.html
  connections.html diagnose-connection.html
  settings.html account-settings.html data-entry-backup.html
  my-profile.html user-profile.html users.html users-list.html add-user.html create-user.html
  alerts.html notifications.html
  404-error-page.html internal-error.html
  blank-page.html starter.html
)

mkdir -p "$FILA/core" "$FILA/archive/demo-templates" "$FILA/archive/ui-components" "$FILA/archive/unused"

# 1) Move demo-templates: current templates/ -> archive/demo-templates/
if [ -d "$FILA/templates" ]; then
  for f in "$FILA/templates"/*.html; do
    [ -f "$f" ] || continue
    mv "$f" "$FILA/archive/demo-templates/"
  done
  rmdir "$FILA/templates" 2>/dev/null || true
  echo "Moved templates/ -> archive/demo-templates/"
fi

# 2) Move core files from fila/ to fila/core/
for name in "${CORE[@]}"; do
  if [ -f "$FILA/$name" ]; then
    mv "$FILA/$name" "$FILA/core/$name"
  fi
done
echo "Moved ${#CORE[@]} core files to core/"

# 3) Move remaining fila/*.html to archive/unused (validacion, reporte-pruebas, etc.)
for f in "$FILA"/*.html; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  mv "$f" "$FILA/archive/unused/$base"
done
echo "Moved remaining HTML to archive/unused/"

# 4) Fix asset paths in core: assets/ -> ../assets/
for f in "$FILA/core"/*.html; do
  [ -f "$f" ] || continue
  sed -i '' 's|href="assets/|href="../assets/|g; s|src="assets/|src="../assets/|g' "$f"
done
# Fix links from core to core (same dir): keep as-is. Fix links to "main app" that pointed to root: now same dir.
# Core pages already link to index.html, sign-in.html etc. - they're now in same dir so no change.
echo "Fixed asset paths in core/"

# 5) Fix asset paths in archive/demo-templates: ../assets/ -> ../../assets/
for f in "$FILA/archive/demo-templates"/*.html; do
  [ -f "$f" ] || continue
  sed -i '' 's|href="../assets/|href="../../assets/|g; s|src="../assets/|src="../../assets/|g' "$f"
done
# Fix links to main app: ../index.html -> ../../core/index.html etc.
for f in "$FILA/archive/demo-templates"/*.html; do
  [ -f "$f" ] || continue
  sed -i '' \
    -e 's|href="../index\.html"|href="../../core/index.html"|g' \
    -e 's|href="../analytics\.html"|href="../../core/analytics.html"|g' \
    -e 's|href="../sign-in\.html"|href="../../core/sign-in.html"|g' \
    -e 's|href="../settings\.html"|href="../../core/settings.html"|g' \
    -e 's|href="../owner-view\.html"|href="../../core/owner-view.html"|g' \
    -e 's|href="../sign-up\.html"|href="../../core/sign-up.html"|g' \
    -e 's|href="../account-settings\.html"|href="../../core/account-settings.html"|g' \
    -e 's|href="../my-profile\.html"|href="../../core/my-profile.html"|g' \
    -e 's|href="../users\.html"|href="../../core/users.html"|g' \
    -e 's|href="../alerts\.html"|href="../../core/alerts.html"|g' \
    -e 's|href="../notifications\.html"|href="../../core/notifications.html"|g' \
    -e 's|href="../logout\.html"|href="../../core/logout.html"|g' \
    "$f"
done
echo "Fixed paths in archive/demo-templates/"

# 6) Fix asset paths in archive/unused
for f in "$FILA/archive/unused"/*.html; do
  [ -f "$f" ] || continue
  sed -i '' 's|href="assets/|href="../assets/|g; s|src="assets/|src="../assets/|g' "$f"
done
echo "Fixed asset paths in archive/unused/"

echo "Done. App entry: fila/core/index.html or fila/core/sign-in.html"
