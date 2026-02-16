const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const ocrService = require('../services/ocrService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, ApiError, ErrorCodes, validateRequiredFields, formatSuccessResponse } = require('../utils/errorHandler');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/waste');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'waste-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// POST /api/waste - Record waste
router.post('/', authenticate, tenantFilter, upload.single('image'), asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { itemName, quantity, costValue, wasteDate, reason, notes } = req.body;

  validateRequiredFields({ itemName, quantity, costValue, wasteDate }, 
    ['itemName', 'quantity', 'costValue', 'wasteDate']);

  const wasteResult = await db.runAsync(`
    INSERT INTO waste (tenant_id, item_name, quantity, cost_value, waste_date, reason, notes, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    tenantId,
    itemName,
    quantity,
    costValue,
    wasteDate,
    reason || null,
    notes || null,
    req.file ? req.file.path : null
  ]);

  // Update inventory - reduce quantity (with tenant_id)
  await db.runAsync(`
    UPDATE inventory 
    SET quantity = quantity - ?
    WHERE item_name = ? AND tenant_id = ?
  `, [quantity, itemName, tenantId]);

  const response = formatSuccessResponse({
    id: wasteResult.lastID,
    itemName,
    quantity,
    costValue,
    wasteDate,
    reason,
    notes
  });
  
  res.json(response);
}));

// GET /api/waste - Get all waste records (paginated)
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  const pagination = parsePaginationParams(req, 50, 100);
  let wasteRecords = [];
  let total = 0;
  try {
    let whereConditions = ['tenant_id = ?'];
    const params = [tenantId];
    if (startDate && endDate) {
      whereConditions.push('waste_date BETWEEN ? AND ?');
      params.push(startDate, endDate);
    }
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM waste ${whereClause}`, params);
    total = countResult?.total || 0;
    wasteRecords = await db.allAsync(`
      SELECT * FROM waste 
      ${whereClause}
      ORDER BY waste_date DESC 
      LIMIT ? OFFSET ?
    `, [...params, pagination.limit, pagination.offset]);
  } catch (err) {
    console.error('GET /waste error:', err);
  }
  const paginationMeta = formatPaginatedResponse([], total, pagination).pagination;
  const response = formatSuccessResponse(wasteRecords, { pagination: paginationMeta });
  response.wasteRecords = wasteRecords;
  res.json(response);
}));

module.exports = router;
