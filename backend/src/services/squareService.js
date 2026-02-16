const { SquareClient, SquareEnvironment } = require('square');

// Initialize Square client
const client = new SquareClient({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' 
    ? SquareEnvironment.Production 
    : SquareEnvironment.Sandbox,
});

function hasSquareOrdersConfig() {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

class SquareService {
  /**
   * Get orders from Square for a date range
   * Requires: ORDERS_READ permission
   * Falls back to simulated data if Square API is not available
   */
  async getOrdersByDateRange(startDate, endDate) {
    if (!hasSquareOrdersConfig()) {
      // Local/dev default: no Square credentials configured.
      return this.getSimulatedSalesData(startDate, false);
    }

    try {
      const requestBody = {
        locationIds: [process.env.SQUARE_LOCATION_ID],
        query: {
          filter: {
            dateTimeFilter: {
              closedAt: {
                startAt: startDate + 'T00:00:00Z',
                endAt: endDate + 'T23:59:59Z'
              }
            }
          }
        },
        limit: 100
      };

      const response = await client.orders.search(requestBody);
      
      if (response.result && response.result.orders) {
        return this.formatOrdersData(response.result.orders);
      }
      
      // Return empty result if no orders found
      return {
        date: startDate,
        totalSales: 0,
        totalTransactions: 0,
        averageTicket: 0,
        reportPeriod: 'daily',
        items: []
      };
    } catch (error) {
      console.error('Error fetching Square orders:', error);
      
      // If authentication fails, return simulated data instead of throwing
      if (error.statusCode === 401 || error.statusCode === 403) {
        console.log('⚠️ Square API authentication failed. Using simulated data with real catalog items if available.');
        return await this.getSimulatedSalesData(startDate, true);
      }
      
      // For other errors, try to use simulated data with real catalog
      console.log('⚠️ Square API error. Using simulated data with real catalog items if available:', error.message);
      return await this.getSimulatedSalesData(startDate, true);
    }
  }

  /**
   * Get simulated sales data (fallback when Square is not available)
   * Tries to use real catalog items from Square first, then falls back to default menu
   */
  async getSimulatedSalesData(date, useRealCatalog = true) {
    // Generate some realistic demo data
    const baseSales = 1500 + Math.random() * 1000;
    const transactions = 50 + Math.floor(Math.random() * 50);
    
    let menuItems = [];
    
    // Try to get real catalog items from Square if available
    if (useRealCatalog) {
      try {
        const catalogItems = await this.getCatalogItems();
        if (catalogItems && catalogItems.length > 0) {
          console.log(`✅ Using ${catalogItems.length} real catalog items from Square for simulated data`);
          
          // Convert Square catalog items to menu format
          menuItems = catalogItems.map((item, index) => {
            // Get price from first variation or default
            let price = 15.99; // default
            if (item.variations && item.variations.length > 0) {
              const variation = item.variations[0];
              if (variation.itemVariationData?.priceMoney) {
                price = parseFloat(variation.itemVariationData.priceMoney.amount) / 100;
              }
            }
            
            // Distribute popularity (first items more popular)
            const basePopularity = 0.15 - (index * 0.01);
            const popularity = Math.max(0.02, basePopularity); // Minimum 2%
            
            return {
              name: item.name || 'Unknown Item',
              price: price,
              popularity: popularity
            };
          });
          
          // Normalize popularity to sum to ~1.0
          const totalPop = menuItems.reduce((sum, item) => sum + item.popularity, 0);
          menuItems = menuItems.map(item => ({
            ...item,
            popularity: item.popularity / totalPop
          }));
        }
      } catch (error) {
        console.log('⚠️ Could not fetch Square catalog, using default menu items');
      }
    }
    
    // Fallback to default menu items if no catalog available
    if (menuItems.length === 0) {
      menuItems = [
        { name: 'Grilled Chicken Plate', price: 18.99, popularity: 0.18 },
        { name: 'Caesar Salad', price: 12.99, popularity: 0.15 },
        { name: 'Pasta Carbonara', price: 16.99, popularity: 0.12 },
        { name: 'Burger Deluxe', price: 14.99, popularity: 0.10 },
        { name: 'Fish Tacos', price: 15.99, popularity: 0.08 },
        { name: 'BBQ Ribs', price: 24.99, popularity: 0.07 },
        { name: 'Margherita Pizza', price: 13.99, popularity: 0.06 },
        { name: 'Cobb Salad', price: 14.99, popularity: 0.05 },
        { name: 'Steak Frites', price: 26.99, popularity: 0.05 },
        { name: 'Salmon Teriyaki', price: 22.99, popularity: 0.04 },
        { name: 'Chicken Wings (10pcs)', price: 11.99, popularity: 0.04 },
        { name: 'Veggie Burger', price: 12.99, popularity: 0.03 },
        { name: 'Shrimp Scampi', price: 21.99, popularity: 0.02 },
        { name: 'Lobster Roll', price: 28.99, popularity: 0.01 }
      ];
    }
    
    // Generate items based on popularity distribution
    const items = menuItems.map(item => {
      const quantity = Math.floor(transactions * item.popularity);
      return {
        name: item.name,
        quantity: quantity,
        unitPrice: item.price,
        totalPrice: parseFloat((quantity * item.price).toFixed(2))
      };
    }).filter(item => item.quantity > 0); // Only include items that were ordered
    
    // Calculate actual total from generated items
    const actualTotalSales = items.reduce((sum, item) => sum + item.totalPrice, 0);
    
    return {
      date: date,
      totalSales: parseFloat(actualTotalSales.toFixed(2)),
      totalTransactions: transactions,
      averageTicket: parseFloat((actualTotalSales / transactions).toFixed(2)),
      reportPeriod: 'daily',
      items: items,
      _simulated: true, // Flag to indicate this is simulated data
      _usedRealCatalog: menuItems.length > 0 && useRealCatalog // Flag if real catalog was used
    };
  }

  /**
   * Get today's sales summary
   */
  async getTodaySales() {
    const today = new Date().toISOString().split('T')[0];
    return this.getOrdersByDateRange(today, today);
  }

  /**
   * Get catalog items (products/menu items) from Square
   * Requires: ITEMS_READ permission (per Square OAuth docs)
   * 
   * Tries multiple methods in order:
   * 1. GraphQL API (most efficient - gets items with prices in one query)
   * 2. REST API ListCatalog (traditional method)
   * 3. Returns empty array if both fail (will use simulated data)
   * 
   * To use Square catalog:
   * 1. Go to Square Dashboard: https://squareup.com/dashboard (or squareupsandbox.com for sandbox)
   * 2. Navigate to Items section
   * 3. Add your menu items there
   * 4. Ensure your Access Token has ITEMS_READ permission in Square Developer Portal
   */
  async getCatalogItems() {
    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return [];
    }

    try {
      const token = process.env.SQUARE_ACCESS_TOKEN;
      const merchantId = process.env.SQUARE_MERCHANT_ID; // Optional, can get from currentMerchant
      const baseUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
        ? 'https://connect.squareup.com' 
        : 'https://connect.squareupsandbox.com';
      
      // Method 1: Try GraphQL API first (more efficient - gets items with prices in one query)
      try {
        const https = require('https');
        const url = new URL('/public/graphql', baseUrl);
        
        // GraphQL query to get catalog items with variations and prices
        const graphqlQuery = `
          query GetCatalogItems($merchantId: ID!) {
            catalog(
              filter: {
                merchantId: { equalToAnyOf: [$merchantId] }
                type: { equalToAnyOf: [ITEM] }
              }
            ) {
              nodes {
                id
                ... on CatalogItem {
                  name
                  description
                  category {
                    name
                  }
                  variations {
                    id
                    name
                    price {
                      amount
                      currency
                    }
                  }
                }
              }
            }
          }
        `;
        
        // First, get merchant ID if not provided
        let actualMerchantId = merchantId;
        if (!actualMerchantId) {
          const merchantQuery = JSON.stringify({
            query: `{ currentMerchant { id } }`
          });
          
          const merchantIdResult = await new Promise((resolve) => {
            const req = https.request(url.toString(), {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const result = JSON.parse(data);
                  if (result.data?.currentMerchant?.id) {
                    resolve(result.data.currentMerchant.id);
                  } else {
                    resolve(null);
                  }
                } catch (e) {
                  resolve(null);
                }
              });
            });
            req.on('error', () => resolve(null));
            req.write(merchantQuery);
            req.end();
          });
          
          if (merchantIdResult) {
            actualMerchantId = merchantIdResult;
          } else {
            throw new Error('Could not get merchant ID');
          }
        }
        
        // Now query catalog with merchant ID (proper GraphQL variable format)
        const queryBody = JSON.stringify({
          query: graphqlQuery,
          variables: {
            merchantId: actualMerchantId
          }
        });
        
        return new Promise((resolve) => {
          const req = https.request(url.toString(), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                
                if (result.errors && result.errors.length > 0) {
                  console.log('⚠️ GraphQL query error, trying REST API:', result.errors[0].message);
                  // Fall through to REST API method
                  return this.getCatalogItemsRest(baseUrl, token, resolve);
                }
                
                if (result.data?.catalog?.nodes) {
                  const items = result.data.catalog.nodes
                    .filter(node => node.name) // Only items with name
                    .map(node => ({
                      id: node.id,
                      name: node.name || 'Unknown',
                      description: node.description || '',
                      category: node.category?.name || null,
                      variations: (node.variations || []).map(v => ({
                        id: v.id,
                        name: v.name || 'Standard',
                        price: v.price?.amount ? parseFloat(v.price.amount) / 100 : 0,
                        currency: v.price?.currency || 'USD'
                      }))
                    }));
                  
                  if (items.length > 0) {
                    console.log(`✅ Found ${items.length} catalog items from Square (using GraphQL API)`);
                  }
                  resolve(items);
                } else {
                  // Try REST API as fallback
                  this.getCatalogItemsRest(baseUrl, token, resolve);
                }
              } catch (parseError) {
                console.log('⚠️ Failed to parse GraphQL response, trying REST API:', parseError.message);
                this.getCatalogItemsRest(baseUrl, token, resolve);
              }
            });
          });
          
          req.on('error', (error) => {
            console.log('⚠️ GraphQL request failed, trying REST API:', error.message);
            this.getCatalogItemsRest(baseUrl, token, resolve);
          });
          
          req.write(queryBody);
          req.end();
        });
      } catch (graphqlError) {
        console.log('⚠️ GraphQL method failed, trying REST API:', graphqlError.message);
        return this.getCatalogItemsRest(baseUrl, token);
      }
    } catch (error) {
      console.error('Error fetching catalog items:', error.message);
      return [];
    }
  }

  /**
   * Fallback method: Get catalog items using REST API
   * GET /v2/catalog/list?types=ITEM,ITEM_VARIATION
   */
  async getCatalogItemsRest(baseUrl, token, resolveCallback = null) {
    return new Promise((resolve) => {
      const actualResolve = resolveCallback || resolve;
      const https = require('https');
      const url = new URL('/v2/catalog/list', baseUrl);
      url.searchParams.append('types', 'ITEM,ITEM_VARIATION');
      
      https.get(url.toString(), {
        headers: {
          'Square-Version': '2024-01-18',
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            // Check for errors in response
            if (result.errors && result.errors.length > 0) {
              const errorMsg = result.errors[0].detail || result.errors[0].code;
              console.log(`⚠️ Square REST API error: ${errorMsg}`);
              if (errorMsg.includes('permission') || errorMsg.includes('ITEMS_READ')) {
                console.log('💡 Tip: Ensure your Access Token has ITEMS_READ permission in Square Developer Portal');
              }
              actualResolve([]);
              return;
            }
            
            if (result.objects && Array.isArray(result.objects)) {
              const items = result.objects
                .filter(obj => obj.type === 'ITEM')
                .map(obj => {
                  // Square API uses snake_case: item_data (not itemData)
                  const itemData = obj.item_data || obj.itemData || {};
                  
                  // Get name from item_data
                  const itemName = itemData.name || obj.name || 'Unknown';
                  
                  // Get variations - Square returns them as nested objects in item_data.variations
                  const variations = itemData.variations || [];
                  
                  return {
                    id: obj.id,
                    name: itemName,
                    category: itemData.category_id || itemData.categoryId || null,
                    variations: variations,
                    description: itemData.description || ''
                  };
                });
              
              if (items.length > 0) {
                console.log(`✅ Found ${items.length} catalog items from Square (using REST ListCatalog API)`);
              } else {
                console.log('ℹ️ Square catalog is empty. Add items in Square Dashboard: Items section');
                console.log('   Dashboard: https://squareupsandbox.com/dashboard → Items');
              }
              actualResolve(items);
            } else {
              console.log('ℹ️ No catalog objects found in Square');
              actualResolve([]);
            }
          } catch (parseError) {
            console.log('⚠️ Failed to parse REST API response:', parseError.message);
            actualResolve([]);
          }
        });
      }).on('error', (error) => {
        console.log('⚠️ REST API call failed:', error.message);
        actualResolve([]);
      });
    });
  }

  /**
   * Get inventory for a catalog item
   * Requires: INVENTORY_READ permission (per Square OAuth docs)
   */
  async getInventoryForItem(catalogObjectId) {
    try {
      const response = await client.inventory.retrieveInventoryCount({
        catalogObjectId: catalogObjectId,
        locationIds: [process.env.SQUARE_LOCATION_ID]
      });

      if (response.result && response.result.counts) {
        return response.result.counts;
      }

      return [];
    } catch (error) {
      console.error('Error fetching inventory:', error);
      throw error;
    }
  }

  /**
   * Adjust inventory (for waste/loss tracking)
   * Requires: INVENTORY_WRITE permission (per Square OAuth docs)
   */
  async adjustInventory(catalogObjectId, quantityChange, fromState = 'NONE', toState = 'WASTE') {
    try {
      const physicalCount = await client.inventory.bulkRetrieveInventoryCounts({
        catalogObjectIds: [catalogObjectId],
        locationIds: [process.env.SQUARE_LOCATION_ID]
      });

      const currentQuantity = physicalCount.result?.counts?.[0]?.quantity || '0';

      const response = await client.inventory.changeInventory({
        idempotencyKey: require('crypto').randomUUID(),
        changes: [{
          type: 'PHYSICAL_COUNT',
          physicalCount: {
            catalogObjectId: catalogObjectId,
            state: toState,
            locationId: process.env.SQUARE_LOCATION_ID,
            occurredAt: new Date().toISOString(),
            quantity: (BigInt(currentQuantity) + BigInt(quantityChange)).toString()
          }
        }]
      });

      return response.result;
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      throw error;
    }
  }

  /**
   * Get payments from Square for a date range
   * Requires: PAYMENTS_READ permission
   * Useful for seeing actual money received vs orders
   */
  async getPaymentsByDateRange(startDate, endDate) {
    try {
      const beginTime = new Date(startDate + 'T00:00:00Z').toISOString();
      const endTime = new Date(endDate + 'T23:59:59Z').toISOString();
      
      const response = await client.payments.listPayments({
        beginTime: beginTime,
        endTime: endTime,
        limit: 100
      });

      if (response.result && response.result.payments) {
        const payments = response.result.payments;
        const totalAmount = payments.reduce((sum, payment) => {
          const amount = payment.totalMoney ? parseFloat(payment.totalMoney.amount) / 100 : 0;
          return sum + amount;
        }, 0);

        return {
          payments: payments.map(payment => ({
            id: payment.id,
            createdAt: payment.createdAt,
            amount: payment.totalMoney ? parseFloat(payment.totalMoney.amount) / 100 : 0,
            currency: payment.totalMoney?.currency || 'USD',
            status: payment.status,
            sourceType: payment.sourceType
          })),
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          count: payments.length,
          dateRange: { startDate, endDate }
        };
      }

      return {
        payments: [],
        totalAmount: 0,
        count: 0,
        dateRange: { startDate, endDate }
      };
    } catch (error) {
      console.error('Error fetching Square payments:', error);
      // Return empty result instead of throwing for demo purposes
      return {
        payments: [],
        totalAmount: 0,
        count: 0,
        dateRange: { startDate, endDate },
        _error: error.message
      };
    }
  }

  /**
   * Get all inventory counts with details
   * Requires: INVENTORY_READ permission
   * Returns inventory data useful for waste tracking
   */
  async getAllInventoryCounts(catalogObjectIds = []) {
    try {
      const response = await client.inventory.batchRetrieveInventoryCounts({
        catalogObjectIds: catalogObjectIds.length > 0 ? catalogObjectIds : undefined,
        locationIds: [process.env.SQUARE_LOCATION_ID]
      });

      if (response.result && response.result.counts) {
        return response.result.counts.map(count => ({
          catalogObjectId: count.catalogObjectId,
          catalogObjectType: count.catalogObjectType,
          state: count.state,
          locationId: count.locationId,
          quantity: count.quantity,
          calculatedAt: count.calculatedAt
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching inventory counts:', error);
      return [];
    }
  }

  /**
   * Get detailed catalog with prices and categories
   * Requires: ITEMS_READ permission
   * Returns full product catalog for menu profitability analysis
   * Uses getCatalogItems() internally and enriches with variation details
   */
  async getDetailedCatalog() {
    try {
      // Use getCatalogItems which handles multiple API methods
      const catalogItems = await this.getCatalogItems();
      
      if (catalogItems && catalogItems.length > 0) {
        // Enrich with variation price details
        const items = catalogItems.map(item => {
          const variations = item.variations?.map(variation => {
            // Try to extract price from variation if available
            let price = 0;
            let currency = 'USD';
            
            if (variation.itemVariationData?.priceMoney) {
              price = parseFloat(variation.itemVariationData.priceMoney.amount) / 100;
              currency = variation.itemVariationData.priceMoney.currency || 'USD';
            }
            
            return {
              id: variation.id || null,
              name: variation.itemVariationData?.name || 'Standard',
              price: price,
              currency: currency,
              pricingType: variation.itemVariationData?.pricingType || 'FIXED_PRICING'
            };
          }) || [];

          return {
            id: item.id,
            name: item.name,
            description: item.description || '',
            categoryId: item.category,
            variations: variations,
            isTaxable: false // Would need to check taxIds from Square
          };
        });

        return {
          items: items,
          totalItems: items.length,
          timestamp: new Date().toISOString()
        };
      }

      return { items: [], totalItems: 0, timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Error fetching detailed catalog:', error);
      return { items: [], totalItems: 0, timestamp: new Date().toISOString(), _error: error.message };
    }
  }

  /**
   * Get inventory changes (helps track what's been used/sold)
   * Requires: INVENTORY_READ permission
   * Useful for understanding inventory movement
   */
  async getInventoryChanges(startDate, endDate, catalogObjectIds = []) {
    try {
      const beginTime = new Date(startDate + 'T00:00:00Z').toISOString();
      const endTime = new Date(endDate + 'T23:59:59Z').toISOString();

      const response = await client.inventory.batchRetrieveInventoryChanges({
        catalogObjectIds: catalogObjectIds.length > 0 ? catalogObjectIds : undefined,
        locationIds: [process.env.SQUARE_LOCATION_ID],
        types: ['PHYSICAL_COUNT', 'ADJUSTMENT', 'TRANSFER'],
        updatedAfter: beginTime,
        updatedBefore: endTime
      });

      if (response.result && response.result.changes) {
        return response.result.changes.map(change => ({
          type: change.type,
          physicalCount: change.physicalCount ? {
            id: change.physicalCount.id,
            referenceId: change.physicalCount.referenceId,
            catalogObjectId: change.physicalCount.catalogObjectId,
            state: change.physicalCount.state,
            locationId: change.physicalCount.locationId,
            quantity: change.physicalCount.quantity,
            occurredAt: change.physicalCount.occurredAt
          } : null,
          adjustment: change.adjustment ? {
            id: change.adjustment.id,
            referenceId: change.adjustment.referenceId,
            fromState: change.adjustment.fromState,
            toState: change.adjustment.toState,
            locationId: change.adjustment.locationId,
            catalogObjectId: change.adjustment.catalogObjectId,
            quantity: change.adjustment.quantity,
            occurredAt: change.adjustment.occurredAt,
            employeeId: change.adjustment.employeeId
          } : null
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching inventory changes:', error);
      return [];
    }
  }

  /**
   * Format orders data to match our POS report format
   */
  formatOrdersData(orders) {
    let totalSales = 0;
    let totalTransactions = orders.length;
    const itemsMap = {};

    orders.forEach(order => {
      const orderTotal = order.totalMoney 
        ? parseFloat(order.totalMoney.amount) / 100 
        : 0;
      totalSales += orderTotal;

      // Extract line items
      if (order.lineItems) {
        order.lineItems.forEach(item => {
          const itemName = item.name || item.catalogObjectId || 'Unknown Item';
          const quantity = parseInt(item.quantity) || 1;
          const price = item.variationTotalPriceMoney 
            ? parseFloat(item.variationTotalPriceMoney.amount) / 100 
            : 0;

          if (itemsMap[itemName]) {
            itemsMap[itemName].quantity += quantity;
            itemsMap[itemName].totalPrice += price;
          } else {
            itemsMap[itemName] = {
              name: itemName,
              quantity: quantity,
              totalPrice: price,
              unitPrice: quantity > 0 ? price / quantity : 0
            };
          }
        });
      }
    });

    const items = Object.values(itemsMap).map(item => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    }));

    const averageTicket = totalTransactions > 0 
      ? totalSales / totalTransactions 
      : 0;

    return {
      date: new Date().toISOString().split('T')[0],
      totalSales: parseFloat(totalSales.toFixed(2)),
      totalTransactions: totalTransactions,
      averageTicket: parseFloat(averageTicket.toFixed(2)),
      reportPeriod: 'daily',
      items: items
    };
  }

  /**
   * Import complete menu to Square Catalog using batch-upsert
   * Requires: ITEMS_WRITE permission
   * Imports categories, items, and variations from JSON file
   */
  async importMenuToSquare() {
    return this.importCatalogFromFile('tequilas_town_menu.json');
  }

  /**
   * Import inventory items (ingredients, spices, supplies) to Square Catalog
   * Requires: ITEMS_WRITE permission
   */
  async importInventoryToSquare() {
    return this.importCatalogFromFile('inventory_items.json');
  }

  /**
   * Generic method to import catalog data from JSON file
   * @param {string} filename - Name of JSON file in backend/data/
   */
  async importCatalogFromFile(filename) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Read JSON file
      const filePath = path.join(__dirname, '../../data', filename);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      const catalogData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Generate unique idempotency key with timestamp
      const filePrefix = filename.replace('.json', '').replace(/_/g, '_');
      catalogData.idempotency_key = `${filePrefix}_${Date.now()}`;
      
      console.log(`📦 Starting catalog import from ${filename} with ${catalogData.batches.length} batches...`);
      
      // Process each batch
      const results = [];
      let totalObjects = 0;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < catalogData.batches.length; i++) {
        const batch = catalogData.batches[i];
        totalObjects += batch.objects.length;
        
        try {
          console.log(`📤 Importing batch ${i + 1}/${catalogData.batches.length} (${batch.objects.length} objects)...`);
          
          // Use REST API directly for batch upsert (SDK doesn't expose this method correctly)
          const https = require('https');
          const baseUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
            ? 'https://connect.squareup.com' 
            : 'https://connect.squareupsandbox.com';
          const url = new URL('/v2/catalog/batch-upsert', baseUrl);
          
          const requestBody = JSON.stringify({
            idempotency_key: `${catalogData.idempotency_key}_batch_${i}`,
            batches: [batch]
          });
          
          const response = await new Promise((resolve, reject) => {
            const req = https.request(url.toString(), {
              method: 'POST',
              headers: {
                'Square-Version': '2024-01-18',
                'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const result = JSON.parse(data);
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ result });
                  } else {
                    reject(new Error(result.errors?.[0]?.detail || `HTTP ${res.statusCode}: ${data}`));
                  }
                } catch (parseError) {
                  reject(new Error(`Failed to parse response: ${parseError.message}`));
                }
              });
            });
            
            req.on('error', (error) => {
              reject(error);
            });
            
            req.write(requestBody);
            req.end();
          });
          
          // Check response structure - Square may return different formats
          if (response.result) {
            const idMappings = response.result.idMappings || [];
            const objects = response.result.objects || [];
            
            if (idMappings.length > 0 || objects.length > 0) {
              const successCount_batch = idMappings.length || objects.length;
              successCount += successCount_batch;
              console.log(`✅ Batch ${i + 1} imported successfully: ${successCount_batch} objects (${idMappings.length} ID mappings, ${objects.length} objects returned)`);
              
              results.push({
                batch: i + 1,
                success: true,
                objectsProcessed: batch.objects.length,
                idMappings: idMappings.length,
                objectsReturned: objects.length
              });
            } else {
              // Success response but no mappings - items might already exist or be created without mappings
              console.log(`✅ Batch ${i + 1} completed (items may already exist or were created without returning mappings)`);
              successCount += batch.objects.length; // Assume success if no error
              
              results.push({
                batch: i + 1,
                success: true,
                objectsProcessed: batch.objects.length,
                note: 'No ID mappings returned, but request succeeded'
              });
            }
          } else {
            errorCount += batch.objects.length;
            console.log(`⚠️ Batch ${i + 1} completed but unexpected response structure`);
            console.log(`   Response keys: ${Object.keys(response).join(', ')}`);
            
            results.push({
              batch: i + 1,
              success: false,
              objectsProcessed: batch.objects.length,
              message: 'Unexpected response structure',
              response: JSON.stringify(response).substring(0, 200)
            });
          }
        } catch (batchError) {
          errorCount += batch.objects.length;
          console.error(`❌ Error importing batch ${i + 1}:`, batchError.message);
          
          results.push({
            batch: i + 1,
            success: false,
            objectsProcessed: batch.objects.length,
            error: batchError.message
          });
          
          // Continue with next batch even if one fails
          continue;
        }
        
        // Small delay between batches to avoid rate limiting
        if (i < catalogData.batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const summary = {
        filename: filename,
        totalBatches: catalogData.batches.length,
        totalObjects: totalObjects,
        successfulObjects: successCount,
        failedObjects: errorCount,
        results: results
      };
      
      console.log(`\n📊 Import Summary for ${filename}:`);
      console.log(`   Total batches: ${summary.totalBatches}`);
      console.log(`   Total objects: ${summary.totalObjects}`);
      console.log(`   Successful: ${summary.successfulObjects}`);
      console.log(`   Failed: ${summary.failedObjects}`);
      
      return summary;
    } catch (error) {
      console.error('❌ Error importing menu to Square:', error);
      
      // Check for specific error types
      if (error.errors && error.errors.length > 0) {
        const errorMessages = error.errors.map(e => e.detail || e.code).join('; ');
        throw new Error(`Square API error: ${errorMessages}`);
      }
      
      throw new Error(`Failed to import menu: ${error.message}`);
    }
  }

  /**
   * Get catalog items and map temporary IDs to real Square IDs
   * Returns a map of SKU to Square catalog object ID
   */
  async getCatalogIdMapping() {
    try {
      console.log('🔍 Fetching catalog items from Square to map IDs...');
      
      // Get all catalog items using GraphQL or REST
      const catalogItems = await this.getCatalogItems();
      
      // Also get detailed catalog to get variations with SKUs
      const detailedCatalog = await this.getDetailedCatalog();
      
      // Build mapping: SKU -> Square ID
      const skuToIdMap = {};
      
      // Map items
      catalogItems.forEach(item => {
        if (item.id) {
          // Use item name as fallback if no SKU
          skuToIdMap[item.name] = item.id;
        }
      });
      
      // Map variations with SKUs from detailed catalog
      detailedCatalog.forEach(item => {
        if (item.variations) {
          item.variations.forEach(variation => {
            if (variation.sku) {
              skuToIdMap[variation.sku] = variation.id || item.id;
            }
            // Also map by item name + variation name
            if (variation.name && item.name) {
              const key = `${item.name} - ${variation.name}`;
              skuToIdMap[key] = variation.id || item.id;
            }
          });
        }
      });
      
      return skuToIdMap;
    } catch (error) {
      console.error('Error getting catalog mapping:', error);
      return {};
    }
  }

  /**
   * Set initial inventory counts for imported items
   * Requires: INVENTORY_WRITE permission
   * Automatically maps temporary IDs to real Square IDs using SKUs
   */
  async setInitialInventoryCounts() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Read inventory counts JSON file
      const countsFilePath = path.join(__dirname, '../../data/initial_inventory_counts.json');
      const countsData = JSON.parse(fs.readFileSync(countsFilePath, 'utf8'));
      
      // Read inventory items to get SKU mapping
      const inventoryFilePath = path.join(__dirname, '../../data/inventory_items.json');
      const inventoryData = JSON.parse(fs.readFileSync(inventoryFilePath, 'utf8'));
      
      const locationId = process.env.SQUARE_LOCATION_ID;
      if (!locationId) {
        throw new Error('SQUARE_LOCATION_ID not configured in .env file');
      }
      
      console.log(`📦 Setting initial inventory counts for ${countsData.inventory_counts.length} items...`);
      
      // Build SKU to temp ID mapping from inventory items
      const tempIdToSkuMap = {};
      inventoryData.batches.forEach(batch => {
        batch.objects.forEach(obj => {
          if (obj.type === 'ITEM' && obj.item_data && obj.item_data.variations) {
            obj.item_data.variations.forEach(variation => {
              if (variation.item_variation_data && variation.item_variation_data.sku) {
                tempIdToSkuMap[obj.id] = variation.item_variation_data.sku;
              }
            });
          }
        });
      });
      
      // Get real Square IDs by fetching catalog
      console.log('🔍 Fetching real Square IDs from catalog...');
      const catalogItems = await this.getCatalogItems();
      const detailedCatalogResult = await this.getDetailedCatalog();
      
      // getDetailedCatalog returns { items: [], totalItems: ... }
      const detailedCatalog = detailedCatalogResult.items || [];
      
      // Also get catalog using REST API to get variations with SKUs
      const https = require('https');
      const baseUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
        ? 'https://connect.squareup.com' 
        : 'https://connect.squareupsandbox.com';
      
      // Build SKU to real Square ID mapping from catalog
      const skuToRealIdMap = {};
      
      // First try from detailed catalog
      detailedCatalog.forEach(item => {
        if (item.variations) {
          item.variations.forEach(variation => {
            // Note: variations from getDetailedCatalog may not have SKU
            // We'll need to fetch from REST API
          });
        }
      });
      
      // Fetch catalog using REST API to get items with variations and SKUs
      try {
        const url = new URL('/v2/catalog/list', baseUrl);
        url.searchParams.append('types', 'ITEM,ITEM_VARIATION');
        
        const catalogResponse = await new Promise((resolve, reject) => {
          https.get(url.toString(), {
            headers: {
              'Square-Version': '2024-01-18',
              'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              try {
                const result = JSON.parse(data);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve(result);
                } else {
                  reject(new Error(result.errors?.[0]?.detail || `HTTP ${res.statusCode}`));
                }
              } catch (e) {
                reject(e);
              }
            });
          }).on('error', reject);
        });
        
        if (catalogResponse.objects) {
          // Map item variations by SKU
          let variationCount = 0;
          catalogResponse.objects.forEach(obj => {
            if (obj.type === 'ITEM_VARIATION' && obj.itemVariationData) {
              variationCount++;
              const sku = obj.itemVariationData.sku;
              if (sku && obj.id) {
                skuToRealIdMap[sku] = obj.id;
              }
            }
          });
          
          // If no SKUs found in variations, try to match by name
          if (Object.keys(skuToRealIdMap).length === 0 && variationCount > 0) {
            console.log(`   Found ${variationCount} variations but no SKUs - items may not have SKUs set`);
            console.log('   Trying to match by item name instead...');
            
            // Try matching by item name and variation name
            const items = catalogResponse.objects.filter(o => o.type === 'ITEM');
            items.forEach(item => {
              if (item.itemData && item.itemData.variations) {
                item.itemData.variations.forEach(variationId => {
                  // Find the actual variation object
                  const variation = catalogResponse.objects.find(o => 
                    o.type === 'ITEM_VARIATION' && 
                    (o.id === variationId.id || o.id === variationId)
                  );
                  
                  if (variation && variation.itemVariationData) {
                    // Try to match by name pattern
                    const variationName = variation.itemVariationData.name || '';
                    const itemName = item.itemData.name || '';
                    
                    // Build a key that might match our SKU pattern
                    // This is a fallback if SKUs aren't set
                    console.log(`   Item: ${itemName}, Variation: ${variationName}, ID: ${variation.id?.substring(0, 15)}`);
                  }
                });
              }
            });
          }
          
          console.log(`✅ Found ${Object.keys(skuToRealIdMap).length} SKUs in Square catalog`);
        }
      } catch (catalogError) {
        console.log(`⚠️  Could not fetch catalog via REST API: ${catalogError.message}`);
        console.log('   Will try to use existing catalog data...');
      }
      
      // Map temporary IDs to real Square IDs
      const changes = [];
      const unmappedItems = [];
      
      for (const item of countsData.inventory_counts) {
        const tempId = item.catalog_object_id;
        const sku = tempIdToSkuMap[tempId];
        const realId = sku ? skuToRealIdMap[sku] : null;
        
        if (realId) {
          changes.push({
            type: 'PHYSICAL_COUNT',
            physicalCount: {
              catalogObjectId: realId,
              state: 'IN_STOCK',
              locationId: locationId,
              quantity: item.quantity,
              occurredAt: new Date().toISOString()
            }
          });
          console.log(`✅ Mapped ${tempId} (SKU: ${sku}) → ${realId.substring(0, 15)}...`);
        } else {
          unmappedItems.push({ tempId, sku, name: item.unit });
          console.log(`⚠️  Could not map ${tempId} (SKU: ${sku || 'N/A'}) - item may not exist in Square`);
        }
      }
      
      if (unmappedItems.length > 0) {
        console.log(`\n⚠️  Warning: ${unmappedItems.length} items could not be mapped:`);
        unmappedItems.forEach(item => {
          console.log(`   - ${item.tempId} (SKU: ${item.sku || 'N/A'})`);
        });
      }
      
      if (changes.length === 0) {
        throw new Error('No items could be mapped to Square IDs. Please verify items were imported correctly.');
      }
      
      // Process in batches
      const batchSize = 10; // Square recommends smaller batches for inventory
      const results = [];
      
      for (let i = 0; i < changes.length; i += batchSize) {
        const batch = changes.slice(i, i + batchSize);
        const idempotencyKey = `initial_inventory_${Date.now()}_${i}`;
        
        try {
          console.log(`📤 Setting inventory for batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)...`);
          
          // Use REST API directly for batch change inventory
          const https = require('https');
          const baseUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
            ? 'https://connect.squareup.com' 
            : 'https://connect.squareupsandbox.com';
          const url = new URL('/v2/inventory/changes/batch-change', baseUrl);
          
          const requestBody = JSON.stringify({
            idempotency_key: idempotencyKey,
            changes: batch
          });
          
          const response = await new Promise((resolve, reject) => {
            const req = https.request(url.toString(), {
              method: 'POST',
              headers: {
                'Square-Version': '2024-01-18',
                'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              }
            }, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                try {
                  const result = JSON.parse(data);
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ result });
                  } else {
                    reject(new Error(result.errors?.[0]?.detail || `HTTP ${res.statusCode}: ${data}`));
                  }
                } catch (parseError) {
                  reject(new Error(`Failed to parse response: ${parseError.message}`));
                }
              });
            });
            
            req.on('error', (error) => {
              reject(error);
            });
            
            req.write(requestBody);
            req.end();
          });
          
          if (response.result && response.result.counts) {
            results.push({
              batch: Math.floor(i / batchSize) + 1,
              success: true,
              itemsProcessed: batch.length,
              countsSet: response.result.counts.length
            });
            console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${response.result.counts.length} inventory counts set`);
          } else {
            console.log(`⚠️ Batch ${Math.floor(i / batchSize) + 1} completed but no counts returned`);
            results.push({
              batch: Math.floor(i / batchSize) + 1,
              success: false,
              itemsProcessed: batch.length,
              message: 'No counts returned'
            });
          }
        } catch (batchError) {
          console.error(`❌ Error setting inventory batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
          results.push({
            batch: Math.floor(i / batchSize) + 1,
            success: false,
            itemsProcessed: batch.length,
            error: batchError.message
          });
        }
        
        // Small delay between batches
        if (i + batchSize < changes.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const successCount = results.filter(r => r.success).reduce((sum, r) => sum + r.itemsProcessed, 0);
      const failCount = results.filter(r => !r.success).reduce((sum, r) => sum + r.itemsProcessed, 0);
      
      console.log(`\n📊 Inventory Counts Summary:`);
      console.log(`   Total items: ${changes.length}`);
      console.log(`   Successful: ${successCount}`);
      console.log(`   Failed: ${failCount}`);
      
      return {
        totalItems: changes.length,
        successfulItems: successCount,
        failedItems: failCount,
        results: results
      };
    } catch (error) {
      console.error('❌ Error setting initial inventory counts:', error);
      throw new Error(`Failed to set inventory counts: ${error.message}`);
    }
  }
}

module.exports = new SquareService();
