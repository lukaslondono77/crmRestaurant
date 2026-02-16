# Inventory Items Import Guide

## 📋 Overview

This guide explains how to import inventory items (spices, ingredients, raw materials) to Square Catalog for Tequila's Town restaurant. This is separate from the menu items and is crucial for:

1. **Purchase Management** - Track ingredient purchases and reordering
2. **Cost Control** - Calculate cost per dish (BOM - Bill of Materials)
3. **Low Stock Alerts** - Prevent running out of critical ingredients
4. **Inventory Tracking** - Real-time inventory levels

## 🧂 Inventory Categories Included

### Spices & Dried Herbs
- **Chile Guajillo** - For marinades and moles
- **Chile Ancho** - For moles and sauces
- **Chile Chipotle** - Smoked dried jalapeños
- **Orégano Mexicano** - Mexican dried oregano
- **Epazote** - For beans and quesadillas
- **Comino Molido** - Ground cumin
- **Canela** - Cinnamon sticks
- **Ajo Seco** - Dried garlic
- **Semillas de Sésamo** - Sesame seeds
- **Pepitas** - Pumpkin seeds
- **Semillas de Chía** - Chia seeds
- **Pimienta Negra** - Black peppercorns

### Meat & Poultry
- **Carne Asada** - Skirt steak
- **Pollo Desmenuzado** - Shredded chicken
- **Carnitas** - Pork carnitas
- **Chorizo** - Mexican chorizo

### Dairy & Cheese
- **Queso Fresco** - Fresh Mexican cheese
- **Queso Oaxaca** - String cheese

### Vegetables
- **Aguacates Hass** - Avocados

### Tortillas & Wraps
- **Tortillas de Maíz** - Corn tortillas
- **Tortillas de Harina** - Flour tortillas

### Seafood
- **Camarones Crudos** - Raw shrimp

## 🚀 Quick Start

### Option 1: Using the API Endpoint

```bash
# Import inventory only
curl -X POST http://localhost:8000/api/square/import-inventory \
  -H "Content-Type: application/json"

# Import menu only
curl -X POST http://localhost:8000/api/square/import-menu \
  -H "Content-Type: application/json"

# Import both menu and inventory
curl -X POST http://localhost:8000/api/square/import-all \
  -H "Content-Type: application/json"
```

### Option 2: Using the Script

```bash
cd backend

# Import inventory only
node scripts/import-menu.js inventory

# Import menu only
node scripts/import-menu.js menu

# Import both
node scripts/import-menu.js all
```

## 📁 File Structure

```
backend/
├── data/
│   ├── tequilas_town_menu.json      # Menu items (dishes)
│   └── inventory_items.json          # Inventory items (ingredients)
├── scripts/
│   └── import-menu.js                # Import script (handles both)
└── src/
    └── services/
        └── squareService.js          # Import methods
```

## ⚙️ Configuration

### Required Environment Variables

```env
SQUARE_ACCESS_TOKEN=your_sandbox_access_token
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=your_location_id
```

### Required Permissions

- **ITEMS_WRITE** - To create/update catalog items
- **INVENTORY_WRITE** - To set initial inventory levels (optional)

## 📊 Inventory Features

### Inventory Tracking

All inventory items include:
- ✅ **SKU codes** for tracking (e.g., `SPC-GUA-LB`, `MEA-ASA-LB`)
- ✅ **Track inventory enabled** - Automatic quantity tracking
- ✅ **Low stock alerts** - Configurable thresholds per item
- ✅ **Pricing** - Purchase cost per unit
- ✅ **Units** - Proper measurement units (lb, oz, case, pack)

### Low Stock Thresholds

Each item has a configured alert threshold:

| Item | Threshold | Unit |
|------|-----------|------|
| Chile Guajillo | 2 | lb |
| Chile Ancho | 3 | lb |
| Orégano Mexicano | 8 | oz |
| Epazote | 4 | oz |
| Carne Asada | 15 | lb |
| Queso Fresco | 8 | lb |
| Tortillas Corn | 5 | packs |

## 🔄 How It Works

1. **Reads JSON File**: Loads `inventory_items.json` from `backend/data/`
2. **Creates Categories**: Sets up inventory categories (Spices, Meat, Dairy, etc.)
3. **Creates Items**: Adds each ingredient with variations
4. **Configures Tracking**: Enables inventory tracking and alerts
5. **Maps IDs**: Square returns permanent IDs

## ✅ Verification Steps

After importing:

1. **Check Square Dashboard**:
   - Go to https://squareupsandbox.com/dashboard
   - Navigate to **Items** section
   - Filter by categories: "SPICES & DRIED HERBS", "MEAT & POULTRY", etc.
   - Verify all items are present with correct SKUs

2. **Verify Inventory Tracking**:
   - Each item should show "Track Inventory" enabled
   - Low stock alerts should be configured
   - SKUs should be unique and descriptive

3. **Set Initial Quantities**:
   - Use Square Dashboard or API to set starting inventory
   - Or use the inventory count API (see below)

## 📝 Setting Initial Inventory

After importing, set initial quantities:

```bash
# Using Square API
curl -X POST https://connect.squareupsandbox.com/v2/inventory/changes \
  -H "Square-Version: 2024-01-18" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idempotency_key": "initial_count_001",
    "changes": [
      {
        "type": "PHYSICAL_COUNT",
        "physical_count": {
          "catalog_object_id": "ITEM_ID_FROM_SQUARE",
          "state": "IN_STOCK",
          "location_id": "YOUR_LOCATION_ID",
          "quantity": "5",
          "occurred_at": "2024-01-20T08:00:00Z"
        }
      }
    ]
  }'
```

## 🎯 Use Cases

### 1. Recipe Cost Calculation (BOM)

Track how much each dish costs to make:

```
Mole Poblano Recipe:
- 0.5 lb Chile Guajillo = $6.48
- 0.5 lb Chile Ancho = $7.25
- 0.25 lb Sesame Seeds = $1.49
- 2 oz Cinnamon = $4.48
- 8 lb Chicken = $55.60
Total Cost per Batch (20 servings) = $75.30
Cost per Serving = $3.77
```

### 2. Purchase Orders

Generate automatic purchase orders when inventory drops below threshold:

```javascript
// Check low stock items
const lowStockItems = await checkInventoryLevels();

// Generate PO
const purchaseOrder = {
  supplier: "Mexican Spices Co.",
  items: lowStockItems.map(item => ({
    sku: item.sku,
    quantity: item.reorderQuantity,
    cost: item.unitPrice
  }))
};
```

### 3. Waste Tracking

Track ingredient waste as separate inventory adjustments:

```javascript
// Mark 2 lbs of chicken as wasted
await adjustInventory(
  chickenCatalogId,
  -2,
  'NONE',
  'WASTE'
);
```

## 📊 API Endpoints

### Import Inventory
```
POST /api/square/import-inventory
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory items imported to Square successfully",
  "data": {
    "filename": "inventory_items.json",
    "totalBatches": 3,
    "totalObjects": 22,
    "successfulObjects": 22,
    "failedObjects": 0,
    "results": [...]
  }
}
```

### Import All (Menu + Inventory)
```
POST /api/square/import-all
```

**Response:**
```json
{
  "success": true,
  "message": "Menu and inventory imported to Square successfully",
  "data": {
    "menu": {...},
    "inventory": {...},
    "summary": {
      "totalItems": 50,
      "menuItems": 28,
      "inventoryItems": 22
    }
  }
}
```

## 🔧 Troubleshooting

### Error: "Invalid SKU format"

**Solution**: SKUs must be unique across all items. Check for duplicates in your JSON.

### Error: "Inventory tracking not available"

**Solution**: Ensure your Square subscription includes inventory tracking features.

### Items imported but no inventory counts

**Solution**: Inventory tracking is enabled, but initial quantities must be set separately using the inventory count API.

## 📚 Next Steps

1. **Set Initial Quantities**: Use Square Dashboard or API to set starting inventory
2. **Configure Suppliers**: Add supplier information for purchase orders
3. **Set Up Recipes**: Create BOM (Bill of Materials) for each dish
4. **Enable Alerts**: Configure webhooks for low stock notifications
5. **Track Waste**: Set up waste tracking for expired/spoiled items

## 📞 Support

For issues:
1. Check Square Developer Logs
2. Verify API permissions
3. Review backend logs for detailed errors
4. Test with Square API Explorer

---

**Note**: Inventory items are separate from menu items. Menu items are what customers order, inventory items are what you purchase to make those dishes.
