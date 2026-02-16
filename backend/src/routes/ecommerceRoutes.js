const express = require('express');
const ecommerceService = require('../services/ecommerceService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Products routes
router.get('/products', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    categoryId: req.query.categoryId,
    status: req.query.status,
    featured: req.query.featured,
    lowStock: req.query.lowStock,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await ecommerceService.getProducts(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/products/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const productId = parseInt(req.params.id);
  const product = await ecommerceService.getProductById(tenantId, productId);
  res.json(formatSuccessResponse(product));
}));

router.post('/products', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const product = await ecommerceService.createProduct(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(product));
}));

router.put('/products/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const productId = parseInt(req.params.id);
  const product = await ecommerceService.updateProduct(tenantId, productId, req.body);
  res.json(formatSuccessResponse(product));
}));

router.delete('/products/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const productId = parseInt(req.params.id);
  const result = await ecommerceService.deleteProduct(tenantId, productId);
  res.json(formatSuccessResponse(result));
}));

// Categories routes
router.get('/categories', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const categories = await ecommerceService.getCategories(tenantId);
  res.json(formatSuccessResponse(categories));
}));

router.post('/categories', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const category = await ecommerceService.createCategory(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(category));
}));

// Orders routes
router.get('/orders', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    paymentStatus: req.query.paymentStatus,
    fulfillmentStatus: req.query.fulfillmentStatus,
    customerId: req.query.customerId,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await ecommerceService.getOrders(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/orders/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const orderId = parseInt(req.params.id);
  const order = await ecommerceService.getOrderById(tenantId, orderId);
  res.json(formatSuccessResponse(order));
}));

router.post('/orders', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const order = await ecommerceService.createOrder(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(order));
}));

router.put('/orders/:id/status', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const orderId = parseInt(req.params.id);
  const order = await ecommerceService.updateOrderStatus(tenantId, orderId, req.body);
  res.json(formatSuccessResponse(order));
}));

// Cart routes
router.get('/cart', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const sessionId = req.query.sessionId;
  const cart = await ecommerceService.getOrCreateCart(tenantId, userId, sessionId);
  res.json(formatSuccessResponse(cart));
}));

router.post('/cart/items', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const { cartId, productId, quantity } = req.body;
  const cart = await ecommerceService.addToCart(tenantId, cartId, productId, quantity);
  res.json(formatSuccessResponse(cart));
}));

router.delete('/cart/items/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const itemId = parseInt(req.params.id);
  const cartId = parseInt(req.query.cartId);
  const result = await ecommerceService.removeFromCart(tenantId, cartId, itemId);
  res.json(formatSuccessResponse(result));
}));

module.exports = router;
