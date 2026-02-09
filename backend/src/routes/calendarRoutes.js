const express = require('express');
const calendarService = require('../services/calendarService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/calendar/events - Get all events with filters and pagination
router.get('/events', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    eventType: req.query.eventType,
    status: req.query.status,
    userId: req.query.userId,
    category: req.query.category,
    allDay: req.query.allDay,
    search: req.query.search,
    orderBy: req.query.orderBy,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await calendarService.getEvents(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/calendar/events/range - Get events for date range (for calendar view)
router.get('/events/range', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const startDate = req.query.startDate || new Date().toISOString().split('T')[0];
  const endDate = req.query.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const filters = {
    eventType: req.query.eventType,
    status: req.query.status,
    userId: req.query.userId
  };

  const events = await calendarService.getEventsByDateRange(tenantId, startDate, endDate, filters);
  res.json(formatSuccessResponse(events));
}));

// GET /api/calendar/events/upcoming - Get upcoming events
router.get('/events/upcoming', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const limit = parseInt(req.query.limit) || 10;
  const filters = {
    userId: req.query.userId,
    eventType: req.query.eventType
  };

  const events = await calendarService.getUpcomingEvents(tenantId, limit, filters);
  res.json(formatSuccessResponse(events));
}));

// GET /api/calendar/stats - Get event statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    startDate: req.query.startDate,
    endDate: req.query.endDate
  };

  const stats = await calendarService.getEventStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

// GET /api/calendar/events/:id - Get single event
router.get('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);

  const event = await calendarService.getEventById(tenantId, eventId);
  res.json(formatSuccessResponse(event));
}));

// POST /api/calendar/events - Create new event
router.post('/events', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const event = await calendarService.createEvent(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(event));
}));

// PUT /api/calendar/events/:id - Update event
router.put('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);

  const event = await calendarService.updateEvent(tenantId, eventId, req.body);
  res.json(formatSuccessResponse(event));
}));

// PATCH /api/calendar/events/:id/status - Update event status only
router.patch('/events/:id/status', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);

  const event = await calendarService.updateEvent(tenantId, eventId, { status: req.body.status });
  res.json(formatSuccessResponse(event));
}));

// DELETE /api/calendar/events/:id - Delete event
router.delete('/events/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const eventId = parseInt(req.params.id);

  const result = await calendarService.deleteEvent(tenantId, eventId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
