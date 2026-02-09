const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const ocrService = require('../services/ocrService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, formatSuccessResponse } = require('../utils/errorHandler');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/invoices');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'inv-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/invoices/upload - Upload and process invoice
router.post('/upload', authenticate, tenantFilter, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No image file provided', null, 400);
  }

  const tenantId = req.tenantId;
  const imageBuffer = fs.readFileSync(req.file.path);
  const extractedData = await ocrService.extractInvoiceData(imageBuffer, req.file.filename);

  // Save purchase
  const purchaseResult = await db.runAsync(`
    INSERT INTO purchases (tenant_id, vendor, purchase_date, invoice_number, total_amount, image_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    tenantId,
    extractedData.vendor,
    extractedData.date,
    extractedData.invoiceNumber,
    extractedData.totalAmount,
    req.file.path
  ]);

  // Save purchase items and update inventory
  for (const item of extractedData.items) {
    await db.runAsync(`
      INSERT INTO purchase_items (tenant_id, purchase_id, item_name, quantity, unit_price, total_price, category, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      purchaseResult.lastID,
      item.name,
      item.quantity,
      item.unitPrice,
      item.totalPrice,
      item.category,
      item.expiryDate || null
    ]);

    // Update or insert inventory (with tenant_id)
    await db.runAsync(`
      INSERT INTO inventory (tenant_id, item_name, quantity, unit_price, category, last_purchase_date, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, item_name) DO UPDATE SET
        quantity = quantity + ?,
        unit_price = ?,
        last_purchase_date = ?,
        expiry_date = COALESCE(?, expiry_date),
        updated_at = CURRENT_TIMESTAMP
    `, [
      tenantId,
      item.name,
      item.quantity,
      item.unitPrice,
      item.category,
      extractedData.date,
      item.expiryDate || null,
      item.quantity,
      item.unitPrice,
      extractedData.date,
      item.expiryDate || null
    ]);
  }

  const response = formatSuccessResponse({
    id: purchaseResult.lastID,
    ...extractedData
  });
  
  res.json(response);
}));

// GET /api/invoices - Get all invoices with items (paginated)
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const pagination = parsePaginationParams(req, 50, 100);
  let invoices = [];
  let total = 0;
  try {
    const countResult = await db.getAsync('SELECT COUNT(*) as total FROM purchases WHERE tenant_id = ?', [tenantId]);
    total = countResult?.total || 0;
    invoices = await db.allAsync(`
      SELECT * FROM purchases 
      WHERE tenant_id = ?
      ORDER BY purchase_date DESC 
      LIMIT ? OFFSET ?
    `, [tenantId, pagination.limit, pagination.offset]);
    for (const invoice of invoices) {
      const items = await db.allAsync(`
        SELECT * FROM purchase_items 
        WHERE purchase_id = ? AND tenant_id = ?
      `, [invoice.id, tenantId]);
      invoice.items = items || [];
    }
  } catch (err) {
    console.error('GET /invoices error:', err);
  }
  const paginationMeta = formatPaginatedResponse([], total, pagination).pagination;
  const response = formatSuccessResponse(invoices, { pagination: paginationMeta });
  response.invoices = invoices;
  res.json(response);
}));

// GET /api/invoices/:id - Get single invoice with items
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const invoiceId = parseInt(req.params.id);
  
  const invoice = await db.getAsync(`
    SELECT * FROM purchases 
    WHERE id = ? AND tenant_id = ?
  `, [invoiceId, tenantId]);
  
  if (!invoice) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Invoice not found', null, 404);
  }
  
  // Get items
  const items = await db.allAsync(`
    SELECT * FROM purchase_items 
    WHERE purchase_id = ? AND tenant_id = ?
  `, [invoiceId, tenantId]);
  
  invoice.items = items;
  
  res.json(formatSuccessResponse(invoice));
}));

// DELETE /api/invoices/:id - Delete invoice
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const invoiceId = parseInt(req.params.id);
  
  const invoice = await db.getAsync(`
    SELECT * FROM purchases 
    WHERE id = ? AND tenant_id = ?
  `, [invoiceId, tenantId]);
  
  if (!invoice) {
    throw new ApiError(ErrorCodes.NOT_FOUND, 'Invoice not found', null, 404);
  }
  
  // Delete items first
  await db.runAsync(`
    DELETE FROM purchase_items 
    WHERE purchase_id = ? AND tenant_id = ?
  `, [invoiceId, tenantId]);
  
  // Delete invoice
  await db.runAsync(`
    DELETE FROM purchases 
    WHERE id = ? AND tenant_id = ?
  `, [invoiceId, tenantId]);
  
  res.json(formatSuccessResponse({ success: true, deleted: invoice }));
}));

// GET /api/invoices/stats - Get invoice statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];
  
  if (startDate && endDate) {
    whereClause += ' AND purchase_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  }
  
  const stats = await db.getAsync(`
    SELECT 
      COUNT(*) as total_invoices,
      SUM(total_amount) as total_amount,
      AVG(total_amount) as average_amount,
      MIN(total_amount) as min_amount,
      MAX(total_amount) as max_amount
    FROM purchases
    ${whereClause}
  `, params);
  
  res.json(formatSuccessResponse(stats));
}));

module.exports = router;
