const express = require('express');
const chatService = require('../services/chatService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// GET /api/chat/conversations - Get all conversations for user
router.get('/conversations', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const filters = {
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await chatService.getConversations(tenantId, userId, filters);
  res.json(formatSuccessResponse(result));
}));

// GET /api/chat/conversations/:id - Get single conversation
router.get('/conversations/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const conversationId = parseInt(req.params.id);

  const conversation = await chatService.getConversationById(tenantId, conversationId);
  res.json(formatSuccessResponse(conversation));
}));

// POST /api/chat/conversations/direct - Get or create direct conversation
router.post('/conversations/direct', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId1 = req.user.id;
  const userId2 = parseInt(req.body.userId);

  if (!userId2) {
    throw new Error('User ID is required');
  }

  const conversation = await chatService.getOrCreateDirectConversation(tenantId, userId1, userId2);
  res.json(formatSuccessResponse(conversation));
}));

// POST /api/chat/conversations/group - Create group conversation
router.post('/conversations/group', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const { name, participantIds } = req.body;

  if (!name || !participantIds || !Array.isArray(participantIds)) {
    throw new Error('Name and participant IDs array are required');
  }

  const conversation = await chatService.createGroupConversation(tenantId, userId, name, participantIds);
  res.status(201).json(formatSuccessResponse(conversation));
}));

// GET /api/chat/conversations/:id/messages - Get messages for conversation
router.get('/conversations/:id/messages', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const conversationId = parseInt(req.params.id);
  const userId = req.user.id;
  const filters = {
    userId,
    page: req.query.page,
    limit: req.query.limit
  };

  const result = await chatService.getMessages(tenantId, conversationId, filters);
  res.json(formatSuccessResponse(result));
}));

// POST /api/chat/conversations/:id/messages - Send message
router.post('/conversations/:id/messages', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const conversationId = parseInt(req.params.id);
  const userId = req.user.id;

  const message = await chatService.sendMessage(tenantId, conversationId, userId, req.body);
  res.status(201).json(formatSuccessResponse(message));
}));

// PATCH /api/chat/conversations/:id/read - Mark messages as read
router.patch('/conversations/:id/read', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const conversationId = parseInt(req.params.id);
  const userId = req.user.id;

  const result = await chatService.markMessagesAsRead(tenantId, conversationId, userId);
  res.json(formatSuccessResponse(result));
}));

// DELETE /api/chat/messages/:id - Delete message
router.delete('/messages/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const messageId = parseInt(req.params.id);
  const userId = req.user.id;

  const result = await chatService.deleteMessage(tenantId, messageId, userId);
  res.json(formatSuccessResponse(result));
}));

// GET /api/chat/unread-count - Get unread message count
router.get('/unread-count', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  const count = await chatService.getUnreadCount(tenantId, userId);
  res.json(formatSuccessResponse({ count }));
}));

module.exports = router;
