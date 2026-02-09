const express = require('express');
const todoService = require('../services/todoService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/todos - Get all todos with filters and pagination
router.get('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    status: req.query.status,
    priority: req.query.priority,
    assignedTo: req.query.assignedTo,
    userId: req.query.userId,
    category: req.query.category,
    dueDateFrom: req.query.dueDateFrom,
    dueDateTo: req.query.dueDateTo,
    overdue: req.query.overdue,
    search: req.query.search,
    orderBy: req.query.orderBy,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await todoService.getTodos(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/todos/stats - Get todo statistics
router.get('/stats', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    assignedTo: req.query.assignedTo
  };

  const stats = await todoService.getTodoStats(tenantId, filters);
  res.json(formatSuccessResponse(stats));
}));

// GET /api/todos/:id - Get single todo
router.get('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const todoId = parseInt(req.params.id);

  const todo = await todoService.getTodoById(tenantId, todoId);
  res.json(formatSuccessResponse(todo));
}));

// POST /api/todos - Create new todo
router.post('/', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id; // From authenticate middleware

  const todo = await todoService.createTodo(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(todo));
}));

// PUT /api/todos/:id - Update todo
router.put('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const todoId = parseInt(req.params.id);

  const todo = await todoService.updateTodo(tenantId, todoId, req.body);
  res.json(formatSuccessResponse(todo));
}));

// PATCH /api/todos/:id/status - Update todo status only
router.patch('/:id/status', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const todoId = parseInt(req.params.id);

  const todo = await todoService.updateTodo(tenantId, todoId, { status: req.body.status });
  res.json(formatSuccessResponse(todo));
}));

// DELETE /api/todos/:id - Delete todo
router.delete('/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const todoId = parseInt(req.params.id);

  const result = await todoService.deleteTodo(tenantId, todoId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
