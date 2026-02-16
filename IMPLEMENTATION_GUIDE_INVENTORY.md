# Implementation Guide: Inventory Endpoints

## Overview

This guide shows how to implement the missing inventory management endpoints that are critical for frontend integration.

---

## 1. Create Inventory Routes File

**File**: `backend/src/routes/inventoryRoutes.js`

```javascript
const express = require('express');
const db = require('../config/database');
const router = express.Router();

/**
 * GET /api/inventory
 * Get all inventory items with optional filters
 * 
 * Query params:
 * - category: Filter by category
 * - lowStock: Only items below threshold (default: 10)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50)
 */
router.get('/', async (req, res) => {
  try {
    const { category, lowStock, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `
      SELECT 
        id,
        item_name,
        category,
        quantity,
        unit_price,
        last_purchase_date,
        last_sale_date,
        expiry_date,
        (quantity * COALESCE(unit_price, 0)) as total_value,
        CASE 
          WHEN expiry_date IS NOT NULL 
          THEN julianday(expiry_date) - julianday('now')
          ELSE NULL
        END as days_until_expiry
      FROM inventory
      WHERE quantity > 0
    `;
    
    const params = [];
    
    // Apply filters
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (lowStock === 'true') {
      const threshold = parseFloat(req.query.threshold) || 10;
      query += ' AND quantity < ?';
      params.push(threshold);
    }
    
    // Get total count for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = await db.getAsync(countQuery, params);
    const total = countResult?.total || 0;
    
    // Add pagination and ordering
    query += ' ORDER BY item_name ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    const items = await db.allAsync(query, params);
    
    // Calculate summary
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity * COALESCE(unit_price, 0)) as total_value,
        SUM(CASE WHEN quantity < 10 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE 
          WHEN expiry_date IS NOT NULL 
          AND julianday(expiry_date) - julianday('now') <= 7 
          AND julianday(expiry_date) - julianday('now') >= 0
          THEN 1 ELSE 0 
        END) as expiring_soon_count
      FROM inventory
      WHERE quantity > 0
    `;
    
    const summary = await db.getAsync(summaryQuery);
    
    // Format response
    const formattedItems = items.map(item => ({
      id: item.id,
      itemName: item.item_name,
      category: item.category,
      quantity: parseFloat(item.quantity),
      unitPrice: item.unit_price ? parseFloat(item.unit_price) : 0,
      totalValue: parseFloat(item.total_value || 0),
      lastPurchaseDate: item.last_purchase_date,
      lastSaleDate: item.last_sale_date,
      expiryDate: item.expiry_date,
      daysUntilExpiry: item.days_until_expiry ? Math.floor(item.days_until_expiry) : null,
      isLowStock: item.quantity < 10,
      isExpiringSoon: item.days_until_expiry !== null && item.days_until_expiry <= 7 && item.days_until_expiry >= 0
    }));
    
    res.json({
      success: true,
      data: {
        items: formattedItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        summary: {
          totalItems: summary?.total_items || 0,
          totalValue: parseFloat(summary?.total_value || 0),
          lowStockCount: summary?.low_stock_count || 0,
          expiringSoonCount: summary?.expiring_soon_count || 0
        }
      },
      meta: {
        generatedAt: new Date().toISOString(),
        dataSource: 'database'
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch inventory',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/inventory/low-stock
 * Get items below stock threshold
 */
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseFloat(req.query.threshold) || 10;
    
    const items = await db.allAsync(`
      SELECT 
        id,
        item_name,
        category,
        quantity,
        unit_price,
        last_purchase_date,
        expiry_date,
        (quantity * COALESCE(unit_price, 0)) as total_value
      FROM inventory
      WHERE quantity > 0 AND quantity < ?
      ORDER BY quantity ASC
    `, [threshold]);
    
    res.json({
      success: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          itemName: item.item_name,
          category: item.category,
          quantity: parseFloat(item.quantity),
          unitPrice: item.unit_price ? parseFloat(item.unit_price) : 0,
          totalValue: parseFloat(item.total_value || 0),
          lastPurchaseDate: item.last_purchase_date,
          expiryDate: item.expiry_date,
          threshold: threshold
        })),
        count: items.length,
        threshold: threshold
      }
    });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch low stock items',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/inventory/:id
 * Get single inventory item
 */
router.get('/:id', async (req, res) => {
  try {
    const item = await db.getAsync(`
      SELECT 
        id,
        item_name,
        category,
        quantity,
        unit_price,
        last_purchase_date,
        last_sale_date,
        expiry_date,
        updated_at
      FROM inventory
      WHERE id = ?
    `, [req.params.id]);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Inventory item not found'
        }
      });
    }
    
    // Get purchase history
    const purchases = await db.allAsync(`
      SELECT 
        p.id,
        p.vendor,
        p.purchase_date,
        pi.quantity,
        pi.unit_price,
        pi.total_price
      FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE pi.item_name = ?
      ORDER BY p.purchase_date DESC
      LIMIT 10
    `, [item.item_name]);
    
    // Get sales history
    const sales = await db.allAsync(`
      SELECT 
        s.id,
        s.report_date,
        si.quantity,
        si.unit_price,
        si.total_price
      FROM sales_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.item_name = ?
      ORDER BY s.report_date DESC
      LIMIT 10
    `, [item.item_name]);
    
    // Get waste history
    const waste = await db.allAsync(`
      SELECT 
        id,
        quantity,
        cost_value,
        waste_date,
        reason
      FROM waste
      WHERE item_name = ?
      ORDER BY waste_date DESC
      LIMIT 10
    `, [item.item_name]);
    
    res.json({
      success: true,
      data: {
        id: item.id,
        itemName: item.item_name,
        category: item.category,
        quantity: parseFloat(item.quantity),
        unitPrice: item.unit_price ? parseFloat(item.unit_price) : 0,
        totalValue: parseFloat(item.quantity * (item.unit_price || 0)),
        lastPurchaseDate: item.last_purchase_date,
        lastSaleDate: item.last_sale_date,
        expiryDate: item.expiry_date,
        updatedAt: item.updated_at,
        history: {
          purchases: purchases.map(p => ({
            id: p.id,
            vendor: p.vendor,
            date: p.purchase_date,
            quantity: parseFloat(p.quantity),
            unitPrice: parseFloat(p.unit_price),
            totalPrice: parseFloat(p.total_price)
          })),
          sales: sales.map(s => ({
            id: s.id,
            date: s.report_date,
            quantity: s.quantity,
            unitPrice: parseFloat(s.unit_price),
            totalPrice: parseFloat(s.total_price)
          })),
          waste: waste.map(w => ({
            id: w.id,
            quantity: parseFloat(w.quantity),
            costValue: parseFloat(w.cost_value),
            date: w.waste_date,
            reason: w.reason
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch inventory item',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/inventory/:id
 * Update inventory item
 */
router.put('/:id', async (req, res) => {
  try {
    const { quantity, unitPrice, category, expiryDate } = req.body;
    
    // Validate
    if (quantity !== undefined && (isNaN(quantity) || quantity < 0)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Quantity must be a non-negative number',
          details: { field: 'quantity', value: quantity }
        }
      });
    }
    
    // Check if item exists
    const existing = await db.getAsync('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Inventory item not found'
        }
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const params = [];
    
    if (quantity !== undefined) {
      updates.push('quantity = ?');
      params.push(quantity);
    }
    
    if (unitPrice !== undefined) {
      updates.push('unit_price = ?');
      params.push(unitPrice);
    }
    
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    
    if (expiryDate !== undefined) {
      updates.push('expiry_date = ?');
      params.push(expiryDate);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update'
        }
      });
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(req.params.id);
    
    await db.runAsync(`
      UPDATE inventory
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);
    
    // Fetch updated item
    const updated = await db.getAsync('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    
    res.json({
      success: true,
      message: 'Inventory item updated successfully',
      data: {
        id: updated.id,
        itemName: updated.item_name,
        category: updated.category,
        quantity: parseFloat(updated.quantity),
        unitPrice: updated.unit_price ? parseFloat(updated.unit_price) : 0,
        expiryDate: updated.expiry_date,
        updatedAt: updated.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update inventory item',
        details: error.message
      }
    });
  }
});

module.exports = router;
```

---

## 2. Register Routes in server.js

**File**: `backend/src/server.js`

Add this line after the other route imports:

```javascript
const inventoryRoutes = require('./routes/inventoryRoutes');
```

Add this line after the other route registrations:

```javascript
app.use('/api/inventory', inventoryRoutes);
```

---

## 3. Update Frontend API Service

**File**: `fila/assets/js/api/apiService.js`

Add these methods to the `ApiService` class:

```javascript
/**
 * Get all inventory items
 */
async getInventory(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.append('category', filters.category);
  if (filters.lowStock) params.append('lowStock', 'true');
  if (filters.threshold) params.append('threshold', filters.threshold);
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  return this.request(`/inventory?${params.toString()}`);
}

/**
 * Get low stock items
 */
async getLowStockItems(threshold = 10) {
  return this.request(`/inventory/low-stock?threshold=${threshold}`);
}

/**
 * Get single inventory item
 */
async getInventoryItem(id) {
  return this.request(`/inventory/${id}`);
}

/**
 * Update inventory item
 */
async updateInventoryItem(id, data) {
  return this.request(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}
```

---

## 4. Usage Examples

### Frontend: Fetch Inventory

```javascript
// Get all inventory
const inventory = await apiService.getInventory({
  page: 1,
  limit: 50
});

console.log(inventory.data.items); // Array of items
console.log(inventory.data.summary.totalValue); // Total inventory value
console.log(inventory.data.pagination.totalPages); // Total pages

// Get low stock items
const lowStock = await apiService.getLowStockItems(10);
console.log(lowStock.data.items); // Items below threshold

// Get single item with history
const item = await apiService.getInventoryItem(123);
console.log(item.data.history.purchases); // Purchase history
console.log(item.data.history.sales); // Sales history
console.log(item.data.history.waste); // Waste history

// Update inventory
await apiService.updateInventoryItem(123, {
  quantity: 50,
  unitPrice: 9.99
});
```

### Backend: Test with curl

```bash
# Get all inventory
curl http://localhost:8000/api/inventory

# Get low stock items
curl http://localhost:8000/api/inventory/low-stock?threshold=10

# Get single item
curl http://localhost:8000/api/inventory/1

# Update item
curl -X PUT http://localhost:8000/api/inventory/1 \
  -H "Content-Type: application/json" \
  -d '{"quantity": 50, "unitPrice": 9.99}'
```

---

## 5. Testing

Create test file: `backend/tests/inventoryRoutes.test.js`

```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Inventory Routes', () => {
  it('should get all inventory items', async () => {
    const response = await request(app)
      .get('/api/inventory')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toBeArray();
  });
  
  it('should get low stock items', async () => {
    const response = await request(app)
      .get('/api/inventory/low-stock?threshold=10')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.items.every(item => item.quantity < 10)).toBe(true);
  });
  
  it('should update inventory item', async () => {
    const response = await request(app)
      .put('/api/inventory/1')
      .send({ quantity: 50 })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.quantity).toBe(50);
  });
});
```

---

## Summary

This implementation provides:
- ✅ Full inventory listing with pagination
- ✅ Low stock filtering
- ✅ Single item details with history
- ✅ Update functionality
- ✅ Consistent error handling
- ✅ Proper validation

**Next Steps**: Implement similar patterns for invoice and waste CRUD operations.
