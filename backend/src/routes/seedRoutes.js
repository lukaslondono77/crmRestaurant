const express = require('express');
const db = require('../config/database');
const squareService = require('../services/squareService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler');
const router = express.Router();

/**
 * POST /api/seed/initialize - Initialize database with sample data or Square data
 * This endpoint will:
 * 1. Try to sync data from Square
 * 2. If no Square data, create sample data for demonstration
 * Now requires authentication and uses tenant_id
 */
router.post('/initialize', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const results = {
      square: { synced: false, message: '' },
      sample: { created: false, message: '' }
    };

    // Step 1: Try to sync from Square (last 7 days)
    try {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const today = new Date();
      
      const squareData = await squareService.getOrdersByDateRange(
        weekAgo.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      );

      if (squareData && squareData.items && squareData.items.length > 0) {
        // Save Square sales data
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const existingSale = await db.getAsync(`
            SELECT id FROM sales WHERE tenant_id = ? AND report_date = ?
          `, [tenantId, dateStr]);

          if (!existingSale) {
            const saleResult = await db.runAsync(`
              INSERT INTO sales (tenant_id, report_date, total_sales, total_transactions, average_ticket, report_period)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              tenantId,
              dateStr,
              squareData.totalSales * (0.8 + Math.random() * 0.4), // Vary sales
              Math.floor(squareData.totalTransactions * (0.7 + Math.random() * 0.6)),
              squareData.averageTicket,
              'daily'
            ]);

            // Add some sales items
            for (const item of squareData.items.slice(0, 4)) {
              await db.runAsync(`
                INSERT INTO sales_items (tenant_id, sale_id, item_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                tenantId,
                saleResult.lastID,
                item.name,
                Math.floor(item.quantity * (0.5 + Math.random())),
                item.unitPrice,
                item.totalPrice * (0.5 + Math.random())
              ]);
            }
          }
        }

        results.square = { synced: true, message: 'Synced sales data from Square' };
      }
    } catch (squareError) {
      console.log('Square sync not available, creating sample data');
      results.square = { synced: false, message: squareError.message };
    }

    // Step 2: Check if we have any data, if not create sample data
    const existingSales = await db.getAsync(`SELECT COUNT(*) as count FROM sales WHERE tenant_id = ?`, [tenantId]);
    const existingPurchases = await db.getAsync(`SELECT COUNT(*) as count FROM purchases WHERE tenant_id = ?`, [tenantId]);
    const existingWaste = await db.getAsync(`SELECT COUNT(*) as count FROM waste WHERE tenant_id = ?`, [tenantId]);

    // Always create sample purchases and waste if they don't exist (even if we have sales from Square)
    const needsPurchases = !existingPurchases || existingPurchases.count === 0;
    const needsWaste = !existingWaste || existingWaste.count === 0;

    if (needsPurchases || needsWaste) {
      
      // Create sample purchases (invoices) if needed
      if (needsPurchases) {
        const vendors = ['Sysco Foods', 'US Foods', 'Restaurant Depot', 'Local Market'];
        const items = [
          { name: 'Chicken Breast', category: 'Protein', price: 8.50 },
          { name: 'Ground Beef', category: 'Protein', price: 6.75 },
          { name: 'Lettuce', category: 'Vegetables', price: 2.30 },
          { name: 'Tomatoes', category: 'Vegetables', price: 3.20 },
          { name: 'Pasta', category: 'Pantry', price: 1.50 },
          { name: 'Olive Oil', category: 'Pantry', price: 12.00 },
          { name: 'Cheese', category: 'Dairy', price: 5.50 },
          { name: 'Milk', category: 'Dairy', price: 3.80 }
        ];

        for (let i = 0; i < 5; i++) {
        const purchaseDate = new Date();
        purchaseDate.setDate(purchaseDate.getDate() - (i * 2));
        const vendor = vendors[Math.floor(Math.random() * vendors.length)];
        const purchaseItems = items.slice(0, 3 + Math.floor(Math.random() * 3));
        
        let totalAmount = 0;
        const purchaseResult = await db.runAsync(`
          INSERT INTO purchases (tenant_id, vendor, purchase_date, invoice_number, total_amount)
          VALUES (?, ?, ?, ?, ?)
        `, [
          tenantId,
          vendor,
          purchaseDate.toISOString().split('T')[0],
          `INV-${1000 + i}`,
          0 // Will update after calculating
        ]);

        for (const item of purchaseItems) {
          const quantity = 10 + Math.floor(Math.random() * 20);
          const unitPrice = item.price * (0.9 + Math.random() * 0.2);
          const totalPrice = quantity * unitPrice;
          totalAmount += totalPrice;
          const purchaseDateStr = purchaseDate.toISOString().split('T')[0];

          await db.runAsync(`
            INSERT INTO purchase_items (tenant_id, purchase_id, item_name, quantity, unit_price, total_price, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            tenantId,
            purchaseResult.lastID,
            item.name,
            quantity,
            unitPrice,
            totalPrice,
            item.category
          ]);

          // Upsert inventory (defensive: fallback to UPDATE on UNIQUE constraint)
          try {
            await db.runAsync(`
              INSERT INTO inventory (tenant_id, item_name, quantity, unit_price, category, last_purchase_date)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(tenant_id, item_name) DO UPDATE SET
                quantity = quantity + excluded.quantity,
                unit_price = excluded.unit_price,
                last_purchase_date = excluded.last_purchase_date,
                updated_at = CURRENT_TIMESTAMP
            `, [
              tenantId,
              item.name,
              quantity,
              unitPrice,
              item.category,
              purchaseDateStr
            ]);
          } catch (invErr) {
            const isConstraint = (invErr.message || '').includes('UNIQUE') || (invErr.message || '').includes('SQLITE_CONSTRAINT');
            if (isConstraint) {
              await db.runAsync(`
                UPDATE inventory SET quantity = quantity + ?, unit_price = ?, last_purchase_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE tenant_id = ? AND item_name = ?
              `, [quantity, unitPrice, purchaseDateStr, tenantId, item.name]);
            } else {
              throw invErr;
            }
          }
        }

        // Update purchase total
        await db.runAsync(`
          UPDATE purchases SET total_amount = ? WHERE id = ?
        `, [totalAmount, purchaseResult.lastID]);
        }
      }

      // Create sample sales (if not from Square)
      if (!results.square.synced && (!existingSales || existingSales.count === 0)) {
        for (let i = 0; i < 7; i++) {
          const saleDate = new Date();
          saleDate.setDate(saleDate.getDate() - i);
          const totalSales = 1500 + Math.random() * 1000;
          const transactions = 50 + Math.floor(Math.random() * 50);

          const saleResult = await db.runAsync(`
            INSERT INTO sales (tenant_id, report_date, total_sales, total_transactions, average_ticket, report_period)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            tenantId,
            saleDate.toISOString().split('T')[0],
            totalSales,
            transactions,
            totalSales / transactions,
            'daily'
          ]);

          const menuItems = [
            { name: 'Grilled Chicken Plate', price: 18.99 },
            { name: 'Caesar Salad', price: 12.99 },
            { name: 'Pasta Carbonara', price: 16.99 },
            { name: 'Burger Deluxe', price: 14.99 }
          ];

          for (const menuItem of menuItems) {
            const quantity = Math.floor(transactions * (0.1 + Math.random() * 0.2));
            if (quantity > 0) {
              await db.runAsync(`
                INSERT INTO sales_items (tenant_id, sale_id, item_name, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)
              `, [
                tenantId,
                saleResult.lastID,
                menuItem.name,
                quantity,
                menuItem.price,
                quantity * menuItem.price
              ]);
            }
          }
        }
      }

      // Create sample waste records if needed
      if (needsWaste) {
        const items = [
          { name: 'Chicken Breast', category: 'Protein', price: 8.50 },
          { name: 'Ground Beef', category: 'Protein', price: 6.75 },
          { name: 'Lettuce', category: 'Vegetables', price: 2.30 },
          { name: 'Tomatoes', category: 'Vegetables', price: 3.20 },
          { name: 'Pasta', category: 'Pantry', price: 1.50 }
        ];

        for (let i = 0; i < 3; i++) {
          const wasteDate = new Date();
          wasteDate.setDate(wasteDate.getDate() - (i * 2));
          const wasteItems = items.slice(0, 2);

          for (const item of wasteItems) {
            const quantity = 2 + Math.random() * 5;
            const costValue = quantity * item.price * (0.8 + Math.random() * 0.4);

            await db.runAsync(`
              INSERT INTO waste (tenant_id, item_name, quantity, cost_value, waste_date, reason)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              tenantId,
              item.name,
              quantity,
              costValue,
              wasteDate.toISOString().split('T')[0],
              ['Expired', 'Damaged', 'Overstock'][Math.floor(Math.random() * 3)]
            ]);
          }
        }
      }

      const createdParts = [];
      if (needsPurchases) createdParts.push('purchases');
      if (needsWaste) createdParts.push('waste');
      if (!results.square.synced && (!existingSales || existingSales.count === 0)) createdParts.push('sales');

      results.sample = { 
        created: createdParts.length > 0, 
        message: createdParts.length > 0 
          ? `Created sample data: ${createdParts.join(', ')}` 
          : 'Database already has all required data' 
      };
    } else {
      results.sample = { created: false, message: 'Database already has data' };
    }

    res.json({
      success: true,
      message: 'Database initialized successfully',
      results
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error; // Let asyncHandler handle it
  }
}));

module.exports = router;
