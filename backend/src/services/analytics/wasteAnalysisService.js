/**
 * Waste analysis and display (extracted from analyticsService).
 * API: calculateWaste, getWasteDisplay, getSlowMovingItems, getExpiringItemsAlerts.
 */

const db = require('../../config/database');
const { parseISO, differenceInDays } = require('date-fns');

async function calculateWaste(tenantId, startDate, endDate) {
  const purchases = await db.allAsync(`
    SELECT 
      pi.item_name,
      pi.quantity as purchased_qty,
      pi.unit_price,
      pi.total_price,
      pi.category,
      p.purchase_date
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    WHERE p.tenant_id = ? AND pi.tenant_id = ? AND p.purchase_date BETWEEN ? AND ?
  `, [tenantId, tenantId, startDate, endDate]);

  const sales = await db.allAsync(`
    SELECT 
      si.item_name,
      SUM(si.quantity) as sold_qty,
      SUM(si.total_price) as sales_total
    FROM sales_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.tenant_id = ? AND si.tenant_id = ? AND s.report_date BETWEEN ? AND ?
    GROUP BY si.item_name
  `, [tenantId, tenantId, startDate, endDate]);

  const wasteRecords = await db.allAsync(`
    SELECT 
      item_name,
      SUM(quantity) as wasted_qty,
      SUM(cost_value) as waste_cost
    FROM waste
    WHERE tenant_id = ? AND waste_date BETWEEN ? AND ?
    GROUP BY item_name
  `, [tenantId, startDate, endDate]);

  const salesMap = {};
  sales.forEach(s => { salesMap[s.item_name.toLowerCase()] = s; });
  const wasteMap = {};
  wasteRecords.forEach(w => { wasteMap[w.item_name.toLowerCase()] = w; });

  return purchases.map(p => {
    const itemKey = p.item_name.toLowerCase();
    const sold = salesMap[itemKey] || { sold_qty: 0, sales_total: 0 };
    const wasted = wasteMap[itemKey] || { wasted_qty: 0, waste_cost: 0 };
    const unaccountedQty = p.purchased_qty - sold.sold_qty - wasted.wasted_qty;
    const estimatedWasteCost = unaccountedQty > 0 ? unaccountedQty * p.unit_price : 0;
    return {
      itemName: p.item_name,
      category: p.category,
      purchased: p.purchased_qty,
      sold: sold.sold_qty,
      wasted: wasted.wasted_qty,
      unaccounted: unaccountedQty,
      purchaseCost: p.total_price,
      salesTotal: sold.sales_total,
      wasteCost: wasted.waste_cost,
      estimatedWasteCost: parseFloat(estimatedWasteCost.toFixed(2)),
      totalLoss: parseFloat((wasted.waste_cost + estimatedWasteCost).toFixed(2))
    };
  });
}

function getWasteDisplay(wasteTotal, purchases, sales) {
  const s = sales ?? 0;
  const w = wasteTotal ?? 0;
  if (s > 0 && w >= 0) {
    const value = (w / s) * 100;
    return {
      value: parseFloat(value.toFixed(2)),
      confidence: 'medium',
      message: `${value.toFixed(1)}%`,
      tooltip: `Waste $${w.toLocaleString()} ÷ Sales $${s.toLocaleString()}`
    };
  }
  return {
    value: 0,
    confidence: 'none',
    message: '—',
    tooltip: 'Add sales and waste data to calculate waste %.'
  };
}

async function getSlowMovingItems(tenantId, daysThreshold = 7) {
  const items = await db.allAsync(`
    SELECT 
      i.item_name,
      i.quantity as stock_qty,
      i.category,
      i.last_purchase_date,
      i.last_sale_date,
      i.expiry_date,
      CASE 
        WHEN i.last_sale_date IS NULL THEN 
          julianday('now') - julianday(i.last_purchase_date)
        ELSE 
          julianday('now') - julianday(i.last_sale_date)
      END as days_since_last_sale
    FROM inventory i
    WHERE i.tenant_id = ? AND i.quantity > 0
      AND (i.last_sale_date IS NULL 
           OR julianday('now') - julianday(i.last_sale_date) > ?)
    ORDER BY days_since_last_sale DESC
  `, [tenantId, daysThreshold]);

  return items.map(item => ({
    ...item,
    daysSinceLastSale: Math.floor(item.days_since_last_sale || 0),
    isExpiringSoon: item.expiry_date && differenceInDays(parseISO(item.expiry_date), new Date()) <= 3
  }));
}

async function getExpiringItemsAlerts(tenantId, daysAhead = 7) {
  const items = await db.allAsync(`
    SELECT 
      item_name,
      quantity,
      category,
      unit_price,
      expiry_date,
      last_purchase_date,
      julianday(expiry_date) - julianday('now') as days_until_expiry
    FROM inventory
    WHERE tenant_id = ? AND expiry_date IS NOT NULL
      AND expiry_date <= date('now', '+' || ? || ' days')
      AND quantity > 0
    ORDER BY expiry_date ASC
  `, [tenantId, daysAhead]);

  return items.map(item => {
    const days = Math.floor(item.days_until_expiry || 0);
    const isExpired = item.days_until_expiry < 0;
    const unitCost = item.unit_price ?? 0;
    const valueAtRisk = (item.quantity || 0) * unitCost;
    const name = item.item_name || 'Unknown';

    let priority = 'medium';
    let action = 'Schedule for upcoming menu';
    const suggestions = [];

    if (isExpired || days <= 1) {
      priority = 'critical';
      action = 'Use immediately or discard';
      suggestions.push(`Feature as today's special: ${name}`, `Staff meal: ${item.quantity} ${item.category || 'units'}`, 'Donate if still safe.');
    } else if (days <= 3) {
      priority = 'high';
      action = 'Prioritize in menu planning';
      suggestions.push(`Add to prep list for next 3 days`, `Create daily special featuring ${name}`, 'Cross-utilize in multiple dishes');
    } else if (days <= 7) {
      priority = 'medium';
      action = 'Schedule for upcoming menu';
      suggestions.push(`Plan next week's menu around ${name}`, 'Check if any catering orders can use it', 'Consider freezing if applicable');
    }

    return {
      itemName: name,
      quantity: item.quantity,
      category: item.category,
      expiryDate: item.expiry_date,
      daysUntilExpiry: days,
      isExpired,
      lastPurchaseDate: item.last_purchase_date,
      valueAtRisk: parseFloat(valueAtRisk.toFixed(2)),
      actions: [{ priority, action, suggestions }],
      recommendation: valueAtRisk > 0 ? `$${valueAtRisk.toFixed(2)} at risk. ${action}` : action
    };
  });
}

module.exports = {
  calculateWaste,
  getWasteDisplay,
  getSlowMovingItems,
  getExpiringItemsAlerts
};
