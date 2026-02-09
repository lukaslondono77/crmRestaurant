# API Integration Analysis: Restaurant Cost Control Platform

## Executive Summary

This document provides a comprehensive analysis of the backend/POS integration codebase and identifies what needs to be exposed to the frontend for restaurant financial analytics. The system currently has a solid foundation with POS data ingestion, analytics calculations, and database persistence, but requires some enhancements for production-ready frontend integration.

---

## 1. Current Backend Capabilities

### 1.1 POS Data Ingestion

**Square API Integration** (`backend/src/services/squareService.js`):
- ✅ Orders/Transactions: `getOrdersByDateRange(startDate, endDate)`
- ✅ Payments: `getPaymentsByDateRange(startDate, endDate)`
- ✅ Catalog/Products: `getCatalogItems()`, `getDetailedCatalog()`
- ✅ Inventory: `getInventoryForItem()`, `getAllInventoryCounts()`, `getInventoryChanges()`
- ✅ Inventory Adjustments: `adjustInventory()` (for waste tracking)
- ✅ Fallback: Simulated data when Square API unavailable

**Manual Upload (OCR)**:
- ✅ Invoice upload with OCR extraction (`/api/invoices/upload`)
- ✅ POS report upload with OCR extraction (`/api/pos/upload`)
- ✅ Waste record upload with image (`/api/waste`)

### 1.2 Data Processing & Analysis

**Analytics Service** (`backend/src/services/analyticsService.js`):
- ✅ Food Cost Calculation: `calculateFoodCost(startDate, endDate)`
- ✅ Waste Analysis: `calculateWaste(startDate, endDate)` - matches purchases vs sales vs waste
- ✅ Product Margins: `calculateProductMargins(startDate, endDate)` - profit margins by item
- ✅ Trends Analysis: `getTrendsAnalysis(periodType, periods)` - week/month over week/month
- ✅ Supplier Ranking: `getSupplierRanking(startDate, endDate)`
- ✅ Period Comparison: `comparePeriods(period1Start, period1End, period2Start, period2End)`
- ✅ Slow Moving Items: `getSlowMovingItems(daysThreshold)`
- ✅ Expiring Items Alerts: `getExpiringItemsAlerts(daysAhead)`
- ✅ Dashboard Metrics: `getDashboardMetrics()` - aggregated KPIs

### 1.3 Database Schema

**Tables** (`backend/database/schema.sql`):
- `purchases` - Invoice/purchase records
- `purchase_items` - Line items from invoices
- `sales` - POS sales reports
- `sales_items` - Line items from sales
- `waste` - Waste/loss records
- `inventory` - Current stock levels

**Indexes**: Optimized for date-based queries and item lookups

### 1.4 Existing API Routes

**Current Endpoints**:
```
✅ GET  /api/healthz
✅ GET  /api/dashboard/metrics
✅ GET  /api/dashboard/waste-analysis
✅ GET  /api/dashboard/slow-moving
✅ GET  /api/analytics/food-cost
✅ GET  /api/analytics/waste-analysis
✅ GET  /api/analytics/slow-moving
✅ GET  /api/analytics/product-margins
✅ GET  /api/analytics/trends
✅ GET  /api/analytics/suppliers
✅ GET  /api/analytics/compare
✅ GET  /api/analytics/alerts
✅ GET  /api/invoices
✅ POST /api/invoices/upload
✅ GET  /api/pos/reports
✅ POST /api/pos/upload
✅ GET  /api/waste
✅ POST /api/waste
✅ POST /api/square/sync-today
✅ GET  /api/square/sales
✅ GET  /api/square/payments
✅ GET  /api/square/catalog
✅ GET  /api/square/catalog-detailed
✅ GET  /api/square/inventory/:catalogObjectId
✅ GET  /api/square/inventory-all
✅ GET  /api/square/inventory-changes
✅ POST /api/square/adjust-inventory
✅ POST /api/seed/initialize
```

---

## 2. Gap Analysis for Frontend Integration

### 2.1 Missing/Incomplete Endpoints

#### **HIGH PRIORITY**:

1. **Inventory Management**
   - ❌ `GET /api/inventory` - Get all inventory items with current stock
   - ❌ `GET /api/inventory/:itemName` - Get specific item details
   - ❌ `PUT /api/inventory/:id` - Update inventory quantity
   - ❌ `GET /api/inventory/low-stock` - Items below threshold

2. **Real-time Updates**
   - ❌ WebSocket support for live dashboard updates
   - ❌ Server-Sent Events (SSE) for alerts
   - ❌ Webhook endpoints for Square events

3. **Export/Reporting**
   - ❌ `GET /api/reports/export/pdf` - PDF export
   - ❌ `GET /api/reports/export/excel` - Excel export
   - ❌ `GET /api/reports/custom` - Custom date range reports

4. **Advanced Analytics**
   - ❌ `GET /api/analytics/labor-cost` - Labor cost analysis (currently hardcoded)
   - ❌ `GET /api/analytics/roi-by-category` - ROI by category
   - ❌ `GET /api/analytics/predictive-waste` - ML-based waste prediction
   - ❌ `GET /api/analytics/seasonal-trends` - Seasonal patterns

5. **Data Management**
   - ❌ `DELETE /api/invoices/:id` - Delete invoice
   - ❌ `PUT /api/invoices/:id` - Update invoice
   - ❌ `DELETE /api/waste/:id` - Delete waste record
   - ❌ `PUT /api/waste/:id` - Update waste record
   - ❌ `GET /api/invoices/:id` - Get single invoice with items

#### **MEDIUM PRIORITY**:

6. **User Management** (if multi-tenant)
   - ❌ `POST /api/auth/login`
   - ❌ `POST /api/auth/register`
   - ❌ `GET /api/users/me`
   - ❌ `PUT /api/users/me`

7. **Settings/Configuration**
   - ❌ `GET /api/settings` - Get restaurant settings
   - ❌ `PUT /api/settings` - Update settings (target margins, thresholds)
   - ❌ `GET /api/settings/categories` - Get item categories

8. **Notifications**
   - ❌ `GET /api/notifications` - Get alerts/notifications
   - ❌ `POST /api/notifications/:id/read` - Mark as read

### 2.2 Data Structure Enhancements Needed

**Current Response Formats** are mostly adequate, but could be enhanced:

1. **Pagination**: Most endpoints return all records (limited to 50). Need:
   ```json
   {
     "data": [...],
     "pagination": {
       "page": 1,
       "limit": 50,
       "total": 150,
       "totalPages": 3
     }
   }
   ```

2. **Metadata**: Add timestamps, data freshness indicators:
   ```json
   {
     "data": {...},
     "meta": {
       "generatedAt": "2024-01-15T10:30:00Z",
       "dataSource": "square_api",
       "cacheExpiresAt": "2024-01-15T10:35:00Z"
     }
   }
   ```

3. **Error Responses**: Standardize error format:
   ```json
   {
     "success": false,
     "error": {
       "code": "INVALID_DATE_RANGE",
       "message": "Start date must be before end date",
       "details": {...}
     }
   }
   ```

### 2.3 Authentication & Authorization

**CURRENT STATE**: ❌ **NO AUTHENTICATION** - All endpoints are publicly accessible

**REQUIRED**:
1. **JWT-based Authentication**
   - Token generation on login
   - Token validation middleware
   - Refresh token mechanism

2. **Role-Based Access Control (RBAC)**
   - Admin: Full access
   - Manager: Read/write analytics, no settings
   - Staff: Read-only, waste recording

3. **API Key Support** (for integrations)
   - Service-to-service authentication
   - Rate limiting per key

4. **Multi-tenant Support** (if SaaS)
   - Tenant isolation
   - Tenant-specific data filtering

---

## 3. Recommended API Architecture

### 3.1 REST API Structure

```
/api/v1/
├── /auth
│   ├── POST /login
│   ├── POST /register
│   ├── POST /refresh
│   └── POST /logout
├── /dashboard
│   ├── GET  /metrics
│   ├── GET  /waste-analysis
│   └── GET  /slow-moving
├── /analytics
│   ├── GET  /food-cost
│   ├── GET  /waste-analysis
│   ├── GET  /product-margins
│   ├── GET  /trends
│   ├── GET  /suppliers
│   ├── GET  /compare
│   ├── GET  /alerts
│   ├── GET  /labor-cost
│   └── GET  /roi-by-category
├── /invoices
│   ├── GET    / (list with pagination)
│   ├── GET    /:id
│   ├── POST   /upload
│   ├── PUT    /:id
│   └── DELETE /:id
├── /pos
│   ├── GET  /reports
│   └── POST /upload
├── /waste
│   ├── GET    /
│   ├── GET    /:id
│   ├── POST   /
│   ├── PUT    /:id
│   └── DELETE /:id
├── /inventory
│   ├── GET    /
│   ├── GET    /:id
│   ├── GET    /low-stock
│   ├── PUT    /:id
│   └── POST   /adjust
├── /square
│   ├── POST /sync-today
│   ├── GET  /sales
│   ├── GET  /payments
│   ├── GET  /catalog
│   ├── GET  /inventory-all
│   └── GET  /inventory-changes
├── /reports
│   ├── GET /export/pdf
│   ├── GET /export/excel
│   └── GET /custom
└── /settings
    ├── GET /
    └── PUT /
```

### 3.2 Real-time Architecture Options

**Option 1: WebSockets** (Best for bi-directional)
```javascript
// Server: socket.io
io.on('connection', (socket) => {
  socket.on('subscribe:dashboard', () => {
    // Send updates every 30 seconds
    setInterval(() => {
      socket.emit('dashboard:update', dashboardMetrics);
    }, 30000);
  });
});
```

**Option 2: Server-Sent Events** (Simpler, one-way)
```javascript
// GET /api/dashboard/stream
app.get('/api/dashboard/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  setInterval(() => {
    res.write(`data: ${JSON.stringify(metrics)}\n\n`);
  }, 30000);
});
```

**Option 3: Polling** (Current approach - simplest)
- Frontend polls every 30-60 seconds
- Good enough for most use cases
- Lower complexity

**Recommendation**: Start with **Option 3 (Polling)**, upgrade to **Option 2 (SSE)** if needed.

---

## 4. Priority Endpoints to Implement First

### Phase 1: Critical Missing Endpoints (Week 1)

1. **Inventory Management**
   ```javascript
   // GET /api/inventory
   // Returns: { items: [...], totalValue: 12345.67 }
   ```

2. **Enhanced Error Handling**
   - Standardize all error responses
   - Add validation middleware

3. **Pagination Support**
   - Add to all list endpoints
   - Default: page=1, limit=50

### Phase 2: Data Management (Week 2)

4. **CRUD for Invoices**
   - PUT /api/invoices/:id
   - DELETE /api/invoices/:id
   - GET /api/invoices/:id

5. **CRUD for Waste Records**
   - PUT /api/waste/:id
   - DELETE /api/waste/:id

### Phase 3: Advanced Features (Week 3-4)

6. **Export Functionality**
   - PDF export using `pdfkit` or `puppeteer`
   - Excel export using `exceljs`

7. **Labor Cost Analysis**
   - Calculate from time tracking data (if available)
   - Or manual entry endpoint

8. **Real-time Updates**
   - SSE for dashboard metrics
   - WebSocket for alerts

---

## 5. Sample Endpoint Designs

### 5.1 Inventory Endpoint

**GET /api/inventory**

**Query Parameters**:
- `category` (optional): Filter by category
- `lowStock` (optional): Only items below threshold
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50)

**Response**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "itemName": "Chicken Breast",
        "category": "Proteins",
        "quantity": 45.5,
        "unitPrice": 8.99,
        "totalValue": 408.95,
        "lastPurchaseDate": "2024-01-10",
        "lastSaleDate": "2024-01-14",
        "expiryDate": "2024-01-20",
        "daysUntilExpiry": 6,
        "isLowStock": false,
        "isExpiringSoon": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 125,
      "totalPages": 3
    },
    "summary": {
      "totalItems": 125,
      "totalValue": 15432.67,
      "lowStockCount": 8,
      "expiringSoonCount": 12
    }
  },
  "meta": {
    "generatedAt": "2024-01-15T10:30:00Z",
    "dataSource": "database"
  }
}
```

### 5.2 Product Margins with Filters

**GET /api/analytics/product-margins**

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD
- `category` (optional): Filter by category
- `minMargin` (optional): Minimum margin % to include
- `sortBy` (optional): `profit`, `margin`, `revenue` (default: `profit`)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "items": [
      {
        "itemName": "Grilled Chicken Plate",
        "category": "Main Courses",
        "unitsSold": 450,
        "revenue": 8545.50,
        "cost": 3825.00,
        "profit": 4720.50,
        "marginPercentage": 55.25,
        "roiPercentage": 123.41,
        "avgSellingPrice": 18.99,
        "avgCostPrice": 8.50
      }
    ],
    "summary": {
      "totalRevenue": 125430.50,
      "totalCost": 52340.25,
      "totalProfit": 73090.25,
      "averageMargin": 58.25,
      "topPerformer": {
        "itemName": "Grilled Chicken Plate",
        "profit": 4720.50
      },
      "worstPerformer": {
        "itemName": "Caesar Salad",
        "profit": 234.50
      }
    }
  }
}
```

### 5.3 Waste Analysis by Category

**GET /api/analytics/waste-by-category**

**Query Parameters**:
- `startDate` (required): YYYY-MM-DD
- `endDate` (required): YYYY-MM-DD
- `groupBy` (optional): `category`, `item`, `week` (default: `category`)

**Response**:
```json
{
  "success": true,
  "data": {
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "wasteByCategory": [
      {
        "category": "Proteins",
        "totalWaste": 1234.56,
        "totalQuantity": 45.5,
        "percentageOfTotalWaste": 35.2,
        "items": [
          {
            "itemName": "Chicken Breast",
            "waste": 456.78,
            "quantity": 12.5
          }
        ]
      }
    ],
    "summary": {
      "totalWaste": 3506.78,
      "totalItems": 125,
      "averageWastePerItem": 28.05,
      "biggestWasteCategory": "Proteins"
    }
  }
}
```

---

## 6. Security Requirements

### 6.1 Authentication

**JWT Token Structure**:
```json
{
  "userId": 123,
  "restaurantId": 456,
  "role": "admin",
  "iat": 1705312800,
  "exp": 1705399200
}
```

**Middleware**:
```javascript
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 6.2 Authorization

**Role-Based Access**:
```javascript
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage:
router.get('/settings', authenticate, authorize('admin'), getSettings);
```

### 6.3 Data Privacy

- **Encryption**: All financial data encrypted at rest (SQLite → PostgreSQL with encryption)
- **HTTPS**: Enforce HTTPS in production
- **Rate Limiting**: Prevent abuse (express-rate-limit)
- **Input Validation**: Sanitize all inputs (express-validator)
- **SQL Injection**: Use parameterized queries (already done ✅)

---

## 7. Performance & Scaling Considerations

### 7.1 Database Optimization

**Current**: SQLite (good for development, limited for production)

**Recommendations**:
1. **Migrate to PostgreSQL** for production
   - Better concurrency
   - Better performance with large datasets
   - Better for multi-tenant

2. **Add Caching** (Redis)
   - Cache dashboard metrics (30-second TTL)
   - Cache analytics results (5-minute TTL)
   - Cache inventory counts (1-minute TTL)

3. **Database Indexes** (already have some ✅)
   - Add composite indexes for common queries:
     ```sql
     CREATE INDEX idx_sales_date_item ON sales_items(sale_id, item_name);
     CREATE INDEX idx_waste_date_category ON waste(waste_date, item_name);
     ```

### 7.2 API Performance

**Current Issues**:
- Some endpoints calculate on-the-fly (could be slow with large datasets)
- No pagination (returns all records)

**Solutions**:
1. **Background Jobs** (Bull Queue)
   - Pre-calculate daily metrics
   - Generate reports asynchronously
   - Sync Square data in background

2. **Pagination** (implement in Phase 1)

3. **Response Compression** (gzip)
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

### 7.3 Frontend Optimization

**Recommendations**:
1. **Data Fetching**:
   - Use React Query or SWR for caching
   - Implement optimistic updates
   - Debounce search/filter inputs

2. **Chunking**:
   - Code splitting for routes
   - Lazy load heavy components (charts)

3. **Caching Strategy**:
   - Cache static data (categories, suppliers)
   - Refresh dynamic data (metrics) every 30-60s

---

## 8. Error Handling Scenarios

### 8.1 Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "field": "startDate",
      "issue": "Must be a valid date"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

### 8.2 Common Error Codes

- `VALIDATION_ERROR` - Invalid input
- `NOT_FOUND` - Resource doesn't exist
- `UNAUTHORIZED` - Missing/invalid token
- `FORBIDDEN` - Insufficient permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SQUARE_API_ERROR` - Square integration failed
- `DATABASE_ERROR` - Database operation failed
- `INTERNAL_ERROR` - Server error

### 8.3 Frontend Error Handling

```javascript
// apiService.js
async request(endpoint, options = {}) {
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      // Handle specific error codes
      switch (data.error?.code) {
        case 'VALIDATION_ERROR':
          // Show field-specific errors
          break;
        case 'UNAUTHORIZED':
          // Redirect to login
          break;
        case 'RATE_LIMIT_EXCEEDED':
          // Show retry message
          break;
        default:
          // Generic error message
      }
      throw new ApiError(data.error);
    }
    
    return data;
  } catch (error) {
    // Network errors, etc.
    handleError(error);
  }
}
```

---

## 9. Testing Strategy

### 9.1 Backend Tests

**Unit Tests** (Jest):
- Analytics calculations
- Data transformations
- Validation logic

**Integration Tests**:
- API endpoints
- Database operations
- Square API mocking

**Example**:
```javascript
describe('GET /api/analytics/product-margins', () => {
  it('should return product margins for date range', async () => {
    const response = await request(app)
      .get('/api/analytics/product-margins')
      .query({ startDate: '2024-01-01', endDate: '2024-01-31' });
    
    expect(response.status).toBe(200);
    expect(response.body.data.items).toBeArray();
  });
});
```

### 9.2 Frontend Tests

**Component Tests** (React Testing Library):
- Dashboard components
- Data visualization
- Form submissions

**E2E Tests** (Playwright/Cypress):
- User workflows
- Data flow
- Error scenarios

---

## 10. Documentation Requirements

### 10.1 API Documentation

**Tools**:
- Swagger/OpenAPI (recommended)
- Postman Collection
- README with examples

**Example Swagger Setup**:
```javascript
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Restaurant Cost Control API',
      version: '1.0.0',
    },
  },
  apis: ['./src/routes/*.js'],
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### 10.2 Frontend Documentation

- Component documentation (Storybook)
- API integration guide
- Error handling guide
- Deployment guide

---

## 11. Implementation Checklist

### Phase 1: Critical Missing Endpoints ✅
- [ ] GET /api/inventory
- [ ] GET /api/inventory/low-stock
- [ ] Standardize error responses
- [ ] Add pagination to all list endpoints
- [ ] Add input validation middleware

### Phase 2: Data Management ✅
- [ ] PUT /api/invoices/:id
- [ ] DELETE /api/invoices/:id
- [ ] GET /api/invoices/:id
- [ ] PUT /api/waste/:id
- [ ] DELETE /api/waste/:id

### Phase 3: Authentication ✅
- [ ] POST /api/auth/login
- [ ] POST /api/auth/register
- [ ] JWT middleware
- [ ] Role-based authorization
- [ ] Password hashing (bcrypt)

### Phase 4: Advanced Features ✅
- [ ] GET /api/reports/export/pdf
- [ ] GET /api/reports/export/excel
- [ ] GET /api/analytics/labor-cost
- [ ] Server-Sent Events for real-time updates

### Phase 5: Production Readiness ✅
- [ ] Migrate to PostgreSQL
- [ ] Add Redis caching
- [ ] Add rate limiting
- [ ] Add monitoring (Sentry, DataDog)
- [ ] Add logging (Winston)
- [ ] API documentation (Swagger)

---

## 12. Next Steps

1. **Immediate** (This Week):
   - Implement inventory endpoints
   - Add pagination
   - Standardize error responses

2. **Short-term** (Next 2 Weeks):
   - Add authentication
   - Implement CRUD for invoices/waste
   - Add export functionality

3. **Medium-term** (Next Month):
   - Migrate to PostgreSQL
   - Add caching layer
   - Implement real-time updates

4. **Long-term** (Next Quarter):
   - Multi-tenant support
   - Advanced analytics (ML predictions)
   - Mobile app API

---

## Conclusion

Your backend has a **solid foundation** with comprehensive analytics calculations and POS integration. The main gaps are:

1. **Inventory management endpoints** (high priority)
2. **Authentication/authorization** (critical for production)
3. **Data management** (CRUD operations)
4. **Export functionality** (user-requested feature)
5. **Real-time updates** (nice-to-have)

The architecture is well-structured and scalable. With the recommended enhancements, you'll have a production-ready API for your restaurant analytics platform.

---

**Generated**: 2024-01-15
**Version**: 1.0
**Author**: AI Code Analysis
