#!/usr/bin/env bash
# Move Demo/Example HTML from fila/ to fila/templates/ per docs/FILA_HTML_CATEGORIZATION.md
# Core + Utility stay in fila/

set -e
FILA="$(cd "$(dirname "$0")/.." && pwd)"
KEEP=(
  index.html analytics.html owner-view.html
  inventory-count.html manual-data-entry.html reports.html invoices.html invoice-details.html
  connections.html diagnose-connection.html categories.html products-list.html products-grid.html
  product-details.html create-product.html edit-product.html create-category.html edit-category.html
  orders.html order-details.html order-tracking.html create-order.html cart.html checkout.html
  wallet-balance.html data-entry-backup.html validacion-checklist.html reporte-pruebas.html
  settings.html account-settings.html sign-in.html sign-up.html logout.html change-password.html
  forgot-password.html reset-password.html confirm-email.html lock-screen.html
  alerts.html notifications.html my-profile.html user-profile.html users.html users-list.html
  add-user.html create-user.html blank-page.html starter.html
  404-error-page.html internal-error.html
)
mkdir -p "$FILA/templates"
moved=0
for f in "$FILA"/*.html; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  keep=0
  for k in "${KEEP[@]}"; do
    [ "$base" = "$k" ] && { keep=1; break; }
  done
  [ "$keep" -eq 1 ] && continue
  mv "$f" "$FILA/templates/$base"
  ((moved++)) || true
done
echo "Moved $moved HTML files to fila/templates/"
