const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class EcommerceService {
  /**
   * Get all products
   */
  async getProducts(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['p.tenant_id = ?'];
    const params = [tenantId];

    if (filters.categoryId) {
      whereConditions.push('p.category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.status) {
      whereConditions.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters.featured !== undefined) {
      whereConditions.push('p.featured = ?');
      params.push(filters.featured ? 1 : 0);
    }

    if (filters.search) {
      whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.lowStock === 'true') {
      whereConditions.push('p.stock_quantity <= 10 AND p.track_inventory = 1');
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM ecommerce_products p ${whereClause}`, params);
    const total = countResult?.total || 0;

    const products = await db.allAsync(`
      SELECT 
        p.*,
        c.name as category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    const parsedProducts = products.map(product => ({
      ...product,
      track_inventory: Boolean(product.track_inventory),
      featured: Boolean(product.featured),
      images: product.images ? (this._tryParseJSON(product.images) || []) : [],
      tags: product.tags ? (this._tryParseJSON(product.tags) || []) : [],
      dimensions: product.dimensions ? (this._tryParseJSON(product.dimensions) || {}) : {}
    }));

    return formatPaginatedResponse(parsedProducts, total, page, limit);
  }

  /**
   * Get product by ID
   */
  async getProductById(tenantId, productId) {
    const product = await db.getAsync(`
      SELECT 
        p.*,
        c.name as category_name
      FROM ecommerce_products p
      LEFT JOIN ecommerce_categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.tenant_id = ?
    `, [productId, tenantId]);

    if (!product) {
      throw new Error('Product not found');
    }

    return {
      ...product,
      track_inventory: Boolean(product.track_inventory),
      featured: Boolean(product.featured),
      images: product.images ? (this._tryParseJSON(product.images) || []) : [],
      tags: product.tags ? (this._tryParseJSON(product.tags) || []) : [],
      dimensions: product.dimensions ? (this._tryParseJSON(product.dimensions) || {}) : {}
    };
  }

  /**
   * Create product
   */
  async createProduct(tenantId, productData) {
    const {
      name, description, sku, price, compareAtPrice, costPrice,
      stockQuantity = 0, trackInventory = true, categoryId,
      status = 'active', featured = false, images, tags,
      weight, dimensions, seoTitle, seoDescription
    } = productData;

    if (!name || !price) {
      throw new Error('Product name and price are required');
    }

    // Generate SKU if not provided
    let finalSku = sku;
    if (!finalSku) {
      finalSku = `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    const result = await db.runAsync(`
      INSERT INTO ecommerce_products (
        tenant_id, name, description, sku, price, compare_at_price, cost_price,
        stock_quantity, track_inventory, category_id, status, featured,
        images, tags, weight, dimensions, seo_title, seo_description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, name, description || null, finalSku, price,
      compareAtPrice || null, costPrice || null, stockQuantity,
      trackInventory ? 1 : 0, categoryId || null, status, featured ? 1 : 0,
      images ? (Array.isArray(images) ? JSON.stringify(images) : images) : null,
      tags ? (Array.isArray(tags) ? JSON.stringify(tags) : tags) : null,
      weight || null,
      dimensions ? (typeof dimensions === 'object' ? JSON.stringify(dimensions) : dimensions) : null,
      seoTitle || null, seoDescription || null
    ]);

    return this.getProductById(tenantId, result.lastID);
  }

  /**
   * Update product
   */
  async updateProduct(tenantId, productId, updateData) {
    const existing = await this.getProductById(tenantId, productId);

    const updates = [];
    const params = [];

    const fields = {
      name: 'name',
      description: 'description',
      sku: 'sku',
      price: 'price',
      compareAtPrice: 'compare_at_price',
      costPrice: 'cost_price',
      stockQuantity: 'stock_quantity',
      categoryId: 'category_id',
      status: 'status',
      weight: 'weight',
      seoTitle: 'seo_title',
      seoDescription: 'seo_description'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updateData.trackInventory !== undefined) {
      updates.push('track_inventory = ?');
      params.push(updateData.trackInventory ? 1 : 0);
    }

    if (updateData.featured !== undefined) {
      updates.push('featured = ?');
      params.push(updateData.featured ? 1 : 0);
    }

    if (updateData.images !== undefined) {
      updates.push('images = ?');
      params.push(updateData.images ? (Array.isArray(updateData.images) ? JSON.stringify(updateData.images) : updateData.images) : null);
    }

    if (updateData.tags !== undefined) {
      updates.push('tags = ?');
      params.push(updateData.tags ? (Array.isArray(updateData.tags) ? JSON.stringify(updateData.tags) : updateData.tags) : null);
    }

    if (updateData.dimensions !== undefined) {
      updates.push('dimensions = ?');
      params.push(updateData.dimensions ? (typeof updateData.dimensions === 'object' ? JSON.stringify(updateData.dimensions) : updateData.dimensions) : null);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(productId, tenantId);

    await db.runAsync(`
      UPDATE ecommerce_products
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getProductById(tenantId, productId);
  }

  /**
   * Delete product
   */
  async deleteProduct(tenantId, productId) {
    const existing = await this.getProductById(tenantId, productId);
    
    await db.runAsync('DELETE FROM ecommerce_products WHERE id = ? AND tenant_id = ?', [productId, tenantId]);
    return { success: true, deleted: existing };
  }

  /**
   * Get categories
   */
  async getCategories(tenantId) {
    const categories = await db.allAsync(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM ecommerce_products WHERE category_id = c.id AND tenant_id = ?) as product_count
      FROM ecommerce_categories c
      WHERE c.tenant_id = ?
      ORDER BY c.name ASC
    `, [tenantId, tenantId]);

    return categories.map(cat => ({
      ...cat,
      product_count: cat.product_count || 0
    }));
  }

  /**
   * Create category
   */
  async createCategory(tenantId, categoryData) {
    const { name, description, parentId, imageUrl } = categoryData;

    if (!name) {
      throw new Error('Category name is required');
    }

    const result = await db.runAsync(`
      INSERT INTO ecommerce_categories (tenant_id, name, description, parent_id, image_url)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, name, description || null, parentId || null, imageUrl || null]);

    return await db.getAsync('SELECT * FROM ecommerce_categories WHERE id = ?', [result.lastID]);
  }

  /**
   * Get orders
   */
  async getOrders(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['o.tenant_id = ?'];
    const params = [tenantId];

    if (filters.paymentStatus) {
      whereConditions.push('o.payment_status = ?');
      params.push(filters.paymentStatus);
    }

    if (filters.fulfillmentStatus) {
      whereConditions.push('o.fulfillment_status = ?');
      params.push(filters.fulfillmentStatus);
    }

    if (filters.customerId) {
      whereConditions.push('o.customer_id = ?');
      params.push(filters.customerId);
    }

    if (filters.search) {
      whereConditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM ecommerce_orders o ${whereClause}`, params);
    const total = countResult?.total || 0;

    const orders = await db.allAsync(`
      SELECT * FROM ecommerce_orders o
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    // Get items for each order
    for (const order of orders) {
      order.items = await db.allAsync(`
        SELECT * FROM ecommerce_order_items
        WHERE order_id = ? AND tenant_id = ?
      `, [order.id, tenantId]);

      order.shipping_address = order.shipping_address ? this._tryParseJSON(order.shipping_address) : {};
      order.billing_address = order.billing_address ? this._tryParseJSON(order.billing_address) : {};
    }

    return formatPaginatedResponse(orders, total, page, limit);
  }

  /**
   * Create order
   */
  async createOrder(tenantId, orderData) {
    const {
      customerId, customerName, customerEmail, customerPhone,
      shippingAddress, billingAddress, items,
      subtotal, taxAmount = 0, shippingAmount = 0, discountAmount = 0,
      paymentMethod, notes
    } = orderData;

    if (!items || items.length === 0) {
      throw new Error('Order items are required');
    }

    const totalAmount = subtotal + taxAmount + shippingAmount - discountAmount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const result = await db.runAsync(`
      INSERT INTO ecommerce_orders (
        tenant_id, order_number, customer_id, customer_name, customer_email, customer_phone,
        shipping_address, billing_address, subtotal, tax_amount, shipping_amount,
        discount_amount, total_amount, payment_method, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, orderNumber, customerId || null, customerName || null,
      customerEmail || null, customerPhone || null,
      shippingAddress ? (typeof shippingAddress === 'object' ? JSON.stringify(shippingAddress) : shippingAddress) : null,
      billingAddress ? (typeof billingAddress === 'object' ? JSON.stringify(billingAddress) : billingAddress) : null,
      subtotal, taxAmount, shippingAmount, discountAmount, totalAmount,
      paymentMethod || null, notes || null
    ]);

    const orderId = result.lastID;

    // Create order items and update inventory
    for (const item of items) {
      await db.runAsync(`
        INSERT INTO ecommerce_order_items (
          tenant_id, order_id, product_id, product_name, product_sku,
          quantity, unit_price, total_price
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId, orderId, item.productId || null, item.productName,
        item.productSku || null, item.quantity, item.unitPrice, item.totalPrice
      ]);

      // Update product inventory if track_inventory is enabled
      if (item.productId) {
        await db.runAsync(`
          UPDATE ecommerce_products
          SET stock_quantity = stock_quantity - ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ? AND track_inventory = 1
        `, [item.quantity, item.productId, tenantId]);
      }
    }

    return this.getOrderById(tenantId, orderId);
  }

  /**
   * Get order by ID
   */
  async getOrderById(tenantId, orderId) {
    const order = await db.getAsync(`
      SELECT * FROM ecommerce_orders
      WHERE id = ? AND tenant_id = ?
    `, [orderId, tenantId]);

    if (!order) {
      throw new Error('Order not found');
    }

    order.items = await db.allAsync(`
      SELECT * FROM ecommerce_order_items
      WHERE order_id = ? AND tenant_id = ?
    `, [orderId, tenantId]);

    order.shipping_address = order.shipping_address ? this._tryParseJSON(order.shipping_address) : {};
    order.billing_address = order.billing_address ? this._tryParseJSON(order.billing_address) : {};

    return order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(tenantId, orderId, updateData) {
    const updates = [];
    const params = [];

    if (updateData.paymentStatus) {
      updates.push('payment_status = ?');
      params.push(updateData.paymentStatus);
    }

    if (updateData.fulfillmentStatus) {
      updates.push('fulfillment_status = ?');
      params.push(updateData.fulfillmentStatus);
    }

    if (updates.length === 0) {
      return this.getOrderById(tenantId, orderId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(orderId, tenantId);

    await db.runAsync(`
      UPDATE ecommerce_orders
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getOrderById(tenantId, orderId);
  }

  /**
   * Get or create cart
   */
  async getOrCreateCart(tenantId, userId, sessionId) {
    let cart;

    if (userId) {
      cart = await db.getAsync(`
        SELECT * FROM ecommerce_carts
        WHERE tenant_id = ? AND user_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId, userId]);
    } else if (sessionId) {
      cart = await db.getAsync(`
        SELECT * FROM ecommerce_carts
        WHERE tenant_id = ? AND session_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId, sessionId]);
    }

    if (!cart) {
      const result = await db.runAsync(`
        INSERT INTO ecommerce_carts (tenant_id, user_id, session_id)
        VALUES (?, ?, ?)
      `, [tenantId, userId || null, sessionId || null]);
      cart = await db.getAsync('SELECT * FROM ecommerce_carts WHERE id = ?', [result.lastID]);
    }

    // Get cart items
    cart.items = await db.allAsync(`
      SELECT 
        ci.*,
        p.name as product_name,
        p.price as product_price,
        p.images as product_images
      FROM ecommerce_cart_items ci
      JOIN ecommerce_products p ON ci.product_id = p.id
      WHERE ci.cart_id = ? AND ci.tenant_id = ?
    `, [cart.id, tenantId]);

    cart.items = cart.items.map(item => ({
      ...item,
      product_images: item.product_images ? (this._tryParseJSON(item.product_images) || []) : []
    }));

    return cart;
  }

  /**
   * Add item to cart
   */
  async addToCart(tenantId, cartId, productId, quantity = 1) {
    // Check if item already in cart
    const existing = await db.getAsync(`
      SELECT * FROM ecommerce_cart_items
      WHERE cart_id = ? AND product_id = ? AND tenant_id = ?
    `, [cartId, productId, tenantId]);

    if (existing) {
      await db.runAsync(`
        UPDATE ecommerce_cart_items
        SET quantity = quantity + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `, [quantity, existing.id, tenantId]);
    } else {
      await db.runAsync(`
        INSERT INTO ecommerce_cart_items (tenant_id, cart_id, product_id, quantity)
        VALUES (?, ?, ?, ?)
      `, [tenantId, cartId, productId, quantity]);
    }

    // Update cart updated_at
    await db.runAsync(`
      UPDATE ecommerce_carts
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [cartId, tenantId]);

    return this.getOrCreateCart(tenantId, null, null);
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(tenantId, cartId, itemId) {
    await db.runAsync(`
      DELETE FROM ecommerce_cart_items
      WHERE id = ? AND cart_id = ? AND tenant_id = ?
    `, [itemId, cartId, tenantId]);

    return { success: true };
  }

  /**
   * Helper method to safely parse JSON
   */
  _tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return str;
    }
  }
}

module.exports = new EcommerceService();
