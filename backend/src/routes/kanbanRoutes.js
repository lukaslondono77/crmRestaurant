const express = require('express');
const kanbanService = require('../services/kanbanService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/kanban/boards - Get all boards
router.get('/boards', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    userId: req.query.userId,
    isArchived: req.query.isArchived,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await kanbanService.getBoards(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/kanban/boards/:id - Get board with columns and cards
router.get('/boards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const boardId = parseInt(req.params.id);

  const board = await kanbanService.getBoardById(tenantId, boardId);
  res.json(formatSuccessResponse(board));
}));

// POST /api/kanban/boards - Create board
router.post('/boards', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const board = await kanbanService.createBoard(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(board));
}));

// PUT /api/kanban/boards/:id - Update board
router.put('/boards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const boardId = parseInt(req.params.id);

  const board = await kanbanService.updateBoard(tenantId, boardId, req.body);
  res.json(formatSuccessResponse(board));
}));

// DELETE /api/kanban/boards/:id - Delete board
router.delete('/boards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const boardId = parseInt(req.params.id);

  const result = await kanbanService.deleteBoard(tenantId, boardId);
  res.json(formatSuccessResponse(result));
}));

// POST /api/kanban/boards/:id/columns - Create column
router.post('/boards/:id/columns', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const boardId = parseInt(req.params.id);

  const column = await kanbanService.createColumn(tenantId, boardId, req.body);
  res.status(201).json(formatSuccessResponse(column));
}));

// PUT /api/kanban/columns/:id - Update column
router.put('/columns/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const columnId = parseInt(req.params.id);

  const column = await kanbanService.updateColumn(tenantId, columnId, req.body);
  res.json(formatSuccessResponse(column));
}));

// DELETE /api/kanban/columns/:id - Delete column
router.delete('/columns/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const columnId = parseInt(req.params.id);

  const result = await kanbanService.deleteColumn(tenantId, columnId);
  res.json(formatSuccessResponse(result));
}));

// POST /api/kanban/boards/:id/cards - Create card
router.post('/boards/:id/cards', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const boardId = parseInt(req.params.id);
  const userId = req.user.id;
  const { columnId, ...cardData } = req.body;

  if (!columnId) {
    throw new Error('Column ID is required');
  }

  const card = await kanbanService.createCard(tenantId, boardId, columnId, userId, cardData);
  res.status(201).json(formatSuccessResponse(card));
}));

// GET /api/kanban/cards/:id - Get card
router.get('/cards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const cardId = parseInt(req.params.id);

  const card = await kanbanService.getCardById(tenantId, cardId);
  res.json(formatSuccessResponse(card));
}));

// PUT /api/kanban/cards/:id - Update card
router.put('/cards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const cardId = parseInt(req.params.id);

  const card = await kanbanService.updateCard(tenantId, cardId, req.body);
  res.json(formatSuccessResponse(card));
}));

// PATCH /api/kanban/cards/:id/move - Move card to different column
router.patch('/cards/:id/move', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const cardId = parseInt(req.params.id);
  const { columnId, position } = req.body;

  if (!columnId || position === undefined) {
    throw new Error('Column ID and position are required');
  }

  const card = await kanbanService.moveCard(tenantId, cardId, columnId, position);
  res.json(formatSuccessResponse(card));
}));

// DELETE /api/kanban/cards/:id - Delete card
router.delete('/cards/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const cardId = parseInt(req.params.id);

  const result = await kanbanService.deleteCard(tenantId, cardId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
