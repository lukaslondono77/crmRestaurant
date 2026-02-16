const express = require('express');
const db = require('../config/database');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, formatSuccessResponse } = require('../utils/errorHandler');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();

/**
 * GET /api/inventory
 * Get all inventory items with optional filters
 * 
 * Query params:
 * - category: Filter by category
 * - lowStock: Only items below threshold (default: 10)
 * - threshold: Stock threshold for lowStock filter (default: 10)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 */
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { category, lowStock, threshold = 10 } = req.query;
  const pagination = parsePaginationParams(req, 50, 100);
  
  // Build base query
  let whereConditions = ['tenant_id = ?', 'quantity >= 0']; // Include all items, even zero quantity
  const params = [tenantId];
  
  // Apply filters
  if (category) {
    whereConditions.push('category = ?');
    params.push(category);
  }
  
  if (lowStock === 'true') {
    whereConditions.push('quantity < ?');
    params.push(parseFloat(threshold));
  }
  
  const whereClause = whereConditions.length > 0 
    ? `WHERE ${whereConditions.join(' AND ')}` 
    : '';
  
  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM inventory 
    ${whereClause}
  `;
  const countResult = await db.getAsync(countQuery, params);
  const total = countResult?.total || 0;
  
  // Get items with pagination
  const itemsQuery = `
    SELECT 
      id,
      item_name,
      category,
      quantity,
      unit_price,
      last_purchase_date,
      last_sale_date,
      expiry_date,
      updated_at,
      (quantity * COALESCE(unit_price, 0)) as total_value,
      CASE 
        WHEN expiry_date IS NOT NULL 
        THEN julianday(expiry_date) - julianday('now')
        ELSE NULL
      END as days_until_expiry
    FROM inventory
    ${whereClause}
    ORDER BY item_name ASC 
    LIMIT ? OFFSET ?
  `;
  
  const items = await db.allAsync(itemsQuery, [...params, pagination.limit, pagination.offset]);
  
  // Calculate summary
  const summaryQuery = `
    SELECT 
      COUNT(*) as total_items,
      SUM(quantity * COALESCE(unit_price, 0)) as total_value,
      SUM(CASE WHEN quantity < 10 AND quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE 
        WHEN expiry_date IS NOT NULL 
        AND julianday(expiry_date) - julianday('now') <= 7 
        AND julianday(expiry_date) - julianday('now') >= 0
        THEN 1 ELSE 0 
      END) as expiring_soon_count
    FROM inventory
    ${whereClause}
  `;
  
  const summary = await db.getAsync(summaryQuery, params) || {};
  
  // Format items
  const formattedItems = items.map(item => ({
    id: item.id,
    itemName: item.item_name,
    category: item.category,
    quantity: parseFloat(item.quantity || 0),
    unitPrice: item.unit_price ? parseFloat(item.unit_price) : 0,
    totalValue: parseFloat(item.total_value || 0),
    lastPurchaseDate: item.last_purchase_date,
    lastSaleDate: item.last_sale_date,
    expiryDate: item.expiry_date,
    updatedAt: item.updated_at,
    daysUntilExpiry: item.days_until_expiry ? Math.floor(item.days_until_expiry) : null,
    isLowStock: item.quantity < 10 && item.quantity > 0,
    isExpiringSoon: item.days_until_expiry !== null && item.days_until_expiry <= 7 && item.days_until_expiry >= 0
  }));
  
  const response = formatSuccessResponse({
    items: formattedItems,
    pagination: formatPaginatedResponse([], total, pagination).pagination,
    summary: {
      totalItems: summary.total_items || 0,
      totalValue: parseFloat(summary.total_value || 0),
      lowStockCount: summary.low_stock_count || 0,
      expiringSoonCount: summary.expiring_soon_count || 0
    }
  });
  
  res.json(response);
}));

/**
 * GET /api/inventory/low-stock
 * Get items below stock threshold
 * 
 * Query params:
 * - threshold: Stock threshold (default: 10)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 */
router.get('/low-stock', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const threshold = parseFloat(req.query.threshold) || 10;
  const pagination = parsePaginationParams(req, 50, 100);
  
  const countQuery = `
    SELECT COUNT(*) as total
    FROM inventory
    WHERE tenant_id = ? AND quantity > 0 AND quantity < ?
  `;
  const countResult = await db.getAsync(countQuery, [tenantId, threshold]);
  const total = countResult?.total || 0;
  
  const itemsQuery = `
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
    WHERE tenant_id = ? AND quantity > 0 AND quantity < ?
    ORDER BY quantity ASC
    LIMIT ? OFFSET ?
  `;
  
  const items = await db.allAsync(itemsQuery, [tenantId, threshold, pagination.limit, pagination.offset]);
  
  const formattedItems = items.map(item => ({
    id: item.id,
    itemName: item.item_name,
    category: item.category,
    quantity: parseFloat(item.quantity),
    unitPrice: item.unit_price ? parseFloat(item.unit_price) : 0,
    totalValue: parseFloat(item.total_value || 0),
    lastPurchaseDate: item.last_purchase_date,
    expiryDate: item.expiry_date,
    threshold: threshold
  }));
  
  const response = formatSuccessResponse({
    items: formattedItems,
    pagination: formatPaginatedResponse([], total, pagination).pagination,
    threshold: threshold
  });
  
  res.json(response);
}));

/**
 * GET /api/inventory/counts/items
 * Items to include in weekly count: one row per ingredient (inventory + purchase_items, deduped by item_name).
 */
router.get('/counts/items', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const rows = await db.allAsync(`
    SELECT item_name, category, unit_price
    FROM (
      SELECT item_name, category, unit_price FROM inventory WHERE tenant_id = ?
      UNION ALL
      SELECT pi.item_name, pi.category, pi.unit_price FROM purchase_items pi
      JOIN purchases p ON pi.purchase_id = p.id
      WHERE p.tenant_id = ?
    )
    WHERE item_name IS NOT NULL AND TRIM(item_name) != ''
    ORDER BY item_name
  `, [tenantId, tenantId]);
  // Dedupe by item_name so each ingredient appears once (keep first category/unit_price per name)
  const seen = new Set();
  const items = (rows || []).filter(r => {
    const key = (r.item_name || '').trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const formatted = items.map(r => ({
    itemName: (r.item_name || '').trim(),
    category: r.category || null,
    unitPrice: r.unit_price != null ? parseFloat(r.unit_price) : null
  }));
  res.json(formatSuccessResponse({ items: formatted }));
}));

/**
 * GET /api/inventory/counts
 * Weekly counts. Query: ?weekEnd=YYYY-MM-DD (default: last Sunday).
 */
router.get('/counts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  let weekEnd = req.query.weekEnd;
  if (!weekEnd) {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    weekEnd = d.toISOString().slice(0, 10);
  }
  const rows = await db.allAsync(`
    SELECT item_name, quantity, unit_price, category, notes, created_at
    FROM inventory_counts
    WHERE tenant_id = ? AND count_date = ?
    ORDER BY item_name
  `, [tenantId, weekEnd]);
  const items = (rows || []).map(r => ({
    itemName: r.item_name,
    quantity: parseFloat(r.quantity || 0),
    unitPrice: r.unit_price ? parseFloat(r.unit_price) : null,
    category: r.category,
    notes: r.notes,
    createdAt: r.created_at
  }));
  res.json(formatSuccessResponse({ countDate: weekEnd, items }));
}));

/**
 * POST /api/inventory/counts
 * Submit weekly inventory count. Body: { countDate, items: [ { itemName, quantity, unitPrice?, category?, notes? } ] }
 */
router.post('/counts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { countDate, items } = req.body;
  if (!countDate || !Array.isArray(items)) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'countDate and items array required', null, 400);
  }
  for (const it of items) {
    const name = (it.itemName || it.item_name || '').trim();
    if (!name) continue;
    const qty = parseFloat(it.quantity || 0);
    const up = it.unitPrice != null ? parseFloat(it.unitPrice) : null;
    const cat = it.category || null;
    const notes = it.notes || null;
    await db.runAsync(`
      INSERT OR REPLACE INTO inventory_counts (tenant_id, count_date, item_name, quantity, unit_price, category, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [tenantId, countDate, name, qty, up, cat, notes]);
  }
  const saved = await db.allAsync(`
    SELECT item_name, quantity, unit_price, category, notes
    FROM inventory_counts WHERE tenant_id = ? AND count_date = ?
    ORDER BY item_name
  `, [tenantId, countDate]);
  res.status(201).json(formatSuccessResponse({
    countDate,
    items: (saved || []).map(r => ({
      itemName: r.item_name,
      quantity: parseFloat(r.quantity),
      unitPrice: r.unit_price ? parseFloat(r.unit_price) : null,
      category: r.category,
      notes: r.notes
    }))
  }, { message: 'Weekly count saved' }));
}));

/**
 * GET /api/inventory/:id
 * Get single inventory item with purchase/sales/waste history
 */
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
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
    WHERE id = ? AND tenant_id = ?
  `, [req.params.id, tenantId]);
  
  if (!item) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Inventory item not found', null, 404);
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
    WHERE pi.item_name = ? AND pi.tenant_id = ? AND p.tenant_id = ?
    ORDER BY p.purchase_date DESC
    LIMIT 10
  `, [item.item_name, tenantId, tenantId]);
  
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
    WHERE si.item_name = ? AND si.tenant_id = ? AND s.tenant_id = ?
    ORDER BY s.report_date DESC
    LIMIT 10
  `, [item.item_name, tenantId, tenantId]);
  
  // Get waste history
  const waste = await db.allAsync(`
    SELECT 
      id,
      quantity,
      cost_value,
      waste_date,
      reason
    FROM waste
    WHERE item_name = ? AND tenant_id = ?
    ORDER BY waste_date DESC
    LIMIT 10
  `, [item.item_name, tenantId]);
  
  const response = formatSuccessResponse({
    id: item.id,
    itemName: item.item_name,
    category: item.category,
    quantity: parseFloat(item.quantity || 0),
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
  });
  
  res.json(response);
}));

/**
 * PUT /api/inventory/:id
 * Update inventory item
 */
router.put('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const itemId = parseInt(req.params.id);
  const { itemName, category, quantity, unitPrice, expiryDate } = req.body;
  
  // Check if item exists
  const existing = await db.getAsync(`
    SELECT * FROM inventory
    WHERE id = ? AND tenant_id = ?
  `, [itemId, tenantId]);
  
  if (!existing) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Inventory item not found', null, 404);
  }
  
  // Build update query
  const updates = [];
  const params = [];
  
  if (itemName !== undefined) {
    updates.push('item_name = ?');
    params.push(itemName);
  }
  
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  
  if (quantity !== undefined) {
    updates.push('quantity = ?');
    params.push(parseFloat(quantity));
  }
  
  if (unitPrice !== undefined) {
    updates.push('unit_price = ?');
    params.push(parseFloat(unitPrice));
  }
  
  if (expiryDate !== undefined) {
    updates.push('expiry_date = ?');
    params.push(expiryDate || null);
  }
  
  if (updates.length === 0) {
    // No updates provided, return existing item
    const response = formatSuccessResponse({
      id: existing.id,
      itemName: existing.item_name,
      category: existing.category,
      quantity: parseFloat(existing.quantity || 0),
      unitPrice: existing.unit_price ? parseFloat(existing.unit_price) : 0,
      totalValue: parseFloat(existing.quantity * (existing.unit_price || 0)),
      lastPurchaseDate: existing.last_purchase_date,
      lastSaleDate: existing.last_sale_date,
      expiryDate: existing.expiry_date,
      updatedAt: existing.updated_at
    });
    return res.json(response);
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(itemId, tenantId);
  
  await db.runAsync(`
    UPDATE inventory
    SET ${updates.join(', ')}
    WHERE id = ? AND tenant_id = ?
  `, params);
  
  // Get updated item
  const updated = await db.getAsync(`
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
    WHERE id = ? AND tenant_id = ?
  `, [itemId, tenantId]);
  
  const response = formatSuccessResponse({
    id: updated.id,
    itemName: updated.item_name,
    category: updated.category,
    quantity: parseFloat(updated.quantity || 0),
    unitPrice: updated.unit_price ? parseFloat(updated.unit_price) : 0,
    totalValue: parseFloat(updated.quantity * (updated.unit_price || 0)),
    lastPurchaseDate: updated.last_purchase_date,
    lastSaleDate: updated.last_sale_date,
    expiryDate: updated.expiry_date,
    updatedAt: updated.updated_at
  });
  
  res.json(response);
}));

/**
 * DELETE /api/inventory/:id
 * Delete inventory item
 */
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const itemId = parseInt(req.params.id);
  
  // Check if item exists
  const existing = await db.getAsync(`
    SELECT * FROM inventory
    WHERE id = ? AND tenant_id = ?
  `, [itemId, tenantId]);
  
  if (!existing) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Inventory item not found', null, 404);
  }
  
  // Delete the item
  await db.runAsync(`
    DELETE FROM inventory
    WHERE id = ? AND tenant_id = ?
  `, [itemId, tenantId]);
  
  const response = formatSuccessResponse({
    success: true,
    deleted: {
      id: existing.id,
      itemName: existing.item_name
    }
  });
  
  res.json(response);
}));

/**
 * POST /api/inventory
 * Create new inventory item manually
 */
router.post('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { itemName, category, quantity, unitPrice, expiryDate } = req.body;
  
  if (!itemName) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Item name is required', null, 400);
  }
  
  // Check if item already exists
  const existing = await db.getAsync(`
    SELECT * FROM inventory
    WHERE item_name = ? AND tenant_id = ?
  `, [itemName, tenantId]);
  
  if (existing) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Inventory item with this name already exists', null, 400);
  }
  
  // Insert new item
  const result = await db.runAsync(`
    INSERT INTO inventory (
      tenant_id, item_name, category, quantity, unit_price, expiry_date
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    tenantId,
    itemName,
    category || null,
    parseFloat(quantity || 0),
    unitPrice ? parseFloat(unitPrice) : null,
    expiryDate || null
  ]);
  
  // Get created item
  const newItem = await db.getAsync(`
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
  `, [result.lastID]);
  
  const response = formatSuccessResponse({
    id: newItem.id,
    itemName: newItem.item_name,
    category: newItem.category,
    quantity: parseFloat(newItem.quantity || 0),
    unitPrice: newItem.unit_price ? parseFloat(newItem.unit_price) : 0,
    totalValue: parseFloat(newItem.quantity * (newItem.unit_price || 0)),
    lastPurchaseDate: newItem.last_purchase_date,
    lastSaleDate: newItem.last_sale_date,
    expiryDate: newItem.expiry_date,
    updatedAt: newItem.updated_at
  }, { message: 'Inventory item created successfully' });
  
  res.status(201).json(response);
}));

module.exports = router;
