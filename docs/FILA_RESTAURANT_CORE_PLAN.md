# Fila — Restaurant cost control core (keep vs archive)

Simplified plan aligned with **restaurant cost management** only.

## Target structure

```
fila/
  core/                    # ~25–30 restaurant-only pages (app lives here)
  archive/
    demo-templates/        # CRM, LMS, Hospital, School, etc. (from templates/)
    ui-components/        # Generic UI/placeholder pages (blank, starter)
    unused/                # Questionable / test pages
  assets/                 # Shared (unchanged)
```

## Core restaurant pages (KEEP in `fila/core/`)

### 1. Authentication & entry
- `sign-in.html`, `sign-up.html`, `logout.html`
- `index.html` (dashboard entry)
- `change-password.html`, `forgot-password.html`, `reset-password.html`, `confirm-email.html`, `lock-screen.html`

### 2. Dashboard & analytics
- `analytics.html`, `reports.html`, `owner-view.html`

### 3. Inventory & invoices
- `inventory-count.html`, `manual-data-entry.html`
- `invoices.html`, `invoice-details.html`

### 4. Orders & products (cost control)
- `orders.html`, `order-details.html`, `create-order.html`, `order-tracking.html`
- `products-list.html`, `products-grid.html`, `product-details.html`, `create-product.html`, `edit-product.html`
- `categories.html`, `create-category.html`, `edit-category.html`
- `cart.html`, `checkout.html`, `wallet-balance.html`

### 5. Connections & settings
- `connections.html`, `diagnose-connection.html`
- `settings.html`, `account-settings.html`
- `data-entry-backup.html`

### 6. Users & profile
- `my-profile.html`, `user-profile.html`, `users.html`, `users-list.html`, `add-user.html`, `create-user.html`
- `alerts.html`, `notifications.html`

### 7. Utility (error / support)
- `404-error-page.html`, `internal-error.html`
- `blank-page.html`, `starter.html`

## Archive

- **demo-templates/** — All files currently in `fila/templates/` (CRM, LMS, HR, Email, UI kits, etc.).
- **ui-components/** — (Optional) Any generic component demos if we later split them out.
- **unused/** — Test/validation pages: `validacion-checklist.html`, `reporte-pruebas.html` (and any other non-core).

## App entry after cleanup

- **Primary:** `fila/core/index.html` (or open `fila/core/sign-in.html`).
- **Redirect:** Optional `fila/index.html` that redirects to `core/index.html` so `/` still works.

## Verification

1. Log in: `core/sign-in.html`
2. Dashboard: `core/index.html`
3. Inventory: `core/inventory-count.html`
4. Invoices: `core/invoices.html`, `core/invoice-details.html`
5. Reports: `core/reports.html`, `core/analytics.html`, `core/owner-view.html`
