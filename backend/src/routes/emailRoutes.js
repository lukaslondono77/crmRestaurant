const express = require('express');
const multer = require('multer');
const path = require('path');
const emailService = require('../services/emailService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/emails');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// GET /api/emails - Get all emails with filters and pagination
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const filters = {
    folder: req.query.folder,
    status: req.query.status,
    isDraft: req.query.isDraft,
    isStarred: req.query.isStarred,
    isImportant: req.query.isImportant,
    search: req.query.search,
    orderBy: req.query.orderBy,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await emailService.getEmails(tenantId, userId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/emails/stats - Get email statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const stats = await emailService.getEmailStats(tenantId, userId);
  res.json(formatSuccessResponse(stats));
}));

// GET /api/emails/:id - Get single email
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const emailId = parseInt(req.params.id);
  const userId = req.user.id;

  const email = await emailService.getEmailById(tenantId, emailId, userId);
  res.json(formatSuccessResponse(email));
}));

// POST /api/emails - Create/send email
router.post('/', authenticate, tenantFilter, upload.array('attachments', 10), asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const emailData = {
    ...req.body,
    attachments: req.files ? req.files.map(file => ({
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      fileType: file.mimetype
    })) : []
  };

  const email = await emailService.createEmail(tenantId, userId, emailData);
  res.status(201).json(formatSuccessResponse(email));
}));

// PUT /api/emails/:id - Update email
router.put('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const emailId = parseInt(req.params.id);
  const userId = req.user.id;

  const email = await emailService.updateEmail(tenantId, emailId, userId, req.body);
  res.json(formatSuccessResponse(email));
}));

// DELETE /api/emails/:id - Delete email (move to trash)
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const emailId = parseInt(req.params.id);

  const result = await emailService.deleteEmail(tenantId, emailId);
  res.json(formatSuccessResponse(result));
}));

// DELETE /api/emails/:id/permanent - Permanently delete email
router.delete('/:id/permanent', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const emailId = parseInt(req.params.id);

  const result = await emailService.permanentlyDeleteEmail(tenantId, emailId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
