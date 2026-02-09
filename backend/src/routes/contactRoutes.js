const express = require('express');
const contactService = require('../services/contactService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/contacts - Get all contacts with filters and pagination
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    contactType: req.query.contactType,
    status: req.query.status,
    userId: req.query.userId,
    company: req.query.company,
    search: req.query.search,
    orderBy: req.query.orderBy,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await contactService.getContacts(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/contacts/stats - Get contact statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId
  };

  const stats = await contactService.getContactStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

// GET /api/contacts/:id - Get single contact
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const contactId = parseInt(req.params.id);

  const contact = await contactService.getContactById(tenantId, contactId);
  res.json(formatSuccessResponse(contact));
}));

// POST /api/contacts - Create new contact
router.post('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const contact = await contactService.createContact(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(contact));
}));

// PUT /api/contacts/:id - Update contact
router.put('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const contactId = parseInt(req.params.id);

  const contact = await contactService.updateContact(tenantId, contactId, req.body);
  res.json(formatSuccessResponse(contact));
}));

// DELETE /api/contacts/:id - Delete contact
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const contactId = parseInt(req.params.id);

  const result = await contactService.deleteContact(tenantId, contactId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
