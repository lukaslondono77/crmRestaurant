const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const ocrService = require('../services/ocrService');
const analyticsService = require('../services/analyticsService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, formatSuccessResponse } = require('../utils/errorHandler');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/pos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'pos-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// POST /api/pos/upload - Upload and process POS report
router.post('/upload', authenticate, tenantFilter, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No image file provided', null, 400);
  }

  const tenantId = req.tenantId;
  const imageBuffer = fs.readFileSync(req.file.path);
  const extractedData = await ocrService.extractPOSData(imageBuffer, req.file.filename);

  // Save to database
  const saleResult = await db.runAsync(`
    INSERT INTO sales (tenant_id, report_date, total_sales, total_transactions, average_ticket, report_period, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    tenantId,
    extractedData.date,
    extractedData.totalSales,
    extractedData.totalTransactions,
    extractedData.averageTicket,
    extractedData.reportPeriod,
    req.file.path
  ]);

  // Save sales items
  for (const item of extractedData.items) {
    await db.runAsync(`
      INSERT INTO sales_items (tenant_id, sale_id, item_name, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      tenantId,
      saleResult.lastID,
      item.name,
      item.quantity,
      item.unitPrice,
      item.quantity * item.unitPrice
    ]);

    // Update inventory - reduce quantity (with tenant_id)
    await db.runAsync(`
      UPDATE inventory 
      SET quantity = quantity - ?,
          last_sale_date = ?
      WHERE item_name = ? AND tenant_id = ?
    `, [item.quantity, extractedData.date, item.name, tenantId]);
  }

  const response = formatSuccessResponse({
    id: saleResult.lastID,
    ...extractedData
  });
  
  res.json(response);
}));

// GET /api/pos/reports - Get all POS reports (paginated)
router.get('/reports', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const pagination = parsePaginationParams(req, 50, 100);
  let reports = [];
  let total = 0;
  try {
    const countResult = await db.getAsync('SELECT COUNT(*) as total FROM sales WHERE tenant_id = ?', [tenantId]);
    total = countResult?.total || 0;
    reports = await db.allAsync(`
      SELECT * FROM sales 
      WHERE tenant_id = ?
      ORDER BY report_date DESC 
      LIMIT ? OFFSET ?
    `, [tenantId, pagination.limit, pagination.offset]);
  } catch (err) {
    console.error('GET /pos/reports error:', err);
  }
  const paginationMeta = formatPaginatedResponse([], total, pagination).pagination;
  const response = formatSuccessResponse(reports, { pagination: paginationMeta });
  response.reports = reports;
  res.json(response);
}));

module.exports = router;
