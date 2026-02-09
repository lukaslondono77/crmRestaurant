const express = require('express');
const socialService = require('../services/socialService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Posts routes
router.get('/posts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const filters = {
    userId: req.query.userId,
    following: req.query.following,
    postType: req.query.postType,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await socialService.getPosts(tenantId, userId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/posts/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const postId = parseInt(req.params.id);
  const post = await socialService.getPostById(tenantId, postId, userId);
  res.json(formatSuccessResponse(post));
}));

router.post('/posts', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const post = await socialService.createPost(tenantId, userId, req.body);
  res.status(201).json(formatSuccessResponse(post));
}));

router.put('/posts/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const postId = parseInt(req.params.id);
  const post = await socialService.updatePost(tenantId, postId, userId, req.body);
  res.json(formatSuccessResponse(post));
}));

router.delete('/posts/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const postId = parseInt(req.params.id);
  const result = await socialService.deletePost(tenantId, postId, userId);
  res.json(formatSuccessResponse(result));
}));

// Like/Unlike routes
router.post('/posts/:id/like', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const postId = parseInt(req.params.id);
  const result = await socialService.toggleLike(tenantId, postId, userId);
  res.json(formatSuccessResponse(result));
}));

// Comments routes
router.post('/posts/:id/comments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const postId = parseInt(req.params.id);
  const comment = await socialService.addComment(tenantId, postId, userId, req.body);
  res.status(201).json(formatSuccessResponse(comment));
}));

// Follow/Unfollow routes
router.post('/users/:userId/follow', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const followerId = req.user.id;
  const followingId = parseInt(req.params.userId);
  const result = await socialService.toggleFollow(tenantId, followerId, followingId);
  res.json(formatSuccessResponse(result));
}));

// Notifications routes
router.get('/notifications', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const filters = {
    isRead: req.query.isRead,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await socialService.getNotifications(tenantId, userId, filters);
  res.json(formatSuccessResponse(result));
}));

router.put('/notifications/:id/read', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const notificationId = parseInt(req.params.id);
  const result = await socialService.markNotificationAsRead(tenantId, notificationId, userId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
